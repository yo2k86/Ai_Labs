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
    const { adminCode, appId, targetUid, videoAccess } = req.body;

    // Validasi
    if (adminCode !== 'admin123' && adminCode !== 'Kr333wol') {
        return res.status(403).json({ error: "Akses Ditolak" });
    }
    if (!appId || !targetUid || typeof videoAccess !== 'boolean') {
        return res.status(400).json({ error: "Data tidak lengkap" });
    }

    try {
        const profileRef = db.collection('artifacts').doc(appId).collection('users').doc(targetUid).collection('profile').doc('data');
        
        // Langsung update status akses video (ON/OFF)
        await profileRef.update({ videoAccess: videoAccess });

        res.status(200).json({ success: true, message: "Akses video berhasil diupdate" });
    } catch (error) {
        console.error("Toggle Access Error:", error);
        res.status(500).json({ error: "Gagal update akses: " + error.message });
    }
}