import fs from 'fs';
let code = fs.readFileSync('firestore.rules', 'utf8');
code = code.replace(/get\(\/databases\/\$\(database\)\/documents\/users\/\$\(request.auth.uid\)\)\.data\.name == 'كريم' \|\|/g, "");
code = code.replace(/get\(\/databases\/\$\(database\)\/documents\/users\/\$\(request.auth.uid\)\)\.data\.displayId == 'صدى العرب'/g, "false");
fs.writeFileSync('firestore.rules', code);
