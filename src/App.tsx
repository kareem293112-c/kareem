import ProfileIndex from "./components/profile/ProfileIndex"
import FullUserProfileView from "./components/profile/FullUserProfileView"
import GiftTriggerButton from "./components/GiftTriggerButton"
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';

import {
  Smartphone,
  Search,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  Plus,
  Send,
  Coins,
  Award,
  ShieldAlert,
  AlertTriangle,
  AtSign,
  Check,
  Copy,
  FileText,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  User,
  MessageSquare,
  Heart,
  Trash2,
  Camera,
  Music,
  Settings,
  LogOut,
  Minimize2,
  Key,
  RefreshCw,
  Play,
  Flame,
  Zap,
  Sparkles,
  Clock,
  ShieldCheck,
  Shield,
  Info,
  Phone,
  PhoneOff,
  Mail,
  UserCheck,
  Wifi,
  Mic,
  MicOff,
  Sofa,
  UserX,
  Briefcase,
  Gem,
  ChevronLeft,
  ChevronUp,
  ExternalLink,
  X,
  Shuffle,
  Calendar
} from 'lucide-react';
import {
  deriveRoomKey,
  encryptMessage,
  decryptMessage,
  generateRSAKeyPair,
  exportPublicKey
} from './lib/crypto';
import { AgoraEngineManager, uidToNumeric } from './services/agora/engine';
import { getXpForNextUserLevel, getXpForNextRoomLevel } from './lib/utils';
import { getLevelFromXp, getLevelProgress } from './lib/levelMath';
import { formatCompactNumber } from './utils/format';
import { GIFTS, INITIAL_GIFT_BALANCE } from './data/gifts';
import FlyingGiftsOverlay from './components/FlyingGiftsOverlay';
import SVGA from 'svgaplayerweb';
import { DART_BLUEPRINTS } from './data/dartBlueprints';
import { AppUser, VoiceRoom, Gift, AgentTransferLog, FolderNode, VoiceSeat, PrivateMessage, SupportTicket, SupportTicketMessage, isUserOnline } from './types';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { saveAgencyData, toggleUserAgentStatus, updateUserWhatsapp } from './services/agencyService';
import { updateAuthorizedCoinAgent, processAgentTransfer, rechargeAgentCoins } from './services/walletService';
import { soundService } from './services/soundService';
import { collection, onSnapshot, addDoc, query, updateDoc, doc, setDoc, deleteDoc, runTransaction, increment, serverTimestamp, where, getDoc, getDocs, orderBy, arrayUnion, arrayRemove, limit, writeBatch } from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged,
  signOut,
  signInAnonymously,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from 'firebase/auth';

// استخدام Firebase Firestore للبيانات المباشرة بدلاً من الـ API والـ WebSocket القديم


// Interactive React subcomponent to dynamically decrypt and display messages safely
const EncryptedMessageText = ({ 
  ciphertext, 
  iv, 
  derivedKey, 
  showCiphertext,
  fallbackText 
}: { 
  ciphertext: string; 
  iv: string; 
  derivedKey: CryptoKey | null; 
  showCiphertext: boolean;
  fallbackText: string;
}) => {
  const [decryptedText, setDecryptedText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!derivedKey) {
      setDecryptedText(null);
      setFailed(true);
      return  
}
    let active = true;
    decryptMessage(ciphertext, iv, derivedKey)
      .then((decrypted) => {
        if (active) {
          setDecryptedText(decrypted);
          setFailed(false)}
      })
      .catch(() => {
        if (active) {
          setDecryptedText(null);
          setFailed(true);
        }
      });
      
    return () => {
      active = false;
    };
  }, [ciphertext, iv, derivedKey]);

  if (showCiphertext) {
    return (
      <span className="font-mono text-[7px] text-slate-400 break-all leading-tight tracking-wider select-all">
        {ciphertext.substring(0, 32)}...
      </span>
    );
  }

  if (failed) {
    return (
      <span className="text-red-400 font-extrabold text-[8px] flex items-center gap-1">
        <span>⚠️ [فك تشفير غير متاح]</span>
      </span>
    );
  }

  if (decryptedText === null) {
    return <span className="text-slate-400 italic text-[8px]">جاري فك التشفير...</span>;
  }

  return <span className="text-emerald-400 font-bold text-[9px]">{decryptedText}</span>;
};

const padSeats = (seats: VoiceSeat[] | undefined | null): VoiceSeat[] => {
  const s = seats || [];
  const hasIndexTen = s?.some(item => item.index === 10);
  const hasIndexZero = s?.some(item => item.index === 0);
  const isOneBased = hasIndexTen || !hasIndexZero;

  return Array.from({ length: 10 }, (_, idx) => {
    const targetIndex = isOneBased ? idx + 1 : idx;
    const matched = s?.find(item => item.index === targetIndex);
    if (matched) {
      return {
        ...matched,
        index: idx + 1
      };
    }
    return {
      index: idx + 1,
      userId: null,
      isMuted: false,
      isLocked: false
    };
  });
};

const RoomActiveUsersCount = ({ roomId, initialCount }: { roomId: string, initialCount: number }) => {
  const [realParticipantsCount, setRealParticipantsCount] = useState<number>(initialCount || 0);

  useEffect(() => {
    const participantsRef = collection(db, "voice_rooms", roomId, "participants");
    const q = query(participantsRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRealParticipantsCount(snapshot.docs.length);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `voice_rooms/${roomId}/participants`);
    });
    return () => unsubscribe();
  }, [roomId]);

  return <>{realParticipantsCount}</>;
};

const generate8CharInviteCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const getNextDisplayId = async (): Promise<string> => {
  try {
    const q = query(collection(db, "users"));
    const querySnapshot = await getDocs(q);
    
    let maxId = 50499; // Starts at 50500 if no sequential IDs exist
    
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.displayId) {
        const idNum = parseInt(data.displayId, 10);
        // Only consider standard sequential IDs (between 50500 and 99999)
        if (!isNaN(idNum) && idNum >= 50500 && idNum < 100000) {
          if (idNum > maxId) {
            maxId = idNum;
          }
        }
      }
    });
    
    let nextId = maxId + 1;
    
    // Ensure uniqueness by double-checking if there's any user with this ID
    let unique = false;
    while (!unique) {
      const idStr = nextId.toString();
      const duplicateExists = querySnapshot.docs?.some(docSnap => docSnap.data().displayId === idStr);
      if (!duplicateExists) {
        unique = true;
      } else {
        nextId++;
      }
    }
    
    // Update the counter doc just to keep it in sync for general awareness
    try {
      const counterRef = doc(db, 'system', 'counters');
      await setDoc(counterRef, { userDisplayId: nextId }, { merge: true });
    } catch (e) {
      console.error("Failed to update counter doc:", e);
    }
    
    return nextId.toString();
  } catch (error) {
    console.error("Error generating next display ID:", error);
    // Fallback in case of database errors: return a random 5-digit ID starting from 50500
    return (50500 + Math.floor(Math.random() * 10000)).toString();
  }
};

// Default styling variables for real-time sizing of VIP frames and SVIP badges
const DEFAULT_VIP_CONFIG = {
  frames: {
    1: { width: 44, height: 44, scale: 1.0 },
    2: { width: 44, height: 44, scale: 1.0 },
    3: { width: 44, height: 44, scale: 1.0 },
    4: { width: 44, height: 44, scale: 1.0 },
    5: { width: 44, height: 44, scale: 1.0 }
  },
  badges: {
    1: { width: 150, height: 150, scale: 1.0 },
    2: { width: 150, height: 150, scale: 1.0 },
    3: { width: 150, height: 150, scale: 1.0 },
    4: { width: 150, height: 150, scale: 1.0 },
    5: { width: 150, height: 150, scale: 1.0 }
  }
};

const VipSizingTool = ({ 
  vipConfig, 
  onUpdateConfig 
}: { 
  vipConfig: any; 
  onUpdateConfig: (type: 'frames' | 'badges', level: number, field: 'width' | 'height' | 'scale', value: number) => void;
}) => {
  const [selectedType, setSelectedType] = useState<'frames' | 'badges'>('frames');
  const [selectedLevel, setSelectedLevel] = useState<number>(1);

  const activeItem = vipConfig?.[selectedType]?.[selectedLevel] || { width: 44, height: 44, scale: 1.0 };

  const handleSliderChange = (field: 'width' | 'height' | 'scale', val: number) => {
    onUpdateConfig(selectedType, selectedLevel, field, val);
  };

  return (
    <div className="space-y-4 text-slate-200">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setSelectedType('frames')}
          className={`py-2 rounded-xl text-[11px] font-black transition-all ${
            selectedType === 'frames'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-white/5 text-slate-400 hover:bg-white/10'
          }`}
        >
          🖼️ إطارات الـ VIP (المقاعد)
        </button>
        <button
          onClick={() => setSelectedType('badges')}
          className={`py-2 rounded-xl text-[11px] font-black transition-all ${
            selectedType === 'badges'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-white/5 text-slate-400 hover:bg-white/10'
          }`}
        >
          🏅 شارات الـ SVIP (الملف)
        </button>
      </div>

      <div className="flex justify-between items-center bg-white/5 p-1.5 rounded-2xl border border-white/5" dir="rtl">
        <span className="text-[10px] font-bold text-slate-400 pr-2">اختر المستوى:</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSelectedLevel(lvl)}
              className={`w-7 h-7 rounded-lg text-xs font-black transition-all ${
                selectedLevel === lvl
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-4" dir="rtl">
        <div className="flex justify-between items-center text-[10px] text-purple-300 font-bold">
          <span>{selectedType === 'frames' ? `إطار VIP مستوى ${selectedLevel}` : `شارة SVIP مستوى ${selectedLevel}`}</span>
          <span>تعديل في الوقت الفعلي</span>
        </div>

        {/* Width Control */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-slate-400">العرض (Width)</span>
            <span className="text-amber-400 font-mono">{activeItem.width}px</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="20"
              max="350"
              value={activeItem.width}
              onChange={(e) => handleSliderChange('width', parseInt(e.target.value))}
              className="flex-grow accent-purple-500 bg-slate-950/60 rounded-lg h-1.5 appearance-none cursor-pointer"
            />
            <input
              type="number"
              min="20"
              max="350"
              value={activeItem.width}
              onChange={(e) => {
                const val = Math.max(20, Math.min(350, parseInt(e.target.value) || 20));
                handleSliderChange('width', val);
              }}
              className="w-14 bg-slate-950/60 text-slate-200 text-center font-mono text-xs rounded-lg p-1 border border-white/10 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Height Control */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-slate-400">الارتفاع (Height)</span>
            <span className="text-amber-400 font-mono">{activeItem.height}px</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="20"
              max="350"
              value={activeItem.height}
              onChange={(e) => handleSliderChange('height', parseInt(e.target.value))}
              className="flex-grow accent-purple-500 bg-slate-950/60 rounded-lg h-1.5 appearance-none cursor-pointer"
            />
            <input
              type="number"
              min="20"
              max="350"
              value={activeItem.height}
              onChange={(e) => {
                const val = Math.max(20, Math.min(350, parseInt(e.target.value) || 20));
                handleSliderChange('height', val);
              }}
              className="w-14 bg-slate-950/60 text-slate-200 text-center font-mono text-xs rounded-lg p-1 border border-white/10 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Scale Control */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-slate-400">مقياس الحجم (Scale)</span>
            <span className="text-amber-400 font-mono">x{activeItem.scale}</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.05"
              value={activeItem.scale}
              onChange={(e) => handleSliderChange('scale', parseFloat(e.target.value))}
              className="flex-grow accent-purple-500 bg-slate-950/60 rounded-lg h-1.5 appearance-none cursor-pointer"
            />
            <input
              type="number"
              min="0.5"
              max="2.5"
              step="0.05"
              value={activeItem.scale}
              onChange={(e) => {
                const val = Math.max(0.5, Math.min(2.5, parseFloat(e.target.value) || 0.5));
                handleSliderChange('scale', val);
              }}
              className="w-14 bg-slate-950/60 text-slate-200 text-center font-mono text-xs rounded-lg p-1 border border-white/10 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const GameContainer = ({ activeGameUrl }: { activeGameUrl: string }) => {
  useEffect(() => {
    console.log("GAME OPEN");
    return () => console.log("GAME UNMOUNT");
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#070312] text-center p-6 space-y-6 select-none relative overflow-hidden" dir="rtl">
      {/* Abstract Glowing Nebula Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-gradient-to-tr from-indigo-600/30 via-purple-600/20 to-pink-500/30 blur-3xl opacity-60 pointer-events-none animate-pulse duration-[8000ms]"></div>
      
      {/* Pulsing Game Controller Icon */}
      <div className="relative z-10 animate-heartbeat">
        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-500/20 to-purple-500/30 flex items-center justify-center border border-purple-500/30 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
          <img
            src="https://gtkjonqlumuhsuykbxnw.supabase.co/storage/v1/object/public/images/Game%20controller%20clip%20art%20_%20Premium%20AI-generated%20PSD%20(1).png"
            alt="ألعاب"
            referrerPolicy="no-referrer"
            className="w-18 h-18 object-contain drop-shadow-[0_4px_12px_rgba(99,102,241,0.5)]"
          />
        </div>
        {/* Animated outer ring */}
        <div className="absolute inset-0 rounded-full border border-dashed border-indigo-500/40 animate-[spin_10s_linear_infinite] scale-110"></div>
      </div>

      {/* Main Text Content */}
      <div className="space-y-3 max-w-sm z-10 font-sans">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[#a5b4fc] text-[10px] font-black tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-[#d91b5c] animate-ping"></span>
          <span>قسم الألعاب والمجالس</span>
        </div>
        
        <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-indigo-200 to-amber-300 tracking-tight leading-tight">
          قسم الألعاب قيد التحديث حالياً
        </h2>
        
        <p className="text-xs text-slate-300 font-medium leading-relaxed px-2">
          نعمل حالياً على صيانة وتطوير محرك الألعاب لتوفير تجربة مستخدم أكثر سرعة، سلاسة، وإضافة ألعاب جديدة كلياً مع جوائز وهدايا قيمة للمشاركين!
        </p>
      </div>

      {/* Custom Progress Bar decoration */}
      <div className="w-48 bg-slate-950/60 h-2 rounded-full border border-indigo-950 overflow-hidden relative z-10 shadow-inner">
        <div className="h-full bg-gradient-to-r from-indigo-500 via-[#d91b5c] to-amber-400 rounded-full w-[75%] animate-[pulse_2s_infinite]"></div>
      </div>

      <p className="text-[10px] text-indigo-400/70 font-black tracking-wide font-mono z-10">
        الرجاء العودة لاحقاً • صدى العرب
      </p>
    </div>
  );
};

export default function App() {
  // Attach simple logger to window for global access to prevent crashes
  useEffect(() => {
    (window as any).addDebugLog = (msg: string) => {
      console.log("[DEBUG]", msg);
    };
  }, []);

  // Global States representing Database
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isFirestoreOffline, setIsFirestoreOffline] = useState(false);

  const [currentUser, _setCurrentUser] = useState<AppUser | null>(null);
  const lastValidUserRef = useRef<AppUser | null>(null);
  const currentUserRef = useRef<AppUser | null>(null);

  useEffect(() => {
    currentUserRef.current = currentUser;
    if (currentUser) {
      lastValidUserRef.current = currentUser;
    }
  }, [currentUser]);

  const normalizeUser = (res: AppUser | null): AppUser | null => {
    if (!res) return null;
    const email = auth.currentUser?.email;
    const isPrivileged = email === 'karmo2931@gmail.com';
    
    let modified = false;
    let nextRole = res.role;
    let nextDisplayId = res.displayId;

    if (isPrivileged) {
      if (res.role !== 'admin') { nextRole = 'admin'; modified = true; }
    } else if (res.role === 'admin' && email !== 'karmo2931@gmail.com') {
      nextRole = 'user'; modified = true;
    }

    if (email === 'karmo2931@gmail.com') {
      if (res.displayId !== '50505') { nextDisplayId = '50505'; modified = true; }
    } else if (res.displayId === '50505' && email !== 'karmo2931@gmail.com') {
      nextDisplayId = res.originalDisplayId || res.displayId;
      if (nextDisplayId !== res.displayId) modified = true;
    }

    if (modified) {
      return { ...res, role: nextRole, displayId: nextDisplayId };
    }
    return res;
  };

  const setCurrentUser = (user: AppUser | null | ((prev: AppUser | null) => AppUser | null)) => {
    if (typeof user === 'function') {
      _setCurrentUser((prev) => normalizeUser(user(prev)));
    } else {
      _setCurrentUser(normalizeUser(user));
    }
  };

  const [customNotice, setCustomNotice] = useState<{ title: string; message: string } | null>(null);

  // Matching Call System States
  const [isMatching, setIsMatching] = useState(false);
  const [matchProgress, setMatchProgress] = useState(0);
  const [activeCall, setActiveCall] = useState<{
    user: AppUser;
    isMuted: boolean;
    isSpeaker: boolean;
    duration: number;
    messages: { id: string; sender: 'me' | 'them' | 'system'; text: string; time: string }[];
    callId?: string;
    status?: 'ringing' | 'connected';
  } | null>(null);
  const [matchType, setMatchType] = useState<'audio' | 'video'>('audio');
  const [matchGenderFilter, setMatchGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [matchCustomStatus, setMatchCustomStatus] = useState('');
  const [matchCallText, setMatchCallText] = useState('');
  const [showCallGiftModal, setShowCallGiftModal] = useState(false);
  const [isCallMinimized, setIsCallMinimized] = useState(false);

  // WebRTC & Matching Signaling Refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const signalingUnsubRef = useRef<(() => void)[]>([]);
  const matchQueueRef = useRef<any>(null);

  const [incomingCall, setIncomingCall] = useState<{ id: string; caller: AppUser } | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsFirestoreOffline(false);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setIsFirestoreOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Matching Call Simulation & Active Call Duration Timer Hook
  useEffect(() => {
    let timer: any;
    if (activeCall && activeCall.status === 'connected') {
      timer = setInterval(() => {
        setActiveCall(prev => {
          if (!prev || prev.status !== 'connected') return null;
          const nextDuration = prev.duration + 1;
          
          let nextMessages = [...prev.messages];
          if (nextDuration === 3) {
            nextMessages.push({
              id: `sim_msg_1_${Date.now()}`,
              sender: 'them',
              text: 'أهلاً بك يا غالي! تشرفت بالاتصال بك 😊 كيف الأحوال؟',
              time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
            });
            try { soundService.playMessageSound(); } catch (e) {}
          } else if (nextDuration === 10) {
            nextMessages.push({
              id: `sim_msg_2_${Date.now()}`,
              sender: 'them',
              text: 'صوتك واضح وجميل جداً، من وين تتصل؟ 🌹',
              time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
            });
            try { soundService.playMessageSound(); } catch (e) {}
          } else if (nextDuration === 20) {
            nextMessages.push({
              id: `sim_msg_3_${Date.now()}`,
              sender: 'them',
              text: 'أنا أستخدم تطبيق صدى العرب الصوتي يومياً، المجالس هنا ممتعة والناس طيبين جداً! هل جربت إنشاء غرفتك الخاصة؟ 👑',
              time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
            });
            try { soundService.playMessageSound(); } catch (e) {}
          } else if (nextDuration === 32) {
            nextMessages.push({
              id: `sim_msg_4_${Date.now()}`,
              sender: 'them',
              text: 'يسعدني متابعتك! سأضغط متابعة الآن لتكون صديقي 🤝',
              time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
            });
            try { soundService.playMessageSound(); } catch (e) {}
          }
          
          return {
            ...prev,
            duration: nextDuration,
            messages: nextMessages
          };
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeCall !== null && activeCall?.status === 'connected']);

  // Synchronize Agora publishing with activeCall mute status
  useEffect(() => {
    if (!activeCall) return;
    const agoraManager = AgoraEngineManager.getInstance();
    if (activeCall.status === 'connected') {
      if (activeCall.isMuted) {
        console.log("[AGORA-CALL] Muting microphone for active call");
        agoraManager.stopPublishing();
      } else {
        console.log("[AGORA-CALL] Unmuting microphone for active call");
        agoraManager.startPublishing();
      }
    }
  }, [activeCall?.isMuted, activeCall?.status === 'connected']);

  // WebRTC & Matching Signalling Implementation
  const setupWebRTCCall = async (callId: string, isCaller: boolean) => {
    console.log(`Setting up WebRTC connection for call ${callId} as ${isCaller ? 'caller' : 'receiver'}`);
    
    // Join Agora room for the 1v1 call (using same seat/audio system so that it works beautifully)
    if (currentUser) {
      try {
        console.log("[AGORA-CALL] Initializing Agora room for 1v1 call:", callId);
        const agoraManager = AgoraEngineManager.getInstance();
        await agoraManager.joinAudioRoom(callId, currentUser.id);
        await agoraManager.startPublishing();
        console.log("[AGORA-CALL] Agora audio successfully started for call:", callId);
      } catch (err) {
        console.error("[AGORA-CALL] Error joining Agora room for 1v1 call:", err);
      }
    }
    
    // 1. Capture local audio stream
    let localStream: MediaStream;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = localStream;
    } catch (err) {
      console.warn("Microphone access denied or not available. Running call in chat-only mode.", err);
      setActiveCall(prev => {
        if (!prev) return null;
        return {
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: `sys_mic_denied_${Date.now()}`,
              sender: 'system',
              text: '⚠️ الميكروفون غير مفعل أو غير متوفر. يرجى السماح بصلاحية الميكروفون. يمكنك التحدث عبر الرسائل النصية حالياً.',
              time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
            }
          ]
        };
      });
      return;
    }

    // 2. Create RTCPeerConnection
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };
    
    const pc = new RTCPeerConnection(configuration);
    peerConnectionRef.current = pc;

    // 3. Add local track
    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });

    // 4. Play remote track on HTMLAudioElement
    pc.ontrack = (event) => {
      console.log("Remote track received via WebRTC (ignored in favor of Agora connection).", event);
    };

    // 5. ICE candidate gathering
    pc.onicecandidate = async (event) => {
      if (event.candidate && currentUser) {
        try {
          const candRef = collection(db, 'calls', callId, 'candidates');
          await addDoc(candRef, {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            senderId: currentUser.id,
            createdAt: serverTimestamp()
          });
        } catch (e) {
          console.error("Error writing ICE candidate to Firestore:", e);
        }
      }
    };

    const callDocRef = doc(db, 'calls', callId);

    // 6. Caller signaling flow
    if (isCaller) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      await updateDoc(callDocRef, {
        offer: {
          type: offer.type,
          sdp: offer.sdp
        }
      });

      // Listen for Answer
      const unsubAnswer = onSnapshot(callDocRef, async (snap) => {
        if (!snap.exists()) return;
        const callData = snap.data();
        if (callData && callData.answer && !pc.remoteDescription) {
          console.log("Remote answer received! Setting remote description.");
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(callData.answer));
          } catch (e) {
            console.error("Failed to set remote answer SDP:", e);
          }
        }
      });
      signalingUnsubRef.current.push(unsubAnswer);

    } else {
      // Receiver signaling flow
      // We listen in real-time until the caller writes the offer to prevent any race condition
      const unsubOffer = onSnapshot(callDocRef, async (snap) => {
        if (!snap.exists()) return;
        const callData = snap.data();
        if (callData && callData.offer && !pc.remoteDescription) {
          console.log("Remote offer received! Setting remote description on receiver side.");
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            await updateDoc(callDocRef, {
              answer: {
                type: answer.type,
                sdp: answer.sdp
              },
              status: 'accepted'
            });
          } catch (e) {
            console.error("Failed to process WebRTC offer/answer on receiver:", e);
          }
        }
      });
      signalingUnsubRef.current.push(unsubOffer);
    }

    // 7. Exchange ICE Candidates
    if (currentUser) {
      const candidatesRef = collection(db, 'calls', callId, 'candidates');
      const unsubCandidates = onSnapshot(
        query(candidatesRef, where('senderId', '!=', currentUser.id)),
        (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
              const candData = change.doc.data();
              console.log("Remote ICE candidate received.");
              try {
                if (pc.remoteDescription) {
                  await pc.addIceCandidate(new RTCIceCandidate({
                    candidate: candData.candidate,
                    sdpMid: candData.sdpMid,
                    sdpMLineIndex: candData.sdpMLineIndex
                  }));
                } else {
                  let attempts = 0;
                  const interval = setInterval(async () => {
                    attempts++;
                    if (pc.remoteDescription) {
                      clearInterval(interval);
                      await pc.addIceCandidate(new RTCIceCandidate({
                        candidate: candData.candidate,
                        sdpMid: candData.sdpMid,
                        sdpMLineIndex: candData.sdpMLineIndex
                      }));
                    } else if (attempts > 30) {
                      clearInterval(interval);
                    }
                  }, 500);
                }
              } catch (e) {
                console.error("Error adding remote ICE candidate:", e);
              }
            }
          });
        }
      );
      signalingUnsubRef.current.push(unsubCandidates);
    }

    // 8. Listen for Hangup/Disconnect
    const unsubHangup = onSnapshot(callDocRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data && (data.status === 'hungup' || data.status === 'declined')) {
        console.log("Remote side disconnected the call.");
        unsubHangup();
        handleCloseWebRTCCall();
      }
    });
    signalingUnsubRef.current.push(unsubHangup);

    // 9. Listen for real-time messages in active call chat
    const msgColRef = collection(db, 'calls', callId, 'messages');
    const unsubMessages = onSnapshot(
      query(msgColRef, orderBy('createdAt', 'asc')),
      (snapshot) => {
        const msgs: any[] = [];
        snapshot.forEach((doc) => {
          const mData = doc.data();
          if (mData) {
            msgs.push({
              id: doc.id,
              sender: mData.senderId === currentUser?.id ? 'me' : 'them',
              text: mData.text,
              time: mData.time || new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
            });
          }
        });
        if (msgs.length > 0) {
          setActiveCall(prev => {
            if (!prev) return null;
            return {
              ...prev,
              messages: msgs
            };
          });
        }
      }
    );
    signalingUnsubRef.current.push(unsubMessages);
  };

  const handleCloseWebRTCCall = () => {
    console.log("Cleaning up WebRTC resources and closing connection.");
    
    // Also leave the Agora room when the call ends!
    try {
      console.log("[AGORA-CALL] Leaving Agora room as call ended.");
      AgoraEngineManager.getInstance().leaveAudioRoom().catch(err => {
        console.error("[AGORA-CALL] Error leaving Agora call room on hangup:", err);
      });
    } catch (e) {
      console.error("[AGORA-CALL] Error leaving Agora call room:", e);
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    if ((window as any)._activeCallAudio) {
      try {
        (window as any)._activeCallAudio.srcObject = null;
        (window as any)._activeCallAudio = null;
      } catch (e) {}
    }
    signalingUnsubRef.current.forEach(unsub => {
      try { unsub(); } catch (e) {}
    });
    signalingUnsubRef.current = [];
    setActiveCall(null);
    setIsCallMinimized(false);
  };

  const formatDuration = (sec: number) => {
    const hours = Math.floor(sec / 3600).toString().padStart(2, '0');
    const mins = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const secs = (sec % 60).toString().padStart(2, '0');
    return `${hours}:${mins}:${secs}`;
  };

  const handleStartMatching = async () => {
    if (!currentUser) {
      setCustomNotice({
        title: 'عذراً! ⚠️',
        message: 'يجب تسجيل الدخول أولاً للمطابقة.'
      });
      return;
    }

    const userRef = doc(db, "users", currentUser.id);
    const userSnap = await getDoc(userRef);
    const currentCoins = userSnap.exists() ? (userSnap.data().coins || 0) : currentUser.coins;
    
    if (currentCoins < 150) {
      setCustomNotice({
        title: 'رصيد غير كافٍ! 🪙',
        message: 'تحتاج إلى 150 كوينز للدقيقة الأولى لبدء المطابقة الصوتية.'
      });
      return;
    }

    setIsMatching(true);
    setMatchProgress(0);
    setMatchCustomStatus('جاري تسجيل دخولك في قائمة الانتظار...');

    try {
      const queueCol = collection(db, 'matching_queue');
      const myDocRef = doc(queueCol, currentUser.id);
      matchQueueRef.current = myDocRef;

      await setDoc(myDocRef, {
        userId: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar,
        level: currentUser.level || 1,
        gender: currentUser.gender || 'male',
        preference: matchGenderFilter,
        createdAt: serverTimestamp(),
        status: 'waiting',
        matchCallId: null
      });

      try { soundService.playMessageSound(); } catch (e) {}

      // Listen for updates to our queue entry (if someone else matches us)
      const unsubQueue = onSnapshot(myDocRef, async (snap) => {
        if (!snap.exists()) return;
        const qData = snap.data();
        if (qData.status === 'matched' && qData.matchCallId) {
          unsubQueue();
          setIsMatching(false);
          await deleteDoc(myDocRef);
          
          // Deduct coins (150 coins)
          const newCoins = currentCoins - 150;
          const newXp = (currentUser.xp || 0) + 150;
          await updateDoc(userRef, { coins: newCoins, xp: newXp });
          setCurrentUser(prev => prev ? { ...prev, coins: newCoins, xp: newXp } : null);

          const callId = qData.matchCallId;
          const callDoc = await getDoc(doc(db, 'calls', callId));
          if (callDoc.exists()) {
            const callData = callDoc.data();
            const partnerId = callData.callerId === currentUser.id ? callData.receiverId : callData.callerId;
            const partnerSnap = await getDoc(doc(db, 'users', partnerId));
            const partnerUser = (partnerSnap.exists() ? partnerSnap.data() : {
              id: partnerId,
              name: 'شريك صدى العرب',
              avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Partner',
              level: 5,
              displayId: '10001',
              gender: 'female',
              coins: 1000,
              xp: 2000,
              isOnboarded: true
            }) as AppUser;

            // Trigger the incoming voice call modal instead of immediate acceptance
            setIncomingCall({
              id: callId,
              caller: partnerUser
            });
            try { soundService.playMessageSound(); } catch (e) {}
          }
        }
      });

      signalingUnsubRef.current.push(unsubQueue);

      // Search for an existing waiting user in the queue
      const q = query(
        queueCol,
        where('status', '==', 'waiting'),
        orderBy('createdAt', 'asc')
      );

      const querySnap = await getDocs(q);
      let foundPartnerDoc: any = null;

      for (const d of querySnap.docs) {
        const potentialPartner = d.data();
        if (potentialPartner.userId === currentUser.id) continue;

        const partnerPref = potentialPartner.preference;
        const partnerGender = potentialPartner.gender;
        const myGender = currentUser.gender || 'male';

        const isPartnerOkayWithMe = partnerPref === 'all' || partnerPref === myGender;
        const amIOkayWithPartner = matchGenderFilter === 'all' || matchGenderFilter === partnerGender;

        if (isPartnerOkayWithMe && amIOkayWithPartner) {
          foundPartnerDoc = d;
          break;
        }
      }

      if (foundPartnerDoc) {
        const partnerId = foundPartnerDoc.id;
        const partnerRef = doc(queueCol, partnerId);
        const callId = `call_${currentUser.id}_${partnerId}_${Date.now()}`;
        
        await setDoc(doc(db, 'calls', callId), {
          callerId: currentUser.id,
          receiverId: partnerId,
          status: 'ringing',
          createdAt: serverTimestamp()
        });

        await updateDoc(partnerRef, {
          status: 'matched',
          matchCallId: callId
        });

        await deleteDoc(myDocRef);
        setIsMatching(false);

        const newCoins = currentCoins - 150;
        const newXp = (currentUser.xp || 0) + 150;
        await updateDoc(userRef, { coins: newCoins, xp: newXp });
        setCurrentUser(prev => prev ? { ...prev, coins: newCoins, xp: newXp } : null);

        const partnerUser = foundPartnerDoc.data() as AppUser;
        setActiveCall({
          user: partnerUser,
          isMuted: false,
          isSpeaker: true,
          duration: 0,
          status: 'ringing',
          messages: [
            {
              id: `match_call_ringing_${Date.now()}`,
              sender: 'system',
              text: `جاري الاتصال بـ ${partnerUser.name}... بانتظار قبول الشريك للمكالمة 📞`,
              time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
            }
          ],
          callId: callId
        });

        const callDocRef = doc(db, 'calls', callId);
        const unsubCall = onSnapshot(callDocRef, (callSnap) => {
          if (!callSnap.exists()) return;
          const callData = callSnap.data();
          if (callData.status === 'accepted') {
            unsubCall();
            setupWebRTCCall(callId, true);
            setActiveCall(prev => {
              if (!prev || prev.callId !== callId) return prev;
              return {
                ...prev,
                status: 'connected',
                messages: [
                  ...prev.messages,
                  {
                    id: `sys_connected_${Date.now()}`,
                    sender: 'system',
                    text: `تم قبول المكالمة! تمنياتنا لكم بمحادثة ممتعة 🎙️✨`,
                    time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
                  }
                ]
              };
            });
          } else if (callData.status === 'declined' || callData.status === 'timeout' || callData.status === 'hungup') {
            unsubCall();
            setActiveCall(null);
            setCustomNotice({
              title: 'انتهت المكالمة 📞',
              message: callData.status === 'declined' ? 'تم رفض المكالمة من الطرف الآخر.' : 'لم يتم الرد أو تم إنهاء المكالمة.'
            });
          }
        });
        signalingUnsubRef.current.push(unsubCall);
      } else {
        // Falling back to gorgeous radar animated sequence with mock pool if no active online users matched within 6s
        let progress = 0;
        const interval = setInterval(async () => {
          progress += 10;
          setMatchProgress(progress);

          if (progress < 40) {
            setMatchCustomStatus('جاري البحث عن شريك متوافق...');
          } else if (progress < 80) {
            setMatchCustomStatus('جاري الاتصال بقنوات الصوت الآمنة...');
          } else {
            setMatchCustomStatus('ربط الاتصال الصوتي...');
          }

          if (progress >= 100) {
            clearInterval(interval);
            
            const latestQueueDoc = await getDoc(myDocRef);
            if (latestQueueDoc.exists() && latestQueueDoc.data().status === 'matched') {
              return; 
            }

            await deleteDoc(myDocRef);
            setIsMatching(false);

            const newCoins = currentCoins - 150;
            const newXp = (currentUser.xp || 0) + 150;
            await updateDoc(userRef, { coins: newCoins, xp: newXp });
            setCurrentUser(prev => prev ? { ...prev, coins: newCoins, xp: newXp } : null);

            const MOCK_MATCH_POOL = [
              { id: 'mock_match_1', name: 'سارة العتيبي 🇸🇦', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Sarah', level: 12, displayId: '40912', country: 'السعودية', gender: 'female', bio: 'أحب تكوين صداقات جديدة والتحدث بالصوت 🎙️✨' },
              { id: 'mock_match_2', name: 'أحمد اليوسف 🇸🇦', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Ahmad', level: 18, displayId: '50219', country: 'الكويت', gender: 'male', bio: 'حياكم الله في مجلسي الصوتي 🌟' },
              { id: 'mock_match_3', name: 'ليان الحربي 🇸🇦', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Layan', level: 8, displayId: '30248', country: 'السعودية', gender: 'female', bio: 'متواجدة للدردشة اليومية والمرح 🥰' },
              { id: 'mock_match_4', name: 'فهد الدوسري 🇸🇦', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Fahad', level: 22, displayId: '60912', country: 'الإمارات', gender: 'male', bio: 'صانع محتوى صدى العرب 🎙️' },
              { id: 'mock_match_5', name: 'ياسمين نجد 🇸🇦', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Yasmeen', level: 15, displayId: '10432', country: 'البحرين', gender: 'female', bio: 'ضيفة خفيفة وظريفة 🌸' }
            ];

            let pool = MOCK_MATCH_POOL;
            if (matchGenderFilter === 'male') pool = MOCK_MATCH_POOL.filter(u => u.gender === 'male');
            else if (matchGenderFilter === 'female') pool = MOCK_MATCH_POOL.filter(u => u.gender === 'female');
            if (pool.length === 0) pool = MOCK_MATCH_POOL;

            const randomPartner = pool[Math.floor(Math.random() * pool.length)];
            const partnerUser: AppUser = {
              id: randomPartner.id,
              name: randomPartner.name,
              avatar: randomPartner.avatar,
              level: randomPartner.level,
              displayId: randomPartner.displayId,
              country: randomPartner.country,
              gender: randomPartner.gender as 'male' | 'female',
              coins: 1000,
              xp: 2000,
              isOnboarded: true,
              bio: randomPartner.bio
            };

            setActiveCall({
              user: partnerUser,
              isMuted: false,
              isSpeaker: true,
              duration: 0,
              status: 'ringing',
              messages: [{
                id: `match_ringing_${Date.now()}`,
                sender: 'system',
                text: `جاري الاتصال بـ ${partnerUser.name}... بانتظار قبول الشريك للمكالمة 📞`,
                time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
              }]
            });

            // Automatically "accept" and connect after 3 seconds for mock match
            setTimeout(() => {
              setActiveCall(prev => {
                if (!prev || prev.user.id !== partnerUser.id) return prev;
                return {
                  ...prev,
                  status: 'connected',
                  messages: [
                    ...prev.messages,
                    {
                      id: 'system_welcome',
                      sender: 'them',
                      text: 'أهلاً بك! تم ربط الاتصال بنجاح. تحدث الآن 🎤📱',
                      time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
                    },
                    {
                      id: 'system_connected',
                      sender: 'system',
                      text: 'تم قبول المكالمة! تمنياتنا لكم بمحادثة ممتعة 🎙️✨',
                      time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
                    }
                  ]
                };
              });
            }, 3000);

            try { soundService.playRoomJoinSound(); } catch (e) {}
          }
        }, 600);

        signalingUnsubRef.current.push(() => clearInterval(interval));
      }

    } catch (err) {
      console.error("Match error:", err);
      setIsMatching(false);
    }
  };

  const handleCancelMatching = async () => {
    setIsMatching(false);
    signalingUnsubRef.current.forEach(unsub => {
      try { unsub(); } catch (e) {}
    });
    signalingUnsubRef.current = [];

    if (matchQueueRef.current) {
      try {
        await deleteDoc(matchQueueRef.current);
      } catch (e) {
        console.error("Error removing matching queue entry", e);
      }
      matchQueueRef.current = null;
    }
  };

  const handleSendCallMessage = async (text: string) => {
    if (!activeCall || !currentUser) return;
    const isMock = activeCall.user.id.startsWith('mock_');
    if (isMock) {
      setActiveCall(prev => {
        if (!prev) return null;
        return {
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: `my_msg_${Date.now()}`,
              sender: 'me',
              text: text,
              time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
            }
          ]
        };
      });
    } else if (activeCall.callId) {
      try {
        const msgCol = collection(db, 'calls', activeCall.callId, 'messages');
        await addDoc(msgCol, {
          senderId: currentUser.id,
          text: text,
          createdAt: serverTimestamp(),
          time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
        });
      } catch (e) {
        console.error("Error sending call message:", e);
      }
    }
  };

  const [vipConfig, setVipConfig] = useState<any>(DEFAULT_VIP_CONFIG);

  const handleUpdateVipConfig = async (type: 'frames' | 'badges', level: number, field: 'width' | 'height' | 'scale', value: number) => {
    const updated = {
      ...vipConfig,
      [type]: {
        ...vipConfig[type],
        [level]: {
          ...vipConfig[type][level],
          [field]: value
        }
      }
    };
    
    // Update local state instantly for zero-latency slider response
    setVipConfig(updated);
    
    // Save to Firestore so it replicates real-time for all other users
    try {
      const docRef = doc(db, "settings", "vip_config");
      await setDoc(docRef, updated);
    } catch (err) {
      console.error("Error updating vip_config in Firestore:", err);
    }
  };

  // Presence Tracking
  useEffect(() => {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.id);

    const updatePresence = async (status: boolean) => {
      try {
        if (status) {
          await updateDoc(userRef, { isOnline: true, lastSeen: serverTimestamp() });
        } else {
          await updateDoc(userRef, { isOnline: false });
        }
      } catch (e) {
        console.error("Presence update failed", e);
      }
    };

    updatePresence(true);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updatePresence(true);
      }
    }, 12000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updatePresence(false);
      } else {
        updatePresence(true);
      }
    };

    const handleBeforeUnload = () => {
      updatePresence(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      updatePresence(false);
    };
  }, [currentUser?.id]);

  // Incoming Call Listener
  useEffect(() => {
    if (!currentUser) return;
    const callsRef = collection(db, 'calls');
    const q = query(callsRef, where('receiverId', '==', currentUser.id), where('status', '==', 'ringing'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let activeCallDoc: any = null;
      snapshot.forEach((doc) => {
        activeCallDoc = { id: doc.id, ...doc.data() };
      });

      if (activeCallDoc) {
        const caller = users.find(u => u.id === activeCallDoc.callerId);
        if (caller) {
          setIncomingCall({
            id: activeCallDoc.id,
            caller: caller
          });
          try { soundService.playMessageSound(); } catch (e) {}
        }
      } else {
        // Clear incoming call if no longer ringing or if caller hung up/canceled
        setIncomingCall(null);
      }
    });
    return () => unsubscribe();
  }, [currentUser?.id, users]);

  const handleAcceptIncomingCall = async () => {
    if (!incomingCall) return;
    const callId = incomingCall.id;
    const caller = incomingCall.caller;
    setIncomingCall(null);

    setActiveCall({
      user: caller,
      isMuted: false,
      isSpeaker: true,
      duration: 0,
      status: 'connected',
      messages: [
        {
          id: `sys_started_${Date.now()}`,
          sender: 'system',
          text: `🪙 تم قبول المكالمة بنجاح. تمنياتنا لكم بقضاء وقت ممتع! 🎉`,
          time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
        }
      ],
      callId: callId
    });

    try {
      await updateDoc(doc(db, 'calls', callId), { status: 'accepted' });
    } catch (e) {
      console.error("Error accepting call in Firestore:", e);
    }

    setupWebRTCCall(callId, false);
  };

  const handleDeclineIncomingCall = async () => {
    if (!incomingCall) return;
    const callId = incomingCall.id;
    setIncomingCall(null);
    try {
      await updateDoc(doc(db, 'calls', callId), { status: 'declined' });
    } catch (e) {
      console.error("Error declining call:", e);
    }
  };

  const handleSendGiftInCall = async (gift: Gift) => {
    if (!currentUser || !activeCall) return;

    let surcharge = 0;
    if (currentUser.gender === 'male' && activeCall.user.gender === 'female') {
      surcharge = 40;
    }

    const totalCost = gift.cost + surcharge;

    if (currentUser.coins < totalCost) {
      setCustomNotice({
        title: 'رصيد غير كافي 🪙',
        message: 'عذراً، رصيدك من الكوينز غير كافي لإرسال الهدية. يرجى الشحن عبر شبكة الوكلاء المعتمدين.'
      });
      return;
    }

    try { soundService.playGiftSound(); } catch (e) {}

    const newCoins = currentUser.coins - totalCost;
    const newXp = currentUser.xp + totalCost;

    setCurrentUser(prev => {
      if (!prev) return null;
      return {
        ...prev,
        coins: newCoins,
        xp: newXp,
        level: getLevelFromXp(newXp)
      };
    });

    // Update in Firestore
    try {
      const userRef = doc(db, "users", currentUser.id);
      await updateDoc(userRef, {
        coins: newCoins,
        xp: newXp,
        level: getLevelFromXp(newXp)
      });

      // Update receiver's coins, diamonds and charmXp in Firestore & local state
      const receiverRef = doc(db, "users", activeCall.user.id);
      const recSnap = await getDoc(receiverRef);
      if (recSnap.exists()) {
        const recData = recSnap.data();
        const currentCoins = recData.coins || 0;
        const currentDiamonds = recData.diamonds || 0;
        const currentCharmXp = recData.charmXp || 0;
        const addedValue = gift.cost + surcharge;
        const newRecCoins = currentCoins + addedValue;
        const newDiamonds = currentDiamonds + addedValue;
        const newCharmXp = currentCharmXp + addedValue;

        const updateSupportersListInCall = (currentSupportersList: any[] | undefined, donorId: string, donorName: string, donorAvatar: string, costValue: number) => {
          const currentList = currentSupportersList || [];
          const existingIndex = currentList.findIndex((s: any) => s.userId === donorId);
          let newList = [...currentList];
          if (existingIndex !== -1) {
            newList[existingIndex] = {
              ...newList[existingIndex],
              amount: (newList[existingIndex].amount || 0) + costValue,
              name: donorName,
              avatar: donorAvatar
            };
          } else {
            newList.push({
              userId: donorId,
              name: donorName,
              avatar: donorAvatar,
              amount: costValue
            });
          }
          newList.sort((a, b) => (b.amount || 0) - (a.amount || 0));
          return newList;
        };

        const newSupporters = updateSupportersListInCall(recData.supporters, currentUser.id, currentUser.name, currentUser.avatar, addedValue);

        await updateDoc(receiverRef, {
          coins: newRecCoins,
          diamonds: newDiamonds,
          charmXp: newCharmXp,
          supporters: newSupporters
        });

        // Update local users array
        setUsers(prev => prev.map(u => u.id === activeCall.user.id ? { ...u, coins: newRecCoins, diamonds: newDiamonds, charmXp: newCharmXp, supporters: newSupporters } : u));
      }
    } catch (err) {
      console.error("Error updating user gift deduction in call:", err);
    }

    // Append gift send system message to chat messages
    setActiveCall(prev => {
      if (!prev) return null;
      return {
        ...prev,
        messages: [
          ...prev.messages,
          {
            id: `gift_msg_${Date.now()}`,
            sender: 'me',
            text: `🎁 لقد أرسلت هدية [${gift.arabicName}] بقيمة ${gift.cost} كوينز! ✨`,
            time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
          }
        ]
      };
    });

    setShowCallGiftModal(false);

    setCustomNotice({
      title: 'تم إرسال الهدية بنجاح! 🎁',
      message: `تم إرسال ${gift.arabicName} إلى ${activeCall.user.name} بنجاح خصماً من رصيدك.`
    });
  };

  const handleStartDirectCall = async (targetUser: AppUser) => {
    if (!currentUser) {
      setCustomNotice({
        title: 'عذراً! ⚠️',
        message: 'يجب تسجيل الدخول أولاً للاتصال.'
      });
      return;
    }
    
    // 1. Check if guy/caller has at least 150 coins
    const senderRef = doc(db, "users", currentUser.id);
    const senderSnap = await getDoc(senderRef);
    const currentCoins = senderSnap.exists() ? (senderSnap.data().coins || 0) : currentUser.coins;
    
    if (currentCoins < 150) {
      setCustomNotice({
        title: 'رصيد غير كافي 🪙',
        message: 'عذراً، رصيدك أقل من 150 كوينز اللازمة لبدء المكالمة. يرجى الشحن عبر شبكة الوكلاء المعتمدين.'
      });
      return;
    }
    
    // 2. Immediate deduction of first minute (150 coins)
    const newCoins = currentCoins - 150;
    const newXp = (currentUser.xp || 0) + 150;
    
    await updateDoc(senderRef, {
      coins: newCoins,
      xp: newXp
    });
    
    // Update local sender state
    const updatedMe = { ...currentUser, coins: newCoins, xp: newXp };
    setCurrentUser(updatedMe);
    setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedMe : u));
    
    // 3. Create call signaling document
    const callRef = doc(collection(db, "calls"));
    await setDoc(callRef, {
      callerId: currentUser.id,
      receiverId: targetUser.id,
      status: 'ringing',
      createdAt: serverTimestamp()
    });

    // 4. Set 60s timeout
    const timeout = setTimeout(async () => {
      const callSnap = await getDoc(callRef);
      if (callSnap.exists() && callSnap.data().status === 'ringing') {
        await updateDoc(callRef, { status: 'timeout' });
        setCustomNotice({
          title: 'لم يتم الرد ⌛',
          message: 'لم يتم الرد على المكالمة. انتهى وقت الانتظار.'
        });
      }
    }, 60000);

    // 5. Listen for status change
    const unsubscribe = onSnapshot(callRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.status === 'accepted') {
        clearTimeout(timeout);
        unsubscribe();
        setActiveCall({ 
          user: targetUser, 
          isMuted: false, 
          isSpeaker: false, 
          duration: 0,
          status: 'connected',
          messages: [
            {
              id: `direct_call_welcome_${Date.now()}`,
              sender: 'them',
              text: `مرحباً بك يا غالي! أنا ${targetUser.name} متصلة معك الآن في مكالمة خاصة. نورتني جداً! 💖✨`,
              time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
            },
            {
              id: `system_msg_started_${Date.now()}`,
              sender: 'system',
              text: `🪙 تم قبول المكالمة! بدأت المحادثة بنجاح. تم خصم 150 كوينز للدقيقة الأولى وإضافتها كأرباح للمضيفة 🎉`,
              time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
            }
          ],
          callId: callRef.id
        });
        setupWebRTCCall(callRef.id, true);
      } else if (data.status === 'declined' || data.status === 'timeout') {
        clearTimeout(timeout);
        unsubscribe();
        setActiveCall(null);
        setCustomNotice({
          title: 'لم يتم الرد ⌛',
          message: data.status === 'declined' ? 'تم رفض المكالمة من الطرف الآخر.' : 'لم يتم الرد على المكالمة. انتهى وقت الانتظار.'
        });
      }
    });

    // Add 150 diamonds to female user (targetUser) if targetUser is real
    const isMock = targetUser.id.startsWith('mock_');
    if (!isMock) {
      const receiverRef = doc(db, "users", targetUser.id);
      const receiverSnap = await getDoc(receiverRef);
      if (receiverSnap.exists()) {
        const currentDiamonds = receiverSnap.data().diamonds || 0;
        const currentCharmXp = receiverSnap.data().charmXp || 0;
        const newDiamonds = currentDiamonds + 150;
        const newCharmXp = currentCharmXp + 150;
        
        await updateDoc(receiverRef, {
          diamonds: newDiamonds,
          charmXp: newCharmXp
        });
        
        setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, diamonds: newDiamonds, charmXp: newCharmXp } : u));
      }
    }
    
    // 4. Start the call state
    setActiveCall({
      user: targetUser,
      isMuted: false,
      isSpeaker: true,
      duration: 0,
      status: 'ringing',
      messages: [
        {
          id: `direct_call_ringing_${Date.now()}`,
          sender: 'system',
          text: `جاري الاتصال بـ ${targetUser.name}... بانتظار قبول المضيفة للمكالمة 📞`,
          time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
        }
      ],
      callId: callRef.id
    });

    if (isMock) {
      setTimeout(async () => {
        try {
          await updateDoc(callRef, { status: 'accepted' });
        } catch (e) {
          console.error("Error setting mock accept:", e);
        }
      }, 3000);
    }
    
    try { soundService.playRoomJoinSound(); } catch (e) {}
  };

  // Call billing effect for subsequent minutes (every 60 seconds)
  useEffect(() => {
    if (!activeCall) return;
    const duration = activeCall.duration;
    if (duration > 0 && duration % 60 === 0) {
      if (!currentUser) return;
      
      const chargeNextMinute = async () => {
        const senderRef = doc(db, "users", currentUser.id);
        const senderSnap = await getDoc(senderRef);
        if (!senderSnap.exists()) return;
        
        const currentCoins = senderSnap.data().coins || 0;
        if (currentCoins < 150) {
          // Auto hangup due to insufficient balance
          setActiveCall(null);
          setCustomNotice({
            title: 'انتهت المكالمة! 🪙',
            message: 'تم إنهاء المكالمة لعدم كفاية رصيد الكوينز لديك. (تحتاج 150 كوينز لكل دقيقة)'
          });
          return;
        }
        
        // Deduct 150 coins from sender
        const newCoins = currentCoins - 150;
        const newXp = (senderSnap.data().xp || 0) + 150;
        await updateDoc(senderRef, {
          coins: newCoins,
          xp: newXp
        });
        
        // Update sender locally
        const updatedMe = { ...currentUser, coins: newCoins, xp: newXp };
        setCurrentUser(updatedMe);
        setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedMe : u));
        
        // Add 150 diamonds to female recipient
        const isMock = activeCall.user.id.startsWith('mock_');
        if (!isMock) {
          const receiverRef = doc(db, "users", activeCall.user.id);
          const receiverSnap = await getDoc(receiverRef);
          if (receiverSnap.exists()) {
            const currentDiamonds = receiverSnap.data().diamonds || 0;
            const currentCharmXp = receiverSnap.data().charmXp || 0;
            const newDiamonds = currentDiamonds + 150;
            const newCharmXp = currentCharmXp + 150;
            
            await updateDoc(receiverRef, {
              diamonds: newDiamonds,
              charmXp: newCharmXp
            });
            
            setUsers(prev => prev.map(u => u.id === activeCall.user.id ? { ...u, diamonds: newDiamonds, charmXp: newCharmXp } : u));
          }
        }
        
        // Add system message about billing
        setActiveCall(prev => {
          if (!prev) return null;
          return {
            ...prev,
            messages: [
              ...prev.messages,
              {
                id: `system_msg_billing_${duration}_${Date.now()}`,
                sender: 'system',
                text: `🪙 تم خصم 150 كوينز للدقيقة رقم ${Math.floor(duration / 60) + 1} وتحويلها بنجاح كأرباح سحب للمضيفة ✨`,
                time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
              }
            ]
          };
        });
      };
      
      chargeNextMinute().catch(err => console.error("Error charging next minute:", err));
    }
  }, [activeCall?.duration]);


  // Architectural Explorer States
  const [selectedFileKey, setSelectedFileKey] = useState<string>('pubspec');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'lib': true,
    'lib/core': true,
    'lib/features': true,
    'lib/features/voice_room': true,
    'lib/features/agent_dashboard': true,
  });
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [activeTab, setActiveTab] = useState<'architecture' | 'code' | 'specs'>('architecture');

  // Interactive Live & Premium State Additions
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [speakingSeatIndex, setSpeakingSeatIndex] = useState<number | null>(null);
  const [speakingVolume, setSpeakingVolume] = useState<number>(0);
  const [isAgoraJoined, setIsAgoraJoined] = useState<boolean>(false);
  const [isRoomAudioDeafened, setIsRoomAudioDeafened] = useState(false);

  // Real-time microphone level capture for currentUser when they are unmuted on a seat
  const [realUserMicSpeaking, setRealUserMicSpeaking] = useState(false);
  const [realUserMicVolume, setRealUserMicVolume] = useState(0);

  const checkIfOwner = (room: VoiceRoom | null) => {
    if (!room || !currentUser) return false;
    return !!(
      (room.owner_id && room.owner_id === currentUser?.id)
    );
  };
  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<VoiceRoom | null>(null);
  const activeRoomRef = useRef<VoiceRoom | null>(null);
  const isLeavingRoomRef = useRef(false);
  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);
  const [transactions, setTransactions] = useState<AgentTransferLog[]>([]);
  const [agentBalance, setAgentBalance] = useState<number>(0);
  const [agentsHub, setAgentsHub] = useState<{agent_id: string; agent_name: string; contact_whatsapp: string; is_active: boolean}[]>([]);

  // Profile, Direct Messaging & Follower States
  const [selectedProfileUser, setSelectedProfileUser] = useState<AppUser | null>(null);
  const [banDurationModalUser, setBanDurationModalUser] = useState<AppUser | null>(null);
  const activeProfileUser = selectedProfileUser 
    ? (users?.find(u => u.id === selectedProfileUser.id) || selectedProfileUser) 
    : null;
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isPrivateInboxOpen, setIsPrivateInboxOpen] = useState(false);
  const [activePrivateChatUser, setActivePrivateChatUser] = useState<AppUser | null>(null);
  const [privateMessages, setPrivateMessages] = useState<PrivateMessage[]>([]);
  const [agencyInvitations, setAgencyInvitations] = useState<any[]>([]);
  const [newPrivateMessageInput, setNewPrivateMessageInput] = useState('');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioEditValue, setBioEditValue] = useState('');
  const [isAgentsHubOpen, setIsAgentsHubOpen] = useState(false);
  const [agentSearchQuery, setAgentSearchQuery] = useState('');
  const [isAdminManageModalOpen, setIsAdminManageModalOpen] = useState(false);
  const [adminActiveTab, setAdminActiveTab] = useState<'agents' | 'salaries'>('agents');
  const [adminWithdrawalRequests, setAdminWithdrawalRequests] = useState<any[]>([]);
  const [adminSalariesSearchQuery, setAdminSalariesSearchQuery] = useState('');
  const [adminSalariesToast, setAdminSalariesToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<{ reqId: string, type: 'approve' | 'reject' } | null>(null);
  const [adminManageSearchQuery, setAdminManageSearchQuery] = useState('');
  const [adminAgencyTargetId, setAdminAgencyTargetId] = useState('');
  const [adminAgencyFoundUser, setAdminAgencyFoundUser] = useState<AppUser | null>(null);
  const [adminAgencySearching, setAdminAgencySearching] = useState(false);
  const [adminAgencyOwnerName, setAdminAgencyOwnerName] = useState('');
  const [adminAgencyName, setAdminAgencyName] = useState('');
  const [adminAgencyWhatsApp, setAdminAgencyWhatsApp] = useState('');
  const [adminAgencySuccessData, setAdminAgencySuccessData] = useState<{name: string, id: string} | null>(null);
  const [adminAgencySearchQuery, setAdminAgencySearchQuery] = useState('');
  const [allAgencies, setAllAgencies] = useState<any[]>([]);
  const [deletingAgencyId, setDeletingAgencyId] = useState<string | null>(null);
  const [isDeletingAgency, setIsDeletingAgency] = useState(false);

  const [adminCoinAgentTargetId, setAdminCoinAgentTargetId] = useState('');
  const [adminCoinAgentName, setAdminCoinAgentName] = useState('');
  const [adminCoinAgentInitialStock, setAdminCoinAgentInitialStock] = useState('');
  const [adminCoinAgentSuccessData, setAdminCoinAgentSuccessData] = useState<{name: string, coins: string} | null>(null);

  const [adminRechargeAmounts, setAdminRechargeAmounts] = useState<Record<string, string>>({});
  const [adminAgentWhatsApps, setAdminAgentWhatsApps] = useState<Record<string, string>>({});
  const [adminEditDisplayId, setAdminEditDisplayId] = useState<Record<string, string>>({});
  const [adminEditDisplayIdDuration, setAdminEditDisplayIdDuration] = useState<Record<string, string>>({});

  // App Simulator Screen Navigation: 'login' | 'onboarding_profile' | 'explore' | 'room' | 'agent_pin' | 'agent_dashboard'
  const [currentScreen, setCurrentScreen] = useState<'login' | 'onboarding_profile' | 'explore' | 'room' | 'agent_pin' | 'agent_dashboard'>('login');
  const currentScreenRef = useRef(currentScreen);
  useEffect(() => {
    currentScreenRef.current = currentScreen;
  }, [currentScreen]);

  // Auto-populate agency owner name and whatsapp based on target user display ID
  useEffect(() => {
    const fetchAndPopulateUser = async () => {
      const targetId = adminAgencyTargetId.trim();
      if (!targetId) {
        setAdminAgencyFoundUser(null);
        setAdminAgencyOwnerName('');
        setAdminAgencyWhatsApp('');
        return;
      }

      setAdminAgencySearching(true);
      
      // 1. Try local lookup first
      let foundUser = users?.find(u => (u.displayId === targetId || u.originalDisplayId === targetId));
      
      if (!foundUser) {
        // Query Firestore
        try {
          const qDisplay = query(collection(db, 'users'), where('displayId', '==', targetId));
          const qSnap = await getDocs(qDisplay);
          if (!qSnap.empty) {
            const docSnap = qSnap.docs[0];
            foundUser = { id: docSnap.id, ...docSnap.data() } as AppUser;
          } else {
            const qOrig = query(collection(db, 'users'), where('originalDisplayId', '==', targetId));
            const qSnapOrig = await getDocs(qOrig);
            if (!qSnapOrig.empty) {
              const docSnapOrig = qSnapOrig.docs[0];
              foundUser = { id: docSnapOrig.id, ...docSnapOrig.data() } as AppUser;
            }
          }
        } catch (err) {
          console.error("Error auto-fetching user:", err);
        }
      }

      setAdminAgencySearching(false);

      if (foundUser) {
        setAdminAgencyFoundUser(foundUser);
        setAdminAgencyOwnerName(foundUser.name || '');
        setAdminAgencyWhatsApp(foundUser.whatsapp || foundUser.phone || '');
      } else {
        setAdminAgencyFoundUser(null);
        setAdminAgencyOwnerName('');
        setAdminAgencyWhatsApp('');
      }
    };

    const timer = setTimeout(() => {
      fetchAndPopulateUser();
    }, 400); // debounce 400ms

    return () => clearTimeout(timer);
  }, [adminAgencyTargetId, users]);

  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Onboarding Setup States
  const [onboardingGender, setOnboardingGender] = useState<'male' | 'female'>('male');
  const [onboardingName, setOnboardingName] = useState('');
  const [onboardingAvatar, setOnboardingAvatar] = useState('');
  const [onboardingBirthdate, setOnboardingBirthdate] = useState('29-07-2001');
  const [onboardingInviteCode, setOnboardingInviteCode] = useState('');
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  const handleRandomizeName = () => {
    const maleNames = ['شهم الجزيرة', 'صقر العرب', 'رائد الفضاء', 'برق الشام', 'فارس بغداد', 'سلطان الخليج', 'كريم غازي'];
    const femaleNames = ['ملاك صدى', 'أميرة العرب', 'ياسمين الشام', 'نور الفجر', 'زهرة البنفسج', 'دانه الخليج'];
    const list = onboardingGender === 'female' ? femaleNames : maleNames;
    const randomName = list[Math.floor(Math.random() * list.length)] + ' ' + Math.floor(Math.random() * 90 + 10);
    setOnboardingName(randomName);
    const randomSeed = Math.random().toString(36).substring(7);
    setOnboardingAvatar(`https://api.dicebear.com/7.x/adventurer/svg?seed=${randomSeed}`);
  };

  useEffect(() => {
    if (currentUser && currentScreen === 'onboarding_profile') {
      if (!onboardingName) {
        setOnboardingName(currentUser.name === 'مستشار صدى' ? '' : currentUser.name);
      }
      if (!onboardingAvatar) {
        setOnboardingAvatar(currentUser.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${currentUser.id}`);
      }
    }
  }, [currentUser?.id, currentScreen]);

  const handleExitRoomNavigation = () => {
    setCurrentScreen('explore');
  };
  
  // Login input fields
  const [loginMethod, setLoginMethod] = useState<'phone' | 'email' | 'google' | 'apple' | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smsOtp, setSmsOtp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOtpField, setShowOtpField] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Create Room modal states
  const [isCreateRoomModalOpen, setIsCreateRoomModalOpen] = useState(false);
  const [isRoomUsersModalOpen, setIsRoomUsersModalOpen] = useState(false);
  const [newRoomNameInput, setNewRoomNameInput] = useState('');
  const [newRoomIsPrivate, setNewRoomIsPrivate] = useState(false);
  const [newRoomPassword, setNewRoomPassword] = useState('');
  const [newRoomError, setNewRoomError] = useState('');
  const [newRoomLoading, setNewRoomLoading] = useState(false);

  // Explore Room Lock PIN state
  const [selectedLockedRoom, setSelectedLockedRoom] = useState<VoiceRoom | null>(null);
  const [roomPasswordInput, setRoomPasswordInput] = useState('');
  const [roomPasswordError, setRoomPasswordError] = useState(false);

  // Voice Room interactive state
  const [selectedSeatIndex, setSelectedSeatIndex] = useState<number | null>(null);
  const [selectedSeatUser, setSelectedSeatUser] = useState<{ user: AppUser; seatIndex: number } | null>(null);
  const [isInviteListOpen, setIsInviteListOpen] = useState(false);
  const [incomingMicInvitation, setIncomingMicInvitation] = useState<any | null>(null);
  const [floatingGifts, setFloatingGifts] = useState<{ id: number; icon: string; x: number; y: number }[]>([]);
  const [flyingGifts, setFlyingGifts] = useState<Array<{ id: string; senderSeatIndex: number | null; receiverSeatIndex: number | null; imageUrl: string; giftId?: string }>>([]);
  const [vipEntrance, setVipEntrance] = useState<{ active: boolean; userName: string; level: number } | null>(null);
  const [premiumGiftBanner, setPremiumGiftBanner] = useState<{ 
    sender: string; 
    recipient: string; 
    giftName: string; 
    giftIcon: string;
    senderAvatar?: string | null;
    receiverAvatar?: string | null;
    giftImageUrl?: string | null;
    quantity?: number;
    _comboKey?: number;
    lastGiftGroupId?: string | null;
  } | null>(null);
  const [activeRoomUsers, setActiveRoomUsers] = useState<Array<{ id: string; name: string; avatar: string }>>([]);
  const floatingIdCounter = useRef(0);
  const premiumGiftBannerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // SVGA Player states & refs
  const [activeSvgaUrl, setActiveSvgaUrl] = useState<string | null>(null);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [customAnimUrl, setCustomAnimUrl] = useState<string>('');
  const svgaCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const svgaQueueRef = useRef<string[]>([]);
  const isSvgaPlayingRef = useRef<boolean>(false);
  const processedSvgaGroupIdsRef = useRef<Set<string>>(new Set());

  // Agent Dashboard states
  const [agentPinInput, setAgentPinInput] = useState('');
  const [agentPinError, setAgentPinError] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferTargetUser, setTransferTargetUser] = useState<AppUser | null>(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferPin, setTransferPin] = useState('');
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [transferErrorMsg, setTransferErrorMsg] = useState('');
  
  // End-to-End Encryption (E2EE) States
  const [isE2EEEnabled, setIsE2EEEnabled] = useState(true);
  const [e2eePassphrase, setE2eePassphrase] = useState('SadaArabE2EESecureKey');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [derivedKey, setDerivedKey] = useState<CryptoKey | null>(null);
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [e2eeAuditLogs, setE2eeAuditLogs] = useState<string[]>([]);
  const [showCiphertextInFeed, setShowCiphertextInFeed] = useState(false);
  const [clientKeyPair, setClientKeyPair] = useState<CryptoKeyPair | null>(null);
  const [clientPublicKeyBase64, setClientPublicKeyBase64] = useState('');
  const [isE2EEDrawerOpen, setIsE2EEDrawerOpen] = useState(false);

  // Gamification & clans / leaderboard states
  const [exploreSubTab, setExploreSubTab] = useState<'planet' | 'clans' | 'leaderboard'>('planet');
  const [liveLeaderboard, setLiveLeaderboard] = useState<{
    senders: any[];
    receivers: any[];
    clans: any[];
  } | null>(null);
  const [newClanName, setNewClanName] = useState('');
  const [newClanLogo, setNewClanLogo] = useState('🛡️');
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);

  const addE2eeLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setE2eeAuditLogs(prev => [`[${timestamp}] ${msg}`, ...prev.slice(0, 49)]);
  };








  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  
  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('هل أنت متأكد من حذف الغرفة؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    try {
      await deleteDoc(doc(db, "voice_rooms", roomId));
      if (activeRoom?.id === roomId) {
        isLeavingRoomRef.current = true;
        handleExitRoomNavigation();
        console.trace("[DEBUG] setActiveRoom(null) called from handleDeleteRoom");
        setActiveRoom(null);
      }
    } catch (err) {
      console.error("Error deleting room", err);
      alert('حدث خطأ أثناء محاولة حذف الغرفة');
    }
  };

  const handleCreateRoom = async (name: string) => {
    try {
      await addDoc(collection(db, "voice_rooms"), {
        name: name,
        room_name: name,
        owner_id: currentUser?.id,
        isPrivate: false,
        is_private: false,
        password: '',
        room_password: '',
        hostName: currentUser?.name,
        host_name: currentUser?.name,
        hostAvatar: currentUser?.avatar,
        host_avatar: currentUser?.avatar || '',
        seats: Array.from({ length: 10 }, (_, i) => ({
          index: i + 1,
          userId: null,
          isLocked: false,
          isMuted: false
        })),
        level: 1,
        xp: 0,
        activeUsersCount: 0
      });
      setIsCreateRoomModalOpen(false); 
      setNewRoomNameInput("");
      return { success: true };
    } catch (e) {
      console.error("Error creating room in Firestore:", e);
      return { success: false, error: 'حدث خطأ في إنشاء الغرفة' };
    }
  };

  // Real-time synchronization of VIP Frame & SVIP Badge design configurations
  useEffect(() => {
    const docRef = doc(db, "settings", "vip_config");
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setVipConfig({
          frames: {
            1: { ...DEFAULT_VIP_CONFIG.frames[1], ...data.frames?.[1] },
            2: { ...DEFAULT_VIP_CONFIG.frames[2], ...data.frames?.[2] },
            3: { ...DEFAULT_VIP_CONFIG.frames[3], ...data.frames?.[3] },
            4: { ...DEFAULT_VIP_CONFIG.frames[4], ...data.frames?.[4] },
            5: { ...DEFAULT_VIP_CONFIG.frames[5], ...data.frames?.[5] }
          },
          badges: {
            1: { ...DEFAULT_VIP_CONFIG.badges[1], ...data.badges?.[1] },
            2: { ...DEFAULT_VIP_CONFIG.badges[2], ...data.badges?.[2] },
            3: { ...DEFAULT_VIP_CONFIG.badges[3], ...data.badges?.[3] },
            4: { ...DEFAULT_VIP_CONFIG.badges[4], ...data.badges?.[4] },
            5: { ...DEFAULT_VIP_CONFIG.badges[5], ...data.badges?.[5] }
          }
        });
      }
    }, (error) => {
      console.error("Error syncing vip_config:", error);
    });
    return () => unsubscribe();
  }, []);

  // Global listener for Quota/Resource Exhausted errors from Firebase Firestore (Removed as requested)
  // Real-time synchronization of rooms using Firestore
  useEffect(() => {
    const q = query(collection(db, "voice_rooms"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const roomsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || data.room_name || 'مجلس غير مسمى',
          hostName: data.hostName || data.host_name || 'مالك المجلس',
          hostAvatar: data.hostAvatar || data.host_avatar || '',
          isPrivate: data.isPrivate !== undefined ? data.isPrivate : (data.is_private || false),
          password: data.password || data.room_password || '',
          seats: padSeats(data.seats),
          level: data.level || 1,
          xp: data.xp || 0,
          activeUsersCount: data.activeUsersCount || 0,
          ...data
        } as VoiceRoom;
      });
      setRooms(roomsData);
    }, (error) => {
      console.error("Error syncing rooms:", error);
      const errMsg = error?.message || '';
      if (errMsg.includes('Quota') || errMsg.includes('quota') || error?.code === 'resource-exhausted') {
        (window as any).__markQuotaExceeded?.();
      }
      if (error?.code === 'unavailable' || errMsg.includes('unavailable') || errMsg.includes('Could not reach')) {
        setIsFirestoreOffline(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time synchronization of participants for the active room
  useEffect(() => {
    if (!activeRoom?.id) {
      setActiveRoomUsers([]);
      return;
    }

    console.log("[SYNC] Starting participants listener for room:", activeRoom.id);
    const participantsRef = collection(db, "voice_rooms", activeRoom.id, "participants");
    const q = query(participantsRef);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log("[SYNC] Participants snapshot received, count:", snapshot.docs.length);
      const participants = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: data.id || doc.id,
          name: data.name || 'مشارك',
          avatar: data.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${doc.id}`
        };
      });
      console.log(`[SYNC] Participants updated: ${participants.length} users`);
      setActiveRoomUsers(participants);
    }, (error) => {
      console.error("Error syncing participants:", error);
      const errMsg = error?.message || '';
      if (errMsg.includes('Quota') || errMsg.includes('quota') || error?.code === 'resource-exhausted') {
        (window as any).__markQuotaExceeded?.();
      }
    });

    return () => unsubscribe();
  }, [activeRoom?.id]);

  // Real-time synchronization of room messages for the active room
  useEffect(() => {
    if (!activeRoom?.id) {
      // Reset room messages to welcome messages when leaving room
      setRoomMessages([
        { sender: 'نظام المجلس', text: 'مرحباً بكم في صدى العرب! يرجى الالتزام بالاحترام المتبادل داخل مجالسنا الموقرة.', color: 'text-purple-400 font-bold', type: 'system' },
        { sender: 'خالد الحربي', text: 'السلام عليكم ورحمة الله، حياكم الله جميعاً بالمجلس الدافئ.', color: 'text-amber-400', type: 'chat' },
      ]);
      return;
    }

    // Ensure local state is clean and fresh when re-entering a room
    setRoomMessages([
      { id: 'sys', sender: 'نظام المجلس', text: 'مرحباً بكم في صدى العرب! يرجى الالتزام بالاحترام المتبادل داخل مجالسنا الموقرة.', color: 'text-purple-400 font-bold', type: 'system' }
    ]);
    console.log("[SYNC] Starting room messages listener for room:", activeRoom.id);
    const messagesRef = collection(db, "voice_rooms", activeRoom.id, "chat_messages");
    // Only listen to messages sent AFTER we join to save read quotas
    const joinTime = new Date().toISOString();
    const q = query(messagesRef, where("createdAt", ">=", joinTime), orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, {
      next: (snapshot) => {
        // If we are getting the snapshot, we only append new messages to the existing state
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const doc = change.doc;
          const data = doc.data();
          const msg = {
            id: doc.id,
            sender: data.sender || 'مستخدم',
            text: data.text || '',
            color: data.color || 'text-purple-300 font-medium',
            type: data.type || 'chat',
            isEncrypted: data.isEncrypted || false,
            rawCiphertext: data.rawCiphertext || '',
            iv: data.iv || '',
            svgaUrl: data.svgaUrl || null,
            createdAt: data.createdAt
          };

          // Trigger SVGA animation if a gift message contains an svgaUrl (deduplicated by giftGroupId)
          if (data.svgaUrl) {
            const groupKey = data.giftGroupId || doc.id;
            if (!processedSvgaGroupIdsRef.current.has(groupKey)) {
              processedSvgaGroupIdsRef.current.add(groupKey);
              if (processedSvgaGroupIdsRef.current.size > 200) {
                const firstVal = processedSvgaGroupIdsRef.current.values().next().value;
                if (firstVal !== undefined) {
                  processedSvgaGroupIdsRef.current.delete(firstVal);
                }
              }
              const qty = data.giftQuantity || 1;
              for (let i = 0; i < qty; i++) {
                triggerSvgaPlay(data.svgaUrl);
              }
            }
          }

          // Handle flying gift animations (for any gift that doesn't have an SVGA animation)
          if (data.giftId && !data.svgaUrl) {
            const qty = data.giftQuantity || 1;
            for (let i = 0; i < qty; i++) {
              const animId = Math.random().toString(36).substr(2, 9) + '-' + i;
              const giftImg = data.giftImageUrl || 'https://gtkjonqlumuhsuykbxnw.supabase.co/storage/v1/object/public/images/dhf.png';
              setFlyingGifts(prev => [...prev, {
                id: animId,
                senderSeatIndex: data.senderSeatIndex !== undefined && data.senderSeatIndex !== null ? Number(data.senderSeatIndex) : null,
                receiverSeatIndex: data.receiverSeatIndex !== undefined && data.receiverSeatIndex !== null ? Number(data.receiverSeatIndex) : null,
                imageUrl: giftImg,
                giftId: data.giftId
              }]);
              // Remove after animation completes (3 seconds)
              setTimeout(() => {
                setFlyingGifts(prev => prev.filter(g => g.id !== animId));
              }, 3000);
            }
          }

          // Trigger premium gift ribbon/banner sliding down only if it is a premium gift
          if (data.isPremiumGift) {
            setPremiumGiftBanner(prev => {
              const newQuantity = data.giftQuantity || 1;
              const sender = data.sender || 'مستخدم';
              const recipient = data.giftReceiverName || 'المجلس';
              const giftName = data.giftName || 'هدية فاخرة';
              const groupId = data.giftGroupId || null;
              
              if (
                prev && 
                prev.sender === sender && 
                prev.giftName === giftName
              ) {
                const isSameGroup = groupId && prev.lastGiftGroupId === groupId;
                const updatedQuantity = isSameGroup ? (prev.quantity || 1) : (prev.quantity || 1) + newQuantity;
                return {
                  ...prev,
                  recipient: prev.recipient === recipient ? prev.recipient : 'الجميع',
                  quantity: updatedQuantity,
                  lastGiftGroupId: groupId,
                  _comboKey: isSameGroup ? prev._comboKey : Date.now()
                };
              }
              return {
                sender,
                recipient,
                giftName,
                giftIcon: data.giftIcon || '🎁',
                senderAvatar: data.senderAvatar || null,
                receiverAvatar: data.receiverAvatar || null,
                giftImageUrl: data.giftImageUrl || null,
                quantity: newQuantity,
                lastGiftGroupId: groupId,
                _comboKey: Date.now()
              };
            });
            
            if (premiumGiftBannerTimeoutRef.current) {
              clearTimeout(premiumGiftBannerTimeoutRef.current);
            }
            premiumGiftBannerTimeoutRef.current = setTimeout(() => {
              setPremiumGiftBanner(null);
              premiumGiftBannerTimeoutRef.current = null;
            }, 5000);
          }

          // Intercept with AI auto-moderation
          if (data.sender !== '🤖 مراقب الذكاء الاصطناعي' && data.sender !== 'نظام المجلس') {
            runAiModerationOnText(data.text || '', data.sender || 'مستخدم', data.senderId, doc.id);
          }

          setRoomMessages(prev => {
            // Avoid duplicates
            if (prev?.find(m => m.id === msg.id)) return prev;
            return [...prev, msg].slice(-100); // Keep max 100 in local state
          });
        }
      });
      // We don't need to map over all docs anymore since we manage state incrementally
      },
      error: (error) => {
        console.error("Error syncing room messages:", error);
      }
    });

    return () => {
      unsubscribe();
      // Instantly purge local state on unmount / exit to prevent memory leaks and ensure fresh screen on rejoin
      setRoomMessages([
        { id: 'sys', sender: 'نظام المجلس', text: 'مرحباً بكم في صدى العرب! يرجى الالتزام بالاحترام المتبادل داخل مجالسنا الموقرة.', color: 'text-purple-400 font-bold', type: 'system' }
      ]);
    };
  }, [activeRoom?.id]);

  // Real-time synchronization of the active room state (seats, bannedUsers, etc.)
  useEffect(() => {
    if (!activeRoom?.id) return;

    console.log("[SYNC] Starting activeRoom document listener for room:", activeRoom.id);
    const roomRef = doc(db, "voice_rooms", activeRoom.id);
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      console.log("[SYNC] Snapshot received, exists:", docSnap.exists());
      if (isLeavingRoomRef.current) {
        console.log("[SYNC] Ignoring snapshot update because user is leaving the room.");
        return;
      }
      if (docSnap.exists()) {
        const data = docSnap.data();
        const updatedRoom = {
          id: docSnap.id,
          name: data.name || data.room_name || 'مجلس غير مسمى',
          hostName: data.hostName || data.host_name || 'مالك المجلس',
          hostAvatar: data.hostAvatar || data.host_avatar || '',
          isPrivate: data.isPrivate !== undefined ? data.isPrivate : (data.is_private || false),
          password: data.password || data.room_password || '',
          seats: padSeats(data.seats),
          level: data.level || 1,
          xp: data.xp || 0,
          activeUsersCount: data.activeUsersCount || 0,
          bannedUsers: data.bannedUsers || {},
          ...data
        } as VoiceRoom;

        // Check if current user is banned (completely immune to state stale closure using direct auth.currentUser ID)
        const currentUid = auth.currentUser?.uid || currentUser?.id;
        console.log("[SYNC] Checking ban for user:", currentUid, "BannedUsers:", updatedRoom.bannedUsers);
        if (currentUid && updatedRoom.bannedUsers && updatedRoom.bannedUsers[currentUid]) {
          const banExpiration = new Date(updatedRoom.bannedUsers[currentUid]);
          const now = new Date();
          console.log("[SYNC] Ban expiration:", banExpiration, "Now:", now, "IsBanned:", banExpiration > now);
          if (banExpiration > now) {
            console.log("[BAN] Banned user detected! Kicking out user:", currentUid, "Expiration:", updatedRoom.bannedUsers[currentUid]);
            
            // Immediately stop publishing audio
            try {
              AgoraEngineManager.getInstance().stopPublishing();
            } catch (err) {
              console.error("Error stopping audio publishing on ban:", err);
            }

            // Clean up participant subcollection (fallback, host usually deletes this instantly)
            const participantRef = doc(db, "voice_rooms", docSnap.id, "participants", currentUid);
            deleteDoc(participantRef).catch(console.error);

            // Set non-blocking custom notice and exit room
            setCustomNotice({
              title: "تم طردك من المجلس",
              message: `لقد تم طردك من هذه الغرفة حتى ${banExpiration.toLocaleString('ar-EG')}`
            });

            isLeavingRoomRef.current = true;
            console.trace("[DEBUG] setActiveRoom(null) called from onSnapshot (Ban check)");
            setActiveRoom(null);
            setCurrentScreen('explore');
            return;
          }
        }

        // Sync local activeRoom state
        setActiveRoom(updatedRoom);
      } else {
        console.log("[SYNC] Room doc does not exist, kicking out.");
        // Room was deleted by owner
        setCustomNotice({
          title: "تم إغلاق الغرفة",
          message: "عذراً، لقد تم إغلاق أو حذف هذه الغرفة من قبل المالك."
        });
        isLeavingRoomRef.current = true;
        console.trace("[DEBUG] setActiveRoom(null) called from onSnapshot (Room deleted)");
        setActiveRoom(null);
        setCurrentScreen('explore');
      }
    }, (error) => {
      console.error("Error syncing active room document:", error);
    });

    return () => unsubscribe();
  }, [activeRoom?.id, currentUser?.id]);

  // Real-time synchronization of mic invitations for the current user in the active room
  useEffect(() => {
    if (!activeRoom?.id || !currentUser?.id) {
      setIncomingMicInvitation(null);
      return;
    }

    console.log("[SYNC] Starting mic invitations listener for room:", activeRoom.id, "and user:", currentUser.id);
    const invitationsRef = collection(db, "voice_rooms", activeRoom.id, "mic_invitations");
    const q = query(
      invitationsRef,
      where("inviteeId", "==", currentUser.id),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setIncomingMicInvitation(null);
        return;
      }

      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const latestInvite = docs[docs.length - 1];
      setIncomingMicInvitation(latestInvite);
    }, (error) => {
      console.error("Error syncing mic invitations:", error);
    });

    return () => {
      unsubscribe();
      setIncomingMicInvitation(null);
    };
  }, [activeRoom?.id, currentUser?.id]);

  // Real-time synchronization of users using Firestore -> Patched to fetch once to save massive quota
  useEffect(() => {
    let isMounted = true;
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, "users"), limit(100));
        const snapshot = await getDocs(q);
        if (!isMounted) return;
        const usersData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || data.username || 'مستشار صدى',
            avatar: data.avatar || data.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${doc.id}`,
            level: data.level || data.vip_level || 1,
            coins: data.coins !== undefined ? data.coins : (data.coins_balance !== undefined ? data.coins_balance : 0),
            xp: data.xp || data.sender_xp || 0,
            ...data
          };
        }) as AppUser[];
        setUsers(usersData);
      } catch (error: any) {
        console.error("Error syncing users:", error);
        const errMsg = error?.message || '';
        if (errMsg.includes('Quota') || errMsg.includes('quota') || error?.code === 'resource-exhausted') {
          (window as any).__markQuotaExceeded?.();
        }
      }
    };
    fetchUsers();
    
    // Poll every 60 seconds instead of real-time listener for ALL users
    const interval = setInterval(fetchUsers, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const revertingUserIdsRef = useRef<Set<string>>(new Set());

  // Check for expired custom display IDs
  useEffect(() => {
    if (users.length === 0) return;
    const now = new Date();
    
    const expiredUsers = users.filter(u => {
      if (u.id !== currentUser?.id) return false; // Only revert self to prevent infinite loops and concurrent write storms
      if (!u.displayIdExpiredAt) return false;
      if (revertingUserIdsRef.current.has(u.id)) return false; // Already in-progress or attempted
      try {
        const expiryDate = new Date(u.displayIdExpiredAt);
        return now > expiryDate;
      } catch (e) {
        return false;
      }
    });

    if (expiredUsers.length > 0) {
      expiredUsers.forEach(async (u) => {
        revertingUserIdsRef.current.add(u.id); // Mark as attempted
        try {
          console.log(`[ID EXPIRY] Reverting expired display ID for user ${u.name} (ID: ${u.displayId})`);
          let targetId = u.originalDisplayId;
          if (!targetId) {
            targetId = await getNextDisplayId();
          }
          await updateDoc(doc(db, "users", u.id), {
            displayId: targetId,
            originalDisplayId: targetId,
            displayIdExpiredAt: null
          });
        } catch (e) {
          console.error("Error reverting expired display ID for user", u.id, e);
        }
      });
    }
  }, [users, currentUser?.id]);

  useEffect(() => {
    // ---------------- Support Tickets Listener ----------------
    let unsubscribeUserTicket = () => {};
    let unsubscribeTicketMessages = () => {};
    let unsubscribeAdminTickets = () => {};

    if (currentUser?.id) {
      // 1. User side: Find their latest active ticket or any open ticket
      const ticketsQuery = query(
        collection(db, "support_tickets"),
        where("userId", "==", currentUser?.id),
        orderBy("updatedAt", "desc"),
        limit(1)
      );

      unsubscribeUserTicket = onSnapshot(ticketsQuery, (snapshot) => {
        if (!snapshot.empty) {
          const ticketDoc = snapshot.docs[0];
          const ticketData = { id: ticketDoc.id, ...ticketDoc.data() } as SupportTicket;
          setActiveSupportTicket(ticketData);

          // 2. Fetch messages for this ticket
          const messagesQuery = query(
            collection(db, "support_tickets", ticketDoc.id, "messages"),
            orderBy("timestamp", "asc")
          );

          unsubscribeTicketMessages = onSnapshot(messagesQuery, (msgSnap) => {
            const msgs = msgSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SupportTicketMessage[];
            setSupportMessages(msgs);
          }, (error) => {
            console.error("Error syncing support ticket messages:", error);
            const errMsg = error?.message || '';
            if (errMsg.includes('Quota') || errMsg.includes('quota') || error?.code === 'resource-exhausted') {
              (window as any).__markQuotaExceeded?.();
            }
          });
        } else {
          setActiveSupportTicket(null);
          setSupportMessages([]);
        }
      }, (error) => {
        console.error("Error syncing support tickets:", error);
        const errMsg = error?.message || '';
        if (errMsg.includes('Quota') || errMsg.includes('quota') || error?.code === 'resource-exhausted') {
          (window as any).__markQuotaExceeded?.();
        }
      });
      
      // 3. Admin side: Find all open tickets
      if (currentUser.role === 'admin' || auth.currentUser?.email === 'karmo2931@gmail.com') {
        const adminTicketsQuery = query(
          collection(db, "support_tickets"),
          where("status", "==", "open"),
          orderBy("updatedAt", "desc")
        );
        unsubscribeAdminTickets = onSnapshot(adminTicketsQuery, (snap) => {
          const adminTkts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SupportTicket[];
          setSupportTickets(adminTkts);
        }, (error) => {
          console.error("Error syncing admin tickets:", error);
          const errMsg = error?.message || '';
          if (errMsg.includes('Quota') || errMsg.includes('quota') || error?.code === 'resource-exhausted') {
            (window as any).__markQuotaExceeded?.();
          }
        });
      }
    }

    return () => {
      unsubscribeUserTicket();
      unsubscribeTicketMessages();
      unsubscribeAdminTickets();
    };
  }, [currentUser?.id, currentUser?.role]);


  // Listen for Firebase auth state changes
  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;

    getRedirectResult(auth).then((result) => {
      if (result?.user) {
        console.log("Redirect sign-in successful:", result.user.uid);
        const user = result.user;
        localStorage.setItem('sada_bound_uid', user.uid);
        localStorage.setItem('sada_last_login', JSON.stringify({
          method: 'Google',
          email: user.email || `user_${user.uid.slice(0,6)}@gmail.com`,
          avatar: user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`
        }));
        setCurrentScreen('explore');
      }
    }).catch((err) => {
      console.warn("Redirect result error:", err);
    });

    const manualUserId = null;
    if (manualUserId) {
      const userDocRef = doc(db, "users", manualUserId);
      if ((window as any).addDebugLog) (window as any).addDebugLog("Attaching onSnapshot...");
          unsubscribeUser = onSnapshot(userDocRef, (snap) => {
            if ((window as any).addDebugLog) (window as any).addDebugLog("onSnapshot triggered. Exists: " + snap.exists());
        if (snap.exists()) {
          let userData = snap.data() as AppUser;
          if (auth.currentUser?.email === 'karmo2931@gmail.com') { userData = { ...userData, role: 'admin', displayId: '50505' }; } else if (userData.role === 'admin' || userData.displayId === '50505') { userData = { ...userData, role: 'user', displayId: userData.originalDisplayId || userData.displayId }; }
          setCurrentUser({ ...userData, id: snap.id });
          if ((window as any).addDebugLog) (window as any).addDebugLog("Setting screen to explore...");
              setCurrentScreen(prev => prev === 'login' ? 'explore' : prev);
        }
      }, (error) => {
        console.error("Error listening to manual user doc:", error);
        const errMsg = error?.message || '';
        if (errMsg.includes('Quota') || errMsg.includes('quota') || error?.code === 'resource-exhausted') {
          (window as any).__markQuotaExceeded?.();
        }
      });
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if ((window as any).addDebugLog) {
        (window as any).addDebugLog("Auth state changed. User: " + (firebaseUser ? firebaseUser.uid : "null"));
      }
      if (firebaseUser) {
        // Enforce single account per device / computer rule or update bound uid on login
        const boundUid = localStorage.getItem('sada_bound_uid');
        if (boundUid && boundUid !== firebaseUser.uid) {
          localStorage.setItem('sada_bound_uid', firebaseUser.uid);
        } else if (!boundUid) {
          localStorage.setItem('sada_bound_uid', firebaseUser.uid);
        }

        localStorage.setItem('sada_last_login', JSON.stringify({
          method: 'Google',
          email: firebaseUser.email || '',
          avatar: firebaseUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${firebaseUser.uid}`
        }));

        console.log("onAuthStateChanged: User logged in:", firebaseUser.uid);
        if (unsubscribeUser) {
          unsubscribeUser();
          unsubscribeUser = null;
        }

        const userDocRef = doc(db, "users", firebaseUser.uid);
        
        // Ensure user doc exists before listening
        console.log("Fetching getDoc for user...");
        getDoc(userDocRef).then(async (docSnap) => {
          console.log("getDoc resolved. Exists:", docSnap.exists());
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (!data.inviteCode) {
              const newCode = generate8CharInviteCode();
              updateDoc(userDocRef, { inviteCode: newCode }).catch(e => console.error("Error setting invite code:", e));
            }
          } else {
            const defaultName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'مستشار صدى';
            const defaultAvatar = firebaseUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${firebaseUser.uid}`;
            const newDisplayId = await getNextDisplayId();
            const uniqueInviteCode = generate8CharInviteCode();
            
            const newUser: AppUser & { invitedBy?: string } = {
              id: firebaseUser.uid,
              displayId: newDisplayId,
              originalDisplayId: newDisplayId,
              inviteCode: uniqueInviteCode,
              name: defaultName,
              avatar: defaultAvatar,
              level: 1,
              coins: 0,
              xp: 0,
              role: 'user',
              bio: 'عضو مميز في صدى العرب ☕',
              followers: [],
              following: [],
              badges: [],
              createdAt: new Date().toISOString()
            };

            // Check referral parameter ?ref=
            try {
              const urlParams = new URLSearchParams(window.location.search);
              const refCode = urlParams.get('ref');
              if (refCode) {
                const refQueryCode = query(collection(db, "users"), where("inviteCode", "==", refCode));
                const refSnapCode = await getDocs(refQueryCode);
                if (!refSnapCode.empty) {
                  const referrerDoc = refSnapCode.docs[0];
                  if (referrerDoc.id !== firebaseUser.uid) {
                    await updateDoc(referrerDoc.ref, {
                      invitedCount: increment(1)
                    });
                    newUser.invitedBy = referrerDoc.id;
                  }
                } else {
                  const refQuery = query(collection(db, "users"), where("displayId", "==", refCode));
                  const refSnap = await getDocs(refQuery);
                  if (!refSnap.empty) {
                    const referrerDoc = refSnap.docs[0];
                    if (referrerDoc.id !== firebaseUser.uid) {
                      await updateDoc(referrerDoc.ref, {
                        invitedCount: increment(1)
                      });
                      newUser.invitedBy = referrerDoc.id;
                    }
                  } else {
                    const directRefDoc = await getDoc(doc(db, "users", refCode));
                    if (directRefDoc.exists() && directRefDoc.id !== firebaseUser.uid) {
                      await updateDoc(directRefDoc.ref, {
                        invitedCount: increment(1)
                      });
                      newUser.invitedBy = directRefDoc.id;
                    }
                  }
                }
              }
            } catch (refErr) {
              console.error("Error processing referral:", refErr);
            }

            if ((window as any).addDebugLog) (window as any).addDebugLog("Creating new user doc...");
            await setDoc(userDocRef, newUser);
            if ((window as any).addDebugLog) (window as any).addDebugLog("New user doc created successfully.");
          }
          
          // Setup real-time listener for current user document
          unsubscribeUser = onSnapshot(userDocRef, (snap) => {
            if (snap.exists()) {
              let userData = snap.data() as AppUser;
              if (firebaseUser.email === 'karmo2931@gmail.com') { 
                userData = { ...userData, role: 'admin', displayId: '50505' }; 
                if (userData.displayId !== '50505' || userData.role !== 'admin' || !userData.agencyId) {
                  updateDoc(userDocRef, {
                    role: 'admin',
                    displayId: '50505',
                    agencyId: '50505',
                    agencyName: 'لببلف'
                  }).catch(err => console.error("Auto-assign testing agency failed:", err));
                }
              } else if (userData.role === 'admin' || userData.displayId === '50505') { 
                userData = { ...userData, role: 'user', displayId: userData.originalDisplayId || userData.displayId }; 
              }
              setCurrentUser({ ...userData, id: snap.id });
              setCurrentScreen(prev => {
                if (!userData.isOnboarded) {
                  return 'onboarding_profile';
                }
                if (prev === 'login' || prev === 'onboarding_profile') {
                  return 'explore';
                }
                return prev;
              });
              setIsAuthChecking(false);
            } else {
              console.warn("User doc does not exist in onSnapshot, logging out...");
              auth.signOut().catch(console.error);
              setIsAuthChecking(false);
            }
          }, (error) => {
            console.error("Error listening to current user doc:", error);
            const errMsg = error?.message || '';
            if (errMsg.includes('Quota') || errMsg.includes('quota') || error?.code === 'resource-exhausted') {
              (window as any).__markQuotaExceeded?.();
              
              // Fallback mock user to allow entry despite quota
              const defaultName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'مستشار صدى';
              const defaultAvatar = firebaseUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${firebaseUser.uid}`;
              const fallbackUser = {
                id: firebaseUser.uid,
                displayId: "99999",
                originalDisplayId: "99999",
                name: defaultName,
                avatar: defaultAvatar,
                level: 1,
                coins: 0,
                xp: 0,
                role: firebaseUser.email === 'karmo2931@gmail.com' ? 'admin' : 'user',
                bio: 'عضو مميز في صدى العرب ☕',
                followers: [],
                following: [],
                badges: [],
                createdAt: new Date().toISOString()
              };
              setCurrentUser(fallbackUser as AppUser);
              setCurrentScreen(prev => prev === 'login' ? 'explore' : prev);
              alert("⚠️ تنبيه: لقد نفدت سعة القراءة المجانية لقاعدة بيانات Firebase اليوم (Quota Exceeded). \n\nتم إدخالك بوضع التصفح المؤقت، لكن بعض الميزات (كالغرف والمستخدمين) قد لا تعمل حتى يتم تجديد الباقة غداً أو ترقية الخطة.");
            }
            setIsAuthChecking(false);
          });
        }).catch(e => {
          if ((window as any).addDebugLog) (window as any).addDebugLog("getDoc ERROR: " + e.message);
          console.error("Error fetching user doc:", e);
          const errMsg = e.message || '';
          if (errMsg.includes('Quota') || errMsg.includes('quota') || e.code === 'resource-exhausted' || errMsg.includes('exceeded')) {
            // Fallback mock user to allow entry despite quota
            const defaultName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'مستشار صدى';
            const defaultAvatar = firebaseUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${firebaseUser.uid}`;
            const fallbackUser = {
              id: firebaseUser.uid,
              displayId: "99999",
              originalDisplayId: "99999",
              name: defaultName,
              avatar: defaultAvatar,
              level: 1,
              coins: 0,
              xp: 0,
              role: firebaseUser.email === 'karmo2931@gmail.com' ? 'admin' : 'user',
              bio: 'عضو مميز في صدى العرب ☕',
              followers: [],
              following: [],
              badges: [],
              createdAt: new Date().toISOString()
            };
            setCurrentUser(fallbackUser as AppUser);
            setCurrentScreen(prev => prev === 'login' ? 'explore' : prev);
            setIsAuthChecking(false);
            alert("⚠️ تنبيه: لقد نفدت سعة القراءة المجانية لقاعدة بيانات Firebase اليوم (Quota Exceeded). \n\nتم إدخالك بوضع التصفح المؤقت، لكن بعض الميزات (كالغرف والمستخدمين) قد لا تعمل حتى يتم تجديد الباقة غداً أو ترقية الخطة.");
          } else {
            alert("حدث خطأ أثناء الاتصال بقاعدة البيانات. يرجى المحاولة لاحقاً. " + errMsg);
            setIsAuthChecking(false);
            auth.signOut();
          }
        });
      } else {
        // Logged out
        const isManual = null;
        if (!isManual) {
          if (unsubscribeUser) {
            unsubscribeUser();
            unsubscribeUser = null;
          }
          setCurrentUser(null);
          setCurrentScreen('login');
          setIsAuthChecking(false);
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, []);

  // Real-time synchronization of private messages using Firestore
  useEffect(() => {
    if (!currentUser?.id) {
      setPrivateMessages([]);
      return;
    }

    console.log("[SYNC] Starting private messages listener for user:", currentUser?.id);
    const messagesRef = collection(db, "messages");
    // We query for messages where current user is either sender or receiver
    // Firestore supports 'where' filters, but for OR we might need multiple listeners or a participants array
    // Here we use a participants array for simplicity in querying
    const q = query(
      messagesRef, 
      where("participants", "array-contains", currentUser?.id),
      orderBy("timestamp", "asc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PrivateMessage[];
      console.log(`[SYNC] Private messages updated: ${msgs.length} messages`);
      setPrivateMessages(msgs);
    }, (error) => {
      console.error("Error syncing private messages:", error);
      const errMsg = error?.message || '';
      if (errMsg.includes('Quota') || errMsg.includes('quota') || error?.code === 'resource-exhausted') {
        (window as any).__markQuotaExceeded?.();
      }
    });

    return () => unsubscribe();
  }, [currentUser?.id]);

  // Real-time synchronization of agency invitations
  useEffect(() => {
    if (!currentUser?.id) {
      setAgencyInvitations([]);
      return;
    }

    const q = query(
      collection(db, 'agency_invitations'),
      where('target_user_id', '==', currentUser.id),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAgencyInvitations(list);
    }, (error) => {
      console.error("Error syncing agency invitations in App.tsx:", error);
    });

    return () => unsubscribe();
  }, [currentUser?.id]);

  // Mark messages as read when inbox opens or active chat user changes
  useEffect(() => {
    if (isPrivateInboxOpen && activePrivateChatUser && currentUser) {
      // Find unread messages from other user
      const unreadMsgs = privateMessages.filter(msg => 
        msg.senderId === activePrivateChatUser.id && 
        msg.receiverId === currentUser?.id && 
        !msg.isRead
      );

      unreadMsgs.forEach(msg => {
        const msgRef = doc(db, "messages", msg.id);
        updateDoc(msgRef, { isRead: true }).catch(err => console.error("Error marking message as read:", err));
      });
    }
  }, [isPrivateInboxOpen, activePrivateChatUser?.id, currentUser?.id, privateMessages.length]);

  // Handlers for accepting/rejecting invitations within private messages
  const handleAcceptPrivateInvitation = async (inv: any) => {
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

      alert(`تهانينا! لقد انضممت بنجاح إلى وكالة (${inv.agency_name})`);
    } catch (err) {
      console.error("Error accepting invitation from private message:", err);
      alert("حدث خطأ أثناء قبول الدعوة.");
    }
  };

  const handleRejectPrivateInvitation = async (inv: any) => {
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

      alert("تم رفض طلب الانضمام للوكالة.");
    } catch (err) {
      console.error("Error rejecting invitation from private message:", err);
      alert("حدث خطأ أثناء رفض الدعوة.");
    }
  };
  
  // Admin function to completely delete an agency
  const handleDeleteAgency = async (agencyId: string, ownerId: string, agencyName: string) => {
    try {
      setIsDeletingAgency(true);
      // 1. Delete the agency document from Firestore
      await deleteDoc(doc(db, "agencies", agencyId));

      // 2. Explicitly update the agency owner's user document
      if (ownerId) {
        try {
          await updateDoc(doc(db, "users", ownerId), {
            role: 'user',
            agencyId: null,
            agencyName: null
          });
        } catch (e) {
          console.warn("Failed directly updating user by ownerId, searching...", e);
        }

        // Search by displayId or originalDisplayId just in case
        try {
          const qUser = query(collection(db, "users"), where("displayId", "==", ownerId));
          const qSnap = await getDocs(qUser);
          qSnap.forEach(async (uDoc) => {
            await updateDoc(doc(db, "users", uDoc.id), {
              role: 'user',
              agencyId: null,
              agencyName: null
            });
          });

          const qUserOrig = query(collection(db, "users"), where("originalDisplayId", "==", ownerId));
          const qSnapOrig = await getDocs(qUserOrig);
          qSnapOrig.forEach(async (uDoc) => {
            await updateDoc(doc(db, "users", uDoc.id), {
              role: 'user',
              agencyId: null,
              agencyName: null
            });
          });
        } catch (e) {
          console.error("Error updating user by displayId:", e);
        }
      }

      // 3. Find all other users associated with this agency and remove their agency fields
      const qIds = [agencyId];
      if (ownerId) qIds.push(ownerId);
      const q = query(collection(db, "users"), where("agencyId", "in", qIds));
      const querySnapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      querySnapshot.forEach((userDoc) => {
        // Skip owner since we updated them explicitly above
        if (userDoc.id === ownerId) return;
        
        batch.update(doc(db, "users", userDoc.id), {
          agencyId: null,
          agencyName: null
        });
      });
      await batch.commit();

      // 4. Delete any active invitations for this agency
      const invQuery = query(collection(db, "agency_invitations"), where("agency_id", "in", qIds));
      const invSnapshot = await getDocs(invQuery);
      const invBatch = writeBatch(db);
      invSnapshot.forEach((invDoc) => {
        invBatch.delete(doc(db, "agency_invitations", invDoc.id));
      });
      await invBatch.commit();

      setDeletingAgencyId(null);
    } catch (err) {
      console.error("Error deleting agency:", err);
      alert("حدث خطأ أثناء حذف الوكالة.");
    } finally {
      setIsDeletingAgency(false);
    }
  };

  // Send Private Message Handler
  const handleSendPrivateMessage = async () => {
    if (!currentUser || !activePrivateChatUser || !newPrivateMessageInput.trim()) return;
    
    const textToSend = newPrivateMessageInput.trim();
    
    // Determine cost: 40 coins if male sender and female receiver
    const isMaleSender = currentUser.gender === 'male';
    const isFemaleReceiver = activePrivateChatUser.gender === 'female';
    const messageCost = (isMaleSender && isFemaleReceiver) ? 40 : 0;
    
    if (messageCost > 0 && (currentUser.coins || 0) < messageCost) {
      setCustomNotice({
        title: 'رصيد غير كافي 🪙',
        message: 'عذراً، رصيدك من الكوينز غير كافي لإرسال هذه الرسالة (تكلفة الرسالة 40 كوينز). يرجى الشحن عبر شبكة الوكلاء المعتمدين.'
      });
      return;
    }

    setNewPrivateMessageInput('');
    
    try {
      let isEncrypted = false;
      let rawCiphertext = '';
      let iv = '';
      
      if (isE2EEEnabled && privateKey) {
        const { ciphertext, iv: cryptoIv } = await encryptMessage(textToSend, privateKey);
        isEncrypted = true;
        rawCiphertext = ciphertext;
        iv = cryptoIv;
      }

      const messagePayload = {
        senderId: currentUser?.id,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        receiverId: activePrivateChatUser.id,
        receiverName: activePrivateChatUser.name,
        text: textToSend,
        isEncrypted,
        rawCiphertext,
        iv,
        isRead: false,
        timestamp: new Date().toISOString(),
        participants: [currentUser?.id, activePrivateChatUser.id]
      };
      
      // Send message to Firestore
      await addDoc(collection(db, "messages"), messagePayload);

      // Perform transaction if there is a cost
      if (messageCost > 0) {
        // 1. Update sender (male) coins and xp
        const updatedSenderCoins = (currentUser.coins || 0) - messageCost;
        const updatedSenderXp = (currentUser.xp || 0) + messageCost;
        const updatedSenderSenderXp = (currentUser.senderXp || 0) + messageCost;
        const updatedSenderLevel = getLevelFromXp(updatedSenderXp);

        const updatedSender = {
          ...currentUser,
          coins: updatedSenderCoins,
          xp: updatedSenderXp,
          senderXp: updatedSenderSenderXp,
          level: updatedSenderLevel
        };

        const senderRef = doc(db, "users", currentUser.id);
        await updateDoc(senderRef, {
          coins: updatedSenderCoins,
          xp: updatedSenderXp,
          senderXp: updatedSenderSenderXp,
          level: updatedSenderLevel
        });

        // 2. Fetch fresh receiver (female) data and update coins, diamonds, charmXp, and supporters
        const receiverRef = doc(db, "users", activePrivateChatUser.id);
        const recSnap = await getDoc(receiverRef);
        let recData = activePrivateChatUser;
        if (recSnap.exists()) {
          recData = { id: recSnap.id, ...recSnap.data() } as AppUser;
        }

        const updatedRecCoins = (recData.coins || 0) + messageCost;
        const updatedRecDiamonds = (recData.diamonds || 0) + messageCost;
        const updatedRecCharmXp = (recData.charmXp || 0) + messageCost;

        // Update supporters list
        const currentList = recData.supporters || [];
        const existingIndex = currentList.findIndex((s: any) => s.userId === currentUser.id);
        let newList = [...currentList];
        if (existingIndex !== -1) {
          newList[existingIndex] = {
            ...newList[existingIndex],
            amount: (newList[existingIndex].amount || 0) + messageCost,
            name: currentUser.name,
            avatar: currentUser.avatar
          };
        } else {
          newList.push({
            userId: currentUser.id,
            name: currentUser.name,
            avatar: currentUser.avatar,
            amount: messageCost
          });
        }
        newList.sort((a: any, b: any) => (b.amount || 0) - (a.amount || 0));

        await updateDoc(receiverRef, {
          coins: updatedRecCoins,
          diamonds: updatedRecDiamonds,
          charmXp: updatedRecCharmXp,
          supporters: newList
        });

        // 3. Update local react state
        setCurrentUser(updatedSender);
        setUsers(prev => prev.map(u => {
          if (u.id === currentUser.id) return updatedSender;
          if (u.id === activePrivateChatUser.id) {
            return {
              ...u,
              coins: updatedRecCoins,
              diamonds: updatedRecDiamonds,
              charmXp: updatedRecCharmXp,
              supporters: newList
            };
          }
          return u;
        }));
      }
    } catch (err) {
      console.error('Error sending private message to Firestore:', err);
    }
  };

  // Toggle Follow Handler
  const handleToggleFollow = async (targetUser: AppUser) => {
    if (!currentUser) {
      alert('يجب تسجيل الدخول أولاً للمتابعة!');
      return;
    }
    if (currentUser?.id === targetUser.id) {
      alert('لا يمكنك متابعة نفسك!');
      return;
    }
    
    try {
      const isFollowing = currentUser.following?.includes(targetUser.id);
      const userRef = doc(db, "users", currentUser?.id);
      const targetRef = doc(db, "users", targetUser.id);

      if (isFollowing) {
        await updateDoc(userRef, { following: arrayRemove(targetUser.id) });
        await updateDoc(targetRef, { followers: arrayRemove(currentUser?.id) });
      } else {
        await updateDoc(userRef, { following: arrayUnion(targetUser.id) });
        await updateDoc(targetRef, { followers: arrayUnion(currentUser?.id) });
      }
      // Real-time listeners will handle UI updates for setUsers and setCurrentUser
    } catch (err) {
      console.error('Error toggling follow in Firestore:', err);
    }
  };

  // Save Biography Handler
  const handleSaveBio = async () => {
    if (!currentUser) return;
    try {
      const userRef = doc(db, "users", currentUser?.id);
      await updateDoc(userRef, { bio: bioEditValue });
      setIsEditingBio(false);
    } catch (err) {
      console.error('Error saving bio in Firestore:', err);
    }
  };

  const handleUpdateAvatar = async (avatarBase64: string) => {
    if (!currentUser) return;
    try {
      const userRef = doc(db, "users", currentUser?.id);
      await updateDoc(userRef, { avatar: avatarBase64 });
    } catch (err) {
      console.error('Error updating avatar in Firestore:', err);
    }
  };

  const handleProfileAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300;
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
          handleUpdateAvatar(compressedBase64);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // End-to-End Cryptography Key Derivation & RSA Lifecycle
  useEffect(() => {
    if (!activeRoom) {
      setDerivedKey(null);
      return;
    }
    
    let isMounted = true;

    const initCryptoForRoom = async () => {
      try {
        addE2eeLog(`جاري تهيئة منظومة التشفير للغرفة [${activeRoom.name.replace(/☕|🎶|🔒/g, '').trim()}]...`);
        
        // Derive AES-GCM-256 Symmetric Key
        const key = await deriveRoomKey(e2eePassphrase, activeRoom.id);
        if (isMounted) {
          setDerivedKey(key);
          addE2eeLog(`تم اشتقاق مفتاح AES-GCM 256-bit باستخدام PBKDF2 (100K دورة) بنجاح!`);
        }
        
        // Generate RSA Keypair if not exists for peer identity
        if (!clientKeyPair && isMounted) {
          addE2eeLog(`جاري توليد زوج مفاتيح الهوية (RSA-OAEP 2048-bit) محلياً...`);
          const rsaPair = await generateRSAKeyPair();
          if (isMounted) {
            setClientKeyPair(rsaPair);
            const pubPEM = await exportPublicKey(rsaPair.publicKey);
            setClientPublicKeyBase64(pubPEM);
            addE2eeLog(`تم توليد مفتاح RSA العام للهوية وتصديره بنجاح!`);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          addE2eeLog(`⚠️ خطأ في العمليات التشفيرية: ${err.message}`);
        }
      }
    };
    
    initCryptoForRoom();

    return () => {
      isMounted = false;
    };
  }, [activeRoom?.id, e2eePassphrase]);

  // Derive Private Message Key
  useEffect(() => {
    let isMounted = true;
    const initPrivateKey = async () => {
      try {
        const key = await deriveRoomKey(e2eePassphrase, "GlobalPrivateChat");
        if (isMounted) {
          setPrivateKey(key);
        }
      } catch (err) {
        console.error("Error deriving global private message key:", err);
      }
    };
    initPrivateKey();
    return () => {
      isMounted = false;
    };
  }, [e2eePassphrase]);

  // Agora RTC engine handles all high-fidelity real-time audio publishing and playback.

  // Microphone capture and streaming over Agora RTC Engine


  // Track current user's specific seat status to prevent unnecessary microphone restarts when other users move
  const myCurrentSeat = activeRoom?.seats?.find(s => s.userId === currentUser?.id);
  const myCurrentSeatIndex = myCurrentSeat ? myCurrentSeat.index : null;
  const myCurrentSeatMuted = myCurrentSeat ? (myCurrentSeat.isMuted || myCurrentSeat.hostMuted) : true;

  // Automatically start or stop publishing audio based on seat occupancy and mute status
  useEffect(() => {
    if (!currentUser) return;
    const agoraManager = AgoraEngineManager.getInstance();
    if (isAgoraJoined && myCurrentSeatIndex !== null && !myCurrentSeatMuted) {
      console.log("[AGORA] Reactive Auto-Publishing microphone");
      agoraManager.startPublishing();
    } else {
      console.log("[AGORA] Reactive Auto-Stopping microphone");
      agoraManager.stopPublishing();
    }
  }, [myCurrentSeatIndex, myCurrentSeatMuted, currentUser?.id, isAgoraJoined]);

  // Voice capture effect
  useEffect(() => {
    let isMounted = true;
    const roomIdToJoin = activeRoom?.id;

    async function initAgora() {
      if (roomIdToJoin && currentUser) {
        try {
          console.log("[AGORA] Initializing Agora room:", roomIdToJoin);
          const agoraManager = AgoraEngineManager.getInstance();
          await agoraManager.joinAudioRoom(roomIdToJoin, currentUser?.id);
          if (isMounted) {
            console.log("[AGORA] Agora room join success:", roomIdToJoin);
            setIsAgoraJoined(true);
          }
        } catch (e) {
          console.error("[AGORA] Agora initialization/join failed", e);
        }
      }
    }
    initAgora();

    return () => {
      isMounted = false;
      setIsAgoraJoined(false);
      if (roomIdToJoin) {
        console.log("[AGORA] Leaving Agora room:", roomIdToJoin);
        AgoraEngineManager.getInstance().leaveAudioRoom().catch(err => {
          console.error("[AGORA] Error leaving Agora room", err);
        });
      }
    };
  }, [activeRoom?.id, currentUser?.id]);

  // Subscribe to real Agora volume updates to trigger the speaking indicators dynamically
  useEffect(() => {
    const agoraManager = AgoraEngineManager.getInstance();
    agoraManager.onVolumeIndicator((volumes) => {
      volumes.forEach((v) => {
        const rawUid = String(v.uid);
        const streamUserId = (rawUid === "0" || rawUid === "0") ? currentUserRef.current?.id : rawUid;
        const soundLevel = v.level;
        const currentActiveRoom = activeRoomRef.current;
        if (currentActiveRoom && currentActiveRoom.seats && streamUserId) {
          const seatIdx = currentActiveRoom.seats.findIndex(s => {
            if (!s.userId) return false;
            const seatUidStr = String(s.userId);
            const numUidStr = String(uidToNumeric(seatUidStr));
            return seatUidStr === streamUserId || numUidStr === streamUserId;
          });
          if (seatIdx !== -1) {
            if (soundLevel > 5) {
              setSpeakingSeatIndex(seatIdx);
              setSpeakingVolume(Math.min(100, Math.round(soundLevel)));
              
              if (!(window as any).speakingTimers) (window as any).speakingTimers = {};
              if ((window as any).speakingTimers[streamUserId]) {
                clearTimeout((window as any).speakingTimers[streamUserId]);
              }
              (window as any).speakingTimers[streamUserId] = setTimeout(() => {
                setSpeakingSeatIndex((prev) => (prev === seatIdx ? null : prev));
                setSpeakingVolume(0);
              }, 600);
            }
          }
        }
      });
    });

    return () => {
      agoraManager.onVolumeIndicator(() => {});
    };
  }, []);


  // States relocated to the top of the App component to prevent block-scoped reference errors.

  const isUnmutedOnSeat = !!(
    activeRoom &&
    currentUser &&
    currentScreen === 'room' &&
    myCurrentSeatIndex !== null &&
    !myCurrentSeatMuted
  );

  useEffect(() => {
    if (!isUnmutedOnSeat) {
      setRealUserMicSpeaking(false);
      setRealUserMicVolume(0);
    } else {
      setRealUserMicSpeaking(true);
      setRealUserMicVolume(50);
    }
  }, [isUnmutedOnSeat]);



  // Room Settings Drawer states
  const [isRoomSettingsDrawerOpen, setIsRoomSettingsDrawerOpen] = useState(false);
  const [roomSettingsName, setRoomSettingsName] = useState('');
  const [roomSettingsAvatar, setRoomSettingsAvatar] = useState('');
  const [isUpdatingRoomSettings, setIsUpdatingRoomSettings] = useState(false);
  const [roomSettingsError, setRoomSettingsError] = useState('');

  const handleRoomAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setRoomSettingsError('يرجى اختيار ملف صورة صالح.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 200;
        const MAX_HEIGHT = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
          setRoomSettingsAvatar(compressedBase64);
        } else {
          setRoomSettingsAvatar(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    // Reset file input value to allow selecting same file/refreshing state
    e.target.value = '';
  };

  // Native Mobile UI States (Bottom sheet draw lists)
  const [isGiftDrawerOpen, setIsGiftDrawerOpen] = useState(false);
  const [activeGiftCategory, setActiveGiftCategory] = useState<string>('اساسي');
  const [giftQuantity, setGiftQuantity] = useState<number>(1);
  const [showGiftQuantitySelector, setShowGiftQuantitySelector] = useState(false);
  const [showLeaveRoomDialog, setShowLeaveRoomDialog] = useState(false);
  const [isGameSheetOpen, setIsGameSheetOpen] = useState(false);
  const [activeGameUrl, setActiveGameUrl] = useState<string | null>(null);

  const [isMicPermissionModalOpen, setIsMicPermissionModalOpen] = useState(false);
  const loadedUserIdentityRef = useRef<string | null>(null);

  useEffect(() => {
    const handleMicDenied = () => {
      setIsMicPermissionModalOpen(true);
    };
    window.addEventListener('agora-mic-denied', handleMicDenied);
    return () => {
      window.removeEventListener('agora-mic-denied', handleMicDenied);
    };
  }, []);

  useEffect(() => {
    // Push an initial state to trap the back button globally
    window.history.pushState({ app: 'prevent_exit' }, '');
    
    const handlePopState = (e: PopStateEvent) => {
      // Prevent browser from going back and exiting the app
      e.preventDefault();
      window.history.pushState({ app: 'prevent_exit' }, '');
      
      const screen = currentScreenRef.current;
      if (screen === 'room') {
        setShowLeaveRoomDialog(true);
      } else if (screen !== 'explore' && screen !== 'login') {
        setCurrentScreen('explore');
      }
      // If explore or login, we just trapped the back button so it does nothing (prevents exiting app)
    };
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (currentScreenRef.current === 'room') {
        const msg = "هل أنت متأكد أنك تريد مغادرة الغرفة الصوتية؟";
        e.preventDefault();
        e.returnValue = msg;
        return msg;
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    if (isGameSheetOpen) {
      const user = currentUser || lastValidUserRef.current;
      if (user && user.displayId) {
        const userIdentityKey = `${user.id || user.displayId}_${user.name}_${user.avatar || ''}`;
        
        // If there's no URL yet OR the user identity changed, regenerate completely!
        if (!activeGameUrl || loadedUserIdentityRef.current !== userIdentityKey) {
          loadedUserIdentityRef.current = userIdentityKey;
          const gameHost = 'https://chghr.onrender.com';
          const url = `${gameHost}/game.html?displayId=${user.displayId}&userId=${user.displayId}&name=${encodeURIComponent(user.name || "")}&avatarUrl=${encodeURIComponent(user.avatar || "")}&avatar=${encodeURIComponent(user.avatar || "")}&coins=${user.coins}&balance=${user.coins}`;
          setActiveGameUrl(url);
        } else if (activeGameUrl) {
          // If the URL is already active, just send a postMessage to sync balance dynamically
          const iframe = document.querySelector('iframe[title="Food Fortune Wheel Game"]') as HTMLIFrameElement;
          if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
              type: 'SYNC_BALANCE',
              payload: { balance: user.coins }
            }, '*');
          }
        }
      } else {
        setActiveGameUrl(null);
        loadedUserIdentityRef.current = null;
      }
    } else {
      setActiveGameUrl(null);
      loadedUserIdentityRef.current = null;
    }
  }, [isGameSheetOpen, currentUser, activeGameUrl]);

  const [isQueueDrawerOpen, setIsQueueDrawerOpen] = useState(false);
  const [isNoiseCancellation, setIsNoiseCancellation] = useState(true);
  const [isEchoCancellation, setIsEchoCancellation] = useState(true);
  const [isVoiceConnected, setIsVoiceConnected] = useState(true);
  const [isAdminDrawerOpen, setIsAdminDrawerOpen] = useState(false);
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null);
  const [selectedRecipientSeatIndices, setSelectedRecipientSeatIndices] = useState<Array<number | 'all'>>([]);
  const [dashboardTab, setDashboardTab] = useState<'party' | 'games' | 'explore' | 'messages' | 'profile'>('party');
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const tabContent = document.getElementById('dashboard-tab-content');
    if (tabContent) {
      tabContent.scrollTop = 0;
    }
    const smartphoneScreen = document.getElementById('smartphone-screen');
    if (smartphoneScreen) {
      smartphoneScreen.scrollTop = 0;
    }
    document.querySelectorAll('.overflow-y-auto, .overflow-auto').forEach(el => {
      el.scrollTop = 0;
    });
  }, [dashboardTab, currentScreen]);
  const [partySubTab, setPartySubTab] = useState<'my_rooms' | 'hashtag' | 'newcomers' | 'match'>('hashtag');
  const [exploreSearchQuery, setExploreSearchQuery] = useState('');
  const [visitedRoomIds, setVisitedRoomIds] = useState<string[]>([]);

  // Load visited rooms history on mount or when user changes
  useEffect(() => {
    if (currentUser?.id) {
      try {
        const key = `visited_rooms_${currentUser.id}`;
        const visited = JSON.parse(localStorage.getItem(key) || '[]');
        setVisitedRoomIds(visited);
      } catch (e) {
        console.error(e);
      }
    }
  }, [currentUser?.id]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'OPEN_WALLET') {
        setIsGameSheetOpen(false);
        setCurrentScreen('explore');
        setDashboardTab('profile');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('OPEN_WALLET_VIEW'));
        }, 100);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const fetchLiveLeaderboard = async () => {
    // Firestore real-time listeners handle this now
  };

  // Real-time synchronization of leaderboard and clans using Firestore
  useEffect(() => {
    if (currentScreen !== 'explore' || dashboardTab !== 'explore') return;

    setIsLeaderboardLoading(true);
    
    // Top Senders
    const sendersQuery = query(collection(db, "users"), orderBy("xp", "desc"), where("xp", ">", 0));
    const unsubscribeSenders = onSnapshot(sendersQuery, (snapshot) => {
      const topSenders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLiveLeaderboard(prev => ({ ...prev, senders: topSenders } as any));
      setIsLeaderboardLoading(false);
    }, (error) => {
      console.error("Error syncing senders leaderboard:", error);
      const errMsg = error?.message || '';
      if (errMsg.includes('Quota') || errMsg.includes('quota') || error?.code === 'resource-exhausted') {
        (window as any).__markQuotaExceeded?.();
      }
    });

    // Top Clans
    const clansQuery = query(collection(db, "clans"), orderBy("totalXp", "desc"));
    const unsubscribeClans = onSnapshot(clansQuery, (snapshot) => {
      const topClans = snapshot.docs.map(doc => ({ clan_id: doc.id, ...doc.data() }));
      setLiveLeaderboard(prev => ({ ...prev, clans: topClans } as any));
    }, (error) => {
      console.error("Error syncing clans leaderboard:", error);
      const errMsg = error?.message || '';
      if (errMsg.includes('Quota') || errMsg.includes('quota') || error?.code === 'resource-exhausted') {
        (window as any).__markQuotaExceeded?.();
      }
    });

    return () => {
      unsubscribeSenders();
      unsubscribeClans();
    };
  }, [currentScreen, dashboardTab]);

  // Real-time synchronization for Agents Hub
  useEffect(() => {
    const agentsQuery = query(collection(db, "agents_hub"), where("is_active", "==", true));
    const unsubscribe = onSnapshot(agentsQuery, (snapshot) => {
      let fetchedAgents = snapshot.docs.map(doc => ({ agent_id: doc.id, ...doc.data() })) as any;
      
      // Also include any users who are marked as agents from users list
      users.forEach(u => {
        if (u.isAgent || u.role === 'authorized_coin_agent' || u.role === 'agent') {
          const agentId = u.displayId || u.id;
          const existing = fetchedAgents.find((a: any) => a.agent_id === agentId || a.agent_id === u.id || a.agent_id === u.displayId);
          if (!existing) {
            fetchedAgents.push({
              agent_id: agentId,
              agent_name: u.name || 'وكيل معتمد',
              contact_whatsapp: u.whatsapp || u.phone || '+201000000000',
              avatar: u.avatar,
              is_active: true
            });
          } else {
            if (!existing.avatar && u.avatar) existing.avatar = u.avatar;
            if (!existing.agent_name && u.name) existing.agent_name = u.name;
          }
        }
      });

      if (currentUser?.id) {
        const exists = fetchedAgents.some((a: any) => a.agent_id === currentUser.id || a.agent_id === currentUser.displayId);
        if (!exists && (currentUser.isAgent || currentUser.role === 'authorized_coin_agent')) {
          fetchedAgents.push({
            agent_id: currentUser.displayId || currentUser.id,
            agent_name: currentUser.name || 'الوكيل الحالي',
            contact_whatsapp: currentUser.whatsapp || currentUser.phone || '+201000000000',
            avatar: currentUser.avatar,
            is_active: true
          });
        }
      }
      setAgentsHub(fetchedAgents);
    }, (error) => {
      console.error("Error syncing agents hub:", error);
      let fallback: any[] = [];
      users.forEach(u => {
        if (u.isAgent || u.role === 'authorized_coin_agent' || u.role === 'agent') {
          fallback.push({
            agent_id: u.displayId || u.id,
            agent_name: u.name || 'وكيل معتمد',
            contact_whatsapp: u.whatsapp || u.phone || '+201000000000',
            avatar: u.avatar,
            is_active: true
          });
        }
      });
      if (currentUser?.id && fallback.length === 0) {
        fallback.push({
          agent_id: currentUser.displayId || currentUser.id,
          agent_name: currentUser.name || 'الوكيل الحالي',
          contact_whatsapp: currentUser.whatsapp || currentUser.phone || '+201000000000',
          avatar: currentUser.avatar,
          is_active: true
        });
      }
      setAgentsHub(fallback);
      const errMsg = error?.message || '';
      if (errMsg.includes('Quota') || errMsg.includes('quota') || error?.code === 'resource-exhausted') {
        (window as any).__markQuotaExceeded?.();
      }
    });
    return () => unsubscribe();
  }, [users, currentUser?.isAgent, currentUser?.id, currentUser?.name, currentUser?.displayId, currentUser?.whatsapp, currentUser?.phone, currentUser?.avatar]);

  // Real-time synchronization for Host Salaries (Withdrawal requests)
  useEffect(() => {
    if (!currentUser?.id) return;
    const isAuthorized = currentUser.displayId?.includes('صدى العرب') || currentUser.role === 'admin';
    if (!isAuthorized) return;

    const q = query(
      collection(db, "withdrawal_requests"),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAdminWithdrawalRequests(requests);
    }, (error) => {
      console.error("Error listening to withdrawal requests:", error);
    });

    return () => unsubscribe();
  }, [currentUser?.id, currentUser?.role, currentUser?.displayId]);

  // Real-time synchronization for Admin - all agencies
  useEffect(() => {
    if (!currentUser?.id) return;
    const isAuthorized = currentUser.displayId?.includes('صدى العرب') || currentUser.role === 'admin';
    if (!isAuthorized) return;

    const q = query(collection(db, "agencies"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllAgencies(list);
    }, (error) => {
      console.error("Error listening to agencies:", error);
    });

    return () => unsubscribe();
  }, [currentUser?.id, currentUser?.role, currentUser?.displayId]);

  // Fetch live leaderboard and clans when entering the Explore tab
  useEffect(() => {
    if (currentScreen === 'explore' && dashboardTab === 'explore') {
      fetchLiveLeaderboard();
    }
  }, [currentScreen, dashboardTab, exploreSubTab]);

  // Real-time Community Posts States & Listener
  const [communityPosts, setCommunityPosts] = useState<any[]>([]);
  const [newPostText, setNewPostText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [showCommentsForPostId, setShowCommentsForPostId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState<{[key: string]: string}>({});

  useEffect(() => {
    const q = query(collection(db, "community_posts"), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const posts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort in descending order (newest first)
      const sorted = posts.sort((a: any, b: any) => {
        const timeA = typeof a.timestamp === 'number' ? a.timestamp : (parseInt(a.timestamp) || 0);
        const timeB = typeof b.timestamp === 'number' ? b.timestamp : (parseInt(b.timestamp) || 0);
        return timeB - timeA;
      });
      setCommunityPosts(sorted);
    }, (error) => {
      console.error("Error listening to community posts:", error);
    });
    return () => unsubscribe();
  }, []);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostText.trim() || !currentUser) return;

    setIsPosting(true);
    const postId = `post_${Date.now()}`;
    const postData = {
      id: postId,
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      userLevel: currentUser.level,
      vipLevel: currentUser.vipLevel || 0,
      text: newPostText,
      timestamp: Date.now(),
      likes: 0,
      likedBy: [],
      comments: []
    };

    try {
      await setDoc(doc(db, "community_posts", postId), postData);
      setNewPostText('');
    } catch (err) {
      console.error('Error creating post:', err);
    } finally {
      setIsPosting(false);
    }
  };

  const handleToggleLikePost = async (post: any) => {
    if (!currentUser) return;
    try {
      const currentLikedBy = post.likedBy || [];
      const alreadyLiked = currentLikedBy.includes(currentUser.id);
      const updatedLikedBy = alreadyLiked 
        ? currentLikedBy.filter((uid: string) => uid !== currentUser.id)
        : [...currentLikedBy, currentUser.id];
      const newLikesCount = alreadyLiked 
        ? Math.max(0, (post.likes || 0) - 1)
        : (post.likes || 0) + 1;

      const postRef = doc(db, "community_posts", post.id);
      await updateDoc(postRef, {
        likes: newLikesCount,
        likedBy: updatedLikedBy
      });
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!currentUser) return;
    try {
      const postRef = doc(db, "community_posts", postId);
      await deleteDoc(postRef);
    } catch (err) {
      console.error('Error deleting post:', err);
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!currentUser) return;
    const commentTxt = newCommentText[postId];
    if (!commentTxt || !commentTxt.trim()) return;

    try {
      const postRef = doc(db, "community_posts", postId);
      const targetPost = communityPosts.find(p => p.id === postId);
      if (!targetPost) return;

      const newComment = {
        id: `comment_${Date.now()}`,
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatar,
        text: commentTxt,
        timestamp: Date.now()
      };

      const updatedComments = [...(targetPost.comments || []), newComment];
      await updateDoc(postRef, {
        comments: updatedComments
      });

      setNewCommentText(prev => ({ ...prev, [postId]: '' }));
    } catch (err) {
      console.error('Error adding comment:', err);
    }
  };

  const [isDailyBonusOpen, setIsDailyBonusOpen] = useState(false);
  const [dailyBonusClaimed, setDailyBonusClaimed] = useState(false);
  const [driftingBottleMode, setDriftingBottleMode] = useState<'idle' | 'writing' | 'reading'>('idle');
  const [bottleMessage, setBottleMessage] = useState('');
  const [pickedBottle, setPickedBottle] = useState<string | null>(null);
  const [supportChatOpen, setSupportChatOpen] = useState(false);
  const [supportInput, setSupportInput] = useState('');
  
  // Real Firestore Support States
  const [activeSupportTicket, setActiveSupportTicket] = useState<SupportTicket | null>(null);
  const [supportMessages, setSupportMessages] = useState<SupportTicketMessage[]>([]);
  
  // Admin Support States
  const [isSupportAdminModalOpen, setIsSupportAdminModalOpen] = useState(false);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [activeAdminTicket, setActiveAdminTicket] = useState<SupportTicket | null>(null);
  const [activeTicketMessages, setActiveTicketMessages] = useState<SupportTicketMessage[]>([]);

  useEffect(() => {
    // ---------------- Active Admin Ticket Messages Listener ----------------
    let unsubscribe = () => {};
    if (activeAdminTicket) {
      const messagesQuery = query(
        collection(db, "support_tickets", activeAdminTicket.id, "messages"),
        orderBy("timestamp", "asc")
      );
      unsubscribe = onSnapshot(messagesQuery, (snap) => {
        const msgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SupportTicketMessage[];
        setActiveTicketMessages(msgs);
      }, (error) => {
        console.error("Error syncing active admin ticket messages:", error);
        const errMsg = error?.message || '';
        if (errMsg.includes('Quota') || errMsg.includes('quota') || error?.code === 'resource-exhausted') {
          (window as any).__markQuotaExceeded?.();
        }
      });
    }
    return () => unsubscribe();
  }, [activeAdminTicket]);
  const [adminSupportInput, setAdminSupportInput] = useState('');

  // Dynamic Device Type Detection
  const [deviceInfo, setDeviceInfo] = useState({ isMobile: false, platform: 'desktop', modelName: 'Desktop' });

  useEffect(() => {
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isAndroid = /Android/i.test(ua);
    const isMobile = isIOS || isAndroid || window.innerWidth < 768;
    
    let modelName = 'جهاز كمبيوتر (Desktop)';
    if (isIOS) {
      if (/iPhone/.test(ua)) {
        modelName = 'آيفون (iPhone)';
      } else if (/iPad/.test(ua)) {
        modelName = 'آيباد (iPad)';
      } else {
        modelName = 'جهاز Apple iOS';
      }
    } else if (isAndroid) {
      if (/Samsung|SM-|SAMSUNG/i.test(ua)) {
        modelName = 'سامسونج (Samsung)';
      } else if (/Huawei|HUAWEI/i.test(ua)) {
        modelName = 'هواوي (Huawei)';
      } else if (/Xiaomi|Redmi|MI/i.test(ua)) {
        modelName = 'شاومي (Xiaomi)';
      } else {
        modelName = 'أندرويد (Android)';
      }
    }

    setDeviceInfo({
      isMobile,
      platform: isIOS ? 'ios' : isAndroid ? 'android' : 'desktop',
      modelName
    });
  }, []);
  
  // Interactive Arabic Room Live Chat messages & Input State
  const [chatInputValue, setChatInputValue] = useState('');
  const [roomMessages, setRoomMessages] = useState<Array<{ id?: string; sender: string; text: string; color?: string; type?: 'chat' | 'system' | 'vip'; isEncrypted?: boolean; rawCiphertext?: string; iv?: string; createdAt?: string }>>([
    { sender: 'نظام المجلس', text: 'مرحباً بكم في صدى العرب! يرجى الالتزام بالاحترام المتبادل داخل مجالسنا الموقرة.', color: 'text-purple-400 font-bold', type: 'system' },
    { sender: 'خالد الحربي', text: 'السلام عليكم ورحمة الله، حياكم الله جميعاً بالمجلس الدافئ.', color: 'text-amber-400', type: 'chat' },
  ]);

  // AI Voice Moderation & Content Sentinel State
  const [isAiModerationEnabled, setIsAiModerationEnabled] = useState(true);
  const [aiModerationLog, setAiModerationLog] = useState<Array<{
    id: string;
    timestamp: string;
    userName: string;
    userId: string;
    textDetected: string;
    violationType: string;
    actionTaken: string;
  }>>([
    {
      id: "mod-init",
      timestamp: new Date().toLocaleTimeString('ar-EG'),
      userName: "الذكاء الاصطناعي",
      userId: "system",
      textDetected: "بدء تشغيل نظام الرقابة الصوتية ونقش المخالفات (SST Moderation Engine)",
      violationType: "حالة النظام",
      actionTaken: "مراقبة مستمرة نشطة ✅"
    }
  ]);
  const [lastSpeechTranscript, setLastSpeechTranscript] = useState("جاري الاستماع للأصوات المفتوحة وتحليلها...");
  const [speechWaveformActive, setSpeechWaveformActive] = useState(false);
  const [isAiSimulating, setIsAiSimulating] = useState(false);

  // Time Formatter Effect
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'م' : 'ص';
      hours = hours % 12;
      hours = hours ? hours : 12; // 12 hour format
      setCurrentTime(`${hours}:${minutes} ${ampm}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 15000);
    return () => clearInterval(timer);
  }, []);

  // Dynamic Room Interactive Live Streams simulation - DISABLED BY USER REQUEST FOR PURE REAL-TIME EXPERIENCE
  useEffect(() => {
    // Simulated background event triggers have been disabled to ensure 100% real interactions and real user accounts.
  }, []);

  // Trigger floating gift animation
  const spawnFloatingGift = (icon: string) => {
    const id = floatingIdCounter.current++;
    // Random position across the center of vertical mobile screen
    const x = 30 + Math.random() * 40; // percentage
    const y = 50 + Math.random() * 20; // percentage
    setFloatingGifts((prev) => [...prev, { id, icon, x, y }]);
    
    // Auto remove after animation completes
    setTimeout(() => {
      setFloatingGifts((prev) => prev.filter((item) => item.id !== id));
    }, 2000);
  };

  // Trigger SVGA file playback with full screen canvas rendering and clearsAfterStop
  const triggerSvgaPlay = (url: string) => {
    console.log("[SVGA] Queueing SVGA animation:", url);
    svgaQueueRef.current.push(url);
    processSvgaQueue();
  };

  const processSvgaQueue = () => {
    if (isSvgaPlayingRef.current || svgaQueueRef.current.length === 0) {
      return;
    }

    const nextUrl = svgaQueueRef.current.shift();
    if (!nextUrl) return;

    isSvgaPlayingRef.current = true;

    // Support MP4 video files as animation
    if (nextUrl.toLowerCase().endsWith('.mp4') || nextUrl.includes('.mp4')) {
      console.log("[Video] Playing MP4 animation:", nextUrl);
      setActiveVideoUrl(nextUrl);
      return;
    }

    setActiveSvgaUrl(nextUrl);

    // Give React a brief moment to ensure canvas is rendered and ref attached
    setTimeout(() => {
      const canvas = svgaCanvasRef.current;
      if (!canvas) {
        console.warn("[SVGA] Canvas ref not found, skipping animation.");
        isSvgaPlayingRef.current = false;
        setActiveSvgaUrl(null);
        setTimeout(processSvgaQueue, 50);
        return;
      }

      try {
        const ParserClass = SVGA.Parser || (SVGA as any).default?.Parser;
        const PlayerClass = SVGA.Player || (SVGA as any).default?.Player;

        if (!ParserClass || !PlayerClass) {
          throw new Error("SVGA Player/Parser classes are not loaded from dependency.");
        }

        const parser = new ParserClass();
        const player = new PlayerClass(canvas);

        // Adjust resolution dynamically to match actual rendering size (fullscreen / match parent)
        canvas.width = canvas.clientWidth || window.innerWidth;
        canvas.height = canvas.clientHeight || window.innerHeight;

        player.loops = 1;
        player.clearsAfterStop = true;
        player.fillMode = "AspectFill"; // full screen / match parent

        player.onFinished(() => {
          console.log("[SVGA] SVGA Animation playback complete.");
          player.stopAnimation();
          isSvgaPlayingRef.current = false;
          setActiveSvgaUrl(null);
          // Load next animation in the queue
          setTimeout(processSvgaQueue, 50);
        });

        parser.load(nextUrl, (videoItem: any) => {
          player.setVideoItem(videoItem);
          player.startAnimation();
        }, (error: any) => {
          console.error("[SVGA] Parser failed to load SVGA asset URL:", nextUrl, error);
          isSvgaPlayingRef.current = false;
          setActiveSvgaUrl(null);
          setTimeout(processSvgaQueue, 50);
        });
      } catch (err) {
        console.error("[SVGA] Error initializing SVGA player:", err);
        isSvgaPlayingRef.current = false;
        setActiveSvgaUrl(null);
        setTimeout(processSvgaQueue, 50);
      }
    }, 150);
  };

  // Trigger VIP Entrance banner
  const triggerVipEntrance = (userName: string, level: number, roomId?: string) => {
    setVipEntrance({ active: true, userName, level });
    
    const targetRoomId = roomId || activeRoom?.id;
    if (targetRoomId) {
      const messagesRef = collection(db, "voice_rooms", targetRoomId, "chat_messages");
      addDoc(messagesRef, {
        sender: 'دخول VIP',
        text: `👑 دخل الـ VIP ${userName} (مستوى ${level}) إلى المجلس! حيو الفخم!`,
        color: 'text-amber-300 font-extrabold animate-pulse',
        type: 'vip',
        createdAt: new Date().toISOString()
      }).catch(err => console.error("Error writing VIP entrance to Firestore:", err));
    } else {
      // Append VIP Entrance announcement to live chat locally if roomId is not available
      setRoomMessages((prev) => [
        ...prev,
        {
          sender: 'دخول VIP',
          text: `👑 دخل الـ VIP ${userName} (مستوى ${level}) إلى المجلس! حيو الفخم!`,
          color: 'text-amber-300 font-extrabold animate-pulse',
          type: 'vip',
        },
      ]);
    }

    setTimeout(() => {
      setVipEntrance(null);
    }, 4500);
  };

  // Setup initial user levels or auto welcomes
  const handleSignUpAndLogin = async (nameToUse: string) => {
    const finalName = nameToUse.trim() || 'فارس الأصيل';
    // Generate simple stable numeric ID based on name or hash
    const userId = (Math.abs(finalName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 900) + 1000;
    const finalId = userId.toString();

    try {
      const userRef = doc(db, "users", finalId);
      const docSnap = await getDoc(userRef);
      
      if (docSnap.exists()) {
        const existingData = docSnap.data() as AppUser;
        setCurrentUser({ ...existingData, id: finalId });
        setCurrentScreen('explore');
      } else {
        const newUser: AppUser = {
          id: finalId,
          name: finalName,
          avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${finalId}`,
          level: 1,
          coins: 0,
          xp: 0,
          role: 'user',
          bio: 'عضو جديد في صدى العرب ☕',
          followers: [],
          following: [],
          badges: [],
          createdAt: new Date().toISOString()
        };
        await setDoc(userRef, newUser);
        setCurrentUser(newUser);
        setCurrentScreen('explore');
      }
    } catch (e) {
      console.error('Error during manual signup in Firestore:', e);
    }

    // Clean input fields
    setConfirmPassword('');
    setPhoneNumber('');
    setSmsOtp('');
    setEmail('');
    setPassword('');
    setShowOtpField(false);
    setLoginMethod(null);
  };

  // Handle entering room
  const handleEnterRoom = (room: VoiceRoom) => {
    // Resume/init Agora inside user gesture
    AgoraEngineManager.getInstance().initEngine().catch(() => {});

    // Always enter directly as requested (make all rooms public)
    loadActiveRoom(room);
  };

  const loadActiveRoom = (room: VoiceRoom) => {
    isLeavingRoomRef.current = false;
    const currentUserId = auth.currentUser?.uid || currentUser?.id;
    if (currentUserId && room.bannedUsers && room.bannedUsers[currentUserId]) {
      const banExpiration = new Date(room.bannedUsers[currentUserId]);
      if (banExpiration > new Date()) {
        setCustomNotice({
          title: "دخول مرفوض",
          message: `أنت مطرود من هذه الغرفة حتى ${banExpiration.toLocaleString('ar-EG')}`
        });
        return;
      }
    }

    const sanitizedRoom = {
      ...room,
      seats: padSeats(room.seats)
    };
    setActiveRoom(sanitizedRoom);
    
    // Play room join sound and unlock AudioContext
    soundService.unlockAudio();
    soundService.playRoomJoinSound();
    if ((currentUser as any)?.isVip || (currentUser?.level && currentUser.level >= 10)) {
      setTimeout(() => {
        soundService.playVipEntranceSound();
      }, 250);
    }
    if (currentUser && currentUserId) {
      // Add to participants sub-collection
      const participantRef = doc(db, "voice_rooms", room.id, "participants", currentUserId);
      setDoc(participantRef, {
        id: currentUserId,
        name: currentUser.name,
        avatar: currentUser.avatar,
        joinedAt: serverTimestamp()
      }).catch(err => console.error("Error adding participant:", err));

      // Increment activeUsersCount
      updateDoc(doc(db, "voice_rooms", room.id), {
        activeUsersCount: increment(1)
      }).catch(err => console.error("Error incrementing user count:", err));

      // Save visited room ID to history
      if (room.id) {
        try {
          const key = `visited_rooms_${currentUserId}`;
          const visited = JSON.parse(localStorage.getItem(key) || '[]');
          if (!visited.includes(room.id)) {
            visited.push(room.id);
            localStorage.setItem(key, JSON.stringify(visited));
            setVisitedRoomIds(visited);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    setRoomMessages([
      { sender: 'نظام المجلس', text: 'مرحباً بكم في صدى العرب! يرجى الالتزام بالاحترام المتبادل داخل مجالسنا الموقرة.', color: 'text-purple-400 font-bold', type: 'system' }
    ]);
    setCurrentScreen('room');

    // Trigger entrance animation for high-level user
    if (currentUser && currentUser.level >= 10) {
      triggerVipEntrance(currentUser.name, currentUser.level, room.id);
    }
  };

  const handleVerifyRoomPassword = () => {
    if (selectedLockedRoom) {
      if (roomPasswordInput === selectedLockedRoom.password) {
        const roomToLoad = selectedLockedRoom;
        setSelectedLockedRoom(null);
        loadActiveRoom(roomToLoad);
      } else {
        setRoomPasswordError(true);
      }
    }
  };

  // Seat Management Actions
  const handleSeatClick = (seatIndex: number) => {
    if (!activeRoom || !currentUser) return;

    // Resume/init Agora inside user gesture
    AgoraEngineManager.getInstance().initEngine().catch(() => {});

    const seat = activeRoom?.seats?.[seatIndex];
    const isAuthorizedHost = checkIfOwner(activeRoom);

    setIsInviteListOpen(false); // Reset invite mode

    // If seat is occupied by anyone, show the custom profile modal instead of seat actions
    if (seat?.userId) {
      const occupant = users?.find(u => u.id === seat.userId) || (currentUser && seat.userId === currentUser?.id ? currentUser : null);
      if (occupant) {
        setSelectedSeatUser({ user: occupant, seatIndex: seatIndex });
      }
      return;
    }

    // If seat is empty and locked, and user is not host -> show locked warning
    if (seat && !seat.userId && seat.isLocked && !isAuthorizedHost) {
      setCustomNotice({
        title: 'المقعد مغلق 🔒',
        message: 'هذا المقعد مغلق ومحجوز من قبل صاحب المجلس، ولا يمكن الجلوس عليه بدون صلاحية إشراف.'
      });
      return;
    }

    // Otherwise (empty and unlocked, or host), open the native-styled options sheet for empty seat actions (like sit or invite)
    setSelectedSeatIndex(seatIndex);
  };

  // Perform Host Seat Management operations
  const handleHostAction = async (action: 'mute' | 'lock' | 'kick' | 'kick_1m' | 'kick_1h' | 'kick_1w' | 'leave') => {
    if (!activeRoom || selectedSeatIndex === null || !currentUser) return;

    const seat = activeRoom?.seats?.[selectedSeatIndex];
    const isAuthorizedHost = checkIfOwner(activeRoom);

    // Safeguard: only owner/host can mute, lock, or kick others
    if (action !== 'leave' && !isAuthorizedHost) {
      setCustomNotice({
        title: 'صلاحية مرفوضة ⚠️',
        message: 'عذراً، هذه الصلاحية مخصصة لمالك المجلس أو المشرف المعتمد فقط.'
      });
      return;
    }

    let updatedSeats = [...(activeRoom?.seats || [])];
    let updatedBannedUsers = { ...(activeRoom?.bannedUsers || {}) };

    if (action === 'mute') {
      const isCurrentlyHostMuted = seat.hostMuted || false;
      if (isCurrentlyHostMuted) {
        // Unmuting: lift hostMuted restriction and fully unmute/turn on the microphone
        updatedSeats[selectedSeatIndex] = { ...seat, isMuted: false, hostMuted: false };
      } else {
        // Muting: force mute (isMuted: true and hostMuted: true)
        updatedSeats[selectedSeatIndex] = { ...seat, isMuted: true, hostMuted: true };
      }
    } else if (action === 'lock') {
      updatedSeats[selectedSeatIndex] = { ...seat, isLocked: !seat.isLocked, userId: null };
    } else if (action === 'kick') {
      updatedSeats[selectedSeatIndex] = { ...seat, userId: null };
    } else if (action === 'kick_1m' || action === 'kick_1h' || action === 'kick_1w') {
      if (seat.userId) {
        let durationMin = 1;
        if (action === 'kick_1h') durationMin = 60;
        if (action === 'kick_1w') durationMin = 60 * 24 * 7;
        const expiration = new Date();
        expiration.setMinutes(expiration.getMinutes() + durationMin);
        updatedBannedUsers[seat.userId] = expiration.toISOString();

        // Immediately delete from participants list on Firestore
        const participantRef = doc(db, "voice_rooms", activeRoom.id, "participants", seat.userId);
        deleteDoc(participantRef).catch(err => console.error("Error removing participant on seat ban:", err));
      }
      updatedSeats[selectedSeatIndex] = { ...seat, userId: null };
    } else if (action === 'leave') {
      // Current user leaves seat
      if (seat.userId === currentUser?.id) {
        updatedSeats[selectedSeatIndex] = { ...seat, userId: null };
      }
    }

    // Audio stream management
    if (seat.userId === currentUser?.id && updatedSeats[selectedSeatIndex].userId === null) {
      const agoraManager = AgoraEngineManager.getInstance();
      agoraManager.stopPublishing();
    }

    const updatedRoom = { ...activeRoom, seats: updatedSeats, bannedUsers: updatedBannedUsers };
    setActiveRoom(updatedRoom);
    setRooms(rooms?.map(r => r.id === activeRoom.id ? updatedRoom : r));
    setSelectedSeatIndex(null);

    // Real-time synchronization broadcast with activeUsersCount decrement on ban
    const isBanAction = action === 'kick_1m' || action === 'kick_1h' || action === 'kick_1w';
    const updatePayload: any = { seats: updatedSeats, bannedUsers: updatedBannedUsers };
    if (isBanAction) {
      updatePayload.activeUsersCount = increment(-1);
    }
    await updateDoc(doc(db, "voice_rooms", activeRoom.id), updatePayload);
  };

  const handleLockAllSeats = async () => {
    if (!activeRoom || !currentUser) return;
    const updatedSeats = activeRoom.seats.map((seat) => {
      if (seat.userId === currentUser?.id) {
        return { ...seat, isLocked: false };
      }
      return { ...seat, isLocked: true, userId: null };
    });
    const updatedRoom = { ...activeRoom, seats: updatedSeats };
    setActiveRoom(updatedRoom);
    setRooms(rooms?.map(r => r.id === activeRoom.id ? updatedRoom : r));
    setSelectedSeatIndex(null);
    await updateDoc(doc(db, "voice_rooms", activeRoom.id), { seats: updatedSeats });
  };

  const handleLockAllEmptySeats = async () => {
    if (!activeRoom) return;
    const updatedSeats = activeRoom.seats.map((seat) => {
      if (seat.userId === null) {
        return { ...seat, isLocked: true };
      }
      return seat;
    });
    const updatedRoom = { ...activeRoom, seats: updatedSeats };
    setActiveRoom(updatedRoom);
    setRooms(rooms?.map(r => r.id === activeRoom.id ? updatedRoom : r));
    setSelectedSeatIndex(null);
    await updateDoc(doc(db, "voice_rooms", activeRoom.id), { seats: updatedSeats });
  };

  const handleUnlockAllSeats = async () => {
    if (!activeRoom) return;
    const updatedSeats = activeRoom.seats.map((seat) => {
      return { ...seat, isLocked: false };
    });
    const updatedRoom = { ...activeRoom, seats: updatedSeats };
    setActiveRoom(updatedRoom);
    setRooms(rooms?.map(r => r.id === activeRoom.id ? updatedRoom : r));
    setSelectedSeatIndex(null);
    await updateDoc(doc(db, "voice_rooms", activeRoom.id), { seats: updatedSeats });
  };

  const handleMoveToSeat = async (targetIndex: number) => {
    if (!activeRoom || !currentUser) return;

    const agoraManager = AgoraEngineManager.getInstance();

    const updatedSeats = activeRoom.seats.map((s, idx) => {
      if (s.userId === currentUser?.id) {
        return { ...s, userId: null }; // Stand up
      }
      if (idx === targetIndex) {
        return { ...s, userId: currentUser?.id, isMuted: false }; // Sit down with microphone unmuted and ready
      }
      return s;
    });
    const updatedRoom = { ...activeRoom, seats: updatedSeats };
    setActiveRoom(updatedRoom);
    setRooms(rooms?.map(r => r.id === activeRoom.id ? updatedRoom : r));
    setSelectedSeatIndex(null);

    // Directly publish microphone audio stream inside user gesture handler
    await agoraManager.startPublishing();

    await updateDoc(doc(db, "voice_rooms", activeRoom.id), { seats: updatedSeats });
  };

  const handleInviteToSeat = async (targetUserId: string) => {
    if (!activeRoom || selectedSeatIndex === null || !currentUser) return;
    
    try {
      // Instead of forcing the user into the seat immediately, create a pending mic invitation.
      const invitationsRef = collection(db, "voice_rooms", activeRoom.id, "mic_invitations");
      await addDoc(invitationsRef, {
        hostId: currentUser.id,
        hostName: currentUser.name || 'مالك المجلس',
        inviteeId: targetUserId,
        seatIndex: selectedSeatIndex,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      setCustomNotice({
        title: 'تم إرسال الدعوة ✉️',
        message: 'تم إرسال دعوة الصعود للمايك بنجاح. بانتظار موافقة المستخدم.'
      });
    } catch (err) {
      console.error("Error sending mic invitation:", err);
      setCustomNotice({
        title: 'خطأ ⚠️',
        message: 'حدث خطأ أثناء محاولة إرسال الدعوة. يرجى المحاولة لاحقاً.'
      });
    }

    setIsInviteListOpen(false);
    setSelectedSeatIndex(null);
  };

  const handleAcceptMicInvitation = async (invite: any) => {
    if (!activeRoom || !currentUser) return;
    try {
      // 1. Mark invitation as accepted
      const inviteRef = doc(db, "voice_rooms", activeRoom.id, "mic_invitations", invite.id);
      await updateDoc(inviteRef, { status: "accepted" });

      // 2. Check if seat is already occupied
      const currentRoomSnap = await getDoc(doc(db, "voice_rooms", activeRoom.id));
      if (currentRoomSnap.exists()) {
        const currentData = currentRoomSnap.data();
        const freshSeats = currentData.seats || [];
        const targetSeat = freshSeats[invite.seatIndex];

        if (targetSeat && targetSeat.userId) {
          setCustomNotice({
            title: 'المقعد مشغول ⚠️',
            message: 'عذراً، هذا المقعد أصبح مشغولاً من قبل مستخدم آخر.'
          });
          setIncomingMicInvitation(null);
          return;
        }
      }

      // 3. Move/Sit down on this seat
      const updatedSeats = activeRoom.seats.map((s, idx) => {
        if (s.userId === currentUser.id) {
          return { ...s, userId: null }; // Stand up from previous seat
        }
        if (idx === invite.seatIndex) {
          return { ...s, userId: currentUser.id, isMuted: false }; // Sit down, unmuted
        }
        return s;
      });

      const updatedRoom = { ...activeRoom, seats: updatedSeats };
      setActiveRoom(updatedRoom);
      setRooms(rooms?.map(r => r.id === activeRoom.id ? updatedRoom : r));

      // Directly start publishing microphone stream inside user gesture handler
      const agoraManager = AgoraEngineManager.getInstance();
      await agoraManager.startPublishing();

      await updateDoc(doc(db, "voice_rooms", activeRoom.id), { seats: updatedSeats });

    } catch (err) {
      console.error("Error accepting mic invitation:", err);
    }
    setIncomingMicInvitation(null);
  };

  const handleDeclineMicInvitation = async (invite: any) => {
    if (!activeRoom) return;
    try {
      const inviteRef = doc(db, "voice_rooms", activeRoom.id, "mic_invitations", invite.id);
      await updateDoc(inviteRef, { status: "declined" });
    } catch (err) {
      console.error("Error declining mic invitation:", err);
    }
    setIncomingMicInvitation(null);
  };

  const handleBanUser = async (userId: string, durationMin: number) => {
    if (!activeRoom || !currentUser) return;
    
    const isAuthorizedHost = checkIfOwner(activeRoom);
    if (!isAuthorizedHost) {
      setCustomNotice({
        title: 'صلاحية مرفوضة ⚠️',
        message: 'عذراً، هذه الصلاحية مخصصة لمالك المجلس أو المشرف المعتمد فقط.'
      });
      return;
    }

    let updatedSeats = [...(activeRoom?.seats || [])];
    let updatedBannedUsers = { ...(activeRoom?.bannedUsers || {}) };

    const expiration = new Date();
    expiration.setMinutes(expiration.getMinutes() + durationMin);
    updatedBannedUsers[userId] = expiration.toISOString();

    // Check if the user is seated
    const seatIndex = updatedSeats.findIndex(s => s.userId === userId);
    if (seatIndex !== -1) {
      updatedSeats[seatIndex] = { ...updatedSeats[seatIndex], userId: null };
    }

    const updatedRoom = { ...activeRoom, seats: updatedSeats, bannedUsers: updatedBannedUsers };
    setActiveRoom(updatedRoom);
    setRooms(rooms?.map(r => r.id === activeRoom.id ? updatedRoom : r));
    
    if (userId === currentUser?.id) {
       // if banning self (shouldn't happen usually)
       setCurrentScreen('explore');
    }

    // Immediately remove from participants list on Firestore (host does this directly)
    const participantRef = doc(db, "voice_rooms", activeRoom.id, "participants", userId);
    deleteDoc(participantRef).catch(err => console.error("Error removing participant on ban:", err));

    await updateDoc(doc(db, "voice_rooms", activeRoom.id), { 
      seats: updatedSeats, 
      bannedUsers: updatedBannedUsers,
      activeUsersCount: increment(-1)
    });
    setCustomNotice({
      title: "تم الطرد بنجاح",
      message: "تم طرد المستخدم بنجاح من هذه الغرفة."
    });
  };

    // Sending virtual premium gifts
  const handleSendGift = async (gift: Gift, quantity: number = 1) => {
    if (!currentUser || !activeRoom) return;

    soundService.playGiftSound();

    // Allow sending any gift, but only trigger animation playback if an svgaUrl exists
    if (!gift.svgaUrl) {
      console.log("Sending gift without animation link:", gift.name);
    }

    let targets = [...selectedRecipientSeatIndices];
    if (targets.includes('all')) {
      const occupiedSeats = activeRoom.seats.map((s, idx) => s.userId ? idx + 1 : null).filter(val => val !== null);
      targets = occupiedSeats.length > 0 ? occupiedSeats : [];
    }
    
    if (targets.length === 0) {
      alert('الرجاء تحديد شخص لإرسال الهدية إليه.');
      return;
    }
    const totalCostPerTarget = gift.cost * quantity;
    
    // Calculate 40 coins surcharge per female target for male senders
    let totalSurcharge = 0;
    if (currentUser.gender === 'male') {
      for (const target of targets) {
        if (target !== 'all') {
          const seat = activeRoom?.seats?.[(target as number) - 1];
          if (seat && seat.userId) {
            const receiverId = seat.userId;
            const recUser = users?.find(u => u.id === receiverId);
            if (recUser && recUser.gender === 'female') {
              totalSurcharge += 40;
            }
          }
        }
      }
    }

    const overallTotalCost = (totalCostPerTarget * targets.length) + totalSurcharge;

    if (currentUser.coins < overallTotalCost) {
      setCustomNotice({
        title: 'رصيد غير كافي 🪙',
        message: 'عذراً، رصيدك من الكوينز غير كافي لإرسال هذه الهدية. يرجى الشحن عبر شبكة الوكلاء المعتمدين.'
      });
      return;
    }

    let updatedUser = { ...currentUser };
    let updatedUsersList = [...(users || [])];
    
    // Deduct total coins from sender upfront
    updatedUser.coins -= overallTotalCost;
    const totalSenderXpGain = overallTotalCost;
    updatedUser.xp += totalSenderXpGain;
    updatedUser.senderXp = (updatedUser.senderXp || 0) + totalSenderXpGain;
    updatedUser.level = getLevelFromXp(updatedUser.xp);

    const updateSupportersList = (currentSupportersList: any[] | undefined, donorId: string, donorName: string, donorAvatar: string, costValue: number) => {
      const currentList = currentSupportersList || [];
      const existingIndex = currentList.findIndex((s: any) => s.userId === donorId);
      let newList = [...currentList];
      if (existingIndex !== -1) {
        newList[existingIndex] = {
          ...newList[existingIndex],
          amount: (newList[existingIndex].amount || 0) + costValue,
          name: donorName,
          avatar: donorAvatar
        };
      } else {
        newList.push({
          userId: donorId,
          name: donorName,
          avatar: donorAvatar,
          amount: costValue
        });
      }
      newList.sort((a, b) => (b.amount || 0) - (a.amount || 0));
      return newList;
    };

    const senderRef = doc(db, "users", currentUser.id);
    const giftGroupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Process each target
    for (const target of targets) {
       let receiverId: string | null = null;
       let receiverSeatIndex: number | null = null;
       
       if (target !== 'all') {
         const seat = activeRoom?.seats?.[(target as number) - 1];
         if (seat && seat.userId) {
           receiverId = seat.userId;
           receiverSeatIndex = target as number;
         }
       }

       // Call server API for persistent, secure transaction
       fetch('/api/send-gift', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderId: currentUser.id,
            receiverId: receiverId,
            giftCost: totalCostPerTarget,
            xpReward: (gift.xpReward || 0) * quantity
          })
       }).catch(err => console.error("API error during gift sending:", err));

       let recName = 'المجلس';

       if (receiverId) {
         if (receiverId === currentUser.id) {
            // self gifting
            updatedUser.diamonds = (updatedUser.diamonds || 0) + totalCostPerTarget;
            updatedUser.charmXp = (updatedUser.charmXp || 0) + totalCostPerTarget;
            updatedUser.supporters = updateSupportersList(updatedUser.supporters, currentUser.id, currentUser.name, currentUser.avatar, totalCostPerTarget);
            recName = currentUser.name;
         } else {
            let recUser = updatedUsersList.find(u => u.id === receiverId);
            if (!recUser) {
              try {
                const recSnap = await getDoc(doc(db, "users", receiverId));
                if (recSnap.exists()) {
                  recUser = { id: recSnap.id, ...recSnap.data() } as AppUser;
                  updatedUsersList.push(recUser);
                }
              } catch (e) {
                console.error("Error fetching receiver from Firestore:", e);
              }
            }
            if (recUser) {
               recName = recUser.name;
               let updatedRec = { ...recUser };
               let targetSurchargeForThisUser = 0;
               if (currentUser.gender === 'male' && recUser.gender === 'female') {
                 targetSurchargeForThisUser = 40;
               }
               updatedRec.coins = (updatedRec.coins || 0) + totalCostPerTarget + targetSurchargeForThisUser;
               updatedRec.diamonds = (updatedRec.diamonds || 0) + totalCostPerTarget + targetSurchargeForThisUser;
               updatedRec.charmXp = (updatedRec.charmXp || 0) + totalCostPerTarget + targetSurchargeForThisUser;
               updatedRec.supporters = updateSupportersList(updatedRec.supporters, currentUser.id, currentUser.name, currentUser.avatar, totalCostPerTarget + targetSurchargeForThisUser);

               // Handle CP / Friend gifts
               if (gift.id === 'cp_gift') {
                 updatedUser.cpPartnerId = receiverId;
                 updatedUser.cpDays = 1;
                 updatedRec.cpPartnerId = currentUser.id;
                 updatedRec.cpDays = 1;
               } else if (gift.id === 'friend_gift') {
                 if (!updatedUser.closeFriends) updatedUser.closeFriends = [];
                 if (!updatedRec.closeFriends) updatedRec.closeFriends = [];
                 if (!updatedUser.closeFriends.includes(receiverId)) updatedUser.closeFriends.push(receiverId);
                 if (!updatedRec.closeFriends.includes(currentUser.id)) updatedRec.closeFriends.push(currentUser.id);
               }

               updatedUsersList = updatedUsersList.map(u => u.id === receiverId ? updatedRec : u);

               // Persist receiver (strictly avoiding undefined values for Firestore payload)
               try {
                 const receiverRef = doc(db, "users", receiverId);
                 const receiverPayload: any = {
                   coins: updatedRec.coins || 0,
                   diamonds: updatedRec.diamonds || 0,
                   charmXp: updatedRec.charmXp || 0,
                   supporters: updatedRec.supporters || []
                 };
                 if (updatedRec.cpPartnerId !== undefined) receiverPayload.cpPartnerId = updatedRec.cpPartnerId;
                 if (updatedRec.cpDays !== undefined) receiverPayload.cpDays = updatedRec.cpDays;
                 if (updatedRec.closeFriends !== undefined) receiverPayload.closeFriends = updatedRec.closeFriends;

                 await updateDoc(receiverRef, receiverPayload);
               } catch (err) {
                 console.error("Error updating receiver in Firestore:", err);
               }
            }
         }
       }

       const messageText = receiverId && receiverId !== currentUser.id
         ? `أرسل هدية فاخرة: [ ${gift.arabicName} ] x${quantity} إلى [ ${recName} ]! 🌟`
         : `أرسل هدية فاخرة: [ ${gift.arabicName} ] x${quantity} للمجلس! 🌟`;

       if (activeRoom?.id) {
          try {
            const messagesRef = collection(db, "voice_rooms", activeRoom.id, "chat_messages");
            const senderSeatIdx = activeRoom?.seats?.findIndex(s => s.userId === currentUser.id);
            const senderSeatIndexVal = senderSeatIdx !== -1 && senderSeatIdx !== undefined ? senderSeatIdx + 1 : null;
            const recUserObj = receiverId ? updatedUsersList.find(u => u.id === receiverId) : null;
            
            addDoc(messagesRef, {
              sender: currentUser.name,
              text: messageText,
              color: 'text-amber-400 font-extrabold animate-pulse',
              type: 'chat',
              giftId: gift.id,
              giftImageUrl: gift.imageUrl || null,
              senderSeatIndex: senderSeatIndexVal,
              receiverSeatIndex: receiverSeatIndex,
              svgaUrl: gift.svgaUrl || null,
              giftQuantity: quantity,
              isPremiumGift: gift.isPremium || false,
              giftName: gift.arabicName,
              giftIcon: gift.icon,
              giftReceiverName: recName,
              senderAvatar: currentUser.avatar || null,
              receiverAvatar: recUserObj?.avatar || null,
              giftGroupId: giftGroupId,
              createdAt: new Date().toISOString()
            });
          } catch(e) {}
       } else {
         setRoomMessages(prev => [
           ...prev,
           {
             sender: currentUser.name,
             text: messageText,
             color: 'text-amber-400 font-extrabold animate-pulse',
             type: 'chat'
           }
         ]);
       }
    }

    // Persist sender (strictly avoiding undefined values for Firestore payload)
    try {
      const senderPayload: any = {
        coins: updatedUser.coins || 0,
        xp: updatedUser.xp || 0,
        level: updatedUser.level || 1,
        senderXp: updatedUser.senderXp || 0,
        diamonds: updatedUser.diamonds || 0,
        charmXp: updatedUser.charmXp || 0,
        supporters: updatedUser.supporters || []
      };
      if (updatedUser.cpPartnerId !== undefined) senderPayload.cpPartnerId = updatedUser.cpPartnerId;
      if (updatedUser.cpDays !== undefined) senderPayload.cpDays = updatedUser.cpDays;
      if (updatedUser.closeFriends !== undefined) senderPayload.closeFriends = updatedUser.closeFriends;

      await updateDoc(senderRef, senderPayload);
    } catch (err) {
      console.error("Error updating sender in Firestore:", err);
    }

    updatedUsersList = updatedUsersList.map(u => u.id === currentUser.id ? updatedUser : u);
    setCurrentUser(updatedUser);
    setUsers(updatedUsersList);
  };

  const handleSendChatMessage = async () => {
    console.trace("[DEBUG] handleSendChatMessage called");
    const rawText = chatInputValue.trim();
    if (!rawText) return;
    
    let textToSend = rawText;
    let extraProps: any = {};
    
    if (isE2EEEnabled && derivedKey && activeRoom) {
      try {
        addE2eeLog(`جاري تشفير الرسالة الصادرة: "${rawText}"`);
        const { ciphertext, iv } = await encryptMessage(rawText, derivedKey);
        
        const payload = {
          e2ee: true,
          iv: iv,
          ciphertext: ciphertext,
          senderName: currentUser?.name || 'مجهول'
        };
        
        textToSend = `🔒__E2EE__:${JSON.stringify(payload)}`;
        extraProps = {
          isEncrypted: true,
          rawCiphertext: ciphertext,
          iv: iv
        };
        addE2eeLog(`تم تشفير الرسالة الصادرة بنجاح! النص المشفر: "${ciphertext.substring(0, 15)}..."`);
      } catch (err: any) {
        addE2eeLog(`⚠️ فشل التشفير: ${err.message}`);
        setCustomNotice({
          title: 'فشل التشفير ⚠️',
          message: 'فشل تشفير الرسالة تلقائياً!'
        });
        return;
      }
    }
    
    // Send message via Firestore
    if (activeRoom?.id) {
      try {
        const messagesRef = collection(db, "voice_rooms", activeRoom.id, "chat_messages");
        await addDoc(messagesRef, {
          sender: currentUser?.name || 'مستخدم',
          senderId: currentUser?.id || 'unknown',
          text: textToSend,
          color: 'text-purple-300 font-medium',
          type: 'chat',
          createdAt: new Date().toISOString(),
          ...extraProps
        });
      } catch (err) {
        console.error("Error sending room message to Firestore:", err);
      }
    } else {
      // Fallback local append if not inside an active room
      setRoomMessages(prev => [
        ...prev,
        {
          sender: currentUser?.name || 'مستخدم',
          senderId: currentUser?.id || 'unknown',
          text: textToSend,
          color: 'text-purple-300 font-medium',
          type: 'chat',
          ...extraProps
        }
      ]);
    }
    setChatInputValue('');
  };

  // AI Auto-Ban Helper for Voice and Content Moderation
  const handleAiAutoBan = async (userId: string, userName: string, seatIndex: number) => {
    if (!activeRoom) return;

    let updatedSeats = [...(activeRoom.seats || [])];
    let updatedBannedUsers = { ...(activeRoom.bannedUsers || {}) };

    // Ban for 1 minute
    const expiration = new Date();
    expiration.setMinutes(expiration.getMinutes() + 1);
    updatedBannedUsers[userId] = expiration.toISOString();

    // Immediately delete from participants list on Firestore
    const participantRef = doc(db, "voice_rooms", activeRoom.id, "participants", userId);
    deleteDoc(participantRef).catch(err => console.error("Error removing participant on AI seat ban:", err));

    // Empty the seat
    updatedSeats[seatIndex] = { ...updatedSeats[seatIndex], userId: null };

    // Update active room locally
    const updatedRoom = { ...activeRoom, seats: updatedSeats, bannedUsers: updatedBannedUsers };
    setActiveRoom(updatedRoom);
    setRooms(rooms?.map(r => r.id === activeRoom.id ? updatedRoom : r));

    // Save to Firestore
    await updateDoc(doc(db, "voice_rooms", activeRoom.id), {
      seats: updatedSeats,
      bannedUsers: updatedBannedUsers
    }).catch(err => console.error("Failed to sync AI ban to Firestore:", err));

    // Append AI notification to chat
    try {
      const messagesRef = collection(db, "voice_rooms", activeRoom.id, "chat_messages");
      await addDoc(messagesRef, {
        sender: '🤖 مراقب الذكاء الاصطناعي',
        text: `🚨 تم حظر العضو [${userName}] وتجريده من المقعد تلقائياً لمخالفة معايير الحوار والآداب العامة بصدى العرب.`,
        color: 'text-red-400 font-extrabold',
        type: 'system',
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("Failed to write AI chat ban message:", e);
    }
  };

  // AI Content Evaluation Sentinel function
  const runAiModerationOnText = async (text: string, senderName: string, senderId?: string, messageId?: string) => {
    if (!isAiModerationEnabled || !activeRoom) return false;

    // Detect common Arabic bad/offending words
    const badWords = ["غبي", "حقير", "كلب", "حمار", "تفه", "سخيف", "كذاب", "انقلع", "حقيرة", "غباء", "سفالة", "حيوان", "حقير", "يا غبي", "يا كلب"];
    const textLower = text.toLowerCase();
    const containsBadWord = badWords.some(word => textLower.includes(word));

    if (containsBadWord) {
      // Find what seat this user occupies, if any
      let seatIndex = -1;
      let targetUserId = senderId || "";

      if (activeRoom.seats) {
        seatIndex = activeRoom.seats.findIndex(s => s.userId && s.userId === senderId);
        if (seatIndex !== -1 && !targetUserId) {
          targetUserId = activeRoom.seats[seatIndex].userId || "";
        }
      }

      // 1. Filter message in Firestore if messageId is provided
      if (messageId) {
        try {
          const msgDocRef = doc(db, "voice_rooms", activeRoom.id, "chat_messages", messageId);
          await updateDoc(msgDocRef, {
            text: "⚠️ [تم حجب الرسالة تلقائياً بواسطة الذكاء الاصطناعي لمخالفة معايير صدى العرب]"
          });
        } catch (e) {
          console.error("Failed to filter message in Firestore:", e);
        }
      }

      // 2. Action: Ban / Kick if they are on a seat
      if (targetUserId && targetUserId !== "system" && seatIndex !== -1) {
        await handleAiAutoBan(targetUserId, senderName, seatIndex);
      } else {
        // If they are just chatters, post a system warning in the chat
        try {
          const messagesRef = collection(db, "voice_rooms", activeRoom.id, "chat_messages");
          await addDoc(messagesRef, {
            sender: '🤖 مراقب الذكاء الاصطناعي',
            text: `⚠️ تنبيه للعضو [${senderName}]: يرجى تجنب العبارات المسيئة والالتزام بالآداب العامة لتفادي الحظر التلقائي من الرادار.`,
            color: 'text-amber-500 font-bold',
            type: 'system',
            createdAt: new Date().toISOString()
          });
        } catch (e) {
          console.error("Failed to post AI warning message:", e);
        }
      }

      // 3. Log violation in local state
      const newLog = {
        id: `mod-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('ar-EG'),
        userName: senderName,
        userId: targetUserId || "chatter",
        textDetected: text,
        violationType: "عبارات مسيئة وسلوك مخالف للآداب",
        actionTaken: seatIndex !== -1 ? "تجريد فوري من المقعد + حظر تلقائي 🚫" : "تحذير رسمي في دردشة المجلس ⚠️"
      };

      setAiModerationLog(prev => [newLog, ...prev]);
      return true;
    }
    return false;
  };

  // Agent Dashboard logic: User Search
  useEffect(() => {
    if (transferTargetId) {
      const found = users?.find(u => u.displayId === transferTargetId || u.id === transferTargetId);
      setTransferTargetUser(found || null);
    } else {
      setTransferTargetUser(null);
    }
  }, [transferTargetId, users]);

  // Execute Agent instant coin transfer
  const handleExecuteTransfer = () => {
    setTransferSuccess(false);
    setTransferErrorMsg('');

    if (!transferTargetUser) {
      setTransferErrorMsg('الرجاء إدخال رقم معرف صحيح للعميل والتحقق منه');
      return;
    }

    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      setTransferErrorMsg('الرجاء إدخال مبلغ تحويل صحيح أكبر من صفر');
      return;
    }

    if (agentBalance < amount) {
      setTransferErrorMsg('عذراً! رصيدك المتاح كوكيل غير كافٍ لإتمام هذه العملية');
      return;
    }

    if (transferPin !== '9999') {
      setTransferErrorMsg('رمز الأمان PIN غير صحيح! الرجاء إدخال الرمز المعتمد 9999');
      return;
    }

    // Process Transfer using Firestore Transaction
    const performTransfer = async () => {
      try {
        const agentRef = doc(db, "users", currentUser?.id || "1004");
        const receiverRef = doc(db, "users", transferTargetUser.id);

        await processAgentTransfer(
          currentUser?.id || "1004",
          currentUser?.name || "Agent",
          transferTargetUser.id,
          transferTargetUser.name,
          amount
        );
        
        setUsers(prev => prev.map(u => {
          if (u.id === currentUser?.id) return { ...u, coins: (u.coins || 0) - amount };
          if (u.id === transferTargetUser.id) return { ...u, coins: (u.coins || 0) + amount };
          return u;
        }));

        setTransferSuccess(true);
        setTransferAmount('');
        setTransferPin('');
        setTransferTargetId('');
      } catch (err: any) {
        setTransferErrorMsg(err.message || 'حدث خطأ أثناء التحويل');
      }
    };

    performTransfer();
  };

  // Folder tree toggle
  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  // Copy code to clipboard
  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  // Render directory tree recursively
  const renderFolderTree = (node: FolderNode) => {
    const isExpanded = expandedFolders[node.path];
    const isSelected = selectedFileKey === node.contentKey;

    if (node.type === 'file') {
      return (
        <button
          key={node.path}
          onClick={() => node.contentKey && setSelectedFileKey(node.contentKey)}
          className={`w-full text-left pl-6 pr-2 py-1.5 flex items-center space-x-2 text-sm rounded transition duration-150 ${
            isSelected
              ? 'bg-[#7C3AED]/20 border-l-2 border-[#7C3AED] text-white font-medium'
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
          }`}
          id={`file-node-${node.contentKey}`}
        >
          <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span className="font-mono text-xs truncate">{node.name}</span>
        </button>
      );
    }

    return (
      <div key={node.path} className="mb-1">
        <button
          onClick={() => toggleFolder(node.path)}
          className="w-full text-left px-2 py-1.5 flex items-center space-x-1.5 text-sm font-semibold text-slate-300 hover:bg-slate-800/40 rounded transition"
          id={`folder-node-${node.path.replace(/\//g, '-')}`}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
          )}
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-purple-400 flex-shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-purple-400 flex-shrink-0" />
          )}
          <span className="font-mono text-xs">{node.name}</span>
        </button>

        {isExpanded && node.children && (
          <div className="pl-4 border-l border-slate-800 ml-3 mt-1 space-y-1">
            {node.children.map(child => renderFolderTree(child))}
          </div>
        )}
      </div>
    );
  };

  if (isAuthChecking) {
    return (
      <div className="h-screen h-[100dvh] flex items-center justify-center bg-[#03000a] text-purple-500">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="animate-pulse text-lg font-bold">جاري التحميل...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen w-[100vw] h-[100dvh] bg-[#03000a] text-slate-200 flex flex-col p-0 relative overflow-hidden" id="root-container">
      {(!isOnline || isFirestoreOffline) && (
        <div className="absolute top-0 inset-x-0 bg-amber-500/20 backdrop-blur-md border-b border-amber-500/30 px-4 py-2 z-50 flex items-center justify-between text-xs text-amber-200 font-sans" dir="rtl">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>تنبيه: اتصال شبكة غير مستقر. يعمل التطبيق حالياً بالوضع الاحتياطي (أوفلاين) وسيتم المزامنة تلقائياً عند استعادة الاتصال.</span>
          </div>
          <button
            onClick={() => window.location.reload()} 
            className="bg-amber-500/30 hover:bg-amber-500/50 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold transition active:scale-95 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            إعادة الاتصال
          </button>
        </div>
      )}

      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-900/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#7C3AED]/10 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Main Workspace Layout */}
      <main className="flex flex-col flex-grow w-full h-full relative z-10 overflow-hidden" id="main-content">
        
        {/* LEFT COLUMN: Clean Flutter Architecture & Dart Blueprint Explorer (7 Cols) */}
        <div className="hidden" id="blueprint-explorer">
          
          {/* Header Tab Selector */}
          <div className="flex bg-slate-900/90 border-b border-purple-900/30 p-2 justify-between items-center" id="explorer-tabs">
            <div className="flex gap-1">
                <button
                  onClick={() => setActiveTab('architecture')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                    activeTab === 'architecture'
                      ? 'bg-[#7C3AED] text-white shadow-md'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                  id="tab-architecture"
                >
                  <Info className="w-3.5 h-3.5" />
                  هيكلية النظام (Architecture)
                </button>
                <button
                  onClick={() => setActiveTab('code')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                    activeTab === 'code'
                      ? 'bg-[#7C3AED] text-white shadow-md'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                  id="tab-code"
                >
                  <FileText className="w-3.5 h-3.5" />
                  ملفات كود Dart (Blueprints)
                </button>
                <button
                  onClick={() => setActiveTab('specs')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                    activeTab === 'specs'
                      ? 'bg-[#7C3AED] text-white shadow-md'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                  id="tab-specs"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  المواصفات والحلول الفنية
                </button>
            </div>

            {activeTab === 'code' && (
              <button
                onClick={() => handleCopyCode(DART_BLUEPRINTS[selectedFileKey])}
                className="bg-purple-900/50 hover:bg-purple-800 border border-purple-500/30 px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 text-purple-300 transition"
                id="copy-code-btn"
              >
                {copiedNotification ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedNotification ? 'تم النسخ!' : 'نسخ الكود'}
              </button>
            )}
          </div>

          {/* Tab Contents */}
          <div className="p-4 flex-grow overflow-y-auto" id="explorer-content">
            
            {/* TAB 1: Architecture Explanation */}
            {activeTab === 'architecture' && (
              <div className="space-y-6 text-slate-300" id="arch-tab-panel">
                <div className="bg-gradient-to-r from-purple-950/40 to-slate-900/60 p-4 rounded-xl border border-purple-500/20">
                  <h3 className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-amber-300 mb-2">هيكلية Clean Architecture المعتمدة للهواتف الذكية</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    تم بناء هذا المخطط الهيكلي للهواتف الذكية (Android & iOS) باتباع نمط <strong className="text-slate-200">Clean Architecture</strong> بالتكامل مع إدارة الحالة <strong className="text-purple-300">BLoC (Business Logic Component)</strong> لضمان فصل منطق العمل عن واجهة المستخدم وقابلية كتابة الاختبارات البرمجية وتوسيع النظام لاحقاً.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                    <span className="text-xs font-bold text-[#C026D3] uppercase tracking-wider block mb-1">1. Presentation Layer</span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">تضم واجهات المستخدم (UI Widgets) المكتوبة بـ Flutter ومتحكمات الحالة BLoC التي تستقبل الأحداث وتحدث الشاشة فورياً.</p>
                  </div>
                  <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                    <span className="text-xs font-bold text-[#7C3AED] uppercase tracking-wider block mb-1">2. Domain Layer</span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">تحتوي على منطق التطبيق الأساسي (Business Logic)، وحالات الاستخدام (Use Cases) والكيانات الرياضية المطلقة الخالية من أي تبعيات خارجية.</p>
                  </div>
                  <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                    <span className="text-xs font-bold text-amber-500 uppercase tracking-wider block mb-1">3. Data Layer</span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">مسؤولة عن جلب البيانات وتخزينها، وتضم النماذج (Models)، ومصادر البيانات (Data Sources) سواء عبر الإنترنت أو قواعد البيانات المحلية.</p>
                  </div>
                </div>

                {/* State Management Explanation */}
                <div className="border-t border-purple-900/30 pt-4">
                  <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" />
                    إدارة الحالة باستخدام BLoC & Clean Economy Services
                  </h4>
                  <ul className="text-xs space-y-2.5 text-slate-400">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 font-bold">●</span>
                      <span><strong className="text-slate-200">SeatManagementBloc</strong>: يدير حالة مقاعد الغرفة الصوتية الـ 9 بدقة (كتم، قفل، طرد، انضمام) ويقوم بإرسال الإشارات فورياً عبر البنية التحتية.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-bold">●</span>
                      <span><strong className="text-slate-200">EconomyService</strong>: نظام الحسابات المغلق والوكلاء، يتعامل مع تحويلات الكوينزات الفورية وإدارتها عبر رمز الحماية الثنائي للوكلاء PIN.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">●</span>
                      <span><strong className="text-slate-200">WebRtcVoiceService</strong>: طبقة تجريد تتيح محرك الصوت اللاسلكي Agora.</span>
                    </li>
                  </ul>
                </div>

                {/* File Navigator Hint */}
                <div className="bg-purple-950/30 p-3.5 rounded-lg border border-purple-500/25 flex items-center gap-3">
                  <Info className="w-5 h-5 text-purple-400 flex-shrink-0" />
                  <span className="text-xs text-slate-300">
                    تصفح شجرة الملفات بالضغط على علامة <strong className="text-white">"ملفات كود Dart"</strong> بالأعلى لعرض الكود المصدري الكامل لكل ملف ومحتواه المعماري الجاهز للنقل لبيئة العمل الخاصة بك!
                  </span>
                </div>
              </div>
            )}

            {/* TAB 2: Explorable Tree & Source Code Blueprints */}
            {activeTab === 'code' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-full" id="code-tab-panel">
                
                {/* Left Side: Directory Tree Navigator (4 Cols) */}
                <div className="md:col-span-4 border-r border-slate-800/80 pr-2 max-h-[700px] overflow-y-auto">
                  <div className="pb-3 mb-3 border-b border-slate-800">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">شجرة ملفات فلاتر الهاتف</span>
                  </div>
                </div>

                {/* Right Side: Code Viewer (8 Cols) */}
                <div className="md:col-span-8 flex flex-col h-full bg-slate-900/40 rounded-xl overflow-hidden border border-slate-800">
                  <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                      <span className="text-xs font-mono font-bold text-amber-300">
                        {selectedFileKey === 'pubspec' ? 'pubspec.yaml' : `lib/.../${selectedFileKey}.dart`}
                      </span>
                    </div>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                      {selectedFileKey === 'pubspec' ? 'yaml' : 'dart'}
                    </span>
                  </div>
                  <pre className="p-4 text-xs font-mono overflow-auto flex-grow max-h-[580px] text-slate-300 bg-[#06040c]">
                    <code>{DART_BLUEPRINTS[selectedFileKey]}</code>
                  </pre>
                </div>

              </div>
            )}

            {/* TAB 3: Tech Specs and Security Design */}
            {activeTab === 'specs' && (
              <div className="space-y-6 text-slate-300" id="specs-tab-panel">
                <div className="bg-slate-900/50 p-4 rounded-xl border border-purple-500/20">
                  <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-amber-500" />
                    المواصفات الفنية لحماية وإدارة الغرف (9 مقاعد)
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">
                    المقعد رقم 0 هو دائماً مقعد <strong className="text-slate-200">المستضيف أو صاحب الغرفة (Host)</strong>. المقاعد من 1 إلى 8 هي مقاعد الأعضاء والضيوف (Guests).
                  </p>
                  <div className="space-y-2">
                    <div className="p-2.5 bg-[#03000a] rounded border border-slate-800 text-xs">
                      <strong className="text-[#C026D3]">● نظام كتم الصوت (Muting Engine)</strong>: يرسل إشعاراً للمقعد المعين لتعطيل المايكرفون محلياً عبر SDK ويقفل حالة الإرسال.
                    </div>
                    <div className="p-2.5 bg-[#03000a] rounded border border-slate-800 text-xs">
                      <strong className="text-[#7C3AED]">● قفل المقاعد (Seat Locking)</strong>: يمكن للمستضيف إغلاق أي مقعد شاغر ليصبح غير متاح للانضمام. يظهر المقعد مغلقاً برمز القفل الأحمر.
                    </div>
                    <div className="p-2.5 bg-[#03000a] rounded border border-slate-800 text-xs">
                      <strong className="text-amber-500">● آلية الطرد الفوري (Kicking)</strong>: عند طرد مستخدم من مقعده يتم تحرير المقعد فورياً وإجبار المستمع المطرود على الرجوع لطبقة الجمهور (Audience).
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-xl border border-purple-500/20">
                  <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <Coins className="w-5 h-5 text-amber-500" />
                    حلول الاقتصاد المغلق ونظام الوكيل الفوري (Agent Dashboard)
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">
                    لتجاوز تعقيدات وعمولات متاجر التطبيقات في المراحل الأولى، تم دمج نظام <strong className="text-slate-200">الوكيل المعتمد (Agent Dashboard)</strong> لتمكين عمليات شحن الكوينزات الفورية أوفلاين كاش وتحويلها فورياً عبر معرف المستلم:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-[#03000a] rounded border border-slate-800">
                      <strong className="text-emerald-400 block mb-1">مصادقة هوية المستلم بالمعرف ID</strong>
                      يقوم الوكيل بإدخال معرف العميل المكون من 4 أرقام لتظهر بطاقة العميل الشخصية (الاسم، الصورة، المستوى) للتحقق منها منعاً للأخطاء قبل التحويل.
                    </div>
                    <div className="p-3 bg-[#03000a] rounded border border-slate-800">
                      <strong className="text-amber-400 block mb-1">توثيق رمز الأمان الوكيل PIN</strong>
                      تتطلب العملية إدخال رمز التحقق الشخصي للوكيل المعتمد (PIN) لتوثيق التحويلات وخصمها من الرصيد السحابي الفوري للوكالة.
                    </div>
                  </div>
                </div>

                <div className="bg-purple-950/20 p-4 rounded-xl border border-[#7C3AED]/30">
                  <h3 className="text-xs font-bold text-white mb-1">تكامل WebRTC للاتصال الصوتي فائق السرعة</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    تم تضمين واجهة Service المجردة <code className="text-amber-300 font-mono">WebRtcVoiceService</code> للربط مع محرك البث Agora. يتميز هذا التجريد بتمكين التطبيق من إدارة جودة البث الصوتي وتتبع المتحدثين النشطين (Active Speakers) وإدارة جودة الصوت ثلاثي الأبعاد الموجه للمجالس الخليجية والعربية الكبرى.
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* Footer Info of the Blueprint column */}
          <div className="bg-slate-900 px-4 py-3 border-t border-purple-900/30 flex justify-between items-center text-xs text-slate-400">
            <span>مخطط فلاتر معتمد بواسطة: <strong className="text-slate-200">Senior Mobile App Architect</strong></span>
            <span>صدى العرب v1.0.0</span>
          </div>

        </div>

        {/* Full-Screen Native App Container (Adapts completely to viewport dimensions and native edges) */}
        <div className="flex flex-col w-full h-full min-h-screen h-[100dvh] overflow-hidden" id="phone-simulator-container">

          {/* Device Shell - Native full-screen canvas */}
          <div className="relative w-full h-full min-h-screen h-[100dvh] bg-[#03000a] flex flex-col font-sans overflow-hidden" id="smartphone-device">

            {/* Native Screen Content Area */}
            <div className="flex-grow w-full h-full flex flex-col bg-[#03000a] text-slate-100 overflow-hidden relative" id="smartphone-screen">
              
              {/* SCREEN 1: USER AUTHENTICATION SCREEN */}
              {currentScreen === 'login' && (
                <div className="flex-grow flex flex-col p-5 justify-between items-center bg-[#FAF6EB] h-full relative" id="screen-login text-right">
                  {/* Top Bar */}
                  <div className="w-full flex justify-end items-center text-xs font-sans pt-2">
                    <button
                      onClick={() => {
                        const lastLoginStr = localStorage.getItem('sada_last_login');
                        if (lastLoginStr) {
                          try {
                            const parsed = JSON.parse(lastLoginStr);
                            setCustomNotice({
                              title: 'التسجيل مؤخراً',
                              message: JSON.stringify(parsed)
                            });
                            return;
                          } catch (e) {}
                        }
                        setCustomNotice({
                          title: 'استرداد الحساب',
                          message: 'لا توجد أي بيانات تسجيل دخول محفوظة مسبقاً على هذا الجهاز.'
                        });
                      }}
                      className="text-[#8B7E74] hover:text-[#4A3E3D] font-bold cursor-pointer"
                    >
                      استرداد الحساب (Account Recovery)
                    </button>
                  </div>

                  {/* Mascot and Brand Illustration */}
                  <div className="flex-grow flex flex-col justify-center items-center w-full my-auto py-1">
                    {/* Floating elements & Cat Mascot */}
                    <div className="relative w-44 h-44 flex items-center justify-center bg-gradient-to-b from-[#FDFBF7] to-[#F1EAD9] rounded-full border border-[#DCD7C9]/50 shadow-inner">
                      {/* Balloons and decorations */}
                      <span className="absolute top-3 left-4 text-lg animate-bounce" style={{ animationDelay: '0.2s' }}>🎈</span>
                      <span className="absolute top-6 right-3 text-lg animate-bounce" style={{ animationDelay: '0.6s' }}>🎈</span>
                      <span className="absolute bottom-5 left-1 text-lg animate-pulse">🎁</span>
                      <span className="absolute bottom-3 right-4 text-base">🎉</span>
                      <span className="absolute top-1/2 -left-2 text-lg">🎙️</span>
                      <span className="absolute top-1/3 -right-1 text-base">✨</span>

                      {/* Main Cute Cat Mascot using CSS shapes and emoji */}
                      <div className="flex flex-col items-center justify-center animate-bounce duration-[3000ms]">
                        <div className="relative w-18 h-18 bg-[#FFF9E6] border-2 border-[#FFAE42] rounded-[24px] flex flex-col items-center justify-center shadow-md">
                          {/* Ears */}
                          <div className="absolute -top-1.5 left-1 w-4 h-4 bg-[#FFAE42] rounded-tl-[12px] rotate-12"></div>
                          <div className="absolute -top-1.5 right-1 w-4 h-4 bg-[#FFAE42] rounded-tr-[12px] -rotate-12"></div>
                          {/* Inner Ears */}
                          <div className="absolute -top-[1px] left-1.5 w-2.5 h-2.5 bg-[#FFD1A9] rounded-tl-[8px] rotate-12"></div>
                          <div className="absolute -top-[1px] right-1.5 w-2.5 h-2.5 bg-[#FFD1A9] rounded-tr-[8px] -rotate-12"></div>
                          
                          {/* Cute Cat Face */}
                          <div className="text-xs font-bold text-[#4A3E3D] mb-0.5">^ . ^</div>
                          <div className="w-1.5 h-0.5 bg-[#FF7F50] rounded-full"></div>
                          <div className="w-4 h-0.5 bg-[#4A3E3D]/20 rounded mt-0.5"></div>

                          {/* Heart/Cheeks */}
                          <div className="absolute top-[32px] left-1 w-1.5 h-1 bg-[#FFB7B2] rounded-full"></div>
                          <div className="absolute top-[32px] right-1 w-1.5 h-1 bg-[#FFB7B2] rounded-full"></div>
                          
                          {/* Cute Arab collar detail */}
                          <div className="absolute -bottom-0.5 w-9 h-2.5 bg-white rounded-t-full border-t border-[#DCD7C9] flex justify-center">
                            <div className="w-0.5 h-0.5 bg-amber-500 rounded-full mt-0.5 animate-pulse"></div>
                          </div>
                        </div>

                        {/* Arab Cartoon Friends Emojis */}
                        <div className="flex justify-center items-center gap-1 mt-2">
                          <div className="w-6 h-6 rounded-full bg-[#FFF] border border-[#E8DCC4] flex items-center justify-center text-xs shadow-sm">🧔</div>
                          <div className="w-7 h-7 rounded-full bg-amber-100 border border-amber-400 flex items-center justify-center text-sm shadow-md animate-pulse">🐱</div>
                          <div className="w-6 h-6 rounded-full bg-[#FFF] border border-[#E8DCC4] flex items-center justify-center text-xs shadow-sm">👳</div>
                          <div className="w-6 h-6 rounded-full bg-[#FFF] border border-[#E8DCC4] flex items-center justify-center text-xs shadow-sm">😎</div>
                        </div>
                      </div>
                    </div>

                    <div className="text-center mt-2.5">
                      <h2 className="text-lg font-black text-[#4A3E3D] font-sans">صدى العرب 🎙️</h2>
                      <p className="text-[9px] text-[#8B7E74] font-bold mt-0.5 leading-snug">المجالس الصوتية والترفيهية بنكهة عربية متميزة</p>
                    </div>
                  </div>

                  {/* Auth Content */}
                  <div className="w-full space-y-4 max-w-sm px-2 -mt-12 relative z-10">
                    <div className="bg-white p-5 rounded-3xl border border-[#DCD7C9]/60 shadow-md space-y-4">
                      <div className="text-center font-bold text-xs text-[#7C3AED] mb-1">
                        تسجيل الدخول إلى المجلس
                      </div>

                      {/* Google Sign-In Button */}
                      <div className="space-y-3 py-2 text-center">
                        <p className="text-xs text-[#6B5E53] leading-relaxed">
                          قم بتسجيل الدخول بأمان عبر حساب Google للوصول إلى مجالس صدى العرب.
                        </p>

                        {authError && (
                          <div className="bg-rose-50 text-rose-700 text-[10px] p-2.5 rounded-lg border border-rose-200 text-right leading-relaxed font-sans" dir="rtl">
                            ⚠️ {authError}
                          </div>
                        )}

                        <button
                          type="button"
                          disabled={authLoading}
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setAuthLoading(true);
                            setAuthError('');
                            try {
                              const provider = new GoogleAuthProvider();
                              if (auth.currentUser) {
                                await signOut(auth);
                              }
                              // On mobile or if popup is blocked, signInWithRedirect is extremely reliable
                              const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                              if (isMobile) {
                                await signInWithRedirect(auth, provider);
                                return;
                              }
                              try {
                                const result = await signInWithPopup(auth, provider);
                                const user = result.user;
                                localStorage.setItem('sada_bound_uid', user.uid);
                                localStorage.setItem('sada_last_login', JSON.stringify({
                                  method: 'Google',
                                  email: user.email || `user_${user.uid.slice(0,6)}@gmail.com`,
                                  avatar: user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`
                                }));
                                setCurrentScreen('explore');
                              } catch (popupErr: any) {
                                console.warn("Popup sign-in failed, trying redirect:", popupErr);
                                await signInWithRedirect(auth, provider);
                              }
                            } catch (err: any) {
                              console.error("Google Auth Error:", err);
                              setAuthError(`خطأ في تسجيل الدخول بواسطة جوجل: ${err.code || err.message}`);
                              setAuthLoading(false);
                            }
                          }}
                          className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 py-3.5 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-3 shadow-md active:scale-95 disabled:opacity-50 font-sans"
                        >
                          {authLoading ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
                              <span>جاري الاتصال بـ Google...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                              </svg>
                              <span>تسجيل الدخول بواسطة Google</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Consent & Agreement */}
                  <div className="w-full max-w-xs flex flex-col items-center gap-2 pb-2">
                    <div className="flex items-center gap-1.5 text-[9px] text-[#8B7E74] font-medium justify-center text-right font-sans">
                      <span className="text-[#FFAE42] text-xs">✔</span>
                      <span>
                        الدخول يعني الموافقة على <span className="text-[#FFAE42] font-bold cursor-pointer underline">اتفاقية مستخدم صدى العرب</span> وسياسة الخصوصية.
                      </span>
                    </div>
                    <span className="text-[#8B7E74] text-[8px] font-mono bg-[#FFF]/60 px-2 py-0.5 rounded-full border border-[#DCD7C9]/40">
                      Auto-detected: {deviceInfo.modelName}
                    </span>
                  </div>
                </div>
              )}

              {/* SCREEN onboarding_profile: UNIFIED PROFILE SETUP */}
              {currentScreen === 'onboarding_profile' && currentUser && (
                <div className="flex-grow flex flex-col p-5 justify-between items-center bg-[#FAF6EB] h-full relative" id="screen-onboarding-profile" dir="rtl">
                  {/* Top Header */}
                  <div className="w-full flex items-center justify-between pt-2 pb-3 border-b border-[#DCD7C9]/40">
                    <span className="text-sm font-black text-[#4A3E3D] mx-auto font-sans">تحرير الملف الشخصي</span>
                  </div>

                  {/* Body Content */}
                  <div className="w-full max-w-sm space-y-4 my-auto overflow-y-auto max-h-[82%] px-1">
                    {/* Selected Avatar Preview */}
                    <div className="flex flex-col items-center justify-center pt-2">
                      <div className="relative w-20 h-20 rounded-full border-2 border-[#FF7700] bg-[#FF7700] text-white overflow-hidden shadow-md flex items-center justify-center font-bold text-2xl">
                        {onboardingAvatar ? (
                          <img 
                            src={onboardingAvatar} 
                            alt="Avatar Preview" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span>{onboardingName?.[0] || currentUser.name?.[0] || 'K'}</span>
                        )}
                        <label className="absolute -bottom-1 -left-1 bg-[#FF7700] text-white p-1 rounded-full text-[10px] cursor-pointer shadow border-2 border-white hover:scale-110 transition">
                          ✏️
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setOnboardingAvatar(reader.result as string);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    {/* 1. Nickname / كنية */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-[#4A3E3D] font-bold block">كنية</label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          maxLength={20}
                          placeholder="Krmo"
                          value={onboardingName}
                          onChange={(e) => setOnboardingName(e.target.value)}
                          className="w-full bg-white border border-[#DCD7C9] rounded-xl py-2.5 px-3 text-xs text-right text-[#4A3E3D] focus:outline-none focus:border-[#FF7700] shadow-sm font-sans font-bold"
                        />
                        <button
                          type="button"
                          onClick={handleRandomizeName}
                          className="absolute left-2 bg-[#F3EFE6] hover:bg-[#E8E2D5] text-[#4A3E3D] px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition shadow-sm border border-[#DCD7C9]/60 cursor-pointer"
                        >
                          <span>عشوائي</span>
                          <Shuffle className="w-3 h-3 text-amber-600" />
                        </button>
                      </div>
                    </div>

                    {/* 2. Gender / جنس */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-[#4A3E3D] font-bold block">جنس</label>
                      <div className="w-full bg-white border border-[#DCD7C9] rounded-xl p-3 flex items-center justify-around shadow-sm">
                        <label 
                          onClick={() => setOnboardingGender('male')}
                          className="flex items-center gap-2 cursor-pointer select-none"
                        >
                          <span className="text-xs font-bold text-[#4A3E3D]">ذكر</span>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                            onboardingGender === 'male' ? 'border-[#FF7700] bg-[#FF7700]' : 'border-slate-300 bg-white'
                          }`}>
                            {onboardingGender === 'male' && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                        </label>

                        <label 
                          onClick={() => setOnboardingGender('female')}
                          className="flex items-center gap-2 cursor-pointer select-none"
                        >
                          <span className="text-xs font-bold text-[#4A3E3D]">أنثى</span>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                            onboardingGender === 'female' ? 'border-[#FF7700] bg-[#FF7700]' : 'border-slate-300 bg-white'
                          }`}>
                            {onboardingGender === 'female' && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* 3. Birthdate / تاريخ الميلاد */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-[#4A3E3D] font-bold block">تاريخ الميلاد</label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          value={onboardingBirthdate}
                          onChange={(e) => setOnboardingBirthdate(e.target.value)}
                          placeholder="29-07-2001"
                          className="w-full bg-white border border-[#DCD7C9] rounded-xl py-2.5 px-3 text-xs text-right text-[#4A3E3D] focus:outline-none focus:border-[#FF7700] shadow-sm font-sans font-bold"
                        />
                        <div className="absolute left-3 text-slate-400 pointer-events-none">
                          <Calendar className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    </div>

                    {/* 4. Invite Code / رمز الدعوة (خياري) */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-[#4A3E3D] font-bold block">رمز الدعوة <span className="text-[9px] text-slate-400 font-normal">(خياري)</span></label>
                      <input
                        type="text"
                        value={onboardingInviteCode}
                        onChange={(e) => setOnboardingInviteCode(e.target.value)}
                        placeholder="الرجاء إدخال رمز الدعوة"
                        className="w-full bg-white border border-[#DCD7C9] rounded-xl py-2.5 px-3 text-xs text-right text-[#4A3E3D] focus:outline-none focus:border-[#FF7700] shadow-sm font-sans font-bold placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Bottom Submit Button */}
                  <div className="w-full max-w-xs pb-4 pt-2">
                    <button
                      disabled={onboardingLoading}
                      onClick={async () => {
                        const cleanName = onboardingName.trim();
                        if (!cleanName) {
                          alert('الرجاء إدخال الكنية أو الاسم');
                          return;
                        }
                        if (!onboardingAvatar) {
                          alert('الرجاء تحديد صورة الملف الشخصي');
                          return;
                        }

                        setOnboardingLoading(true);
                        try {
                          let referrerId = '';
                          const inviteInput = onboardingInviteCode.trim();
                          if (inviteInput) {
                            try {
                              const qCode = query(collection(db, 'users'), where('inviteCode', '==', inviteInput));
                              const qSnapCode = await getDocs(qCode);
                              if (!qSnapCode.empty) {
                                const refDoc = qSnapCode.docs[0];
                                if (refDoc.id !== currentUser.id) {
                                  referrerId = refDoc.id;
                                  await updateDoc(refDoc.ref, {
                                    invitedCount: increment(1)
                                  });
                                }
                              } else {
                                const qDisplay = query(collection(db, 'users'), where('displayId', '==', inviteInput));
                                const qSnap = await getDocs(qDisplay);
                                if (!qSnap.empty) {
                                  const refDoc = qSnap.docs[0];
                                  if (refDoc.id !== currentUser.id) {
                                    referrerId = refDoc.id;
                                    await updateDoc(refDoc.ref, {
                                      invitedCount: increment(1)
                                    });
                                  }
                                } else {
                                  const qOrig = query(collection(db, 'users'), where('originalDisplayId', '==', inviteInput));
                                  const qSnapOrig = await getDocs(qOrig);
                                  if (!qSnapOrig.empty) {
                                    const refDoc = qSnapOrig.docs[0];
                                    if (refDoc.id !== currentUser.id) {
                                      referrerId = refDoc.id;
                                      await updateDoc(refDoc.ref, {
                                        invitedCount: increment(1)
                                      });
                                    }
                                  } else {
                                    const directRefDoc = await getDoc(doc(db, 'users', inviteInput));
                                    if (directRefDoc.exists() && directRefDoc.id !== currentUser.id) {
                                      referrerId = directRefDoc.id;
                                      await updateDoc(directRefDoc.ref, {
                                        invitedCount: increment(1)
                                      });
                                    }
                                  }
                                }
                              }
                            } catch (refErr) {
                              console.error("Error processing invite code lookup:", refErr);
                            }
                          }

                          await updateDoc(doc(db, "users", currentUser.id), {
                            name: cleanName,
                            gender: onboardingGender,
                            birthdate: onboardingBirthdate,
                            inviteCode: onboardingInviteCode,
                            invitedBy: referrerId || currentUser.invitedBy || null,
                            avatar: onboardingAvatar,
                            isOnboarded: true
                          });
                          
                          setCurrentScreen('explore');
                        } catch (err) {
                          console.error("Error saving profile onboarding:", err);
                          alert("عذراً، حدث خطأ أثناء الحفظ. يرجى المحاولة مرة أخرى.");
                        } finally {
                          setOnboardingLoading(false);
                        }
                      }}
                      className="w-full py-3.5 bg-[#FF7700] hover:bg-[#E06600] active:scale-[0.98] rounded-xl text-xs font-black text-white text-center flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                    >
                      {onboardingLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>جاري الحفظ...</span>
                        </>
                      ) : (
                        <span>تقديم</span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* SCREEN 2: ROOM EXPLORE LIST SCREEN (THE CORE TABBED DASHBOARD SYSTEM) */}
              {currentScreen === 'explore' && currentUser && (
                <div className="flex-grow flex flex-col h-full bg-[#FAF6EB] text-[#4A3E3D] relative overflow-hidden" id="screen-explore" dir="rtl">
                  
                  {/* SUB-VIEW RENDERING AREA */}
                  <div className={`flex-grow overflow-y-auto pb-24 ${dashboardTab === 'profile' ? 'p-0 pb-24' : 'p-4 pb-24 space-y-4'}`} id="dashboard-tab-content" style={{ backgroundColor: dashboardTab === 'profile' ? '#f8fafc' : undefined }}>

                    {/* ==================== 1. PARTY TAB (المجالس الصوتية) ==================== */}
                    {dashboardTab === 'party' && (() => {
                      // 1. First filter by search query if any
                      let filtered = (rooms || []).filter(room => {
                        if (!exploreSearchQuery) return true;
                        const query = exploreSearchQuery.toLowerCase().trim();
                        const owner = users.find(u => u.id === room.owner_id);
                        const ownerDisplayId = owner?.displayId || '';
                        return (
                          room.name.toLowerCase().includes(query) ||
                          room.hostName.toLowerCase().includes(query) ||
                          room.id.includes(query) ||
                          ownerDisplayId.toLowerCase().includes(query)
                        );
                      });

                      // 2. Filter / Sort by selected sub-tab
                      if (partySubTab === 'my_rooms') {
                        // "الخاص بي" - My own rooms + rooms I entered
                        filtered = filtered.filter(room => 
                          (room.owner_id && currentUser?.id && room.owner_id === currentUser.id) ||
                          visitedRoomIds.includes(room.id)
                        );
                      } else if (partySubTab === 'hashtag') {
                        // "هشتاق" - Trending rooms (sorted by activeUsersCount desc, then level desc)
                        filtered = [...filtered].sort((a, b) => {
                          const usersDiff = (b.activeUsersCount || 0) - (a.activeUsersCount || 0);
                          if (usersDiff !== 0) return usersDiff;
                          return (b.level || 0) - (a.level || 0);
                        });
                      } else if (partySubTab === 'newcomers') {
                        // "الجدد" - Rooms where owner's level is low (<=3) or owner's displayId is high (>=50510)
                        filtered = filtered.filter(room => {
                          if (!room.owner_id) return true; // fallback
                          const ownerUser = users.find(u => u.id === room.owner_id);
                          if (!ownerUser) return true; // fallback
                          const displayIdNum = ownerUser.displayId ? parseInt(ownerUser.displayId) : 0;
                          return ownerUser.level <= 3 || displayIdNum >= 50510;
                        });
                      }

                      return (
                        <div className="space-y-4 animate-fade-in" id="tab-panel-party">
                          {/* Search & Refresh row */}
                          <div className="flex gap-2">
                            <div className="relative flex-grow">
                              <input
                                type="text"
                                placeholder="البحث عن مجالس صوتية أو معرف ID..."
                                value={exploreSearchQuery}
                                onChange={(e) => setExploreSearchQuery(e.target.value)}
                                className="w-full bg-white border border-[#E8DCC4] rounded-full py-1.5 pl-3 pr-8 text-xs text-right text-[#4A3E3D] focus:outline-none focus:border-[#FFAE42]"
                              />
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute top-2.5 right-3" />
                            </div>
                            <button
                              onClick={() => {
                                setIsRefreshing(true);
                                setTimeout(() => setIsRefreshing(false), 1000);
                              }}
                              disabled={isRefreshing}
                              className="bg-white hover:bg-slate-50 border border-[#E8DCC4] p-2 rounded-full transition active:scale-95 flex items-center justify-center cursor-pointer"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 text-[#FFAE42] ${isRefreshing ? 'animate-spin' : ''}`} />
                            </button>
                          </div>

                          {/* Sub-tabs Navigation */}
                          <div className="flex bg-white/80 p-1 rounded-xl border border-[#E8DCC4]/50 relative select-none">
                            <button
                              onClick={() => setPartySubTab('my_rooms')}
                              className={`flex-1 text-center py-2 text-[10px] font-black rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                partySubTab === 'my_rooms'
                                  ? 'bg-[#FFAE42] text-white shadow-sm'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              <span>الخاص بي</span>
                            </button>
                            <button
                              onClick={() => setPartySubTab('hashtag')}
                              className={`flex-1 text-center py-2 text-[10px] font-black rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                partySubTab === 'hashtag'
                                  ? 'bg-[#FFAE42] text-white shadow-sm'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              <span>هشتاق</span>
                            </button>
                            <button
                              onClick={() => setPartySubTab('newcomers')}
                              className={`flex-1 text-center py-2 text-[10px] font-black rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                partySubTab === 'newcomers'
                                  ? 'bg-[#FFAE42] text-white shadow-sm'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              <span>الجدد</span>
                            </button>
                          </div>

                          <>
                              {/* Top banner */}
                              <div className="bg-gradient-to-r from-amber-500 to-yellow-400 p-3 rounded-2xl text-white shadow-sm relative overflow-hidden">
                                <div className="absolute -left-4 -bottom-4 text-6xl opacity-20">🎙️</div>
                                <h4 className="text-[11px] font-black">مهرجان صدى العرب الصوتي 🌟</h4>
                                <p className="text-[9px] text-amber-50 mt-0.5">شارك في مجالس الصوت واحصل على 50% عمولة هدايا فورية!</p>
                              </div>

                              {/* Rooms List */}
                              <div className="space-y-2.5">
                                {isRefreshing ? (
                                  <div className="space-y-2 animate-pulse">
                                    {[1, 2, 3].map(n => (
                                      <div key={n} className="h-16 bg-white rounded-xl border border-slate-100"></div>
                                    ))}
                                  </div>
                                ) : filtered.length === 0 ? (
                                  <div className="bg-white/80 border border-[#E8DCC4]/40 py-8 px-4 rounded-xl text-center text-[#4A3E3D] space-y-2">
                                    <span className="text-3xl block">📭</span>
                                    <p className="text-[10px] font-bold text-slate-500">لا توجد مجالس صوتية مطابقة في هذا القسم حالياً.</p>
                                  </div>
                                ) : (
                                  filtered.map((room) => {
                                    const isOwned = room.owner_id && currentUser?.id && room.owner_id === currentUser.id;
                                    const isNewUserRoom = (() => {
                                      if (!room.owner_id) return false;
                                      const ownerUser = users.find(u => u.id === room.owner_id);
                                      if (!ownerUser) return false;
                                      const displayIdNum = ownerUser.displayId ? parseInt(ownerUser.displayId) : 0;
                                      return ownerUser.level <= 3 || displayIdNum >= 50510;
                                    })();

                                    return (
                                      <div
                                        key={room.id}
                                        onClick={() => handleEnterRoom(room)}
                                        className="bg-white hover:bg-[#FDFBF7] border border-[#E8DCC4]/60 p-3 rounded-xl transition duration-150 cursor-pointer flex justify-between items-center shadow-sm hover:shadow active:scale-[0.99]"
                                        id={`room-item-${room.id}`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className="relative">
                                            <img
                                              src={room.hostAvatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=placeholder"}
                                              alt="host"
                                              className="w-11 h-11 rounded-lg object-cover border border-[#FFAE42]/20 shadow-sm"
                                            />
                                            {isOwned && (
                                              <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[7px] px-1 rounded border border-white">
                                                رومي 👑
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-right">
                                            <h4 className="text-xs font-extrabold text-[#4A3E3D] flex items-center gap-1">
                                              <span>{room.name}</span>
                                            </h4>
                                            <p className="text-[9px] text-slate-500 mt-0.5">المستضيف: {users.find(u => u.id === room.owner_id)?.displayId || room.owner_id}</p>
                                            <div className="flex gap-1.5 mt-1 items-center flex-wrap">
                                              <span className="bg-amber-50 text-[#FFAE42] text-[8px] px-1.5 py-0.5 rounded font-extrabold border border-[#FFAE42]/10">
                                                Lv.{room.level}
                                              </span>
                                              {isNewUserRoom && (
                                                <span className="bg-emerald-50 text-emerald-600 text-[8px] px-1.5 py-0.5 rounded font-bold border border-emerald-100 flex items-center gap-0.5">
                                                  🌱 عضو جديد
                                                </span>
                                              )}
                                              {room.activeUsersCount >= 5 && (
                                                <span className="bg-red-50 text-red-500 text-[8px] px-1.5 py-0.5 rounded font-bold border border-red-100 animate-pulse flex items-center gap-0.5">
                                                  🔥 ترند
                                                </span>
                                              )}
                                              <span className="bg-emerald-50 text-emerald-600 text-[8px] px-1.5 py-0.5 rounded font-bold border border-emerald-100">
                                                مجلس عام 🔓
                                              </span>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="text-left flex items-center gap-1 bg-[#FFAE42]/10 px-2 py-0.5 rounded-full border border-[#FFAE42]/20">
                                          <span className="relative flex h-1.5 w-1.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                          </span>
                                          <span className="text-[9px] font-mono text-[#D97706] font-extrabold">
                                            <RoomActiveUsersCount roomId={room.id} initialCount={room.activeUsersCount} /> متواجد
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </>

                          {/* Floating Golden Microphone Create Room button */}
                          <div className="fixed bottom-20 left-4 z-40">
                            {(() => {
                              const myRoom = rooms?.find(r => 
                                (r.owner_id && currentUser?.id && r.owner_id === currentUser?.id)
                              );
                              if (myRoom) {
                                return (<button
                                    onClick={() => handleEnterRoom(myRoom)}
                                    className="bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-white font-black text-xs p-3.5 rounded-full shadow-lg flex items-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer border-2 border-white"
                                  >
                                    <span>🎙️ الدخول للغرفة</span>
                                  </button>
                                );
                              } else {
                                return (<button
                                    onClick={() => {
                                      setNewRoomNameInput('');
                                      setNewRoomIsPrivate(false);
                                      setNewRoomPassword('');
                                      setNewRoomError('');
                                      setIsCreateRoomModalOpen(true);
                                    }}
                                    className="bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-white font-black text-xs p-3.5 rounded-full shadow-lg flex items-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer border-2 border-white"
                                  >
                                    <span>🎙️ إنشاء روم</span>
                                  </button>
                                );
                              }
                            })()}
                          </div>
                        </div>
                      );
                    })()}

                    {/* ==================== 2. CALL MATCHING TAB (مطابقة المكالمات الفورية) ==================== */}
                    {dashboardTab === 'games' && (
                      <div className="space-y-4 animate-fade-in text-right" id="tab-panel-matching">
                        {activeCall ? (
                          /* Compact Ongoing Call Card */
                          <div className="bg-[#FFFDF9] border border-[#E8DCC4] p-5 rounded-2xl shadow-md space-y-4 relative overflow-hidden font-sans text-right animate-fade-in" dir="rtl">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                              <div className="flex items-center gap-1.5">
                                <span className="flex h-2.5 w-2.5 relative">
                                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeCall.status === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${activeCall.status === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                </span>
                                <span className="text-[10px] font-black text-slate-500">
                                  {activeCall.status === 'connected' ? 'مكالمة صوتية نشطة' : 'جاري الاتصال بالشريك...'}
                                </span>
                              </div>
                              <span className="text-[10px] font-black font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                                ⏱️ {formatDuration(activeCall.duration)}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-full border border-slate-200 overflow-hidden bg-white shadow-sm flex-shrink-0">
                                <img
                                  src={activeCall.user.avatar}
                                  alt={activeCall.user.name}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <div className="space-y-0.5">
                                <h4 className="text-xs font-black text-[#4A3E3D] flex items-center gap-1.5">
                                  <span 
                                    className="hover:underline cursor-pointer"
                                    onClick={() => {
                                      setSelectedProfileUser(activeCall.user);
                                      setIsProfileModalOpen(true);
                                    }}
                                  >
                                    {activeCall.user.name}
                                  </span>
                                  <span className="bg-amber-100 text-[#FFAE42] text-[8px] px-1.5 py-0.2 rounded font-black">
                                    Lv.{activeCall.user.level}
                                  </span>
                                </h4>
                                <p className="text-[9px] text-slate-400 font-bold">
                                  معرف ID: {activeCall.user.displayId} | 🌐 {activeCall.user.country || 'عربي'}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <button
                                onClick={() => setIsCallMinimized(false)}
                                className="bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-white text-[10px] font-black py-2.5 rounded-xl transition active:scale-95 shadow cursor-pointer text-center flex items-center justify-center gap-1"
                              >
                                <span>📱 الشاشة الكاملة</span>
                              </button>
                              <button
                                onClick={async () => {
                                  if (activeCall?.callId) {
                                    try {
                                      await updateDoc(doc(db, 'calls', activeCall.callId), { status: 'hungup' });
                                    } catch (e) {
                                      console.error("Error setting call status to hungup:", e);
                                    }
                                  }
                                  handleCloseWebRTCCall();
                                  setShowCallGiftModal(false);
                                }}
                                className="bg-red-500 hover:bg-red-600 text-white text-[10px] font-black py-2.5 rounded-xl transition active:scale-95 shadow cursor-pointer text-center flex items-center justify-center gap-1"
                              >
                                <span>📞 إنهاء المكالمة</span>
                              </button>
                            </div>
                          </div>
                        ) : isMatching ? (
                          /* Active WebRTC Match Search Radar Layout */
                          <div className="bg-[#FFFDF9] border border-[#E8DCC4] p-6 rounded-2xl shadow-md space-y-5 text-center font-sans relative overflow-hidden animate-fade-in" dir="rtl">
                            {/* Pulsing Radar Ring Animations */}
                            <div className="flex items-center justify-center py-6 relative">
                              <div className="absolute w-24 h-24 rounded-full bg-amber-400/10 animate-ping"></div>
                              <div className="absolute w-16 h-16 rounded-full bg-amber-400/20 animate-pulse"></div>
                              <div className="w-12 h-12 rounded-full bg-[#FFAE42] text-white flex items-center justify-center shadow-lg relative z-10 animate-bounce">
                                <Phone className="w-6 h-6 animate-pulse" />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <h4 className="text-xs font-black text-[#4A3E3D]">{matchCustomStatus}</h4>
                              <p className="text-[9px] text-slate-400 font-bold">نسبة البحث: {matchProgress}%</p>
                            </div>

                            {/* Elegant Progress bar */}
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full transition-all duration-300 rounded-full"
                                style={{ width: `${matchProgress}%` }}
                              ></div>
                            </div>

                            <button
                              onClick={handleCancelMatching}
                              className="w-full bg-red-500 hover:bg-red-600 text-white text-[10px] py-2 rounded-xl font-black transition active:scale-95 cursor-pointer"
                            >
                              إلغاء البحث ❌
                            </button>
                          </div>
                        ) : (
                          /* Girls Direct Calls List Screen Layout + Quick Match Card */
                          (() => {
                            // Construct list of real female users from state
                            const realFemales = users.filter(u => u.gender === 'female' && u.id !== currentUser?.id && isUserOnline(u));
                            
                            return (
                              <div className="space-y-4 font-sans text-right animate-fade-in" dir="rtl">
                                <div className="space-y-1">
                                  <h4 className="text-[10px] font-black text-[#4A3E3D]">مضيفات صدى العرب النشطات 🌸</h4>
                                  <p className="text-[8px] text-slate-400 font-bold">يمكنك الاتصال مباشرة بإحدى المضيفات أدناه لبدء محادثة خاصة</p>
                                </div>

                                {/* Females List */}
                                <div className="space-y-2 pr-0.5">
                                  {realFemales.length === 0 ? (
                                    <div className="bg-white/80 border border-[#E8DCC4]/40 py-8 px-4 rounded-xl text-center text-[#4A3E3D] space-y-2">
                                      <span className="text-3xl block">👥</span>
                                      <p className="text-[10px] font-bold text-slate-500 font-sans">لا يوجد مضيفات متصلات حالياً.</p>
                                    </div>
                                  ) : (
                                    realFemales.map((female) => (
                                      <div 
                                        key={female.id}
                                        className="bg-white border border-[#E8DCC4]/60 hover:border-pink-200 p-3 rounded-2xl transition-all duration-200 flex items-center justify-between shadow-sm hover:shadow"
                                      >
                                        <div className="flex items-center gap-3">
                                          <div 
                                            className="relative flex-shrink-0 cursor-pointer"
                                            onClick={() => {
                                              setSelectedProfileUser(female);
                                              setIsProfileModalOpen(true);
                                            }}
                                          >
                                            <img 
                                              src={female.avatar} 
                                              alt={female.name} 
                                              className="w-11 h-11 rounded-full border-2 border-pink-100 object-cover shadow-sm"
                                              referrerPolicy="no-referrer"
                                            />
                                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white animate-pulse"></span>
                                          </div>
                                          <div className="text-right space-y-0.5">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <h4 
                                                className="text-[11px] font-black text-slate-800 cursor-pointer hover:underline"
                                                onClick={() => {
                                                  setSelectedProfileUser(female);
                                                  setIsProfileModalOpen(true);
                                                }}
                                              >
                                                {female.name}
                                              </h4>
                                              <span className="bg-amber-100 text-amber-800 text-[8px] font-black px-1 py-0.2 rounded">
                                                Lv.{female.level}
                                              </span>
                                              <span className="bg-pink-50 text-pink-600 text-[8px] font-extrabold px-1 rounded border border-pink-100/40">
                                                👩 أنثى
                                              </span>
                                            </div>
                                            <p className="text-[9px] text-slate-400 font-bold">
                                              ID: {female.displayId || female.id.substring(0, 6)} | 🌐 {female.country || 'السعودية'}
                                            </p>
                                            {female.bio && (
                                              <p className="text-[9px] text-slate-500 font-bold max-w-[170px] truncate">
                                                {female.bio}
                                              </p>
                                            )}
                                          </div>
                                        </div>

                                        {/* Call Button */}
                                        <button
                                          onClick={() => handleStartDirectCall(female)}
                                          className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-extrabold text-[9px] px-3.5 py-1.5 rounded-xl flex items-center gap-1 shadow-sm active:scale-95 transition-all duration-150 cursor-pointer flex-shrink-0"
                                        >
                                          <Phone className="w-2.5 h-2.5" />
                                          <span>اتصل الآن</span>
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            );
                          })()
                        )}
                      </div>
                    )}

                    {/* ==================== 3. MOMENTS / COMMUNITY POSTS TAB (المنشورات واللحظات) ==================== */}
                    {dashboardTab === 'explore' && (
                      <div className="space-y-4 animate-fade-in text-right font-sans" dir="rtl" id="tab-panel-posts">
                        
                        {/* Create Post Section */}
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8DCC4]/60 space-y-3">
                          <div className="flex gap-3 items-start">
                            <img 
                              src={currentUser?.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=placeholder"} 
                              alt="user avatar" 
                              className="w-10 h-10 rounded-full border border-amber-200 object-cover"
                            />
                            <div className="flex-grow">
                              <textarea
                                value={newPostText}
                                onChange={(e) => setNewPostText(e.target.value)}
                                placeholder="ماذا يدور في ذهنك اليوم؟ انشر لحظة جديدة... 🌸"
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs text-slate-700 outline-none focus:border-[#FFAE42]/50 transition resize-none h-20 placeholder:text-slate-400 font-bold"
                              />
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                            <span className="text-[10px] text-slate-400 font-bold">انشر ليراها الجميع في صدى العرب ✨</span>
                            <button
                              onClick={handleCreatePost}
                              disabled={isPosting || !newPostText.trim()}
                              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 disabled:opacity-50 text-white text-[10px] font-black rounded-xl shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                            >
                              <span>{isPosting ? 'جاري النشر...' : 'نشر اللحظة 🚀'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Posts Feed */}
                        <div className="space-y-3.5">
                          {communityPosts.length === 0 ? (
                            <div className="bg-white border border-[#E8DCC4]/40 py-12 px-4 rounded-2xl text-center text-[#4A3E3D] space-y-3">
                              <span className="text-4xl block">✨</span>
                              <h4 className="text-xs font-black">لا توجد منشورات حالياً</h4>
                              <p className="text-[10px] text-slate-400 font-bold">كن أول من ينشر لحظة مميزة في صدى العرب!</p>
                            </div>
                          ) : (
                            communityPosts.map((post) => {
                              const isLiked = post.likedBy?.includes(currentUser?.id);
                              const isMyPost = currentUser?.id === post.userId;
                              const isAdmin = currentUser?.role === 'admin';
                              const commentsCount = post.comments?.length || 0;
                              const showComments = showCommentsForPostId === post.id;
                              
                              // Simple time ago formatter helper
                              const timeString = (() => {
                                if (!post.timestamp) return "غير معروف";
                                const diffMs = Date.now() - Number(post.timestamp);
                                const diffSec = Math.floor(diffMs / 1000);
                                if (diffSec < 60) return "الآن";
                                const diffMin = Math.floor(diffSec / 60);
                                if (diffMin < 60) return `منذ ${diffMin} د`;
                                const diffHr = Math.floor(diffMin / 60);
                                if (diffHr < 24) return `منذ ${diffHr} س`;
                                const diffDays = Math.floor(diffHr / 24);
                                return `منذ ${diffDays} يوم`;
                              })();

                              return (
                                <div 
                                  key={post.id} 
                                  className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8DCC4]/40 space-y-3 relative transition duration-200 hover:shadow"
                                >
                                  {/* Author Header */}
                                  <div className="flex justify-between items-start">
                                    <div className="flex gap-3 items-center">
                                      <div 
                                        className="cursor-pointer"
                                        onClick={() => {
                                          const foundUser = users?.find(u => u.id === post.userId);
                                          if (foundUser) {
                                            setSelectedProfileUser(foundUser);
                                            setIsProfileModalOpen(true);
                                          }
                                        }}
                                      >
                                        <img 
                                          src={post.userAvatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=placeholder"} 
                                          alt={post.userName} 
                                          className="w-10 h-10 rounded-full border border-slate-100 object-cover shadow-sm"
                                        />
                                      </div>
                                      <div className="text-right">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span 
                                            className="text-xs font-black text-[#4A3E3D] hover:underline cursor-pointer"
                                            onClick={() => {
                                              const foundUser = users?.find(u => u.id === post.userId);
                                              if (foundUser) {
                                                setSelectedProfileUser(foundUser);
                                                setIsProfileModalOpen(true);
                                              }
                                            }}
                                          >
                                            {post.userName}
                                          </span>
                                          <span className="bg-amber-100 text-[#D97706] text-[8px] font-black px-1.5 py-0.2 rounded">
                                            Lv.{post.userLevel || 1}
                                          </span>
                                          {post.vipLevel > 0 && (
                                            <span className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white font-black text-[7px] px-1.5 py-0.2 rounded shadow-sm">
                                              👑 VIP {post.vipLevel}
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-[8px] text-slate-400 font-bold block mt-0.5">{timeString}</span>
                                      </div>
                                    </div>

                                    {(isMyPost || isAdmin) && (
                                      <button 
                                        onClick={() => handleDeletePost(post.id)}
                                        className="text-slate-300 hover:text-red-500 transition duration-150 p-1"
                                        title="حذف المنشور"
                                      >
                                        <span className="text-xs">🗑️</span>
                                      </button>
                                    )}
                                  </div>

                                  {/* Post content */}
                                  <p className="text-xs text-[#4A3E3D] leading-relaxed font-semibold whitespace-pre-wrap font-sans pr-1">
                                    {post.text}
                                  </p>

                                  {/* Actions Footer Bar */}
                                  <div className="flex items-center gap-6 pt-2 border-t border-slate-50 text-[10px] font-bold text-slate-500">
                                    {/* Like Button */}
                                    <button 
                                      onClick={() => handleToggleLikePost(post)}
                                      className={`flex items-center gap-1.5 transition active:scale-90 hover:text-red-500 cursor-pointer ${isLiked ? 'text-rose-500' : 'text-slate-400'}`}
                                    >
                                      <span className="text-sm">{isLiked ? '❤️' : '🤍'}</span>
                                      <span>{post.likes || 0} إعجاب</span>
                                    </button>

                                    {/* Comments Button */}
                                    <button 
                                      onClick={() => setShowCommentsForPostId(showComments ? null : post.id)}
                                      className={`flex items-center gap-1.5 transition active:scale-90 hover:text-amber-500 cursor-pointer ${showComments ? 'text-amber-500' : 'text-slate-400'}`}
                                    >
                                      <span className="text-sm">💬</span>
                                      <span>{commentsCount} تعليق</span>
                                    </button>
                                  </div>

                                  {/* Comments Expandable Panel */}
                                  {showComments && (
                                    <div className="pt-3 border-t border-slate-100 space-y-3 animate-fade-in text-[10px]">
                                      {/* Existing comments list */}
                                      {commentsCount > 0 && (
                                        <div className="space-y-2 max-h-48 overflow-y-auto pl-1 bg-slate-50/50 p-2 rounded-xl">
                                          {post.comments.map((comment: any) => (
                                            <div key={comment.id} className="flex gap-2.5 items-start">
                                              <img 
                                                src={comment.userAvatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=placeholder"} 
                                                alt={comment.userName} 
                                                className="w-6 h-6 rounded-full border border-slate-100 object-cover"
                                              />
                                              <div className="bg-slate-100/70 p-2 rounded-xl flex-grow text-right">
                                                <div className="flex justify-between items-center">
                                                  <span className="font-extrabold text-[#4A3E3D]">{comment.userName}</span>
                                                  <span className="text-[7px] text-slate-400">
                                                    {(() => {
                                                      if (!comment.timestamp) return "";
                                                      const diff = Date.now() - comment.timestamp;
                                                      if (diff < 60000) return "الآن";
                                                      const mins = Math.floor(diff / 60000);
                                                      if (mins < 60) return `منذ ${mins} د`;
                                                      return new Date(comment.timestamp).toLocaleDateString('ar-EG');
                                                    })()}
                                                  </span>
                                                </div>
                                                <p className="text-slate-600 mt-0.5 leading-relaxed font-semibold">{comment.text}</p>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {/* Add Comment Input Row */}
                                      <div className="flex gap-2 items-center">
                                        <input
                                          type="text"
                                          value={newCommentText[post.id] || ''}
                                          onChange={(e) => setNewCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                                          placeholder="أضف تعليقك هنا..."
                                          className="flex-grow bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] text-slate-700 outline-none focus:border-[#FFAE42]/40 font-bold"
                                        />
                                        <button
                                          onClick={() => handleAddComment(post.id)}
                                          className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-xl transition duration-150 cursor-pointer text-center"
                                        >
                                          إرسال
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    {/* ==================== 4. MESSAGES TAB (الرسائل والأصدقاء) ==================== */}
                    {dashboardTab === 'messages' && (
                      <div className="space-y-4 animate-fade-in" id="tab-panel-messages">

                        {/* Chats list */}
                        <div className="space-y-2">
                          {/* System Support Chat */}
                          <div 
                            onClick={() => setSupportChatOpen(true)}
                            className="bg-white p-3 rounded-xl border border-[#E8DCC4]/60 shadow-sm flex justify-between items-center hover:bg-[#FDFBF7] cursor-pointer transition active:scale-[0.99]"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 rounded-full bg-amber-50 border border-[#FFAE42]/20 flex items-center justify-center text-xl relative shadow-inner">
                                🐱
                                <span className="absolute -top-0.5 -right-0.5 bg-red-500 w-2.5 h-2.5 rounded-full border border-white"></span>
                              </div>
                              <div className="text-right font-sans">
                                <h4 className="text-xs font-black text-[#4A3E3D]">الدعم الفني والخدمة لصدى 🛡️</h4>
                                <p className="text-[10px] text-slate-500 truncate w-48 mt-0.5">مرحباً بك في صدى العرب يا بطل! نحن هنا لمساعدتك...</p>
                              </div>
                            </div>
                            <span className="text-[8px] text-slate-400 font-mono">الآن</span>
                          </div>

                          {/* Dynamic Real Chat Threads */}
                          {(() => {
                            const threadsMap = new Map<string, PrivateMessage>();
                            privateMessages.forEach(msg => {
                              const otherUserId = msg.senderId === currentUser?.id ? msg.receiverId : msg.senderId;
                              const currentLatest = threadsMap.get(otherUserId);
                              if (!currentLatest || new Date(msg.timestamp) > new Date(currentLatest.timestamp)) {
                                threadsMap.set(otherUserId, msg);
                              }
                            });

                            return Array.from(threadsMap.values()).map(latestMsg => {
                              const otherUserId = latestMsg.senderId === currentUser?.id ? latestMsg.receiverId : latestMsg.senderId;
                              const otherUser = users?.find(u => u.id === otherUserId) || {
                                id: otherUserId,
                                name: latestMsg.senderId === currentUser?.id ? latestMsg.receiverName : latestMsg.senderName,
                                avatar: latestMsg.senderId === currentUser?.id ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde' : latestMsg.senderAvatar,
                                level: 1
                              };

                              const isUnread = latestMsg.receiverId === currentUser?.id && !latestMsg.isRead;

                              return (
                                <div
                                  key={otherUserId}
                                  onClick={() => {
                                    setActivePrivateChatUser(otherUser as AppUser);
                                    setIsPrivateInboxOpen(true);
                                  }}
                                  className="bg-white p-3 rounded-xl border border-[#E8DCC4]/60 shadow-sm flex justify-between items-center hover:bg-[#FDFBF7] cursor-pointer transition active:scale-[0.99] text-right"
                                >
                                  <span className="text-[8px] text-slate-400 font-mono">
                                    {new Date(latestMsg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                  </span>

                                  <div className="flex items-center gap-2.5">
                                    <div className="text-right font-sans">
                                      <h4 className={`text-xs font-black ${isUnread ? 'text-red-500' : 'text-[#4A3E3D]'}`}>{otherUser.name}</h4>
                                      <p className="text-[10px] text-slate-500 truncate w-48 mt-0.5">
                                        {latestMsg.isEncrypted ? (
                                          <span className="flex items-center justify-end gap-1">
                                            <span>🔐</span>
                                            <EncryptedMessageText
                                              ciphertext={latestMsg.rawCiphertext || latestMsg.text}
                                              iv={latestMsg.iv || ''}
                                              derivedKey={privateKey}
                                              showCiphertext={false}
                                              fallbackText="رسالة آمنة"
                                            />
                                          </span>
                                        ) : latestMsg.text}
                                      </p>
                                    </div>
                                    <div className="relative">
                                      <img
                                        src={otherUser.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=placeholder"}
                                        alt=""
                                        className="w-10 h-10 rounded-full object-cover border border-purple-500/20"
                                      />
                                      {isUnread && (
                                        <span className="absolute -top-0.5 -right-0.5 bg-red-500 w-2.5 h-2.5 rounded-full border border-white animate-pulse"></span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}

                    {/* ==================== 5. ME / PROFILE TAB (الملف الشخصي الفاخر) ==================== */}
                    {dashboardTab === 'profile' && (
                      <div className="space-y-4 animate-fade-in w-full" id="tab-panel-profile">
                        <ProfileIndex setCurrentScreen={(val) => setCurrentScreen(val as any)} 
                          currentUser={currentUser}
                          users={users}
                          onToggleFollow={handleToggleFollow}
                          supportTickets={supportTickets}
                          setIsSupportAdminModalOpen={setIsSupportAdminModalOpen}
                          setIsAdminManageModalOpen={setIsAdminManageModalOpen}
                          setSupportChatOpen={setSupportChatOpen}
                          setIsProfileModalOpen={setIsProfileModalOpen}
                          setSelectedProfileUser={setSelectedProfileUser}
                          setIsEditingBio={setIsEditingBio}
                          setBioEditValue={setBioEditValue}
                          onEnterMyRoom={() => {
                            const myRoom = rooms?.find(r => r.owner_id && currentUser?.id && r.owner_id === currentUser?.id);
                            if (myRoom) {
                              handleEnterRoom(myRoom);
                            } else {
                              setNewRoomNameInput('');
                              setNewRoomIsPrivate(false);
                              setNewRoomPassword('');
                              setNewRoomError('');
                              setIsCreateRoomModalOpen(true);
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                  {/* NATIVE PREMIUM BOTTOM NAVIGATION BAR */}
                  <div 
                    className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E8DCC4]/60 flex justify-around items-center px-2 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] z-40 select-none"
                    style={{
                      height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
                      paddingBottom: 'env(safe-area-inset-bottom, 0px)'
                    }}
                  >
                    
                    {/* Tab 1: Party */}
                    <button
                      onClick={() => setDashboardTab('party')}
                      className={`flex flex-col items-center justify-center w-14 h-full transition-all duration-150 ${
                        dashboardTab === 'party' ? 'text-[#FFAE42] scale-105 font-black' : 'text-slate-400 font-medium'
                      } cursor-pointer`}
                    >
                      <span className="text-xl leading-none">🎙️</span>
                      <span className="text-[9px] mt-1 leading-none">الحفلة</span>
                    </button>

                    {/* Tab 2: Matching */}
                    <button
                      onClick={() => setDashboardTab('games')}
                      className={`flex flex-col items-center justify-center w-14 h-full transition-all duration-150 ${
                        dashboardTab === 'games' ? 'text-[#FFAE42] scale-105 font-black' : 'text-slate-400 font-medium'
                      } cursor-pointer`}
                      id="tab-button-matching"
                    >
                      <span className="text-xl leading-none">⚡</span>
                      <span className="text-[9px] mt-1 leading-none">المطابقة</span>
                    </button>

                    {/* Tab 3: Posts */}
                    <button
                      onClick={() => setDashboardTab('explore')}
                      className={`flex flex-col items-center justify-center w-14 h-full transition-all duration-150 ${
                        dashboardTab === 'explore' ? 'text-[#FFAE42] scale-105 font-black' : 'text-slate-400 font-medium'
                      } cursor-pointer`}
                    >
                      <span className="text-xl leading-none">🧭</span>
                      <span className="text-[9px] mt-1 leading-none">المنشورات</span>
                    </button>

                    {/* Tab 4: Messages */}
                    <button
                      onClick={() => setDashboardTab('messages')}
                      className={`flex flex-col items-center justify-center w-14 h-full transition-all duration-150 relative ${
                        dashboardTab === 'messages' ? 'text-[#FFAE42] scale-105 font-black' : 'text-slate-400 font-medium'
                      } cursor-pointer`}
                    >
                      {/* Red unread messages badge */}
                      {(() => {
                        const count = privateMessages.filter(msg => msg.receiverId === currentUser?.id && !msg.isRead).length;
                        if (count === 0) return null;
                        return (
                          <span className="absolute top-2 right-3 bg-red-500 text-white font-extrabold text-[7px] w-3.5 h-3.5 rounded-full flex items-center justify-center border border-white">
                            {count}
                          </span>
                        );
                      })()}
                      <span className="text-xl leading-none">✉️</span>
                      <span className="text-[9px] mt-1 leading-none">الرسائل</span>
                    </button>

                    {/* Tab 5: Me */}
                    <button
                      onClick={() => setDashboardTab('profile')}
                      className={`flex flex-col items-center justify-center w-14 h-full transition-all duration-150 ${
                        dashboardTab === 'profile' ? 'text-[#FFAE42] scale-105 font-black' : 'text-slate-400 font-medium'
                      } cursor-pointer`}
                    >
                      <span className="text-xl leading-none">👤</span>
                      <span className="text-[9px] mt-1 leading-none">أنا</span>
                    </button>
                  </div>

                  {/* ==================== MODAL OVERLAYS AND POPUPS ==================== */}

                  {/* Private Room PIN Modal prompt */}
                  {selectedLockedRoom && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-6 z-50 animate-fade-in" dir="rtl">
                      <div className="bg-white border border-[#E8DCC4] p-5 rounded-2xl w-full max-w-xs text-right space-y-4 shadow-xl">
                        <div className="text-center">
                          <span className="text-3xl block mb-2 animate-bounce">🔒</span>
                          <h4 className="text-sm font-black text-[#4A3E3D]">المجلس محمي بكلمة سر</h4>
                          <p className="text-[10px] text-slate-500 mt-1">يرجى إدخال رمز المرور للدخول لهذا المجلس الصوتي</p>
                          <span className="text-[9px] text-amber-600 font-mono bg-amber-50 px-2.5 py-0.5 rounded border border-amber-400/20 mt-2 inline-block">
                            💡 الرمز الافتراضي للتجربة والمتابعة هو: 123
                          </span>
                        </div>

                        <div className="space-y-1">
                          <input
                            type="password"
                            placeholder="أدخل رمز الدخول PIN"
                            value={roomPasswordInput}
                            onChange={(e) => {
                              setRoomPasswordInput(e.target.value);
                              setRoomPasswordError(false);
                            }}
                            className="w-full bg-slate-50 border border-[#E8DCC4] rounded-xl p-2.5 text-center text-xs text-[#4A3E3D] font-mono tracking-widest focus:outline-none focus:border-[#FFAE42]"
                          />
                          {roomPasswordError && (
                            <span className="text-[9px] text-red-500 text-center block font-bold">رمز الدخول غير صحيح!</span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            onClick={() => setSelectedLockedRoom(null)}
                            className="bg-slate-100 hover:bg-slate-200 py-2 rounded-xl text-xs font-bold text-[#8B7E74] transition"
                          >
                            إلغاء
                          </button>
                          <button
                            onClick={handleVerifyRoomPassword}
                            className="bg-[#FFAE42] text-white py-2 rounded-xl text-xs font-black transition shadow-sm"
                          >
                            تأكيد الدخول
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Create Custom Room Modal */}
                  {isCreateRoomModalOpen && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-6 z-50 animate-fade-in" dir="rtl">
                      <div className="bg-white border border-[#E8DCC4] p-5 rounded-3xl w-full max-w-xs text-right space-y-4 shadow-2xl animate-scale-up">
                        <div className="text-center border-b border-slate-100 pb-3">
                          <span className="text-3xl block mb-1 animate-pulse">🎙️</span>
                          <h4 className="text-sm font-black text-[#4A3E3D]">إنشاء روم صوتي جديد</h4>
                          <p className="text-[10px] text-slate-500 mt-1">ابدأ الروم الخاص بك الآن واستضيف أصدقائك للدردشة الصوتية</p>
                        </div>

                        {newRoomError && (
                          <div className="bg-rose-50 text-rose-700 text-[10px] p-2 rounded-lg border border-rose-200 text-center font-bold">
                            ⚠️ {newRoomError}
                          </div>
                        )}

                        <div className="space-y-3.5">
                          {/* Room Name Input */}
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 font-bold block">اسم الروم</label>
                            <input
                              type="text"
                              placeholder="مثال: مجلس ديوانية العرب ☕"
                              value={newRoomNameInput}
                              onChange={(e) => {
                                setNewRoomNameInput(e.target.value);
                                setNewRoomError('');
                              }}
                              className="w-full bg-[#FAF6EB] border border-[#DCD7C9] rounded-xl p-2.5 text-right text-xs text-[#4A3E3D] focus:outline-none focus:border-[#FFAE42]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setIsCreateRoomModalOpen(false)}
                            className="bg-slate-100 hover:bg-slate-200 py-2.5 rounded-xl text-xs font-bold text-[#8B7E74] transition"
                            disabled={newRoomLoading}
                          >
                            إلغاء
                          </button>
                          <button
                            type="button"
                            disabled={newRoomLoading}
                            onClick={async () => {
                                if (!newRoomNameInput.trim()) {
                                  setNewRoomError('يرجى كتابة اسم المجلس الصوتي أولاً');
                                  return;
                                }
                                if (newRoomIsPrivate && !newRoomPassword.trim()) {
                                  setNewRoomError('يرجى كتابة رمز الدخول السري للمجلس الخاص');
                                  return;
                                }

                                setNewRoomLoading(true);
                                setNewRoomError('');
                                const result = await handleCreateRoom(newRoomNameInput.trim()); if (result && !result.success) { setNewRoomError(result.error); }
                                setNewRoomLoading(false);
                              }}
                            className="bg-[#FFAE42] text-white py-2.5 rounded-xl text-xs font-black transition shadow-sm hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            {newRoomLoading ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>جاري الإنشاء...</span>
                              </>
                            ) : (
                              <span>إنشاء الروم ✨</span>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Daily Bonus Chest Overlay Modal */}
                  {isDailyBonusOpen && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-6 z-50 animate-fade-in" dir="rtl">
                      <div className="bg-gradient-to-b from-white to-[#FAF6EB] p-5 rounded-3xl w-full max-w-xs text-center space-y-4 border border-[#E8DCC4] shadow-2xl relative">
                          <button
                            onClick={() => setIsDailyBonusOpen(false)}
                            className="absolute top-3 right-3 text-slate-400 hover:text-[#4A3E3D] font-bold text-xs"
                          >
                            ✕
                          </button>
                        
                        <div className="space-y-1">
                          <span className="text-5xl block animate-bounce duration-[2000ms]">🎁</span>
                          <h4 className="text-sm font-black text-[#4A3E3D]">صندوق الهدايا اليومية لصدى</h4>
                          <p className="text-[10px] text-slate-500">افتح الصندوق لتحصل على مكافأة الكوينزات الترحيبية!</p>
                        </div>

                        <div className="bg-amber-50 rounded-2xl p-4 border border-[#FFAE42]/20 flex flex-col items-center justify-center">
                          <span className="text-3xl font-black text-[#FFAE42] animate-pulse">🪙 +50 كوينز</span>
                          <span className="text-[8px] text-slate-400 mt-1">تضاف فوراً لرصيد حسابك السحابي</span>
                        </div>

                          <button
                            onClick={async () => {
                              try {
                                await updateDoc(doc(db, "users", currentUser?.id), {
                                  coins: increment(50)
                                });
                                setDailyBonusClaimed(true);
                                setIsDailyBonusOpen(false);
                                alert('🎉 مبروك! تم إضافة 50 كوينز بنجاح لحسابك!');
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className="w-full bg-[#FFAE42] text-white py-2.5 rounded-xl text-xs font-black transition shadow"
                          >
                            استلم المكافأة الآن ✨
                          </button>
                      </div>
                    </div>
                  )}

                  {/* Drifting Bottle Overlay Game Modal */}
                  {driftingBottleMode !== 'idle' && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-6 z-50 animate-fade-in" dir="rtl">
                      <div className="bg-white p-5 rounded-3xl w-full max-w-xs text-right space-y-4 border border-[#E8DCC4] shadow-2xl relative">
                          <button
                            onClick={() => { setDriftingBottleMode('idle'); setBottleMessage(''); setPickedBottle(null); }}
                          className="absolute top-3 right-3 text-slate-400 hover:text-[#4A3E3D] font-bold text-xs"
                        >
                          ✕
                        </button>

                        <div className="text-center">
                          <span className="text-4xl block mb-1 animate-bounce">🍾</span>
                          <h4 className="text-sm font-black text-[#4A3E3D]">زجاجة رسائل البحر لصدى</h4>
                          <p className="text-[10px] text-slate-500">اكتب سراً ليجده الأصدقاء، أو التقط زجاجة مجهولة!</p>
                        </div>

                        {/* Mode selectors */}
                        <div className="flex gap-2 bg-slate-100 p-1 rounded-full text-center">
                            <button
                              onClick={() => { setDriftingBottleMode('writing'); setPickedBottle(null); }}
                            className={`w-1/2 py-1 rounded-full text-[10px] font-bold ${driftingBottleMode === 'writing' ? 'bg-[#FFAE42] text-white' : 'text-slate-500'}`}
                          >
                            اكتب وارمِ زجاجة ✍️
                          </button>
                            <button
                              onClick={() => {
                                setDriftingBottleMode('reading');
                              const sampleMessages = [
                                'ريم الرياض: "أتمنى للجميع سهرة طرب ممتعة الليلة في مجالسنا!"',
                                'فارس نجد: "صوتك كنز يا منشد الغرفة، الله يحفظك!"',
                                'سلطان العرب: "من يتحدى كيرم الليلة؟ حياكم بغرفة الطرب!"',
                                'صوت الحرمين: "صباح الخير والمسرات لأجمل أخوة وأخوات!"'
                              ];
                              setPickedBottle(sampleMessages[Math.floor(Math.random() * sampleMessages.length)]);
                            }}
                            className={`w-1/2 py-1 rounded-full text-[10px] font-bold ${driftingBottleMode === 'reading' ? 'bg-[#FFAE42] text-white' : 'text-slate-500'}`}
                          >
                            التقط زجاجة 🌊
                          </button>
                        </div>

                        {driftingBottleMode === 'writing' ? (
                          <div className="space-y-2">
                            <textarea
                              rows={3}
                              placeholder="اكتب رسالتك السرية هنا... يرجى الالتزام بالود والاحترام."
                              value={bottleMessage}
                              onChange={(e) => setBottleMessage(e.target.value)}
                              className="w-full bg-slate-50 border border-[#E8DCC4] rounded-2xl p-2.5 text-xs text-[#4A3E3D] focus:outline-none focus:border-[#FFAE42] text-right"
                            />
                              <button
                                onClick={() => {
                                  if (bottleMessage.trim()) {
                                  alert('🎉 قمت برمي زجاجتك في البحر بنجاح! سينتظر الأصدقاء التقاطها بقرب الشاطئ.');
                                  setBottleMessage('');
                                  setDriftingBottleMode('idle');
                                } else {
                                  alert('الرجاء كتابة رسالة قبل الرمي!');
                                }
                              }}
                              className="w-full bg-[#FFAE42] text-white py-2 rounded-xl text-xs font-black transition"
                            >
                              ارمِ الزجاجة في البحر 🌊
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3 bg-cyan-50/50 p-3 rounded-2xl border border-cyan-100 text-right">
                            <span className="text-[9px] text-cyan-600 block font-bold">📜 عثرت على زجاجة مكتوب عليها:</span>
                            <p className="text-xs text-[#4A3E3D] leading-relaxed italic">{pickedBottle}</p>
                              <button
                                onClick={() => setDriftingBottleMode('idle')}
                              className="w-full bg-[#FFAE42] text-white py-2 rounded-xl text-xs font-black transition"
                            >
                              إرجاع الزجاجة للبحر
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                                    {/* Mascot Support Chat (Full Screen) */}
                  {supportChatOpen && (
                    <div className="absolute inset-0 bg-[#F8F9FB] flex flex-col z-[100] animate-in slide-in-from-bottom-4 duration-300" dir="rtl">
                        {/* Header */}
                        <div className="bg-[#120D23]/90 backdrop-blur-md px-5 pt-7 pb-4 flex justify-between items-center shadow-lg relative z-10 border-b border-purple-500/20">
                            <button
                              onClick={() => setSupportChatOpen(false)}
                            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white rounded-full transition-colors cursor-pointer"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          
                          <div className="flex items-center gap-3">
                             <div>
                               <h4 className="font-black text-sm text-white tracking-wide text-left">خدمة العملاء الذكية</h4>
                               <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                 <p className="text-[10px] font-bold text-emerald-400">متصل الآن - الدعم الفني</p>
                                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse"></span>
                               </div>
                             </div>
                             <div className="relative">
                               <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(245,158,11,0.2)] border-2 border-amber-500/50">
                                 🍯
                               </div>
                             </div>
                          </div>
                        </div>
                        
                        {/* Chat Messages */}
                        <div className="flex-grow p-4 px-5 overflow-y-auto space-y-4 pb-4">
                          <div className="text-center my-4">
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-200/50 px-3 py-1 rounded-full border border-slate-300/50">اليوم</span>
                          </div>

                          {supportMessages.length === 0 && (
                            <div className="flex justify-start text-right">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-sm shadow-sm ml-2 flex-shrink-0 mt-auto mb-1">
                                🍯
                              </div>
                              <div className="bg-white p-4 rounded-2xl rounded-tr-sm shadow-md border border-slate-100 text-sm text-slate-600 max-w-[85%]">
                                <p className="font-black text-slate-800 mb-2">مرحباً 👋</p>
                                <p className="leading-relaxed">أهلاً بك في خدمة الدعم الفني الخاصة بتطبيق صدى العرب. كيف يمكننا مساعدتك اليوم؟</p>
                                
                                <div className="mt-4 flex flex-col gap-2">
                                  {['👑 أريد الحصول على VIP', '🚫 تم حظر حسابي', '🏢 كيف أفتح وكالة؟', '💎 كيف أشحن رصيدي؟', '⚠️ أريد الإبلاغ عن مستخدم', '💰 شحنت ولم تصل العملات'].map((suggestion, idx) => (
                                    <button
                                      key={idx}
                                      onClick={async () => {
                                        try {
                                          let ticketId = activeSupportTicket?.id;
                                          if (!ticketId) {
                                            const newTicketRef = doc(collection(db, "support_tickets"));
                                            ticketId = newTicketRef.id;
                                            await setDoc(newTicketRef, {
                                              userId: currentUser?.id,
                                              userName: currentUser.name,
                                              userAvatar: currentUser.avatar || "",
                                              status: 'open',
                                              createdAt: new Date().toISOString(),
                                              updatedAt: new Date().toISOString()
                                            });
                                          } else {
                                            await updateDoc(doc(db, "support_tickets", ticketId), {
                                              updatedAt: new Date().toISOString()
                                            });
                                          }
                                          const newMsgRef = doc(collection(db, "support_tickets", ticketId, "messages"));
                                          await setDoc(newMsgRef, {
                                            senderId: currentUser?.id,
                                            senderName: currentUser.name,
                                            text: suggestion,
                                            timestamp: new Date().toISOString(),
                                            isAdmin: false
                                          });
                                        } catch(err) {
                                          console.error("Error sending support suggestion", err);
                                        }
                                      }}
                                      className="text-right w-full bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2.5 rounded-xl text-[11px] font-bold hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 transition-colors shadow-sm cursor-pointer"
                                    >
                                      {suggestion}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                          {supportMessages.map((msg, idx) => {
                            const isMe = !msg.isAdmin;
                            return (
                            <div 
                              key={idx} 
                              className={`flex ${isMe ? 'justify-end' : 'justify-start'} text-right`}
                            >
                              {!isMe && (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-sm shadow-sm ml-2 flex-shrink-0 mt-auto mb-1">
                                  🍯
                                </div>
                              )}
                              <div className={`p-3 px-4 rounded-2xl text-xs max-w-[75%] shadow-md leading-relaxed ${
                                isMe 
                                  ? 'bg-gradient-to-l from-indigo-500 to-purple-500 text-white rounded-tl-sm border border-indigo-400/20' 
                                  : 'bg-white text-slate-700 rounded-tr-sm border border-slate-200'
                              }`}>
                                <p className="font-medium tracking-wide">{msg.text}</p>
                              </div>
                            </div>
                          )})}
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-5px_20px_rgba(0,0,0,0.03)] pb-safe">
                          <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-200 transition-all">
                            <input
                              type="text"
                              placeholder="اكتب رسالتك هنا..."
                              value={supportInput}
                              onChange={(e) => setSupportInput(e.target.value)}
                              onKeyDown={async (e) => {
                                if (e.key === 'Enter' && supportInput.trim()) {
                                  const uText = supportInput.trim();
                                  setSupportInput('');
                                  try {
                                    let ticketId = activeSupportTicket?.id;
                                    if (!ticketId) {
                                      const newTicketRef = doc(collection(db, "support_tickets"));
                                      ticketId = newTicketRef.id;
                                      await setDoc(newTicketRef, {
                                        userId: currentUser?.id,
                                        userName: currentUser.name,
                                        userAvatar: currentUser.avatar || "",
                                        status: 'open',
                                        createdAt: new Date().toISOString(),
                                        updatedAt: new Date().toISOString()
                                      });
                                    } else {
                                      await updateDoc(doc(db, "support_tickets", ticketId), {
                                        updatedAt: new Date().toISOString()
                                      });
                                    }
                                    
                                    const newMsgRef = doc(collection(db, "support_tickets", ticketId, "messages"));
                                    await setDoc(newMsgRef, {
                                      senderId: currentUser?.id,
                                      senderName: currentUser.name,
                                      text: uText,
                                      timestamp: new Date().toISOString(),
                                      isAdmin: false
                                    });
                                  } catch(err) {
                                    console.error("Error sending support message", err);
                                  }
                                }
                              }}
                              className="w-full bg-transparent border-none px-3 py-2 text-sm text-right focus:outline-none focus:ring-0 text-slate-700 font-medium placeholder-slate-400"
                            />
                            
                            <button
                              onClick={async () => {
                                if (supportInput.trim()) {
                                  const uText = supportInput.trim();
                                  setSupportInput('');
                                  try {
                                    let ticketId = activeSupportTicket?.id;
                                    if (!ticketId) {
                                      const newTicketRef = doc(collection(db, "support_tickets"));
                                      ticketId = newTicketRef.id;
                                      await setDoc(newTicketRef, {
                                        userId: currentUser?.id,
                                        userName: currentUser.name,
                                        userAvatar: currentUser.avatar || "",
                                        status: 'open',
                                        createdAt: new Date().toISOString(),
                                        updatedAt: new Date().toISOString()
                                      });
                                    } else {
                                      await updateDoc(doc(db, "support_tickets", ticketId), {
                                        updatedAt: new Date().toISOString()
                                      });
                                    }
                                    
                                    const newMsgRef = doc(collection(db, "support_tickets", ticketId, "messages"));
                                    await setDoc(newMsgRef, {
                                      senderId: currentUser?.id,
                                      senderName: currentUser.name,
                                      text: uText,
                                      timestamp: new Date().toISOString(),
                                      isAdmin: false
                                    });
                                  } catch(err) {
                                    console.error("Error sending support message", err);
                                  }
                                }
                              }}
                              className={`w-11 h-11 shrink-0 flex items-center justify-center rounded-xl transition-all ${
                                supportInput.trim() 
                                  ? 'bg-gradient-to-tr from-indigo-500 to-purple-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]' 
                                  : 'bg-slate-200 text-slate-400'
                              } cursor-pointer`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform rotate-180" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                              </svg>
                            </button>
                          </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* SCREEN 3: ACTIVE 9-SEAT VOICE ROOM SCREEN */}
              {currentScreen === 'room' && currentUser && activeRoom && (
                <div className="flex-grow flex flex-col h-full bg-[#05030f] relative overflow-hidden" id="screen-room">
                  
                  {/* SVGA Fullscreen Player Canvas (Match Parent) */}
                  <canvas 
                    ref={svgaCanvasRef} 
                    className="absolute inset-0 w-full h-full pointer-events-none z-50"
                    style={{ display: activeSvgaUrl ? 'block' : 'none' }}
                  />

                  {/* MP4 Fullscreen Video Player */}
                  {activeVideoUrl && (
                    <div className="absolute inset-0 w-full h-full bg-black/40 flex items-center justify-center pointer-events-none z-50">
                      <video
                        src={activeVideoUrl}
                        autoPlay
                        playsInline
                        className="w-full h-full object-contain pointer-events-none"
                        onEnded={() => {
                          console.log("[Video] Animation playback complete.");
                          isSvgaPlayingRef.current = false;
                          setActiveVideoUrl(null);
                          setTimeout(processSvgaQueue, 50);
                        }}
                        onError={(e) => {
                          console.error("[Video] Failed to load/play video asset:", activeVideoUrl, e);
                          setCustomNotice({
                            title: 'تنبيه حول الرابط المباشر 🎥',
                            message: 'تعذر تشغيل الفيديو المباشر للمؤثر المخصص. يرجى التأكد من أن الرابط مباشر وصالح للتشغيل، أو أن المتصفح يدعم تنسيق هذا الملف.'
                          });
                          isSvgaPlayingRef.current = false;
                          setActiveVideoUrl(null);
                          setTimeout(processSvgaQueue, 50);
                        }}
                      />
                    </div>
                  )}

                  {/* Custom seat-to-seat flying gifts animation overlay */}
                  <FlyingGiftsOverlay activeGifts={flyingGifts} />
                  
                  {/* Floating Gift Animations rendering container (Disabled) */}
                  <div className="absolute inset-0 pointer-events-none z-30" />

                  <style>{`
                    @keyframes floatUp {
                      0% { transform: translate(-50%, 0) scale(0.6); opacity: 0; }
                      20% { opacity: 1; transform: translate(-50%, -20px) scale(1.2); }
                      100% { transform: translate(-50%, -160px) scale(0.8); opacity: 0; }
                    }
                    @keyframes chatSlideUp {
                      0% { transform: translateY(18px) scale(0.93); opacity: 0; filter: blur(2px); }
                      100% { transform: translateY(0) scale(1); opacity: 1; filter: blur(0); }
                    }
                    @keyframes slideDownBounce {
                      0% { transform: translateY(-120px) scale(0.9); opacity: 0; }
                      70% { transform: translateY(12px) scale(1.02); opacity: 1; }
                      100% { transform: translateY(0) scale(1); opacity: 1; }
                    }
                    .animate-chat-slide-up {
                      animation: chatSlideUp 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    }
                    .animate-slide-down-bounce {
                      animation: slideDownBounce 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                    }
                  `}</style>

                  {/* VIP Entrance banner element */}
                  {vipEntrance && (
                    <div className="absolute top-24 left-0 right-0 z-40 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-800 p-2 border-y-2 border-amber-400 text-center text-slate-950 font-bold text-xs shadow-xl gold-glow animate-pulse">
                      👑 دخل الـ VIP <span className="underline font-black">{vipEntrance.userName}</span> (مستوى {vipEntrance.level}) المجلس الآن! 👑
                    </div>
                  )}

                  {/* Ambient Stage Spotlights, Lasers and Bokeh Light Spheres */}
                  <div className="absolute inset-0 pointer-events-none z-0">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#180936] via-[#0b041a] to-[#020008]"></div>
                    
                    {/* Glowing color spots with soft blur */}
                    <div className="absolute top-[8%] left-[15%] w-[200px] h-[350px] bg-purple-600/15 rounded-full blur-[80px] transform -rotate-12 animate-pulse" style={{ animationDuration: '7s' }}></div>
                    <div className="absolute top-[12%] right-[8%] w-[210px] h-[360px] bg-indigo-500/15 rounded-full blur-[85px] transform rotate-12 animate-pulse" style={{ animationDuration: '9s' }}></div>
                    <div className="absolute bottom-[25%] left-[10%] w-[220px] h-[250px] bg-pink-600/15 rounded-full blur-[90px] animate-pulse" style={{ animationDuration: '8s' }}></div>
                    <div className="absolute top-[35%] left-[35%] w-[160px] h-[160px] bg-cyan-500/12 rounded-full blur-[70px]"></div>

                    {/* Slow floating luxurious background particles / Bokeh light dots */}
                    <div className="absolute top-[15%] left-[8%] w-3 h-3 bg-purple-400/40 rounded-full blur-[1px] animate-float-particle-1"></div>
                    <div className="absolute top-[45%] right-[12%] w-4 h-4 bg-indigo-400/35 rounded-full blur-[2px] animate-float-particle-2"></div>
                    <div className="absolute bottom-[35%] left-[22%] w-2.5 h-2.5 bg-pink-400/45 rounded-full blur-[1px] animate-float-particle-1" style={{ animationDelay: '2.5s' }}></div>
                    <div className="absolute top-[20%] right-[28%] w-4.5 h-4.5 bg-cyan-400/30 rounded-full blur-[3px] animate-float-particle-2" style={{ animationDelay: '4.5s' }}></div>
                    <div className="absolute bottom-[18%] right-[18%] w-3.5 h-3.5 bg-yellow-400/35 rounded-full blur-[1.5px] animate-float-particle-1" style={{ animationDelay: '1.2s' }}></div>
                    <div className="absolute top-[38%] left-[42%] w-3 h-3 bg-purple-500/40 rounded-full blur-[1px] animate-float-particle-2" style={{ animationDelay: '3.2s' }}></div>

                    {/* Subtle vertical spotlight beams */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-[600px] bg-gradient-to-b from-purple-500/15 via-transparent to-transparent opacity-30 blur-[1px]"></div>
                    <div className="absolute top-0 left-[25%] w-[1.5px] h-[600px] bg-gradient-to-b from-cyan-500/10 via-transparent to-transparent opacity-25 blur-[1px]"></div>
                    <div className="absolute top-0 left-[75%] w-[1.5px] h-[600px] bg-gradient-to-b from-pink-500/10 via-transparent to-transparent opacity-25 blur-[1px]"></div>
                  </div>

                  {/* Room Top Header Nav Bar (Matching live mobile app style) */}
                  <div className="p-3 bg-transparent flex justify-between items-center select-none z-30" dir="rtl">
                    {/* Left side: Host Info Pill */}
                    {(() => {
                      const isOwner = activeRoom && (
                        (activeRoom.owner_id && currentUser?.id && activeRoom.owner_id === currentUser?.id) ||
                        (activeRoom.owner_id && currentUser?.name && activeRoom.owner_id === currentUser.name) ||
                        (activeRoom.hostName && currentUser?.name && activeRoom.hostName === currentUser.name) ||
                        (currentUser?.name && (currentUser.name.includes("ABDULKERIM") || currentUser.name.includes("GAREZ")) && (activeRoom.owner_id === "KK030Z0nOTd6f4JGcpL0KbwR9Gi2" || activeRoom.hostName?.includes("ABDULKERIM") || activeRoom.name === "حلبي" || activeRoom.name === "ؤ"))
                      );
                      const ownerUser = users.find(u => u.id === activeRoom.owner_id || u.name === activeRoom.hostName) || {
                        id: activeRoom.owner_id || 'host-id-placeholder',
                        name: activeRoom.hostName || 'المستضيف',
                        avatar: activeRoom.hostAvatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=placeholder",
                        level: activeRoom.level || 1,
                        coins: 0,
                        xp: 0
                      };
                      return (
                        <div className="flex items-center gap-1.5">
                          <div
                            onClick={() => {
                              const seatIndex = activeRoom.seats.findIndex(s => s.userId === ownerUser.id);
                              setSelectedSeatUser({ user: ownerUser, seatIndex });
                            }}
                            className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md rounded-full pl-2.5 pr-1 py-1 border border-white/5 cursor-pointer hover:bg-black/60 active:scale-95 transition-all"
                            title="عرض الملف الشخصي"
                          >
                            <div className="relative">
                              <img
                                src={activeRoom.hostAvatar || ownerUser?.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=placeholder"}
                                alt="host"
                                className="w-7 h-7 rounded-full border border-purple-500/30 object-cover select-none pointer-events-none"
                                style={{ WebkitTouchCallout: 'none' }}
                                draggable="false"
                                onContextMenu={(e) => e.preventDefault()}
                              />
                              {/* Active status indicator */}
                              <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#140b2e]" />
                            </div>
                            <div className="text-right">
                              <h4 className="text-[10px] font-bold text-white max-w-[80px] truncate leading-tight">
                                {activeRoom.name.replace(/☕|🎶|🔒/g, '').trim() || 'mason chat'}
                              </h4>
                              {(() => {
                                const displayId = ownerUser?.displayId || activeRoom.owner_id?.slice(0, 8) || '000000';
                                return (
                                  <span className="text-[8px] text-slate-300 block leading-none font-mono">ID: {displayId}</span>
                                );
                              })()}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCustomNotice({
                                  title: 'تمت المتابعة بنجاح 🔔',
                                  message: 'تمت متابعة منشئ المجلس بنجاح! ستتلقى تنبيهاً فوراً عند بدئه بثاً صوتياً أو مجلس جديد.'
                                });
                              }}
                              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-[9px] px-2.5 py-0.5 rounded-full transition mr-1.5"
                            >
                              متابعة
                            </button>
                          </div>

                          {/* Settings button if owner */}
                          {isOwner && (
                            <button
                              onClick={() => {
                                setRoomSettingsName(activeRoom.name || '');
                                setRoomSettingsAvatar(activeRoom.hostAvatar || '');
                                setRoomSettingsError('');
                                setIsRoomSettingsDrawerOpen(true);
                              }}
                              className="w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 text-slate-300 hover:text-white flex items-center justify-center transition active:scale-90 border border-white/5 cursor-pointer"
                              title="إعدادات المجلس"
                            >
                              <span className="text-xs">⚙️</span>
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    {/* Right side: Viewers and Exit */}
                    <div className="flex items-center gap-2">
                      {/* Overlapping viewer avatars */}
                      <div className="flex -space-x-1.5 space-x-reverse items-center">
                        {activeRoomUsers.slice(0, 4).map((user, idx) => (
                          <img
                            key={user.id || idx}
                            src={user.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=placeholder"}
                            alt={user.name}
                            className="w-5 h-5 rounded-full border border-[#140b2e] object-cover cursor-pointer hover:scale-110 transition-transform relative z-10"
                            title={user.name}
                            onClick={(e) => {
                              e.stopPropagation();
                              const fullUser = users?.find(u => u.id === user.id) || {
                                id: user.id,
                                name: user.name,
                                avatar: user.avatar,
                                level: 1,
                                coins: 0,
                                xp: 0,
                                role: 'user'
                              } as AppUser;
                              const seatIndex = activeRoom.seats.findIndex(s => s.userId === fullUser.id);
                              setSelectedSeatUser({ user: fullUser, seatIndex });
                            }}
                          />
                        ))}
                      </div>

                      {/* Viewer count */}
                      <div 
                        className="bg-black/30 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] text-slate-200 font-bold flex items-center gap-0.5 cursor-pointer hover:bg-black/50 transition-colors"
                        onClick={() => setIsRoomUsersModalOpen(true)}
                      >
                        <span>{activeRoomUsers.length}</span>
                        <span className="text-slate-400 text-[8px] font-bold">&gt;</span>
                      </div>

                      {/* Close X Button */}
                      <button
                        onClick={() => {
                          setShowLeaveRoomDialog(true);
                        }}
                        className="w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 text-slate-300 hover:text-white flex items-center justify-center transition active:scale-90"
                        id="exit-room-btn"
                      >
                        <span className="text-xs font-bold">✕</span>
                      </button>
                    </div>
                  </div>

                  {/* Premium Gift Ribbon / Banner sliding down - positioned absolutely on the right middle of the screen, ultra-compact and half size */}
                  {premiumGiftBanner && (
                    <div className="absolute top-[38%] right-2 left-auto z-50 pointer-events-none select-none">
                      <div className="bg-black/65 backdrop-blur-md p-1 rounded-full border border-white/10 text-center shadow-[0_4px_25px_rgba(0,0,0,0.6)] animate-slide-down-bounce flex items-center gap-1.5 h-10 pointer-events-auto max-w-[210px]" dir="rtl">
                        {/* 1. Sender Avatar with Golden Border Ring */}
                        <div className="relative w-7 h-7 rounded-full border-2 border-[#cca35e] shadow-[0_0_8px_rgba(204,163,94,0.5)] overflow-hidden shrink-0">
                          <img 
                            src={premiumGiftBanner.senderAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'} 
                            alt={premiumGiftBanner.sender}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        {/* 2. Golden Arrows pointing left (from sender to receiver in RTL) */}
                        <span className="text-[#cca35e] text-xs font-black tracking-tighter drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] animate-pulse leading-none shrink-0 select-none" dir="ltr">
                          ««
                        </span>

                        {/* 3. Receiver Avatar with White/Silver Border */}
                        <div className="relative w-7 h-7 rounded-full border border-white/75 shadow-[0_0_4px_rgba(255,255,255,0.2)] overflow-hidden shrink-0">
                          {premiumGiftBanner.recipient === 'المجلس' || premiumGiftBanner.recipient === 'الجميع' ? (
                            <div className="w-full h-full bg-gradient-to-tr from-purple-950 to-indigo-950 flex items-center justify-center">
                              <span className="text-[10px]">{premiumGiftBanner.recipient === 'المجلس' ? '🏛️' : '👥'}</span>
                            </div>
                          ) : (
                            <img 
                              src={premiumGiftBanner.receiverAvatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80'} 
                              alt={premiumGiftBanner.recipient}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          )}
                        </div>

                        {/* 4. Gift Image */}
                        <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
                          <img 
                            src={premiumGiftBanner.giftImageUrl || 'https://gtkjonqlumuhsuykbxnw.supabase.co/storage/v1/object/public/images/dhf.png'} 
                            alt={premiumGiftBanner.giftName}
                            className="w-6 h-6 object-contain z-10 animate-bounce"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        {/* 5. Combo Count (on the far left) with custom font styling */}
                        <div key={premiumGiftBanner._comboKey || 'combo'} className="flex flex-col items-center justify-center select-none shrink-0 pl-2 pr-0.5 leading-none animate-heartbeat">
                          <span className="text-[#cca35e] font-black text-sm italic drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] tracking-tighter font-sans leading-none">
                            x{premiumGiftBanner.quantity || 1}
                          </span>
                          <span className="text-[7px] font-black text-[#cca35e] uppercase italic tracking-wider leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                            Combo
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Main Content Area */}
                  <div className="flex-grow p-4 flex flex-col justify-between relative pb-20 z-10 overflow-y-auto">
                    


                    {/* 10 SEATS STAGE: Two Parallel Rows of 5 Seats (As requested in the reference screenshot) */}
                    <div className="mt-1 mb-auto py-2">
                      <div className="grid grid-cols-5 gap-y-8 gap-x-1.5 text-center">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => {
                          const seat = activeRoom?.seats?.[index] || { index, userId: null, isMuted: false, isLocked: false };
                          const occupant = seat.userId ? (users?.find(u => u.id === seat.userId) || (currentUser && seat.userId === currentUser?.id ? currentUser : null)) : null;
                          const isCurrentUser = occupant && currentUser && occupant.id === currentUser?.id;
                          const isSpeaking = !isRoomAudioDeafened && occupant && !seat.isMuted && !seat.hostMuted && (
                            isCurrentUser 
                              ? (realUserMicSpeaking || speakingSeatIndex === index)
                              : (speakingSeatIndex === index)
                          );

                          // Helper to render premium wings and halos
                          const renderSeatFrame = (childrenNode: React.ReactNode) => {
                            // Scale the radar wave rings dynamically to reflect live simulated or real voice vibration volume
                            const currentVolume = (isCurrentUser && realUserMicSpeaking && realUserMicVolume > 0)
                              ? Math.min(100, Math.max(30, Math.floor(realUserMicVolume * 3)))
                              : speakingVolume;

                            const scaleFactor1 = 1 + (currentVolume * 0.005);
                            const scaleFactor2 = 1 + (currentVolume * 0.012);
                            const scaleFactor3 = 1 + (currentVolume * 0.018);

                            let waveColorClass = "border-emerald-500 bg-emerald-500/10";
                            if (index === 0) waveColorClass = "border-amber-400 bg-amber-400/15";
                            else if (index === 1) waveColorClass = "border-fuchsia-500 bg-fuchsia-500/15";
                            else if (index === 2) waveColorClass = "border-cyan-400 bg-cyan-400/15";

                            return (
                              <div className="relative">
                                {/* Multi-layered Voice Radar Pulse Rings */}
                                {isSpeaking && (
                                  <div className="absolute inset-0 pointer-events-none select-none z-0">
                                    <div 
                                      className={`absolute inset-0 rounded-full border ${waveColorClass} animate-radar-1`}
                                      style={{ transform: `scale(${scaleFactor1})` }}
                                    />
                                    <div 
                                      className={`absolute inset-0 rounded-full border ${waveColorClass} animate-radar-2`}
                                      style={{ transform: `scale(${scaleFactor2})` }}
                                    />
                                    <div 
                                      className={`absolute inset-0 rounded-full border ${waveColorClass} animate-radar-3`}
                                      style={{ transform: `scale(${scaleFactor3})` }}
                                    />
                                  </div>
                                )}

                                {/* Card frame ring */}
                                <div className="relative z-10">
                                  {index === 0 ? (
                                    // Mason / Host / Ahmad Al-Otaibi (Luxury animated gold border + Gold Crown)
                                    <div 
                                      className={`relative p-0.5 rounded-full select-none vip-golden-shine shadow-lg transition-transform duration-150 ${isSpeaking ? 'scale-105 shadow-amber-500/40' : 'shadow-black/40'}`}
                                    >
                                      <div className="relative p-0.5 rounded-full bg-[#1b1202] border border-yellow-500/30 w-full h-full">
                                        <div className="absolute -top-4.5 left-1/2 -translate-x-1/2 text-[15px] drop-shadow-md z-30 animate-[bounce_1.8s_infinite] select-none pointer-events-none">👑</div>
                                        {childrenNode}
                                      </div>
                                    </div>
                                  ) : index === 1 ? ( // Sophia (Purple neon glow)
                                    <div 
                                      className={`relative p-0.5 rounded-full bg-gradient-to-tr from-purple-600 via-fuchsia-500 to-pink-500 shadow-sm transition-transform duration-150 ${isSpeaking ? 'scale-105 shadow-purple-500/50' : ''}`}
                                    >
                                      {childrenNode}
                                    </div>
                                  ) : index === 2 ? ( // Charlotte (Cyan neon ring)
                                    <div 
                                      className={`relative p-0.5 rounded-full bg-gradient-to-tr from-cyan-400 via-blue-500 to-indigo-500 shadow-sm transition-transform duration-150 ${isSpeaking ? 'scale-105 shadow-cyan-400/50' : ''}`}
                                    >
                                      {childrenNode}
                                    </div>
                                  ) : index === 3 ? ( // Ava (Glowing Blue Wings Frame)
                                    <div 
                                      className={`relative p-0.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-transform duration-150 ${isSpeaking ? 'scale-105' : ''}`}
                                    >
                                      <div className="absolute -left-2.5 top-1.5 text-[10px] pointer-events-none select-none drop-shadow font-sans">🪶</div>
                                      <div className="absolute -right-2.5 top-1.5 text-[10px] pointer-events-none select-none drop-shadow font-sans">🪶</div>
                                      {childrenNode}
                                    </div>
                                  ) : index === 4 ? ( // Ryan (Silver Ring)
                                    <div className={`relative p-0.5 rounded-full bg-gradient-to-tr from-slate-400 to-slate-200 transition-transform duration-150 ${isSpeaking ? 'scale-105' : ''}`}>
                                      {childrenNode}
                                    </div>
                                  ) : index === 5 ? ( // Aby (Angel wings frame)
                                    <div 
                                      className={`relative p-0.5 rounded-full bg-gradient-to-tr from-amber-400 via-yellow-300 to-orange-400 transition-transform duration-150 ${isSpeaking ? 'scale-105 shadow-amber-300/30' : ''}`}
                                    >
                                      <div className="absolute -left-3 top-0.5 text-xs pointer-events-none select-none drop-shadow">👼</div>
                                      <div className="absolute -right-3 top-0.5 text-xs pointer-events-none select-none drop-shadow">👼</div>
                                      {childrenNode}
                                    </div>
                                  ) : (
                                    // Default style for other seats
                                    <div className={`relative p-0.5 rounded-full border transition-all duration-150 ${isSpeaking ? 'border-emerald-400 bg-emerald-500/10 scale-105' : 'border-slate-800/40 hover:border-purple-500/30 bg-slate-950/40'}`}>
                                      {childrenNode}
                                    </div>
                                  )}
                                </div>

                                {/* Beautiful small red mute icon overlay on top of the seat avatar */}
                                {occupant && seat.hostMuted && (
                                  <div className="absolute -bottom-1 -right-1 bg-red-600 border border-slate-900 rounded-full w-4.5 h-4.5 flex items-center justify-center z-30 shadow-[0_1px_3px_rgba(0,0,0,0.6)] animate-pulse">
                                    <MicOff className="w-2.5 h-2.5 text-white" />
                                  </div>
                                )}
                              </div>
                            );
                          };

                          return (
                            <div
                              key={index}
                              onClick={() => handleSeatClick(index)}
                              className="flex flex-col items-center cursor-pointer transition transform active:scale-95 duration-100"
                              id={`seat-cell-${index + 1}`}
                            >
                              {renderSeatFrame(
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-950/80 flex items-center justify-center relative">
                                  {occupant ? (
                                    <img
                                      src={occupant.avatar && (occupant.avatar.startsWith('http') || occupant.avatar.startsWith('data:')) ? occupant.avatar : `https://api.dicebear.com/7.x/adventurer/svg?seed=${occupant.id}`}
                                      alt="seat occupant"
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : seat.isLocked ? (
                                    // Luxurious 3D gold colored padlock icon with inner glow
                                    <div className="flex flex-col items-center justify-center bg-gradient-to-br from-amber-500/20 to-red-500/20 border border-amber-500/40 w-full h-full rounded-full shadow-inner shadow-amber-500/30">
                                      <Lock className="w-3.5 h-3.5 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.7)] animate-pulse" />
                                    </div>
                                  ) : (
                                    // Elegant minimalist linear microphone outline SVG inside empty seat
                                    <div className="flex items-center justify-center w-full h-full rounded-full bg-gradient-to-b from-[#140b2a] to-[#05020c] border border-purple-500/5 hover:border-purple-500/30 transition-colors group">
                                      <svg 
                                        viewBox="0 0 24 24" 
                                        fill="none" 
                                        stroke="currentColor" 
                                        strokeWidth="2.5" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round" 
                                        className="w-4 h-4 text-purple-400/35 group-hover:text-purple-400/80 transition-colors drop-shadow"
                                      >
                                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                        <line x1="12" x2="12" y1="19" y2="22" />
                                      </svg>
                                      <span className="absolute bottom-1 text-[5px] text-purple-400/25 font-bold group-hover:text-purple-400/60 transition-colors select-none">
                                        {index + 1}
                                      </span>
                                    </div>
                                  )}

                                  {/* Fast flashing neon speaking border */}
                                  {isSpeaking && (
                                    <div className="absolute inset-0 bg-emerald-500/5 border border-emerald-400 rounded-full animate-pulse pointer-events-none" />
                                  )}
                                </div>
                              )}

                              {/* Small details */}
                              <div className="mt-1 flex flex-col items-center">
                                {occupant ? (
                                  <>
                                    <span className="text-[8.5px] text-white font-bold max-w-[50px] truncate block leading-tight">
                                      {occupant.id === '1001' ? 'أحمد العتيبي' : occupant.name.replace(' 👑', '')}
                                    </span>
                                    {/* Small custom-styled level badge under the name */}
                                    <div className={`mt-0.5 px-1 py-0.2 rounded-md bg-gradient-to-r ${
                                      occupant.level >= 90 ? 'from-purple-600 via-pink-500 to-rose-500 text-pink-100 border border-purple-400/30' :
                                      occupant.level >= 50 ? 'from-yellow-500 to-amber-500 text-amber-950 font-black' :
                                      occupant.level >= 20 ? 'from-cyan-500 to-blue-500 text-white' :
                                      'from-slate-700 to-slate-800 text-slate-300'
                                    } shadow-[0_1px_2px_rgba(0,0,0,0.4)] scale-[0.85] flex items-center justify-center leading-none`}>
                                      <span className="text-[6px] font-black tracking-tight block">
                                        Lv.{occupant.level}
                                      </span>
                                    </div>
                                  </>
                                ) : (
                                  <span className="text-[8px] text-slate-500 font-mono">
                                    {seat.isLocked ? 'مغلق' : index + 1}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Floating Game Button (Moved here as indicated by user) */}
                    <button
                      onClick={() => setIsGameSheetOpen(true)}
                      className="absolute bottom-2 left-2.5 w-11 h-11 bg-transparent cursor-pointer hover:scale-110 active:scale-95 transition-all flex items-center justify-center z-40 animate-heartbeat border-none p-0 outline-none focus:outline-none"
                      title="عجلة الحظ للألعاب"
                      id="game-wheel-trigger"
                    >
                      <img
                        src="https://gtkjonqlumuhsuykbxnw.supabase.co/storage/v1/object/public/images/Game%20controller%20clip%20art%20_%20Premium%20AI-generated%20PSD%20(1).png"
                        alt="العاب"
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 object-contain pointer-events-none select-none"
                      />
                    </button>

                    {/* Live Arabic Council Chat Feed - Premium Floating Transparent Overlay (Exactly like the screenshot) */}
                    <div className="absolute bottom-2 right-3 left-14 h-[135px] pointer-events-auto z-20 bg-transparent flex flex-col justify-end overflow-hidden" dir="rtl">
                      <div 
                        ref={(el) => {
                          if (el) {
                            el.scrollTop = el.scrollHeight;
                          }
                        }}
                        className="overflow-y-auto space-y-1.5 scrollbar-none pr-1 flex flex-col justify-end"
                        style={{ 
                          direction: 'rtl', 
                          textAlign: 'right',
                          WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 75%, rgba(0,0,0,0) 100%)',
                          maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 75%, rgba(0,0,0,0) 100%)',
                          height: '115px'
                        }}
                      >
                        {/* Screenshots accurate chat elements */}
                        {roomMessages.map((msg, idx) => {
                          // Assign colors and badges dynamically based on sender
                          let lvl = 16;
                          let lvlBg = 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30';
                          let isAnchor = false;
                          let senderColorClass = 'text-sky-300';

                          if (msg.sender === 'Sophia') {
                            lvl = 99;
                            lvlBg = 'bg-pink-500/20 text-pink-300 border-pink-400/30';
                            senderColorClass = 'text-pink-400';
                          } else if (msg.sender === 'Mason 👑' || msg.sender === 'Mason') {
                            lvl = 65;
                            lvlBg = 'bg-purple-500/20 text-purple-300 border-purple-400/30';
                            isAnchor = true;
                            senderColorClass = 'text-yellow-400 font-extrabold drop-shadow-[0_0_6px_rgba(234,179,8,0.3)]';
                          } else if (msg.sender === 'Ryan') {
                            lvl = 32;
                            lvlBg = 'bg-blue-500/20 text-blue-300 border-blue-400/30';
                            senderColorClass = 'text-blue-300';
                          } else if (msg.sender === 'Charlotte') {
                            lvl = 18;
                            lvlBg = 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30';
                            senderColorClass = 'text-fuchsia-400';
                          }

                          const isSystem = msg.type === 'system';

                          return (
                            <div key={idx} className="leading-relaxed animate-chat-slide-up flex">
                              <div className="px-1.5 py-0.5 inline-flex items-center gap-1.5 max-w-[98%] text-right flex-wrap">
                                {!isSystem && (
                                  <>
                                    {/* Level Badge */}
                                    <span className={`text-[6.5px] font-black px-1 rounded-md border ${lvlBg} leading-none py-[1px]`}>
                                      Lv.{lvl}
                                    </span>
                                    {/* Anchor Badge */}
                                    {isAnchor && (
                                      <span className="text-[6.5px] font-extrabold bg-blue-600/30 text-blue-200 px-1 rounded-md border border-blue-400/30 leading-none py-[1px]">
                                        HOST
                                      </span>
                                    )}
                                  </>
                                )}
                                
                                <span 
                                  className={`${isSystem ? 'text-purple-300 font-bold' : senderColorClass + ' cursor-pointer hover:underline'} text-[9.5px] font-bold`}
                                  onClick={() => {
                                    if (!isSystem) {
                                      const cleanName = msg.sender.replace(' 👑', '').trim();
                                      const foundUser = users?.find(u => u.name === cleanName);
                                      if (foundUser) {
                                        setSelectedProfileUser(foundUser);
                                        setIsProfileModalOpen(true);
                                      }
                                    }
                                  }}
                                >
                                  {msg.sender}:
                                </span>{' '}
                                <span className="text-white text-[9.5px] font-semibold leading-relaxed inline-flex items-center gap-1 flex-wrap font-sans">
                                  {msg.isEncrypted ? (
                                    <>
                                      <span className="text-emerald-400 font-extrabold text-[10px]" title="مشفّر طرف-إلى-طرف (E2EE)">🔒</span>
                                      <EncryptedMessageText
                                        ciphertext={msg.rawCiphertext || ''}
                                        iv={msg.iv || ''}
                                        derivedKey={derivedKey}
                                        showCiphertext={showCiphertextInFeed}
                                        fallbackText={msg.text}
                                      />
                                    </>
                                  ) : (
                                    <span>{msg.text}</span>
                                  )}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>



                  {/* NATIVE PHONE NAVIGATION AND BOTTOM ACTION HUB (Overhauled perfectly matching screenshot) */}
                  <div className="p-3 bg-transparent flex justify-between items-center select-none z-30 gap-2" dir="rtl">
                    
                    {/* RIGHT-SIDE CLUSTER: Chat Input, Mic toggle, Speaker toggle, and Prominent Gift Button */}
                    <div className="flex-grow flex items-center gap-1.5 min-w-0">
                      {/* Input box "Let's talk" (أرسل رسالة للمجلس...) */}
                      <div className="flex-grow flex items-center bg-black/40 border border-white/5 rounded-full px-2.5 py-1.5 transition-all min-w-[120px]">
                        <input
                          type="text"
                          value={chatInputValue}
                          onChange={(e) => setChatInputValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSendChatMessage();
                            }
                          }}
                          placeholder="أرسل رسالة للمجلس..."
                          className="flex-grow bg-transparent text-[10px] text-slate-100 placeholder-slate-500 text-right outline-none w-full"
                          dir="rtl"
                          id="chat-interactive-input"
                        />
                      </div>

                      {/* Mic Speak Controller Button (Only visible if user is seated on a seat) */}
                      {activeRoom?.seats?.some(s => s.userId === currentUser?.id) && (
                        <button
                          onClick={async () => {
                            const userSeatIndex = activeRoom?.seats?.findIndex(s => s.userId === currentUser?.id);
                            if (userSeatIndex !== -1) {
                              const seat = activeRoom?.seats?.[userSeatIndex];
                              if (seat.hostMuted) {
                                 setCustomNotice({
                                   title: 'تنبيه الكتم 🎙️',
                                   message: 'لقد تم كتمك من قبل مالك المجلس، لا يمكنك التحدث حتى يتم فك الكتم من قبل الإشراف.'
                                 });
                                 return;
                              }
                              const nextMuteStatus = !seat.isMuted;
                              const updatedSeats = [...(activeRoom?.seats || [])];
                              updatedSeats[userSeatIndex] = { ...seat, isMuted: nextMuteStatus };
                              const updatedRoom = { ...activeRoom, seats: updatedSeats };
                              setActiveRoom(updatedRoom);
                              setRooms(rooms?.map(r => r.id === activeRoom.id ? updatedRoom : r));

                              // Broadcast via Firestore
                              await updateDoc(doc(db, "voice_rooms", activeRoom.id), { seats: updatedSeats });
                              
                              // Handle publishing/stopping based on mute status
                              const agoraManager = AgoraEngineManager.getInstance();
                              soundService.playMicToggleSound(!nextMuteStatus);
                              if (nextMuteStatus) {
                                  agoraManager.stopPublishing();
                              } else {
                                  await agoraManager.startPublishing();
                              }
                            }
                          }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer active:scale-90 transition-all shrink-0 ${
                            !activeRoom?.seats?.find(s => s.userId === currentUser?.id)?.isMuted
                              ? 'bg-emerald-600 border border-emerald-400 text-white animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                              : 'bg-red-950/50 border border-red-500/30 text-red-300'
                          }`}
                          title="تشغيل/كتم المايك الخاص بك"
                          id="mic-speak-btn"
                        >
                          {activeRoom?.seats.some(s => s.userId === currentUser?.id) && !activeRoom?.seats?.find(s => s.userId === currentUser?.id)?.isMuted ? (
                            <Mic className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <MicOff className="w-3.5 h-3.5 text-red-400" />
                          )}
                        </button>
                      )}

                      {/* Speaker / Room Audio Toggle Button */}
                      <button
                        onClick={() => {
                          const nextDeafened = !isRoomAudioDeafened;
                          setIsRoomAudioDeafened(nextDeafened);
                          soundService.playMicToggleSound(!nextDeafened);
                          const agoraManager = AgoraEngineManager.getInstance();
                          agoraManager.setRoomAudioDeafened(nextDeafened);
                          if (!nextDeafened) {
                            soundService.unlockAudio();
                          }
                        }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer active:scale-90 transition-all shrink-0 ${
                          !isRoomAudioDeafened
                            ? 'bg-indigo-600/70 border border-indigo-400/50 text-indigo-100 shadow-[0_0_10px_rgba(99,102,241,0.4)]'
                            : 'bg-red-950/60 border border-red-500/40 text-red-400'
                        }`}
                        title={isRoomAudioDeafened ? "تشغيل صوت المجلس" : "كتم صوت المجلس"}
                        id="room-audio-toggle-btn"
                      >
                        {!isRoomAudioDeafened ? (
                          <Volume2 className="w-3.5 h-3.5 text-indigo-100" />
                        ) : (
                          <VolumeX className="w-3.5 h-3.5 text-red-400" />
                        )}
                      </button>

                      {/* Prominent, colorful 2D virtual gift launcher button */}
                      <GiftTriggerButton
                        onClick={() => { const firstOccupied = activeRoom?.seats?.findIndex(s => s.userId !== null); setSelectedRecipientSeatIndices(firstOccupied !== -1 && firstOccupied !== undefined ? [firstOccupied + 1] : []); setIsGiftDrawerOpen(true); }}
                        imageUrl="https://gtkjonqlumuhsuykbxnw.supabase.co/storage/v1/object/public/images/Modelo%20De%20Caja%20De%20Regalo%203d%20PNG%20,dibujos%20%20Caja%20De%20Regalo,%20Caja%20De%20Regalo%203d,%20Modelo%20De%20Caja%20De%20Regalo%20PNG%20Imagen%20para%20Descarga%20Gratuita%20_%20Pngtree.png"
                      />
                    </div>
                  </div>

                  {/* Seat Actions Modal sheet (when selectedSeatIndex is active) */}
                  {selectedSeatIndex !== null && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-xs z-50 flex flex-col justify-end p-4 pb-6 animate-fade-in" dir="rtl">
                      <div className="w-full max-w-md mx-auto space-y-3">
                        
                        {/* Main Menu Card */}
                        <div className="bg-white rounded-[24px] overflow-hidden shadow-2xl flex flex-col divide-y divide-slate-100">
                          
                          {/* If in Invite List Mode */}
                          {isInviteListOpen ? (
                            <>
                              {/* Header */}
                               <div className="flex justify-between items-center px-5 py-4 bg-slate-50 border-b border-slate-100">
                                 <button
                                   onClick={() => setIsInviteListOpen(false)}
                                   className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                                 >
                                  رجوع
                                </button>
                                <span className="text-sm font-bold text-slate-800">دعوة مستخدم للمقعد</span>
                                <div className="w-10"></div> {/* Spacer */}
                              </div>

                              {/* User List */}
                              <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                                {(() => {
                                  const usersOnSeats = activeRoom?.seats?.map(s => s.userId).filter(Boolean) || [];
                                  const eligibleUsers = activeRoomUsers.filter(u => u.id !== currentUser?.id && !usersOnSeats.includes(u.id));

                                  if (eligibleUsers.length === 0) {
                                    return (
                                      <div className="py-8 text-center text-sm text-slate-400 font-medium">
                                        لا يوجد مستخدمين متاحين للدعوة حالياً في هذا المجلس
                                      </div>
                                    );
                                  }

                                  return eligibleUsers.map((user) => (
                                    <button
                                      key={user.id}
                                      onClick={() => handleInviteToSeat(user.id)}
                                      className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 active:bg-slate-100 transition text-right"
                                    >
                                      <div className="flex items-center gap-3">
                                        <img
                                          src={user.avatar}
                                          alt={user.name}
                                          className="w-9 h-9 rounded-full border border-purple-100"
                                          referrerPolicy="no-referrer"
                                        />
                                        <span className="text-sm font-bold text-slate-800">{user.name}</span>
                                      </div>
                                      <span className="text-xs bg-indigo-50 text-indigo-600 font-bold px-2.5 py-1 rounded-full">
                                        دعوة
                                      </span>
                                    </button>
                                  ));
                                })()}
                              </div>
                            </>
                          ) : (
                            <>
                              {(() => {
                                const isAuthorizedHost = checkIfOwner(activeRoom);
                                const seat = activeRoom?.seats?.[selectedSeatIndex];
                                const isSeatOccupied = !!seat?.userId;
                                const isMySeat = seat?.userId === currentUser?.id;

                                return (
                                  <>
                                    {/* 1. انتقل إلى هذا المقعد (Only if seat is not occupied by me, and is unlocked or we are host) */}
                                    {!isMySeat && (!isSeatOccupied || isAuthorizedHost) && (
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleMoveToSeat(selectedSeatIndex);
                                        }}
                                        className="w-full text-[#1a1a1a] font-medium text-base py-4 text-center hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
                                      >
                                        انتقل إلى هذا المقعد
                                      </button>
                                    )}

                                    {/* 2. ادعُ إلى هذا المقعد (Only for authorized host) */}
                                    {isAuthorizedHost && (
                                      <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsInviteListOpen(true); }}
                                        className="w-full text-[#1a1a1a] font-medium text-base py-4 text-center hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
                                      >
                                        ادعُ إلى هذا المقعد
                                      </button>
                                    )}

                                    {/* 3. اكتم هذا المقعد (Only for authorized host) */}
                                    {isAuthorizedHost && (
                                      <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleHostAction('mute'); }}
                                        className="w-full text-[#1a1a1a] font-medium text-base py-4 text-center hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
                                      >
                                        {seat?.hostMuted ? 'تفعيل صوت هذا المقعد' : 'اكتم هذا المقعد'}
                                      </button>
                                    )}

                                    {/* 4. اقفل هذا المقعد (Only for authorized host) */}
                                    {isAuthorizedHost && (
                                      <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleHostAction('lock'); }}
                                        className="w-full text-[#1a1a1a] font-medium text-base py-4 text-center hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
                                      >
                                        {seat?.isLocked ? 'إلغاء قفل هذا المقعد' : 'اقفل هذا المقعد'}
                                      </button>
                                    )}

                                    {/* 5. قفل جميع المقاعد (Only for authorized host) */}
                                    {isAuthorizedHost && (
                                      <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLockAllSeats(); }}
                                        className="w-full text-[#1a1a1a] font-medium text-base py-4 text-center hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
                                      >
                                        قفل جميع المقاعد
                                      </button>
                                    )}

                                    {/* 6. اقفل جميع المقاعد الفارغة (Only for authorized host) */}
                                    {isAuthorizedHost && (
                                      <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLockAllEmptySeats(); }}
                                        className="w-full text-[#1a1a1a] font-medium text-base py-4 text-center hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
                                      >
                                        اقفل جميع المقاعد الفارغة
                                      </button>
                                    )}

                                    {/* 7. فتح جميع المقاعد (Only for authorized host) */}
                                    {isAuthorizedHost && (
                                      <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleUnlockAllSeats(); }}
                                        className="w-full text-[#1a1a1a] font-medium text-base py-4 text-center hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
                                      >
                                        فتح جميع المقاعد
                                      </button>
                                    )}

                                    {/* Leave Seat Option (For own seat) */}
                                    {isMySeat && (
                                      <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleHostAction('leave'); }}
                                        className="w-full text-red-600 font-bold text-base py-4 text-center hover:bg-red-50 active:bg-red-100 transition-colors cursor-pointer"
                                      >
                                        النزول من المقعد للجمهور
                                      </button>
                                    )}

                                    {/* Kick Option (For host managing someone else on seat) */}
                                    {isAuthorizedHost && isSeatOccupied && !isMySeat && (
                                      <div className="flex flex-col divide-y divide-slate-100 bg-red-50/30">
                                        <button
                                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleHostAction('kick'); }}
                                          className="w-full text-red-600 font-bold text-sm py-3.5 text-center hover:bg-red-50 transition cursor-pointer"
                                        >
                                          إنزال من المايك
                                        </button>
                                        <div className="grid grid-cols-3 divide-x divide-slate-100 text-center">
                                          <button
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleHostAction('kick_1m'); }}
                                            className="py-3 text-xs font-bold text-red-700 hover:bg-red-100/50 transition cursor-pointer"
                                          >
                                            طرد دقيقة
                                          </button>
                                          <button
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleHostAction('kick_1h'); }}
                                            className="py-3 text-xs font-bold text-red-700 hover:bg-red-100/50 transition cursor-pointer"
                                          >
                                            طرد ساعة
                                          </button>
                                          <button
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleHostAction('kick_1w'); }}
                                            className="py-3 text-xs font-bold text-red-700 hover:bg-red-100/50 transition cursor-pointer"
                                          >
                                            طرد أسبوع
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </>
                          )}
                          
                        </div>

                        {/* Cancel Button */}
                        <button
                          onClick={() => setSelectedSeatIndex(null)}
                          className="w-full bg-white text-[#1a1a1a] font-bold text-base py-4 rounded-[20px] hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-lg text-center cursor-pointer"
                        >
                          يلغي
                        </button>

                      </div>
                    </div>
                  )}

                  {/* PURE NATIVE GIFTING BOTTOM SHEET (No Web Simulator Controls) */}
                  {isGiftDrawerOpen && (
                    <>
                      <div
                        className="absolute inset-0 bg-black/60 z-40 animate-fade-in cursor-pointer"
                        onClick={() => setIsGiftDrawerOpen(false)}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-[#121212]/95 backdrop-blur-3xl rounded-t-[32px] pt-3 pb-6 z-50 animate-fade-in shadow-2xl flex flex-col font-sans max-h-[95vh] overflow-y-auto">
                        
                        {/* Drag Handle Indicator */}
                        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-2 shrink-0" />
                        
                        {/* Level Progress Section */}
                        {currentUser && (() => {
                          const progress = getLevelProgress(currentUser.xp || 0);
                          const giftXpReward = selectedGift ? selectedGift.cost : 0;
                          const previewXp = (currentUser.xp || 0) + giftXpReward;
                          const previewProgress = getLevelProgress(previewXp);
                          const willLevelUp = previewProgress.currentLvl > progress.currentLvl;

                          return (
                            <div className="px-3 mb-3">
                              <div className="flex flex-row items-center justify-between mb-2">
                                <div className="flex items-center gap-1">
                                  <div className="bg-[#b3884d] text-white text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-sm">
                                    Lv.{progress.currentLvl}
                                  </div>
                                </div>
                                <div className="text-[10px] text-slate-300 text-right w-full mr-2" dir="rtl">
                                  تحتاج إلى المزيد من <span className="font-mono">{progress.remainingXp}</span> ماسة للوصول إلى المستوى {progress.nextLvl}.
                                </div>
                              </div>
                              
                              <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden relative">
                                {selectedGift && (
                                  <div 
                                    className="absolute top-0 right-0 h-full bg-amber-200/60 rounded-full transition-all duration-300 animate-pulse"
                                    style={{ width: `${willLevelUp ? 100 : previewProgress.progressPercentage}%` }}
                                  />
                                )}
                                <div 
                                  className="absolute top-0 right-0 h-full bg-gradient-to-l from-[#cca35e] to-[#e6c887] rounded-full transition-all duration-500"
                                  style={{ width: `${progress.progressPercentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })()}

                        {/* Tabs */}
                        <div className="flex flex-row justify-between text-[12px] text-slate-400 mb-4 px-3 overflow-x-auto whitespace-nowrap scrollbar-none font-bold gap-4">
                          {['اساسي', 'حظ', 'نشاط', 'CP', 'مشاهير', 'VIP'].map(tab => (
                            <span 
                              key={tab}
                              onClick={() => setActiveGiftCategory(tab)}
                              className={`cursor-pointer shrink-0 pb-1 transition-all ${activeGiftCategory === tab ? 'text-white border-b-2 border-white' : 'hover:text-slate-300'}`}
                            >
                              {tab}
                            </span>
                          ))}
                          <span 
                            onClick={() => setActiveGiftCategory('حقيبة')}
                            className={`cursor-pointer shrink-0 flex items-center justify-center pb-1 transition-all ${activeGiftCategory === 'حقيبة' ? 'text-white border-b-2 border-white' : 'hover:text-slate-300'}`}
                          >
                            <Briefcase className="w-4 h-4" />
                          </span>
                        </div>

                        {/* Recipient Selection Bar */}
                        {activeRoom && (
                          <div className="mb-3 text-right px-3">
                            <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none flex-row">
                              {/* "All" candidate */}
                              <button
                                onClick={() => setSelectedRecipientSeatIndices(prev => prev.includes('all') ? [] : ['all'])}
                                className={`w-8 h-8 rounded-full border shrink-0 flex items-center justify-center transition-all cursor-pointer relative ${
                                  selectedRecipientSeatIndices.includes('all')
                                    ? 'border-[#cca35e] text-[#cca35e] bg-white/5'
                                    : 'border-transparent text-slate-400 bg-white/5 hover:bg-white/10'
                                }`}
                                title="الجميع"
                              >
                                <span className="text-xs">👥</span>
                              </button>

                              {/* Occupied seats candidates */}
                              {activeRoom?.seats
                                ?.map((seat, seatIdx) => ({ seat, seatIdx }))
                                ?.filter(({ seat }) => seat.userId !== null)
                                ?.map(({ seat, seatIdx }) => {
                                  const occupant = users?.find((u) => u.id === seat.userId) || (currentUser && seat.userId === currentUser?.id ? currentUser : null);
                                  if (!occupant) return null;
                                  const oneBasedSeatIdx = seatIdx + 1;
                                  const isSelected = selectedRecipientSeatIndices.includes('all') || selectedRecipientSeatIndices.includes(oneBasedSeatIdx);
                                  const isHost = oneBasedSeatIdx === 1;

                                  return (
                                    <button
                                      key={oneBasedSeatIdx}
                                      onClick={() => setSelectedRecipientSeatIndices(prev => { if (prev.includes('all')) return [oneBasedSeatIdx]; if (prev.includes(oneBasedSeatIdx)) { return prev.filter(i => i !== oneBasedSeatIdx); } return [...prev, oneBasedSeatIdx]; })}
                                      className={`w-8 h-8 rounded-full border shrink-0 flex items-center justify-center transition-all cursor-pointer relative overflow-hidden ${
                                        isSelected
                                          ? 'border-[#cca35e]'
                                          : 'border-transparent'
                                      }`}
                                      title={isHost ? 'المستضيف' : occupant.name}
                                    >
                                      <img
                                        src={occupant.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=placeholder"}
                                        alt={occupant.name}
                                        className="w-full h-full object-cover"
                                      />
                                    </button>
                                  );
                                })}
                            </div>
                          </div>
                        )}

                        {/* Gifts Grid */}
                        <div className="grid grid-cols-4 gap-y-3 gap-x-1 h-[190px] min-h-[190px] overflow-y-auto mb-2 px-2 shrink-0 touch-pan-y scrollbar-thin scrollbar-thumb-white/10">
                          {(
                            activeGiftCategory === 'اساسي' ? GIFTS.filter(g => g.id !== 'cp_gift' && g.id !== 'friend_gift') :
                            activeGiftCategory === 'CP' ? GIFTS.filter(g => g.id === 'cp_gift' || g.id === 'friend_gift') :
                            []
                          ).map((gift) => {
                            const isSelected = selectedGift && selectedGift.id === gift.id;
                            return (
                              <button
                                key={gift.id}
                                onClick={() => setSelectedGift(gift)}
                                className={`flex flex-col items-center justify-center py-2 rounded-xl transition-all relative ${
                                  isSelected
                                    ? 'border border-[#cca35e] bg-white/5'
                                    : 'border border-transparent hover:bg-white/5'
                                }`}
                              >
                                {gift.imageUrl ? (
                                  <img 
                                    src={gift.imageUrl} 
                                    alt={gift.arabicName} 
                                    className="w-10 h-10 object-contain mb-1 drop-shadow-md"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <span className="text-3xl mb-1 drop-shadow-md">{gift.icon}</span>
                                )}
                                <span className="text-[10px] text-slate-200 truncate w-full text-center px-1">{gift.arabicName}</span>
                                <div className="flex items-center gap-0.5 mt-0.5">
                                  <span className="text-[10px] text-slate-400 font-mono">{gift.cost}</span>
                                  <Coins className="w-2.5 h-2.5 text-amber-400" />
                                </div>
                              </button>
                            );
                          })}
                          {(activeGiftCategory === 'حقيبة') && (
                            <div className="col-span-4 py-8 flex flex-col items-center justify-center text-slate-500 gap-2">
                              <Briefcase className="w-8 h-8 opacity-50" />
                              <span className="text-xs">لا يوجد هدايا في الحقيبة</span>
                            </div>
                          )}
                        </div>

                        {/* Non-mutual follow extra fee notice */}
                        {currentUser && currentUser.gender === 'male' && selectedGift && (() => {
                          let activeSurcharge = 0;
                          let targets = [...selectedRecipientSeatIndices];
                          if (targets.includes('all')) {
                            const occupiedSeats = activeRoom?.seats?.map((s, idx) => s.userId ? idx + 1 : null).filter(val => val !== null) || [];
                            targets = occupiedSeats.length > 0 ? occupiedSeats : [];
                          }
                          for (const target of targets) {
                            if (target !== 'all') {
                              const seat = activeRoom?.seats?.[(target as number) - 1];
                              if (seat && seat.userId) {
                                const receiverId = seat.userId;
                                const recUser = users?.find(u => u.id === receiverId);
                                if (recUser && recUser.gender === 'female') {
                                  const isMutual = currentUser.following?.includes(receiverId) && currentUser.followers?.includes(receiverId);
                                  if (!isMutual) {
                                    activeSurcharge += 40;
                                  }
                                }
                              }
                            }
                          }
                          if (activeSurcharge > 0) {
                            return (
                              <div className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg mx-3 mb-2 text-center font-bold font-sans" dir="rtl">
                                ⚠️ رسوم إرسال من شاب إلى بنت لغير المتابعين: +{activeSurcharge} كوينز (تصبح مجاناً عند المتابعة المتبادلة)
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {/* Bottom Actions Row */}
                        <div className="flex flex-row justify-between items-center px-3 mt-1 pt-3 border-t border-white/5">
                          {/* Right Side (Balance & Topup) */}
                          <div 
                            className="flex items-center gap-1 cursor-pointer hover:bg-white/5 p-1 rounded-lg transition-colors cursor-help"
                            title={currentUser?.coins?.toLocaleString() + " كوينز"}
                          >
                            <Coins className="w-4 h-4 text-amber-400" />
                            <span className="text-white text-xs font-bold font-mono">{formatCompactNumber(currentUser?.coins || 0)}</span>
                            <ChevronLeft className="w-3.5 h-3.5 text-slate-400 mr-0.5" />
                          </div>

                          {/* Left Side (Send Button Group) */}
                          <div className="flex items-center relative">
                            {/* Quantity Selector Dropdown (Absolute) */}
                            {showGiftQuantitySelector && (
                              <div className="absolute bottom-full left-0 mb-2 w-16 bg-[#1a1a1a] border border-[#ffd700]/30 rounded-xl shadow-2xl flex flex-col overflow-hidden z-50">
                                {[1, 10, 50, 99, 500, 1000].map(qty => (
                                  <button
                                    key={qty}
                                    onClick={() => {
                                      setGiftQuantity(qty);
                                      setShowGiftQuantitySelector(false);
                                    }}
                                    className={`py-1.5 text-xs font-mono font-bold hover:bg-[#cca35e]/20 transition-colors ${giftQuantity === qty ? 'text-[#ffd700] bg-white/5' : 'text-white'}`}
                                  >
                                    {qty}
                                  </button>
                                ))}
                              </div>
                            )}
                            
                            {/* The number pill (behind the send button visually) */}
                            <div 
                              onClick={() => setShowGiftQuantitySelector(!showGiftQuantitySelector)}
                              className="flex items-center justify-center bg-[#1a1a1a] border border-[#ffd700] rounded-r-full h-8 px-3 cursor-pointer hover:bg-[#2a2a2a] transition-colors"
                            >
                              <span className="text-white text-xs font-bold mr-1">{giftQuantity}</span>
                              <ChevronUp className={`w-3 h-3 text-[#ffd700] ml-1 transition-transform ${showGiftQuantitySelector ? 'rotate-180' : ''}`} />
                            </div>
                            
                            {/* The main send button */}
                            <button
                              onClick={() => {
                                if (selectedGift) {
                                  handleSendGift(selectedGift, giftQuantity);
                                } else {
                                  alert('الرجاء اختيار هدية لإرسالها!');
                                }
                              }}
                              className="bg-gradient-to-r from-[#ffd700] to-[#ffaa00] text-black font-bold text-sm px-5 h-8 rounded-full z-10 hover:from-[#ffaa00] hover:to-[#ffd700] active:scale-95 transition-all shadow-md mr-[-12px]"
                            >
                              إرسال
                            </button>
                          </div>
                        </div>

                      </div>
                  </>
                )}



                  {/* SEATS REQUESTS QUEUE BOTTOM SHEET */}
                  {isQueueDrawerOpen && (
                    <>
                      <div
                        className="absolute inset-0 bg-black/60 z-40 animate-fade-in cursor-pointer"
                        onClick={() => setIsQueueDrawerOpen(false)}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-[#0c071fa6] backdrop-blur-xl border-t border-purple-500/30 rounded-t-[32px] p-4 z-50 animate-fade-in shadow-2xl text-right">
                      <div className="flex justify-between items-center border-b border-purple-950/40 pb-2 mb-3 font-sans">
                        <button
                          onClick={() => setIsQueueDrawerOpen(false)}
                          className="text-xs text-slate-400 hover:text-white bg-slate-900/60 px-3 py-1 rounded-full border border-slate-800 cursor-pointer"
                        >
                          إغلاق
                        </button>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          🛋️ طلبات الصعود للمقاعد (23)
                        </h4>
                      </div>

                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        {[
                          { id: 'q1', name: 'أبو فهد النجدي', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=60', level: 25 },
                          { id: 'q2', name: 'هنوف العتيبي', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=60', level: 14 },
                          { id: 'q3', name: 'فيصل الرياض', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=60', level: 31 },
                        ].map((req) => (
                          <div key={req.id} className="bg-slate-950/60 p-2 rounded-xl border border-white/5 flex justify-between items-center text-xs gap-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  // Find first empty seat index from index 6 to 9 (empty armchairs) or any
                                  const emptySeatIdx = activeRoom?.seats?.findIndex(s => s.userId === null && !s.isLocked);
                                  if (emptySeatIdx !== -1) {
                                    const updatedSeats = [...(activeRoom?.seats || [])];
                                    updatedSeats[emptySeatIdx] = { ...updatedSeats[emptySeatIdx], userId: req.id, isMuted: true };
                                    
                                    // ensure user in list
                                    if (!users?.some(u => u.id === req.id)) {
                                      setUsers(prev => [...prev, { id: req.id, name: req.name, avatar: req.avatar, level: req.level, coins: 150, xp: 900 }]);
                                    }

                                    const updatedRoom = { ...activeRoom, seats: updatedSeats };
                                    setActiveRoom(updatedRoom);
                                    setRooms(rooms?.map(r => r.id === activeRoom.id ? updatedRoom : r));
                                    
                                    setRoomMessages(prev => [
                                      ...prev,
                                      {
                                        sender: 'نظام المجلس',
                                        text: `صعد [ ${req.name} ] إلى المقعد رقم ${emptySeatIdx + 1} بنجاح! 🎉`,
                                        color: 'text-emerald-400 font-bold',
                                        type: 'system'
                                      }
                                    ]);
                                  } else {
                                    alert('جميع المقاعد ممتلئة حالياً!');
                                  }
                                  setIsQueueDrawerOpen(false);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1 rounded-lg text-[10px] transition"
                              >
                                قبول
                              </button>
                              <button
                                onClick={() => {
                                  alert('تم رفض طلب الصعود');
                                  setIsQueueDrawerOpen(false);
                                }}
                                className="bg-red-950/40 hover:bg-red-900/40 text-red-300 px-3 py-1 rounded-lg text-[10px] transition"
                              >
                                رفض
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <span className="text-white font-bold block">{req.name}</span>
                                <span className="text-[9px] text-slate-400">مستوى {req.level}</span>
                              </div>
                              <img src={req.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=placeholder"} alt="" className="w-8 h-8 rounded-full border border-purple-500/20 object-cover" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                  {/* END-TO-END ENCRYPTION (E2EE) MANAGEMENT DRAWER */}
                  {isE2EEDrawerOpen && (
                    <>
                      <div
                        className="absolute inset-0 bg-black/60 z-40 animate-fade-in cursor-pointer"
                        onClick={() => setIsE2EEDrawerOpen(false)}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-[#04020b]/99 backdrop-blur-xl border-t border-emerald-500/40 rounded-t-[32px] p-4 z-50 animate-fade-in shadow-2xl text-right font-sans overflow-hidden" dir="rtl">
                      {/* Drawer Header */}
                      <div className="flex justify-between items-center border-b border-emerald-950/40 pb-2 mb-3">
                        <button
                          onClick={() => setIsE2EEDrawerOpen(false)}
                          className="text-xs text-slate-400 hover:text-white bg-slate-900/60 px-3 py-1 rounded-full border border-slate-800 cursor-pointer transition"
                        >
                          إغلاق
                        </button>
                        <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 font-sans">
                          🔐 منظومة التشفير التام (E2EE Client-Side)
                        </h4>
                      </div>

                      {/* E2EE System Indicator */}
                      <div className="p-2.5 bg-[#020106] rounded-xl border border-emerald-500/20 mb-3 space-y-1.5 text-right">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] text-slate-400">حالة التشفير:</span>
                          <span className={`text-[10px] font-bold flex items-center gap-1 ${isE2EEEnabled ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {isE2EEEnabled ? '🟢 مشفّر تزامني (AES-GCM-256)' : '🔴 غير مفعّل (قنوات مكشوفة)'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-slate-500 leading-relaxed">
                          <span>المعيار المستخدم:</span>
                          <span className="font-mono text-emerald-500/80">Web Crypto Subtle (PBKDF2 + AES-GCM)</span>
                        </div>
                      </div>

                      {/* Cryptographic Controls Grid */}
                      <div className="space-y-3 mb-3">
                        
                        {/* E2EE Main Toggle */}
                        <div className="flex justify-between items-center p-2 bg-[#020106]/40 rounded-lg border border-white/5">
                          <button
                            onClick={() => {
                              setIsE2EEEnabled(!isE2EEEnabled);
                              addE2eeLog(isE2EEEnabled ? 'تم إيقاف تشفير المحادثات الصادرة.' : 'تم تفعيل التشفير التام للمحادثات الصادرة.');
                            }}
                            className={`px-2.5 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer ${
                              isE2EEEnabled 
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {isE2EEEnabled ? 'مفعّل (Active)' : 'ملغى (Disabled)'}
                          </button>
                          <span className="text-[10px] text-slate-200">تشفير الرسائل الصادرة والواردة تلقائياً</span>
                        </div>

                        {/* Passphrase Entry */}
                        <div className="space-y-1 bg-[#020106]/40 p-2.5 rounded-lg border border-white/5 text-right">
                          <div className="flex justify-between items-center">
                            <button
                              onClick={() => {
                                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                                let code = 'Sada-';
                                for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
                                setE2eePassphrase(code);
                                addE2eeLog(`تم توليد كلمة سر عشوائية جديدة: ${code}`);
                              }}
                              className="text-[8px] bg-emerald-950/40 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded hover:bg-emerald-900/40 transition"
                            >
                              🎲 كود عشوائي
                            </button>
                            <label className="text-[10px] text-slate-300 font-bold">مفتاح التشفير المشترك (Passphrase)</label>
                          </div>
                          
                          <div className="flex items-center gap-1 bg-black/50 border border-white/5 rounded-md px-2 py-1 mt-1 font-sans">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(e2eePassphrase);
                                addE2eeLog(`تم نسخ كلمة سر التشفير المشتركة لغرفة الدردشة.`);
                                setCustomNotice({
                                   title: 'تم النسخ 📋',
                                   message: 'تم نسخ كلمة سر التشفير المشتركة للمجلس بنجاح إلى الحافظة.'
                                 });
                              }}
                              className="text-slate-400 hover:text-white p-1 text-[10px] transition"
                              title="نسخ كلمة السر"
                            >
                              📋
                            </button>
                            <input
                              type={showPassphrase ? 'text' : 'password'}
                              value={e2eePassphrase}
                              onChange={(e) => {
                                setE2eePassphrase(e.target.value);
                                addE2eeLog(`تم تعديل كلمة مرور التشفير المشتركة للغرفة.`);
                              }}
                              placeholder="أدخل رمز التشفير السري للمجلس..."
                              className="bg-transparent text-slate-200 text-[10px] font-mono text-left outline-none flex-grow w-full"
                            />
                            <button
                              onClick={() => setShowPassphrase(!showPassphrase)}
                              className="text-slate-400 hover:text-white px-1 text-[10px]"
                            >
                              {showPassphrase ? '👁️' : '🕶️'}
                            </button>
                          </div>
                          <span className="text-[8px] text-slate-500 block leading-tight mt-1 text-right">
                            * يجب أن يدخل جميع من في الغرفة نفس هذا الرمز السري ليتمكنوا من قراءة الرسائل بوضوح.
                          </span>
                        </div>

                        {/* Show Ciphertext Toggle */}
                        <div className="flex justify-between items-center p-2 bg-[#020106]/40 rounded-lg border border-white/5">
                          <button
                            onClick={() => setShowCiphertextInFeed(!showCiphertextInFeed)}
                            className={`px-2.5 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer ${
                              showCiphertextInFeed 
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {showCiphertextInFeed ? 'معروض (Ciphertext)' : 'مخفي (Decrypted)'}
                          </button>
                          <span className="text-[10px] text-slate-200">عرض الرموز المشفّرة عِوضاً عن النص العادي</span>
                        </div>

                        {/* Local Cryptographic Identity (RSA-OAEP) */}
                        <div className="bg-[#020106]/40 p-2.5 rounded-lg border border-white/5 space-y-1.5 text-right font-sans">
                          <div className="flex justify-between items-center">
                            <button
                              onClick={() => {
                                if (clientPublicKeyBase64) {
                                  navigator.clipboard.writeText(clientPublicKeyBase64);
                                  addE2eeLog(`تم نسخ مفتاح RSA العام لهويتك الفريدة.`);
                                  setCustomNotice({
                                    title: 'تم نسخ مفتاح الهوية 🔑',
                                    message: 'تم نسخ مفتاح RSA-2048 العام لهويتك الرقمية للمجلس بنجاح إلى الحافظة.'
                                  });
                                }
                              }}
                              className="text-[8px] bg-purple-950/40 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded hover:bg-purple-900/40 transition"
                            >
                              📋 نسخ مفتاح الهوية
                            </button>
                            <span className="text-[10px] text-slate-300 font-bold">هويتك الرقمية المشفرة (RSA Identity Key)</span>
                          </div>
                          <div className="p-1.5 bg-black/60 rounded border border-white/5 overflow-x-auto">
                            <code className="text-[6px] text-slate-500 font-mono block break-all leading-normal select-all">
                              {clientPublicKeyBase64 ? clientPublicKeyBase64.substring(0, 110) + '...' : 'جاري التوليد...'}
                            </code>
                          </div>
                          <span className="text-[8px] text-slate-500 block leading-tight">
                            * يتم توليد زوج مفاتيح RSA-OAEP 2048-bit في متصفحك محلياً بشكل منعزل لإثبات وتأكيد هويتك أمام أطراف الغرفة.
                          </span>
                        </div>

                      </div>

                      {/* Live SubtleCrypto Live Audit terminal */}
                      <div className="space-y-1.5 font-sans">
                        <div className="flex justify-between items-center">
                          <button
                            onClick={() => setE2eeAuditLogs([])}
                            className="text-[8px] text-slate-400 hover:text-red-400 transition cursor-pointer"
                          >
                            مسح السجل 🗑️
                          </button>
                          <span className="text-[9px] text-slate-400 font-bold">📺 سجل العمليات التشفيرية الفورية (SubtleCrypto Log):</span>
                        </div>
                        <div className="p-2 bg-black/90 border border-emerald-500/10 rounded-xl h-24 overflow-y-auto text-left font-mono space-y-1 scrollbar-thin">
                          {e2eeAuditLogs.length === 0 ? (
                            <div className="text-[8px] text-slate-600 italic">بانتظار حركة تشفيرية للمرسل...</div>
                          ) : (
                            e2eeAuditLogs.map((log, lidx) => (
                              <div key={lidx} className="text-[7px] leading-tight select-text text-emerald-400/90 break-words font-mono">
                                {log}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                    </div>
                  </>
                )}


                  {/* ROOM SETTINGS DRAWER */}
                  {isRoomSettingsDrawerOpen && (
                    <>
                      <div
                        className="absolute inset-0 bg-black/60 z-40 animate-fade-in cursor-pointer"
                        onClick={() => setIsRoomSettingsDrawerOpen(false)}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-[#0f0a1c] backdrop-blur-2xl border-t border-purple-500/45 rounded-t-[32px] p-5 z-50 animate-fade-in shadow-2xl text-right font-sans max-h-[85%] overflow-y-auto" dir="rtl">
                      {/* Header */}
                      <div className="flex justify-between items-center border-b border-purple-950/40 pb-3 mb-4">
                        <button
                          onClick={() => setIsRoomSettingsDrawerOpen(false)}
                          className="text-xs text-slate-400 hover:text-white bg-slate-900/60 px-3 py-1 rounded-full border border-slate-800 cursor-pointer transition"
                        >
                          إغلاق
                        </button>
                        <h4 className="text-sm font-black text-white flex items-center gap-1.5 font-sans">
                          ⚙️ إعدادات المجلس الصوتي
                        </h4>
                      </div>

                      {roomSettingsError && (
                        <div className="bg-red-950/50 border border-red-500/30 text-red-300 p-2.5 rounded-xl text-xs mb-3 text-right">
                          ⚠️ {roomSettingsError}
                        </div>
                      )}

                      <div className="space-y-4">
                        {/* Room Name Input */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-300 block">اسم المجلس الصوتي:</label>
                          <input
                            type="text"
                            value={roomSettingsName}
                            onChange={(e) => setRoomSettingsName(e.target.value)}
                            placeholder="اكتب اسم المجلس هنا..."
                            className="w-full bg-[#05030a] border border-purple-900/40 text-white rounded-xl p-3 text-xs outline-none focus:border-purple-500 transition font-bold"
                          />
                        </div>

                        {/* Mobile File Uploader */}
                        <div className="space-y-3">
                          <label className="text-xs font-bold text-slate-300 block">صورة واجهة المجلس 🖼️:</label>
                          
                          {/* Selected Image Preview */}
                          {roomSettingsAvatar && (
                            <div className="flex flex-col items-center justify-center p-3 bg-[#05030a]/40 rounded-2xl border border-purple-900/30 gap-2">
                              <span className="text-[10px] text-slate-400 font-bold">معاينة الصورة الحالية:</span>
                              <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-amber-400/80 shadow-lg shadow-purple-950">
                                <img
                                  src={roomSettingsAvatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=placeholder"}
                                  alt="Room Avatar Preview"
                                  className="w-full h-full object-cover select-none pointer-events-none"
                                  style={{ WebkitTouchCallout: 'none' }}
                                  draggable="false"
                                  onContextMenu={(e) => e.preventDefault()}
                                />
                              </div>
                            </div>
                          )}

                          <input
                            type="file"
                            id="room-avatar-upload"
                            accept="image/*"
                            onChange={handleRoomAvatarFileChange}
                            className="hidden"
                          />
                          
                          <label
                            htmlFor="room-avatar-upload"
                            className="flex flex-col items-center justify-center border-2 border-dashed border-purple-500/35 hover:border-amber-400 bg-purple-950/20 hover:bg-purple-950/40 text-slate-200 hover:text-white rounded-2xl p-6 text-center cursor-pointer transition active:scale-95 group"
                          >
                            <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">📱</span>
                            <span className="text-xs font-black text-amber-300">رفع صورة من الاستوديو / الكاميرا</span>
                            <span className="text-[9px] text-slate-400 mt-1">اضغط هنا لتصفح ملفات هاتفك واختيار صورة مباشرة</span>
                          </label>
                        </div>

                        {/* Save Action Button */}
                        <button
                          type="button"
                          disabled={isUpdatingRoomSettings}
                          onClick={async () => {
                            if (!roomSettingsName.trim()) {
                              setRoomSettingsError('يرجى كتابة اسم المجلس أولاً');
                              return;
                            }

                            setIsUpdatingRoomSettings(true);
                            setRoomSettingsError('');

                            try {
                              const roomRef = doc(db, "voice_rooms", activeRoom.id);
                              await updateDoc(roomRef, {
                                name: roomSettingsName.trim(),
                                room_name: roomSettingsName.trim(),
                                hostAvatar: roomSettingsAvatar.trim(),
                                host_avatar: roomSettingsAvatar.trim()
                              });

                              setIsRoomSettingsDrawerOpen(false);
                              alert('🎉 تم تحديث بيانات مجلسك الصوتي بنجاح!');
                            } catch (err) {
                              console.error(err);
                              setRoomSettingsError('حدث خطأ في تحديث الإعدادات عبر Firestore.');
                            } finally {
                              setIsUpdatingRoomSettings(false);
                            }
                          }}
                          className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-slate-950 py-3 rounded-xl text-xs font-black transition shadow-lg hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          {isUpdatingRoomSettings ? (
                            <span>جاري الحفظ والتحديث...</span>
                          ) : (
                            <span>حفظ التعديلات ✨</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                  {/* ADMIN SIMULATION & CONTROL WHEEL DRAWER */}
                  {isAdminDrawerOpen && (
                    <>
                      <div
                        className="absolute inset-0 bg-black/40 z-40 animate-fade-in cursor-pointer"
                        onClick={() => setIsAdminDrawerOpen(false)}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-[#FAF6EB]/98 backdrop-blur-md border-t-2 border-amber-400 rounded-t-[32px] p-5 z-50 animate-fade-in shadow-2xl text-right font-sans">
                      <div className="flex justify-between items-center border-b border-[#E8DCC4] pb-2.5 mb-3.5">
                        <button
                          onClick={() => setIsAdminDrawerOpen(false)}
                          className="text-xs text-slate-600 hover:text-slate-950 bg-slate-200/60 hover:bg-slate-200 px-3 py-1 rounded-full border border-slate-300 cursor-pointer transition"
                        >
                          إغلاق
                        </button>
                        <h4 className="text-xs font-black text-[#4A3E3D] flex items-center gap-1.5">
                          👑 لوحة إشراف وخدمات مالك المجلس
                        </h4>
                      </div>

                      <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">
                        استخدم هذه الخدمات لإرسال ترحيب خاص بالزوار المرموقين، أو فحص جودة اتصال الصوت ومؤشرات الميكروفون الفعالة.
                      </p>

                      <div className="space-y-3">
                        {/* 1. Simulate VIP Entrance */}
                        <button
                          onClick={() => {
                            const vips = ['خالد الحربي', 'الشيخ فيصل الرياض', 'بندر الشمري', 'سعود العتيبي'];
                            const randomVip = vips[Math.floor(Math.random() * vips.length)];
                            triggerVipEntrance(randomVip, 38);
                            setIsAdminDrawerOpen(false);
                          }}
                          className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-slate-950 py-2.5 px-4 rounded-xl text-xs font-black flex justify-between items-center transition cursor-pointer active:scale-95 shadow-sm"
                        >
                          <span>تفعيل الآن</span>
                          <span className="flex items-center gap-1.5">
                            <Award className="w-4 h-4 text-slate-950" />
                            إرسال ترحيب شرفي VIP (مستوى ٣٨) 👑
                          </span>
                        </button>

                        {/* 2. Toggle Speaker voice impulse */}
                        <button
                          onClick={() => {
                            const validIndexes = activeRoom?.seats?.filter(s => s.userId !== null).map(s => s.index);
                            if (validIndexes.length > 0) {
                              const randomIdx = validIndexes[Math.floor(Math.random() * validIndexes.length)];
                              setSpeakingSeatIndex(randomIdx);
                              setTimeout(() => setSpeakingSeatIndex(null), 2500);
                            }
                            setIsAdminDrawerOpen(false);
                          }}
                          className="w-full bg-slate-200 hover:bg-slate-300 text-[#4A3E3D] py-2.5 px-4 rounded-xl text-xs font-black flex justify-between items-center transition cursor-pointer active:scale-95 border border-slate-300"
                        >
                          <span>فحص فوري</span>
                          <span className="flex items-center gap-1.5">
                            <Music className="w-4 h-4 text-[#4A3E3D]" />
                            فحص جودة إشارات الصوت ومؤشرات التحدث 🎙️
                          </span>
                        </button>

                        {/* 4. Disconnect simulation removed as Agora is disabled */}
                      </div>
                    </div>
                  </>
                )}

                  {/* SYSTEM OF APPROVED CHARGING AGENTS DRAWER */}
                  {isAgentsHubOpen && (
                    <>
                      <div
                        className="fixed inset-0 bg-black/80 z-40 animate-fade-in cursor-pointer backdrop-blur-sm"
                        onClick={() => setIsAgentsHubOpen(false)}
                      />
                      <div className="fixed inset-x-0 bottom-0 bg-[#121118] rounded-t-[28px] border-t border-white/10 p-4 z-50 animate-slide-up shadow-2xl max-h-[85%] flex flex-col max-w-md mx-auto text-right font-sans">
                      
                      {/* Header */}
                      <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-3 shrink-0">
                        <button
                          onClick={() => setIsAgentsHubOpen(false)}
                          className="p-1.5 hover:bg-white/10 rounded-full transition text-slate-400 hover:text-white cursor-pointer"
                        >
                          <X className="w-5 h-5" />
                        </button>
                        <h3 className="font-black text-slate-100 text-sm flex items-center gap-1.5">
                          <span>🛡️</span> شبكة الوكلاء المعتمدين للشحن
                        </h3>
                      </div>

                      {/* Subtext */}
                      <p className="text-[11px] text-slate-400 leading-relaxed mb-4 text-right shrink-0">
                        لتعبئة وشحن حسابك بالكوينزات، يرجى التواصل مباشرة مع أحد وكلائنا المعتمدين أدناه عبر تطبيق <strong className="text-emerald-400 font-black">واتساب</strong> لشحن رصيدك فورياً وبأمان.
                      </p>

                      {/* Search Bar */}
                      <div className="relative mb-4 shrink-0">
                        <input
                          type="text"
                          placeholder="ابحث عن اسم وكيل أو معرّف..."
                          value={agentSearchQuery}
                          onChange={(e) => setAgentSearchQuery(e.target.value)}
                          className="w-full bg-[#181622] border border-white/10 text-slate-100 rounded-xl px-4 py-2.5 text-xs text-right outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                        />
                        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      </div>



                      {/* Agents List Grid */}
                      <div className="flex-grow overflow-y-auto space-y-2.5 min-h-[220px] pb-4">
                        {agentsHub.length === 0 ? (
                          <div className="bg-white/5 p-8 rounded-xl text-center text-slate-500 text-xs border border-dashed border-white/5">
                            لا يوجد وكلاء متاحون حالياً في منطقتك.
                          </div>
                        ) : (
                          agentsHub
                            .filter(agent => 
                              !agentSearchQuery || 
                              agent.agent_name?.toLowerCase().includes(agentSearchQuery.toLowerCase()) || 
                              agent.agent_id?.toLowerCase().includes(agentSearchQuery.toLowerCase())
                            )
                            .map((agent) => {
                              let cleanWhatsapp = agent.contact_whatsapp ? agent.contact_whatsapp.replace(/\D/g, '') : '';
                              if (cleanWhatsapp.startsWith('00')) {
                                cleanWhatsapp = cleanWhatsapp.slice(2);
                              }
                              const hasWhatsapp = !!cleanWhatsapp;
                              const waUrl = hasWhatsapp ? `https://wa.me/${cleanWhatsapp}` : (agent.contact_whatsapp || '#');

                              return (
                                <div key={agent.agent_id} className="bg-white/5 p-3 rounded-2xl border border-white/5 flex justify-between items-center hover:bg-[#181622] transition-colors">
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-[#25D366] hover:bg-[#20ba56] active:scale-95 text-slate-950 font-black text-[10px] px-3.5 py-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-sm shadow-emerald-500/10"
                                  >
                                    <span>💬</span>
                                    شحن واتساب
                                  </a>
                                  <div className="flex items-center gap-2.5">
                                    <div className="text-right">
                                      <h4 className="text-xs font-black text-slate-200 flex items-center gap-1 justify-end">
                                        <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-black flex items-center gap-0.5 shrink-0 border border-amber-500/10">
                                          <span>⚡</span> وكيل معتمد
                                        </span>
                                        <span className="truncate max-w-[120px] inline-block">{agent.agent_name}</span>
                                      </h4>
                                      <span className="text-[9px] text-slate-500 font-mono block mt-0.5">ID: {agent.agent_id}</span>
                                    </div>
                                    {(() => {
                                      const matchedUser = users.find(u => u.id === agent.agent_id || u.displayId === agent.agent_id || u.originalDisplayId === agent.agent_id);
                                      const isMe = currentUser && (currentUser.id === agent.agent_id || currentUser.displayId === agent.agent_id);
                                      const avatarSrc = (agent as any).avatar || matchedUser?.avatar || (isMe ? currentUser.avatar : null) || `https://api.dicebear.com/7.x/adventurer/svg?seed=${agent.agent_id}`;
                                      return (
                                        <img 
                                          src={avatarSrc} 
                                          alt={agent.agent_name || 'Agent'} 
                                          className="w-10 h-10 rounded-full object-cover border border-white/10 shadow-inner bg-[#121118]" 
                                          onError={(e)=>{
                                            (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${agent.agent_id}`;
                                          }}
                                        />
                                      );
                                    })()}
                                  </div>
                                </div>
                              );
                            })
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center shrink-0">
                        <span className="text-[9px] text-slate-500">نظام حماية صدى العرب المالي المعتمد</span>
                        <span className="text-[9px] text-amber-400 flex items-center gap-1 font-bold">🛡️ حماية كوينز بنسبة 100%</span>
                      </div>
                    </div>
                  </>
                )}

                </div>
              )}

              {/* SCREEN 4: AGENT DASHBOARD SECURITY PIN ENTRY */}
              {currentScreen === 'agent_pin' && (
                <div className="flex-grow flex flex-col p-5 justify-between items-center bg-gradient-to-b from-[#1c120a] to-[#03000a] h-full" id="screen-agent-pin">
                  
                  <div className="text-center mt-12 space-y-2">
                    <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto animate-pulse" />
                    <h3 className="text-base font-bold text-white">بوابة الوكلاء المعتمدين</h3>
                    <p className="text-[10px] text-slate-400">الوصول لهذه اللوحة يتطلب صلاحيات وكيل معتمد ورمز أمان</p>
                  </div>

                  <div className="w-full space-y-4">
                    <div className="bg-slate-900/90 p-4 rounded-xl border border-amber-500/20 text-right space-y-3">
                      <label className="text-[10px] text-slate-300 block">أدخل رمز أمان الوكيل المعتمد (PIN)</label>
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="••••"
                        value={agentPinInput}
                        onChange={(e) => {
                          setAgentPinInput(e.target.value);
                          setAgentPinError(false);
                        }}
                        className="w-full bg-[#03000a] border border-slate-800 rounded-lg p-2.5 text-center text-xs text-white font-mono tracking-widest"
                      />
                      {agentPinError && (
                        <span className="text-[9px] text-red-400 font-bold block text-center">الرمز غير صحيح! الرمز الافتراضي للوكيل هو: 9999</span>
                      )}
                      <span className="text-[9px] text-amber-400 block text-center">💡 الرمز الافتراضي لمسؤولي الوكالات المعتمدة: 9999</span>
                    </div>

                    <button
                      onClick={() => {
                        if (agentPinInput === '9999') {
                          setAgentPinInput('');
                          setCurrentScreen('agent_dashboard');
                        } else {
                          setAgentPinError(true);
                        }
                      }}
                      className="w-full bg-amber-500 text-slate-950 py-2.5 rounded-xl text-xs font-bold transition"
                      id="agent-pin-submit"
                    >
                      توثيق وفتح لوحة الوكالة 🔒
                    </button>
                  </div>

                  <button
                    onClick={() => setCurrentScreen('explore')}
                    className="text-xs text-slate-400 hover:text-white"
                    id="back-to-explore-from-pin"
                  >
                    إلغاء والعودة للاستكشاف
                  </button>

                </div>
              )}

              {/* SCREEN 5: REAL-TIME AGENT IN-APP DASHBOARD */}
              {currentScreen === 'agent_dashboard' && (
                <div className="flex-grow flex flex-col h-full bg-[#0d0905]" id="screen-agent-dashboard">
                  
                  {/* Agent Header */}
                  <div className="bg-gradient-to-r from-amber-500 to-amber-700 p-3 flex justify-between items-center text-slate-950 select-none">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-slate-950" />
                      <div className="text-right">
                        <h4 className="text-xs font-black">الوكيل الذهبي للاتصالات</h4>
                        <p className="text-[8px] opacity-80">صلاحية وكيل رقم #9999</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setCurrentScreen('explore')}
                      className="bg-slate-950/25 hover:bg-slate-950/40 text-slate-950 px-2.5 py-1 rounded-lg text-[9px] font-bold transition"
                      id="exit-agent-dashboard-btn"
                    >
                      خروج للغرف
                    </button>
                  </div>

                  {/* Agent Content */}
                  <div className="p-4 flex-grow overflow-y-auto space-y-4">
                    
                    {/* Agent Balance Card */}
                    <div className="bg-gradient-to-br from-purple-950 via-slate-950 to-amber-950/60 p-4 rounded-xl border border-amber-500/30 text-center space-y-1 shadow-md">
                      <span className="text-[10px] text-slate-400">رصيد كوينزات الوكالة الفوري الشاغر:</span>
                      <h3 className="text-2xl font-black text-amber-300 font-mono">
                        🪙 {agentBalance.toLocaleString()}
                      </h3>
                      <span className="text-[9px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20 inline-block">
                        رصيد نشط وموثق للتحويل
                      </span>
                    </div>

                    {/* Transfer Module Section */}
                    <div className="bg-slate-900/90 p-3 rounded-xl border border-purple-500/10 space-y-3">
                      <span className="text-[10px] text-amber-400 font-bold block text-right">عملية شحن وتحويل فوري:</span>
                      
                      {/* Search Recipient ID */}
                      <div className="space-y-1.5">
                        <label className="text-[9px] text-slate-400 block text-right">رقم معرف المستلم (ID)</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="مثال: 1001، 1002، 1004"
                            value={transferTargetId}
                            onChange={(e) => setTransferTargetId(e.target.value)}
                            className="flex-grow bg-[#03000a] border border-slate-800 rounded-lg p-2 text-xs text-center text-white font-mono"
                          />
                        </div>
                      </div>

                      {/* User recipient verification Card */}
                      {transferTargetUser ? (
                        <div className="bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-500/20 flex justify-between items-center animate-fade-in">
                          <div className="flex items-center gap-2">
                            <img
                              src={transferTargetUser.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=placeholder"}
                              alt="recipient avatar"
                              className="w-8 h-8 rounded-full border border-emerald-500/30 object-cover"
                            />
                            <div className="text-right">
                              <h5 className="text-[11px] font-bold text-white">{transferTargetUser.name}</h5>
                              <span className="text-[9px] text-amber-300">مستوى {transferTargetUser.level} | 🪙 رصيده الحالي: {transferTargetUser.coins}</span>
                            </div>
                          </div>
                          <span className="text-[9px] bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">
                            مؤكد للهوية ✓
                          </span>
                        </div>
                      ) : (
                        transferTargetId && (
                          <div className="bg-red-950/20 p-2 rounded-lg border border-red-500/20 text-center text-[9px] text-red-400 font-bold">
                            ⚠️ رقم المعرف غير مسجل بقاعدة البيانات!
                          </div>
                        )
                      )}

                      {/* Amount and PIN secure fields */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-400 block text-right">عدد الكوينزات</label>
                          <input
                            type="number"
                            placeholder="أدخل عدد الكوينز"
                            value={transferAmount}
                            onChange={(e) => setTransferAmount(e.target.value)}
                            className="w-full bg-[#03000a] border border-slate-800 rounded-lg p-2 text-xs text-center text-white font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-400 block text-right">رمز أمان الوكيل PIN</label>
                          <input
                            type="password"
                            placeholder="أدخل PIN الوكيل"
                            value={transferPin}
                            onChange={(e) => setTransferPin(e.target.value)}
                            className="w-full bg-[#03000a] border border-slate-800 rounded-lg p-2 text-xs text-center text-white font-mono"
                          />
                        </div>
                      </div>

                      {transferSuccess && (
                        <div className="bg-emerald-950/40 text-emerald-300 text-[10px] p-2.5 rounded-lg border border-emerald-500/20 text-center font-bold">
                          🎉 تم شحن رصيد العميل بنجاح فورياً!
                        </div>
                      )}

                      {transferErrorMsg && (
                        <div className="bg-red-950/40 text-red-400 text-[10px] p-2 rounded-lg border border-red-500/20 text-center font-bold">
                          ⚠️ {transferErrorMsg}
                        </div>
                      )}

                      <button
                        onClick={handleExecuteTransfer}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                        id="execute-transfer-btn"
                      >
                        <Send className="w-3.5 h-3.5" />
                        إتمام عملية التحويل الفوري
                      </button>

                    </div>

                    {/* Agent Transaction log list */}
                    <div className="space-y-2">
                      <span className="text-[10px] text-slate-400 block text-right">سجل التحويلات والفواتير الأخيرة للوكالة:</span>
                      <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                        {transactions.map((tx) => (
                          <div
                            key={tx.id}
                            className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 flex justify-between items-center text-right text-[10px]"
                          >
                            <div className="text-left">
                              <span className="text-emerald-400 font-mono block">+{tx.amount} 🪙</span>
                              <span className="text-[8px] text-slate-500 block">{new Date(tx.timestamp).toLocaleTimeString('ar-AE')}</span>
                            </div>
                            <div>
                              <strong className="text-white block">{tx.receiverName}</strong>
                              <span className="text-[8px] text-slate-400 block">ID: {tx.receiverId}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                </div>
              )}

              {/* 👥 ROOM USERS LIST MODAL */}
              {isRoomUsersModalOpen && activeRoom && (
                <div className="absolute inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-end justify-center animate-fade-in text-right">
                  <div className="bg-[#0c081d] border-t border-purple-500/30 p-5 rounded-t-[32px] w-full max-h-[85%] overflow-y-auto space-y-5 shadow-2xl relative font-sans">
                    {/* Header */}
                    <div className="flex justify-between items-center pb-3 border-b border-white/5 sticky top-0 bg-[#0c081d] z-10">
                      <button
                        onClick={() => setIsRoomUsersModalOpen(false)}
                        className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition"
                      >
                        ✕
                      </button>
                      <h3 className="font-bold text-white text-lg flex items-center gap-2">
                        <span>👥</span> الأشخاص في المجلس ({activeRoomUsers.length})
                      </h3>
                      <div className="w-8"></div>
                    </div>

                    {/* Users List */}
                    <div className="space-y-3 pb-6">
                      {activeRoomUsers.map((u) => {
                        const user = users?.find(item => item.id === u.id) || {
                          id: u.id,
                          name: u.name,
                          avatar: u.avatar,
                          level: 1,
                          coins: 0,
                          xp: 0,
                          role: 'user'
                        } as AppUser;
                        return (
                          <div 
                            key={user.id} 
                            className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition cursor-pointer"
                            onClick={() => {
                              const seatIndex = activeRoom ? activeRoom.seats.findIndex(s => s.userId === user.id) : -1;
                              setSelectedSeatUser({ user, seatIndex });
                              setIsRoomUsersModalOpen(false);
                            }}
                          >
                            {/* Left: Follow Button or Host indicator */}
                            <div>
                              {(activeRoom?.owner_id === user.id || activeRoom?.hostName === user.name) ? (
                                <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full border border-amber-400/20">
                                  المالك 👑
                                </span>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    alert('تمت متابعة المستخدم بنجاح! 🔔');
                                  }}
                                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3 py-1.5 rounded-full transition"
                                >
                                  متابعة
                                </button>
                              )}
                            </div>

                            {/* Right: User Info */}
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <h4 className="font-bold text-sm text-white">{user.name}</h4>
                                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-slate-400">ID: {user.displayId || user.id.slice(0, 6)}</span>
                                  <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 rounded-md">مستوى {user.level || 1}</span>
                                </div>
                              </div>
                              <div className="relative">
                                <img 
                                  src={user.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=placeholder"} 
                                  alt={user.name}
                                  className="w-12 h-12 rounded-full border-2 border-purple-500/30 object-cover"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* 👤 PREMIUM USER PROFILE MODAL & BIO DRAWER */}
              {isProfileModalOpen && activeProfileUser && (
                <div className="absolute inset-0 bg-[#FAF6EB] z-[60] animate-slide-up flex flex-col overflow-hidden">
                  <FullUserProfileView
                    onBack={() => {
                      setIsProfileModalOpen(false);
                      setIsEditingBio(false);
                    }}
                    currentUser={currentUser}
                    users={users}
                    targetUser={activeProfileUser}
                    onToggleFollow={handleToggleFollow}
                    onSendPrivateMessage={(user) => {
                      setIsProfileModalOpen(false);
                      setActivePrivateChatUser(user);
                      setIsPrivateInboxOpen(true);
                    }}
                    onSendGift={(user) => {
                      const seatIdx = activeRoom?.seats?.findIndex((s: any) => s.userId === user.id);
                      setSelectedRecipientSeatIndices(seatIdx !== -1 && seatIdx !== undefined ? [seatIdx + 1] : [1]);
                      setIsProfileModalOpen(false);
                      setIsGiftDrawerOpen(true);
                    }}
                    activeRoom={activeRoom}
                    handleHostAction={handleHostAction}
                    handleBanUser={handleBanUser}
                    setSelectedSeatIndex={setSelectedSeatIndex}
                  />
                </div>
              )}

              {/* 💬 PREMIUM PRIVATE MESSAGING CHAT (FULL SCREEN) */}
              {isPrivateInboxOpen && activePrivateChatUser && currentUser && (
                <div className="absolute inset-0 bg-[#0A0713] z-50 flex flex-col animate-in slide-in-from-bottom-4 duration-300 text-right font-sans">
                  
                  {/* Glassmorphism Header */}
                  <div className="bg-[#120D23]/90 backdrop-blur-md px-5 pt-7 pb-4 flex justify-between items-center shadow-lg relative z-10 border-b border-purple-500/20">
                    <button
                      onClick={() => {
                        setIsPrivateInboxOpen(false);
                        setActivePrivateChatUser(null);
                        setNewPrivateMessageInput('');
                      }}
                      className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white rounded-full transition-colors cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    <div 
                      onClick={() => {
                        setSelectedProfileUser(activePrivateChatUser);
                        setIsProfileModalOpen(true);
                      }}
                      className="flex items-center gap-3 cursor-pointer hover:opacity-85 active:scale-95 transition-all duration-150"
                      title="عرض الصفحة الشخصية"
                    >
                      <div className="flex flex-col items-end">
                        <h4 className="text-sm font-black text-white tracking-wide flex items-center gap-1.5">
                          {activePrivateChatUser.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {isUserOnline(activePrivateChatUser) ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse"></span>
                              <span className="text-[10px] text-emerald-400 font-bold">متصل الآن</span>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold">غير متصل</span>
                          )}
                        </div>
                      </div>
                      <div className="relative">
                        <img
                          src={activePrivateChatUser.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=placeholder"}
                          alt=""
                          className="w-12 h-12 rounded-full object-cover border-2 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                        />
                        <span className="absolute -bottom-1 -left-1 text-[8px] bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black px-1.5 py-0.5 rounded-sm border border-purple-400/50 shadow-sm">
                          LV.{activePrivateChatUser.level}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* E2EE Info Callout (Floating) - Removed by user */}

                  {/* Messages Feed */}
                  <div className="flex-grow overflow-y-auto space-y-4 px-4 pb-4 scrollbar-thin">
                    <div className="text-center my-2">
                      <span className="text-[10px] font-bold text-slate-500 bg-white/5 px-3 py-1 rounded-full border border-white/10">اليوم</span>
                    </div>

                    {(() => {
                      const filteredPrivateMessages = privateMessages.filter(msg => 
                        (msg.senderId === currentUser?.id && msg.receiverId === activePrivateChatUser.id) ||
                        (msg.senderId === activePrivateChatUser.id && msg.receiverId === currentUser?.id)
                      );

                      if (filteredPrivateMessages.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs font-sans mt-10">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-3xl mb-4 border border-white/10">👋</div>
                            <p className="font-bold text-slate-300 mb-1">ابدأ المحادثة الآن!</p>
                            <p className="text-center max-w-[200px] leading-relaxed">أرسل رسالة مشفرة وآمنة للتواصل مع {activePrivateChatUser.name}</p>
                          </div>
                        );
                      }

                      return filteredPrivateMessages.map((msg) => {
                        const isSelf = msg.senderId === currentUser?.id;
                        const isInvitationMsg = !msg.isEncrypted && (msg.text?.includes("دعوة انضمام للوكالة:") || msg.invitationId);
                        const correspondingInvitation = isInvitationMsg 
                          ? agencyInvitations.find(inv => 
                              (inv.agency_id === msg.senderId && inv.target_user_id === currentUser?.id) ||
                              (inv.agency_id === msg.receiverId && inv.target_user_id === currentUser?.id)
                            )
                          : null;

                        return (
                          <div
                            key={msg.id || msg.timestamp}
                            className={`flex flex-col ${isSelf ? 'items-start text-left' : 'items-end text-right'} space-y-1`}
                          >
                            <div className="flex items-center gap-1.5 px-1 mb-1">
                              {!isSelf && (
                                <span className="text-[9px] font-bold text-slate-400">
                                  {msg.senderName}
                                </span>
                              )}
                            </div>

                            <div className={`flex ${isSelf ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 max-w-[85%]`}>
                              {!isSelf && (
                                <img 
                                  src={activePrivateChatUser.avatar} 
                                  className="w-6 h-6 rounded-full object-cover border border-purple-500/30 flex-shrink-0 cursor-pointer hover:opacity-80 active:scale-90 transition-all duration-150" 
                                  alt="avatar" 
                                  title="عرض الصفحة الشخصية"
                                  onClick={() => {
                                    setSelectedProfileUser(activePrivateChatUser);
                                    setIsProfileModalOpen(true);
                                  }}
                                />
                              )}
                              <div className="flex flex-col space-y-1">
                                <div
                                  className={`p-3 px-4 rounded-2xl text-xs shadow-md font-sans leading-relaxed ${
                                    isSelf
                                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-tl-sm border border-purple-400/20'
                                      : 'bg-[#1D1633] text-slate-200 rounded-tr-sm border border-white/5'
                                  }`}
                                >
                                  {msg.isEncrypted ? (
                                    <div className="flex flex-col space-y-1.5">
                                      <EncryptedMessageText
                                        ciphertext={msg.rawCiphertext || msg.text}
                                        iv={msg.iv || ''}
                                        derivedKey={privateKey}
                                        showCiphertext={false}
                                        fallbackText="رسالة آمنة"
                                      />
                                    </div>
                                  ) : (
                                    <span className="font-medium tracking-wide">{msg.text}</span>
                                  )}
                                </div>

                                {isInvitationMsg && (
                                  <>
                                    {isSelf ? (
                                      <div className="mt-1 text-[9px] text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 flex items-center justify-center gap-1" dir="rtl">
                                        <span>⏳ دعوة الانضمام قيد الانتظار...</span>
                                      </div>
                                    ) : (
                                      correspondingInvitation ? (
                                        <div className="mt-1 bg-gradient-to-r from-indigo-950 via-[#13112c] to-indigo-950 border-2 border-indigo-500 rounded-2xl p-3.5 shadow-xl flex flex-col space-y-2.5 text-right w-full min-w-[220px]" dir="rtl">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[9px] bg-indigo-500/20 text-indigo-300 font-extrabold px-2 py-0.5 rounded-full border border-indigo-400/30">
                                              دعوة انضمام للوكالة 🏢
                                            </span>
                                          </div>
                                          <div className="flex items-start gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-sm border border-indigo-500/30 shadow-inner">
                                              🏢
                                            </div>
                                            <div className="space-y-0.5 text-right flex-1">
                                              <h4 className="text-[11px] font-black text-white">وكالة: {correspondingInvitation.agency_name}</h4>
                                              <p className="text-[9px] text-slate-300">دعوة من المالك: <span className="font-extrabold text-indigo-300">{correspondingInvitation.owner_name}</span></p>
                                            </div>
                                          </div>
                                          <div className="flex gap-1.5 border-t border-white/10 pt-2">
                                            <button
                                              onClick={() => handleAcceptPrivateInvitation(correspondingInvitation)}
                                              className="flex-grow bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-[9px] font-black py-2 rounded-lg transition-all shadow-md active:scale-95 cursor-pointer text-center"
                                            >
                                              موافق (انضمام)
                                            </button>
                                            <button
                                              onClick={() => handleRejectPrivateInvitation(correspondingInvitation)}
                                              className="flex-grow bg-white/5 hover:bg-white/10 text-slate-300 text-[9px] font-bold py-2 rounded-lg transition-all border border-white/10 active:scale-95 cursor-pointer text-center"
                                            >
                                              رفض الطلب
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="mt-1 text-[9px] text-slate-400 font-bold bg-white/5 border border-white/10 rounded-xl p-2 text-center" dir="rtl">
                                          <span>تم الرد على هذه الدعوة وحذفها بنجاح.</span>
                                        </div>
                                      )
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Input area */}
                  <div className="p-4 bg-[#120D23]/95 backdrop-blur-lg border-t border-purple-500/20 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] pb-safe">
                    <div className="flex items-end gap-2 bg-[#1A1430] p-1.5 rounded-2xl border border-white/10 focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/30 transition-all">
                      <input
                        type="text"
                        value={newPrivateMessageInput}
                        onChange={(e) => setNewPrivateMessageInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newPrivateMessageInput.trim()) {
                            handleSendPrivateMessage();
                          }
                        }}
                        className="flex-grow bg-transparent text-slate-200 text-sm text-right outline-none px-3 py-2 font-sans placeholder-slate-500"
                        placeholder="رسالتك المشفرة هنا..."
                      />
                      <button
                        onClick={() => {
                          if (newPrivateMessageInput.trim()) {
                            handleSendPrivateMessage();
                          }
                        }}
                        className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl transition-all ${
                          newPrivateMessageInput.trim() 
                            ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' 
                            : 'bg-white/5 text-slate-500'
                        } cursor-pointer`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform rotate-180" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                </div>
              )}
              {/* SUPPORT ADMIN MODAL */}
              {isSupportAdminModalOpen && (
                <>
                  <div 
                    className="absolute inset-0 bg-black/60 z-40 animate-fade-in cursor-pointer"
                    onClick={() => setIsSupportAdminModalOpen(false)}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-white border-t border-amber-500/40 rounded-t-[32px] z-50 animate-fade-in shadow-2xl text-right font-sans h-[90%] flex flex-col overflow-hidden">
                    <div className="flex justify-between items-center border-b border-slate-100 p-5 bg-gradient-to-r from-amber-50 to-yellow-50">
                      <button
                        onClick={() => {
                          if (activeAdminTicket) {
                            setActiveAdminTicket(null);
                          } else {
                            setIsSupportAdminModalOpen(false);
                          }
                        }}
                        className="text-xs text-slate-500 hover:text-slate-800 bg-white px-3.5 py-1.5 rounded-full border border-slate-200 cursor-pointer font-black transition"
                      >
                        {activeAdminTicket ? 'رجوع' : 'إغلاق'}
                      </button>
                      <h4 className="text-sm font-black text-slate-800 flex items-center gap-1.5 font-sans">
                        <span>طلبات الدعم الفني</span>
                        <span>🛡️</span>
                      </h4>
                    </div>

                    {!activeAdminTicket ? (
                      <div className="flex-grow overflow-y-auto p-4 space-y-3">
                        {supportTickets.length === 0 ? (
                          <div className="text-center py-10 text-slate-400 font-bold text-xs">
                            لا توجد طلبات دعم فني مفتوحة حالياً
                          </div>
                        ) : (
                          supportTickets.map(ticket => (
                            <div 
                              key={ticket.id}
                              onClick={() => setActiveAdminTicket(ticket)}
                              className="bg-white border border-slate-200 p-3 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-slate-50 transition shadow-sm"
                            >
                              <div className="text-left text-xs font-bold text-amber-500">
                                رد على الطلب ➤
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <div className="font-bold text-xs text-slate-800">{ticket.userName}</div>
                                  <div className="text-[10px] text-slate-500">{new Date(ticket.updatedAt).toLocaleString('ar-EG')}</div>
                                </div>
                                <img src={ticket.userAvatar} alt="user" className="w-10 h-10 rounded-full border-2 border-amber-100 object-cover" />
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    ) : (
                      <div className="flex-grow flex flex-col h-full overflow-hidden">
                        <div className="bg-amber-100 text-amber-800 p-2 text-center text-[10px] font-bold">
                          أنت ترد كـ "دعم صدى الفني 🐱"
                        </div>
                        <div className="flex-grow overflow-y-auto p-4 space-y-3 bg-[#FAF6EB]">
                          {activeTicketMessages.map((msg, idx) => (
                            <div 
                              key={idx} 
                              className={`flex ${msg.isAdmin ? 'justify-end' : 'justify-start'} text-right`}
                            >
                              <div className={`p-3 rounded-2xl text-xs max-w-[80%] shadow-sm ${
                                msg.isAdmin 
                                  ? 'bg-white text-[#4A3E3D] rounded-tl-none border border-[#E8DCC4]/60'
                                  : 'bg-[#FFAE42] text-white rounded-tr-none'
                              }`}>
                                <span className="block font-bold text-[8px] opacity-75 mb-1">{msg.senderName}</span>
                                <p className="leading-relaxed">{msg.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="p-3 bg-white border-t border-[#E8DCC4]/60 flex gap-2">
                          <input
                            type="text"
                            placeholder="اكتب ردك للعميل..."
                            value={adminSupportInput}
                            onChange={(e) => setAdminSupportInput(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter' && adminSupportInput.trim()) {
                                const uText = adminSupportInput.trim();
                                setAdminSupportInput('');
                                try {
                                  // Update ticket updatedAt
                                  await updateDoc(doc(db, "support_tickets", activeAdminTicket.id), {
                                    updatedAt: new Date().toISOString()
                                  });
                                  
                                  // Add message
                                  const newMsgRef = doc(collection(db, "support_tickets", activeAdminTicket.id, "messages"));
                                  await setDoc(newMsgRef, {
                                    senderId: 'admin',
                                    senderName: 'دعم صدى الفني 🐱',
                                    text: uText,
                                    timestamp: new Date().toISOString(),
                                    isAdmin: true
                                  });
                                } catch(err) {
                                  console.error("Error sending admin support reply", err);
                                }
                              }
                            }}
                            className="flex-grow bg-slate-50 border border-[#E8DCC4] rounded-full px-4 py-1.5 text-xs text-right focus:outline-none focus:border-[#FFAE42]"
                          />
                          <button
                            onClick={async () => {
                              if (adminSupportInput.trim()) {
                                const uText = adminSupportInput.trim();
                                setAdminSupportInput('');
                                try {
                                  await updateDoc(doc(db, "support_tickets", activeAdminTicket.id), {
                                    updatedAt: new Date().toISOString()
                                  });
                                  const newMsgRef = doc(collection(db, "support_tickets", activeAdminTicket.id, "messages"));
                                  await setDoc(newMsgRef, {
                                    senderId: 'admin',
                                    senderName: 'دعم صدى الفني 🐱',
                                    text: uText,
                                    timestamp: new Date().toISOString(),
                                    isAdmin: true
                                  });
                                } catch(err: any) {
                                  console.error("Error sending admin support reply", err);
                                  alert("حدث خطأ في النظام. يرجى التأكد من اتصالك وإعادة المحاولة.");
                                }
                              }
                            }}
                            className="bg-[#FFAE42] text-white p-2 rounded-full hover:bg-amber-500 active:scale-95 transition flex items-center justify-center cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="p-2 border-t border-slate-100 flex justify-center bg-white">
                          <button
                             onClick={async () => {
                               if (window.confirm('هل تريد إغلاق هذا الطلب؟')) {
                                 try {
                                   await updateDoc(doc(db, "support_tickets", activeAdminTicket.id), {
                                     status: 'closed',
                                     updatedAt: new Date().toISOString()
                                   });
                                   setActiveAdminTicket(null);
                                 } catch(err: any) {
                                   console.error("Error closing ticket:", err);
                                   alert("حدث خطأ في النظام. يرجى التأكد من اتصالك وإعادة المحاولة.");
                                 }
                               }
                             }}
                             className="text-red-500 font-bold text-xs py-1 px-3 bg-red-50 rounded-full hover:bg-red-100"
                           >
                             إغلاق تذكرة الدعم
                           </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* SYSTEM ADMIN MANAGEMENT MODAL */}
              {isAdminManageModalOpen && (
                <>
                  <div
                    className="absolute inset-0 bg-black/60 z-40 animate-fade-in cursor-pointer"
                    onClick={() => setIsAdminManageModalOpen(false)}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-white border-t border-red-500/40 rounded-t-[32px] p-5 z-50 animate-fade-in shadow-2xl text-right font-sans max-h-[85%] overflow-y-auto">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                      <button
                        onClick={() => setIsAdminManageModalOpen(false)}
                        className="text-xs text-slate-500 hover:text-slate-800 bg-slate-100 px-3.5 py-1.5 rounded-full border border-slate-200 cursor-pointer font-black transition"
                      >
                        إغلاق
                      </button>
                      <h4 className="text-sm font-black text-slate-800 flex items-center gap-1.5 font-sans">
                        <span>لوحة الإدارة العليا 👑</span>
                      </h4>
                    </div>

                    {/* Admin Sub-Tabs */}
                    <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1 border border-slate-200/60 mb-5 text-right" dir="rtl">
                      <button
                        onClick={() => setAdminActiveTab('agents')}
                        className={`flex-1 py-2.5 rounded-xl font-black text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          adminActiveTab === 'agents'
                            ? 'bg-gradient-to-l from-red-500 to-amber-500 text-white shadow-md font-black'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                        }`}
                      >
                        <span>👑</span>
                        <span>إدارة الوكلاء والسلع</span>
                      </button>
                      <button
                        onClick={() => setAdminActiveTab('salaries')}
                        className={`flex-1 py-2.5 rounded-xl font-black text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          adminActiveTab === 'salaries'
                            ? 'bg-gradient-to-l from-emerald-600 to-teal-500 text-white shadow-md font-black'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                        }`}
                      >
                        <span>💵</span>
                        <span>الرواتب</span>
                      </button>
                    </div>

                    <div className="space-y-6">
                      {adminActiveTab === 'agents' && (
                        <>
                          {/* AGENCY MANAGEMENT MODULE */}
                      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-3xl p-4 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-5 text-8xl pointer-events-none">🏢</div>
                        
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-xl">🏢</span>
                          <h3 className="text-sm font-black text-indigo-900">إدارة الوكالات</h3>
                        </div>
                        
                        <div className="space-y-3 relative z-10">
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Target User displayId (الآيدي المستهدف)"
                              value={adminAgencyTargetId}
                              onChange={(e) => setAdminAgencyTargetId(e.target.value)}
                              className="w-full bg-white border border-indigo-200 text-slate-800 rounded-xl px-4 py-2.5 text-xs text-right outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition"
                            />
                            {adminAgencySearching && (
                              <span className="absolute left-3 top-2.5 text-[10px] text-indigo-500 animate-pulse font-sans">جاري البحث...</span>
                            )}
                          </div>

                          {adminAgencyFoundUser && (
                            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 flex items-center justify-between text-right animate-fade-in" dir="rtl">
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={adminAgencyFoundUser.avatar || "https://api.dicebear.com/7.x/bottts/svg"}
                                  alt=""
                                  className="w-9 h-9 rounded-full object-cover border border-emerald-200/60 bg-white"
                                  referrerPolicy="no-referrer"
                                />
                                <div>
                                  <p className="text-[11px] font-black text-emerald-950">{adminAgencyFoundUser.name}</p>
                                  <p className="text-[9px] text-emerald-700 font-bold">مستوى {adminAgencyFoundUser.level || 1} • آيدي: {adminAgencyFoundUser.displayId || adminAgencyFoundUser.id}</p>
                                </div>
                              </div>
                              <span className="bg-emerald-500 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-full shadow-sm">✓ تم الربط تلقائياً</span>
                            </div>
                          )}

                          <input
                            type="text"
                            placeholder="اسم صاحب الوكالة"
                            value={adminAgencyOwnerName}
                            onChange={(e) => setAdminAgencyOwnerName(e.target.value)}
                            className="w-full bg-white border border-indigo-200 text-slate-800 rounded-xl px-4 py-2.5 text-xs text-right outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition"
                          />
                          <input
                            type="text"
                            placeholder="اسم الوكالة"
                            value={adminAgencyName}
                            onChange={(e) => setAdminAgencyName(e.target.value)}
                            className="w-full bg-white border border-indigo-200 text-slate-800 rounded-xl px-4 py-2.5 text-xs text-right outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition"
                          />
                          <input
                            type="text"
                            placeholder="رقم الواتساب"
                            value={adminAgencyWhatsApp}
                            onChange={(e) => setAdminAgencyWhatsApp(e.target.value)}
                            className="w-full bg-white border border-indigo-200 text-slate-800 rounded-xl px-4 py-2.5 text-xs text-right outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition"
                          />
                          <button
                            onClick={async () => {
                              if (!adminAgencyTargetId || !adminAgencyOwnerName || !adminAgencyName || !adminAgencyWhatsApp) {
                                alert("الرجاء تعبئة جميع الحقول المطلوبة");
                                return;
                              }
                              
                              // 1. Direct Firestore lookup to avoid local array limit (limit is 100, which causes lookup failure for users beyond the first 100)
                              let targetUser = null;
                              try {
                                const qDisplay = query(collection(db, 'users'), where('displayId', '==', adminAgencyTargetId));
                                const qSnap = await getDocs(qDisplay);
                                if (!qSnap.empty) {
                                  const docSnap = qSnap.docs[0];
                                  targetUser = { id: docSnap.id, ...docSnap.data() };
                                } else {
                                  const qOrig = query(collection(db, 'users'), where('originalDisplayId', '==', adminAgencyTargetId));
                                  const qSnapOrig = await getDocs(qOrig);
                                  if (!qSnapOrig.empty) {
                                    const docSnapOrig = qSnapOrig.docs[0];
                                    targetUser = { id: docSnapOrig.id, ...docSnapOrig.data() };
                                  }
                                }
                              } catch (err) {
                                console.error("Error finding user in Firestore:", err);
                              }

                              // Fallback to local users state
                              if (!targetUser) {
                                targetUser = users?.find(u => (u.displayId === adminAgencyTargetId || u.originalDisplayId === adminAgencyTargetId));
                              }

                              if (!targetUser) {
                                alert("لم يتم العثور على مستخدم بهذا الآيدي");
                                return;
                              }
                              
                                try {
                                  const generatedAgencyId = await saveAgencyData(
                                    targetUser.id,
                                    targetUser.displayId || adminAgencyTargetId,
                                    adminAgencyName,
                                    adminAgencyOwnerName,
                                    adminAgencyWhatsApp
                                  );
                                
                                setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, role: 'agency_owner' } : u));

                                setAdminAgencySuccessData({
                                  name: adminAgencyName,
                                  id: generatedAgencyId
                                });
                                
                                setAdminAgencyTargetId('');
                                setAdminAgencyOwnerName('');
                                setAdminAgencyName('');
                                setAdminAgencyWhatsApp('');
                                
                              } catch (err) {
                                console.error(err);
                                alert("حدث خطأ أثناء إنشاء الوكالة");
                              }
                            }}
                            className="w-full bg-gradient-to-l from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black text-xs py-3 rounded-xl shadow-md active:scale-95 transition mb-4"
                          >
                            إعطاء وكالة لهذا الآيدي
                          </button>

                          <hr className="border-indigo-100 my-4" />
                          
                          {/* Search & List of existing agencies */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-black text-indigo-950 flex items-center gap-1.5 justify-end">
                              <span>قائمة الوكالات المعتمدة ({allAgencies.length})</span>
                              <span>🏢</span>
                            </h4>
                            <input
                              type="text"
                              placeholder="ابحث باسم الوكالة، اسم المالك، أو الآيدي..."
                              value={adminAgencySearchQuery}
                              onChange={(e) => setAdminAgencySearchQuery(e.target.value)}
                              className="w-full bg-white border border-indigo-200 text-slate-800 rounded-xl px-4 py-2.5 text-xs text-right outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition"
                            />
                            
                            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                              {allAgencies
                                .filter(agency => {
                                  if (!adminAgencySearchQuery.trim()) return true;
                                  const queryText = adminAgencySearchQuery.toLowerCase();
                                  return (
                                    (agency.agency_name || '').toLowerCase().includes(queryText) ||
                                    (agency.owner_name || '').toLowerCase().includes(queryText) ||
                                    (agency.owner_id || '').toLowerCase().includes(queryText) ||
                                    (agency.display_id || '').toLowerCase().includes(queryText) ||
                                    (agency.agency_id || '').toLowerCase().includes(queryText)
                                  );
                                })
                                .map((agency) => (
                                  <div key={agency.id} className="bg-white/80 border border-indigo-100 rounded-2xl p-3 text-right flex flex-col space-y-2 shadow-sm">
                                    <div className="flex justify-between items-start">
                                      {deletingAgencyId === agency.id ? (
                                        <div className="flex items-center gap-1">
                                          <button
                                            disabled={isDeletingAgency}
                                            onClick={() => handleDeleteAgency(agency.id, agency.owner_id, agency.agency_name)}
                                            className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg transition cursor-pointer active:scale-95 disabled:opacity-50"
                                          >
                                            {isDeletingAgency ? "جاري..." : "تأكيد"}
                                          </button>
                                          <button
                                            disabled={isDeletingAgency}
                                            onClick={() => setDeletingAgencyId(null)}
                                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black px-2.5 py-1.5 rounded-lg border border-slate-200 transition cursor-pointer active:scale-95 disabled:opacity-50"
                                          >
                                            إلغاء
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => setDeletingAgencyId(agency.id)}
                                          className="bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-black px-2.5 py-1.5 rounded-lg border border-red-200/50 transition cursor-pointer active:scale-95"
                                        >
                                          🗑️ حذف الوكالة
                                        </button>
                                      )}
                                      <div className="text-right">
                                        <h5 className="text-[11px] font-black text-indigo-950">وكالة: {agency.agency_name}</h5>
                                        <p className="text-[9px] text-slate-500">المالك: <span className="font-bold text-indigo-700">{agency.owner_name}</span> (ID: <span className="font-mono">{agency.display_id || agency.owner_id?.slice(0, 6)}</span>)</p>
                                      </div>
                                    </div>
                                    <div className="flex justify-between items-center text-[9px] text-slate-400 border-t border-indigo-50/50 pt-1.5" dir="rtl">
                                      <span>ID الوكالة: <span className="font-bold text-slate-600 font-mono">{agency.display_id || agency.agency_id || agency.id?.slice(0, 8)}</span></span>
                                      <span>الواتساب: <span className="font-bold text-slate-600 font-mono">{agency.whatsapp_number || agency.whatsapp || 'غير متوفر'}</span></span>
                                    </div>
                                  </div>
                                ))}
                              {allAgencies.length === 0 && (
                                <p className="text-center text-[10px] text-slate-400 py-4">لا توجد وكالات مسجلة حالياً.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <hr className="border-slate-200 border-dashed" />

                      {/* AUTHORIZED COIN AGENT MANAGEMENT MODULE */}
                      <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-emerald-100 rounded-3xl p-4 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-5 text-8xl pointer-events-none">💼</div>
                        
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-xl">💼</span>
                          <h3 className="text-sm font-black text-emerald-900">إدارة وكلاء الشحن المعتمدين</h3>
                        </div>
                        
                        <div className="space-y-3 relative z-10">
                          <input
                            type="text"
                            placeholder="Target User displayId (الآيدي المستهدف)"
                            value={adminCoinAgentTargetId}
                            onChange={(e) => setAdminCoinAgentTargetId(e.target.value)}
                            className="w-full bg-white border border-emerald-200 text-slate-800 rounded-xl px-4 py-2.5 text-xs text-right outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition"
                          />
                          <input
                            type="text"
                            placeholder="الاسم الحقيقي للوكيل"
                            value={adminCoinAgentName}
                            onChange={(e) => setAdminCoinAgentName(e.target.value)}
                            className="w-full bg-white border border-emerald-200 text-slate-800 rounded-xl px-4 py-2.5 text-xs text-right outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition"
                          />
                          <input
                            type="number"
                            placeholder="رصيد الكوينز المبدئي"
                            value={adminCoinAgentInitialStock}
                            onChange={(e) => setAdminCoinAgentInitialStock(e.target.value)}
                            className="w-full bg-white border border-emerald-200 text-slate-800 rounded-xl px-4 py-2.5 text-xs text-right font-mono outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition"
                          />
                          <button
                            onClick={async () => {
                              if (!adminCoinAgentTargetId || !adminCoinAgentName || !adminCoinAgentInitialStock) {
                                alert("الرجاء تعبئة جميع الحقول المطلوبة");
                                return;
                              }
                              const amount = parseInt(adminCoinAgentInitialStock, 10);
                              if (isNaN(amount) || amount <= 0) {
                                alert("الرجاء إدخال رصيد صحيح");
                                return;
                              }
                              
                              const targetUser = users?.find(u => (u.displayId === adminCoinAgentTargetId || u.originalDisplayId === adminCoinAgentTargetId));
                              if (!targetUser) {
                                alert("لم يتم العثور على مستخدم بهذا الآيدي");
                                return;
                              }
                              
                              try {
                                const newInventory = (targetUser.agent_coin_inventory || 0) + amount;
                                await updateAuthorizedCoinAgent(targetUser.id, newInventory);
                                await setDoc(doc(db, "agents_hub", targetUser.id), {
                                  agent_id: targetUser.displayId || targetUser.id,
                                  agent_name: adminCoinAgentName,
                                  contact_whatsapp: targetUser.whatsapp || targetUser.phone || '+201000000000',
                                  avatar: targetUser.avatar || '',
                                  is_active: true
                                }, { merge: true });
                                
                                setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, role: 'authorized_coin_agent', isAgent: true, agent_coin_inventory: newInventory } : u));
                                
                                setAdminCoinAgentSuccessData({
                                  name: adminCoinAgentName,
                                  coins: amount.toLocaleString()
                                });
                                
                                setAdminCoinAgentTargetId('');
                                setAdminCoinAgentName('');
                                setAdminCoinAgentInitialStock('');
                                
                              } catch (err) {
                                console.error(err);
                                alert("حدث خطأ أثناء منح الصلاحية");
                              }
                            }}
                            className="w-full bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs py-3 rounded-xl shadow-md active:scale-95 transition"
                          >
                            منح صلاحية وكيل معتمد وتعبئة الرصيد
                          </button>
                        </div>
                      </div>

                      <hr className="border-slate-200 border-dashed" />

                      <div className="bg-red-50 p-3 rounded-2xl border border-red-100 text-center">
                        <span className="text-3xl block mb-1">⚡</span>
                        <h3 className="text-xs font-black text-red-600">إدارة الوكلاء والأرصدة</h3>
                        <p className="text-[10px] text-red-500/80 mt-1">
                          يمكنك من هنا تفعيل صلاحية الوكيل وشحن رصيده من الكوينز ليتمكن من تحويله للمستخدمين الآخرين.
                        </p>
                      </div>

                      {/* Search Bar */}
                      <div className="relative">
                        <input
                          type="text"
                          value={adminManageSearchQuery}
                          onChange={(e) => setAdminManageSearchQuery(e.target.value)}
                          placeholder="ابحث عن اسم مستخدم أو ID..."
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-2.5 text-xs text-right outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 transition"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                      </div>

                      {/* User List */}
                      <div className="space-y-2 mt-4">
                        {users
                          .filter(u => 
                            u.name.toLowerCase().includes(adminManageSearchQuery.toLowerCase()) || 
                            (u.displayId && u.displayId.includes(adminManageSearchQuery)) ||
                            u.id.includes(adminManageSearchQuery)
                          )
                          .map(userItem => (
                          <div key={userItem.id} className="bg-white border border-slate-200 p-3 rounded-xl flex flex-col gap-3 shadow-sm">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <img src={userItem.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=placeholder"} alt="avatar" className="w-10 h-10 rounded-lg object-cover border border-slate-100" />
                                <div className="text-right">
                                  <h4 className="text-xs font-black text-slate-800">{userItem.name}</h4>
                                  <span className="text-[9px] text-slate-400 font-mono block">ID: {userItem.displayId || userItem.id}</span>
                                  {userItem.displayIdExpiredAt && (
                                    <span className="text-[8px] text-purple-600 font-bold bg-purple-50 px-1.5 py-0.5 rounded-md inline-block mt-0.5 text-right">
                                      ⏳ مؤقت (ينتهي: {new Date(userItem.displayIdExpiredAt).toLocaleString('ar', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'})})
                                    </span>
                                  )}
                                  {userItem.isAgent && (
                                    <span className="inline-block mt-0.5 bg-amber-100 text-amber-600 text-[8px] font-bold px-1.5 py-0.5 rounded">
                                      وكيل معتمد ⚡ | رصيد: {userItem.coins || 0}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={async () => {
                                  try {
                                    await toggleUserAgentStatus(userItem.id, !userItem.isAgent);
                                    setUsers(prev => prev.map(u => u.id === userItem.id ? { ...u, isAgent: !userItem.isAgent } : u));
                                    if (currentUser && userItem.id === currentUser?.id) {
                                      setCurrentUser(prev => prev ? { ...prev, isAgent: !userItem.isAgent } : null);
                                    }
                                    alert(`تم ${!userItem.isAgent ? 'منح' : 'سحب'} صلاحية الوكيل بنجاح للمستخدم: ${userItem.name}`);
                                  } catch (e) {
                                    console.error("Error updating agent status", e);
                                    alert("حدث خطأ أثناء تعديل الصلاحيات.");
                                  }
                                }}
                                className={`text-[9px] font-black px-3 py-1.5 rounded-xl transition-colors border ${
                                  userItem.isAgent 
                                    ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' 
                                    : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                                }`}
                              >
                                {userItem.isAgent ? 'إزالة الصلاحية' : 'منح الصلاحية'}
                              </button>
                            </div>
                            
                            {/* Recharge Agent Form */}
                            {userItem.isAgent && (
                              <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                                <div className="flex gap-2 items-center">
                                  <input
                                    type="number"
                                    placeholder="كمية الكوينز..."
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-[10px] text-right outline-none focus:border-amber-400"
                                    value={adminRechargeAmounts[userItem.id] || ''}
                                    onChange={(e) => setAdminRechargeAmounts(prev => ({ ...prev, [userItem.id]: e.target.value }))}
                                  />
                                  <button
                                    onClick={async () => {
                                      const amount = adminRechargeAmounts[userItem.id];
                                      if (amount && !isNaN(Number(amount)) && Number(amount) > 0) {
                                        try {
                                          await rechargeAgentCoins(userItem.id, Number(amount));
                                          setUsers(prev => prev.map(u => u.id === userItem.id ? { ...u, agent_coin_inventory: (u.agent_coin_inventory || 0) + Number(amount) } : u));
                                          setAdminRechargeAmounts(prev => ({ ...prev, [userItem.id]: '' }));
                                          alert(`تم شحن ${amount} كوينز لحساب الوكيل بنجاح!`);
                                        } catch (e) {
                                          console.error("Error adding coins to agent", e);
                                          alert("حدث خطأ أثناء شحن الكوينز للوكيل.");
                                        }
                                      } else {
                                        alert("الرجاء إدخال قيمة صحيحة");
                                      }
                                    }}
                                    className="shrink-0 bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-black px-4 py-1.5 rounded-lg transition-colors flex justify-center items-center gap-1"
                                  >
                                    <span>💰</span> شحن
                                  </button>
                                </div>

                                <div className="flex gap-2 items-center">
                                  <input
                                    type="text"
                                    placeholder="رقم الواتساب مع نداء الدولة (مثال: 966500000000)..."
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-[10px] text-right outline-none focus:border-green-400 font-mono"
                                    value={adminAgentWhatsApps[userItem.id] !== undefined ? adminAgentWhatsApps[userItem.id] : (userItem.whatsapp || '')}
                                    onChange={(e) => setAdminAgentWhatsApps(prev => ({ ...prev, [userItem.id]: e.target.value }))}
                                  />
                                  <button
                                    onClick={async () => {
                                      const waNum = (adminAgentWhatsApps[userItem.id] !== undefined ? adminAgentWhatsApps[userItem.id] : (userItem.whatsapp || '')).trim();
                                      if (!waNum) {
                                        alert("الرجاء إدخال رقم الواتساب أولاً.");
                                        return;
                                      }
                                      try {
                                        let cleanNum = waNum.replace(/\D/g, ''); // Keep only digits
                                        
                                        // If starts with 00, strip the 00 to make it standard international format
                                        if (cleanNum.startsWith('00')) {
                                          cleanNum = cleanNum.slice(2);
                                        }

                                        // Check if it's a local number starting with single 0 (missing country code)
                                        if (cleanNum.startsWith('0') && !cleanNum.startsWith('00') && cleanNum.length <= 10) {
                                          alert("⚠️ تنبيه: يبدو أنك أدخلت رقماً محلياً يبدأ بـ 0. يرجى إدخال الرقم كاملاً مع نداء الدولة (مثال: 9665xxxxxxxx أو 9647xxxxxxxx) لكي يعمل الرابط بشكل صحيح.");
                                          return;
                                        }

                                        // Remove leading 0 after country code for common Arab codes
                                        const countryCodes = ['966', '964', '962', '971', '967', '963', '965', '973', '974', '968', '961', '970', '972', '20'];
                                        for (const code of countryCodes) {
                                          if (cleanNum.startsWith(code + '0')) {
                                            cleanNum = code + cleanNum.slice(code.length + 1);
                                            break;
                                          }
                                        }

                                        await updateUserWhatsapp(userItem.id, cleanNum);
                                        setUsers(prev => prev.map(u => u.id === userItem.id ? { ...u, whatsapp: cleanNum } : u));
                                        alert(`تم حفظ رقم الواتساب للوكيل بنجاح: ${cleanNum}`);
                                      } catch (e) {
                                        console.error("Error updating agent whatsapp", e);
                                        alert("حدث خطأ أثناء حفظ رقم الواتساب.");
                                      }
                                    }}
                                    className="shrink-0 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black px-3 py-1.5 rounded-lg transition-colors flex justify-center items-center gap-1"
                                  >
                                    <span>💬</span> حفظ الواتس
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Change Display ID Form */}
                            <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                              <div className="flex gap-2 items-center">
                                <input
                                  type="text"
                                  placeholder="تغيير الآيدي..."
                                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-[10px] text-right outline-none focus:border-purple-400"
                                  value={adminEditDisplayId[userItem.id] || ''}
                                  onChange={(e) => setAdminEditDisplayId(prev => ({ ...prev, [userItem.id]: e.target.value }))}
                                />
                                <button
                                  onClick={async () => {
                                    const newDisplayId = adminEditDisplayId[userItem.id]?.trim();
                                    if (newDisplayId) {
                                      try {
                                        // Check if ID is already taken
                                        const q = query(collection(db, "users"), where("displayId", "==", newDisplayId));
                                        const querySnapshot = await getDocs(q);
                                        if (!querySnapshot.empty) {
                                          alert("هذا الآيدي مستخدم بالفعل! اختر آيدي آخر.");
                                          return;
                                        }

                                        let expiredAt: string | null = null;
                                        const duration = adminEditDisplayIdDuration[userItem.id] || 'permanent';
                                        const now = new Date();

                                        if (duration === '1day') {
                                          now.setDate(now.getDate() + 1);
                                          expiredAt = now.toISOString();
                                        } else if (duration === '1week') {
                                          now.setDate(now.getDate() + 7);
                                          expiredAt = now.toISOString();
                                        } else if (duration === '2weeks') {
                                          now.setDate(now.getDate() + 14);
                                          expiredAt = now.toISOString();
                                        } else if (duration === '1month') {
                                          now.setMonth(now.getMonth() + 1);
                                          expiredAt = now.toISOString();
                                        }

                                        // Capture original automatic display ID if not already saved
                                        const originalIdToSave = userItem.originalDisplayId || userItem.displayId || "";

                                        await updateDoc(doc(db, "users", userItem.id), {
                                          displayId: newDisplayId,
                                          displayIdExpiredAt: expiredAt,
                                          originalDisplayId: originalIdToSave
                                        });

                                        setAdminEditDisplayId(prev => ({ ...prev, [userItem.id]: '' }));
                                        alert(`تم تغيير الآيدي بنجاح إلى: ${newDisplayId} ${duration !== 'permanent' ? `لمدة محددة` : `بشكل دائم`}`);
                                      } catch (e) {
                                        console.error("Error updating display ID", e);
                                        alert("حدث خطأ أثناء تعديل الآيدي.");
                                      }
                                    } else {
                                      alert("الرجاء إدخال آيدي صحيح.");
                                    }
                                  }}
                                  className="shrink-0 bg-purple-500 hover:bg-purple-600 text-white text-[10px] font-black px-4 py-1.5 rounded-lg transition-colors flex justify-center items-center gap-1"
                                >
                                  <span>🆔</span> تعيين
                                </button>

                              </div>

                              {/* Duration Selector */}
                              <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-100 p-1.5 rounded-lg">
                                <span className="text-[9px] text-slate-500 font-bold shrink-0">صلاحية المعرّف الجديد:</span>
                                <select
                                  className="bg-transparent text-slate-700 text-[10px] font-bold text-right outline-none cursor-pointer"
                                  value={adminEditDisplayIdDuration[userItem.id] || 'permanent'}
                                  onChange={(e) => setAdminEditDisplayIdDuration(prev => ({ ...prev, [userItem.id]: e.target.value }))}
                                >
                                  <option value="permanent">دائم (بدون انتهاء)</option>
                                  <option value="1day">يوم واحد (24 ساعة)</option>
                                  <option value="1week">أسبوع واحد (7 أيام)</option>
                                  <option value="2weeks">أسبوعين (14 يوم)</option>
                                  <option value="1month">شهر واحد (30 يوم)</option>
                                </select>
                              </div>
                              <button
                                onClick={async () => {
                                  try {
                                    let targetId = userItem.originalDisplayId;
                                    if (!targetId) {
                                      // Generate a new sequential display ID
                                      targetId = await getNextDisplayId();
                                    }

                                    await updateDoc(doc(db, "users", userItem.id), {
                                      displayId: targetId,
                                      originalDisplayId: targetId,
                                      displayIdExpiredAt: null
                                    });
                                    alert(`تم استرجاع الآيدي الأصلي للمستخدم بنجاح: ${targetId}`);
                                  } catch (e) {
                                    console.error("Error restoring display ID", e);
                                    alert("حدث خطأ أثناء استرجاع الآيدي.");
                                  }
                                }}
                                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 text-[10px] font-black py-1.5 rounded-lg transition-colors flex justify-center items-center gap-1"
                              >
                                <span>🔄</span> استرجاع الآيدي الأصلي التلقائي للمستخدم
                              </button>
                            </div>

                          </div>
                        ))}
                        {users.filter(u => u.name.toLowerCase().includes(adminManageSearchQuery.toLowerCase()) || (u.displayId && u.displayId.includes(adminManageSearchQuery)) || u.id.includes(adminManageSearchQuery)).length === 0 && (
                          <div className="text-center py-6">
                            <span className="text-2xl opacity-50 block mb-1">👻</span>
                            <p className="text-[10px] text-slate-400">لا يوجد نتائج للبحث</p>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {adminActiveTab === 'salaries' && (() => {
                    const resolvedRequests = adminWithdrawalRequests.map(req => {
                      const reqAgencyId = req.agencyId || users?.find(u => u.id === req.userId)?.agencyId || null;
                      const reqAgencyName = req.agencyName || users?.find(u => u.id === req.userId)?.agencyName || null;
                      const reqAgencyOwner = users?.find(u => u.id === reqAgencyId);
                      const reqAgencyDisplayId = req.agencyDisplayId || reqAgencyOwner?.displayId || null;
                      return {
                        ...req,
                        resolvedAgencyId: reqAgencyId,
                        resolvedAgencyName: reqAgencyName,
                        resolvedAgencyDisplayId: reqAgencyDisplayId
                      };
                    });

                    const filteredRequests = resolvedRequests.filter(req => {
                      const q = adminSalariesSearchQuery.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        (req.userDisplayId && req.userDisplayId.toLowerCase().includes(q)) ||
                        (req.userId && req.userId.toLowerCase().includes(q)) ||
                        (req.resolvedAgencyDisplayId && req.resolvedAgencyDisplayId.toLowerCase().includes(q)) ||
                        (req.resolvedAgencyId && req.resolvedAgencyId.toLowerCase().includes(q)) ||
                        (req.resolvedAgencyName && req.resolvedAgencyName.toLowerCase().includes(q))
                      );
                    });

                    const totalDiamonds = filteredRequests.reduce((sum, r) => sum + (r.diamonds_deducted || 0), 0);
                    const totalUSD = filteredRequests.reduce((sum, r) => sum + (r.withdrawal_usd || 0), 0);
                    const totalPlatformUSD = filteredRequests.reduce((sum, r) => sum + (r.platform_revenue_usd || 0), 0);

                    return (
                      <div className="space-y-5 animate-fade-in font-sans" dir="rtl">
                        {/* Admin Salaries Toast notification */}
                        {adminSalariesToast && (
                          <div className={`p-4 rounded-xl text-center text-xs font-black animate-fade-in border shadow-md flex items-center justify-center gap-2 ${
                            adminSalariesToast.type === 'success' 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-emerald-100/20' 
                              : 'bg-rose-50 border-rose-200 text-rose-800 shadow-rose-100/20'
                          }`}>
                            <span>{adminSalariesToast.type === 'success' ? '✅' : '⚠️'}</span>
                            <span>{adminSalariesToast.message}</span>
                          </div>
                        )}

                        {/* Search bar specifically for host salaries by ID or Agency ID */}
                        <div className="relative">
                          <input
                            type="text"
                            value={adminSalariesSearchQuery}
                            onChange={(e) => setAdminSalariesSearchQuery(e.target.value)}
                            placeholder="ابحث بالآيدي الشخصي، اسم الوكالة، أو آيدي الوكالة..."
                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-2.5 text-xs text-right outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition font-sans"
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                        </div>

                        {/* Accumulated statistics summary of filtered records */}
                        <div className="bg-gradient-to-l from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-4 grid grid-cols-3 gap-3 text-right">
                          <div className="border-l border-slate-200/50 pl-2">
                            <span className="text-[9px] text-slate-500 block font-bold">إجمالي الألماس (التاركت):</span>
                            <span className="text-xs font-black text-pink-600 font-mono">
                              {totalDiamonds.toLocaleString()} 💎
                            </span>
                          </div>
                          <div className="border-l border-slate-200/50 pl-2">
                            <span className="text-[9px] text-slate-500 block font-bold">مستحق المضيفين (70%):</span>
                            <span className="text-xs font-black text-emerald-600 font-mono">
                              ${totalUSD.toFixed(2)} USD
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 block font-bold">عمولة المنصة (30%):</span>
                            <span className="text-xs font-black text-indigo-600 font-mono">
                              ${totalPlatformUSD.toFixed(2)} USD
                            </span>
                          </div>
                        </div>

                        {/* List of pending requests */}
                        <div className="space-y-3">
                          {filteredRequests.length === 0 ? (
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-8 text-center text-slate-400 text-xs">
                              <span className="text-3xl block mb-2">📋</span>
                              لا توجد نتائج مطابقة لعملية البحث حالياً.
                            </div>
                          ) : (
                            filteredRequests.map((req) => (
                              <div key={req.id} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-4 shadow-sm relative">
                                {/* Info header */}
                                <div className="flex justify-between items-start border-b border-slate-200/50 pb-2.5">
                                  <div className="text-right">
                                    <h4 className="text-xs font-black text-slate-800">{req.userName || 'مضيف غير معروف'}</h4>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                                      <p className="text-[10px] text-slate-400">
                                        الآيدي: <span className="font-mono font-bold text-amber-600">{req.userDisplayId || req.userId}</span>
                                      </p>
                                      {req.isAgencyPayout ? (
                                        <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-md">
                                          طلب سحب رصيد الوكالة: {req.agencyName}
                                        </span>
                                      ) : (
                                        req.resolvedAgencyId && (
                                          <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[9px] font-black px-2 py-0.5 rounded-md">
                                            الوكالة: {req.resolvedAgencyName || 'بدون اسم'} ({req.resolvedAgencyDisplayId || req.resolvedAgencyId.slice(0, 6)})
                                          </span>
                                        )
                                      )}
                                    </div>
                                  </div>
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${req.isAgencyPayout ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-700'}`}>
                                    {req.isAgencyPayout ? 'طلب سحب وكالة' : 'طلب سحب مضيف'}
                                  </span>
                                </div>

                                {/* Financial Ledger details */}
                                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600">
                                  <div className="bg-white border border-slate-100 p-2 rounded-xl text-right">
                                    <span className="text-slate-400 block mb-0.5">{req.isAgencyPayout ? 'الألماس المسحوب من الوكالة:' : 'الألماس المسحوب (التاركت):'}</span>
                                    <span className="font-mono font-black text-pink-500 text-xs">
                                      {req.diamonds_deducted?.toLocaleString()} 💎
                                    </span>
                                  </div>
                                  <div className="bg-white border border-slate-100 p-2 rounded-xl text-right">
                                    <span className="text-slate-400 block mb-0.5">المستحق للدفع:</span>
                                    <span className="font-mono font-black text-emerald-600 text-xs">
                                      ${req.withdrawal_usd?.toFixed(2)} USD
                                    </span>
                                  </div>
                                  {!req.isAgencyPayout && (
                                    <div className="bg-white border border-slate-100 p-2 rounded-xl text-right">
                                      <span className="text-slate-400 block mb-0.5">عمولة المنصة (30%):</span>
                                      <span className="font-mono font-black text-indigo-500 text-xs">
                                        ${req.platform_revenue_usd?.toFixed(2)} USD
                                      </span>
                                    </div>
                                  )}
                                  <div className="bg-white border border-slate-100 p-2 rounded-xl text-right">
                                    <span className="text-slate-400 block mb-0.5">تاريخ الطلب:</span>
                                    <span className="font-mono text-slate-500 text-[9px]">
                                      {req.created_at ? new Date(req.created_at).toLocaleDateString('ar-EG', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : 'غير محدد'}
                                    </span>
                                  </div>
                                </div>

                                    {/* Action buttons with inline confirmation states */}
                                    {(!confirmingAction || confirmingAction.reqId !== req.id) ? (
                                      <div className="flex gap-2 pt-1 animate-fade-in">
                                        <button
                                          onClick={() => setConfirmingAction({ reqId: req.id, type: 'approve' })}
                                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-black py-2.5 rounded-xl transition duration-150 cursor-pointer text-center shadow-md shadow-emerald-600/15"
                                        >
                                          موافقة وإتمام الدفع
                                        </button>
                                        <button
                                          onClick={() => setConfirmingAction({ reqId: req.id, type: 'reject' })}
                                          className="flex-1 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 active:scale-[0.98] text-xs font-black py-2.5 rounded-xl transition duration-150 cursor-pointer text-center"
                                        >
                                          رفض الطلب
                                        </button>
                                      </div>
                                    ) : confirmingAction.type === 'approve' ? (
                                      <div className="bg-emerald-50 border border-emerald-200/60 rounded-xl p-3 space-y-3 animate-fade-in">
                                        <p className="text-[11px] font-bold text-emerald-800 text-right leading-relaxed">
                                          ⚠️ هل أنت متأكد من الموافقة وتسجيل تسليم {req.isAgencyPayout ? 'أرباح الوكالة' : 'راتب'} بقيمة <span className="font-mono font-black">${req.withdrawal_usd?.toFixed(2)}</span> يدوياً لـ {req.isAgencyPayout ? 'رئيس الوكالة' : 'المضيف'}؟
                                        </p>
                                        <div className="flex gap-2">
                                          <button
                                            onClick={async () => {
                                              try {
                                                let agencyRef = null;
                                                let currentAgencyDiamonds = 0;
                                                if (req.agencyId && !req.isAgencyPayout) {
                                                  let agencyDocSnap = await getDoc(doc(db, "agencies", req.agencyId));
                                                  if (agencyDocSnap.exists()) {
                                                    agencyRef = doc(db, "agencies", req.agencyId);
                                                    currentAgencyDiamonds = agencyDocSnap.data().diamonds || 0;
                                                  } else {
                                                    const q = query(collection(db, "agencies"), where("owner_id", "==", req.agencyId));
                                                    const snap = await getDocs(q);
                                                    if (!snap.empty) {
                                                      agencyRef = doc(db, "agencies", snap.docs[0].id);
                                                      currentAgencyDiamonds = snap.docs[0].data().diamonds || 0;
                                                    }
                                                  }
                                                }

                                                const userRef = doc(db, "users", req.userId);
                                                const reqRef = doc(db, "withdrawal_requests", req.id);
                                                
                                                const userSnap = await getDoc(userRef);
                                                if (!userSnap.exists()) {
                                                  throw new Error("User does not exist!");
                                                }
                                                
                                                const userData = userSnap.data();
                                                const currentLocked = userData.lockedDiamonds || 0;
                                                const nextLocked = Math.max(0, currentLocked - req.diamonds_deducted);
                                                
                                                const batch = writeBatch(db);
                                                if (!req.isAgencyPayout) {
                                                  batch.update(userRef, {
                                                    lockedDiamonds: nextLocked
                                                  });
                                                }
                                                
                                                batch.update(reqRef, {
                                                  status: 'approved',
                                                  approved_at: new Date().toISOString(),
                                                  commission_logged_usd: req.platform_revenue_usd || 0
                                                });

                                                // Credit 10% commission to the agency document (only for normal host withdrawals)
                                                if (agencyRef && !req.isAgencyPayout) {
                                                  const commissionDiamonds = Math.floor(req.diamonds_deducted * 0.15); // 15% commission of host's diamonds
                                                  batch.update(agencyRef, {
                                                    diamonds: currentAgencyDiamonds + commissionDiamonds
                                                  });
                                                }

                                                await batch.commit();
                                                
                                                setAdminSalariesToast({
                                                  message: "تمت الموافقة وتوثيق تحويل الراتب بنجاح",
                                                  type: 'success'
                                                });
                                                setConfirmingAction(null);
                                                setTimeout(() => setAdminSalariesToast(null), 5000);
                                              } catch (err) {
                                                console.error("Error approving withdrawal:", err);
                                                setAdminSalariesToast({
                                                  message: "حدث خطأ أثناء معالجة الطلب.",
                                                  type: 'error'
                                                });
                                                setConfirmingAction(null);
                                                setTimeout(() => setAdminSalariesToast(null), 5000);
                                              }
                                            }}
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-[11px] font-black py-2 rounded-lg transition"
                                          >
                                            تأكيد الموافقة والدفع
                                          </button>
                                          <button
                                            onClick={() => setConfirmingAction(null)}
                                            className="px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold py-2 rounded-lg transition"
                                          >
                                            إلغاء
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="bg-rose-50 border border-rose-200/60 rounded-xl p-3 space-y-3 animate-fade-in">
                                        <p className="text-[11px] font-bold text-rose-800 text-right leading-relaxed">
                                          ⚠️ هل أنت متأكد من رفض هذا الطلب وإعادة قيمة الألماس بالكامل <span className="font-mono font-black">({req.diamonds_deducted?.toLocaleString()} 💎)</span> لـ {req.isAgencyPayout ? 'رصيد الوكالة' : 'محفظة المضيف'}؟
                                        </p>
                                        <div className="flex gap-2">
                                          <button
                                            onClick={async () => {
                                              try {
                                                let agencyRef = null;
                                                let currentAgencyDiamonds = 0;
                                                
                                                if (req.isAgencyPayout) {
                                                  let agencyDocSnap = null;
                                                  if (req.userDisplayId) {
                                                    agencyDocSnap = await getDoc(doc(db, "agencies", req.userDisplayId));
                                                  }
                                                  if (agencyDocSnap && agencyDocSnap.exists()) {
                                                    agencyRef = doc(db, "agencies", req.userDisplayId);
                                                    currentAgencyDiamonds = agencyDocSnap.data().diamonds || 0;
                                                  } else {
                                                    const q = query(collection(db, "agencies"), where("owner_id", "==", req.userId));
                                                    const snap = await getDocs(q);
                                                    if (!snap.empty) {
                                                      agencyRef = doc(db, "agencies", snap.docs[0].id);
                                                      currentAgencyDiamonds = snap.docs[0].data().diamonds || 0;
                                                    }
                                                  }
                                                }

                                                const userRef = doc(db, "users", req.userId);
                                                const reqRef = doc(db, "withdrawal_requests", req.id);
                                                
                                                const userSnap = await getDoc(userRef);
                                                if (!userSnap.exists()) {
                                                  throw new Error("User does not exist!");
                                                }

                                                const batch = writeBatch(db);

                                                if (req.isAgencyPayout) {
                                                  if (agencyRef) {
                                                    batch.update(agencyRef, {
                                                      diamonds: currentAgencyDiamonds + req.diamonds_deducted
                                                    });
                                                  }
                                                } else {
                                                  const userData = userSnap.data();
                                                  const currentDiamonds = userData.diamonds || 0;
                                                  const currentLocked = userData.lockedDiamonds || 0;
                                                  
                                                  batch.update(userRef, {
                                                    diamonds: currentDiamonds + req.diamonds_deducted,
                                                    lockedDiamonds: Math.max(0, currentLocked - req.diamonds_deducted)
                                                  });
                                                }
                                                
                                                batch.update(reqRef, {
                                                  status: 'rejected',
                                                  rejected_at: new Date().toISOString()
                                                });

                                                await batch.commit();
                                                
                                                setAdminSalariesToast({
                                                  message: "تم رفض الطلب وإعادة الألماس للمحفظة",
                                                  type: 'success'
                                                });
                                                setConfirmingAction(null);
                                                setTimeout(() => setAdminSalariesToast(null), 5000);
                                              } catch (err) {
                                                console.error("Error rejecting withdrawal:", err);
                                                setAdminSalariesToast({
                                                  message: "حدث خطأ أثناء رفض الطلب.",
                                                  type: 'error'
                                                });
                                                setConfirmingAction(null);
                                                setTimeout(() => setAdminSalariesToast(null), 5000);
                                              }
                                            }}
                                            className="flex-1 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-[11px] font-black py-2 rounded-lg transition animate-pulse"
                                          >
                                            تأكيد الرفض والإرجاع
                                          </button>
                                          <button
                                            onClick={() => setConfirmingAction(null)}
                                            className="px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold py-2 rounded-lg transition"
                                          >
                                            إلغاء
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))
                            )}
                          </div>
                        </div>
                      );
                    })()}


                    </div>
                  </div>
                </>
              )}
              {/* SUCCESS CONFIRMATION MODAL */}
              {adminAgencySuccessData && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAdminAgencySuccessData(null)}></div>
                  <div className="bg-white rounded-3xl p-8 max-w-sm w-full relative z-10 animate-fade-in text-center shadow-2xl border border-indigo-100">
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl shadow-inner">
                      ✓
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-6">تم تسجيل الوكالة بنجاح!</h3>
                    
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-right space-y-3 mb-6">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-bold mb-1">اسم الوكالة:</span>
                        <span className="text-sm font-black text-indigo-700">{adminAgencySuccessData.name}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-bold mb-1">آيدي الوكالة:</span>
                        <span className="text-xs font-mono font-bold text-slate-600">{adminAgencySuccessData.id}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setAdminAgencySuccessData(null)}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3.5 rounded-xl transition shadow-lg active:scale-95"
                    >
                      إغلاق
                    </button>
                  </div>
                </div>
              )}

              {/* SUCCESS CONFIRMATION MODAL COIN AGENT */}
              {adminCoinAgentSuccessData && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAdminCoinAgentSuccessData(null)}></div>
                  <div className="bg-white rounded-3xl p-8 max-w-sm w-full relative z-10 animate-fade-in text-center shadow-2xl border border-emerald-100">
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl shadow-inner">
                      ✓
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-6">تم منح صلاحية وكيل معتمد!</h3>
                    
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-right space-y-3 mb-6">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-bold mb-1">الاسم الحقيقي:</span>
                        <span className="text-sm font-black text-emerald-700">{adminCoinAgentSuccessData.name}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-bold mb-1">الرصيد المضاف:</span>
                        <div className="flex items-center justify-end gap-1 font-mono font-black text-emerald-600 text-sm">
                          <span>🪙</span>
                          <span>{adminCoinAgentSuccessData.coins}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setAdminCoinAgentSuccessData(null)}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3.5 rounded-xl transition shadow-lg active:scale-95"
                    >
                      إغلاق
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Smart Canvas End */}

          </div>

        </div>

        {/* LEAVE ROOM DIALOG */}
        {showLeaveRoomDialog && (
          <div 
            onClick={() => setShowLeaveRoomDialog(false)}
            className="absolute inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center animate-fade-in p-4 cursor-pointer"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="flex justify-center gap-14 cursor-default"
            >
              
              {/* Button 1: Leave/Exit Completely */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => {
                    isLeavingRoomRef.current = true;
                    
                    const capturedRoom = activeRoom;
                    
                    setShowLeaveRoomDialog(false);
                    console.trace("[DEBUG] setActiveRoom(null) called");
                    console.trace("[DEBUG] setActiveRoom(null) called from Leave Room Dialog");
                    setActiveRoom(null);
                    setIsGiftDrawerOpen(false);
                    setIsAdminDrawerOpen(false);
                    setIsQueueDrawerOpen(false);
                    setSelectedGift(null);
                    handleExitRoomNavigation();

                    setTimeout(async () => {
                      try {
                        const isOnSeat = capturedRoom?.seats?.some(s => s.userId === currentUser?.id);
                        if (isOnSeat) {
                          const agoraManager = AgoraEngineManager.getInstance();
                          agoraManager.stopPublishing();
                        }
                        const cleanedSeats = capturedRoom?.seats?.map(s => s.userId === currentUser?.id ? { ...s, userId: null } : s) || [];
                        const updatedRoom = capturedRoom ? { ...capturedRoom, seats: cleanedSeats } : null;
                        if (updatedRoom) {
                          setRooms(rooms?.map(r => r.id === capturedRoom?.id ? updatedRoom : r));
                          
                          // Sync with Firestore
                          updateDoc(doc(db, "voice_rooms", capturedRoom.id), { seats: cleanedSeats }).catch(err => console.error("Error leaving seat:", err));
                          
                          // Remove from participants
                          if (currentUser) {
                            const participantRef = doc(db, "voice_rooms", capturedRoom.id, "participants", currentUser?.id);
                            deleteDoc(participantRef).catch(err => console.error("Error removing participant:", err));
                            
                            // Decrement activeUsersCount
                            updateDoc(doc(db, "voice_rooms", capturedRoom.id), {
                              activeUsersCount: increment(-1)
                            }).catch(err => console.error("Error decrementing user count:", err));
                          }
                        }
                      } catch (err) {
                        console.error("Error during leave room cleanup:", err);
                      }
                    }, 0);
                  }}
                  className="w-20 h-20 rounded-full bg-gradient-to-tr from-rose-500 to-red-600 flex items-center justify-center text-white shadow-xl shadow-rose-500/30 active:scale-95 transition-all cursor-pointer hover:brightness-105"
                  title="خروج نهائي"
                >
                  <LogOut className="w-8 h-8 mr-1" />
                </button>
                <span className="text-[12px] font-black text-slate-100 mt-3 drop-shadow-md">خروج نهائي</span>
              </div>

              {/* Button 2: Minimize */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => {
                    setShowLeaveRoomDialog(false);
                    handleExitRoomNavigation();
                  }}
                  className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-xl shadow-amber-500/30 active:scale-95 transition-all cursor-pointer hover:brightness-105"
                  title="تصغير"
                >
                  <Minimize2 className="w-8 h-8" />
                </button>
                <span className="text-[12px] font-black text-slate-100 mt-3 drop-shadow-md">تصغير</span>
              </div>

            </div>
          </div>
        )}

        {/* MICROPHONE PERMISSION HELP MODAL */}
        {isMicPermissionModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[300] flex items-center justify-center p-4 text-right animate-fade-in" dir="rtl">
            <div className="bg-[#18122B] rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl border border-white/10 relative z-[310]">
              <div className="w-16 h-16 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/20">
                <Mic className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-base font-black mb-3 text-white">طلب الوصول إلى الميكروفون</h3>
              <p className="text-xs text-slate-300 mb-6 leading-relaxed">
                يطلب هذا التطبيق الوصول إلى الميكروفون ليعمل بشكل صحيح. هل تريد السماح بالوصول إلى الميكروفون؟
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsMicPermissionModalOpen(false)}
                  className="flex-1 bg-white/10 hover:bg-white/15 text-slate-300 font-bold text-xs py-3 rounded-2xl active:scale-95 transition-all cursor-pointer"
                >
                  عدم السماح
                </button>
                <button
                  onClick={async () => {
                    const agoraManager = AgoraEngineManager.getInstance();
                    try {
                      await agoraManager.requestMicrophonePermission();
                    } catch (e) {
                      console.log("Mic permission fallback activated:", e);
                    }
                    setIsMicPermissionModalOpen(false);
                    try {
                      agoraManager.startPublishing();
                    } catch (e) {
                      console.log("Start publishing fallback:", e);
                    }
                  }}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs py-3 rounded-2xl shadow-lg shadow-purple-600/30 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>السماح بالوصول إلى الميكروفون</span>
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 text-[10px] text-slate-400">
                <span>أو يمكنك أيضاً <button onClick={() => window.open(window.location.href, '_blank')} className="text-purple-400 underline font-bold cursor-pointer">فتح في نافذة جديدة</button></span>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOM NOTICE MODAL */}
        {customNotice && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[350] flex items-center justify-center p-4 text-right animate-fade-in" dir="rtl">
            <div className="bg-white text-slate-900 rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl relative z-[360]">
              <h3 className="text-base font-black mb-5 text-slate-900 text-center">{customNotice.title}</h3>
              {customNotice.title === 'التسجيل مؤخراً' ? (() => {
                let parsed: any = {};
                try {
                  parsed = JSON.parse(customNotice.message);
                } catch (e) {}
                return (
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-200/60 text-right">
                    <img
                      src={parsed.avatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=user'}
                      alt="Avatar"
                      className="w-14 h-14 rounded-full object-cover border-2 border-purple-500 shadow-sm shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="space-y-1 overflow-hidden">
                      <div className="text-xs text-slate-700 font-bold truncate">طريقة التسجيل: {parsed.method || 'Google'}</div>
                      <div className="text-xs text-slate-500 font-mono truncate" dir="ltr">{parsed.email || ''}</div>
                    </div>
                  </div>
                );
              })() : (
                <p className="text-xs text-slate-600 mb-6 leading-relaxed">
                  {customNotice.message}
                </p>
              )}

              <div className="flex flex-col gap-2.5">
                {customNotice.title !== 'التسجيل مؤخراً' && (
                  <button
                    onClick={() => {
                      setCustomNotice(null);
                      setIsAgentsHubOpen(true);
                    }}
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs py-3 rounded-2xl shadow-lg shadow-amber-500/20 active:scale-95 transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Coins className="w-4 h-4" />
                    <span>شبكة الوكلاء المعتمدين للشحن 🛡️</span>
                  </button>
                )}
                <button
                  onClick={() => setCustomNotice(null)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-3 rounded-2xl active:scale-95 transition cursor-pointer"
                >
                  غلاق
                </button>
              </div>
            </div>
          </div>
        )}

        {/* INCOMING MIC INVITATION MODAL */}
        {incomingMicInvitation && incomingMicInvitation.inviteeId === currentUser?.id && incomingMicInvitation.hostId !== currentUser?.id && (
          <div className="fixed inset-0 bg-black/60 z-[280] flex items-center justify-center p-4 text-right animate-fade-in" dir="rtl">
            <div className="bg-[#FAF6EB] rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl border border-[#E8DCC4] relative z-[290]">
              <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl animate-bounce">
                🎙️
              </div>
              <h3 className="text-sm font-black mb-2 text-[#4A3E3D]">دعوة صعود للمايك 🎙️</h3>
              <p className="text-xs text-slate-600 mb-6 leading-relaxed">
                لقد دعاك <span className="font-bold text-purple-600">{incomingMicInvitation.hostName}</span> للصعود إلى المقعد رقم <span className="font-bold text-amber-600">{incomingMicInvitation.seatIndex + 1}</span>.
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleAcceptMicInvitation(incomingMicInvitation)}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition active:scale-[0.98] cursor-pointer shadow-sm text-xs flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  موافق
                </button>
                <button
                  onClick={() => handleDeclineMicInvitation(incomingMicInvitation)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 rounded-xl transition active:scale-[0.98] cursor-pointer shadow-sm text-xs flex items-center justify-center gap-1.5"
                >
                  رفض
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GLOBAL INCOMING VOICE CALL MODAL */}
        {incomingCall && (
          <div className="fixed inset-0 bg-black/70 z-[285] flex items-center justify-center p-4 text-right animate-fade-in" dir="rtl">
            <div className="bg-[#FFFDF9] rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl border-2 border-[#FFAE42]/20 relative z-[295] space-y-5">
              <div className="flex items-center justify-center py-4 relative">
                <div className="absolute w-24 h-24 rounded-full bg-emerald-500/10 animate-ping"></div>
                <div className="absolute w-16 h-16 rounded-full bg-emerald-500/20 animate-pulse"></div>
                <div className="w-14 h-14 rounded-full border-2 border-emerald-500 overflow-hidden bg-white shadow-lg relative z-10 mx-auto">
                  <img
                    src={incomingCall.caller.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=Caller"}
                    alt="caller avatar"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>

              <div className="space-y-1 text-center">
                <span className="bg-emerald-100 text-emerald-600 text-[8px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse inline-block">
                  مكالمة صوتية واردة 📞
                </span>
                <h3 className="text-sm font-black text-[#4A3E3D]">{incomingCall.caller.name}</h3>
                <p className="text-[10px] text-slate-400 font-bold">يرغب بالاتصال بك الآن ومشاركتك المجلس الخاص ✨</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleAcceptIncomingCall}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 rounded-xl transition active:scale-[0.98] cursor-pointer shadow-md text-xs flex items-center justify-center gap-1.5"
                >
                  <Phone className="w-4 h-4 animate-bounce" />
                  رد وقبول 👍
                </button>
                <button
                  onClick={handleDeclineIncomingCall}
                  className="bg-red-500 hover:bg-red-600 text-white font-black py-3 rounded-xl transition active:scale-[0.98] cursor-pointer shadow-md text-xs flex items-center justify-center gap-1.5"
                >
                  <PhoneOff className="w-4 h-4" />
                  رفض الاتصال ❌
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HIDDEN WEBRTC REMOTE AUDIO PLAYBACK ELEMENT */}
        <audio ref={remoteAudioRef} autoPlay className="hidden" />

        {/* PREMIUM GLOBAL ONGOING VOICE CALL SCREEN MODAL (Full-screen Overlay matches user designs) */}
        {activeCall && !isCallMinimized && (
          <div 
            className="fixed inset-0 bg-gradient-to-b from-[#1E112A] via-[#12091A] to-[#0A030F] z-[290] flex flex-col font-sans select-none text-right animate-fade-in"
            dir="rtl"
          >
            {/* Blurred user background for ringing (Image 2 style) */}
            {activeCall.status === 'ringing' && (
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <img 
                  src={activeCall.user.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=placeholder"} 
                  alt="" 
                  className="w-full h-full object-cover blur-2xl opacity-40 scale-110"
                />
                <div className="absolute inset-0 bg-[#0A030F]/60" />
              </div>
            )}

            {/* Premium Header */}
            <div className="relative z-10 flex justify-between items-center px-6 py-5 shrink-0">
              {/* Left Side: Minimize Button */}
              <button
                onClick={() => setIsCallMinimized(true)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md transition active:scale-95 cursor-pointer"
                title="تصغير"
              >
                <Minimize2 className="w-5 h-5" />
              </button>

              {/* Right Side: Status Badge */}
              <div className="bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-full backdrop-blur-md flex items-center gap-2">
                <span className="flex h-2 w-2 relative">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeCall.status === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${activeCall.status === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                </span>
                <span className="text-[11px] font-black text-slate-300">
                  {activeCall.status === 'connected' ? 'اتصال صوتي آمن' : 'جاري الاتصال...'}
                </span>
              </div>
            </div>

            {/* Caller Display Stage */}
            <div className="flex-grow flex flex-col items-center justify-center px-6 relative z-10">
              {activeCall.status === 'ringing' ? (
                /* Ringing Screen (Image 2 Style with blurred background) */
                <div className="flex flex-col items-center justify-center space-y-6">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-amber-500/15 animate-ping duration-1000"></div>
                    <div className="w-32 h-32 rounded-full p-1 bg-white/10 border-2 border-[#FFAE42] overflow-hidden shadow-2xl relative z-10">
                      <img 
                        src={activeCall.user.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=placeholder"} 
                        alt={activeCall.user.name} 
                        className="w-full h-full rounded-full object-cover bg-slate-900"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>

                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-black text-white">{activeCall.user.name}</h2>
                    <div className="flex items-center justify-center gap-1.5 bg-amber-500/10 text-[#FFAE42] text-[11px] font-black px-4 py-1.5 rounded-full border border-amber-500/20">
                      <span className="inline-block animate-spin">⏳</span>
                      <span>جاري رنين المكالمة بانتظار الطرف الآخر...</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Connected Active Screen (Image 1 Style with Premium Dark Purple Theme) */
                <div className="w-full flex flex-col items-center justify-center space-y-8 max-w-md mx-auto">
                  
                  {/* Two Main Circular Avatars Side by Side */}
                  <div className="flex items-center justify-center gap-10 relative w-full">
                    {/* Left Side: Partner Caller */}
                    <div className="flex flex-col items-center space-y-2 relative">
                      <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-pink-500 to-[#FFAE42] overflow-hidden shadow-2xl relative">
                        <img 
                          src={activeCall.user.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=placeholder"} 
                          alt={activeCall.user.name} 
                          className="w-full h-full rounded-full object-cover bg-white"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <span className="text-sm font-black text-white truncate max-w-[120px]">{activeCall.user.name}</span>
                      
                      {/* Follow Toggle Button */}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await handleToggleFollow(activeCall.user);
                        }}
                        className={`text-[10px] font-black px-4 py-1.5 rounded-full shadow-md active:scale-95 transition-all cursor-pointer ${
                          currentUser.following?.includes(activeCall.user.id)
                            ? 'bg-white/10 text-slate-300 border border-white/5'
                            : 'bg-gradient-to-r from-pink-500 to-[#FFAE42] text-white hover:opacity-90'
                        }`}
                      >
                        {currentUser.following?.includes(activeCall.user.id) ? 'متابع ✓' : 'متابعة +'}
                      </button>
                    </div>

                    {/* Visual Pulse Waves */}
                    <div className="flex items-center justify-center gap-1.5 pt-4 opacity-70">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FFAE42] animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FFAE42] animate-ping" style={{ animationDelay: '0.3s' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FFAE42] animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    </div>

                    {/* Right Side: Current User */}
                    <div className="flex flex-col items-center space-y-2 relative">
                      <div className="w-24 h-24 rounded-full p-1 bg-white/10 overflow-hidden shadow-2xl relative">
                        <img 
                          src={currentUser.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=Me"} 
                          alt="me" 
                          className="w-full h-full rounded-full object-cover bg-white"
                          referrerPolicy="no-referrer"
                        />
                        {activeCall.isMuted && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                            <MicOff className="w-6 h-6 text-red-500" />
                          </div>
                        )}
                      </div>
                      <span className="text-sm font-black text-white">أنت</span>
                      <span className="text-[10px] text-amber-400 font-bold bg-white/5 border border-white/5 px-2.5 py-0.5 rounded-full">
                        🪙 {currentUser.coins}
                      </span>
                    </div>
                  </div>

                  {/* High Contrast Duration Clock */}
                  <div className="text-center">
                    <span className="text-3xl font-black font-mono text-white tracking-widest drop-shadow-lg">
                      {formatDuration(activeCall.duration)}
                    </span>
                  </div>

                  {/* Free Trial Banner / Arabic Gentle Talk Advice */}
                  <div className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-center leading-relaxed">
                    <p className="text-[10px] text-amber-200/90 font-bold leading-relaxed flex items-center justify-center gap-1.5">
                      <span>📢</span>
                      <span>مكالمة صوتية مجانية تماماً! يرجى الحفاظ على حوار لطيف ومحترم مع الشريك للاستمتاع بوقتكم.</span>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions Bar (Microphone, Hangup, Speaker) */}
            <div className="p-8 shrink-0 flex items-center justify-center gap-8 relative z-10">
              {/* Mic Toggle */}
              <button
                onClick={() => {
                  setActiveCall(prev => {
                    if (!prev) return null;
                    try { soundService.playMicToggleSound(!prev.isMuted); } catch (e) {}
                    return { ...prev, isMuted: !prev.isMuted };
                  });
                }}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition active:scale-95 cursor-pointer ${
                  activeCall.isMuted ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title="كتم الميكروفون"
              >
                {activeCall.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Red Big Center Hangup Button */}
              <button
                onClick={async () => {
                  if (activeCall?.callId) {
                    try {
                      await updateDoc(doc(db, 'calls', activeCall.callId), { status: 'hungup' });
                    } catch (e) {
                      console.error("Error setting call status to hungup:", e);
                    }
                  }
                  handleCloseWebRTCCall();
                  setShowCallGiftModal(false);
                }}
                className="w-20 h-20 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-2xl transition active:scale-95 cursor-pointer border-4 border-black/20"
                title="إنهاء المكالمة"
              >
                <Phone className="w-8 h-8 rotate-[135deg]" />
              </button>

              {/* Speaker Toggle */}
              <button
                onClick={() => {
                  setActiveCall(prev => {
                    if (!prev) return null;
                    return { ...prev, isSpeaker: !prev.isSpeaker };
                  });
                }}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition active:scale-95 cursor-pointer ${
                  activeCall.isSpeaker ? 'bg-amber-500/20 text-[#FFAE42] border border-amber-500/30' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title="مكبر الصوت"
              >
                {activeCall.isSpeaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
            </div>
          </div>
        )}

        {/* MINIMIZED ACTIVE CALL FLOATING WIDGET (Shows globally when minimized) */}
        {activeCall && isCallMinimized && (
          <div 
            onClick={() => setIsCallMinimized(false)}
            className="fixed bottom-[145px] right-4 left-4 bg-[#12091A]/95 border border-purple-500/30 p-3 rounded-2xl shadow-2xl flex items-center justify-between z-[275] cursor-pointer animate-fade-in hover:scale-[1.01] transition-transform text-right"
            dir="rtl"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <img 
                  src={activeCall.user.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=placeholder"} 
                  alt="partner" 
                  className="w-10 h-10 rounded-full object-cover border-2 border-[#FFAE42]" 
                />
                <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#12091A] flex items-center justify-center ${activeCall.status === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                </div>
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-xs font-black text-white max-w-[150px] truncate leading-tight flex items-center gap-1.5">
                  <span>{activeCall.user.name}</span>
                  <span className="text-[8px] bg-amber-500/10 text-[#FFAE42] px-1 rounded font-mono">Lv.{activeCall.user.level}</span>
                </p>
                <p className="text-[9px] text-[#FFAE42] font-black leading-tight mt-1 flex items-center gap-1">
                  <span>⏱️ {formatDuration(activeCall.duration)}</span>
                  <span>● انقر للتوسيع</span>
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {/* Mic state */}
              <button
                onClick={() => {
                  setActiveCall(prev => {
                    if (!prev) return null;
                    try { soundService.playMicToggleSound(!prev.isMuted); } catch (e) {}
                    return { ...prev, isMuted: !prev.isMuted };
                  });
                }}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition active:scale-95 cursor-pointer ${activeCall.isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white'}`}
              >
                {activeCall.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
              
              {/* End call */}
              <button
                onClick={async () => {
                  if (activeCall?.callId) {
                    try {
                      await updateDoc(doc(db, 'calls', activeCall.callId), { status: 'hungup' });
                    } catch (e) {
                      console.error("Error setting call status to hungup:", e);
                    }
                  }
                  handleCloseWebRTCCall();
                  setShowCallGiftModal(false);
                }}
                className="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition active:scale-95"
              >
                <Phone className="w-3.5 h-3.5 rotate-[135deg]" />
              </button>
            </div>
          </div>
        )}


        {/* CUSTOM SEAT USER PROFILE CARD MODAL (Image 1 & Image 2) */}
        {selectedSeatUser && activeRoom && currentUser && (
          <div className="fixed inset-0 bg-black/50 z-[280] flex items-end justify-center animate-fade-in" dir="rtl" onClick={() => setSelectedSeatUser(null)}>
            <div 
              className="bg-white rounded-t-[36px] w-full max-w-md shadow-[0_-8px_30px_rgba(0,0,0,0.15)] relative animate-slide-up pb-10 pt-16 px-6 text-center text-right border-t border-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Report Button (التقرير) on top-left (Image 1 style) */}
              {selectedSeatUser.user.id !== currentUser.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCustomNotice({
                      title: "تم تقديم التقرير بنجاح 🛡️",
                      message: `تم تقديم بلاغ بشأن المستخدم [ ${selectedSeatUser.user.name} ] بنجاح للإدارة لمراجعته وحفظ نظام وسلامة المجلس.`
                    });
                    setSelectedSeatUser(null);
                  }} 
                  className="absolute top-5 left-6 flex items-center gap-1 text-rose-500 hover:text-rose-600 transition text-[11px] font-bold cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>التقرير</span>
                </button>
              )}

              {/* Avatar overlapping the top border exactly like the screenshots */}
              <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full p-0.5 bg-white shadow-md border border-slate-100/50">
                    <img 
                      src={selectedSeatUser.user.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=placeholder"} 
                      alt="" 
                      className="w-full h-full rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  {selectedSeatUser.user.level >= 10 && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl drop-shadow animate-bounce">👑</span>
                  )}
                </div>
              </div>

              {/* Gender Icon and Name */}
              <div className="flex items-center justify-center gap-1.5 mt-2">
                {selectedSeatUser.user.gender === 'female' ? (
                  <span className="text-rose-500 font-bold text-base bg-rose-50 w-5 h-5 rounded-full flex items-center justify-center" title="أنثى">♀</span>
                ) : (
                  <span className="text-sky-500 font-bold text-base bg-sky-50 w-5 h-5 rounded-full flex items-center justify-center" title="ذكر">♂</span>
                )}
                <h3 className="text-lg font-black text-slate-800 leading-none">{selectedSeatUser.user.name}</h3>
              </div>

              {/* Vibrant Profile Badges (From Screenshot) */}
              <div className="flex flex-wrap gap-2 items-center justify-center mt-3" dir="rtl">
                {/* Country Badge */}
                <span className="bg-[#F17875] text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-sm shadow-[#F17875]/30 flex items-center gap-1 leading-none">
                  <span className="text-[10px] uppercase font-mono opacity-90">{(() => {
                    const norm = (selectedSeatUser.user.country || 'العراق').trim();
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
                    const norm = (selectedSeatUser.user.country || 'العراق').trim();
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
                    {selectedSeatUser.user.birthdate ? (() => {
                      const today = new Date();
                      const birthDate = new Date(selectedSeatUser.user.birthdate);
                      let age = today.getFullYear() - birthDate.getFullYear();
                      const m = today.getMonth() - birthDate.getMonth();
                      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                        age--;
                      }
                      return isNaN(age) ? '25' : age;
                    })() : '25'}
                  </span>
                  <span className="text-[12px]">{selectedSeatUser.user.gender === 'female' ? '♀️' : '♂️'}</span>
                </span>
                
                {/* Wealth Badge */}
                <span className="bg-[#A55F73] text-white text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm shadow-[#A55F73]/30 leading-none">
                  <span>{getLevelFromXp(selectedSeatUser.user.senderXp || selectedSeatUser.user.xp || 0)}</span>
                  <span className="text-[12px]">🌙</span>
                </span>
                
                {/* Charm Badge */}
                <span className="bg-[#E53E7B] text-white text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm shadow-[#E53E7B]/30 leading-none">
                  <span className="font-mono">{getLevelFromXp(selectedSeatUser.user.charmXp || 0)}</span>
                  <span className="text-[12px]">💖</span>
                </span>
              </div>

              {/* Followers & ID Row */}
              <div className="flex justify-center items-center gap-6 mt-4 text-[11px] text-slate-500 font-sans">
                <span className="bg-emerald-50 text-emerald-700 px-3 py-0.5 rounded-full font-bold flex items-center gap-1">
                  💚 {selectedSeatUser.user.followers?.length || 0} متابعون
                </span>
                <span className="bg-slate-100 text-slate-700 px-3 py-0.5 rounded-full font-mono font-medium">
                  صدى العرب ID: {selectedSeatUser.user.displayId || selectedSeatUser.user.id}
                </span>
              </div>

              {/* Bio text */}
              <p className="text-[11px] text-slate-400 mt-4 leading-relaxed max-w-xs mx-auto italic">
                {selectedSeatUser.user.bio || "يمكن أن تؤدي إضافة المعلومات إلى كسب المزيد من المتابعين."}
              </p>

              {/* Core Actions Grid */}
              {selectedSeatUser.user.id === currentUser.id ? (
                /* --------------------- MY OWN PROFILE (Image 2 style) --------------------- */
                <div className="flex justify-around items-center mt-8 border-t border-slate-100 pt-6">
                  {/* مغادرة المايك */}
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      // Direct leave seat function
                      const seatIdx = selectedSeatUser.seatIndex;
                      const updatedSeats = activeRoom.seats.map((s, idx) => {
                        if (idx === seatIdx) {
                          return { ...s, userId: null };
                        }
                        return s;
                      });
                      
                      const agoraManager = AgoraEngineManager.getInstance();
                      agoraManager.stopPublishing();

                      const updatedRoom = { ...activeRoom, seats: updatedSeats };
                      setActiveRoom(updatedRoom);
                      setRooms(rooms?.map(r => r.id === activeRoom.id ? updatedRoom : r));
                      await updateDoc(doc(db, "voice_rooms", activeRoom.id), { seats: updatedSeats });
                      setSelectedSeatUser(null);
                    }}
                    className="flex flex-col items-center gap-1.5 group cursor-pointer transition active:scale-[0.95]"
                  >
                    <div className="w-14 h-14 bg-amber-50 hover:bg-amber-100 text-amber-500 rounded-full flex items-center justify-center transition shadow-sm border border-amber-100">
                      <Sofa className="w-6 h-6 text-amber-500" />
                    </div>
                    <span className="text-[11px] font-black text-slate-500 group-hover:text-amber-600">مغادرة المايك</span>
                  </button>

                  {/* الصفحة الشخصية */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProfileUser(selectedSeatUser.user);
                      setIsProfileModalOpen(true);
                      setSelectedSeatUser(null);
                    }}
                    className="flex flex-col items-center gap-1.5 group cursor-pointer transition active:scale-[0.95]"
                  >
                    <div className="w-14 h-14 bg-blue-50 hover:bg-blue-100 text-blue-500 rounded-full flex items-center justify-center transition shadow-sm border border-blue-100">
                      <User className="w-6 h-6 text-blue-500" />
                    </div>
                    <span className="text-[11px] font-black text-slate-500 group-hover:text-blue-600">الصفحة الشخصية</span>
                  </button>
                </div>
              ) : (
                /* --------------------- OTHER USER PROFILE (Image 1 style) --------------------- */
                <div className="mt-8 border-t border-slate-100 pt-6">
                  {/* 5 Quick Actions Row */}
                  {(() => {
                    const isUserRoomOwner = checkIfOwner(activeRoom);
                    const isTargetOwner = selectedSeatUser.user.id === activeRoom?.owner_id;
                    const showAdminActions = isUserRoomOwner && !isTargetOwner;
                    const gridColsClass = showAdminActions ? "grid-cols-5" : "grid-cols-3 max-w-[240px] mx-auto";
                    return (
                      <div className={`grid ${gridColsClass} gap-1.5 mb-6`}>
                        {/* منشين */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setChatInputValue(prev => prev ? `${prev} @${selectedSeatUser.user.name} ` : `@${selectedSeatUser.user.name} `);
                            setSelectedSeatUser(null);
                          }}
                          className="flex flex-col items-center gap-1.5 group cursor-pointer transition active:scale-[0.95]"
                          title="منشين"
                        >
                          <div className="w-12 h-12 bg-amber-50 hover:bg-amber-100 rounded-full flex items-center justify-center border border-amber-100 transition shadow-sm">
                            <AtSign className="w-5 h-5 text-amber-500" />
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 text-center leading-tight">منشين</span>
                        </button>

                        {/* تحويل المايك الى الصامت */}
                        {showAdminActions && (() => {
                          const seatIdx = selectedSeatUser.seatIndex;
                          const seatObj = (seatIdx !== undefined && seatIdx !== -1) ? activeRoom?.seats?.[seatIdx] : null;
                          const isCurrentlyMuted = seatObj?.hostMuted || false;
                          return (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const isAuthorizedHost = checkIfOwner(activeRoom);
                                if (!isAuthorizedHost) {
                                  setCustomNotice({
                                    title: 'صلاحية مرفوضة ⚠️',
                                    message: 'عذراً، كتم وإلغاء كتم المستخدمين مخصص لمالك المجلس أو المشرفين فقط.'
                                  });
                                  return;
                                }
                                if (seatIdx === undefined || seatIdx === -1) {
                                  setCustomNotice({
                                    title: 'تنبيه ⚠️',
                                    message: 'عذراً، هذا المستخدم ليس على المايك حالياً ليتم كتم صوته.'
                                  });
                                  return;
                                }
                                const seat = activeRoom.seats[seatIdx];
                                if (!seat) {
                                  setCustomNotice({
                                    title: 'تنبيه ⚠️',
                                    message: 'عذراً، لم يتم العثور على مقعد هذا المستخدم.'
                                  });
                                  return;
                                }
                                
                                const updatedSeats = activeRoom.seats.map((s, idx) => {
                                  if (idx === seatIdx) {
                                    if (isCurrentlyMuted) {
                                      // Unmuting: lift hostMuted restriction and fully unmute/turn on the microphone
                                      return { ...s, isMuted: false, hostMuted: false };
                                    } else {
                                      // Muting: force mute (isMuted: true and hostMuted: true)
                                      return { ...s, isMuted: true, hostMuted: true };
                                    }
                                  }
                                  return s;
                                });

                                const updatedRoom = { ...activeRoom, seats: updatedSeats };
                                setActiveRoom(updatedRoom);
                                setRooms(rooms?.map(r => r.id === activeRoom.id ? updatedRoom : r));
                                await updateDoc(doc(db, "voice_rooms", activeRoom.id), { seats: updatedSeats });
                                setSelectedSeatUser(null);
                              }}
                              className="flex flex-col items-center gap-1.5 group cursor-pointer transition active:scale-[0.95]"
                              title={isCurrentlyMuted ? "تحويل المايك نشط" : "تحويل المايك صامت"}
                            >
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition shadow-sm ${
                                isCurrentlyMuted 
                                  ? "bg-emerald-50 hover:bg-emerald-100 border-emerald-100" 
                                  : "bg-rose-50 hover:bg-rose-100 border-rose-100"
                              }`}>
                                {isCurrentlyMuted ? (
                                  <Volume2 className="w-5 h-5 text-emerald-500" />
                                ) : (
                                  <VolumeX className="w-5 h-5 text-rose-500" />
                                )}
                              </div>
                              <span className="text-[10px] font-bold text-slate-500 text-center leading-tight">
                                {isCurrentlyMuted ? "تحويل المايك نشط" : "تحويل المايك صامت"}
                              </span>
                            </button>
                          );
                        })()}

                        {/* الطرد */}
                        {showAdminActions && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const isAuthorizedHost = checkIfOwner(activeRoom);
                              if (!isAuthorizedHost) {
                                setCustomNotice({
                                  title: 'صلاحية مرفوضة ⚠️',
                                  message: 'عذراً، طرد المستخدمين مخصص لمالك المجلس أو المشرفين فقط.'
                                });
                                return;
                              }
                              setBanDurationModalUser(selectedSeatUser.user);
                              setSelectedSeatUser(null);
                            }}
                            className="flex flex-col items-center gap-1.5 group cursor-pointer transition active:scale-[0.95]"
                            title="الطرد"
                          >
                            <div className="w-12 h-12 bg-red-50 hover:bg-red-100 rounded-full flex items-center justify-center border border-red-100 transition shadow-sm">
                              <UserX className="w-5 h-5 text-red-500" />
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 text-center leading-tight">الطرد</span>
                          </button>
                        )}

                        {/* شات */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActivePrivateChatUser(selectedSeatUser.user);
                              setIsPrivateInboxOpen(true);
                              setSelectedSeatUser(null);
                            }}
                            className="flex flex-col items-center gap-1.5 group cursor-pointer transition active:scale-[0.95]"
                            title="شات"
                          >
                          <div className="w-12 h-12 bg-purple-50 hover:bg-purple-100 rounded-full flex items-center justify-center border border-purple-100 transition shadow-sm">
                            <MessageSquare className="w-5 h-5 text-purple-500" />
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 text-center leading-tight">شات</span>
                        </button>

                        {/* الصفحة الشخصية */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProfileUser(selectedSeatUser.user);
                            setIsProfileModalOpen(true);
                            setSelectedSeatUser(null);
                          }}
                          className="flex flex-col items-center gap-1.5 group cursor-pointer transition active:scale-[0.95]"
                          title="الصفحة الشخصية"
                        >
                          <div className="w-12 h-12 bg-blue-50 hover:bg-blue-100 rounded-full flex items-center justify-center border border-blue-100 transition shadow-sm">
                            <User className="w-5 h-5 text-blue-500" />
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 text-center leading-tight">الصفحة الشخصية</span>
                        </button>
                      </div>
                    );
                  })()}

                  {/* Bottom main interaction pills: Send Gifts / Follow */}
                  <div className="flex gap-4 px-2">
                    {/* ارسال الهدايا */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRecipientSeatIndices([selectedSeatUser.seatIndex + 1]);
                        setIsGiftDrawerOpen(true);
                        setSelectedSeatUser(null);
                      }}
                      className="flex-1 bg-[#FFAE42] hover:bg-amber-500 text-white font-black py-3 rounded-full transition active:scale-[0.95] cursor-pointer shadow-md text-xs text-center"
                    >
                      ارسال الهدايا
                    </button>

                    {/* متابعة */}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        await handleToggleFollow(selectedSeatUser.user);
                        // Refresh target follower status locally in state
                        setSelectedSeatUser(prev => {
                          if (!prev) return null;
                          const isFollowingNow = prev.user.followers?.includes(currentUser.id);
                          const updatedFollowers = isFollowingNow
                            ? (prev.user.followers || []).filter(id => id !== currentUser.id)
                            : [...(prev.user.followers || []), currentUser.id];
                          return {
                            ...prev,
                            user: {
                              ...prev.user,
                              followers: updatedFollowers
                            }
                          };
                        });
                      }}
                      className="flex-1 border-2 border-[#FFAE42] hover:bg-amber-50/50 text-[#FFAE42] font-black py-2.5 rounded-full transition active:scale-[0.95] cursor-pointer text-xs text-center"
                    >
                      {selectedSeatUser.user.followers?.includes(currentUser?.id) ? 'إلغاء المتابعة' : 'متابعة'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BAN/KICK DURATION SELECTOR MODAL */}
        {banDurationModalUser && (
          <div 
            className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 animate-fade-in" 
            dir="rtl" 
            onClick={() => setBanDurationModalUser(null)}
          >
            <div 
              className="bg-white rounded-[32px] w-full max-w-sm shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative animate-scale-in p-6 text-center border border-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100 shadow-sm">
                <UserX className="w-7 h-7 text-red-500" />
              </div>
              
              <h3 className="text-lg font-black text-slate-800 mb-2">تحديد مدة الطرد</h3>
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                يرجى اختيار مدة حظر العضو <span className="text-red-500 font-bold">[{banDurationModalUser.name}]</span> من دخول هذا المجلس مجدداً:
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    await handleBanUser(banDurationModalUser.id, 1);
                    setBanDurationModalUser(null);
                  }}
                  className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-black py-3 rounded-2xl transition active:scale-[0.98] text-sm border border-red-100 shadow-sm cursor-pointer"
                >
                  ⏱️ دقيقة واحدة
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    await handleBanUser(banDurationModalUser.id, 60);
                    setBanDurationModalUser(null);
                  }}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-3 rounded-2xl transition active:scale-[0.98] text-sm shadow-md shadow-red-500/20 cursor-pointer"
                >
                  ⏰ ساعة واحدة
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    await handleBanUser(banDurationModalUser.id, 60 * 24 * 7);
                    setBanDurationModalUser(null);
                  }}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-3 rounded-2xl transition active:scale-[0.98] text-sm shadow-md cursor-pointer"
                >
                  🗓️ أسبوع كامل
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setBanDurationModalUser(null);
                  }}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-2xl transition active:scale-[0.98] text-sm mt-2 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MINIMIZED ROOM WIDGET */}
        {activeRoom && currentScreen !== 'room' && (
          <div 
            onClick={() => setCurrentScreen('room')}
            className="absolute bottom-[90px] right-4 left-4 bg-[#FAF6EB]/95 backdrop-blur-md border border-amber-400/40 p-2.5 rounded-2xl shadow-xl flex items-center justify-between z-[90] cursor-pointer animate-fade-in hover:scale-[1.01] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <img src={activeRoom.hostAvatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=placeholder"} alt="host" className="w-9 h-9 rounded-full object-cover border-2 border-amber-400" />
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#FAF6EB] animate-pulse"></div>
              </div>
              <div className="text-right flex flex-col justify-center">
                <p className="text-xs font-black text-[#4A3E3D] max-w-[150px] truncate leading-tight">{activeRoom.name}</p>
                <p className="text-[9px] text-[#FFAE42] font-black leading-tight mt-0.5">● اضغط للعودة للمجلس الصوتي</p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowLeaveRoomDialog(true);
              }}
              className="w-7 h-7 rounded-full bg-red-50/80 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition active:scale-95 ml-1 border border-red-100"
            >
              <span className="text-xs font-bold">✕</span>
            </button>
          </div>
        )}

      </main>

      {/* INTERACTIVE GAME BOTTOM SHEET (FOOD FORTUNE WHEEL WEBVIEW) */}
      {isGameSheetOpen && (
        <div className="absolute inset-0 z-[100] flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/70 animate-fade-in cursor-pointer"
            onClick={() => setIsGameSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 h-[80%] max-h-[80%] bg-[#0d0722] border-t-2 border-indigo-500/40 rounded-t-[32px] z-[110] animate-fade-in shadow-2xl flex flex-col overflow-hidden text-right">
            {/* Modern Bottom Sheet Header */}
            <div className="flex justify-between items-center bg-[#130d2e]/90 border-b border-purple-950/40 px-4 py-3 shrink-0 font-sans">
              <button
                onClick={() => setIsGameSheetOpen(false)}
                className="text-xs text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 px-3.5 py-1.5 rounded-full border border-slate-700/50 cursor-pointer active:scale-95 transition-all"
              >
                إغلاق
              </button>
              <h4 className="text-xs font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-indigo-200 to-amber-300 flex items-center gap-1.5">
                🎡 لعبة عجلة الحظ (Food Fortune Wheel)
              </h4>
            </div>

            {/* Game WebView Simulator Container */}
            <div className="flex-grow w-full bg-transparent relative">
              {activeGameUrl ? (
                <GameContainer key={activeGameUrl} activeGameUrl={activeGameUrl} />
              ) : (
                <div className="flex items-center justify-center h-full w-full text-gray-400 font-sans">
                  جاري جلب بيانات الحساب والاتصال باللعبة...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
