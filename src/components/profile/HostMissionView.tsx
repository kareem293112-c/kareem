import React, { useState } from 'react';
import { AppUser } from '../../types';
import { ChevronRight, Award, Clock, Calendar, CheckCircle2, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { doc, updateDoc, increment, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface Props {
  onBack: () => void;
  currentUser: AppUser | null;
  users: AppUser[];
}

export default function HostMissionView({ onBack, currentUser, users }: Props) {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const daysCompleted = currentUser?.hostMissionDaysCompleted || 0;
  const todayMinutes = currentUser?.todayMicMinutes || 0;
  const isClaimed = currentUser?.hostMissionClaimed || false;
  const totalRequiredDays = 15;
  const dailyTargetMinutes = 180; // 3 hours

  // Find agency owner
  const agencyId = currentUser?.agencyId;
  const agencyName = currentUser?.agencyName || 'غير مرتبط بوكالة';



  // Claim reward when 15 days completed
  const handleClaimReward = async () => {
    if (!currentUser?.id) return;
    if (daysCompleted < totalRequiredDays) {
      setErrorMsg('⚠️ عذراً، يجب إكمال 15 يوماً على الأقل (بمعدل 3 ساعات يومياً) لاستلام المكافأة.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }
    if (isClaimed) {
      setErrorMsg('⚠️ لقد قاستلمت هذه المكافأة مسبقاً!');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      // Host reward: $10 = 6,000 diamonds added to diamonds balance
      const hostDiamondsReward = 6000;
      
      await updateDoc(userRef, {
        diamonds: increment(hostDiamondsReward),
        hostMissionClaimed: true
      });

      setSuccessMsg('🏆 تهانينا! تم إرسال مكافأة 10$ ($6,000 ألماسة) إلى حسابك بنجاح!');
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err) {
      console.error("Error claiming reward:", err);
      setErrorMsg('❌ حدث خطأ أثناء صرف المكافأة. يجى المحاولة مرة أخرى.');
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setLoading(false);
    }
  };

  const progressPercent = Math.round((daysCompleted / totalRequiredDays) * 100);
  const todayPercent = Math.min(100, Math.round((todayMinutes / dailyTargetMinutes) * 100));

  return (
    <div className="flex flex-col h-full bg-[#080710] text-slate-100 overflow-y-auto" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0d0c10]/95 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition active:scale-95 text-slate-300"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-black text-amber-400 flex items-center gap-1.5">
              <span>🎯 مكافأة حضور المضيفين</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-semibold">3 ساعات يومياً لمدة 15 يوماً</p>
          </div>
        </div>
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <Award className="w-5 h-5" />
        </div>
      </div>

      <div className="p-4 space-y-4 pb-12">
        {/* Success / Error Banners */}
        {successMsg && (
          <div className="bg-emerald-500/20 border border-emerald-500/40 p-3 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="bg-rose-500/20 border border-rose-500/40 p-3 rounded-xl text-rose-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Rule Banner */}
        <div className="bg-gradient-to-br from-amber-500/15 via-purple-600/10 to-indigo-600/15 border border-amber-500/30 rounded-2xl p-4 space-y-3 relative overflow-hidden shadow-lg">
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex items-start gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-300 font-bold">
              💎
            </div>
            <div className="space-y-1 flex-grow">
              <h2 className="text-sm font-black text-amber-300 flex items-center gap-1.5">
                <span>تفاصيل مكافأة المضيفين والوكالة</span>
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              </h2>
              <p className="text-[11px] text-slate-300 leading-relaxed font-semibold">
                لكي تستحق المكافأة، يجب عليك التواجد على المايك لمدة <span className="text-amber-400 font-bold">3 ساعات يومياً</span> لمدة <span className="text-amber-400 font-bold">15 يوماً</span>.
                عند إتمام الشروط بنجاح:
              </p>
              <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside font-semibold pt-1">
                <li>يحصل المضيف على <span className="text-emerald-400 font-bold">10 دولار</span> (6,000 ألماسة 💎).</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Agency Status Card */}
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold">وكالتك الحالية</p>
              <p className="text-xs font-black text-white">{agencyName}</p>
            </div>
          </div>
          <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${agencyId ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
            {agencyId ? 'مسجل بوكالة' : 'غير مرتبط بوكالة'}
          </span>
        </div>

        {/* Progress Overview Card */}
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-black text-white">تقدم الأيام (إجمالي 15 يوماً)</span>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              {daysCompleted} / {totalRequiredDays} يوم
            </span>
          </div>

          {/* Days Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden p-0.5 border border-white/5">
              <div 
                className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
              <span>0 يوم</span>
              <span>التقدم الكلي: {progressPercent}%</span>
              <span>15 يوم</span>
            </div>
          </div>

          {/* Today's Mic Time Card */}
          <div className="bg-black/40 border border-white/5 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-slate-300">وقت المايك اليومي (3 ساعات مطلوب)</span>
              </div>
              <span className="text-xs font-mono font-bold text-purple-300">
                {Math.floor(todayMinutes / 60)} ساعة و {todayMinutes % 60} دقيقة
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5 border border-white/5">
              <div 
                className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${todayPercent}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>0 دقيقة</span>
              <span>متبقي: {Math.max(0, dailyTargetMinutes - todayMinutes)} دقيقة</span>
              <span>180 دقيقة</span>
            </div>
          </div>


        </div>

        {/* Claim Reward Button */}
        <div className="pt-2">
          <button
            onClick={handleClaimReward}
            disabled={daysCompleted < totalRequiredDays || isClaimed || loading}
            className={`w-full py-4 rounded-2xl font-black text-xs transition flex items-center justify-center gap-2 shadow-xl cursor-pointer ${
              daysCompleted >= totalRequiredDays && !isClaimed
                ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-600/30 active:scale-95 animate-pulse'
                : isClaimed
                ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30 cursor-not-allowed'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
            }`}
          >
            <Award className="w-5 h-5" />
            <span>
              {isClaimed 
                ? '✨ تم استلام المكافأة بنجاح' 
                : daysCompleted >= totalRequiredDays 
                ? 'استلام المكافأة ($10 لي) 🏆' 
                : `أكمل الأيام المتبقية (${totalRequiredDays - daysCompleted} أيام) لاستلام المكافأة`}
            </span>
          </button>
          <p className="text-[10px] text-slate-400 text-center mt-2">
            ملاحظة: يتم التحقق من الساعات تلقائياً وإضافتها لرصيد محفظتك فوراً.
          </p>

        </div>
      </div>
    </div>
  );
}
