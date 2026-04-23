export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Harus POST' });
    
    // API_KEY yang Anda simpan di Vercel
    const apiKey = process.env.KIE_API_KEY; 

    try {
        const response = await fetch("https://api.kie.ai/api/v1/common/download-url", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ url: req.body.url })
        });
        const result = await response.json();
        
        // Kembalikan URL asli ke index.html kita
        res.status(200).json({ data: result.data || req.body.url });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}
