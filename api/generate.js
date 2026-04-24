import admin from 'firebase-admin';

// Inisialisasi Firebase Admin
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                // Pastikan private key string terbaca dengan benar dari Vercel Env
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            })
        });
    } catch (error) {
        console.error('Firebase admin error', error);
    }
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metode harus POST' });

  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'KIE_API_KEY belum dipasang di environment Vercel!' });

  const { image_urls = [], video_urls = [], prompt, engine, ratio, type, duration, mode, character_orientation, background_source, userId, appId, cost } = req.body;

  // ==========================================
  // 1. CEK DAN POTONG KREDIT VIA FIREBASE ADMIN
  // ==========================================
  if (process.env.FIREBASE_PROJECT_ID && userId && appId && cost) {
      try {
          const userRef = db.collection('artifacts').doc(appId)
                            .collection('users').doc(userId)
                            .collection('profile').doc('data');
                            
          const userDoc = await userRef.get();
          
          if (!userDoc.exists) {
              return res.status(403).json({ error: "Akun tidak ditemukan. Silakan reload aplikasi." });
          }
          
          const userData = userDoc.data();
          
          // ==========================================
          // CEK AKSES VIDEO (Tambahan Baru)
          // ==========================================
          if ((type === 'Video' || type === 'Motion') && userData.videoAccess === false) {
              return res.status(403).json({ error: "Akses pembuatan video untuk akun kamu sedang dibekukan oleh Admin." });
          }

          const currentCredits = userData.credits || 0;
          
          if (currentCredits < cost) {
              return res.status(403).json({ error: `Kredit habis. Sisa ${currentCredits} ⚡, butuh ${cost} ⚡.` });
          }

          // Potong kreditnya
          await userRef.update({
              credits: admin.firestore.FieldValue.increment(-cost)
          });
      } catch (err) {
          console.error("Gagal potong kredit:", err);
          return res.status(500).json({ error: "Sistem kredit gagal. Cek konfigurasi Firebase." });
      }
  } else if (!userId) {
      return res.status(401).json({ error: "Unauthorized. Harap login kembali." });
  }

  // ==========================================
  // 2. KODE ASLI GENERATE KIE AI
  // ==========================================
  try {
    let endpoint = 'https://api.kie.ai/api/v1/jobs/createTask';
    let payload = {};

    // LOGIKA KLING / MOTION
    if (type === 'Motion' || (engine && engine.includes('Kling'))) {
        const isKling3 = engine === 'Kling 3.0';
        payload = {
            model: isKling3 ? "kling-3.0/motion-control" : "kling-2.6/motion-control",
            input: {
                prompt: prompt || "No distortion, the character's movements are consistent with the video.",
                input_urls: image_urls.length > 0 ? [image_urls[0]] : [], 
                video_urls: video_urls.length > 0 ? [video_urls[0]] : [],
                character_orientation: character_orientation || "video",
                mode: mode || "720p" 
            }
        };
        if (isKling3 && background_source) {
            payload.input.background_source = background_source;
        }
    }
    // LOGIKA GROK
    else if (engine && engine.toLowerCase() === 'grok') {
        if (type === 'Video') {
            const hasImages = image_urls && image_urls.length > 0;
            const modelName = hasImages ? "grok-imagine/image-to-video" : "grok-imagine/text-to-video";
            payload = {
                model: modelName,
                input: {
                    prompt: prompt || "Cinematic aesthetic movement",
                    aspect_ratio: ratio || "16:9",
                    mode: "normal",
                    duration: duration ? String(duration) : "6",
                    resolution: "720p",
                    nsfw_checker: false
                }
            };
            if (hasImages) payload.input.image_urls = image_urls.slice(0, 7);
        } else if (type === 'Gambar') {
            payload = {
                model: "grok-imagine/text-to-image",
                input: { prompt: prompt, aspect_ratio: ratio || "16:9" }
            };
        }
    } 
    // LOGIKA VEO
    else {
        endpoint = 'https://api.kie.ai/api/v1/veo/generate';
        let veoModel = "veo3_fast"; 
        if (engine === 'veo3.1 lite') veoModel = "veo3_lite";
        else if (engine === 'veo3.1 quality') veoModel = "veo3";
        else if (engine === 'veo3.1 fast') veoModel = "veo3_fast";

        payload = {
            model: veoModel,
            prompt: prompt || "Cinematic aesthetic generation",
            aspect_ratio: ratio || "16:9"
        };
        if (image_urls && image_urls.length > 0) payload.imageUrls = image_urls;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    // Tangkap kode error dari KIE jika bukan 200/Sukses
    if (!response.ok || (data.code && data.code !== 200)) {
        console.error("API KIE Error Response:", data);
        
        // JIKA AI GAGAL, KEMBALIKAN KREDITNYA (REFUND)
        if (process.env.FIREBASE_PROJECT_ID && userId && appId && cost) {
            const userRef = db.collection('artifacts').doc(appId).collection('users').doc(userId).collection('profile').doc('data');
            await userRef.update({ credits: admin.firestore.FieldValue.increment(cost) });
        }
        
        return res.status(400).json({ error: "Gagal membuat task di KIE AI", details: data });
    }

    res.status(response.status).json(data);

  } catch (error) {
    console.error("Internal Server Error:", error);
    res.status(500).json({ error: 'Terjadi kesalahan sistem di Vercel', message: error.message });
  }
}
