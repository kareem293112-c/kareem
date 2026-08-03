const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `  // Real-time synchronization of users using Firestore
  useEffect(() => {
    const q = query(collection(db, "users"), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || data.username || 'مستشار صدى',
          avatar: data.avatar || data.avatar_url || \`https://api.dicebear.com/7.x/adventurer/svg?seed=\${doc.id}\`,
          level: data.level || data.vip_level || 1,
          coins: data.coins !== undefined ? data.coins : (data.coins_balance !== undefined ? data.coins_balance : 0),
          xp: data.xp || data.sender_xp || 0,
          ...data
        };
      }) as AppUser[];
      setUsers(usersData);
    }, (error) => {
      console.error("Error syncing users:", error);
      const errMsg = error?.message || '';
      if (errMsg.includes('Quota') || errMsg.includes('quota') || error?.code === 'resource-exhausted') {
        (window as any).__markQuotaExceeded?.();
      }
    });

    return () => unsubscribe();
  }, []);`;

const replacement = `  // Real-time synchronization of users using Firestore -> Patched to fetch once to save massive quota
  useEffect(() => {
    let isMounted = true;
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, "users"), limit(100));
        const snapshot = await getDocs(q);
        if (!isMounted) return;
        const usersData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || data.username || 'مستشار صدى',
            avatar: data.avatar || data.avatar_url || \`https://api.dicebear.com/7.x/adventurer/svg?seed=\${doc.id}\`,
            level: data.level || data.vip_level || 1,
            coins: data.coins !== undefined ? data.coins : (data.coins_balance !== undefined ? data.coins_balance : 0),
            xp: data.xp || data.sender_xp || 0,
            ...data
          };
        }) as AppUser[];
        setUsers(usersData);
      } catch (error: any) {
        console.error("Error syncing users:", error);
        const errMsg = error?.message || '';
        if (errMsg.includes('Quota') || errMsg.includes('quota') || error?.code === 'resource-exhausted') {
          (window as any).__markQuotaExceeded?.();
        }
      }
    };
    fetchUsers();
    
    // Poll every 60 seconds instead of real-time listener for ALL users
    const interval = setInterval(fetchUsers, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Patched users listener!");
} else {
  console.log("Target not found");
}
