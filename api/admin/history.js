import admin from 'firebase-admin';

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
    const { adminCode, appId } = req.body;

    if (adminCode !== 'admin123' && adminCode !== 'Kr333wol') {
        return res.status(403).json({ error: "Akses Ditolak" });
    }
    if (!appId) {
        return res.status(400).json({ error: "appId diperlukan" });
    }

    try {
        const historySnapshot = await db.collection('artifacts').doc(appId)
                                        .collection('history')
                                        .orderBy('timestamp', 'desc')
                                        .limit(50) // Mengambil 50 riwayat terakhir agar cepat
                                        .get();
        
        let historyList = [];
        historySnapshot.forEach(doc => {
            const data = doc.data();
            historyList.push({
                id: doc.id,
                taskId: data.taskId,
                userName: data.userName || 'Anonim',
                userEmail: data.userEmail || 'Tidak ada',
                prompt: data.prompt || '-',
                engine: data.engine || '-',
                type: data.type || '-',
                timestamp: data.timestamp ? data.timestamp.toDate().toISOString() : new Date().toISOString()
            });
        });

        res.status(200).json({ success: true, history: historyList });
    } catch (error) {
        console.error("History Fetch Error:", error);
        res.status(500).json({ error: "Gagal mengambil riwayat: " + error.message });
    }
}
