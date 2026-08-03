const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Fix TS error 1: setScreenHistory
const handleDeleteRoomTarget = `      if (activeRoom?.id === roomId) {
        setScreenHistory(prev => {
          if (prev.length > 0) {
            const nextScreen = prev[prev.length - 1];
            setCurrentScreen(nextScreen);
            return prev.slice(0, -1);
          }
          setCurrentScreen('explore');
          return [];
        });
        setActiveRoom(null);
      }`;
const handleDeleteRoomReplacement = `      if (activeRoom?.id === roomId) {
        setCurrentScreen('explore');
        setActiveRoom(null);
      }`;
code = code.replace(handleDeleteRoomTarget, handleDeleteRoomReplacement);

// Fix TS error 2: onSnapshot
const onSnapshotTarget = `    const unsubscribe = onSnapshot(q, (snapshot) => {
      // If we are getting the snapshot, we only append new messages to the existing state`;
const onSnapshotReplacement = `    const unsubscribe = onSnapshot(q, {
      next: (snapshot) => {
        // If we are getting the snapshot, we only append new messages to the existing state`;
code = code.replace(onSnapshotTarget, onSnapshotReplacement);

const onSnapshotTarget2 = `      // We don't need to map over all docs anymore since we manage state incrementally
    }, (error) => {
      console.error("Error syncing room messages:", error);
    });`;
const onSnapshotReplacement2 = `      // We don't need to map over all docs anymore since we manage state incrementally
      },
      error: (error) => {
        console.error("Error syncing room messages:", error);
      }
    });`;
code = code.replace(onSnapshotTarget2, onSnapshotReplacement2);

fs.writeFileSync('src/App.tsx', code);
console.log("Patched TS errors");
