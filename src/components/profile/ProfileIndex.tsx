import WalletView from './WalletView';
import React, { useState, useEffect } from 'react';
import { AppUser } from '../../types';
import MainMenuView from './MainMenuView';
import SettingsView from './SettingsView';
import EditProfileView from './EditProfileView';
import LevelView from './LevelView';
import AccessoriesView from './AccessoriesView';
import SupportView from './SupportView';
import AccountLinkView from './AccountLinkView';
import VipView from './VipView';
import CoinAgentPortalView from './CoinAgentPortalView';
import AgencyPortalView from './AgencyPortalView';
import SocialListView from './SocialListView';
import FullUserProfileView from './FullUserProfileView';
import MyPostsView from './MyPostsView';
import DailyCheckInView from './DailyCheckInView';
import StoreView from './StoreView';
import InstructionsView from './InstructionsView';
import InviteFriendView from './InviteFriendView';
import HostMissionView from './HostMissionView';

interface Props {
  setCurrentScreen: (val: string) => void;
  currentUser: AppUser | null;
  users: AppUser[];
  onToggleFollow: (targetUser: AppUser) => Promise<void>;
  supportTickets: any[];
  setIsSupportAdminModalOpen: (val: boolean) => void;
  setIsAdminManageModalOpen: (val: boolean) => void;
  setSupportChatOpen: (val: boolean) => void;
  setIsProfileModalOpen: (val: boolean) => void;
  setSelectedProfileUser: (val: AppUser | null) => void;
  setIsEditingBio: (val: boolean) => void;
  setBioEditValue: (val: string) => void;
  onEnterMyRoom: () => void;
}

export default function ProfileIndex(props: Props) {
  const [activeView, setActiveView] = useState<string>('main');
  const [initialLevelTab, setInitialLevelTab] = useState<'wealth' | 'popular'>('wealth');
  const [initialSocialTab, setInitialSocialTab] = useState<'friends' | 'followers' | 'following' | 'visitors'>('friends');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const container = document.getElementById('smartphone-screen') || document.querySelector('.overflow-y-auto');
    if (container) {
      container.scrollTop = 0;
    }
    document.querySelectorAll('.overflow-y-auto, .overflow-auto').forEach(el => {
      el.scrollTop = 0;
    });
  }, [activeView]);

  useEffect(() => {
    const handleOpenWallet = () => {
      setActiveView('wallet');
    };
    window.addEventListener('OPEN_WALLET_VIEW', handleOpenWallet);
    return () => window.removeEventListener('OPEN_WALLET_VIEW', handleOpenWallet);
  }, []);

  const handleNavigate = (view: string) => {
    if (view === 'my_room') {
      props.onEnterMyRoom();
    } else if (view === 'level_wealth') {
      setInitialLevelTab('wealth');
      setActiveView('level');
    } else if (view === 'level_popular') {
      setInitialLevelTab('popular');
      setActiveView('level');
    } else if (view === 'social_friends') {
      setInitialSocialTab('friends');
      setActiveView('social_lists');
    } else if (view === 'social_followers') {
      setInitialSocialTab('followers');
      setActiveView('social_lists');
    } else if (view === 'social_following') {
      setInitialSocialTab('following');
      setActiveView('social_lists');
    } else if (view === 'social_visitors') {
      setInitialSocialTab('visitors');
      setActiveView('social_lists');
    } else {
      setActiveView(view);
    }
  };

  const renderView = () => {
    switch (activeView) {
      case 'wallet':
        return <WalletView onBack={() => setActiveView('main')} currentUser={props.currentUser} users={props.users} />;
      case 'main':
        return <MainMenuView onNavigate={handleNavigate} {...props} />;
      case 'settings':
        return <SettingsView onBack={() => setActiveView('main')} currentUser={props.currentUser} />;
      case 'edit_profile':
        return <EditProfileView onBack={() => setActiveView('main')} {...props} />;
      case 'level':
        return <LevelView onBack={() => setActiveView('main')} currentUser={props.currentUser} initialTab={initialLevelTab} />;
      case 'accessories':
        return <AccessoriesView onBack={() => setActiveView('main')} currentUser={props.currentUser} />;
      case 'support':
        return <SupportView onBack={() => setActiveView('main')} {...props} />;
      case 'link_account':
        return <AccountLinkView onBack={() => setActiveView('main')} currentUser={props.currentUser} />;
      case 'vip':
        return (
          <div className="flex flex-col items-center justify-center h-full space-y-4 bg-[#0d0c10] text-slate-100 p-6 text-center" dir="rtl">
            <span className="text-5xl animate-bounce">👑</span>
            <h3 className="text-lg font-black text-amber-400">عضوية VIP الفاخرة</h3>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed font-semibold">هذه الصفحة قيد التطوير والعمل حالياً لتوفير أرقى المميزات لكم قريباً!</p>
            <button onClick={() => setActiveView('main')} className="bg-amber-500 text-slate-950 px-6 py-2.5 rounded-xl font-bold transition hover:bg-amber-400 active:scale-95 text-xs shadow-lg shadow-amber-500/20">العودة</button>
          </div>
        );
      case 'coin_agent_portal':
        return <CoinAgentPortalView onBack={() => setActiveView('main')} currentUser={props.currentUser} users={props.users} />;
      case 'agency_portal':
        return <AgencyPortalView onBack={() => setActiveView('main')} currentUser={props.currentUser} users={props.users} />;
      case 'social_lists':
        return (
          <SocialListView 
            onBack={() => setActiveView('main')} 
            currentUser={props.currentUser} 
            users={props.users} 
            onToggleFollow={props.onToggleFollow}
            setIsProfileModalOpen={props.setIsProfileModalOpen}
            setSelectedProfileUser={props.setSelectedProfileUser}
            initialTab={initialSocialTab}
          />
        );
      case 'full_profile':
        return (
          <FullUserProfileView 
            onBack={() => setActiveView('main')} 
            currentUser={props.currentUser} 
            users={props.users} 
            onNavigate={handleNavigate}
          />
        );
      case 'my_posts':
        return <MyPostsView onBack={() => setActiveView('main')} currentUser={props.currentUser} />;
      case 'login':
        return <DailyCheckInView onBack={() => setActiveView('main')} currentUser={props.currentUser} />;
      case 'store':
        return (
          <div className="flex flex-col items-center justify-center h-full space-y-4 bg-[#080710] text-white p-6 text-center" dir="rtl">
            <span className="text-5xl animate-bounce">🏪</span>
            <h3 className="text-lg font-black text-pink-400">متجر صدى العرب الفاخر</h3>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed font-semibold">هذا المتجر قيد التطوير حالياً لتوفير الإكسسوارات والملحقات الفاخرة لكم قريباً!</p>
            <button onClick={() => setActiveView('main')} className="bg-gradient-to-l from-indigo-500 to-pink-500 text-white px-6 py-2.5 rounded-xl font-bold transition active:scale-95 text-xs shadow-lg shadow-pink-500/20">العودة</button>
          </div>
        );
      case 'instructions':
        return <InstructionsView onBack={() => setActiveView('main')} />;
      case 'invite_friend':
        return <InviteFriendView onBack={() => setActiveView('main')} currentUser={props.currentUser} />;
      case 'host_mission':
        return <HostMissionView onBack={() => setActiveView('main')} currentUser={props.currentUser} users={props.users} />;
      default:
        // Handle unimplemented routes by returning to main
        return (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <p className="text-slate-500 font-bold">هذه الصفحة قيد التطوير</p>
            <button onClick={() => setActiveView('main')} className="bg-amber-500 text-white px-4 py-2 rounded-full font-bold">العودة</button>
          </div>
        );
    }
  };

  return (
    <div className="w-full bg-slate-50 flex flex-col relative animate-fade-in">
      {renderView()}
    </div>
  );
}
