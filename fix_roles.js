import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/if \(isPrivileged\) \{\s*res = \{ \.\.\.res, role: 'admin' \};\s*\}/g, 
  "if (isPrivileged) { res = { ...res, role: 'admin' }; } else if (res.role === 'admin') { res = { ...res, role: 'user' }; }");

code = code.replace(/if \(email === 'karmo2931@gmail.com'\) \{\s*res = \{ \.\.\.res, displayId: '50505' \};\s*\}/g,
  "if (email === 'karmo2931@gmail.com') { res = { ...res, displayId: '50505' }; } else if (res.displayId === '50505') { res = { ...res, displayId: res.id }; }");

fs.writeFileSync('src/App.tsx', code);
