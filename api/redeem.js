const admin = require('firebase-admin');

// Inisialisasi Firebase Admin dengan kredensial dari Environment Variables
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
            })
        });
    } catch (error) {
        console.error('Firebase admin error', error);
    }
}
const db = admin.firestore();

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Harus POST' });
    const { userId, appId, code } = req.body;

    // Validasi input dasar
    if (!userId || !appId || !code) {
        return res.status(400).json({ error: "Data tidak lengkap (userId, appId, atau kode kosong)" });
    }

    // DAFTAR LENGKAP 300 KODE VIP (Wajib sinkron dengan referrals.js)
    const validCodes = [
        "AL-9A2X", "AL-3B7K", "AL-8C4M", "AL-1D9P", "AL-5E6R", "AL-7F3T", "AL-2G8V", "AL-6H5Y", "AL-4J1Z", "AL-9K3B",
        "AL-2L7C", "AL-8M4D", "AL-3N9F", "AL-5P6G", "AL-7Q2H", "AL-1R8J", "AL-6T5K", "AL-4V1L", "AL-9W3M", "AL-2X7N",
        "AL-8Y4P", "AL-3Z9Q", "AL-5A6R", "AL-7B2T", "AL-1C8V", "AL-6D5W", "AL-4E1X", "AL-9F3Y", "AL-2G7Z", "AL-8H4A",
        "VIP-A1X9", "VIP-B2Y8", "VIP-C3Z7", "VIP-D4A6", "VIP-E5B5", "VIP-F6C4", "VIP-G7D3", "VIP-H8E2", "VIP-J9F1", "VIP-K1G9",
        "VIP-L2H8", "VIP-M3J7", "VIP-N4K6", "VIP-P5L5", "VIP-Q6M4", "VIP-R7N3", "VIP-T8P2", "VIP-V9Q1", "VIP-W1R9", "VIP-X2T8",
        "VIP-Y3V7", "VIP-Z4W6", "VIP-A5X5", "VIP-B6Y4", "VIP-C7Z3", "VIP-D8A2", "VIP-E9B1", "VIP-F1C9", "VIP-G2D8", "VIP-H3E7",
        "PRO-1A2B", "PRO-3C4D", "PRO-5E6F", "PRO-7G8H", "PRO-9J1K", "PRO-2L3M", "PRO-4N5P", "PRO-6Q7R", "PRO-8T9V", "PRO-1W2X",
        "PRO-3Y4Z", "PRO-5A6C", "PRO-7E8G", "PRO-9J1L", "PRO-2N3Q", "PRO-4T5W", "PRO-6Y7A", "PRO-8D9F", "PRO-1H2K", "PRO-3M4P",
        "PRO-5R6T", "PRO-7V8X", "PRO-9Z1B", "PRO-2C3E", "PRO-4G5J", "PRO-6L7N", "PRO-8Q9S", "PRO-1U2W", "PRO-3Y4A", "PRO-5C6D",
        "GEN-9Z8Y", "GEN-7X6W", "GEN-5V4T", "GEN-3R2Q", "GEN-1P9N", "GEN-8M7L", "GEN-6K5J", "GEN-4H3G", "GEN-2F1E", "GEN-9D8C",
        "GEN-7B6A", "GEN-5Z4Y", "GEN-3X2W", "GEN-1V9T", "GEN-8R7Q", "GEN-6P5N", "GEN-4M3L", "GEN-2K1J", "GEN-9H8G", "GEN-7F6E",
        "GEN-5D4C", "GEN-3B2A", "GEN-1Z9Y", "GEN-8X7W", "GEN-6V5T", "GEN-4R3Q", "GEN-2P1N", "GEN-9M8L", "GEN-7K6J", "GEN-5H4G",
        "NANO-A111", "NANO-B222", "NANO-C333", "NANO-D444", "NANO-E555", "NANO-F666", "NANO-G777", "NANO-H888", "NANO-J999", "NANO-K101",
        "NANO-L202", "NANO-M303", "NANO-N404", "NANO-P505", "NANO-Q606", "NANO-R707", "NANO-T808", "NANO-V909", "NANO-W121", "NANO-X232",
        "NANO-Y343", "NANO-Z454", "NANO-A565", "NANO-B676", "NANO-C787", "NANO-D898", "NANO-E909", "NANO-F131", "NANO-G242", "NANO-H353",
        "ART-1X1A", "ART-2X2B", "ART-3X3C", "ART-4X4D", "ART-5X5E", "ART-6X6F", "ART-7X7G", "ART-8X8H", "ART-9X9J", "ART-1Y1K",
        "ART-2Y2L", "ART-3Y3M", "ART-4Y4N", "ART-5Y5P", "ART-6Y6Q", "ART-7Y7R", "ART-8Y8T", "ART-9Y9V", "ART-1Z1W", "ART-2Z2X",
        "ART-3Z3Y", "ART-4Z4Z", "ART-5A5A", "ART-6A6B", "ART-7A7C", "ART-8A8D", "ART-9A9E", "ART-1B1F", "ART-2B2G", "ART-3B3H",
        "AILABS-001", "AILABS-002", "AILABS-003", "AILABS-004", "AILABS-005", "AILABS-006", "AILABS-007", "AILABS-008", "AILABS-009", "AILABS-010",
        "AILABS-011", "AILABS-012", "AILABS-013", "AILABS-014", "AILABS-015", "AILABS-016", "AILABS-017", "AILABS-018", "AILABS-019", "AILABS-020",
        "AILABS-021", "AILABS-022", "AILABS-023", "AILABS-024", "AILABS-025", "AILABS-026", "AILABS-027", "AILABS-028", "AILABS-029", "AILABS-030",
        "AILABS-031", "AILABS-032", "AILABS-033", "AILABS-034", "AILABS-035", "AILABS-036", "AILABS-037", "AILABS-038", "AILABS-039", "AILABS-040",
        "AILABS-041", "AILABS-042", "AILABS-043", "AILABS-044", "AILABS-045", "AILABS-046", "AILABS-047", "AILABS-048", "AILABS-049", "AILABS-050",
        "AILABS-051", "AILABS-052", "AILABS-053", "AILABS-054", "AILABS-055", "AILABS-056", "AILABS-057", "AILABS-058", "AILABS-059", "AILABS-060",
        "VEO-9A1", "VEO-8B2", "VEO-7C3", "VEO-6D4", "VEO-5E5", "VEO-4F6", "VEO-3G7", "VEO-2H8", "VEO-1J9", "VEO-9K1",
        "VEO-8L2", "VEO-7M3", "VEO-6N4", "VEO-5P5", "VEO-4Q6", "VEO-3R7", "VEO-2T8", "VEO-1V9", "VEO-9W1", "VEO-8X2",
        "VEO-7Y3", "VEO-6Z4", "VEO-5A5", "VEO-4B6", "VEO-3C7", "VEO-2D8", "VEO-1E9", "VEO-9F1", "VEO-8G2", "VEO-7H3",
        "GROK-12A", "GROK-34B", "GROK-56C", "GROK-78D", "GROK-90E", "GROK-21F", "GROK-43G", "GROK-65H", "GROK-87J", "GROK-09K",
        "GROK-13L", "GROK-24M", "GROK-35N", "GROK-46P", "GROK-57Q", "GROK-68R", "GROK-79T", "GROK-80V", "GROK-91W", "GROK-02X",
        "GROK-14Y", "GROK-25Z", "GROK-36A", "GROK-47B", "GROK-58C", "GROK-69D", "GROK-70E", "GROK-81F", "GROK-92G", "GROK-03H"
    ];

    const inputCode = code.toUpperCase();

    // 1. Cek apakah kode ada di daftar valid
    if (!validCodes.includes(inputCode)) {
        return res.status(400).json({ success: false, error: "Kode tidak valid! Periksa kembali penulisan kodenya." });
    }

    try {
        const userRef = db.collection('artifacts').doc(appId).collection('users').doc(userId).collection('profile').doc('data');
        
        // Gunakan transaksi Firestore agar proses pengecekan dan penambahan saldo aman
        const result = await db.runTransaction(async (t) => {
            const userDoc = await t.get(userRef);
            if (!userDoc.exists) {
                throw new Error("Data user belum diinisialisasi di database.");
            }
            
            const userData = userDoc.data();
            
            // 2. Cek apakah user ini sudah pernah klaim kode apapun sebelumnya
            if (userData.hasRedeemed) {
                throw new Error("Kamu sudah pernah mengklaim kode VIP sebelumnya. Jatah klaim hanya 1x per akun.");
            }

            // 3. Cek apakah kode ini sudah dipakai oleh orang lain (global check)
            // Note: Kita mencari di seluruh koleksi user apakah ada yang punya redeemedCode yang sama
            const usersSnapshot = await t.get(db.collection('artifacts').doc(appId).collection('users'));
            
            for (const doc of usersSnapshot.docs) {
                const profileRef = db.collection('artifacts').doc(appId).collection('users').doc(doc.id).collection('profile').doc('data');
                const profileSnap = await t.get(profileRef);
                
                if (profileSnap.exists && profileSnap.data().redeemedCode === inputCode) {
                    throw new Error("Maaf, kode ini sudah digunakan oleh orang lain.");
                }
            }

            // Jika semua lolos, tambahkan kredit
            const currentCredits = userData.credits || 0;
            t.update(userRef, { 
                credits: currentCredits + 200, 
                hasRedeemed: true, 
                redeemedCode: inputCode 
            });
            
            return true;
        });

        res.status(200).json({ success: true, message: "Selamat! 200 Kredit berhasil ditambahkan ke akunmu." });

    } catch (e) {
        console.error("Redeem Error:", e.message);
        res.status(400).json({ success: false, error: e.message });
    }
}