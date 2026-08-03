const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  "const [selectedRecipientSeatIndex, setSelectedRecipientSeatIndex] = useState<number | 'all'>('all');",
  "const [selectedRecipientSeatIndices, setSelectedRecipientSeatIndices] = useState<Array<number | 'all'>>(['all']);"
);

// Replace UI buttons in the recipient selection
content = content.replace(
  /onClick=\{\(\) => setSelectedRecipientSeatIndex\('all'\)\}/g,
  "onClick={() => setSelectedRecipientSeatIndices(['all'])}"
);

content = content.replace(
  /selectedRecipientSeatIndex === 'all'/g,
  "selectedRecipientSeatIndices.includes('all')"
);

content = content.replace(
  /onClick=\{\(\) => setSelectedRecipientSeatIndex\(oneBasedSeatIdx\)\}/g,
  "onClick={() => setSelectedRecipientSeatIndices(prev => { if (prev.includes('all')) return [oneBasedSeatIdx]; if (prev.includes(oneBasedSeatIdx)) { const next = prev.filter(i => i !== oneBasedSeatIdx); return next.length ? next : ['all']; } return [...prev, oneBasedSeatIdx]; })}"
);

content = content.replace(
  /const isSelected = selectedRecipientSeatIndex === oneBasedSeatIdx;/g,
  "const isSelected = selectedRecipientSeatIndices.includes(oneBasedSeatIdx);"
);

fs.writeFileSync('src/App.tsx', content);
