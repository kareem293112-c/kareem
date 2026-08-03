const fs = require('fs');
let content = fs.readFileSync('src/data/gifts.ts', 'utf8');
content = content.replace(
  "svgaUrl: 'https://gtkjonqlumuhsuykbxnw.supabase.co/storage/v1/object/public/images/posche.svga',",
  "svgaUrl: 'https://gtkjonqlumuhsuykbxnw.supabase.co/storage/v1/object/public/images/posche.svga',\n    imageUrl: 'https://img.icons8.com/color/96/000000/sports-car.png',"
);
fs.writeFileSync('src/data/gifts.ts', content);
