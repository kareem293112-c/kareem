import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface FlyingGiftItem {
  id: string;
  senderSeatIndex: number | null; // 1 to 10
  receiverSeatIndex: number | null; // 1 to 10
  imageUrl: string;
  giftId?: string;
}

interface Props {
  activeGifts: FlyingGiftItem[];
}

export default function FlyingGiftsOverlay({ activeGifts }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 360, height: 740 });

  useEffect(() => {
    const updateDimensions = () => {
      const el = document.getElementById('screen-room') || containerRef.current;
      if (el) {
        setDimensions({
          width: el.clientWidth || 360,
          height: el.clientHeight || 740,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    const observer = new ResizeObserver(updateDimensions);
    const target = document.getElementById('screen-room');
    if (target) observer.observe(target);

    return () => {
      window.removeEventListener('resize', updateDimensions);
      observer.disconnect();
    };
  }, []);

  const getCoordinates = (seatIndex: number | null, isSender: boolean) => {
    const screenEl = document.getElementById('screen-room');
    if (!screenEl) return getDefaultCoords(isSender);

    const screenRect = screenEl.getBoundingClientRect();
    const defaultCoords = getDefaultCoords(isSender);

    if (seatIndex !== null) {
      const seatEl = document.getElementById(`seat-cell-${seatIndex}`);
      if (seatEl) {
        const seatRect = seatEl.getBoundingClientRect();
        return {
          x: (seatRect.left + seatRect.width / 2) - screenRect.left,
          y: (seatRect.top + seatRect.height / 2) - screenRect.top,
        };
      }
    }

    return defaultCoords;
  };

  const getDefaultCoords = (isSender: boolean) => {
    const w = dimensions.width;
    const h = dimensions.height;
    if (isSender) {
      // Bottom Center (approx where user controls are)
      return { x: w / 2, y: h - 80 };
    } else {
      // Top Center (approx where host seat is)
      return { x: w / 2, y: 120 };
    }
  };

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-[60] overflow-hidden"
    >
      <AnimatePresence>
        {activeGifts.map((gift) => {
          const start = getCoordinates(gift.senderSeatIndex, true);
          const end = getCoordinates(gift.receiverSeatIndex, false);
          const center = { x: dimensions.width / 2, y: dimensions.height / 2 - 40 };
          const isNoRotate = gift.giftId === 'squirrel_gift' || gift.giftId === 'balloon_gift' || gift.giftId === 'kafu_gift' || gift.giftId === 'necklace_gift';
          const isLargeGift = gift.giftId === 'kafu_gift' || gift.giftId === 'necklace_gift';
          const maxScale = isLargeGift ? 5.0 : 2.5;

          return (
            <div key={gift.id} className="absolute inset-0 pointer-events-none">
              {/* Path/Trail glow effect */}
              <motion.div
                initial={{ 
                  x: start.x - 24, 
                  y: start.y - 24, 
                  scale: 0.1, 
                  opacity: 0,
                  rotate: 0 
                }}
                animate={{
                  x: [start.x - 24, center.x - 48, center.x - 48, end.x - 20, end.x - 20],
                  y: [start.y - 24, center.y - 48, center.y - 48, end.y - 20, end.y - 20],
                  scale: [0.1, maxScale, maxScale, 0.4, 0],
                  opacity: [0, 1, 1, 0.9, 0],
                  rotate: isNoRotate ? [0, 0, 0, 0, 0] : [0, 360, 360, 720, 720],
                }}
                transition={{
                  duration: 2.8,
                  ease: "easeInOut",
                  times: [0, 0.2, 0.7, 0.9, 1],
                }}
                className="absolute top-0 left-0 w-12 h-12 flex items-center justify-center pointer-events-none"
              >
                <img
                  src={gift.imageUrl}
                  alt="Magic Rose Gift"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              </motion.div>

              {/* Remove heart sparkle explosions, only the rose should appear */}
            </div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
