import React, { useState, useEffect } from 'react';
import { ChevronRight, Send, Search, ShieldCheck } from 'lucide-react';
import { AppUser } from '../../types';
import { db } from '../../lib/firebase';
import { doc, updateDoc, getDoc, collection, addDoc } from 'firebase/firestore';

interface Props {
  onBack: () => void;
  currentUser: AppUser | null;
  users: AppUser[];
}

export default function CoinAgentPortalView({ onBack, currentUser, users }: Props) {
  const [targetId, setTargetId] = useState('');
  const [amount, setAmount] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [liveInventory, setLiveInventory] = useState(currentUser?.agent_coin_inventory || 0);

  useEffect(() => {
    // Keep local inventory updated if user document changes, but for simplicity, we assume currentUser updates flow down.
    if (currentUser?.agent_coin_inventory !== undefined) {
      setLiveInventory(currentUser.agent_coin_inventory);
    }
  }, [currentUser]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setErrorMsg('');
    setSuccessMsg('');

    if (!targetId || !amount) {
      setErrorMsg('يرجى تعبئة جميع الحقول المطلوبة.');
      return;
    }

    const transferAmount = parseInt(amount, 10);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      setErrorMsg('يرجى إدخال كمية صحيحة.');
      return;
    }

    if (transferAmount > liveInventory) {
      setErrorMsg('رصيد الوكالة الحالي غير كافٍ لإتمام هذه العملية.');
      return;
    }

    const targetUser = users?.find(u => u.displayId === targetId || u.originalDisplayId === targetId);
    if (!targetUser) {
      setErrorMsg('لم يتم العثور على مستخدم بهذا الآيدي.');
      return;
    }

    if (targetUser.id === currentUser.id) {
      setErrorMsg('لا يمكنك شحن الرصيد لنفسك.');
      return;
    }

    setIsTransferring(true);
    try {
      // Deduct from agent
      const agentRef = doc(db, 'users', currentUser.id);
      const agentSnap = await getDoc(agentRef);
      if (agentSnap.exists()) {
        const agentData = agentSnap.data();
        const currentInventory = agentData.agent_coin_inventory || 0;
        if (transferAmount > currentInventory) {
          setErrorMsg('رصيد الوكالة الحالي غير كافٍ في قاعدة البيانات.');
          setIsTransferring(false);
          return;
        }
        await updateDoc(agentRef, {
          agent_coin_inventory: currentInventory - transferAmount
        });
        setLiveInventory(currentInventory - transferAmount);
      }

      // Add to target user
      const targetRef = doc(db, 'users', targetUser.id);
      const targetSnap = await getDoc(targetRef);
      if (targetSnap.exists()) {
        const targetData = targetSnap.data();
        await updateDoc(targetRef, {
          coins: (targetData.coins || 0) + transferAmount
        });
      }

      // Log transaction
      await addDoc(collection(db, 'agent_coin_transfers'), {
        agent_id: currentUser.id,
        recipient_id: targetUser.id,
        recipient_displayId: targetId,
        coins_transferred: transferAmount,
        timestamp: new Date().toISOString()
      });

      setSuccessMsg(`تم شحن ${transferAmount.toLocaleString()} كوينز للمستخدم ${targetUser.name} بنجاح!`);
      setTargetId('');
      setAmount('');
      
      setTimeout(() => setSuccessMsg(''), 5000);

    } catch (err) {
      console.error(err);
      setErrorMsg('حدث خطأ أثناء عملية الشحن. الرجاء المحاولة مرة أخرى.');
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-slate-200 font-cairo">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 bg-gradient-to-l from-emerald-900 to-[#0a0a0f] border-b border-white/10 sticky top-0 z-20">
        <button onClick={onBack} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition active:scale-95">
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
        <h2 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
          بوابة شحن المستخدمين
        </h2>
        <div className="w-10"></div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Agent Info Card */}
        <div className="bg-gradient-to-br from-emerald-800/40 to-emerald-900/40 border border-emerald-500/20 rounded-3xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute -top-10 -right-10 opacity-10 text-9xl pointer-events-none">💼</div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">وكيل شحن معتمد</h3>
              <p className="text-xs text-emerald-200">بوابة الشحن الرسمية</p>
            </div>
          </div>
          
          <div className="bg-black/30 rounded-2xl p-4 flex items-center justify-between border border-black/20">
            <span className="text-sm font-bold text-slate-300">رصيد الوكالة المتاح:</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-emerald-400 font-mono tracking-wider">{liveInventory.toLocaleString()}</span>
              <span>🪙</span>
            </div>
          </div>
        </div>

        {/* Transfer Form */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
          <h4 className="text-sm font-black text-white mb-2">إرسال كوينز للمستخدمين</h4>
          
          <form onSubmit={handleTransfer} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 text-right block pr-1">الآيدي المستهدف (Target ID)</label>
              <div className="relative">
                <input
                  type="text"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  placeholder="أدخل آيدي المستخدم"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-10 py-3 text-sm text-right text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
                />
                <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 text-right block pr-1">كمية الكوينز (Coins Amount)</label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="أدخل عدد الكوينز"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-10 py-3 text-sm text-right text-emerald-400 font-mono font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">🪙</span>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold p-3 rounded-xl text-center">
                {errorMsg}
              </div>
            )}
            
            {successMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold p-3 rounded-xl text-center">
                {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isTransferring}
              className="w-full py-3.5 bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl transition-all shadow-[0_4px_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 mt-4"
            >
              {isTransferring ? (
                <span className="text-sm">جاري تنفيذ العملية...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span className="text-sm">إرسال الكوينز</span>
                </>
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
