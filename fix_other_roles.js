import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/if \(auth\.currentUser\?\.email === 'karmo2931@gmail\.com'\) \{\s*userData = \{ \.\.\.userData, role: 'admin' \};\s*\}/g,
"if (auth.currentUser?.email === 'karmo2931@gmail.com') { userData = { ...userData, role: 'admin', displayId: '50505' }; } else if (userData.role === 'admin' || userData.displayId === '50505') { userData = { ...userData, role: 'user', displayId: userData.id }; }");

code = code.replace(/if \(firebaseUser\.email === 'karmo2931@gmail\.com'\) \{\s*userData = \{ \.\.\.userData, role: 'admin' \};\s*\}/g,
"if (firebaseUser.email === 'karmo2931@gmail.com') { userData = { ...userData, role: 'admin', displayId: '50505' }; } else if (userData.role === 'admin' || userData.displayId === '50505') { userData = { ...userData, role: 'user', displayId: userData.id }; }");

fs.writeFileSync('src/App.tsx', code);
