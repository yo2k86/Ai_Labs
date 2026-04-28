import admin from 'firebase-admin';
import crypto from 'crypto';

// ==========================================
// INISIALISASI FIREBASE ADMIN (Hanya 1 kali)
// ==========================================
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            })
        });
    } catch (error) {
        console.error('Firebase admin error', error);
    }
}
const db = admin.firestore();

export default async function handler(req, res) {
    // Vercel Dynamic Route
    let action = req.query.action;
    
    // SISTEM PINTAR: Jika HTML memanggil /api/admin, kita ambil action aslinya dari req.body
    if (action === 'admin' && req.body && req.body.action) {
        action = req.body.action;
    }

    const apiKey = process.env.KIE_API_KEY;

    // ========================================================
    // ROUTE DATABASE & ADMIN (Tidak butuh KIE_API_KEY)
    // ========================================================
    try {
        if (action === 'redeem') return await handleRedeem(req, res, db);
        if (action === 'history') return await handleHistory(req, res, db);
        if (action === 'get_users') return await handleGetUsers(req, res, db);
        if (action === 'topup') return await handleTopup(req, res, db);
        if (action === 'toggle_access') return await handleToggleAccess(req, res, db);
        if (action === 'get_referrals') return await handleGetReferrals(req, res, db);
        if (action === 'webhook') return await handleWebhook(req, res, db);
    } catch (error) {
        console.error(`Error on DB route /api/${action}:`, error);
        return res.status(500).json({ error: "Internal Server Error", message: error.message });
    }

    // ========================================================
    // ROUTE GENERATE AI
    // ========================================================
    if (!apiKey) {
        return res.status(500).json({ error: "KIE_API_KEY belum dipasang di environment Vercel!" });
    }

    try {
        switch (action) {
            case 'check': return await handleCheck(req, res, apiKey);
            case 'download': return await handleDownload(req, res, apiKey);
            case 'generate': return await handleGenerate(req, res, apiKey, db, admin);
            case 'upload': return await handleUpload(req, res, apiKey);
            case 'upload-url': return await handleUploadUrl(req, res, apiKey);
            case 'veo-action': return await handleVeoAction(req, res, apiKey);
            case 'kie-balance': return await handleKieBalance(req, res, apiKey);
            default: return res.status(404).json({ error: `Endpoint /api/${action} tidak ditemukan.` });
        }
    } catch (error) {
        console.error(`Error on AI route /api/${action}:`, error);
        return res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
}

// ==========================================
// 1. FUNGSI CHECK
// ==========================================
async function handleCheck(req, res, apiKey) {
  let taskId = req.query.taskId;
  let engine = req.query.engine;

  if (!taskId && req.url && req.url.includes('?')) {
      const urlParams = new URLSearchParams(req.url.split('?')[1]);
      taskId = taskId || urlParams.get('taskId');
      engine = engine || urlParams.get('engine');
  }

  if (!taskId) return res.status(400).json({ error: "Parameter taskId tidak ditemukan" });

  try {
    let endpoint = `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`;
    
    if ((engine && engine.toLowerCase().includes("veo")) || taskId.startsWith("veo_")) {
        endpoint = `https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`;
    }

    const response = await fetch(endpoint, {
      method: "GET", 
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: "Gagal cek status dari Kie AI.", message: error.message });
  }
}

// ==========================================
// 2. FUNGSI CONVERT TEMPFILE (DI-UPDATE AGAR LEBIH AMAN)
// ==========================================
async function handleDownload(req, res, apiKey) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Harus POST' });
    
    const originalUrl = req.body.url;
    if (!originalUrl) return res.status(400).json({ error: 'URL tidak diberikan' });

    try {
        const response = await fetch("https://api.kie.ai/api/v1/common/download-url", {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${apiKey}`, 
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ url: originalUrl })
        });

        const result = await response.json().catch(() => null);

        // Jika berhasil mendapatkan URL sementara
        if (response.ok && result && result.code === 200 && result.data) {
            return res.status(200).json({ data: result.data });
        }

        // Jika error validasi 422 (Eksternal URL) atau error lain, kembalikan URL aslinya sbg fallback
        console.warn("Kie Download API returned:", response.status, result);
        return res.status(200).json({ data: originalUrl, msg: result?.msg || 'Fallback to original URL' });

    } catch (e) {
        console.error("Gagal Request Download URL:", e.message);
        // Tetap kembalikan sukses dengan URL aslinya agar frontend tidak memunculkan Error Alert
        return res.status(200).json({ data: originalUrl, error: e.message });
    }
}

// ==========================================
// 3. FUNGSI UTAMA GENERATE 
// ==========================================
async function handleGenerate(req, res, apiKey, db, admin) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metode harus POST' });

  const { image_urls = [], video_urls = [], prompt, engine, ratio, type, duration, mode, character_orientation, background_source, userId, appId } = req.body;

  let cost = 1; 
  const engineName = (engine || '').toLowerCase();
  
  if (type === 'Gambar') {
      cost = 1;
  } else if (engineName === 'grok') {
      const dur = parseInt(duration) || 6;
      cost = (dur / 6) * 18; 
  } else if (engineName.includes('veo3.1 lite')) {
      cost = 30; 
  } else if (engineName.includes('veo3.1 fast')) {
      cost = 30;
  } else if (engineName.includes('veo3.1 quality')) {
      cost = 50; 
  } else if (engineName.includes('kling 3.0')) {
      cost = 15;
  } else if (engineName.includes('kling')) { 
      cost = 10;
  } else if (type === 'Video' || type === 'Motion') {
      cost = 5; 
  }

  if (process.env.FIREBASE_PROJECT_ID && userId && appId && cost) {
      try {
          const userRef = db.collection('artifacts').doc(appId).collection('users').doc(userId).collection('profile').doc('data');
          const userDoc = await userRef.get();
          
          if (!userDoc.exists) return res.status(403).json({ error: "Akun tidak ditemukan. Silakan reload aplikasi." });
          
          const userData = userDoc.data();
          if ((type === 'Video' || type === 'Motion') && userData.videoAccess === false) {
              return res.status(403).json({ error: "Akses pembuatan video untuk akun kamu sedang dibekukan oleh Admin." });
          }

          const currentCredits = userData.credits || 0;
          if (currentCredits < cost) return res.status(403).json({ error: `Kredit habis. Sisa ${currentCredits} ⚡, butuh ${cost} ⚡.` });

          await userRef.update({ credits: admin.firestore.FieldValue.increment(-cost) });
      } catch (err) {
          return res.status(500).json({ error: "Sistem kredit gagal. Cek konfigurasi Firebase." });
      }
  } else if (!userId) {
      return res.status(401).json({ error: "Unauthorized. Harap login kembali." });
  }

  try {
    let endpoint = 'https://api.kie.ai/api/v1/jobs/createTask';
    let payload = {};

    let incomingMode = String(mode || "720p").toLowerCase();

    if (type === 'Motion' || (engine && engine.includes('Kling'))) {
        const isKling3 = engine === 'Kling 3.0';
        
        let klingMode = incomingMode;
        if (isKling3) {
            if (klingMode === "720p") klingMode = "std";
            if (klingMode === "1080p") klingMode = "pro";
            if (klingMode !== "std" && klingMode !== "pro") klingMode = "std";
        } else {
            if (klingMode === "std") klingMode = "720p";
            if (klingMode === "pro") klingMode = "1080p";
            if (klingMode !== "720p" && klingMode !== "1080p") klingMode = "720p";
        }

        payload = {
            model: isKling3 ? "kling-3.0/motion-control" : "kling-2.6/motion-control",
            input: {
                prompt: prompt || "No distortion, the character's movements are consistent with the video.",
                input_urls: image_urls.length > 0 ? [image_urls[0]] : [], 
                video_urls: video_urls.length > 0 ? [video_urls[0]] : [],
                character_orientation: character_orientation || "video",
                mode: klingMode 
            }
        };
        if (isKling3 && background_source) {
            payload.input.background_source = background_source;
        }
    }
    else if (engine && engine.toLowerCase().includes('grok')) {
        const hasImages = image_urls && image_urls.length > 0;
        if (type === 'Video') {
            const modelName = hasImages ? "grok-imagine/image-to-video" : "grok-imagine/text-to-video";
            
            let safeMode = "normal";
            if (incomingMode === "spicy") safeMode = "spicy";
            if (incomingMode === "fun") safeMode = "fun";
            if (hasImages && safeMode === 'spicy') safeMode = "normal";

            let safeDuration = parseInt(duration) || 6;
            safeDuration = Math.min(Math.max(safeDuration, 6), 30);

            payload = {
                model: modelName,
                input: {
                    prompt: prompt ? prompt.substring(0, 4900) : "Cinematic aesthetic movement",
                    aspect_ratio: ratio || "16:9",
                    mode: safeMode,
                    duration: String(safeDuration),
                    resolution: "720p",
                    nsfw_checker: false
                }
            };
            if (hasImages) payload.input.image_urls = image_urls.slice(0, 7);
        } else if (type === 'Gambar') {
            if (hasImages) {
                payload = {
                    model: "grok-imagine/image-to-image",
                    input: { prompt: prompt || "Maintain consistency", image_urls: [image_urls[0]], nsfw_checker: false }
                };
            } else {
                payload = {
                    model: "grok-imagine/text-to-image",
                    input: { prompt: prompt, aspect_ratio: ratio || "16:9" }
                };
            }
        }
    } 
    else {
        endpoint = 'https://api.kie.ai/api/v1/veo/generate';
        let veoModel = "veo3_fast"; 
        if (engine === 'veo3.1 lite') veoModel = "veo3_lite";
        else if (engine === 'veo3.1 quality') veoModel = "veo3";

        payload = {
            model: veoModel,
            prompt: prompt || "Cinematic aesthetic generation",
            aspect_ratio: ratio || "16:9"
        };
        if (image_urls && image_urls.length > 0) {
            payload.imageUrls = image_urls;
            payload.image_urls = image_urls; 
        }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || (data.code && data.code !== 200)) {
        console.error("🔴 KIE AI REJECTED REQUEST:", JSON.stringify(data));
        
        if (process.env.FIREBASE_PROJECT_ID && userId && appId && cost) {
            const userRef = db.collection('artifacts').doc(appId).collection('users').doc(userId).collection('profile').doc('data');
            await userRef.update({ credits: admin.firestore.FieldValue.increment(cost) });
        }
        let errorMsg = "Gagal memproses task.";
        if (data.msg) errorMsg = data.msg;
        else if (data.message) errorMsg = data.message;
        else if (data.error && data.error.message) errorMsg = data.error.message;
        
        return res.status(400).json({ error: `Kie AI Error: ${errorMsg}` });
    }

    const taskId = data.data?.taskId || data.taskId || data.task_id;
    if (process.env.FIREBASE_PROJECT_ID && userId && appId && taskId) {
        try {
            const userRef = db.collection('artifacts').doc(appId).collection('users').doc(userId).collection('profile').doc('data');
            const userDoc = await userRef.get();
            const uName = userDoc.exists ? userDoc.data().name : 'User';
            const uEmail = userDoc.exists ? userDoc.data().email : 'No Email';

            await db.collection('artifacts').doc(appId).collection('history').doc(taskId).set({
                taskId: taskId,
                userId: userId,
                userName: uName,
                userEmail: uEmail,
                prompt: prompt || "Tanpa prompt",
                engine: engine || "Kie.ai Engine",
                type: type || "Video",
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        } catch (e) {
            console.error("Gagal simpan riwayat:", e);
        }
    }

    return res.status(response.status).json(data);

  } catch (error) {
    return res.status(500).json({ error: 'Terjadi kesalahan sistem di Vercel', message: error.message });
  }
}

// ==========================================
// 4. FUNGSI REDEEM
// ==========================================
async function handleRedeem(req, res, db) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Harus POST' });
    const { userId, appId, code } = req.body;

    if (!userId || !appId || !code) return res.status(400).json({ error: "Data tidak lengkap" });

    const validCodes = [
        "AL-9A2X", "AL-3B7K", "AL-8C4M", "VIP-A1X9", "PRO-1A2B", "GEN-9Z8Y", "NANO-A111", "ART-1X1A"
    ];

    const inputCode = code.toUpperCase();

    try {
        const userRef = db.collection('artifacts').doc(appId).collection('users').doc(userId).collection('profile').doc('data');
        
        await db.runTransaction(async (t) => {
            const userDoc = await t.get(userRef);
            if (!userDoc.exists) throw new Error("Data user belum diinisialisasi.");
            
            const userData = userDoc.data();
            if (userData.hasRedeemed) throw new Error("Kamu sudah pernah mengklaim kode VIP sebelumnya.");

            const currentCredits = userData.credits || 0;
            t.update(userRef, { credits: currentCredits + 200, hasRedeemed: true, redeemedCode: inputCode });
            return true;
        });

        return res.status(200).json({ success: true, message: "Selamat! 200 Kredit berhasil ditambahkan." });
    } catch (e) {
        return res.status(400).json({ success: false, error: e.message });
    }
}

// ==========================================
// 5. FUNGSI UPLOAD IMAGE
// ==========================================
async function handleUpload(req, res, apiKey) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metode harus POST' });
  try {
    const { base64Data, uploadPath, fileName } = req.body;
    if (!base64Data) return res.status(400).json({ error: 'Data base64 tidak ditemukan' });

    const response = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data, uploadPath: uploadPath || 'ailabs-uploads', fileName: fileName || `upload_${Date.now()}.jpg` })
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal mengunggah ke Kie AI', message: error.message });
  }
}

// ==========================================
// 6. FUNGSI UPLOAD URL / VIDEO
// ==========================================
async function handleUploadUrl(req, res, apiKey) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metode harus POST' });
  try {
    const { fileUrl, uploadPath, fileName } = req.body;
    if (!fileUrl) return res.status(400).json({ error: 'URL file tidak ditemukan' });

    const response = await fetch('https://kieai.redpandaai.co/api/file-url-upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileUrl, uploadPath: uploadPath || 'ailabs-url-uploads', fileName: fileName || `url_import_${Date.now()}.jpg` })
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal import URL ke Kie AI', message: error.message });
  }
}

// ==========================================
// 7. FUNGSI VEO ACTION
// ==========================================
async function handleVeoAction(req, res, apiKey) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metode harus POST' });
  const { action, taskId, prompt } = req.body;
  if (!taskId) return res.status(400).json({ error: 'taskId wajib diisi!' });

  try {
    let endpoint = '';
    let method = 'POST';
    let payload = null;

    if (action === 'extend') {
      endpoint = 'https://api.kie.ai/api/v1/veo/extend';
      payload = { taskId, prompt: prompt || "Continue the video naturally", model: "fast" };
    } else if (action === '1080p') {
      endpoint = `https://api.kie.ai/api/v1/veo/get-1080p-video?taskId=${taskId}`;
      method = 'GET';
    } else if (action === '4k') {
      endpoint = 'https://api.kie.ai/api/v1/veo/get-4k-video';
      payload = { taskId, index: 0 };
    } else {
      return res.status(400).json({ error: 'Action tidak valid' });
    }

    const options = { method, headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } };
    if (payload) options.body = JSON.stringify(payload);

    const response = await fetch(endpoint, options);
    const data = await response.json();

    if (action === '1080p' || action === '4k') {
      if (response.status === 200 && data.data?.resultUrl) {
         return res.status(200).json({ url: data.data.resultUrl });
      } else if (response.status === 200 && data.data?.resultUrls?.length > 0) {
         return res.status(200).json({ url: data.data.resultUrls[0] });
      } else if (response.status === 400 || response.status === 422) {
         if (data.msg && data.msg.toLowerCase().includes('processing')) {
             return res.status(200).json({ processing: true, msg: data.msg });
         } else if (data.msg && data.msg.includes('successfully') && data.data?.resultUrls?.length > 0) {
             return res.status(200).json({ url: data.data.resultUrls[0] });
         }
      }
    }
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal request Veo Action', message: error.message });
  }
}

// ==========================================
// 8. FUNGSI ADMIN LAINNYA
// ==========================================
async function handleHistory(req, res, db) {
    const { adminCode, appId } = req.body;
    if (adminCode !== 'admin123' && adminCode !== 'Kr333wol') return res.status(403).json({ error: "Akses Ditolak" });
    const targetAppId = appId || '1:290208256362:web:b5022be8bd57311f9cd513';
    try {
        const historySnapshot = await db.collection('artifacts').doc(targetAppId).collection('history').orderBy('timestamp', 'desc').limit(50).get();
        let historyList = [];
        historySnapshot.forEach(doc => {
            const data = doc.data();
            historyList.push({
                id: doc.id, taskId: data.taskId, userName: data.userName || 'Anonim',
                userEmail: data.userEmail || 'Tidak ada', prompt: data.prompt || '-',
                engine: data.engine || '-', type: data.type || '-',
                timestamp: data.timestamp ? data.timestamp.toDate().toISOString() : new Date().toISOString()
            });
        });
        return res.status(200).json({ success: true, history: historyList });
    } catch (error) { return res.status(500).json({ error: "Gagal mengambil riwayat" }); }
}

async function handleKieBalance(req, res, apiKey) {
    const { adminCode } = req.body;
    if (adminCode !== 'admin123' && adminCode !== 'Kr333wol') return res.status(403).json({ error: "Akses Ditolak" });
    try {
        const response = await fetch("https://api.kie.ai/api/v1/chat/credit", {
            method: "GET", headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }
        });
        const data = await response.json();
        if (data.code === 200) return res.status(200).json({ success: true, balance: data.data });
        else return res.status(400).json({ success: false, error: data.msg });
    } catch (error) { return res.status(500).json({ success: false }); }
}

async function handleGetUsers(req, res, db) {
    const { adminCode, appId } = req.body;
    if (adminCode !== 'admin123' && adminCode !== 'Kr333wol') return res.status(403).json({ error: "Akses Ditolak" });
    const targetAppId = appId || '1:290208256362:web:b5022be8bd57311f9cd513';
    try {
        const profilesSnapshot = await db.collectionGroup('profile').get();
        let usersList = [];
        for (const profileDoc of profilesSnapshot.docs) {
            const pathSegments = profileDoc.ref.path.split('/');
            if (pathSegments.length >= 4 && pathSegments[1] === targetAppId) {
                const uid = pathSegments[3]; const data = profileDoc.data();
                usersList.push({ uid, name: data.name || 'User', email: data.email || 'Anonim', isAnon: data.isAnon || false, credits: data.credits || 0, videoAccess: data.videoAccess !== false });
            }
        }
        return res.status(200).json({ success: true, users: usersList });
    } catch (error) { return res.status(500).json({ error: "Gagal mengambil data user" }); }
}

async function handleTopup(req, res, db) {
    const { adminCode, appId, targetUid, amount } = req.body;
    if (adminCode !== 'admin123' && adminCode !== 'Kr333wol') return res.status(403).json({ error: "Akses Ditolak" });
    try {
        const profileRef = db.collection('artifacts').doc(appId).collection('users').doc(targetUid).collection('profile').doc('data');
        await db.runTransaction(async (t) => {
            const doc = await t.get(profileRef);
            if (!doc.exists) throw new Error("User tidak ditemukan di database");
            t.update(profileRef, { credits: Math.max(0, (doc.data().credits || 0) + amount) });
        });
        return res.status(200).json({ success: true, message: "Topup berhasil" });
    } catch (error) { return res.status(500).json({ error: "Gagal topup" }); }
}

async function handleToggleAccess(req, res, db) {
    const { adminCode, appId, targetUid, videoAccess } = req.body;
    if (adminCode !== 'admin123' && adminCode !== 'Kr333wol') return res.status(403).json({ error: "Akses Ditolak" });
    try {
        await db.collection('artifacts').doc(appId).collection('users').doc(targetUid).collection('profile').doc('data').update({ videoAccess });
        return res.status(200).json({ success: true, message: "Akses diupdate" });
    } catch (error) { return res.status(500).json({ error: "Gagal update akses" }); }
}

async function handleGetReferrals(req, res, db) {
    const { adminCode, appId } = req.body;
    if (adminCode !== 'admin123' && adminCode !== 'Kr333wol') return res.status(403).json({ error: "Akses Ditolak" });
    const targetAppId = appId || '1:290208256362:web:b5022be8bd57311f9cd513';
    try {
        const profilesSnapshot = await db.collectionGroup('profile').get();
        let usedCodesMap = {};
        for (const profileDoc of profilesSnapshot.docs) {
            const pathSegments = profileDoc.ref.path.split('/');
            if (pathSegments.length >= 4 && pathSegments[1] === targetAppId) {
                const data = profileDoc.data();
                if (data.redeemedCode) usedCodesMap[data.redeemedCode.toUpperCase()] = data.email || pathSegments[3];
            }
        }
        const allCodes = ["AL-9A2X", "AL-3B7K", "AL-8C4M", "VIP-A1X9", "PRO-1A2B", "GEN-9Z8Y", "NANO-A111", "ART-1X1A"]; // Disingkat untuk contoh
        const result = allCodes.map(code => {
            const upperCode = code.toUpperCase();
            return { code: upperCode, used: !!usedCodesMap[upperCode], usedBy: usedCodesMap[upperCode] || null };
        });
        return res.status(200).json({ success: true, codes: result });
    } catch (error) { return res.status(500).json({ error: "Gagal mensinkronkan status kode" }); }
}

async function handleWebhook(req, res, db) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Harus POST' });
    const webhookHmacKey = process.env.WEBHOOK_HMAC_KEY; 
    const timestamp = req.headers['x-webhook-timestamp'];
    const receivedSignature = req.headers['x-webhook-signature'];
    const data = req.body;
    
    const taskId = data.data?.task_id || data.data?.taskId || data.taskId || data.task_id;
    const code = data.code;

    if (webhookHmacKey && timestamp && receivedSignature && taskId) {
        const message = `${taskId}.${timestamp}`;
        const expectedSignature = crypto.createHmac('sha256', webhookHmacKey).update(message).digest('base64');
        if (expectedSignature.length !== receivedSignature.length || !crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(receivedSignature))) {
            return res.status(401).json({ error: 'Invalid signature' });
        }
    }

    if (taskId) {
        try {
            const historyQuery = await db.collectionGroup('history').where('taskId', '==', taskId).get();
            if (!historyQuery.empty) {
                const batch = db.batch();
                historyQuery.docs.forEach(doc => {
                    batch.update(doc.ref, {
                        status: code === 200 ? 'SUCCESS' : 'FAILED',
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                });
                await batch.commit();
            }
        } catch (err) {}
    }
    return res.status(200).json({ status: 'received' });
}
