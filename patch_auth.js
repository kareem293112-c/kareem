const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldGetNextDisplayId = `const getNextDisplayId = async (): Promise<string> => {
  try {
    const q = query(collection(db, "users"));
    const querySnapshot = await getDocs(q);
    
    let maxId = 50499; // Starts at 50500 if no sequential IDs exist
    
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.displayId) {
        const idNum = parseInt(data.displayId, 10);
        // Only consider standard sequential IDs (between 50500 and 99999)
        if (!isNaN(idNum) && idNum >= 50500 && idNum < 100000) {
          if (idNum > maxId) {
            maxId = idNum;
          }
        }
      }
    });
    
    let nextId = maxId + 1;
    
    // Ensure uniqueness by double-checking if there's any user with this ID
    let unique = false;
    while (!unique) {
      const idStr = nextId.toString();
      const checkQ = query(collection(db, "users"), where("displayId", "==", idStr));
      const checkSnap = await getDocs(checkQ);
      if (checkSnap.empty) {
        unique = true;
      } else {
        nextId++;
      }
    }
    
    return nextId.toString();
  } catch (err) {
    console.error("Error generating displayId:", err);
    return Math.floor(10000 + Math.random() * 90000).toString(); // Fallback to random 5-digit string
  }
};`;

const newGetNextDisplayId = `const getNextDisplayId = async (): Promise<string> => {
  try {
    // We only query for the highest display ID by sorting
    const q = query(collection(db, "users"), orderBy("displayId", "desc"), limit(20));
    const querySnapshot = await getDocs(q);
    
    let maxId = 50499; // Starts at 50500 if no sequential IDs exist
    
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.displayId) {
        const idNum = parseInt(data.displayId, 10);
        // Only consider standard sequential IDs (between 50500 and 99999)
        if (!isNaN(idNum) && idNum >= 50500 && idNum < 100000) {
          if (idNum > maxId) {
            maxId = idNum;
          }
        }
      }
    });
    
    let nextId = maxId + 1;
    return nextId.toString();
  } catch (err) {
    console.error("Error generating displayId:", err);
    return Math.floor(100000 + Math.random() * 900000).toString(); // Fallback to random 6-digit string
  }
};`;

code = code.replace(oldGetNextDisplayId, newGetNextDisplayId);
fs.writeFileSync('src/App.tsx', code);
console.log("Patched getNextDisplayId!");
