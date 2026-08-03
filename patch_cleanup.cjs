const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const target = `    }, (error) => {
      console.error("Error syncing room messages:", error);
    });

    return () => unsubscribe();`;

const replacement = `    }, (error) => {
      console.error("Error syncing room messages:", error);
    });

    return () => {
      unsubscribe();
      // Instantly purge local state on unmount / exit to prevent memory leaks and ensure fresh screen on rejoin
      setRoomMessages([
        { id: 'sys', sender: 'نظام المجلس', text: 'مرحباً بكم في صدى العرب! يرجى الالتزام بالاحترام المتبادل داخل مجالسنا الموقرة.', color: 'text-purple-400 font-bold', type: 'system' }
      ]);
    };`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Patched cleanup");
} else {
  console.log("Not found target cleanup");
}
