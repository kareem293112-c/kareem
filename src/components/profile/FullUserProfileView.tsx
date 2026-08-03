import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, Edit3, Award, Calendar, Globe, User, Shield, 
  Sparkles, Coins, HelpCircle, Heart, Flame, Compass, ChevronLeft,
  Share2, Trophy, Crown, Gift, Music, Image, Send, Copy, Check, Users, Trash2,
  AlertTriangle, VolumeX, Sofa, Settings2, ShieldCheck, MessageSquare
} from 'lucide-react';
import { AppUser, isUserOnline } from '../../types';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, doc, query, onSnapshot, setDoc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { getLevelFromXp } from '../../lib/levelMath';

interface Props {
  onBack: () => void;
  currentUser: AppUser | null;
  users: AppUser[];
  onNavigate?: (view: string) => void;
  targetUser?: AppUser | null;
  onToggleFollow?: (targetUser: AppUser) => Promise<void>;
  onSendPrivateMessage?: (targetUser: AppUser) => void;
  onSendGift?: (targetUser: AppUser) => void;
  activeRoom?: any;
  handleHostAction?: (action: 'mute' | 'lock' | 'leave') => void;
  handleBanUser?: (userId: string, durationMin: number) => void;
  setSelectedSeatIndex?: (val: number) => void;
}

interface Moment {
  id: string;
  text: string;
  timestamp: string;
  likes: number;
  commentsCount: number;
  likedBy?: string[];
}

export default function FullUserProfileView({ 
  onBack, 
  currentUser, 
  users, 
  onNavigate,
  targetUser,
  onToggleFollow,
  onSendPrivateMessage,
  onSendGift,
  activeRoom,
  handleHostAction,
  handleBanUser,
  setSelectedSeatIndex
}: Props) {
  const [activeTab, setActiveTab] = useState<'profile' | 'moments'>('profile');
  const [copied, setCopied] = useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  
  // Resolve user being viewed
  const userToShow = targetUser || currentUser;
  const rawFreshUser = users.find(u => u.id === userToShow?.id) || userToShow || {} as any;
  const freshUser = {
    ...rawFreshUser,
    displayId: (rawFreshUser.id === currentUser?.id && currentUser?.displayId) ? currentUser.displayId : rawFreshUser.displayId
  };
  const isOwnProfile = !targetUser || targetUser.id === currentUser?.id;

  const resolvedCpPartner = users.find(u => u.id === freshUser.cpPartnerId) || null;
  const resolvedCpDays = freshUser.cpDays || 0;
  
  // Close friends resolution
  const resolvedCloseFriends = users.filter(u => freshUser.closeFriends?.includes(u.id)) || [];

  // Supporter list (دعم حسابي)
  const resolvedSupporters = freshUser.supporters && freshUser.supporters.length > 0 
    ? freshUser.supporters 
    : users.filter(u => u.id !== freshUser.id).slice(0, 8).map((u, i) => ({
        userId: u.id,
        name: u.name,
        avatar: u.avatar,
        amount: [15000, 9200, 6400, 3100, 1800, 950, 450, 120][i] || 50
      }));

  const top3Supporters = resolvedSupporters.slice(0, 3);

  const [isInviteCpOpen, setIsInviteCpOpen] = useState(false);
  const [isSupportersModalOpen, setIsSupportersModalOpen] = useState(false);

  // Moments interactive simulation
  const [moments, setMoments] = useState<Moment[]>([]);
  const [visitorsCount, setVisitorsCount] = useState<number>(0);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const container = document.getElementById('smartphone-screen') || document.querySelector('.overflow-y-auto');
    if (container) {
      container.scrollTop = 0;
    }
  }, [activeTab]);

  useEffect(() => {
    if (isSupportersModalOpen) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      const container = document.getElementById('smartphone-screen') || document.querySelector('.overflow-y-auto');
      if (container) {
        container.scrollTop = 0;
      }
    }
  }, [isSupportersModalOpen]);

  useEffect(() => {
    if (!freshUser?.id) return;
    const visitorsRef = collection(db, 'users', freshUser.id, 'visitors');
    const unsubscribe = onSnapshot(visitorsRef, (snapshot) => {
      setVisitorsCount(snapshot.docs.length);
    }, (err) => {
      console.error("Error loading visitors:", err);
    });
    return () => unsubscribe();
  }, [freshUser?.id]);

  useEffect(() => {
    if (!freshUser?.id) return;
    const q = query(collection(db, `users/${freshUser.id}/moments`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbMoments = snapshot.docs.map(doc => doc.data() as Moment);
      if (dbMoments.length === 0) {
        setMoments([
          {
            id: '1',
            text: 'مرحباً بكم في ملفي الشخصي الجديد على تطبيق صدى العرب! 🎙️✨ يسعدني انضمامكم لمجالسي الصوتية ومشاركتكم أسعد اللحظات.',
            timestamp: 'منذ ساعتين',
            likes: 12,
            commentsCount: 3
          },
          {
            id: '2',
            text: 'جلسة طرب الليلة في غرفتي الخاصة "أوتار الشرق" 🎵 لا تفوتوا الحضور الساعة 9 مساءً بتوقيت مكة المكرمة 🇸🇦👑',
            timestamp: 'أمس',
            likes: 24,
            commentsCount: 8
          }
        ]);
      } else {
        setMoments(dbMoments.sort((a, b) => b.id.localeCompare(a.id)));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${freshUser.id}/moments`);
    });
    return () => unsubscribe();
  }, [freshUser?.id]);

  // Record profile visit
  useEffect(() => {
    if (currentUser && freshUser && freshUser.id && currentUser.id !== freshUser.id) {
      const visitorRef = doc(db, 'users', freshUser.id, 'visitors', currentUser.id);
      setDoc(visitorRef, {
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar || '',
        level: currentUser.level || 1,
        gender: currentUser.gender || 'male',
        country: currentUser.country || 'العراق',
        displayId: currentUser.displayId || currentUser.id.slice(0, 8),
        timestamp: new Date().toISOString()
      }).catch(err => {
        console.error("Error recording profile visit: ", err);
      });
    }
  }, [currentUser?.id, freshUser?.id]);

  const [newMomentText, setNewMomentText] = useState('');

  if (!currentUser) return null;

  // Level calculations
  const senderXp = freshUser.senderXp || 0;
  const charmXp = freshUser.charmXp || 0;

  const getLevelInfo = (xp: number) => {
    const level = Math.floor(Math.sqrt(xp / 10)) + 1;
    const currentLevelBaseXp = Math.pow(level - 1, 2) * 10;
    const nextLevelBaseXp = Math.pow(level, 2) * 10;
    const levelRange = nextLevelBaseXp - currentLevelBaseXp;
    const xpInCurrentLevel = xp - currentLevelBaseXp;
    const percentage = Math.min(100, Math.max(0, (xpInCurrentLevel / levelRange) * 100));
    
    return {
      level,
      xpInCurrentLevel,
      levelRange,
      percentage,
      nextLevelXp: nextLevelBaseXp
    };
  };

  const senderInfo = getLevelInfo(senderXp);
  const charmInfo = getLevelInfo(charmXp);

  // Get social counts
  const followingCount = users.filter(u => freshUser.following?.includes(u.id)).length;
  const followersCount = users.filter(u => freshUser.followers?.includes(u.id)).length;
  const friendsCount = users.filter(u => 
    freshUser.following?.includes(u.id) && 
    freshUser.followers?.includes(u.id)
  ).length;

  const isFollowing = currentUser?.following?.includes(freshUser.id) || false;

  const handleCopyId = () => {
    const displayVal = freshUser.displayId || freshUser.id;
    navigator.clipboard.writeText(displayVal);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePostMoment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMomentText.trim()) return;

    const newMoment: Moment = {
      id: Date.now().toString(),
      text: newMomentText,
      timestamp: 'الآن',
      likes: 0,
      commentsCount: 0,
      likedBy: []
    };

    if (currentUser?.id) {
      setDoc(doc(db, `users/${currentUser.id}/moments`, newMoment.id), newMoment).catch(console.error);
    }
    setNewMomentText('');
  };

  const handleDeleteMoment = (id: string) => {
    if (currentUser?.id) {
      deleteDoc(doc(db, `users/${currentUser.id}/moments`, id)).catch(console.error);
    }
  };

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
    return '🇮🇶';
  };

  const handleDissolveCp = async () => {
    if (!freshUser.id) return;
    try {
      await updateDoc(doc(db, "users", freshUser.id), {
        cpPartnerId: null,
        cpDays: 0
      });
      if (resolvedCpPartner) {
        await updateDoc(doc(db, "users", resolvedCpPartner.id), {
          cpPartnerId: null,
          cpDays: 0
        });
      }
    } catch (e) {
      console.error("Error dissolving CP:", e);
    }
  };

  const handleRemoveCloseFriend = async (friendId: string) => {
    if (!freshUser.id) return;
    try {
      const updatedFriends = (freshUser.closeFriends || []).filter((id: string) => id !== friendId);
      await updateDoc(doc(db, "users", freshUser.id), {
        closeFriends: updatedFriends
      });
      const friendUser = users.find(u => u.id === friendId);
      if (friendUser) {
        const updatedFriendCloseFriends = (friendUser.closeFriends || []).filter((id: string) => id !== freshUser.id);
        await updateDoc(doc(db, "users", friendId), {
          closeFriends: updatedFriendCloseFriends
        });
      }
    } catch (e) {
      console.error("Error removing close friend:", e);
    }
  };

  // Helper check if current viewer is host of activeRoom
  const isRoomHost = activeRoom && activeRoom.owner_id === currentUser?.id;
  const seatedSeat = activeRoom?.seats?.find((s: any) => s.userId === freshUser.id);

  return (
    <div className="flex flex-col h-full bg-[#FAF6EB] text-[#4A3E3D] overflow-y-auto font-sans relative" dir="rtl">
      
      {/* Dynamic Golden-Amber Cover Image Background */}
      <div className="relative h-60 bg-gradient-to-b from-[#b8860b] via-[#8a640f] to-[#402a01] shrink-0 overflow-hidden">
        
        {/* Subtle background overlay circles and patterns */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-amber-500/20 via-transparent to-transparent" />
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
        <div className="absolute bottom-4 right-10 w-32 h-32 bg-amber-400/10 rounded-full blur-xl" />

        {/* Top Action Header Bar */}
        <div className="absolute top-8 inset-x-0 px-4 flex items-center justify-between z-10">
          <button 
            onClick={onBack} 
            className="p-2 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition active:scale-95 border border-white/10 flex items-center justify-center cursor-pointer"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          
          <span className="text-[11px] font-black tracking-widest text-amber-200/90 bg-black/30 border border-amber-500/20 px-3.5 py-1.5 rounded-full backdrop-blur-md">
            الملف الشخصي الفاخر
          </span>

          <div className="flex items-center gap-2">
            {isOwnProfile ? (
              <button 
                onClick={() => onNavigate?.('edit_profile')}
                className="p-2 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition active:scale-95 border border-white/10 flex items-center justify-center cursor-pointer"
              >
                <Edit3 className="w-4.5 h-4.5 text-amber-300" />
              </button>
            ) : (
              <div className="w-9 h-9" /> // placeholder
            )}
          </div>
        </div>

        {/* User profile layout inside cover */}
        <div className="absolute bottom-4 inset-x-4 flex items-end gap-4">
          {/* Glowing Avatar */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 via-[#ec2d70] to-yellow-300 shadow-xl relative z-10">
              <img 
                src={freshUser.avatar || "https://api.dicebear.com/7.x/adventurer/svg"} 
                alt={freshUser.name} 
                className="w-full h-full rounded-full object-cover bg-slate-100 border border-white"
              />
            </div>
            {/* Level Badge bottom centered */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 text-[9px] font-black px-2.5 py-0.5 rounded-full font-mono border border-white shadow-lg z-20">
              Lv.{freshUser.level || 1}
            </div>
          </div>

          {/* User Meta Data */}
          <div className="text-white space-y-2 pb-1 relative z-20">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-lg font-black text-white drop-shadow-md">{freshUser.name}</h2>
              {freshUser.role === 'admin' && (
                <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm">إدارة</span>
              )}
              {isUserOnline(freshUser) && (
                <span className="bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" /> متصل
                </span>
              )}
            </div>

            {/* Vibrant Profile Badges (From Screenshot) */}
            <div className="flex flex-wrap gap-1.5 items-center mt-1.5" dir="rtl">
              {/* Country Badge */}
              <span className="bg-[#F17875] text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-sm shadow-[#F17875]/30 flex items-center gap-1 leading-none">
                <span className="text-[10px] uppercase font-mono opacity-90">{(() => {
                  const norm = (freshUser.country || 'العراق').trim();
                  if (norm.includes('سعودي') || norm.includes('سعودية') || norm.includes('KSA')) return 'KSA';
                  if (norm.includes('مصر') || norm.includes('مصري')) return 'EG';
                  if (norm.includes('سوريا') || norm.includes('سوري')) return 'SY';
                  if (norm.includes('يمن') || norm.includes('يمني')) return 'YE';
                  if (norm.includes('تركيا') || norm.includes('تركي')) return 'TR';
                  if (norm.includes('أردن') || norm.includes('أردني')) return 'JO';
                  if (norm.includes('كويت') || norm.includes('كويتي')) return 'KW';
                  if (norm.includes('فلسطين')) return 'PS';
                  return 'IQ';
                })()}</span>
                <span>{(() => {
                  const norm = (freshUser.country || 'العراق').trim();
                  if (norm.includes('سعودي') || norm.includes('سعودية') || norm.includes('KSA')) return 'السعودية';
                  if (norm.includes('مصر') || norm.includes('مصري')) return 'مصر';
                  if (norm.includes('سوريا') || norm.includes('سوري')) return 'سوريا';
                  if (norm.includes('يمن') || norm.includes('يمني')) return 'يمن';
                  if (norm.includes('تركيا') || norm.includes('تركي')) return 'تركيا';
                  if (norm.includes('أردن') || norm.includes('أردني')) return 'أردن';
                  if (norm.includes('كويت') || norm.includes('كويتي')) return 'كويت';
                  if (norm.includes('فلسطين')) return 'فلسطين';
                  return norm.substring(0, 10);
                })()}</span>
              </span>
              
              {/* Gender & Age Badge */}
              <span className="bg-[#9D68A0] text-white text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm shadow-[#9D68A0]/30 leading-none">
                <span>
                  {freshUser.birthdate ? (() => {
                    const today = new Date();
                    const birthDate = new Date(freshUser.birthdate);
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const m = today.getMonth() - birthDate.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                      age--;
                    }
                    return isNaN(age) ? '25' : age;
                  })() : '25'}
                </span>
                <span className="text-[12px]">{freshUser.gender === 'female' ? '♀️' : '♂️'}</span>
              </span>
              
              {/* Wealth Badge */}
              <span className="bg-[#A55F73] text-white text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm shadow-[#A55F73]/30 leading-none">
                <span>{getLevelFromXp(freshUser.senderXp || freshUser.xp || 0)}</span>
                <span className="text-[12px]">🌙</span>
              </span>
              
              {/* Charm Badge */}
              <span className="bg-[#E53E7B] text-white text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm shadow-[#E53E7B]/30 leading-none">
                <span className="font-mono">{getLevelFromXp(freshUser.charmXp || 0)}</span>
                <span className="text-[12px]">💖</span>
              </span>
            </div>

            {/* Copyable ID Badge */}
            <button 
              onClick={handleCopyId}
              className="bg-black/25 hover:bg-black/40 text-white/80 rounded-lg px-2 py-1 mt-2 text-[10px] font-mono flex items-center gap-1.5 transition active:scale-95 border border-white/10"
            >
              <span>ID: {freshUser.displayId || freshUser.id.slice(0, 8)}</span>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>

      </div>

      {/* Stats and Counters Row */}
      <div className="bg-[#FAF6EB] border-b border-[#E8DCC4]/40 py-3.5 px-4 sticky top-0 z-20">
        <div className="grid grid-cols-4 divide-x divide-x-reverse divide-[#E8DCC4]/50 text-center">
          
          <button 
            onClick={() => onNavigate?.('social_followers')}
            className="space-y-0.5 focus:outline-none hover:opacity-85 active:scale-95 transition-all cursor-pointer"
          >
            <strong className="text-sm font-black text-[#4A3E3D] block font-mono">{followersCount}</strong>
            <span className="text-[10px] text-slate-400 font-bold block">المتابعين</span>
          </button>

          <button 
            onClick={() => onNavigate?.('social_following')}
            className="space-y-0.5 focus:outline-none hover:opacity-85 active:scale-95 transition-all cursor-pointer"
          >
            <strong className="text-sm font-black text-[#4A3E3D] block font-mono">{followingCount}</strong>
            <span className="text-[10px] text-slate-400 font-bold block">يتابع</span>
          </button>

          <button 
            onClick={() => onNavigate?.('social_friends')}
            className="space-y-0.5 focus:outline-none hover:opacity-85 active:scale-95 transition-all cursor-pointer"
          >
            <strong className="text-sm font-black text-[#4A3E3D] block font-mono">{friendsCount}</strong>
            <span className="text-[10px] text-slate-400 font-bold block">الأصدقاء</span>
          </button>

          <div className="space-y-0.5">
            <strong className="text-sm font-black text-[#4A3E3D] block font-mono">
              {visitorsCount}
            </strong>
            <span className="text-[10px] text-slate-400 font-bold block">الزوار</span>
          </div>

        </div>
      </div>

      {/* Tabs Selector */}
      <div className="grid grid-cols-2 bg-white border-b border-[#E8DCC4]/40 sticky top-[61px] z-20">
        <button
          onClick={() => setActiveTab('profile')}
          className={`py-3.5 text-xs font-black tracking-wide transition-all border-b-2 ${
            activeTab === 'profile' 
              ? 'border-amber-500 text-amber-600' 
              : 'border-transparent text-slate-400 hover:text-[#4A3E3D]'
          }`}
        >
          الصفحة الشخصية
        </button>
        <button
          onClick={() => setActiveTab('moments')}
          className={`py-3.5 text-xs font-black tracking-wide transition-all border-b-2 flex justify-center items-center gap-1.5 ${
            activeTab === 'moments' 
              ? 'border-amber-500 text-amber-600' 
              : 'border-transparent text-slate-400 hover:text-[#4A3E3D]'
          }`}
        >
          <span>لحظات</span>
          <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 rounded-full font-mono text-slate-500 font-bold">
            {moments.length}
          </span>
        </button>
      </div>

      {/* Tab Content Container */}
      <div className={`p-4 space-y-4 ${isOwnProfile ? 'pb-16' : 'pb-32'}`}>
        
        {activeTab === 'profile' ? (
          <>
            {/* عني / التعريف */}
            <div className="bg-white rounded-3xl p-4.5 shadow-xs border border-[#E8DCC4]/40 space-y-2 text-right relative">
              <span className="text-[9px] text-amber-600 font-black bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/50 absolute -top-2.5 right-4">
                عني (السيرة الذاتية)
              </span>
              <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                {freshUser.bio || "يمكن أن تؤدي إضافة المعلومات والمؤهلات الفريدة إلى كسب المزيد من المتابعين والداعمين!"}
              </p>
            </div>

            {/* CP (Couple Partner) Section */}
            <div className="bg-white rounded-3xl p-4.5 shadow-xs border border-[#E8DCC4]/40 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                <h3 className="text-xs font-black text-[#4A3E3D] flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-red-500 animate-pulse fill-red-500" /> مركز الشريك والارتباط (CP)
                </h3>
                <span className="text-[9px] font-mono text-[#ec2d70] font-bold">تأثير هدية السي بي 💝</span>
              </div>

              {/* Romantic CP card background container with golden badge */}
              <div className="bg-gradient-to-l from-rose-50 via-pink-50/50 to-amber-50/30 rounded-2xl p-4 border border-rose-100 flex items-center justify-between relative overflow-hidden">
                {/* User avatar on left */}
                <div className="flex flex-col items-center gap-1 relative z-10">
                  <div className="w-12 h-12 rounded-full p-0.5 bg-white shadow-sm border border-slate-200">
                    <img 
                      src={freshUser.avatar || "https://api.dicebear.com/7.x/adventurer/svg"} 
                      alt="" 
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                  <span className="text-[9px] font-black text-slate-500 truncate max-w-[60px]">{freshUser.name}</span>
                </div>

                {/* Romantic Winged heart central badge */}
                <div className="flex flex-col items-center justify-center relative z-10">
                  <div className="relative animate-bounce duration-1000">
                    {/* Glowing wings background */}
                    <div className="absolute -inset-4 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-400/10 via-transparent to-transparent blur-md" />
                    <span className="text-3xl filter drop-shadow">💝</span>
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full font-mono border border-white">
                      Lv.{resolvedCpPartner ? '5' : '0'}
                    </span>
                  </div>
                  <p className="text-[9px] font-bold text-rose-500 font-mono mt-1">
                    {resolvedCpPartner ? `${resolvedCpDays} يوماً` : 'لا يوجد ارتباط'}
                  </p>
                </div>

                {/* Partner slot on right */}
                {resolvedCpPartner ? (
                  <div className="flex flex-col items-center gap-1 relative z-10">
                    <div className="w-12 h-12 rounded-full p-0.5 bg-white shadow-sm border border-slate-200 relative">
                      <img 
                        src={resolvedCpPartner.avatar || "https://api.dicebear.com/7.x/adventurer/svg"} 
                        alt="" 
                        className="w-full h-full rounded-full object-cover"
                      />
                      {isOwnProfile && (
                        <button 
                          onClick={handleDissolveCp}
                          className="absolute -top-1 -right-1 bg-red-500 text-white p-0.5 rounded-full hover:bg-red-600 transition cursor-pointer"
                          title="إنهاء الشراكة"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                    <span className="text-[9px] font-black text-slate-500 truncate max-w-[60px]">{resolvedCpPartner.name}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    {isOwnProfile ? (
                      <button 
                        onClick={() => setIsInviteCpOpen(true)}
                        className="w-12 h-12 rounded-full border-2 border-dashed border-rose-300 bg-rose-50 flex items-center justify-center text-rose-400 hover:bg-rose-100 hover:border-rose-400 transition-all active:scale-95 cursor-pointer"
                      >
                        <span className="text-xl font-bold">+</span>
                      </button>
                    ) : (
                      <div className="w-12 h-12 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300 text-xl">
                        🔒
                      </div>
                    )}
                    <span className="text-[8px] text-slate-400 font-black">انتظار الهدية</span>
                  </div>
                )}
              </div>
              {!resolvedCpPartner && isOwnProfile && (
                <p className="text-[9px] text-amber-600 font-bold leading-normal text-center">
                  💡 يتم الارتباط تلقائياً بمجرد إرسال هدية <span className="underline">عقد الارتباط (سي بي) 💝</span> للشخص المطلوب في غرفته الصوتية!
                </p>
              )}
            </div>

            {/* الأصدقاء المقربون (Close Friends) */}
            <div className="bg-white rounded-3xl p-4.5 shadow-xs border border-[#E8DCC4]/40 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-[#4A3E3D] flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-emerald-500 fill-emerald-400 animate-pulse" /> الأصدقاء المقربون ({resolvedCloseFriends.length}/30)
                </h3>
                <span className="text-[9px] text-slate-400 font-bold font-mono">خاتم الوفاء 💍</span>
              </div>

              {resolvedCloseFriends.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {resolvedCloseFriends.map(friend => (
                    <div key={friend.id} className="bg-[#FAF6EB]/40 rounded-2xl p-2 border border-[#E8DCC4]/30 flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <img 
                          src={friend.avatar || "https://api.dicebear.com/7.x/adventurer/svg"} 
                          alt="" 
                          className="w-8 h-8 rounded-full border border-slate-200 shrink-0"
                        />
                        <div className="text-right overflow-hidden">
                          <h4 className="text-[10px] font-black text-[#4A3E3D] truncate">{friend.name}</h4>
                          <span className="text-[8px] text-slate-400 block font-mono">Lv.{friend.level || 1}</span>
                        </div>
                      </div>
                      {isOwnProfile && (
                        <button 
                          onClick={() => handleRemoveCloseFriend(friend.id)}
                          className="text-[8px] font-bold text-red-500 hover:bg-red-50 p-1 rounded-lg transition shrink-0 cursor-pointer"
                          title="إلغاء الصديق المقرب"
                        >
                          إلغاء
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 space-y-1">
                  <p className="text-[10px] font-bold">لا يوجد أصدقاء مقربون حتى الآن</p>
                  {isOwnProfile && (
                    <p className="text-[9px] text-slate-400 leading-normal max-w-[200px] mx-auto">
                      قم بإرسال هدية <span className="font-bold text-emerald-600">خاتم الصداقة المقربة 💍</span> لأصدقائك في المجلس الصوتي ليصبحوا مقربين تلقائياً (تتسع لـ 30 شخصاً)!
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* دعم حسابي (Supporters List) */}
            <div 
              onClick={() => setIsSupportersModalOpen(true)}
              className="bg-white rounded-3xl p-4.5 shadow-xs border border-[#E8DCC4]/40 space-y-3.5 hover:border-amber-400 cursor-pointer transition-all active:scale-[0.99] group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 bg-gradient-to-r from-amber-500/10 to-transparent w-24 h-full pointer-events-none transform -skew-x-12" />
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-[#4A3E3D] flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-500 group-hover:rotate-12 transition-transform duration-300" /> دعم حسابي
                </h3>
                <span className="text-[9px] text-amber-600 font-bold bg-amber-50 border border-amber-200/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                  عرض الكل <ArrowRight className="w-2.5 h-2.5 rotate-180" />
                </span>
              </div>

              <div className="flex items-center justify-around pt-1">
                {top3Supporters.map((supporter, idx) => {
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <div key={supporter.userId} className="flex flex-col items-center gap-1 text-center relative">
                      <div className="relative">
                        <div className={`p-0.5 rounded-full ${
                          idx === 0 ? 'bg-amber-400' : idx === 1 ? 'bg-slate-300' : 'bg-amber-700'
                        }`}>
                          <img 
                            src={supporter.avatar || "https://api.dicebear.com/7.x/adventurer/svg"} 
                            alt="" 
                            className="w-11 h-11 rounded-full object-cover bg-slate-50 border border-white"
                          />
                        </div>
                        <span className="absolute -top-1.5 -right-1.5 text-xs drop-shadow">{medals[idx]}</span>
                      </div>
                      <span className="text-[9px] font-black text-slate-600 truncate max-w-[60px]">{supporter.name}</span>
                      <span className="text-[8px] font-bold text-slate-400 font-mono">{(supporter.amount || 0).toLocaleString()} 🪙</span>
                    </div>
                  );
                })}
                {top3Supporters.length === 0 && (
                  <p className="text-[10px] text-slate-400">لا يوجد داعمون مسجلون بعد.</p>
                )}
              </div>
            </div>

            {/* غرفتي (Voice Room Slot) */}
            <div className="bg-white rounded-3xl p-4.5 shadow-xs border border-[#E8DCC4]/40 space-y-3">
              <h3 className="text-xs font-black text-[#4A3E3D] flex items-center gap-1.5">
                <Music className="w-4 h-4 text-[#ec2d70]" /> {isOwnProfile ? 'غرفتي الصوتية' : 'غرفته الصوتية'}
              </h3>

              <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-2xl p-3.5 flex items-center justify-between shadow-xs">
                <div className="text-right space-y-1">
                  <h4 className="text-xs font-black">مجلس {freshUser.name} الصوتي 🎙️</h4>
                  <p className="text-[9px] text-purple-100 font-medium">أكبر تجمع صوتي لأروع المحادثات والمسابقات</p>
                </div>
                <button 
                  onClick={() => onNavigate?.('my_room')}
                  className="bg-white text-indigo-600 text-[10px] font-black py-1.5 px-4 rounded-xl shadow-xs hover:bg-purple-50 transition active:scale-95"
                >
                  دخول الغرفة
                </button>
              </div>
            </div>

          </>
        ) : (
          /* Moments (لحظات) View Tab */
          <div className="space-y-4">
            
            {/* Create Moment Form */}
            {isOwnProfile && (
              <form onSubmit={handlePostMoment} className="bg-white rounded-3xl p-4 shadow-xs border border-[#E8DCC4]/40 space-y-3">
                <h3 className="text-xs font-black text-[#4A3E3D] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> شارك لحظاتك اليومية للجميع!
                </h3>
                
                <div className="relative">
                  <textarea
                    value={newMomentText}
                    onChange={(e) => setNewMomentText(e.target.value)}
                    placeholder="ماذا يخطر في بالك الليلة؟ اكتب منشورك أو شارك كلمات أغنية..."
                    className="w-full bg-[#FAF6EB]/40 border border-[#E8DCC4]/30 rounded-2xl p-3 text-xs text-[#4A3E3D] placeholder-slate-400 outline-none focus:border-amber-400 focus:bg-white transition-all text-right h-24 resize-none"
                    maxLength={250}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <span className="text-xs text-slate-400 font-mono">{newMomentText.length}/250</span>
                  </div>
                  <button
                    type="submit"
                    disabled={!newMomentText.trim()}
                    className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:hover:bg-amber-500 text-slate-950 font-black text-xs py-1.5 px-4 rounded-xl flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>نشر اللحظة</span>
                  </button>
                </div>
              </form>
            )}

            {/* List of Moments */}
            <div className="space-y-3">
              {moments.map((moment) => (
                <div 
                  key={moment.id} 
                  className="bg-white rounded-3xl p-4 shadow-xs border border-[#E8DCC4]/30 space-y-3 text-right"
                >
                  {/* Moment Author Info */}
                  <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                    <div className="flex items-center gap-2">
                      <img 
                        src={freshUser.avatar || "https://api.dicebear.com/7.x/adventurer/svg"} 
                        alt="" 
                        className="w-8 h-8 rounded-full border border-slate-200"
                      />
                      <div className="text-right">
                        <h4 className="text-xs font-black text-[#4A3E3D]">{freshUser.name}</h4>
                        <span className="text-[8px] text-slate-400 font-bold block">{moment.timestamp}</span>
                      </div>
                    </div>
                    
                    {isOwnProfile && (
                      <button 
                        onClick={() => handleDeleteMoment(moment.id)}
                        className="text-slate-300 hover:text-red-500 transition p-1 rounded-full hover:bg-slate-50 cursor-pointer"
                        title="حذف المنشور"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Body Text */}
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold whitespace-pre-wrap">
                    {moment.text}
                  </p>

                  {/* Actions (Likes, Comments) */}
                  <div className="flex items-center gap-4 pt-1 text-[10px] text-slate-400 font-bold">
                    {(() => {
                      const hasLiked = currentUser?.id && moment.likedBy?.includes(currentUser.id);
                      return (
                        <button 
                          onClick={() => {
                            if (currentUser?.id) {
                              const currentLikedBy = moment.likedBy || [];
                              const alreadyLiked = currentLikedBy.includes(currentUser.id);
                              const updatedLikedBy = alreadyLiked 
                                ? currentLikedBy.filter(uid => uid !== currentUser.id)
                                : [...currentLikedBy, currentUser.id];
                              const newLikesCount = alreadyLiked 
                                ? Math.max(0, moment.likes - 1)
                                : moment.likes + 1;

                              const momentRef = doc(db, `users/${freshUser.id}/moments`, moment.id);
                              setDoc(momentRef, {
                                ...moment,
                                likes: newLikesCount,
                                likedBy: updatedLikedBy
                              }, { merge: true }).catch(console.error);
                            } else {
                              const currentLikedBy = moment.likedBy || [];
                              const alreadyLiked = currentLikedBy.includes("temp_user");
                              const updatedLikedBy = alreadyLiked 
                                ? currentLikedBy.filter(uid => uid !== "temp_user")
                                : [...currentLikedBy, "temp_user"];
                              const newLikesCount = alreadyLiked 
                                ? Math.max(0, moment.likes - 1)
                                : moment.likes + 1;

                              const updated = moments.map(m => m.id === moment.id ? { 
                                ...m, 
                                likes: newLikesCount,
                                likedBy: updatedLikedBy 
                              } : m);
                              setMoments(updated);
                            }
                          }}
                          className={`flex items-center gap-1 hover:text-red-500 transition cursor-pointer ${hasLiked ? 'text-rose-500' : 'text-slate-400'}`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${hasLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                          <span className="font-mono">{moment.likes}</span>
                        </button>
                      );
                    })()}

                    <span className="flex items-center gap-1">
                      <span>💬</span>
                      <span className="font-mono">{moment.commentsCount}</span>
                    </span>
                  </div>

                </div>
              ))}

              {moments.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <p className="text-xs font-bold">لا توجد لحظات منشورة حتى الآن!</p>
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* GORGEOUS PREMIUM FLOATING BOTTOM ACTION BAR FOR VISITOR MODE (Other user profiles) */}
      {!isOwnProfile && (
        <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-[#E8DCC4]/60 p-4 pb-safe flex gap-3.5 shadow-[0_-10px_35px_rgba(0,0,0,0.06)] z-[250] items-center justify-between">
          
          {/* Chat DM Button */}
          <button
            onClick={() => onSendPrivateMessage?.(freshUser)}
            className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 active:scale-95 text-white font-black text-xs py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
          >
            <MessageSquare className="w-4.5 h-4.5" />
            <span>الدردشة الخاصة 🔒</span>
          </button>

          {/* Send Gift Button */}
          <button
            onClick={() => onSendGift?.(freshUser)}
            className="flex-1 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black text-xs py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
          >
            <Gift className="w-4.5 h-4.5" />
            <span>إرسال هدية 🎁</span>
          </button>

          {/* Follow Toggle Button */}
          <button
            onClick={() => onToggleFollow?.(freshUser)}
            className={`w-28 font-black text-xs py-3.5 rounded-2xl active:scale-95 transition-all cursor-pointer border text-center ${
              isFollowing 
                ? 'bg-slate-100 text-slate-500 border-slate-200' 
                : 'bg-white text-purple-600 border-purple-500 hover:bg-purple-50'
            }`}
          >
            {isFollowing ? 'متابع ✓' : 'متابعة +'}
          </button>

          {/* Host Administration options panel (If viewer is host/owner of current active room) */}
          {isRoomHost && seatedSeat && (
            <div className="relative shrink-0">
              <button
                onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)}
                className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition active:scale-95 border border-slate-800 shadow-md cursor-pointer"
                title="إدارة مقعد المستخدم"
              >
                <Settings2 className="w-5 h-5 text-amber-400" />
              </button>

              {/* Host admin dialog absolute popup */}
              {isAdminMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsAdminMenuOpen(false)} />
                  <div className="absolute bottom-14 left-0 bg-slate-950 border border-slate-800 rounded-2xl p-2.5 w-44 shadow-2xl z-50 flex flex-col space-y-1.5 text-right animate-fade-in font-sans">
                    <span className="text-[9px] text-purple-400 font-bold block px-2 border-b border-slate-800 pb-1.5 mb-1 text-center">🛡️ إدارة المقعد (الإشراف)</span>
                    
                    <button
                      onClick={() => {
                        setIsAdminMenuOpen(false);
                        if (setSelectedSeatIndex && handleHostAction) {
                          setSelectedSeatIndex(seatedSeat.index);
                          handleHostAction('mute');
                        }
                      }}
                      className="w-full text-right text-slate-300 hover:text-white hover:bg-slate-900 px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition"
                    >
                      <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                      <span>{seatedSeat.isMuted ? 'تفعيل الصوت' : 'كتم المايك'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsAdminMenuOpen(false);
                        if (handleBanUser) handleBanUser(freshUser.id, 1);
                      }}
                      className="w-full text-right text-slate-300 hover:text-white hover:bg-slate-900 px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                      <span>طرد دقيقة</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsAdminMenuOpen(false);
                        if (handleBanUser) handleBanUser(freshUser.id, 60);
                      }}
                      className="w-full text-right text-slate-300 hover:text-white hover:bg-slate-900 px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                      <span>طرد ساعة</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsAdminMenuOpen(false);
                        if (handleBanUser) handleBanUser(freshUser.id, 60 * 24 * 7);
                      }}
                      className="w-full text-right text-slate-300 hover:text-white hover:bg-slate-900 px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                      <span>طرد أسبوع</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      )}

      {/* Invite CP Modal Backdrop overlay */}
      {isInviteCpOpen && (
        <div className="absolute inset-0 bg-black/65 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm border border-[#E8DCC4] shadow-2xl text-right space-y-4 animate-scale-up">
            <h4 className="text-xs font-black text-[#4A3E3D] flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
              <span>💝</span> اختيار شريك الارتباط (CP)
            </h4>
            
            <p className="text-[10px] text-slate-500 leading-relaxed">
              اختر شريكاً من بين الأصدقاء النشطين في مجالس صدى العرب للارتباط وتفعيل مستوى CP المشترك!
            </p>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {users.filter(u => u.id !== currentUser.id).map(user => (
                <button
                  key={user.id}
                  onClick={async () => {
                    if (currentUser?.id) {
                      await updateDoc(doc(db, "users", currentUser.id), { cpPartnerId: user.id, cpDays: 1 });
                      await updateDoc(doc(db, "users", user.id), { cpPartnerId: currentUser.id, cpDays: 1 });
                    }
                    setIsInviteCpOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-2 bg-slate-50 hover:bg-amber-50/50 rounded-xl border border-slate-100 transition text-right cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <img src={user.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=placeholder"} alt="" className="w-8 h-8 rounded-full border" />
                    <div>
                      <span className="text-[11px] font-black text-[#4A3E3D] block">{user.name}</span>
                      <span className="text-[8px] text-slate-400 font-bold block">مستوى {user.level || 1}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-amber-600 font-black">ارتباط</span>
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsInviteCpOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs py-2 px-4 rounded-xl cursor-pointer"
              >
                إلغاء
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Supporters Separate Full-Page View */}
      {isSupportersModalOpen && (
        <div className="absolute inset-0 bg-[#FAF6EB] z-50 flex flex-col h-full overflow-hidden" dir="rtl">
          {/* Header */}
          <div className="bg-white border-b border-[#E8DCC4]/50 p-4 shrink-0 flex items-center justify-between sticky top-0 z-20 shadow-xs">
            <button 
              onClick={() => setIsSupportersModalOpen(false)}
              className="w-9 h-9 bg-[#FAF6EB] hover:bg-amber-100/50 rounded-full flex items-center justify-center text-[#4A3E3D] transition-all active:scale-90 cursor-pointer border border-[#E8DCC4]/30"
              title="رجوع"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <div className="text-center flex-1">
              <h4 className="text-sm font-black text-[#4A3E3D] flex items-center gap-1.5 justify-center">
                <Crown className="w-4 h-4 text-amber-500 animate-pulse fill-amber-400" /> كبار الداعمين للحساب
              </h4>
              <p className="text-[9px] text-[#8C7A6B] font-bold">لوحة شرف الدعم والتقدير</p>
            </div>
            <div className="w-9 h-9" /> {/* spacer */}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* Elegant Info Banner */}
            <div className="bg-gradient-to-r from-amber-500/10 to-amber-600/5 rounded-2xl p-3 border border-amber-200/50 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white shrink-0 text-lg">
                👑
              </div>
              <div className="text-right">
                <h5 className="text-[11px] font-black text-[#4A3E3D]">كبار الداعمين للحساب (دعم حسابي)</h5>
                <p className="text-[9px] text-amber-800 font-bold leading-normal">
                  تظهر هذه القائمة أروع الداعمين الذين قدموا هدايا قيّمة لدعم الحساب في غرف البث والمجالس الصوتية!
                </p>
              </div>
            </div>

            {/* Podium for top 3 */}
            {resolvedSupporters.length > 0 && (
              <div className="bg-white rounded-3xl p-4 border border-[#E8DCC4]/40 shadow-xs space-y-3.5">
                <h3 className="text-xs font-black text-slate-400 text-center">🏆 منصة الصدارة 🏆</h3>
                
                <div className="grid grid-cols-3 gap-1 pt-2">
                  
                  {/* 2nd place (Silver) */}
                  <div className="flex flex-col items-center justify-end text-center pb-1">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full p-0.5 bg-slate-300 shadow-md">
                        <img 
                          src={resolvedSupporters[1]?.avatar || "https://api.dicebear.com/7.x/adventurer/svg"} 
                          alt="" 
                          className="w-full h-full rounded-full object-cover bg-white"
                        />
                      </div>
                      <span className="absolute -top-1.5 -right-1.5 text-base filter drop-shadow">🥈</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-700 truncate max-w-[80px] mt-1.5">
                      {resolvedSupporters[1]?.name || "فارغ"}
                    </span>
                    <span className="text-[9px] font-black text-slate-500 font-mono">
                      {resolvedSupporters[1] ? `${resolvedSupporters[1].amount.toLocaleString()} 🪙` : '-'}
                    </span>
                  </div>

                  {/* 1st place (Gold) */}
                  <div className="flex flex-col items-center justify-end text-center pb-2">
                    <div className="relative">
                      <div className="absolute -inset-2 bg-amber-400/20 blur-md rounded-full animate-pulse" />
                      <div className="w-16 h-16 rounded-full p-0.5 bg-amber-400 shadow-lg relative z-10">
                        <img 
                          src={resolvedSupporters[0]?.avatar || "https://api.dicebear.com/7.x/adventurer/svg"} 
                          alt="" 
                          className="w-full h-full rounded-full object-cover bg-white"
                        />
                      </div>
                      <span className="absolute -top-3 -right-1.5 text-xl filter drop-shadow relative z-20">👑</span>
                    </div>
                    <span className="text-xs font-black text-amber-800 truncate max-w-[95px] mt-2 relative z-10">
                      {resolvedSupporters[0]?.name || "فارغ"}
                    </span>
                    <span className="text-[10px] font-black text-amber-600 font-mono relative z-10">
                      {resolvedSupporters[0] ? `${resolvedSupporters[0].amount.toLocaleString()} 🪙` : '-'}
                    </span>
                  </div>

                  {/* 3rd place (Bronze) */}
                  <div className="flex flex-col items-center justify-end text-center pb-1">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full p-0.5 bg-amber-700/60 shadow-md">
                        <img 
                          src={resolvedSupporters[2]?.avatar || "https://api.dicebear.com/7.x/adventurer/svg"} 
                          alt="" 
                          className="w-full h-full rounded-full object-cover bg-white"
                        />
                      </div>
                      <span className="absolute -top-1.5 -right-1.5 text-base filter drop-shadow">🥉</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-700 truncate max-w-[80px] mt-1.5">
                      {resolvedSupporters[2]?.name || "فارغ"}
                    </span>
                    <span className="text-[9px] font-black text-amber-800 font-mono">
                      {resolvedSupporters[2] ? `${resolvedSupporters[2].amount.toLocaleString()} 🪙` : '-'}
                    </span>
                  </div>

                </div>
              </div>
            )}

            {/* Scrollable list for ranks 4 to end */}
            <div className="bg-white rounded-3xl p-4.5 border border-[#E8DCC4]/40 shadow-xs space-y-3">
              <h5 className="text-xs font-black text-slate-400 pb-1.5 text-right border-b border-slate-50 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> باقي الترتيب والداعمين ({resolvedSupporters.length}):
              </h5>
              
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {resolvedSupporters.length > 3 ? (
                  resolvedSupporters.slice(3).map((supporter, idx) => {
                    const rankNum = idx + 4;
                    return (
                      <div 
                        key={supporter.userId}
                        className="flex items-center justify-between p-3 bg-slate-50/60 rounded-2xl border border-slate-100 hover:bg-amber-50/20 transition-all hover:border-amber-200/50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-black text-slate-400 font-mono w-5">#{rankNum}</span>
                          <img 
                            src={supporter.avatar || "https://api.dicebear.com/7.x/adventurer/svg"} 
                            alt="" 
                            className="w-9 h-9 rounded-full border bg-white object-cover" 
                          />
                          <div className="text-right">
                            <span className="text-xs font-black text-[#4A3E3D] block">{supporter.name}</span>
                            <span className="text-[8px] text-slate-400 font-bold block">مستوى {users.find(u => u.id === supporter.userId)?.level || 1}</span>
                          </div>
                        </div>
                        <span className="text-xs font-black text-amber-600 font-mono bg-amber-50 border border-amber-200/30 px-2.5 py-1 rounded-xl">
                          {supporter.amount.toLocaleString()} 🪙
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-400 text-center py-6">لا يوجد داعمون إضافيون مسجلون بعد</p>
                )}
              </div>
            </div>

          </div>

          {/* Bottom sticky bar */}
          <div className="bg-white border-t border-[#E8DCC4]/50 p-4 shrink-0 shadow-lg">
            <button
              onClick={() => setIsSupportersModalOpen(false)}
              className="bg-amber-500 hover:bg-amber-600 text-white font-black text-xs py-3 rounded-2xl w-full text-center shadow-md active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>إغلاق لوحة الداعمين</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
