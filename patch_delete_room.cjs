const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const deleteRoomCode = `
  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('هل أنت متأكد من حذف الغرفة؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    try {
      await deleteDoc(doc(db, "voice_rooms", roomId));
      if (activeRoom?.id === roomId) {
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
      }
    } catch (err) {
      console.error("Error deleting room", err);
      alert('حدث خطأ أثناء محاولة حذف الغرفة');
    }
  };
`;

if (!code.includes('handleDeleteRoom')) {
  code = code.replace("const handleCreateRoom = async", deleteRoomCode + "\n  const handleCreateRoom = async");
  fs.writeFileSync('src/App.tsx', code);
  console.log("Injected handleDeleteRoom");
}
