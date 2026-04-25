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
    // Pastikan metode POST
    if (req.method !== 'POST') return res.status(405).json({ error: 'Harus POST' });
    const { adminCode, appId } = req.body;

    // Validasi Password Admin
    if (adminCode !== 'admin123' && adminCode !== 'Kr333wol') {
        return res.status(403).json({ error: "Akses Ditolak" });
    }

    if (!appId) {
        return res.status(400).json({ error: "appId diperlukan" });
    }

    try {
        // Ambil semua data pengguna dari koleksi root users
        const usersSnapshot = await db.collection('artifacts').doc(appId).collection('users').get();
        let usersList = [];

        // Loop satu per satu untuk mengambil profil masing-masing user
        for (const userDoc of usersSnapshot.docs) {
            const profileDataRef = db.collection('artifacts').doc(appId).collection('users').doc(userDoc.id).collection('profile').doc('data');
            const profileDoc = await profileDataRef.get();
            
            if (profileDoc.exists) {
                const data = profileDoc.data();
                usersList.push({
                    uid: userDoc.id,
                    name: data.name || 'User',
                    email: data.email || 'Anonim',
                    isAnon: data.isAnon || false,
                    credits: data.credits || 0,
                    videoAccess: data.videoAccess !== false // Jika tidak ada field videoAccess, anggap true (ON)
                });
            }
        }

        res.status(200).json({ success: true, users: usersList });
    } catch (error) {
        console.error("Users Sync Error:", error);
        res.status(500).json({ error: "Gagal mengambil data user: " + error.message });
    }
}