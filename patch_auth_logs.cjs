const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {`;
const replaceStr = `const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if ((window as any).addDebugLog) {
        (window as any).addDebugLog("Auth state changed. User: " + (firebaseUser ? firebaseUser.uid : "null"));
      }`;

const targetStr2 = `getDoc(userDocRef).then(async (docSnap) => {`;
const replaceStr2 = `if ((window as any).addDebugLog) (window as any).addDebugLog("Fetching getDoc for user...");
        getDoc(userDocRef).then(async (docSnap) => {
          if ((window as any).addDebugLog) (window as any).addDebugLog("getDoc resolved. Exists: " + docSnap.exists());`;

const targetStr3 = `unsubscribeUser = onSnapshot(userDocRef, (snap) => {`;
const replaceStr3 = `if ((window as any).addDebugLog) (window as any).addDebugLog("Attaching onSnapshot...");
          unsubscribeUser = onSnapshot(userDocRef, (snap) => {
            if ((window as any).addDebugLog) (window as any).addDebugLog("onSnapshot triggered. Exists: " + snap.exists());`;

const targetStr4 = `setCurrentScreen(prev => prev === 'login' ? 'explore' : prev);`;
const replaceStr4 = `if ((window as any).addDebugLog) (window as any).addDebugLog("Setting screen to explore...");
              setCurrentScreen(prev => prev === 'login' ? 'explore' : prev);`;

const targetStr5 = `}).catch(e => {
          console.error("Error fetching user doc:", e);`;
const replaceStr5 = `}).catch(e => {
          if ((window as any).addDebugLog) (window as any).addDebugLog("getDoc ERROR: " + e.message);
          console.error("Error fetching user doc:", e);`;

const targetStr6 = `await setDoc(userDocRef, newUser);`;
const replaceStr6 = `if ((window as any).addDebugLog) (window as any).addDebugLog("Creating new user doc...");
            await setDoc(userDocRef, newUser);
            if ((window as any).addDebugLog) (window as any).addDebugLog("New user doc created successfully.");`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  code = code.replace(targetStr2, replaceStr2);
  code = code.replace(targetStr3, replaceStr3);
  code = code.replace(targetStr4, replaceStr4);
  code = code.replace(targetStr5, replaceStr5);
  code = code.replace(targetStr6, replaceStr6);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Patched auth logs!");
} else {
  console.log("Target not found");
}
