export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Harus POST' });
    
    const { adminCode } = req.body;
    
    // Validasi Password Admin
    if (adminCode !== 'admin123' && adminCode !== 'Kr333wol') {
        return res.status(403).json({ error: "Akses Ditolak" });
    }

    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'KIE_API_KEY belum dipasang!' });

    try {
        // Memanggil API KIE sesuai dengan spesifikasi OpenAPI yang diberikan
        const response = await fetch("https://api.kie.ai/api/v1/chat/credit", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            }
        });

        const data = await response.json();
        
        // Mengecek apakah respons dari server Kie AI sukses (code: 200)
        if (response.ok && data.code === 200) {
            // Berhasil! Mengembalikan nilai saldo yang ada di dalam properti "data"
            res.status(200).json({ success: true, balance: data.data });
        } else {
            // Gagal dari pihak server Kie (misal: token expired, dll)
            console.error("Gagal dari Kie AI:", data);
            res.status(400).json({ success: false, error: data.msg || "Gagal mengambil saldo" });
        }

    } catch (error) {
        console.error("Error cek saldo Kie:", error);
        res.status(500).json({ success: false, error: "Gagal menghubungi server Kie AI" });
    }
}
