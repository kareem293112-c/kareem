import React, { useState, useEffect } from 'react';
import { ChevronRight, Calendar, Gift, Award, CheckCircle, Sparkles, Coins } from 'lucide-react';
import { AppUser } from '../../types';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface Props {
  onBack: () => void;
  currentUser: AppUser | null;
}

export default function DailyCheckInView({ onBack, currentUser }: Props) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const container = document.getElementById('smartphone-screen') || document.querySelector('.overflow-y-auto');
    if (container) {
      container.scrollTop = 0;
    }
  }, []);
  const [streak, setStreak] = useState<number>(0);
  const [hasCheckedInToday, setHasCheckedInToday] = useState<boolean>(false);
  const [showAnimation, setShowAnimation] = useState<boolean>(false);
  const [rewardAmount, setRewardAmount] = useState<number>(0);
  const [notification, setNotification] = useState<string | null>(null);

  // Rewards config for days 1 to 7
  const rewards = [
    { day: 1, coins: 15, label: 'أول الغيث' },
    { day: 2, coins: 25, label: 'مضاعف' },
    { day: 3, coins: 40, label: 'عطاء متزايد' },
    { day: 4, coins: 60, label: 'مكافأة مميزة' },
    { day: 5, coins: 85, label: 'تألق مستمر' },
    { day: 6, coins: 120, label: 'القمة تقترب' },
    { day: 7, coins: 250, label: 'الكنز الأكبر' },
  ];

  useEffect(() => {
    if (!currentUser) return;

    // We can fetch or cast local custom values on currentUser document
    const lastCheckIn = (currentUser as any).lastCheckInDate || ''; // format 'YYYY-MM-DD'
    const currentStreak = (currentUser as any).checkInStreak || 0;

    const todayStr = new Date().toISOString().split('T')[0];
    setHasCheckedInToday(lastCheckIn === todayStr);
    setStreak(currentStreak);
  }, [currentUser]);

  const handleCheckIn = async () => {
    if (!currentUser?.id || hasCheckedInToday) return;

    const todayStr = new Date().toISOString().split('T')[0];
    let newStreak = streak + 1;

    // Reset streak if we reached day 7, or if last check-in was more than 1 day ago
    const lastCheckIn = (currentUser as any).lastCheckInDate || '';
    if (lastCheckIn) {
      const lastDate = new Date(lastCheckIn);
      const todayDate = new Date(todayStr);
      const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 1) {
        newStreak = 1; // reset to day 1 if they missed a day
      }
    }

    if (newStreak > 7) {
      newStreak = 1; // loop back to day 1 after completing 7 days
    }

    const reward = rewards[newStreak - 1];
    setRewardAmount(reward.coins);

    try {
      // Update coins and check-in details in Firestore
      await updateDoc(doc(db, 'users', currentUser.id), {
        coins: (currentUser.coins || 0) + reward.coins,
        lastCheckInDate: todayStr,
        checkInStreak: newStreak
      });

      setStreak(newStreak);
      setHasCheckedInToday(true);
      setShowAnimation(true);
      setNotification(`🎉 تهانينا! لقد سجلت دخولك لليوم واستلمت مكافأة اليوم ${newStreak}: 🪙 ${reward.coins} كوينز!`);
      
      setTimeout(() => {
        setShowAnimation(false);
      }, 4000);
    } catch (err) {
      console.error('Error in daily check-in:', err);
      alert('حدث خطأ أثناء تسجيل الدخول اليومي، الرجاء المحاولة لاحقاً.');
    }
  };

  return (
    <div className="flex-grow flex flex-col bg-[#05030f] text-white min-h-full" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-l from-[#d91b5c] to-[#f39c12] pt-8 pb-5 px-4 shadow-md flex items-center justify-between">
        <h2 className="font-black text-base flex items-center gap-1.5 text-white">
          <Calendar className="w-5 h-5 text-yellow-300 animate-pulse" />
          الحضور اليومي والمكافآت
        </h2>
        <button onClick={onBack} className="p-1 hover:bg-white/10 rounded-full transition">
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Main Body */}
      <div className="p-4 space-y-5 max-w-md mx-auto w-full flex-grow overflow-y-auto pb-10">
        
        {/* Banner Card */}
        <div className="bg-gradient-to-br from-[#1b153b] via-[#0e0a24] to-[#14102e] border border-pink-500/10 rounded-3xl p-5 text-center relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/15 rounded-full blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-yellow-500/15 rounded-full blur-2xl"></div>

          {/* Icon Badge */}
          <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-yellow-300 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-[0_0_20px_rgba(245,158,11,0.3)] mb-4 animate-bounce">
            🪙
          </div>

          <h3 className="font-black text-lg text-white">سجل دخولك يومياً واربح ذهباً!</h3>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed font-semibold">
            التزامك بالحضور اليومي المتتالي يضاعف مكافآتك الكوينزية ويصل بك إلى الكنز الأكبر في اليوم السابع!
          </p>

          <div className="mt-4 inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-xs font-black text-amber-300">
            <span>🔥 سلسلة أيام الحضور الحالية:</span>
            <span className="font-mono text-sm text-white">{streak} / 7</span>
          </div>
        </div>

        {/* The 7 Days Grid */}
        <div className="space-y-3">
          <h4 className="text-xs font-black text-slate-400 mr-1 flex items-center gap-1">
            <Award className="w-4 h-4 text-pink-400" />
            جدول المكافآت الأسبوعية
          </h4>

          <div className="grid grid-cols-3 gap-2.5">
            {rewards.map((r) => {
              const isChecked = r.day <= streak;
              const isCurrent = r.day === streak + 1 && !hasCheckedInToday;
              const isNext = r.day > (hasCheckedInToday ? streak : streak + 1);

              return (
                <div 
                  key={r.day}
                  className={`rounded-2xl p-3 border text-center transition relative flex flex-col justify-between h-32 ${
                    isChecked 
                      ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                      : isCurrent
                      ? 'bg-gradient-to-b from-[#2a1b4d] to-[#191030] border-yellow-400 text-white scale-[1.02] shadow-[0_0_15px_rgba(253,224,71,0.15)]'
                      : 'bg-[#120f26] border-white/5 text-slate-400'
                  }`}
                >
                  <div className="text-[10px] font-black">اليوم {r.day}</div>
                  
                  {/* Reward Icon */}
                  <div className="my-2.5 flex items-center justify-center">
                    {isChecked ? (
                      <CheckCircle className="w-7 h-7 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]" />
                    ) : (
                      <div className="flex flex-col items-center">
                        <Coins className={`w-6 h-6 ${isCurrent ? 'text-yellow-400 animate-pulse' : 'text-slate-500'}`} />
                        <span className="text-[10px] font-black font-mono mt-1 text-amber-400/90">+{r.coins}</span>
                      </div>
                    )}
                  </div>

                  <div className="text-[9px] font-bold leading-tight line-clamp-1">{r.label}</div>

                  {isCurrent && (
                    <span className="absolute -top-1 -left-1 bg-yellow-400 text-slate-900 text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-md animate-pulse">جاهز</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Claim Reward Button */}
        <div className="pt-4">
          <button
            onClick={handleCheckIn}
            disabled={hasCheckedInToday}
            className={`w-full py-4 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 ${
              hasCheckedInToday
                ? 'bg-white/5 border border-white/10 text-slate-500'
                : 'bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 hover:opacity-95 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
            }`}
          >
            {hasCheckedInToday ? (
              <>
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span>لقد قمت بتسجيل الحضور لليوم ✓</span>
              </>
            ) : (
              <>
                <Gift className="w-5 h-5" />
                <span>تسجيل الحضور واستلام الذهب اليومي</span>
              </>
            )}
          </button>
        </div>

        {/* Beautiful Floating Rewards Notification */}
        {showAnimation && (
          <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4 animate-fade-in text-center">
            <div className="bg-[#120f26] border-2 border-yellow-400 rounded-3xl p-6 max-w-xs space-y-4 shadow-[0_0_30px_rgba(245,158,11,0.3)]">
              <div className="text-6xl animate-bounce">🪙🏆🎉</div>
              <h3 className="text-xl font-black text-yellow-400">مبارك مكافأتك اليومية!</h3>
              <p className="text-xs text-slate-200 leading-relaxed font-bold">
                تمت إضافة <span className="text-amber-300 font-extrabold font-mono">🪙 {rewardAmount}</span> كوينز بنجاح إلى رصيد محفظتك المعتمد في صدى العرب!
              </p>
              <div className="bg-white/5 border border-white/10 p-3 rounded-2xl">
                <span className="text-[10px] text-slate-400 block font-bold">رصيدك الجديد الحالي:</span>
                <span className="text-lg font-black font-mono text-amber-400">🪙 {(currentUser?.coins || 0) + rewardAmount}</span>
              </div>
              <button 
                onClick={() => setShowAnimation(false)}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs rounded-xl transition"
              >
                رائع، شكراً لك!
              </button>
            </div>
          </div>
        )}

        {/* Toast Toast */}
        {notification && (
          <div className="fixed bottom-6 left-4 right-4 bg-slate-900/95 text-white p-3.5 rounded-xl text-center text-xs font-black shadow-2xl border border-amber-500/30 flex items-center justify-between gap-2 z-40">
            <span className="flex-1 text-right">{notification}</span>
            <button onClick={() => setNotification(null)} className="p-1 hover:bg-white/10 rounded-full transition">✕</button>
          </div>
        )}

      </div>
    </div>
  );
}
