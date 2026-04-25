// File: api/admin/kie-balance.js
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Harus POST' });
    
    const { adminCode } = req.body;
    
    // Validasi admin
    if (adminCode !== 'admin123' && adminCode !== 'Kr333wol') {
        return res.status(403).json({ error: "Akses Ditolak" });
    }

    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "KIE_API_KEY belum dipasang di environment Vercel!" });

    try {
        // Memanggil API Kie.ai sesuai dokumentasi OpenAPI yang kamu berikan
        const response = await fetch("https://api.kie.ai/api/v1/chat/credit", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            }
        });

        const data = await response.json();

        if (data.code === 200) {
            // Berhasil mengambil sisa kredit pusat (Kie.ai)
            res.status(200).json({ success: true, balance: data.data });
        } else {
            res.status(400).json({ success: false, error: data.msg || "Gagal mengambil kredit dari Kie.ai" });
        }
    } catch (error) {
        console.error("Kie Balance Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}
