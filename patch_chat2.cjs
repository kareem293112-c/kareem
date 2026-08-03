const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const target = `    console.log("[SYNC] Starting room messages listener for room:", activeRoom.id);
    const messagesRef = collection(db, "voice_rooms", activeRoom.id, "chat_messages");`;

const replacement = `    // Ensure local state is clean and fresh when re-entering a room
    setRoomMessages([
      { id: 'sys', sender: 'نظام المجلس', text: 'مرحباً بكم في صدى العرب! يرجى الالتزام بالاحترام المتبادل داخل مجالسنا الموقرة.', color: 'text-purple-400 font-bold', type: 'system' }
    ]);
    console.log("[SYNC] Starting room messages listener for room:", activeRoom.id);
    const messagesRef = collection(db, "voice_rooms", activeRoom.id, "chat_messages");`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Patched chat 2");
} else {
  console.log("Not found target 2");
}
