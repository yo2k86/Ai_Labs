export default async function handler(req, res) {
  // PERBAIKAN: Disamakan dengan generate.js dan download.js (KIE_API_KEY)
  const apiKey = process.env.KIE_API_KEY;
  const { taskId, engine } = req.query;

  if (!taskId) {
    return res.status(400).json({ error: "Parameter taskId tidak ditemukan" });
  }

  if (!apiKey) {
    return res.status(500).json({ error: "KIE_API_KEY belum dipasang di environment Vercel!" });
  }

  try {
    // AMAN BROW: Grok, Kling, Wan, dll otomatis pakai ini (Default)
    let endpoint = `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`;
    
    // KHUSUS VEO: Kita arahkan ke endpoint Veo yang baru (record-info)
    if ((engine && engine.toLowerCase().includes("veo")) || taskId.startsWith("veo_")) {
        // Tadi belakangnya "record-detail", untuk Veo 3.1 diubah jadi "record-info"
        endpoint = `https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`;
    }

    // Melakukan pengecekan menggunakan method GET sesuai spesifikasi baru
    const response = await fetch(endpoint, {
      method: "GET", 
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Gagal cek status dari Kie AI.", message: error.message });
  }
}