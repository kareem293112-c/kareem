const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `        }).catch(e => {
          console.error("Error fetching user doc:", e);
          setIsAuthChecking(false);
        });`;
const replacement = `        }).catch(e => {
          console.error("Error fetching user doc:", e);
          alert("حدث خطأ أثناء الاتصال بقاعدة البيانات. يرجى المحاولة لاحقاً. " + (e.message || ''));
          setIsAuthChecking(false);
        });`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Added alert to getDoc catch block!");
} else {
  console.log("Target not found");
}
