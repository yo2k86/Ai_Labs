import admin from 'firebase-admin';

// Inisialisasi Firebase Admin
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            })
        });
    } catch (error) {
        console.error('Firebase admin error', error);
    }
}
const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Harus POST' });
    const { adminCode, appId, targetUid, amount } = req.body;

    // Validasi
    if (adminCode !== 'admin123' && adminCode !== 'Kr333wol') {
        return res.status(403).json({ error: "Akses Ditolak" });
    }
    if (!appId || !targetUid || typeof amount !== 'number') {
        return res.status(400).json({ error: "Data tidak lengkap" });
    }

    try {
        const profileRef = db.collection('artifacts').doc(appId).collection('users').doc(targetUid).collection('profile').doc('data');
        
        // Gunakan transaction agar penambahan/pengurangan kredit lebih aman
        await db.runTransaction(async (t) => {
            const doc = await t.get(profileRef);
            if (!doc.exists) {
                throw new Error("User tidak ditemukan di database");
            }
            const currentCredits = doc.data().credits || 0;
            // Memastikan kredit tidak tembus di bawah 0 jika admin melakukan minus
            const newCredits = Math.max(0, currentCredits + amount); 
            
            t.update(profileRef, { credits: newCredits });
        });

        res.status(200).json({ success: true, message: "Topup berhasil dieksekusi" });
    } catch (error) {
        console.error("Topup Error:", error);
        res.status(500).json({ error: "Gagal topup: " + error.message });
    }
}
