import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { getLevelProgress } from '../../lib/levelMath';

export default function LevelView({ onBack, currentUser, initialTab = 'wealth' }: any) {
  const [activeTab, setActiveTab] = useState(initialTab); // wealth, popular

  const xp = activeTab === 'wealth' ? (currentUser?.senderXp || 0) : (currentUser?.charmXp || 0);
  
  const {
    currentLvl,
    nextLvl,
    minXpForNext,
    progressPercentage,
    remainingXp
  } = getLevelProgress(xp);

  const bgGradient = activeTab === 'wealth' ? 'from-green-500 to-emerald-600' : 'from-pink-500 to-purple-600';
  
  const levelText = activeTab === 'wealth' ? 'الثروة' : 'الشعبية';

  const privileges = [
    { name: 'رمز المستوى', icon: '🌙', lvl: 1, bg: 'bg-orange-100', text: 'text-orange-500' },
    { name: 'العرض على القمة', icon: '⬆️', lvl: 1, bg: 'bg-orange-100', text: 'text-orange-500' },
    { name: 'استرجاع الرسالة', icon: '↩️', lvl: 10, bg: 'bg-orange-100', text: 'text-orange-500' },
    { name: 'تنبيه الدخول', icon: '🔔', lvl: 20, bg: 'bg-orange-100', text: 'text-orange-500' },
    { name: 'إطار فاخر', icon: '🖼️', lvl: 30, bg: 'bg-orange-100', text: 'text-orange-500' },
    { name: 'الحد الأقصى للمتابعة', icon: '👥', lvl: 40, bg: 'bg-orange-100', text: 'text-orange-500' },
    { name: 'هدايا مميزة', icon: '🎁', lvl: 50, bg: 'bg-orange-100', text: 'text-orange-500' },
    { name: 'موجة الميكروفون', icon: '🎙️', lvl: 60, bg: 'bg-orange-100', text: 'text-orange-500' },
    { name: 'متابعة بصمت', icon: '🤫', lvl: 65, bg: 'bg-orange-100', text: 'text-orange-500' },
    { name: 'ترقية البث', icon: '🚀', lvl: 70, bg: 'bg-orange-100', text: 'text-orange-500' },
    { name: 'الأولوية في البلاغات', icon: '⚠️', lvl: 80, bg: 'bg-orange-100', text: 'text-orange-500' },
    { name: 'خدمة العملاء', icon: '🎧', lvl: 85, bg: 'bg-orange-100', text: 'text-orange-500' },
  ];

  return (
    <div className="flex-grow flex flex-col bg-slate-50 overflow-y-auto" dir="rtl">
      {/* Dynamic Header */}
      <div className={`bg-gradient-to-b ${bgGradient} pt-4 pb-20 relative transition-colors duration-500`}>
        <div className="flex items-center justify-between px-4 text-white relative z-10 mb-6">
          <div className="w-6"></div> {/* Spacer */}
          <div className="flex gap-8 font-black text-sm">
             <button 
               onClick={() => setActiveTab('wealth')} 
               className={`cursor-pointer pb-1 transition-all ${activeTab === 'wealth' ? 'border-b-2 border-white font-black scale-105' : 'opacity-70 hover:opacity-100'}`}
             >
               الثروة
             </button>
             <button 
               onClick={() => setActiveTab('popular')} 
               className={`cursor-pointer pb-1 transition-all ${activeTab === 'popular' ? 'border-b-2 border-white font-black scale-105' : 'opacity-70 hover:opacity-100'}`}
             >
               الشعبية
             </button>
          </div>
          <button onClick={onBack} className="p-1 hover:bg-white/10 rounded-full transition">
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Main Card */}
      <div className="px-4 -mt-16 relative z-20">
         <div className="bg-white rounded-2xl p-6 pt-12 shadow-md relative text-center">
            {/* Floating Avatar */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2">
               <img src={currentUser?.avatar || "https://api.dicebear.com/7.x/adventurer/svg"} className="w-20 h-20 rounded-full border-4 border-white shadow-sm object-cover" />
            </div>

            <h3 className="font-bold text-lg text-slate-800">{currentUser?.name}</h3>
            
            <div className="flex justify-center mt-2 mb-6">
               <div className={`px-4 py-1.5 rounded-full flex items-center gap-2 text-white font-bold ${activeTab === 'wealth' ? 'bg-green-500' : 'bg-pink-500'}`}>
                  <span>{levelText}</span>
                  <span>{currentLvl}</span>
               </div>
            </div>

            {/* Big Level Display */}
            <div className="text-4xl font-black text-slate-800 mb-6">
              LV.{currentLvl}
            </div>

            {/* Progress Bar */}
            <div className="flex justify-between text-xs font-bold text-slate-400 mb-2" dir="ltr">
               <span className="text-slate-800">LV.{currentLvl}</span>
               <span>LV.{nextLvl}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
               <div className={`h-full ${activeTab === 'wealth' ? 'bg-green-500' : 'bg-pink-500'}`} style={{ width: `${progressPercentage}%` }}></div>
            </div>
            <p className="text-[11px] text-slate-600 font-bold">
              نقاط الخبرة الحالية: <span className="font-mono text-amber-600">{xp}</span> / <span className="font-mono text-slate-400">{minXpForNext}</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1">تحتاج إلى <span className="font-mono text-amber-500 font-bold">{remainingXp}</span> نقطة خبرة إضافية للترقية للمستوى القادم</p>
         </div>
      </div>

      {/* Privileges Banner (if wealth) */}
      {activeTab === 'wealth' && (
        <div className="px-4 mt-4">
          <h4 className="font-bold text-sm text-slate-800 mb-2">امتيازات خاصة</h4>
          <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-green-500 rounded-2xl p-4 text-white text-center shadow-sm">
             <div className="flex justify-between items-center overflow-x-auto gap-2 pb-2 scrollbar-hide">
                {[30, 50, 70, 90, 110, 130, 150, 170, 190].map(lvl => (
                  <div key={lvl} className="flex flex-col items-center flex-shrink-0">
                    <div className="w-10 h-10 rounded-full border-2 border-white/30 flex items-center justify-center text-lg bg-white/10">🖼️</div>
                    <span className="text-[9px] mt-1 font-bold">Lv.{lvl}</span>
                  </div>
                ))}
             </div>
             <p className="text-xs font-bold mt-2">فتح إطار فاخر عند المستوى 30</p>
          </div>
        </div>
      )}

      {/* Privileges Grid */}
      <div className="px-4 mt-6 pb-6">
         <h4 className="font-bold text-sm text-slate-800 mb-4">جميع الامتيازات</h4>
         <div className="grid grid-cols-4 gap-3">
            {privileges.map((priv, idx) => (
               <div key={idx} className="flex flex-col items-center text-center">
                  <div className={`w-12 h-12 rounded-2xl ${priv.bg} flex items-center justify-center text-2xl mb-1.5 ${currentLvl >= priv.lvl ? '' : 'opacity-40 grayscale'}`}>
                    {priv.icon}
                  </div>
                  <span className={`text-[9px] font-bold ${currentLvl >= priv.lvl ? 'text-slate-700' : 'text-slate-400'}`}>{priv.name}</span>
                  <span className="text-[8px] text-slate-300 font-mono mt-0.5">LV.{priv.lvl}</span>
               </div>
            ))}
         </div>
      </div>
    </div>
  );
}
