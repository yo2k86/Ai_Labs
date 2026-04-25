// ... existing code ...
    if (!appId) {
        return res.status(400).json({ error: "appId diperlukan" });
    }

    try {
        // PERBAIKAN: Menggunakan listDocuments() untuk membaca "phantom document" di Firebase
        const userRefs = await db.collection('artifacts').doc(appId).collection('users').listDocuments();
        
        let usedCodesMap = {};
        
        // Cek riwayat penggunaan kode per user
        for (const userRef of userRefs) {
            const profileDataRef = userRef.collection('profile').doc('data');
            const profileDoc = await profileDataRef.get();
            
            if (profileDoc.exists) {
                const data = profileDoc.data();
                if (data.redeemedCode) {
                    usedCodesMap[data.redeemedCode.toUpperCase()] = data.email || userRef.id;
                }
            }
        }

        // DAFTAR 300 KODE KAMU
        const allCodes = [
// ... existing code ...
