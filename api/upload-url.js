export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metode tidak diizinkan, harus POST' });

  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'KIE_API_KEY belum dipasang di environment Vercel!' });

  try {
    const { fileUrl, uploadPath, fileName } = req.body;
    if (!fileUrl) return res.status(400).json({ error: 'URL file tidak ditemukan' });

    // Endpoint Redpanda untuk meneruskan URL langsung
    const response = await fetch('https://kieai.redpandaai.co/api/file-url-upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileUrl: fileUrl,
        uploadPath: uploadPath || 'ailabs-url-uploads',
        fileName: fileName || `url_import_${Date.now()}.jpg`
      })
    });

    const data = await response.json();
    res.status(response.status).json(data);

  } catch (error) {
    res.status(500).json({ error: 'Gagal import URL ke Kie AI', message: error.message });
  }
}