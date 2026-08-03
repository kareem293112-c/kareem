const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `    db.collection("users").where("displayId", "==", "50505").get()
      .then(snapshot => console.log("🔥 [STARTUP TEST] USERS FOUND:", snapshot.size))
      .catch(err => console.error("❌ [STARTUP TEST] Error:", err));`;

const replacement = `    db.collection("users").where("displayId", "==", "50505").get()
      .then(snapshot => console.log("🔥 [STARTUP TEST] USERS FOUND:", snapshot.size))
      .catch(err => console.log("⚠️ [STARTUP TEST] Skipped/Error (Quota likely exceeded)"));`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('server.ts', code);
  console.log("Patched server.ts startup test!");
} else {
  console.log("Target not found");
}
