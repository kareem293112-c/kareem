const fs = require('fs');
let content = fs.readFileSync('firestore.rules', 'utf8');
if (content.includes('allow read, write: if isSignedIn();') && content.includes('match /mic_seats/')) {
    // Already patched using edit_file tool
}
