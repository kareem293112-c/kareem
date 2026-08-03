import React, { useState, useEffect } from 'react';
import { ArrowRight, Search, UserMinus, UserPlus, Users } from 'lucide-react';
import { AppUser } from '../../types';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';

interface Props {
  onBack: () => void;
  currentUser: AppUser | null;
  users: AppUser[];
  onToggleFollow: (targetUser: AppUser) => Promise<void>;
  setIsProfileModalOpen: (val: boolean) => void;
  setSelectedProfileUser: (val: AppUser | null) => void;
  initialTab?: 'friends' | 'followers' | 'following' | 'visitors';
}

export default function SocialListView({ 
  onBack, 
  currentUser, 
  users, 
  onToggleFollow, 
  setIsProfileModalOpen, 
  setSelectedProfileUser,
  initialTab
}: Props) {
  const [activeTab, setActiveTab] = useState<'friends' | 'followers' | 'following' | 'visitors'>(initialTab || 'friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [visitors, setVisitors] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const visitorsRef = collection(db, 'users', currentUser.id, 'visitors');
    const q = query(visitorsRef, orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data());
      setVisitors(list);
    }, (err) => {
      console.warn("Firestore index might be building, using client-side sort: ", err);
      const unsubscribeFallback = onSnapshot(visitorsRef, (snapshot) => {
        const list = snapshot.docs.map(doc => doc.data());
        list.sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        setVisitors(list);
      });
      return () => unsubscribeFallback();
    });

    return () => unsubscribe();
  }, [currentUser?.id]);

  if (!currentUser) return null;

  // Get real-time lists based on true Firestore data
  const followingList = users.filter(u => currentUser.following?.includes(u.id));
  const followersList = users.filter(u => currentUser.followers?.includes(u.id));
  
  // Friends are mutual follows
  const friendsList = users.filter(u => 
    currentUser.following?.includes(u.id) && 
    currentUser.followers?.includes(u.id)
  );

  // Pick list based on active tab
  let currentList: any[] = [];
  if (activeTab === 'friends') currentList = friendsList;
  else if (activeTab === 'followers') currentList = followersList;
  else if (activeTab === 'following') currentList = followingList;
  else if (activeTab === 'visitors') currentList = visitors;

  // Filter list by search query
  const filteredList = currentList.filter(u => 
    (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (u.displayId && u.displayId.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleUserClick = (user: any) => {
    const fullUser = users.find(u => u.id === user.id) || user;
    setSelectedProfileUser(fullUser);
    setIsProfileModalOpen(true);
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

  const formatVisitTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'الآن';
      if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `منذ ${diffHours} ساعة`;
      return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#FAF6EB] text-[#4A3E3D]" dir="rtl">
      
      {/* Header */}
      <div className="bg-gradient-to-l from-[#d91b5c] via-[#ec2d70] to-[#f39c12] text-white pt-8 pb-4 px-4 flex items-center justify-between shadow-md">
        <button 
          onClick={onBack} 
          className="p-1.5 hover:bg-white/10 rounded-full transition active:scale-95 flex items-center justify-center cursor-pointer"
        >
          <ArrowRight className="w-5 h-5 text-white" />
        </button>
        <h2 className="text-sm font-black tracking-wide">قائمة الأصدقاء والمتابعين</h2>
        <div className="w-8 h-8" /> {/* Spacer */}
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 border-b border-[#E8DCC4] bg-[#FAF6EB] sticky top-0 z-10">
        <button
          onClick={() => { setActiveTab('friends'); setSearchQuery(''); }}
          className={`py-3.5 text-xs font-black transition-all border-b-2 flex flex-col items-center gap-0.5 cursor-pointer ${
            activeTab === 'friends' 
              ? 'border-[#d91b5c] text-[#d91b5c]' 
              : 'border-transparent text-slate-500 hover:text-[#4A3E3D]'
          }`}
        >
          <span className="text-xs">الأصدقاء</span>
          <span className="text-[10px] font-mono bg-slate-200/50 px-2 py-0.5 rounded-full font-bold">
            {friendsList.length}
          </span>
        </button>

        <button
          onClick={() => { setActiveTab('followers'); setSearchQuery(''); }}
          className={`py-3.5 text-xs font-black transition-all border-b-2 flex flex-col items-center gap-0.5 cursor-pointer ${
            activeTab === 'followers' 
              ? 'border-[#d91b5c] text-[#d91b5c]' 
              : 'border-transparent text-slate-500 hover:text-[#4A3E3D]'
          }`}
        >
          <span className="text-xs">المتابعون</span>
          <span className="text-[10px] font-mono bg-slate-200/50 px-2 py-0.5 rounded-full font-bold">
            {followersList.length}
          </span>
        </button>

        <button
          onClick={() => { setActiveTab('following'); setSearchQuery(''); }}
          className={`py-3.5 text-xs font-black transition-all border-b-2 flex flex-col items-center gap-0.5 cursor-pointer ${
            activeTab === 'following' 
              ? 'border-[#d91b5c] text-[#d91b5c]' 
              : 'border-transparent text-slate-500 hover:text-[#4A3E3D]'
          }`}
        >
          <span className="text-xs">يتابع</span>
          <span className="text-[10px] font-mono bg-slate-200/50 px-2 py-0.5 rounded-full font-bold">
            {followingList.length}
          </span>
        </button>

        <button
          onClick={() => { setActiveTab('visitors'); setSearchQuery(''); }}
          className={`py-3.5 text-xs font-black transition-all border-b-2 flex flex-col items-center gap-0.5 cursor-pointer ${
            activeTab === 'visitors' 
              ? 'border-[#d91b5c] text-[#d91b5c]' 
              : 'border-transparent text-slate-500 hover:text-[#4A3E3D]'
          }`}
        >
          <span className="text-xs">الزوار</span>
          <span className="text-[10px] font-mono bg-[#d91b5c]/10 text-[#d91b5c] px-2 py-0.5 rounded-full font-bold">
            {visitors.length}
          </span>
        </button>
      </div>

      {/* Search bar */}
      <div className="p-3 bg-white border-b border-[#E8DCC4]/50">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو برقم المعرّف (ID)..."
            className="w-full bg-[#FAF6EB]/60 border border-[#E8DCC4] rounded-2xl py-2 px-3 pr-10 text-xs text-[#4A3E3D] placeholder-slate-400 outline-none focus:border-[#d91b5c] text-right font-sans"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* User list */}
      <div className="flex-grow overflow-y-auto p-3">
        {filteredList.length > 0 ? (
          activeTab === 'visitors' ? (
            <div className="grid grid-cols-2 gap-3.5">
              {filteredList.map((user) => {
                const isFollowingUser = currentUser.following?.includes(user.id);
                const genderColor = user.gender === 'female' ? 'border-[#ff4d94]' : 'border-[#1b9cd9]';

                return (
                  <div 
                    key={user.id} 
                    className="relative bg-white border border-[#E8DCC4]/50 rounded-3xl p-3.5 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-all hover:border-[#d91b5c]/30 group cursor-pointer overflow-hidden"
                    onClick={() => handleUserClick(user)}
                  >
                    {/* Top Right Action: Follow Indicator or Mini Button */}
                    <div className="absolute top-2.5 right-2.5 z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFollow(user);
                        }}
                        className={`p-1.5 rounded-full transition-all active:scale-90 cursor-pointer ${
                          isFollowingUser 
                            ? 'bg-slate-100 text-slate-400 hover:text-slate-600' 
                            : 'bg-[#d91b5c]/10 text-[#d91b5c] hover:bg-[#d91b5c] hover:text-white'
                        }`}
                        title={isFollowingUser ? 'متابع' : 'متابعة'}
                      >
                        {isFollowingUser ? (
                          <UserMinus className="w-3.5 h-3.5" />
                        ) : (
                          <UserPlus className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Left corner: Country badge */}
                    <div className="absolute top-2.5 left-2.5 bg-slate-50 border border-slate-100 rounded-full px-1.5 py-0.5 text-[10px] shadow-sm">
                      {getCountryFlag(user.country)}
                    </div>

                    {/* Avatar with luxury animated glowing borders */}
                    <div className="relative mt-2 mb-3">
                      <div className={`w-18 h-18 rounded-full p-0.5 border-2 ${genderColor} shadow-md group-hover:scale-105 transition-transform duration-300 relative`}>
                        <img 
                          src={user.avatar || "https://api.dicebear.com/7.x/adventurer/svg"} 
                          alt="" 
                          className="w-full h-full rounded-full object-cover bg-slate-100"
                        />
                      </div>
                      
                      {/* Level Badge floating perfectly */}
                      <span className="absolute -bottom-1 right-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full font-mono border border-white shadow-sm">
                        LV.{user.level || 1}
                      </span>

                      {/* Gender Symbol Dot */}
                      <span className={`absolute -bottom-1 left-2 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white border border-white shadow-sm ${user.gender === 'female' ? 'bg-[#ff4d94]' : 'bg-[#1b9cd9]'}`}>
                        {user.gender === 'female' ? '♀' : '♂'}
                      </span>
                    </div>

                    {/* User Info */}
                    <div className="space-y-1 w-full">
                      <div className="flex items-center justify-center gap-1">
                        <h3 className="text-xs font-black text-[#4A3E3D] truncate max-w-[100px]">{user.name}</h3>
                        {user.role === 'admin' && (
                          <span className="bg-red-500 text-white text-[7px] font-black px-1 py-0.5 rounded">إدارة</span>
                        )}
                      </div>
                      <p className="text-[8px] text-slate-400 font-mono tracking-wide">ID: {user.displayId || user.id.slice(0, 8)}</p>
                    </div>

                    {/* Divider line */}
                    <div className="w-full border-t border-slate-100 my-2.5"></div>

                    {/* Visit Timestamp display - Ultra modern with precise relative & exact clock time */}
                    <div className="w-full">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-2xl bg-[#d91b5c]/5 text-[#d91b5c] text-[9px] font-black tracking-tight leading-none">
                        <span className="animate-pulse">👁️</span>
                        <span>{formatVisitTime(user.timestamp)}</span>
                      </span>
                      {user.timestamp && (
                        <p className="text-[8px] text-slate-400 font-bold mt-1 font-mono">
                          {new Date(user.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredList.map((user) => {
                const isFollowingUser = currentUser.following?.includes(user.id);
                const isFollowerOfMe = currentUser.followers?.includes(user.id);
                const isMutualFriend = isFollowingUser && isFollowerOfMe;

                return (
                  <div 
                    key={user.id} 
                    className="bg-white border border-[#E8DCC4]/40 rounded-2xl p-3 flex items-center justify-between shadow-sm hover:shadow transition-all hover:border-[#E8DCC4]/70"
                  >
                    {/* User avatar and info */}
                    <div 
                      className="flex items-center gap-3 flex-1 cursor-pointer"
                      onClick={() => handleUserClick(user)}
                    >
                      <div className="relative">
                        <img 
                          src={user.avatar || "https://api.dicebear.com/7.x/adventurer/svg"} 
                          alt="" 
                          className="w-11 h-11 rounded-full object-cover border border-[#E8DCC4]/60 bg-slate-50"
                        />
                        <span className="absolute -bottom-1 -left-1 bg-amber-500 text-slate-950 text-[7px] font-black px-1 py-0.5 rounded-full font-mono border border-white">
                          LV.{user.level}
                        </span>
                      </div>

                      <div className="space-y-0.5 text-right flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-xs font-black text-[#4A3E3D] truncate">{user.name}</h3>
                          <span className="text-[10px]">{getCountryFlag(user.country)}</span>
                          {user.role === 'admin' && (
                            <span className="bg-red-500 text-white text-[7px] font-black px-1 rounded">إدارة</span>
                          )}
                        </div>
                        <p className="text-[9px] text-slate-400 font-mono">ID: {user.displayId || user.id.slice(0, 8)}</p>
                        {user.bio && (
                          <p className="text-[9px] text-slate-400 truncate max-w-[160px] font-semibold mt-0.5">{user.bio}</p>
                        )}
                      </div>
                    </div>

                    {/* Follow/Unfollow action button */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onToggleFollow(user)}
                        className={`text-[9px] font-black py-1.5 px-3.5 rounded-xl flex items-center gap-1 transition-all active:scale-95 cursor-pointer ${
                          isFollowingUser 
                            ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' 
                            : 'bg-[#d91b5c] text-white hover:bg-[#c2144e]'
                        }`}
                      >
                        {isFollowingUser ? (
                          <>
                            <UserMinus className="w-3.5 h-3.5" />
                            <span>إلغاء المتابعة</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>متابعة</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3.5">
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-slate-300 border border-[#E8DCC4]/50 shadow-inner">
              <Users className="w-7 h-7 text-slate-400/80" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-black text-slate-500">
                {searchQuery ? "لم يتم العثور على نتائج للبحث!" : "القائمة فارغة حالياً"}
              </p>
              <p className="text-[10px] text-slate-400 max-w-[200px] leading-relaxed font-semibold">
                {activeTab === 'friends' 
                  ? "الأصدقاء هم الأشخاص الذين يتابعونك وتتابعهم بالمثل." 
                  : activeTab === 'followers' 
                    ? "المتابعون هم الذين اختاروا متابعة ملفك الشخصي ومجالسك." 
                    : activeTab === 'following'
                      ? "الأعضاء الذين قمت بمتابعتهم لتصلك تحديثاتهم وغرفهم."
                      : "لم يقم أحد بزيارة ملفك الشخصي بعد. شارك غرفتك ومجالسك الصوتية لجذب المزيد من الزوار!"}
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
