import React, { useState } from 'react';
import { ChevronRight, ShieldAlert, Sparkles } from 'lucide-react';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface Props {
  onBack: () => void;
  currentUser: any;
}

interface AccessoryItem {
  id: string;
  name: string;
  type: string;
  icon: string;
  description: string;
}

export default function AccessoriesView({ onBack, currentUser }: Props) {
  const [activeTab, setActiveTab] = useState('frames');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const tabs = [
    { id: 'frames', label: 'إطارات' },
    { id: 'entry', label: 'مؤثرات الدخول' },
    { id: 'bubbles', label: 'فقاعات الدردشة' },
    { id: 'medals', label: 'الميداليات' },
  ];

  // All store/purchasable accessory items definitions to display inside owned list
  const allAccessories: AccessoryItem[] = [
    {
      id: 'frame_gold_crown',
      name: 'إطار تاج الملوك الذهبي 👑',
      type: 'frames',
      icon: '👑',
      description: 'إطار ملكي ذهبي يحيط بحسابك بهيبة ملكية باهرة.'
    },
    {
      id: 'frame_purple_neon',
      name: 'إطار شعلة النيون الأرجوانية 🔥',
      type: 'frames',
      icon: '🔥',
      description: 'إطار نيون متحرك يضفي حيوية وطاقة غامضة لملفك الشخصي.'
    },
    {
      id: 'frame_angel_wings',
      name: 'إطار أجنحة الملاك الساطع 👼',
      type: 'frames',
      icon: '👼',
      description: 'أجنحة ملاك بيضاء ناصعة تحف صورتك الشخصية بجمال لافت.'
    },
    {
      id: 'entry_sports_car',
      name: 'مؤثر دخول السيارة الرياضية الخارقة 🏎️',
      type: 'entry',
      icon: '🏎️',
      description: 'أبهر الجميع بصوت محرك سيارة رياضية خارقة وتأثير دخول مهيب للغرف.'
    },
    {
      id: 'entry_magic_portal',
      name: 'مؤثر دخول بوابة السحر والأبعاد 🌌',
      type: 'entry',
      icon: '🌌',
      description: 'بوابة نجمية تفتح لترحب بك عند دخولك للمجالس الصوتية.'
    },
    {
      id: 'bubble_pink_heart',
      name: 'فقاعة دردشة القلوب اللطيفة 💖',
      type: 'bubbles',
      icon: '💖',
      description: 'فقاعة دردشة وردية دافئة ومزينة بقلوب ناعمة لرسائل الغرفة.'
    },
    {
      id: 'bubble_royal_dark',
      name: 'فقاعة الدردشة الملكية الداكنة 🔮',
      type: 'bubbles',
      icon: '🔮',
      description: 'فقاعة كلاسيكية بخلفية بنفسجية مذهبة لتجعل نصوصك تلمع.'
    },
    {
      id: 'medal_loyal_supporter',
      name: 'ميدالية الداعم الوفي والنبيل 🛡️',
      type: 'medals',
      icon: '🛡️',
      description: 'ميدالية شرفية تظهر بشكل دائم في واجهة ملفك الشخصي كداعم معتمد.'
    },
    {
      id: 'medal_party_king',
      name: 'ميدالية ملك الحفلات والسهر 🎉',
      type: 'medals',
      icon: '🎉',
      description: 'وسام التميز والتألق في التفاعل وحضور مجالس صدى العرب اليومية.'
    }
  ];

  // Get user's owned accessories list
  const ownedIds = currentUser?.ownedAccessories || [];
  
  // Filter allAccessories down to only ones the user actually owns, and then filter by the current active tab
  const ownedAccessoriesInTab = allAccessories.filter(
    acc => ownedIds.includes(acc.id) && acc.type === activeTab
  );

  // Checks if item is currently equipped
  const isEquipped = (id: string, type: string) => {
    if (type === 'frames') return currentUser?.activeFrame === id;
    if (type === 'entry') return currentUser?.activeEntry === id;
    if (type === 'bubbles') return currentUser?.activeBubble === id;
    if (type === 'medals') return currentUser?.activeMedal === id;
    return false;
  };

  const handleToggleEquip = async (item: AccessoryItem) => {
    if (!currentUser?.id) return;

    const equipped = isEquipped(item.id, item.type);
    let updateField = '';
    
    if (item.type === 'frames') updateField = 'activeFrame';
    else if (item.type === 'entry') updateField = 'activeEntry';
    else if (item.type === 'bubbles') updateField = 'activeBubble';
    else if (item.type === 'medals') updateField = 'activeMedal';

    if (!updateField) return;

    try {
      const updates: any = {};
      // Toggle: if already equipped, set to null (unequip). Otherwise, equip this item.
      updates[updateField] = equipped ? null : item.id;

      await updateDoc(doc(db, 'users', currentUser.id), updates);

      setToastMessage(equipped ? `تم إلغاء ارتداء الملحق بنجاح` : `تم ارتداء ${item.name} بنجاح!`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Error toggling accessory equip:', err);
      setToastMessage('حدث خطأ أثناء تعديل حالة الملحق.');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  return (
    <div className="flex-grow flex flex-col bg-slate-50 min-h-full" dir="rtl">
      {/* Header Area with Dark/Green Background */}
      <div className="bg-[#0f1f1d] pb-8 relative shadow-md">
        <div className="p-4 flex items-center justify-between text-white relative z-10 pt-8">
          <h2 className="font-black text-base flex items-center gap-1.5">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            خزانة ملحقاتي الفاخرة
          </h2>
          <button onClick={onBack} className="p-1 hover:bg-white/10 rounded-full transition">
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Avatar Display */}
        <div className="flex justify-center mt-4 relative z-10">
           <div className="w-24 h-24 rounded-full border-2 border-yellow-400/40 p-1 relative bg-slate-900/60">
              <img 
                src={currentUser?.avatar || "https://api.dicebear.com/7.x/adventurer/svg"} 
                className="w-full h-full rounded-full object-cover" 
                alt="Avatar"
              />
              {/* If user has an active frame equipped, we can display a glowing indicator */}
              {currentUser?.activeFrame && (
                <div className="absolute -inset-1.5 border-2 border-yellow-400 rounded-full animate-pulse pointer-events-none"></div>
              )}
           </div>
        </div>
        
        {/* Background rings */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
          <div className="w-48 h-48 rounded-full border border-white/5 absolute"></div>
          <div className="w-72 h-72 rounded-full border border-white/5 absolute"></div>
          <div className="w-96 h-96 rounded-full border border-white/5 absolute"></div>
        </div>
      </div>

      <div className="flex-grow flex flex-col bg-slate-50 rounded-t-3xl -mt-6 relative z-20 pt-6 max-w-md mx-auto w-full">
         
         {/* Tabs */}
         <div className="flex flex-wrap justify-center gap-2 px-4 mb-6">
            {tabs.map(tab => (
               <button 
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id)}
                 className={`px-4 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer border ${
                   activeTab === tab.id 
                     ? 'bg-emerald-50 border-emerald-200 text-emerald-600 relative shadow-sm' 
                     : 'bg-white text-slate-500 hover:bg-slate-100 border-slate-100'
                 }`}
               >
                 {tab.label}
                 {activeTab === tab.id && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-white"></span>}
               </button>
            ))}
         </div>

         {/* Owned Items List */}
         <div className="flex-grow px-4 pb-16 space-y-3">
           {ownedAccessoriesInTab.map((item) => {
             const equipped = isEquipped(item.id, item.type);
             return (
               <div 
                 key={item.id} 
                 className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs"
               >
                 <div className="flex items-center gap-3">
                   <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-2xl shadow-inner">
                     {item.icon}
                   </div>
                   <div className="space-y-0.5 text-right">
                     <h4 className="text-xs font-black text-slate-800">{item.name}</h4>
                     <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">{item.description}</p>
                   </div>
                 </div>

                 <button
                   onClick={() => handleToggleEquip(item)}
                   className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                     equipped 
                       ? 'bg-rose-50 border border-rose-100 text-rose-500 hover:bg-rose-100' 
                       : 'bg-emerald-50 border border-emerald-100 text-emerald-600 hover:bg-emerald-100'
                   }`}
                 >
                   {equipped ? 'إلغاء الارتداء' : 'ارتداء الملحق'}
                 </button>
               </div>
             );
           })}

           {ownedAccessoriesInTab.length === 0 && (
             <div className="flex-grow flex flex-col items-center justify-center text-center py-12 opacity-80">
                <div className="text-5xl mb-3">🗝️</div>
                <p className="text-xs font-black text-slate-400">لا تملك أي ملحقات من هذا النوع بعد</p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] leading-relaxed">بإمكانك التوجه للمتجر لشراء إطارات ومؤثرات حصرية رائعة جداً!</p>
             </div>
           )}
         </div>

         {/* Toast Toast */}
         {toastMessage && (
           <div className="fixed bottom-12 left-4 right-4 bg-slate-900/95 text-white p-3.5 rounded-xl text-center text-xs font-black shadow-2xl border border-emerald-500/30 flex items-center justify-center z-50">
             <span>{toastMessage}</span>
           </div>
         )}
      </div>
    </div>
  );
}
