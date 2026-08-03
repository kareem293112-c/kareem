const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  // Try to find the user with name Kareem
  const { collection, query, where, getDocs } = require('firebase/firestore');
  const q = query(collection(db, "users"), where("name", "==", "Kareem"));
  const snap = await getDocs(q);
  snap.forEach(d => console.log(d.id, d.data()));
  process.exit(0);
}
run();
