const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const auth = getAuth(app);

signInWithEmailAndPassword(auth, "karmo2931@gmail.com", "YOUR_PASSWORD").then(user => {
  console.log(user.user.uid);
}).catch(e => console.log(e.message));
