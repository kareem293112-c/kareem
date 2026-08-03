const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `              setCurrentScreen('explore'); // FORCED TO EXPLORE ALWAYS ON SUCCESSFUL LOGIN SNAPSHOT`;
const replacement = `              setCurrentScreen(prev => prev === 'login' ? 'explore' : prev);`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Reverted the terrible force explore!");
} else {
  console.log("Target not found");
}
