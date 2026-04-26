export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Harus POST' });
    
    const { adminCode } = req.body;
    
    // Validasi admin
    if (adminCode !== 'admin123' && adminCode !== 'Kr333wol') {
        return res.status(403).json({ error: "Akses Ditolak" });
    }

    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "KIE_API_KEY belum dipasang di Vercel!" });

    try {
        const response = await fetch("https://api.kie.ai/api/v1/chat/credit", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            }
        });

        const data = await response.json();

        if (response.ok && data.code === 200) {
            let balanceAmount = data.data;
            
            // Deteksi jika Kie.ai membalas dengan format objek
            if (typeof balanceAmount === 'object' && balanceAmount !== null) {
                balanceAmount = balanceAmount.total_balance ?? balanceAmount.balance ?? balanceAmount.credit ?? JSON.stringify(balanceAmount);
            }
            
            res.status(200).json({ success: true, balance: balanceAmount });
        } else {
            res.status(400).json({ success: false, error: data.msg || "Gagal mengambil kredit dari Kie.ai" });
        }
    } catch (error) {
        console.error("Kie Balance Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}
