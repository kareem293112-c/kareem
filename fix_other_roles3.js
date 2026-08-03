import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(/if \(isPrivileged\) \{ res = \{ \.\.\.res, role: 'admin' \}; \} else if \(res\.role === 'admin'\) \{ res = \{ \.\.\.res, role: 'user' \}; \}/g,
"if (isPrivileged) { res = { ...res, role: 'admin' }; } else if (res.role === 'admin' && email !== 'karmo2931@gmail.com') { res = { ...res, role: 'user' }; }");
code = code.replace(/if \(email === 'karmo2931@gmail\.com'\) \{ res = \{ \.\.\.res, displayId: '50505' \}; \} else if \(res\.displayId === '50505'\) \{ res = \{ \.\.\.res, displayId: res\.id \}; \}/g,
"if (email === 'karmo2931@gmail.com') { res = { ...res, displayId: '50505' }; } else if (res.displayId === '50505' && email !== 'karmo2931@gmail.com') { res = { ...res, displayId: res.originalDisplayId || res.displayId }; }");
fs.writeFileSync('src/App.tsx', code);
