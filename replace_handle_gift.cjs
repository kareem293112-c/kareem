const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
const replacement = fs.readFileSync('replacement.txt', 'utf8');

// The original handleSendGift starts around 2850
const startTag = "// Sending virtual premium gifts\n  const handleSendGift = (gift: Gift, quantity: number = 1) => {";
// and ends around 3140 where we have
//   };
// 
//   const handleSendChatMessage = async () => {

const matchStr = "  const handleSendChatMessage = async () => {";
const startIndex = content.indexOf(startTag);
const endIndex = content.indexOf(matchStr);

if (startIndex !== -1 && endIndex !== -1) {
  const before = content.substring(0, startIndex);
  const after = content.substring(endIndex);
  fs.writeFileSync('src/App.tsx', before + replacement + "\n" + after);
  console.log("Replaced handleSendGift successfully!");
} else {
  console.log("Failed to find boundaries", startIndex, endIndex);
}
