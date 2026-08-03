import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `            if (errMsg.includes('Quota') || errMsg.includes('quota') || error?.code === 'resource-exhausted') {
              (window as any).__markQuotaExceeded?.();
            }
          });
        });`;

const replacement = `            if (errMsg.includes('Quota') || errMsg.includes('quota') || error?.code === 'resource-exhausted') {
              (window as any).__markQuotaExceeded?.();
            }
          });
        }).catch(err => {
          console.error("Error getting user doc:", err);
          setIsAuthChecking(false);
        });`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('src/App.tsx', code);
    console.log("Fixed missing catch in onAuthStateChanged!");
} else {
    console.log("Target not found!");
}
