const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `          }, (error) => {
            console.error("Error listening to current user doc:", error);
            const errMsg = error?.message || '';
            if (errMsg.includes('Quota') || errMsg.includes('quota') || error?.code === 'resource-exhausted') {
              (window as any).__markQuotaExceeded?.();
            }
            setIsAuthChecking(false);
          });`;

const replacement = `          }, (error) => {
            console.error("Error listening to current user doc:", error);
            const errMsg = error?.message || '';
            if (errMsg.includes('Quota') || errMsg.includes('quota') || error?.code === 'resource-exhausted') {
              (window as any).__markQuotaExceeded?.();
              
              // Fallback mock user to allow entry despite quota
              const defaultName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'مستشار صدى';
              const defaultAvatar = firebaseUser.photoURL || \`https://api.dicebear.com/7.x/adventurer/svg?seed=\${firebaseUser.uid}\`;
              const fallbackUser = {
                id: firebaseUser.uid,
                displayId: "99999",
                originalDisplayId: "99999",
                name: defaultName,
                avatar: defaultAvatar,
                level: 1,
                coins: 1000,
                xp: 0,
                role: firebaseUser.email === 'karmo2931@gmail.com' ? 'admin' : 'user',
                bio: 'عضو مميز في صدى العرب ☕',
                followers: [],
                following: [],
                badges: [],
                createdAt: new Date().toISOString()
              };
              setCurrentUser(fallbackUser as AppUser);
              setCurrentScreen(prev => prev === 'login' ? 'explore' : prev);
              alert("⚠️ تنبيه: لقد نفدت سعة القراءة المجانية لقاعدة بيانات Firebase اليوم (Quota Exceeded). \\n\\nتم إدخالك بوضع التصفح المؤقت، لكن بعض الميزات (كالغرف والمستخدمين) قد لا تعمل حتى يتم تجديد الباقة غداً أو ترقية الخطة.");
            }
            setIsAuthChecking(false);
          });`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Patched auth snapshot catch block for quota fallback!");
} else {
  console.log("Target not found");
}
