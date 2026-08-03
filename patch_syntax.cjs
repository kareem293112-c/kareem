const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const target = `      // We don't need to map over all docs anymore since we manage state incrementally
    }, (error) => {

    }, (error) => {
      console.error("Error syncing room messages:", error);
    });`;
const replacement = `      // We don't need to map over all docs anymore since we manage state incrementally
      },
      error: (error) => {
        console.error("Error syncing room messages:", error);
      }
    });`;

code = code.replace(target, replacement);
fs.writeFileSync('src/App.tsx', code);
console.log("Patched syntax 2");
