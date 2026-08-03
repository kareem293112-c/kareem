const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  "onClick={() => setIsGiftDrawerOpen(true)}",
  "onClick={() => { setSelectedRecipientSeatIndices([1]); setIsGiftDrawerOpen(true); }}"
);

content = content.replace(
  "setSelectedRecipientSeatIndex(seatIdx !== -1 && seatIdx !== undefined ? seatIdx + 1 : -1);",
  "setSelectedRecipientSeatIndices(seatIdx !== -1 && seatIdx !== undefined ? [seatIdx + 1] : [1]);"
);

content = content.replace(
  "setSelectedRecipientSeatIndex(selectedSeatUser.seatIndex + 1);",
  "setSelectedRecipientSeatIndices([selectedSeatUser.seatIndex + 1]);"
);

fs.writeFileSync('src/App.tsx', content);
console.log("Patched gift selection.");
