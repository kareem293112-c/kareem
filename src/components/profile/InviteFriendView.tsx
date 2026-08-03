import React, { useState, useEffect } from 'react';
import { ChevronRight, Copy, Check, Gift, Sparkles, Wallet, Users, ArrowUpRight, Award } from 'lucide-react';
import { AppUser } from '../../types';
import { db } from '../../lib/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';

interface Props {
  onBack: () => void;
  currentUser: AppUser | null;
}

export default function InviteFriendView({ onBack, currentUser }: Props) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const container = document.getElementById('smartphone-screen') || document.querySelector('.overflow-y-auto');
    if (container) {
      container.scrollTop = 0;
    }
  }, []);

  const [copiedCode, setCopiedCode] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const invitedCount = currentUser?.invitedCount || 0;
  const referrals = currentUser?.referrals || [];
  
  // Rule: Friend must stay 7 days and withdraw salary.
  // This is a simplified check for now, status is updated by UI when checking.
  
  const completedReferrals = referrals.filter(r => r.status === 'completed' && r.rewardClaimed).length;
  const earnedDiamonds = Math.floor(completedReferrals / 2) * 600;
  const withdrawnDiamonds = currentUser?.withdrawnInviteDiamonds || 0;
  const availableDiamonds = Math.max(0, earnedDiamonds - withdrawnDiamonds);
  const minThresholdDiamonds = 0; // No minimum threshold
  
  const inviteCodeStr = currentUser?.inviteCode || currentUser?.displayId || '';

  // Function to check if friend met conditions (this should ideally be backend)
  const checkReferralsStatus = async () => {
    if (!currentUser?.id || !referrals.length) return;
    
    // In a real app, this logic would be in a Firebase Cloud Function.
    // Here, we simulate it for the UI.
    let updatedReferrals = [...referrals];
    let needsUpdate = false;
    
    for (let i = 0; i < updatedReferrals.length; i++) {
        const r = updatedReferrals[i];
        if (r.status === 'pending') {
            // Check if joined > 7 days ago
            const joined = new Date(r.joinedAt);
            const now = new Date();
            const diffDays = (now.getTime() - joined.getTime()) / (1000 * 60 * 60 * 24);
            
            // Condition: 7 days AND salary withdrawn (withdrawnAt exists)
            if (diffDays >= 7 && r.withdrawnAt) {
                updatedReferrals[i].status = 'completed';
                needsUpdate = true;
            }
        }
    }
    
    if (needsUpdate) {
        await updateDoc(doc(db, 'users', currentUser.id), { referrals: updatedReferrals });
    }
  };

  useEffect(() => {
    checkReferralsStatus();
  }, []);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(inviteCodeStr);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  const handleWithdraw = async () => {
    if (!currentUser?.id) return;
    if (availableDiamonds < minThresholdDiamonds) {
      setErrorMsg('⚠️ عذراً، لم تصل بعد إلى الحد الأدنى للسحب وهو 50 دولار (30,000 ألماسة).');
      setTimeout(() => setErrorMsg(null), 5000);
      return;
    }

    setIsWithdrawing(true);
    setErrorMsg(null);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        diamonds: increment(availableDiamonds),
        withdrawnInviteDiamonds: (currentUser.withdrawnInviteDiamonds || 0) + availableDiamonds
      });

      setSuccessMsg(`🎉 مبارك! تم تحويل مبلغ ${availableDiamonds.toLocaleString()} 💎 بنجاح إلى محفظتك الرئيسية!`);
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err) {
      console.error("Error withdrawing invite diamonds:", err);
      setErrorMsg('حدث خطأ أثناء سحب الأرباح. يرجى المحاولة مرة أخرى.');
      setTimeout(() => setErrorMsg(null), 5000);
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0c10] text-slate-100 font-sans relative select-none" dir="rtl">
      
      {/* Header */}
      <div className="bg-gradient-to-l from-purple-950 via-slate-900 to-[#121118] px-4 py-4 flex items-center justify-between border-b border-purple-500/20 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition active:scale-95 cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <h1 className="text-base font-black text-white flex items-center gap-2">
            <span>🎁</span>
            <span>دعوة صديق والأرباح</span>
          </h1>
        </div>
        <span className="text-xs bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black px-3 py-1 rounded-full shadow-md">
          ربح الألماس 💎
        </span>
      </div>

      {/* Main Content */}
      <div className="flex-grow overflow-y-auto p-4 space-y-5 pb-16">

        {/* Notifications */}
        {successMsg && (
          <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 p-3.5 rounded-2xl text-xs font-bold text-center animate-bounce">
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="bg-red-500/20 border border-red-500/40 text-red-300 p-3.5 rounded-2xl text-xs font-bold text-center">
            {errorMsg}
          </div>
        )}

        {/* Top Banner Card */}
        <div className="bg-gradient-to-br from-purple-900/60 via-indigo-950/80 to-slate-900 border border-purple-500/30 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-purple-500/15 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="flex items-start gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 flex items-center justify-center text-2xl shadow-lg shrink-0">
              🤝
            </div>
            <div className="space-y-1.5 flex-grow">
              <h2 className="text-sm font-black text-amber-300 flex items-center gap-1.5">
                <span>كل صديقين = 600 ألماسة 💎</span>
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              </h2>
              <p className="text-[11px] text-slate-300 leading-relaxed font-semibold">
                ادع أصدقائك للانضمام إلى التطبيق عبر رمز دعوتك الخاص. كل صديقين تدعوهما يمنحانك <span className="text-amber-400 font-bold">1 دولار (600 ألماسة 💎)</span> تضاف مباشرة إلى أرباحك القابلة للسحب!
              </p>
            </div>
          </div>
        </div>

        {/* Invite Code Box */}
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 space-y-3 shadow-xl">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <span>🔑</span>
            <span>رمز الدعوة الخاص بك (8 حروف/أرقام)</span>
          </label>
          <div className="flex items-center gap-2 bg-black/50 border border-amber-500/30 rounded-xl p-2.5 overflow-hidden">
            <button
              onClick={handleCopyCode}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition active:scale-95 flex items-center justify-center gap-1.5 shrink-0 ${
                copiedCode ? 'bg-emerald-500 text-white' : 'bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 shadow-md'
              }`}
            >
              {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'تم النسخ' : 'نسخ الرمز'}</span>
            </button>
            <input 
              type="text" 
              readOnly 
              dir="ltr"
              value={inviteCodeStr} 
              className="bg-transparent text-sm font-black text-amber-300 font-mono tracking-widest flex-grow outline-none text-center px-2 min-w-0"
            />
          </div>
        </div>



        {/* Referrals List */}
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 shadow-xl">
            <h3 className="text-sm font-black text-white mb-4">أصدقائي المدعوون</h3>
            {referrals.length === 0 ? (
                <p className="text-xs text-slate-500 text-center">لا يوجد أصدقاء مدعوون حالياً.</p>
            ) : (
                <div className="space-y-3">
                    {referrals.map((r, i) => (
                        <div key={i} className="flex items-center justify-between bg-black/30 p-3 rounded-xl border border-white/5">
                            <div>
                                <p className="text-xs font-bold text-white">{r.userName}</p>
                                <p className="text-[10px] text-slate-400">تاريخ الانضمام: {new Date(r.joinedAt).toLocaleDateString()}</p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${r.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                {r.status === 'completed' ? 'تمت الشروط' : 'قيد الانتظار'}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 space-y-1 text-center shadow-lg">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto mb-2 text-sm font-bold">
              👥
            </div>
            <p className="text-[10px] text-slate-400 font-bold">الأصدقاء المدعوون</p>
            <p className="text-lg font-black text-white font-mono">{invitedCount} <span className="text-xs font-normal text-slate-400">صديق</span></p>
          </div>

          <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 space-y-1 text-center shadow-lg">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-2 text-sm font-bold">
              💎
            </div>
            <p className="text-[10px] text-slate-400 font-bold">إجمالي الأرباح المكتسبة</p>
            <p className="text-lg font-black text-amber-400 font-mono">{earnedDiamonds.toLocaleString()} <span className="text-xs font-normal text-slate-400">💎</span></p>
          </div>
        </div>

        {/* Withdrawal Section */}
        <div className="bg-slate-900/90 border border-white/10 rounded-3xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-400" />
              <span className="text-sm font-black text-white">رصيد الأرباح للسحب</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-400">الألماس المتاح للسحب:</span>
              <span className="text-emerald-400 font-mono font-black text-sm">{availableDiamonds.toLocaleString()} 💎</span>
            </div>

            <div className="flex justify-between text-[11px] text-slate-300 font-semibold bg-white/5 p-2 rounded-xl border border-white/5">
              <span>جاهز للسحب الفوري:</span>
              <span className="text-emerald-400 font-mono font-black">{availableDiamonds.toLocaleString()} 💎</span>
            </div>
          </div>

          <button
            onClick={handleWithdraw}
            disabled={availableDiamonds <= 0 || isWithdrawing}
            className={`w-full py-3.5 rounded-2xl font-black text-xs transition flex items-center justify-center gap-2 shadow-xl cursor-pointer ${
              availableDiamonds > 0 
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30 active:scale-95' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
            }`}
          >
            <span>{isWithdrawing ? 'جاري التحويل...' : 'سحب الأرباح إلى المحفظة الرئيسية'}</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
          
          <p className="text-[10px] text-slate-400 text-center leading-relaxed">
            عند سحب الأرباح، يتم إضافة رصيد الألماس مباشرة إلى محفظتك الشخصية حيث يمكنك تحويلها أو سحبها عبر الوكلاء المعتمدين.
          </p>
        </div>

      </div>
    </div>
  );
}
