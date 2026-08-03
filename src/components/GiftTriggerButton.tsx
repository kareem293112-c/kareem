import React from 'react';

interface Props {
  onClick: () => void;
  imageUrl?: string;
}

export default function GiftTriggerButton({ onClick, imageUrl }: Props) {
  const finalImageUrl = imageUrl || "https://gtkjonqlumuhsuykbxnw.supabase.co/storage/v1/object/public/images/Modelo%20De%20Caja%20De%20Regalo%203d%20PNG%20,dibujos%20%20Caja%20De%20Regalo,%20Caja%20De%20Regalo%203d,%20Modelo%20De%20Caja%20De%20Regalo%20PNG%20Imagen%20para%20Descarga%20Gratuita%20_%20Pngtree.png";

  return (
    <button
      onClick={onClick}
      className="w-12 h-12 bg-transparent cursor-pointer hover:scale-110 active:scale-95 transition-all flex items-center justify-center shrink-0 animate-heartbeat relative overflow-visible border-none p-0 outline-none focus:outline-none"
      title="إرسال هدايا المجلس الفاخرة"
      id="native-gift-trigger"
    >
      <img
        src={finalImageUrl}
        alt="هدية"
        referrerPolicy="no-referrer"
        className="w-12 h-12 object-contain pointer-events-none select-none"
      />
    </button>
  );
}

