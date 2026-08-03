import React, { useState, useEffect } from 'react';
import { ChevronLeft, Info, X, Shield, Sparkles } from 'lucide-react';
import { AppUser, isUserOnline } from '../../types';
import { auth, db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
import { doc, updateDoc, collection, query, where, onSnapshot, addDoc, deleteDoc, getDoc, getDocs } from 'firebase/firestore';
import { getLevelFromXp } from '../../lib/levelMath';
import { formatCompactNumber } from '../../utils/format';

interface Props {
  setCurrentScreen: (val: string) => void;
  onNavigate: (view: string) => void;
  currentUser: AppUser | null;
  users: AppUser[];
  supportTickets: any[];
  setIsSupportAdminModalOpen: (val: boolean) => void;
  setIsAdminManageModalOpen: (val: boolean) => void;
  setIsProfileModalOpen: (val: boolean) => void;
  setSelectedProfileUser: (val: AppUser | null) => void;
}

export default function MainMenuView({ 
  onNavigate, 
  currentUser, 
  users, 
  supportTickets, 
  setIsSupportAdminModalOpen, 
  setIsAdminManageModalOpen, 
  setCurrentScreen,
  setIsProfileModalOpen,
  setSelectedProfileUser
}: Props) {
  const senderXp = currentUser?.senderXp || 0;
  const charmXp = currentUser?.charmXp || 0;
  const wealthLevel = getLevelFromXp(senderXp);
  const popularLevel = getLevelFromXp(charmXp);

  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [claimStatus, setClaimStatus] = useState<'idle' | 'claiming' | 'claimed'>('idle');
  const [notification, setNotification] = useState<string | null>(null);
  const [receivedInvitations, setReceivedInvitations] = useState<any[]>([]);
  const [visitorsCount, setVisitorsCount] = useState<number>(0);

  // Fetch visitors count
  useEffect(() => {
    if (!currentUser?.id) return;

    const visitorsRef = collection(db, 'users', currentUser.id, 'visitors');
    const unsubscribe = onSnapshot(visitorsRef, (snapshot) => {
      setVisitorsCount(snapshot.docs.length);
    }, (err) => {
      console.error("Error subscribing to profile visitors: ", err);
    });

    return () => unsubscribe();
  }, [currentUser?.id]);



  // 1. Fetch pending invitations for this user
  useEffect(() => {
    if (!currentUser?.id) return;

    const q = query(
      collection(db, 'agency_invitations'),
      where('target_user_id', '==', currentUser.id),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setReceivedInvitations(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "agency_invitations");
    });

    return () => unsubscribe();
  }, [currentUser?.id]);

  // Handle Accept Invitation
  const handleAcceptInvitation = async (inv: any) => {
    if (!currentUser) return;
    try {
      // 1. Update the user document to associate with the agency
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        agencyId: inv.agency_id,
        agencyName: inv.agency_name
      });

      // 2. Delete the invitation document completely to keep things clean
      const invRef = doc(db, 'agency_invitations', inv.id);
      await deleteDoc(invRef);

      // 3. Send automated PM response back to agency owner
      try {
        await addDoc(collection(db, 'messages'), {
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar || '',
          receiverId: inv.agency_id,
          receiverName: inv.owner_name || 'مالك الوكالة',
          text: `✅ لقد قبلت دعوتك للانضمام إلى وكالة (${inv.agency_name}) وأصبحت مضيفاً رسمياً بالوكالة الآن!`,
          isEncrypted: false,
          isRead: false,
          timestamp: new Date().toISOString(),
          participants: [currentUser.id, inv.agency_id]
        });
      } catch (msgErr) {
        console.error("Failed to send accept message to agency owner:", msgErr);
      }

      setNotification(`تهانينا! لقد انضممت بنجاح إلى وكالة (${inv.agency_name})`);
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      console.error("Error accepting invitation:", err);
      alert("حدث خطأ أثناء قبول الدعوة. الرجاء المحاولة مرة أخرى.");
    }
  };

  // Handle Reject Invitation
  const handleRejectInvitation = async (inv: any) => {
    try {
      // Delete the invitation document completely
      const invRef = doc(db, 'agency_invitations', inv.id);
      await deleteDoc(invRef);

      // Send automated PM response back to agency owner
      if (currentUser) {
        try {
          await addDoc(collection(db, 'messages'), {
            senderId: currentUser.id,
            senderName: currentUser.name,
            senderAvatar: currentUser.avatar || '',
            receiverId: inv.agency_id,
            receiverName: inv.owner_name || 'مالك الوكالة',
            text: `❌ عذراً، لقد رفضت دعوة الانضمام إلى وكالة (${inv.agency_name}).`,
            isEncrypted: false,
            isRead: false,
            timestamp: new Date().toISOString(),
            participants: [currentUser.id, inv.agency_id]
          });
        } catch (msgErr) {
          console.error("Failed to send reject message to agency owner:", msgErr);
        }
      }

      setNotification("تم رفض طلب الانضمام للوكالة.");
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      console.error("Error rejecting invitation:", err);
      alert("حدث خطأ أثناء رفض الدعوة.");
    }
  };

  // Parse or compute joining days dynamically
  const joinedDays = currentUser?.createdAt 
    ? Math.max(1, Math.floor((new Date().getTime() - new Date(currentUser.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
    : 1;

  // Map country to flags
  const getCountryFlag = (countryName?: string) => {
    const norm = (countryName || 'العراق').trim();
    if (norm.includes('سعودي') || norm.includes('سعودية') || norm.includes('KSA')) return '🇸🇦';
    if (norm.includes('مصر') || norm.includes('مصري')) return '🇪🇬';
    if (norm.includes('سوريا') || norm.includes('سوري')) return '🇸🇾';
    if (norm.includes('يمن') || norm.includes('يمني')) return '🇾🇪';
    if (norm.includes('تركيا') || norm.includes('تركي')) return '🇹🇷';
    if (norm.includes('أردن') || norm.includes('أردني')) return '🇯🇴';
    if (norm.includes('كويت') || norm.includes('كويتي')) return '🇰🇼';
    if (norm.includes('فلسطين')) return '🇵🇸';
    return '🇮🇶'; // default to Iraq
  };

  const handleClaimReward = async () => {
    if (!currentUser?.id) return;
    if (claimStatus === 'claimed') return;

    setClaimStatus('claiming');
    try {
      const rewardCoins = 50;
      await updateDoc(doc(db, "users", currentUser.id), {
        coins: (currentUser.coins || 0) + rewardCoins
      });
      setClaimStatus('claimed');
      setNotification(`🎉 مبارك! تم استلام مكافأة المستوى اليومية: 🪙 ${rewardCoins} كوينز بنجاح!`);
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      console.error("Error claiming coins", err);
      alert("حدث خطأ أثناء استلام المكافأة، يرجى المحاولة لاحقاً.");
      setClaimStatus('idle');
    }
  };

  const menuGroups = [
    [
      { id: 'wallet', label: 'المحفظة', icon: '💰', bg: 'bg-[#ff9f1c]', nav: 'wallet', extra: currentUser?.coins || 0 },
      { id: 'edit_profile', label: 'تعديل البروفايل', icon: '👤', bg: 'bg-[#ff4d6d]', nav: 'edit_profile' },
      { id: 'accessories', label: 'ملحقاتي', icon: '⭐', bg: 'bg-[#00f5d4]', nav: 'accessories' },
      { id: 'my_room', label: 'غرفتي', icon: '🏠', bg: 'bg-[#7209b7]', nav: 'my_room' },
      { id: 'my_posts', label: 'منشوراتي', icon: '🧭', bg: 'bg-[#4361ee]', nav: 'my_posts' },
    ],
    [
      { id: 'login', label: 'تسجيل الدخول', icon: '📅', bg: 'bg-[#f77f00]', nav: 'login' },
      { id: 'store', label: 'متجر', icon: '🏪', bg: 'bg-[#55a630]', nav: 'store' },
      { id: 'my_level', label: 'مستواي', icon: '🎖️', bg: 'bg-[#c77dff]', nav: 'level' },
      { id: 'link_account', label: 'ربط الحساب', icon: '🔒', bg: 'bg-[#3a86c8]', nav: 'link_account' },
      { id: 'instructions', label: 'التعليمات', icon: '❓', bg: 'bg-[#00bbf9]', nav: 'instructions' },
    ],
    [
      { id: 'support', label: 'المشكلات والاقتراحات', icon: '💬', bg: 'bg-[#9d4edd]', nav: 'support' },
      { id: 'invite_friend', label: 'دعوة صديق', icon: '🎁', bg: 'bg-[#e056fd]', nav: 'invite_friend' },
      { id: 'host_mission', label: 'مكافأة المضيفين (15 يوم)', icon: '🎯', bg: 'bg-[#ff6b6b]', nav: 'host_mission' },
      { id: 'settings', label: 'الإعدادات', icon: '⚙️', bg: 'bg-[#6c757d]', nav: 'settings' },
    ]
  ];

  return (
    <div className="flex-grow bg-slate-50 relative flex flex-col pb-6" dir="rtl">
      
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-12 left-4 right-4 z-50 bg-slate-900/95 text-white p-3.5 rounded-xl text-center text-xs font-black shadow-2xl border border-amber-500/30 animate-bounce flex items-center justify-center gap-2">
          <span>{notification}</span>
        </div>
      )}

      {/* Premium Header: Magenta to Orange Gradient exactly like screenshot */}
      <div className="bg-gradient-to-l from-[#d91b5c] via-[#ec2d70] to-[#f39c12] pt-8 pb-6 px-4 text-white relative shadow-md">
        
        {/* Profile Card row */}
        <div 
          onClick={() => onNavigate('full_profile')}
          className="flex items-center gap-4 text-right cursor-pointer hover:opacity-95 active:scale-[0.99] transition-all duration-200"
        >
          
          {/* Circular Avatar with Thick Golden Ring */}
          <div className="relative">
            <div className="w-[72px] h-[72px] rounded-full p-[2.5px] bg-gradient-to-tr from-yellow-300 via-amber-400 to-orange-400 shadow-[0_0_12px_rgba(253,224,71,0.4)]">
              <img 
                src={currentUser?.avatar || "https://api.dicebear.com/7.x/adventurer/svg"} 
                className="w-full h-full rounded-full object-cover bg-slate-900 border-2 border-white/10" 
                alt="Avatar"
              />
            </div>
            {/* Online indicator orb */}
            {isUserOnline(currentUser) && (
              <span className="absolute bottom-0 right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-900 rounded-full flex items-center justify-center text-[8px] font-black">✓</span>
            )}
          </div>

          {/* User Text Details */}
          <div className="flex-grow space-y-1">
            <h2 className="font-black text-lg text-white leading-tight drop-shadow-sm flex items-center gap-1.5">
              {currentUser?.name || "مستخدم جديد"}
              {currentUser?.role === 'admin' && <span className="bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md">إدارة</span>}
            </h2>
            <p className="text-[10px] text-white/90 font-bold tracking-wide">
              رقم المستخدم: {currentUser?.displayId || currentUser?.id?.slice(0, 8)}
            </p>
            <p className="text-[10px] text-white/80 font-bold">
              انضم لمدة {joinedDays} يوم
            </p>
            {currentUser?.agencyName && (
              <p className="text-[10px] text-yellow-200 font-extrabold flex items-center gap-1 mt-0.5">
                <span>🏢</span>
                <span>الوكالة: {currentUser.agencyName}</span>
              </p>
            )}

            {/* Pill Badges Row */}
            <div className="flex flex-wrap gap-1.5 items-center pt-1" dir="rtl">
              {/* Country Badge */}
              <span className="bg-[#F17875] text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-sm shadow-[#F17875]/30 flex items-center gap-1 leading-none">
                <span className="text-[10px] uppercase font-mono opacity-95">IQ</span>
                <span>{currentUser?.country || 'العراق'}</span>
              </span>

              {/* Gender + Age badge */}
              <span className="bg-[#9D68A0] text-white text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm leading-none">
                <span>
                  {currentUser?.birthdate ? (() => {
                    const today = new Date();
                    const birthDate = new Date(currentUser.birthdate);
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const m = today.getMonth() - birthDate.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                      age--;
                    }
                    return isNaN(age) ? '25' : age;
                  })() : '25'}
                </span>
                <span className="text-[12px]">{currentUser?.gender === 'female' ? '♀️' : '♂️'}</span>
              </span>

              {/* Wealth Level badge */}
              <span className="bg-[#A55F73] text-white text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm leading-none">
                <span>{wealthLevel}</span>
                <span className="text-[12px]">🌙</span>
              </span>

              {/* Charm score badge */}
              <span className="bg-[#E53E7B] text-white text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm leading-none">
                <span className="font-mono">{getLevelFromXp(currentUser?.charmXp || 0)}</span>
                <span className="text-[12px]">💖</span>
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Stats Row */}
        <div className="grid grid-cols-3 mt-6 pt-4 border-t border-white/15 text-center">
          <button 
            onClick={() => onNavigate('social_followers')}
            className="space-y-0.5 focus:outline-none hover:opacity-80 active:scale-95 transition-all cursor-pointer text-center"
          >
            <strong className="text-base font-black tracking-wide block text-white font-mono">
              {currentUser ? (users.filter(u => currentUser.followers?.includes(u.id)).length) : 0}
            </strong>
            <span className="text-[10px] text-white/70 font-bold block">المتابعين</span>
          </button>
          
          <button 
            onClick={() => onNavigate('social_following')}
            className="space-y-0.5 border-x border-white/10 focus:outline-none hover:opacity-80 active:scale-95 transition-all cursor-pointer text-center"
          >
            <strong className="text-base font-black tracking-wide block text-white font-mono">
              {currentUser ? (users.filter(u => currentUser.following?.includes(u.id)).length) : 0}
            </strong>
            <span className="text-[10px] text-white/70 font-bold block">يتابع</span>
          </button>
          
          <button 
            onClick={() => onNavigate('social_visitors')}
            className="space-y-0.5 focus:outline-none hover:opacity-80 active:scale-95 transition-all cursor-pointer text-center"
          >
            <strong className="text-base font-black tracking-wide block text-white font-mono">
              {visitorsCount}
            </strong>
            <span className="text-[10px] text-white/70 font-bold block">الزوار</span>
          </button>
        </div>

      </div>

      {/* Floating Header overlaps container slightly, using white background cards */}
      <div className="p-3 -mt-3 relative z-10 space-y-3 pb-6">
        
        {/* Double Premium Banner Rows: VIP and Wealth */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* VIP Level Card (Left/Dark) */}
          <button 
            onClick={() => onNavigate('vip')}
            className="bg-gradient-to-l from-[#1f1610] via-[#351e12] to-[#1f1610] border border-amber-500/20 text-white rounded-2xl p-3.5 shadow-md flex items-center justify-between hover:opacity-95 active:scale-95 transition-all text-right cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              {/* V Diamond Logo with Glow */}
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center font-black text-amber-950 text-lg shadow-[0_0_10px_rgba(245,158,11,0.4)] group-hover:scale-105 transition-transform">
                V
              </div>
              <div className="flex flex-col items-start">
                <span className="text-xs font-black tracking-wide text-amber-300 leading-tight">مستوى VIP</span>
                <span className="text-[9px] text-amber-400/80 font-bold mt-0.5">مزايا وحصانة ملكية 👑</span>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-amber-400" />
          </button>

          {/* Wealth Level Card (Right/Green) */}
          <button 
            onClick={() => onNavigate('level_wealth')}
            className="bg-gradient-to-l from-[#065f46] to-[#059669] border border-emerald-400/20 text-white rounded-2xl p-3.5 shadow-md flex items-center justify-between hover:opacity-95 active:scale-95 transition-all text-right cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              {/* Crescent/Moon graphic */}
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-300 to-green-100 flex items-center justify-center text-lg shadow-[0_0_10px_rgba(16,185,129,0.4)] group-hover:scale-105 transition-transform">
                🌙
              </div>
              <div className="flex flex-col items-start">
                <span className="text-xs font-black tracking-wide text-white leading-tight">مستوى الثروة</span>
                <span className="text-[9px] text-emerald-100/80 font-bold mt-0.5">نقاط ومكافآت 🌙 {wealthLevel}</span>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-emerald-200" />
          </button>
        </div>


        {/* Received Agency Invitations List */}
        {receivedInvitations.length > 0 && receivedInvitations.map((inv) => (
          <div 
            key={inv.id} 
            className="bg-gradient-to-r from-indigo-950 via-[#13112c] to-indigo-950 border-2 border-indigo-500 rounded-2xl p-4 shadow-xl flex flex-col space-y-3 animate-pulse-subtle text-right mb-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-extrabold px-2.5 py-1 rounded-full border border-indigo-400/30">
                دعوة انضمام للوكالة 🏢
              </span>
              <span className="text-[9px] text-slate-400 font-bold">
                {inv.timestamp ? new Date(inv.timestamp).toLocaleDateString('ar-EG') : ''}
              </span>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-xl border border-indigo-500/30 shadow-inner">
                🏢
              </div>
              <div className="space-y-1 text-right flex-1">
                <h4 className="text-xs font-black text-white">وكالة: {inv.agency_name}</h4>
                <p className="text-[10px] text-slate-300">دعوة من المالك: <span className="font-extrabold text-indigo-300">{inv.owner_name}</span></p>
                <p className="text-[9px] text-slate-400 leading-relaxed">عند الموافقة، ستنضم رسمياً إلى هذه الوكالة وتصبح أحد أعضائها المعتمدين.</p>
              </div>
            </div>

            <div className="flex gap-2 border-t border-white/10 pt-3">
              <button
                onClick={() => handleAcceptInvitation(inv)}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-[10px] font-black py-2.5 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
              >
                موافق (انضمام)
              </button>
              <button
                onClick={() => handleRejectInvitation(inv)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-bold py-2.5 rounded-xl transition-all border border-white/10 active:scale-95 cursor-pointer"
              >
                رفض الطلب
              </button>
            </div>
          </div>
        ))}


        {/* Super Admin Panel Row (Conditional) */}
        {(currentUser?.role === 'admin' || currentUser?.displayId?.includes('صدى العرب')) && (
          <div className="bg-white rounded-2xl shadow-sm border-b-2 border-red-500 overflow-hidden mb-3">
            <button 
              onClick={() => setIsAdminManageModalOpen(true)}
              className="w-full flex items-center justify-between p-3.5 bg-gradient-to-l from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 transition active:scale-95 text-right cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-lg shadow-sm group-hover:scale-105 transition-transform bg-gradient-to-tr from-red-500 to-amber-500">
                  🛡️
                </div>
                <span className="text-xs font-black text-white tracking-wide">لوحة الإدارة والوكالات</span>
              </div>
              <div className="flex items-center gap-2">
                <ChevronLeft className="w-4 h-4 text-amber-500 group-hover:-translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        )}

        {/* Authorized Coin Agent Portal Row (Conditional) */}
        {currentUser?.isAgent === true && (
          <div className="bg-white rounded-2xl shadow-sm border-b-2 border-emerald-500 overflow-hidden mb-3">
            <button 
              onClick={() => onNavigate('coin_agent_portal')}
              className="w-full flex items-center justify-between p-3.5 bg-gradient-to-l from-emerald-900 to-emerald-800 hover:from-emerald-800 hover:to-emerald-700 transition active:scale-95 text-right cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-lg shadow-sm group-hover:scale-105 transition-transform bg-gradient-to-tr from-emerald-500 to-teal-500">
                  💼
                </div>
                <span className="text-xs font-black text-white tracking-wide">بوابة شحن المستخدمين</span>
              </div>
              <div className="flex items-center gap-2">
                <ChevronLeft className="w-4 h-4 text-emerald-400 group-hover:-translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        )}

        {/* Agency Owner Portal Row (Conditional) */}
        {(currentUser?.role === 'agency_owner' || (currentUser?.agencyId && currentUser?.agencyId === currentUser?.displayId)) && (
          <div className="bg-white rounded-2xl shadow-sm border-b-2 border-indigo-500 overflow-hidden mb-3">
            <button 
              onClick={() => onNavigate('agency_portal')}
              className="w-full flex items-center justify-between p-3.5 bg-gradient-to-l from-indigo-900 to-indigo-800 hover:from-indigo-800 hover:to-indigo-700 transition active:scale-95 text-right cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-lg shadow-sm group-hover:scale-105 transition-transform bg-gradient-to-tr from-indigo-500 to-blue-500">
                  🏢
                </div>
                <span className="text-xs font-black text-white tracking-wide">بوابة إدارة الوكالة</span>
              </div>
              <div className="flex items-center gap-2">
                <ChevronLeft className="w-4 h-4 text-indigo-400 group-hover:-translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        )}

        {/* Menu groups with precision styling matching the provided screenshot */}
        <div className="space-y-3">
          {menuGroups.map((group, gIdx) => (
            <div key={gIdx} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-100/60">
              {group.map((item: any) => (
                <button 
                  key={item.id}
                  onClick={() => onNavigate(item.nav)}
                  className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50/80 transition active:bg-slate-100 text-right cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-base shadow-sm group-hover:scale-105 transition-transform ${item.bg}`}>
                      {item.icon}
                    </div>
                    <span className="text-xs font-black text-slate-800">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.extra !== undefined && (
                      <span 
                        className="text-xs font-black text-amber-600 font-mono bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 flex items-center gap-1 cursor-help" 
                        dir="ltr"
                        title={typeof item.extra === 'number' ? item.extra.toLocaleString() : String(item.extra)}
                      >
                        <span>🪙</span>
                        <span>{typeof item.extra === 'number' ? formatCompactNumber(item.extra) : item.extra}</span>
                      </span>
                    )}
                    <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-slate-400 group-hover:-translate-x-0.5 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Removed Additional functions (Agent Portal, Support) block as requested */}

      </div>

      {/* Rules Modal (Popup) */}
      {isRulesModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden border border-slate-100 shadow-2xl animate-fade-in text-right">
            <div className="bg-gradient-to-l from-[#d91b5c] to-[#f39c12] p-4 text-white flex items-center justify-between">
              <button 
                onClick={() => setIsRulesModalOpen(false)}
                className="p-1 hover:bg-white/20 rounded-full transition text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-black text-sm flex items-center gap-1.5">
                📜 قوانين مستويات صدى العرب
              </h3>
            </div>
            
            <div className="p-4 space-y-3.5 max-h-[60vh] overflow-y-auto">
              <div className="space-y-1">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1">
                  <span>💰</span> مستوى الثروة (Wealth Level)
                </h4>
                <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                  يرتفع مستوى الثروة عند إرسال الهدايا والمشاركة الفعالة في الغرف والمجالس الصوتية. يمنحك رتب وهالة ذهبية فريدة.
                </p>
              </div>

              <div className="space-y-1 border-t border-slate-100 pt-3">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1">
                  <span>💖</span> مستوى الشعبية (Popularity Level)
                </h4>
                <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                  يرتفع عند تلقي الهدايا والإعجابات والمتابعين من الأعضاء الآخرين في صدى العرب.
                </p>
              </div>

              <div className="space-y-1 border-t border-slate-100 pt-3">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1">
                  <span>👑</span> مستوى الـ VIP والتميز
                </h4>
                <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                  يقدم خصومات حصرية في المتجر، تأثيرات دخول ملونة ومبهرة عند دخول المجالس الصوتية، ودعم فني مخصص وفوري لحسابك.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <button 
                onClick={() => setIsRulesModalOpen(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl transition"
              >
                فهمت ذلك
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 left-4 right-4 bg-emerald-600 text-white p-3.5 rounded-2xl shadow-xl z-50 text-center font-black text-xs flex items-center justify-between animate-bounce">
          <div className="flex-1 text-right">{notification}</div>
          <button onClick={() => setNotification(null)} className="p-1 hover:bg-emerald-500 rounded-full cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

    </div>
  );
}
