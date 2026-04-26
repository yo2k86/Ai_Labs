// ... existing code ...
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || (data.code && data.code !== 200)) {
        console.error("API KIE Error:", data);
        if (process.env.FIREBASE_PROJECT_ID && userId && appId && cost) {
            const userRef = db.collection('artifacts').doc(appId).collection('users').doc(userId).collection('profile').doc('data');
            await userRef.update({ credits: admin.firestore.FieldValue.increment(cost) }); // Refund
        }
        return res.status(400).json({ error: "Gagal membuat task di KIE AI", details: data });
    }

    // === 🚀 TAMBAHAN BARU: SIMPAN RIWAYAT KE FIREBASE ===
    if (process.env.FIREBASE_PROJECT_ID && userId && appId) {
        try {
            // Ambil info nama & email user
            const userRef = db.collection('artifacts').doc(appId).collection('users').doc(userId).collection('profile').doc('data');
            const userDoc = await userRef.get();
            const userName = userDoc.exists ? userDoc.data().name : 'User';
            const userEmail = userDoc.exists ? userDoc.data().email : 'Anonim';

            // Ambil Task ID dari KIE
            const taskId = data.data?.taskId || data.taskId || data.task_id || 'unknown';
            
            // Simpan ke collection 'history'
            await db.collection('artifacts').doc(appId).collection('history').add({
                taskId: taskId,
                userId: userId,
                userName: userName,
                userEmail: userEmail,
                prompt: prompt || 'Tanpa prompt',
                engine: engine || 'Unknown',
                type: type || 'Unknown',
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        } catch (err) {
            console.error("Gagal simpan history:", err);
        }
    }
    // ====================================================

    return res.status(response.status).json(data);
}

// ==========================================
// 4. FUNGSI REDEEM (/api/redeem)
// ... existing code ...
