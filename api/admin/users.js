// ... existing code ...
    if (!appId) {
        return res.status(400).json({ error: "appId diperlukan" });
    }

    try {
        // PERBAIKAN: Menggunakan listDocuments() agar user terbaca oleh sistem admin
        const userRefs = await db.collection('artifacts').doc(appId).collection('users').listDocuments();
        let usersList = [];

        // Loop satu per satu untuk mengambil profil masing-masing user
        for (const userRef of userRefs) {
            const profileDataRef = userRef.collection('profile').doc('data');
            const profileDoc = await profileDataRef.get();
            
            if (profileDoc.exists) {
                const data = profileDoc.data();
                usersList.push({
                    uid: userRef.id,
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
// ... existing code ...
