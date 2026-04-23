export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metode harus POST' });

  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'KIE_API_KEY belum dipasang di environment Vercel!' });

  const { image_urls = [], video_urls = [], prompt, engine, ratio, type, duration, mode, character_orientation, background_source } = req.body;

  try {
    let endpoint = 'https://api.kie.ai/api/v1/jobs/createTask';
    let payload = {};

    // ==========================================
    // LOGIKA UNTUK ENGINE KLING (MOTION CONTROL)
    // ==========================================
    if (type === 'Motion' || (engine && engine.includes('Kling'))) {
        const isKling3 = engine === 'Kling 3.0';
        
        payload = {
            model: isKling3 ? "kling-3.0/motion-control" : "kling-2.6/motion-control",
            input: {
                prompt: prompt || "No distortion, the character's movements are consistent with the video.",
                // BERDASARKAN DOKUMENTASI KIE TERBARU: Wajib bernama input_urls dan berbentuk Array
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
    // ==========================================
    // LOGIKA UNTUK ENGINE GROK
    // ==========================================
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
            if (hasImages) {
                payload.input.image_urls = image_urls.slice(0, 7);
            }
        } else if (type === 'Gambar') {
            payload = {
                model: "grok-imagine/text-to-image",
                input: {
                    prompt: prompt,
                    aspect_ratio: ratio || "16:9",
                }
            };
        }
    } 
    // ==========================================
    // LOGIKA UNTUK ENGINE VEO 3.1 (TERBARU)
    // ==========================================
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
        
        if (image_urls && image_urls.length > 0) {
            payload.imageUrls = image_urls;
        }
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
        return res.status(400).json({ 
            error: "Gagal membuat task di KIE AI", 
            details: data 
        });
    }

    res.status(response.status).json(data);

  } catch (error) {
    console.error("Internal Server Error:", error);
    res.status(500).json({ error: 'Terjadi kesalahan sistem di Vercel', message: error.message });
  }
}