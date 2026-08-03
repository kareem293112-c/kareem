const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `    let targets = selectedRecipientSeatIndices.includes('all') ? ['all'] : [...selectedRecipientSeatIndices];
    
    if (targets.length === 0) {
      const occupiedSeats = activeRoom.seats.map((s, idx) => s.userId ? idx + 1 : null).filter(val => val !== null);
      if (occupiedSeats.length > 0) {
        const randomSeat = occupiedSeats[Math.floor(Math.random() * occupiedSeats.length)];
        targets = [randomSeat];
        setCustomNotice({ title: 'هدية عشوائية 🎲', message: 'تم إرسال الهدية لشخص عشوائي!' });
      } else {
        targets = ['all'];
      }
    }`;

const replacementStr = `    let targets = selectedRecipientSeatIndices.includes('all') ? ['all'] : [...selectedRecipientSeatIndices];
    
    if (targets.length === 0) {
      alert('الرجاء تحديد شخص لإرسال الهدية إليه.');
      return;
    }`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync('src/App.tsx', content);
    console.log("Patched successfully.");
} else {
    console.log("Target string not found.");
}
