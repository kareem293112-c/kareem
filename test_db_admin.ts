import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

const projectId = "gen-lang-client-0348881645";
const databaseId = "ai-studio-sadaalarabvoiceb-5f452604-580f-4265-ab18-da9c404b3698";

let app = initializeApp({ projectId: projectId });
let firestoreInstance = getFirestore(app);
firestoreInstance.settings({ databaseId });
firestoreInstance.collection("users").limit(1).get().then(snap => {
  snap.forEach(d => console.log(d.id, d.data()));
  process.exit(0);
}).catch(e => {
  console.log("ERROR:", e);
  process.exit(1);
});
