import React, { useState, useEffect } from 'react';
import { ChevronRight, Sparkles, Coins, ShoppingBag, CheckCircle2, ShieldAlert } from 'lucide-react';
import { AppUser } from '../../types';
import { db } from '../../lib/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

interface StoreItem {
  id: string;
  name: string;
  type: 'frames' | 'entry' | 'bubbles' | 'medals';
  price: number;
  icon: string;
  description: string;
}

interface Props {
  onBack: () => void;
  currentUser: AppUser | null;
}

export default function StoreView({ onBack, currentUser }: Props) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const container = document.getElementById('smartphone-screen') || document.querySelector('.overflow-y-auto');
    if (container) {
      container.scrollTop = 0;
    }
  }, []);
  const [activeTab, setActiveTab] = useState<'frames' | 'entry' | 'bubbles' | 'medals'>('frames');
  const [purchaseSuccessItem, setPurchaseSuccessItem] = useState<StoreItem | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Store Items List
  const storeItems: StoreItem[] = [
    {
      id: 'frame_gold_crown',
      name: 'إطار تاج الملوك الذهبي 👑',
      type: 'frames',
      price: 350,
      icon: '👑',
      description: 'إطار ملكي ذهبي يحيط بحسابك بهيبة ملكية باهرة.'
    },
    {
      id: 'frame_purple_neon',
      name: 'إطار شعلة النيون الأرجوانية 🔥',
      type: 'frames',
      price: 250,
      icon: '🔥',
      description: 'إطار نيون متحرك يضفي حيوية وطاقة غامضة لملفك الشخصي.'
    },
    {
      id: 'frame_angel_wings',
      name: 'إطار أجنحة الملاك الساطع 👼',
      type: 'frames',
      price: 450,
      icon: '👼',
      description: 'أجنحة ملاك بيضاء ناصعة تحف صورتك الشخصية بجمال لافت.'
    },
    {
      id: 'entry_sports_car',
      name: 'مؤثر دخول السيارة الرياضية الخارقة 🏎️',
      type: 'entry',
      price: 1500,
      icon: '🏎️',
      description: 'أبهر الجميع بصوت محرك سيارة رياضية خارقة وتأثير دخول مهيب للغرف.'
    },
    {
      id: 'entry_magic_portal',
      name: 'مؤثر دخول بوابة السحر والأبعاد 🌌',
      type: 'entry',
      price: 1200,
      icon: '🌌',
      description: 'بوابة نجمية تفتح لترحب بك عند دخولك للمجالس الصوتية.'
    },
    {
      id: 'bubble_pink_heart',
      name: 'فقاعة دردشة القلوب اللطيفة 💖',
      type: 'bubbles',
      price: 150,
      icon: '💖',
      description: 'فقاعة دردشة وردية دافئة ومزينة بقلوب ناعمة لرسائل الغرفة.'
    },
    {
      id: 'bubble_royal_dark',
      name: 'فقاعة الدردشة الملكية الداكنة 🔮',
      type: 'bubbles',
      price: 200,
      icon: '🔮',
      description: 'فقاعة كلاسيكية بخلفية بنفسجية مذهبة لتجعل نصوصك تلمع.'
    },
    {
      id: 'medal_loyal_supporter',
      name: 'ميدالية الداعم الوفي والنبيل 🛡️',
      type: 'medals',
      price: 800,
      icon: '🛡️',
      description: 'ميدالية شرفية تظهر بشكل دائم في واجهة ملفك الشخصي كداعم معتمد.'
    },
    {
      id: 'medal_party_king',
      name: 'ميدالية ملك الحفلات والسهر 🎉',
      type: 'medals',
      price: 600,
      icon: '🎉',
      description: 'وسام التميز والتألق في التفاعل وحضور مجالس صدى العرب اليومية.'
    }
  ];

  const currentTabItems = storeItems.filter(item => item.type === activeTab);

  // Check if item is already owned
  const isItemOwned = (itemId: string) => {
    const owned = (currentUser as any)?.ownedAccessories || [];
    return owned.includes(itemId);
  };

  const handleBuyItem = async (item: StoreItem) => {
    if (!currentUser?.id) return;
    
    if (isItemOwned(item.id)) {
      setErrorText('أنت تملك هذا الملحق بالفعل في خزينتك!');
      setTimeout(() => setErrorText(null), 4000);
      return;
    }

    const userCoins = currentUser.coins || 0;
    if (userCoins < item.price) {
      setErrorText(`عذراً، رصيدك غير كافٍ. تحتاج إلى 🪙 ${item.price - userCoins} كوينز إضافية لشراء هذا العنصر.`);
      setTimeout(() => setErrorText(null), 5000);
      return;
    }

    try {
      // Deduct coins and add to ownedAccessories list
      await updateDoc(doc(db, 'users', currentUser.id), {
        coins: userCoins - item.price,
        ownedAccessories: arrayUnion(item.id)
      });

      setPurchaseSuccessItem(item);
    } catch (err) {
      console.error('Error purchasing item from store:', err);
      setErrorText('حدث خطأ أثناء إتمام عملية الشراء، يرجى المحاولة لاحقاً.');
    }
  };

  return (
    <div className="flex-grow flex flex-col bg-[#080710] text-white min-h-full" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-l from-indigo-900 via-purple-900 to-[#d91b5c] pt-8 pb-5 px-4 shadow-md flex items-center justify-between">
        <h2 className="font-black text-base flex items-center gap-1.5 text-white">
          <ShoppingBag className="w-5 h-5 text-pink-400" />
          متجر صدى العرب الفاخر
        </h2>
        <button onClick={onBack} className="p-1 hover:bg-white/10 rounded-full transition">
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Rصيد الكوينز الحلي */}
      <div className="bg-slate-900/60 border-b border-white/5 py-3 px-4 flex justify-between items-center text-xs">
        <span className="font-bold text-slate-300">رصيدك الحالي المعتمد:</span>
        <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full text-amber-400 font-extrabold font-mono">
          <span>🪙</span>
          <span>{currentUser?.coins || 0}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex justify-around items-center border-b border-white/5 bg-[#100d1e] py-1.5">
        {[
          { id: 'frames', label: 'إطارات 🖼️' },
          { id: 'entry', label: 'مؤثرات دخول 🏎️' },
          { id: 'bubbles', label: 'فقاعات 💬' },
          { id: 'medals', label: 'ميداليات 🏅' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`text-xs font-black py-2 px-3.5 rounded-full transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-pink-600 to-indigo-600 text-white shadow-md shadow-pink-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Grid */}
      <div className="p-4 space-y-4 max-w-md mx-auto w-full flex-grow overflow-y-auto pb-10">
        
        {/* Error Notification */}
        {errorText && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl p-3.5 flex items-start gap-2.5 animate-pulse text-right">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-xs font-bold leading-relaxed">{errorText}</div>
          </div>
        )}

        {/* Store Items Grid */}
        <div className="grid grid-cols-2 gap-3">
          {currentTabItems.map((item) => {
            const owned = isItemOwned(item.id);
            return (
              <div 
                key={item.id} 
                className="bg-gradient-to-b from-[#141224] to-[#0c0a17] border border-white/5 hover:border-white/10 rounded-2xl p-3 text-center relative flex flex-col justify-between h-56 transition-all"
              >
                {/* Big Icon */}
                <div>
                  <div className="w-14 h-14 bg-gradient-to-tr from-indigo-950 via-[#181533] to-purple-950 rounded-2xl flex items-center justify-center text-3xl mx-auto border border-indigo-500/10 shadow-inner mb-3">
                    {item.icon}
                  </div>
                  <h3 className="text-xs font-black text-slate-100 line-clamp-1">{item.name}</h3>
                  <p className="text-[9px] text-slate-400 font-medium leading-relaxed mt-1 line-clamp-2">{item.description}</p>
                </div>

                {/* Price and Action */}
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-center gap-1 font-mono text-xs font-extrabold text-amber-400">
                    <span>🪙</span>
                    <span>{item.price}</span>
                  </div>

                  {owned ? (
                    <div className="w-full py-1.5 rounded-xl bg-slate-800 text-slate-400 text-[9px] font-black flex items-center justify-center gap-1 select-none">
                      <span>ممتلك ✓</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleBuyItem(item)}
                      className="w-full py-2 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white text-[10px] font-black rounded-xl transition shadow-md active:scale-95 cursor-pointer"
                    >
                      شراء العنصر
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Success Purchase Modal */}
        {purchaseSuccessItem && (
          <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4 animate-fade-in text-center">
            <div className="bg-[#120f26] border-2 border-pink-500 rounded-3xl p-6 max-w-xs space-y-4 shadow-[0_0_30px_rgba(236,72,153,0.3)]">
              <div className="text-6xl animate-bounce">🎁🎉🛍️</div>
              <h3 className="text-xl font-black text-pink-400">تهانينا! شراء ناجح</h3>
              <p className="text-xs text-slate-200 leading-relaxed font-bold">
                لقد قمت بشراء <span className="text-yellow-300 font-extrabold">{purchaseSuccessItem.name}</span> بنجاح مذهل!
              </p>
              <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                تم خصم <span className="font-mono text-amber-400 font-extrabold">{purchaseSuccessItem.price} كوينز</span> من رصيدك. بإمكانك ارتداؤها في أي وقت من قسم "ملحقاتي".
              </p>
              <button 
                onClick={() => setPurchaseSuccessItem(null)}
                className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-indigo-500 text-white font-black text-xs rounded-xl transition"
              >
                رائع! حسناً
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
