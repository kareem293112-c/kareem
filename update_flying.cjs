const fs = require('fs');
let content = fs.readFileSync('src/components/FlyingGiftsOverlay.tsx', 'utf8');

content = content.replace(
  "imageUrl: string;",
  "imageUrl: string;\n  giftId?: string;"
);

const originalAnimate = `                animate={{
                  x: [start.x - 24, center.x - 48, end.x - 20],
                  y: [start.y - 24, center.y - 48, end.y - 20],
                  scale: [0.1, 2.5, 0.4],
                  opacity: [0, 1, 1, 0.9, 0],
                  rotate: [0, 360, 720],
                }}`;

const newAnimate = `                animate={
                  (gift.giftId === 'squirrel_gift' || gift.giftId === 'balloon_gift') 
                  ? {
                      x: [start.x - 24, center.x - 48, end.x - 20],
                      y: [start.y - 24, center.y - 48, end.y - 20],
                      scale: [0.1, 2.5, 0.4],
                      opacity: [0, 1, 1, 0.9, 0],
                      rotate: 0,
                    }
                  : {
                      x: [start.x - 24, center.x - 48, end.x - 20],
                      y: [start.y - 24, center.y - 48, end.y - 20],
                      scale: [0.1, 2.5, 0.4],
                      opacity: [0, 1, 1, 0.9, 0],
                      rotate: [0, 360, 720],
                    }
                }`;

content = content.replace(originalAnimate, newAnimate);
fs.writeFileSync('src/components/FlyingGiftsOverlay.tsx', content);
