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
        // PERBAIKAN: Menggunakan collectionGroup untuk membaca semua data user dengan cepat tanpa timeout
        const profilesSnapshot = await db.collectionGroup('profile').get();
        let usersList = [];

        // Loop melalui seluruh profil dengan aman
        for (const profileDoc of profilesSnapshot.docs) {
            // Membongkar path dokumen untuk mencocokkan appId
            const pathSegments = profileDoc.ref.path.split('/');
            
            // Path structure: artifacts/{appId}/users/{userId}/profile/data
            if (pathSegments.length >= 4 && pathSegments[1] === appId) {
                const uid = pathSegments[3];
                const data = profileDoc.data();
                
                usersList.push({
                    uid: uid,
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
