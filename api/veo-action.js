export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metode harus POST' });

  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'KIE_API_KEY belum dipasang di environment Vercel!' });

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
      method = 'GET'; // 1080p harus pakai GET
    } else if (action === '4k') {
      endpoint = 'https://api.kie.ai/api/v1/veo/get-4k-video';
      payload = { taskId, index: 0 }; // 4K harus pakai POST
    } else {
      return res.status(400).json({ error: 'Action tidak valid' });
    }

    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    };

    if (payload) options.body = JSON.stringify(payload);

    const response = await fetch(endpoint, options);

    // --- PENGAMAN EXTRA: Pastikan respons JSON ---
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Respons dari server KIE bukan JSON (Mungkin sedang maintenance).");
    }

    const data = await response.json();

    // Handling response untuk Upscaling (1080p dan 4K)
    if (action === '1080p' || action === '4k') {
      if (response.status === 200 && data.data?.resultUrl) {
         return res.status(200).json({ url: data.data.resultUrl });
      } else if (response.status === 200 && data.data?.resultUrls?.length > 0) {
         return res.status(200).json({ url: data.data.resultUrls[0] });
      } else if (response.status === 400 || response.status === 422) {
         // Jika API KIE membalas "processing", kita beri tau frontend untuk terus menunggu
         if (data.msg && data.msg.toLowerCase().includes('processing')) {
             return res.status(200).json({ processing: true, msg: data.msg });
         } else if (data.msg && data.msg.includes('successfully') && data.data?.resultUrls?.length > 0) {
             // 4K kadang membalas code 422 padahal sukses. Kita antisipasi di sini.
             return res.status(200).json({ url: data.data.resultUrls[0] });
         }
      }
    }

    // Jika ini adalah request 'extend', cukup kembalikan taskId baru untuk di-polling frontend
    res.status(response.status).json(data);

  } catch (error) {
    console.error("Error di veo-action.js:", error);
    res.status(500).json({ error: 'Gagal request Veo Action', message: error.message });
  }
}
