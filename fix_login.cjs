const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `          unsubscribeUser = onSnapshot(userDocRef, (snap) => {
            if (snap.exists()) {
              let userData = snap.data() as AppUser;
              if (firebaseUser.email === 'karmo2931@gmail.com') { userData = { ...userData, role: 'admin', displayId: '50505' }; } else if (userData.role === 'admin' || userData.displayId === '50505') { userData = { ...userData, role: 'user', displayId: userData.originalDisplayId || userData.displayId }; }
              setCurrentUser({ ...userData, id: snap.id });
              setCurrentScreen(prev => prev === 'login' ? 'explore' : prev);
              setIsAuthChecking(false);
            } else {
              setIsAuthChecking(false);
            }
          }, (error) => {`;

const replacement = `          unsubscribeUser = onSnapshot(userDocRef, (snap) => {
            if (snap.exists()) {
              let userData = snap.data() as AppUser;
              if (firebaseUser.email === 'karmo2931@gmail.com') { userData = { ...userData, role: 'admin', displayId: '50505' }; } else if (userData.role === 'admin' || userData.displayId === '50505') { userData = { ...userData, role: 'user', displayId: userData.originalDisplayId || userData.displayId }; }
              setCurrentUser({ ...userData, id: snap.id });
              setCurrentScreen('explore'); // FORCED TO EXPLORE ALWAYS ON SUCCESSFUL LOGIN SNAPSHOT
              setIsAuthChecking(false);
            } else {
              console.warn("User doc does not exist in onSnapshot, logging out...");
              auth.signOut().catch(console.error);
              setIsAuthChecking(false);
            }
          }, (error) => {`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Fixed login transitions!");
} else {
  console.log("Target not found");
}
