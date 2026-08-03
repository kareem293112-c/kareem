const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(
  "const [selectedRecipientSeatIndex, setSelectedRecipientSeatIndex] = useState<number | 'all'>('all');",
  "const [selectedRecipientSeatIndices, setSelectedRecipientSeatIndices] = useState<Array<number | 'all'>>(['all']);"
);
fs.writeFileSync('src/App.tsx', content);
