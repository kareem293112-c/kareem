import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/getDoc\(userDocRef\)\.then\(async \(docSnap\) => \{/g,
"getDoc(userDocRef).then(async (docSnap) => {\n").replace(/console\.error\("Error listening to manual user doc:", error\);/g, "console.error('Error listening to manual user doc:', error);");

// Let's just sed replace the specific block.
