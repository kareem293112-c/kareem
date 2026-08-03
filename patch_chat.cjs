const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldListener = `    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(70));

    const unsubscribe = onSnapshot(q, (snapshot) => {`;
    
const newListener = `    // Only listen to messages sent AFTER we join to save read quotas
    const joinTime = new Date().toISOString();
    const q = query(messagesRef, where("createdAt", ">=", joinTime), orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // If we are getting the snapshot, we only append new messages to the existing state
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const doc = change.doc;
          const data = doc.data();
          const msg = {
            id: doc.id,
            sender: data.sender || 'مستخدم',
            text: data.text || '',
            color: data.color || 'text-purple-300 font-medium',
            type: data.type || 'chat',
            isEncrypted: data.isEncrypted || false,
            rawCiphertext: data.rawCiphertext || '',
            iv: data.iv || '',
            createdAt: data.createdAt
          };
          setRoomMessages(prev => {
            // Avoid duplicates
            if (prev.find(m => m.id === msg.id)) return prev;
            return [...prev, msg].slice(-100); // Keep max 100 in local state
          });
          
          // Ephemeral cleanup: sender deletes their own message after 10 seconds to save storage quota
          if (data.senderId === currentUser?.id || data.sender === currentUser?.name) {
            setTimeout(() => {
              deleteDoc(doc.ref).catch(() => {});
            }, 10000);
          }
        }
      });
      // We don't need to map over all docs anymore since we manage state incrementally
    }, (error) => {`;

if (code.includes(oldListener)) {
  code = code.replace(oldListener, newListener);
  // Also fix the state mapping
  const oldMap = `      const msgs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          sender: data.sender || 'مستخدم',
          text: data.text || '',
          color: data.color || 'text-purple-300 font-medium',
          type: data.type || 'chat',
          isEncrypted: data.isEncrypted || false,
          rawCiphertext: data.rawCiphertext || '',
          iv: data.iv || '',
          createdAt: data.createdAt
        };
      });

      const initialSystemMsg = { sender: 'نظام المجلس', text: 'مرحباً بكم في صدى العرب! يرجى الالتزام بالاحترام المتبادل داخل مجالسنا الموقرة.', color: 'text-purple-400 font-bold', type: 'system' };
      setRoomMessages([
        initialSystemMsg,
        ...msgs
      ]);`;
      
  code = code.replace(oldMap, "");
  fs.writeFileSync('src/App.tsx', code);
  console.log("Patched chat listener");
} else {
  console.log("Could not find old listener");
}
