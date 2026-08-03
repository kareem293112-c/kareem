const fs = require('fs');
let content = fs.readFileSync('src/main.tsx', 'utf8');

// Remove window.onerror
content = content.replace(/window\.onerror = function[\s\S]*?document\.body\.appendChild\(errorDiv\);\n};\n/g, '');

// Remove window.addEventListener('unhandledrejection')
content = content.replace(/window\.addEventListener\('unhandledrejection'[\s\S]*?document\.body\.appendChild\(errorDiv\);\n\}\);\n/g, '');

fs.writeFileSync('src/main.tsx', content);
