export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metode tidak diizinkan, harus POST' });

  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'KIE_API_KEY belum dipasang di environment Vercel!' });

  try {
    const { base64Data, uploadPath, fileName } = req.body;
    if (!base64Data) return res.status(400).json({ error: 'Data base64 tidak ditemukan' });

    const response = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        base64Data: base64Data,
        uploadPath: uploadPath || 'ailabs-uploads',
        fileName: fileName || `upload_${Date.now()}.jpg`
      })
    });

    const data = await response.json();
    res.status(response.status).json(data);

  } catch (error) {
    res.status(500).json({ error: 'Gagal mengunggah ke Kie AI', message: error.message });
  }
}