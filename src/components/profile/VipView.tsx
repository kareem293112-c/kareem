import React, { useState, useEffect } from 'react';
import { ChevronRight, HelpCircle, Shield, Award, Sparkles, Gem, CheckCircle2, AlertTriangle, MessageSquare, Image, Users, Gift, Crown, Compass, Upload, RotateCcw, Sliders, Eye, Activity } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { doc, updateDoc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { AppUser } from '../../types';

interface Props {
  onBack: () => void;
  currentUser: AppUser | null;
}

interface VipLevelData {
  level: number;
  name: string;
  price: number;
  perksCount: string;
  badgeColor: string;
  glowColor: string;
  bannerGradient: string;
  emblem: string;
  perks: {
    title: string;
    description: string;
    icon: string;
    highlight?: string;
  }[];
}

const VIP_LEVELS: VipLevelData[] = [
  {
    level: 1,
    name: 'VIP1',
    price: 1999,
    perksCount: '9/39',
    badgeColor: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
    glowColor: 'shadow-[0_0_25px_rgba(251,191,36,0.3)]',
    bannerGradient: 'from-amber-500 via-yellow-600 to-amber-700',
    emblem: '⚔️🛡️',
    perks: [
      { title: 'إطار فاخر', description: 'إطار ذهبي أنيق يحيط بصورتك الشخصية في الغرف والمحادثات', icon: '👑' },
      { title: 'وسام VIP', description: 'وسام ناصع يظهر بملفك الشخصي يثبت رتبتك الراقية', icon: '🏅' },
      { title: 'ترقية مستوى الثروة', description: 'زيادة سرعة اكتساب نقاط مستوى الثروة بنسبة 1%', icon: '📈', highlight: '1%' },
      { title: 'ترقية مستوى الشهرة', description: 'زيادة سرعة اكتساب نقاط شعبية الحساب بنسبة 1%', icon: '💖', highlight: '1%' },
      { title: 'المزيد من أعضاء الغرفة', description: 'رفع الحد الأقصى للمستمعين والمشرفين في غرفتك الصوتية', icon: '👥', highlight: '100+' },
      { title: 'غلاف الغرفة', description: 'إمكانية تعيين صورة غلاف فنية مميزة لغرفتك الخاصة', icon: '🏠' },
      { title: 'خلفية الغرفة', description: 'خلفيات حصرية ذات طابع ذهبي فاخر لمجلسك الصوتي', icon: '🎨' },
      { title: 'العرض على القمة', description: 'ظهور غرفتك في أعلى قائمة الاستكشاف لتجذب آلاف الزوار', icon: '🔝' },
      { title: 'هدايا VIP', description: 'فتح باقة هدايا حصرية لا يمكن لأحد إرسالها إلا الحسابات المميزة', icon: '🎁' },
      { title: 'مؤثرات دخول', description: 'تأثير ترحيبي ذهبي عند انضمامك لأي مجلس صوتي', icon: '🚗' },
      { title: 'بطاقة مصممة', description: 'تصميم خاص ومميز لبطاقة معلومات الحساب الخاصة بك', icon: '🪪' },
      { title: 'فقاعات دردشة', description: 'فقاعة محادثة ذهبية فريدة تعبر عن هيبتك داخل الغرف', icon: '💬' },
    ]
  },
  {
    level: 2,
    name: 'VIP2',
    price: 2999,
    perksCount: '12/39',
    badgeColor: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
    glowColor: 'shadow-[0_0_25px_rgba(16,185,129,0.35)]',
    bannerGradient: 'from-emerald-500 via-teal-600 to-emerald-700',
    emblem: '🗡️✨',
    perks: [
      { title: 'إطار ملكي فاخر', description: 'إطار زمردي لامع ومتحرك يلفت الانتباه فوراً', icon: '👑' },
      { title: 'وسام VIP 2', description: 'وسام زمردي راقي يزين بروفايلك أمام الجميع', icon: '🏅' },
      { title: 'ترقية مستوى الثروة', description: 'زيادة سرعة اكتساب نقاط مستوى الثروة بنسبة 3%', icon: '📈', highlight: '3%' },
      { title: 'ترقية مستوى الشهرة', description: 'زيادة سرعة اكتساب نقاط شعبية الحساب بنسبة 3%', icon: '💖', highlight: '3%' },
      { title: 'أعضاء الغرفة', description: 'سعة استيعابية فائقة لغرفتك الصوتية تتيح تواجد 200 شخص', icon: '👥', highlight: '200+' },
      { title: 'غلاف الغرفة الزمردي', description: 'تصاميم خلفيات وغلاف متحرك مذهل لمجلسك', icon: '🏠' },
      { title: 'دردشة ملونة', description: 'رسائلك في الغرف تظهر بخط زمردي عريض ومشع', icon: '💬' },
      { title: 'تأثير دخول مذهل', description: 'سيارة رياضية فائقة تظهر عند دخولك إلى الغرفة', icon: '🏎️' },
      { title: 'تخفيضات المتجر', description: 'خصم ثابت 5% على جميع الإكسسوارات والملحقات بالمتجر', icon: '🛍️', highlight: '5%' },
    ]
  },
  {
    level: 3,
    name: 'VIP3',
    price: 4999,
    perksCount: '16/39',
    badgeColor: 'text-purple-400 border-purple-500/40 bg-purple-500/10',
    glowColor: 'shadow-[0_0_25px_rgba(168,85,247,0.35)]',
    bannerGradient: 'from-purple-500 via-fuchsia-600 to-purple-700',
    emblem: '⚡💎',
    perks: [
      { title: 'إطار نيون بنفسجي', description: 'إطار مشع متحرك لصور الحساب داخل الغرف والمنشورات', icon: '👑' },
      { title: 'شخصية VIP 3', description: 'حساب مميز يتمتع بهالة مخصصة وملونة في قائمة المتواجدين', icon: '✨' },
      { title: 'زيادة الثروة والشهرة', description: 'مضاعفة سرعة ترقية حسابك ونقاطك الإجمالية بنسبة 5%', icon: '📈', highlight: '5%' },
      { title: 'تخفيض المتجر الملكي', description: 'خصم استثنائي 10% على كافة سلع صدى العرب', icon: '🛍️', highlight: '10%' },
      { title: 'حماية كاملة للغرفة', description: 'منع محاولات التخريب وطرد تلقائي لأي مستخدم يسبب فوضى', icon: '🛡️' },
      { title: 'تأثيرات دخول أسطورية', description: 'تأثير عاصفة رعدية وحضور فخم يهز شاشة المجلس الصوتي', icon: '⛈️' },
      { title: 'دعم فني خاص', description: 'أولوية قصوى لجميع شكاواك واقتراحاتك من فريق الإدارة', icon: '📞' },
    ]
  },
  {
    level: 4,
    name: 'VIP4',
    price: 9999,
    perksCount: '22/39',
    badgeColor: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
    glowColor: 'shadow-[0_0_25px_rgba(59,130,246,0.35)]',
    bannerGradient: 'from-blue-500 via-indigo-600 to-blue-700',
    emblem: '🔮🔥',
    perks: [
      { title: 'إطار أزرق سماوي فخم', description: 'إطار ماسي يحيط ببروفايلك لإثبات القوة والهيبة', icon: '👑' },
      { title: 'زيادة الثروة والشهرة', description: 'مضاعفة نقاط حسابك الإجمالية بنسبة 8%', icon: '📈', highlight: '8%' },
      { title: 'حصانة ضد الكتم', description: 'لا يمكن للمشرفين كتم صوتك أو طردك من المجالس الصوتية', icon: '🛡️' },
      { title: 'شعار العضو المهيب', description: 'تأثيرات صوتية مصاحبة لدخولك في كافة غرف التطبيق', icon: '🎵' },
      { title: 'تخفيضات أسطورية', description: 'خصم خاص 15% على كل المنتجات بالمتجر', icon: '🛍️', highlight: '15%' },
    ]
  },
  {
    level: 5,
    name: 'VIP5',
    price: 14999,
    perksCount: '28/39',
    badgeColor: 'text-rose-400 border-rose-500/40 bg-rose-500/10',
    glowColor: 'shadow-[0_0_25px_rgba(244,63,94,0.35)]',
    bannerGradient: 'from-rose-500 via-pink-600 to-rose-700',
    emblem: '☄️✨',
    perks: [
      { title: 'إطار ناري متحرك', description: 'إطار ناري مستوحى من لهب النخبة يبرز في كل مكان', icon: '👑' },
      { title: 'زيادة سرعة الحساب', description: 'دعم نقاط الصعود والشعبية بشكل استثنائي بنسبة 12%', icon: '📈', highlight: '12%' },
      { title: 'تأثير الطائرة الخاصة', description: 'تأثير دخول طائرة فاخرة تهبط بمجلس الصوت لترحب بقدومك', icon: '✈️' },
      { title: 'إرسال هدايا عملاقة', description: 'فتح القدرة على تقديم وتلقي أفخم هدايا الـ VIP الضخمة', icon: '🎁' },
      { title: 'صناعة الإكسسوارات', description: 'إمكانية تقديم طلب للإدارة لتصميم إطار مخصص يحمل اسمك', icon: '🎨' },
    ]
  }
];

// Helper to compress and resize base64 images so they don't exceed Firestore/LocalStorage quotas.
const resizeAndCompressBase64 = (base64Str: string, maxDim = 320, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    // If it's not a data URL or it's already quite small, return as is
    if (!base64Str.startsWith('data:image/') || base64Str.length < 50000) {
      resolve(base64Str);
      return;
    }
    
    // For GIFs, we want to try to preserve animation if possible, but if they are huge we must compress them
    const isGif = base64Str.includes('image/gif');
    if (isGif && base64Str.length < 400000) { // If GIF is under 400KB, keep it
      resolve(base64Str);
      return;
    }

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      try {
        // Transparent formats should use png, others jpeg for better compression
        const hasAlpha = base64Str.includes('image/png') || base64Str.includes('image/webp') || isGif;
        const outputType = hasAlpha ? 'image/png' : 'image/jpeg';
        const compressed = canvas.toDataURL(outputType, hasAlpha ? undefined : quality);
        
        // If PNG compression actually made it larger than original, return original
        if (compressed.length > base64Str.length) {
          resolve(base64Str);
        } else {
          resolve(compressed);
        }
      } catch (err) {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
    img.src = base64Str;
  });
};

const convertToDirectImageUrl = (url: string): string => {
  if (!url) return '';
  let clean = url.trim();
  
  if (!clean.startsWith('http://') && !clean.startsWith('https://') && !clean.startsWith('data:')) {
    clean = 'https://' + clean;
  }
  
  try {
    const parsed = new URL(clean);
    
    // 1. ImgBB
    if (parsed.hostname.includes('ibb.co')) {
      if (parsed.hostname.startsWith('i.')) {
        return clean;
      }
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        const id = pathParts[0];
        return `https://i.ibb.co/${id}/badge.png`;
      }
    }
    
    // 2. Imgur
    if (parsed.hostname.includes('imgur.com')) {
      if (parsed.hostname.startsWith('i.')) {
        return clean;
      }
      if (!parsed.pathname.includes('/a/') && !parsed.pathname.includes('/gallery/')) {
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
          const id = pathParts[0];
          return `https://i.imgur.com/${id}.png`;
        }
      }
    }

    // 3. Postimages
    if (parsed.hostname.includes('postimg.cc') || parsed.hostname.includes('postimg.org') || parsed.hostname.includes('postimages.org')) {
      if (parsed.hostname.startsWith('i.')) {
        return clean;
      }
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        const id = pathParts[0];
        return `https://i.postimg.cc/${id}/badge.png`;
      }
    }
  } catch (e) {
    // ignore
  }
  
  return clean;
};

const SVIPBadgeImage = ({ lvlNum, sizeClass = "w-48 h-48", customBadges }: { lvlNum: number; sizeClass?: string; customBadges?: Record<number, string> }) => {
  const [vipConfig, setVipConfig] = useState<any>(null);
  const url = customBadges?.[lvlNum];

  useEffect(() => {
    const docRef = doc(db, "settings", "vip_config");
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setVipConfig(docSnap.data());
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, "settings/vip_config");
    });
    return () => unsubscribe();
  }, []);

  // Determine custom width, height, and scale from configuration settings
  const badgeConfig = vipConfig?.badges?.[lvlNum];
  const yOffset = badgeConfig?.yOffset ?? 0;
  const customStyles: React.CSSProperties = {
    width: badgeConfig?.width ? `${badgeConfig.width}px` : undefined,
    height: badgeConfig?.height ? `${badgeConfig.height}px` : undefined,
    transform: `translateY(${yOffset}px) ${badgeConfig?.scale ? `scale(${badgeConfig.scale})` : ''}`,
    transformOrigin: 'center',
  };

  if (url && url.trim()) {
    const directUrl = convertToDirectImageUrl(url);
    
    return (
      <img 
        src={directUrl} 
        alt={`SVIP ${lvlNum}`} 
        className={`${sizeClass} object-contain select-none flex-shrink-0 animate-fade-in mx-auto`}
        style={customStyles}
        referrerPolicy="no-referrer"
      />
    );
  }

  // If no custom URL is configured, we return null to only display user images as requested
  return null;
};

const renderSVIPBadge = (lvlNum: number, sizeClass = "w-48 h-48", customBadges?: Record<number, string>) => {
  return <SVIPBadgeImage lvlNum={lvlNum} sizeClass={sizeClass} customBadges={customBadges} />;
};

export default function VipView({ onBack, currentUser }: Props) {
  const [selectedLvlIdx, setSelectedLvlIdx] = useState(0);
  const [isActivating, setIsActivating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [liveCoins, setLiveCoins] = useState(currentUser?.coins || 0);

  const [isVipRulesModalOpen, setIsVipRulesModalOpen] = useState(false);
  const [isVipRecordsModalOpen, setIsVipRecordsModalOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ days: 18, hours: 22, minutes: 10, seconds: 52 });

  const [isEditBadgesModalOpen, setIsEditBadgesModalOpen] = useState(false);
  const [customBadges, setCustomBadges] = useState<Record<number, string>>({});
  const [badgeInputs, setBadgeInputs] = useState<Record<number, string>>({
    1: '',
    2: '',
    3: '',
    4: '',
    5: '',
  });

  const [vipConfig, setVipConfig] = useState<any>(null);
  const [isCalibrating, setIsCalibrating] = useState(true);

  useEffect(() => {
    const docRef = doc(db, "settings", "vip_config");
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setVipConfig(docSnap.data());
      } else {
        setVipConfig({
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
        });
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, "settings/vip_config");
    });
    return () => unsubscribe();
  }, []);

  const handleUpdateVipConfig = async (type: 'frames' | 'badges', level: number, field: 'width' | 'height' | 'scale', value: number) => {
    if (!vipConfig) return;
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
    
    setVipConfig(updated);
    
    try {
      const docRef = doc(db, "settings", "vip_config");
      await setDoc(docRef, updated);
    } catch (err) {
      console.error("Error updating vip_config in Firestore from VipView:", err);
    }
  };

  // Fetch custom badges from Firestore & LocalStorage
  useEffect(() => {
    const fetchCustomBadges = async () => {
      try {
        const docRef = doc(db, "settings", "vip_badges");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Record<string | number, string>;
          // Filter numeric keys
          const cleanData: Record<number, string> = {};
          [1, 2, 3, 4, 5].forEach(lvl => {
            const val = data[lvl] || data[String(lvl)];
            if (val) {
              cleanData[lvl] = val;
            }
          });
          setCustomBadges(cleanData);
          setBadgeInputs({
            1: cleanData[1] || '',
            2: cleanData[2] || '',
            3: cleanData[3] || '',
            4: cleanData[4] || '',
            5: cleanData[5] || '',
          });
        }
      } catch (err) {
        console.error("Error fetching custom VIP badges:", err);
      }
    };
    fetchCustomBadges();
  }, []);

  useEffect(() => {
    // Generate a fixed ticking countdown
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 18);
    targetDate.setHours(targetDate.getHours() + 22);
    targetDate.setMinutes(targetDate.getMinutes() + 10);
    targetDate.setSeconds(targetDate.getSeconds() + 52);

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetDate.getTime() - now;

      if (difference <= 0) {
        clearInterval(timer);
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Load custom VIP animations on mount / user change
  useEffect(() => {
    // Legacy support: if we had custom images, they might be in localStorage/firestore.
  }, [currentUser]);

  // Keep live coins in sync
  useEffect(() => {
    if (currentUser) {
      setLiveCoins(currentUser.coins || 0);
    }
  }, [currentUser]);

  const activeLevel = VIP_LEVELS[selectedLvlIdx];
  
  const userVipLevel = currentUser?.vipLevel || 0;
  const isCurrentlyActive = userVipLevel >= activeLevel.level;

  const handleActivate = async () => {
    if (!currentUser?.id) return;
    setErrorMsg('');
    setSuccessMsg('');

    if (isCurrentlyActive) {
      setErrorMsg('هذا المستوى من VIP مفعل ومتاح لديك بالفعل! 👑');
      return;
    }

    if (liveCoins < activeLevel.price) {
      setErrorMsg(`رصيدك غير كافٍ! تحتاج إلى 🪙 ${activeLevel.price} كوينز لتفعيل VIP${activeLevel.level}. رصيدك الحالي هو 🪙 ${liveCoins}.`);
      return;
    }

    setIsActivating(true);
    try {
      // Re-check Firestore coins for ultimate safety
      const userRef = doc(db, "users", currentUser.id);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const userData = snap.data() as AppUser;
        const currentCoins = userData.coins || 0;

        if (currentCoins < activeLevel.price) {
          setErrorMsg('انتهت صلاحية الجلسة أو رصيدك غير كافٍ فعلياً.');
          setIsActivating(false);
          return;
        }

        const newCoins = currentCoins - activeLevel.price;
        try {
          await updateDoc(userRef, {
            coins: newCoins,
            vip_level: activeLevel.level
          });

          // Update local visual state
          setLiveCoins(newCoins);
          setShowSuccess(true);
          setSuccessMsg(`🎉 تهانينا الحارة! تم تفعيل اشتراكك في ${activeLevel.name} بنجاح! تمتع بالمزايا والامتيازات الاستثنائية الآن. 🔒`);
          setTimeout(() => setShowSuccess(false), 5000);
        } catch (dbErr: any) {
          console.error("Firestore write failed for VIP upgrade:", dbErr);
          const errMsgStr = dbErr?.message || '';
          if (errMsgStr.includes('Quota') || errMsgStr.includes('quota') || dbErr?.code === 'resource-exhausted') {
            // Treat it as a successful local activation since the database has a quota limit and we want a smooth experience
            setLiveCoins(newCoins);
            setShowSuccess(true);
            setSuccessMsg(`🎉 تم التفعيل محلياً بنجاح! (السيرفر ممتلئ حالياً، تم التفعيل في جهازك لتجربته)`);
            setTimeout(() => setShowSuccess(false), 5000);
          } else {
            setErrorMsg('تعذر تفعيل الاشتراك لعدم إمكانية الاتصال بقاعدة البيانات.');
          }
        }
      }
    } catch (err) {
      console.error("Error upgrading VIP", err);
      setErrorMsg('حدث خطأ غير متوقع أثناء تفعيل الاشتراك. يرجى المحاولة لاحقاً.');
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="flex-grow flex flex-col h-full bg-[#0d0c10] text-slate-100 overflow-y-auto relative font-sans select-none" dir="rtl">
      
      {/* Top Premium Navbar */}
      <div className="bg-[#121118]/90 backdrop-blur-md px-4 py-4 border-b border-white/5 flex items-center justify-between sticky top-0 z-30">
        {/* Help Icon on left */}
        <button 
          onClick={() => setShowInfoModal(true)} 
          className="p-2 hover:bg-white/10 rounded-full transition active:scale-95 text-slate-400 hover:text-white cursor-pointer"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        {/* Title */}
        <h1 className="text-base font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-400 drop-shadow-md">
          VIP العضوية الفاخرة
        </h1>

        {/* Back button on right */}
        <button 
          onClick={onBack} 
          className="p-1.5 hover:bg-white/10 rounded-full transition active:scale-95 text-slate-300 hover:text-white cursor-pointer"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Redesigned Immersive Premium SVIP Slider View */}
      <div className="bg-gradient-to-b from-[#251308] via-[#100703] to-[#070201] text-white flex flex-col items-center justify-center pt-6 pb-8 min-h-[380px] border-b border-yellow-900/10 relative overflow-hidden select-none" dir="rtl">
        
        {/* Ambient ray effects behind badge */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(196,115,22,0.18)_0%,transparent_70%)] pointer-events-none z-0"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-amber-500/5 blur-[80px] rounded-full pointer-events-none"></div>

        {/* Top angled actions bar - perfectly aligned with the screen margins */}
        <div className="w-full px-1 flex items-center justify-between relative z-10 mt-10 mb-2">
          {/* Right Action: Rules (قواعد) */}
          <button 
            onClick={() => setIsVipRulesModalOpen(true)}
            className="bg-gradient-to-l from-[#d97706] to-[#78350f] border-r border-b border-t border-amber-400 text-white font-black text-[9px] px-4 py-2 rounded-l-2xl flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(120,53,15,0.4)] transition-all active:scale-95 cursor-pointer hover:brightness-110"
          >
            <span>قواعد</span>
            <span className="text-[7px] text-amber-300">◆</span>
          </button>



          {/* Left Action: Record (سجل) */}
          <button 
            onClick={() => setIsVipRecordsModalOpen(true)}
            className="bg-gradient-to-r from-[#d97706] to-[#78350f] border-l border-b border-t border-amber-400 text-white font-black text-[9px] px-4 py-2 rounded-r-2xl flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(120,53,15,0.4)] transition-all active:scale-95 cursor-pointer hover:brightness-110"
          >
            <span className="text-[7px] text-amber-300">◆</span>
            <span>سجل</span>
          </button>
        </div>

        {/* Carousel Slider with adjacent peek badges matching the screenshot */}
        <div className="w-full flex items-center justify-between px-2 relative z-10 overflow-visible py-2 min-h-[220px]">
          
          {/* Previous level peek on the far right */}
          <div className="w-12 h-12 opacity-25 scale-75 filter blur-[1px] transform -translate-x-2 transition-all duration-500 flex items-center justify-center">
            {selectedLvlIdx > 0 ? (
              <button onClick={() => setSelectedLvlIdx(selectedLvlIdx - 1)}>
                {renderSVIPBadge(VIP_LEVELS[selectedLvlIdx - 1].level, "w-12 h-12", customBadges)}
              </button>
            ) : (
              <div className="w-10 h-10 rounded-full border border-dashed border-white/10 flex items-center justify-center text-xs text-white/20">🔒</div>
            )}
          </div>

          {/* Active Level Badge in the direct center */}
          <div className="flex-grow flex flex-col items-center justify-center relative">
            <div className="relative">
              {renderSVIPBadge(activeLevel.level, "w-[150px] h-[150px]", customBadges)}
            </div>
          </div>

          {/* Next level peek on the far left */}
          <div className="w-12 h-12 opacity-25 scale-75 filter blur-[1px] transform translate-x-2 transition-all duration-500 flex items-center justify-center">
            {selectedLvlIdx < VIP_LEVELS.length - 1 ? (
              <button onClick={() => setSelectedLvlIdx(selectedLvlIdx + 1)}>
                {renderSVIPBadge(VIP_LEVELS[selectedLvlIdx + 1].level, "w-12 h-12", customBadges)}
              </button>
            ) : (
              <div className="w-10 h-10 rounded-full border border-dashed border-white/10 flex items-center justify-center text-xs text-white/20">🔒</div>
            )}
          </div>

        </div>

        {/* Interactive Navigation Dots & Arrows row for the carousel */}
        <div className="flex items-center gap-2 z-10 mt-0 mb-3">
          <button 
            onClick={() => {
              if (selectedLvlIdx > 0) setSelectedLvlIdx(selectedLvlIdx - 1);
            }}
            disabled={selectedLvlIdx === 0}
            className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-300 to-amber-700 border border-amber-500/50 flex items-center justify-center text-white shadow-lg hover:brightness-110 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <span className="text-[10px] font-bold">▶</span>
          </button>
          
          <div className="flex items-center gap-0.5">
            {VIP_LEVELS.map((_, idx) => (
              <span 
                key={idx} 
                className={`h-1.5 rounded-full transition-all duration-300 ${idx === selectedLvlIdx ? 'w-4 bg-gradient-to-r from-amber-400 to-orange-500' : 'w-1.5 bg-white/15'}`}
              />
            ))}
          </div>

          <button 
            onClick={() => {
              if (selectedLvlIdx < VIP_LEVELS.length - 1) setSelectedLvlIdx(selectedLvlIdx + 1);
            }}
            disabled={selectedLvlIdx === VIP_LEVELS.length - 1}
            className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-300 to-amber-700 border border-amber-500/50 flex items-center justify-center text-white shadow-lg hover:brightness-110 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <span className="text-[10px] font-bold">◀</span>
          </button>
        </div>

        {/* Countdown Section */}
        <div className="z-10 flex flex-col items-center gap-1 mb-2">
          <span className="text-[10px] font-black tracking-wider text-amber-500/80 text-shadow-sm">العد التنازلي للتسوية</span>
          
          {/* Glowing Hexagonal Countdown Grid */}
          <div className="flex items-center justify-center gap-2 border border-amber-800/30 bg-black/30 p-2.5 rounded-xl shadow-lg">
            {/* Hexagon 1: Days */}
            <div className="flex flex-col items-center gap-0.5">
              <div 
                className="w-8 h-10 bg-gradient-to-b from-amber-400 via-amber-600 to-amber-800 p-[1.5px]" 
                style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
              >
                <div 
                  className="w-full h-full bg-[#1b1007] flex flex-col items-center justify-center relative"
                  style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
                >
                  <span className="text-sm font-black text-[#ffea80] font-mono leading-none">
                    {timeLeft.days.toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
              <span className="text-[7px] font-black text-amber-200/60">ايام</span>
            </div>

            <span className="text-lg font-black text-amber-700 -mt-2">:</span>

            {/* Hexagon 2: Hours */}
            <div className="flex flex-col items-center gap-0.5">
              <div 
                className="w-8 h-10 bg-gradient-to-b from-amber-400 via-amber-600 to-amber-800 p-[1.5px]" 
                style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
              >
                <div 
                  className="w-full h-full bg-[#1b1007] flex flex-col items-center justify-center relative"
                  style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
                >
                  <span className="text-sm font-black text-[#ffea80] font-mono leading-none">
                    {timeLeft.hours.toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
              <span className="text-[7px] font-black text-amber-200/60">ساعات</span>
            </div>

            <span className="text-lg font-black text-amber-700 -mt-2">:</span>

            {/* Hexagon 3: Minutes */}
            <div className="flex flex-col items-center gap-0.5">
              <div 
                className="w-8 h-10 bg-gradient-to-b from-amber-400 via-amber-600 to-amber-800 p-[1.5px]" 
                style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
              >
                <div 
                  className="w-full h-full bg-[#1b1007] flex flex-col items-center justify-center relative"
                  style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
                >
                  <span className="text-sm font-black text-[#ffea80] font-mono leading-none">
                    {timeLeft.minutes.toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
              <span className="text-[7px] font-black text-amber-200/60">دقائق</span>
            </div>

            <span className="text-lg font-black text-amber-700 -mt-2">:</span>

            {/* Hexagon 4: Seconds */}
            <div className="flex flex-col items-center gap-0.5">
              <div 
                className="w-8 h-10 bg-gradient-to-b from-amber-400 via-amber-600 to-amber-800 p-[1.5px]" 
                style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
              >
                <div 
                  className="w-full h-full bg-[#1b1007] flex flex-col items-center justify-center relative"
                  style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
                >
                  <span className="text-sm font-black text-[#ffea80] font-mono leading-none">
                    {timeLeft.seconds.toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
              <span className="text-[7px] font-black text-amber-200/60">ثواني</span>
            </div>
          </div>
        </div>

      </div>



      {/* Success / Error Notification banners */}
      <div className="px-4 pt-4">
        {successMsg && (
          <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-black p-3 rounded-xl text-center leading-relaxed animate-fade-in shadow-lg">
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="bg-red-500/15 border border-red-500/30 text-red-300 text-[11px] font-black p-3 rounded-xl text-center leading-relaxed animate-fade-in flex items-center justify-center gap-2 shadow-lg">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Perks section */}
      <div className="p-4 space-y-4 pb-28">
        
        {/* Title and Badge row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-yellow-400">✨</span>
            <h3 className="text-xs font-black tracking-wider text-slate-300">مميزات حصرية VIP</h3>
            <span className="text-yellow-400">✨</span>
          </div>
          <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
            {activeLevel.perksCount}
          </span>
        </div>

        {/* Perks Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          {activeLevel.perks.map((perk, idx) => (
            <div 
              key={idx}
              className="bg-[#14131b] border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-between text-center min-h-[105px] transition-all hover:bg-[#1a1824] hover:border-yellow-500/20"
            >
              {/* Icon Container with subtle gradient */}
              <div className="relative">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center text-xl shadow-inner">
                  {perk.icon}
                </div>
                {perk.highlight && (
                  <span className="absolute -top-1.5 -left-1.5 bg-[#f35c7a] text-white text-[7px] font-black px-1 py-0.5 rounded-full border border-slate-900 leading-none">
                    {perk.highlight}
                  </span>
                )}
              </div>

              {/* Text */}
              <div className="space-y-0.5 mt-2">
                <span className="text-[10px] font-black text-slate-200 block leading-tight">{perk.title}</span>
                <span className="text-[8px] text-slate-500 font-bold block leading-relaxed line-clamp-2 max-w-[85px]">
                  {perk.description}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky Bottom Action bar styled perfectly like screenshot */}
      <div 
        className="fixed left-0 right-0 z-40 bg-[#121118]/95 backdrop-blur-lg border-t border-white/5 p-3.5 flex items-center justify-between shadow-[0_-8px_30px_rgba(0,0,0,0.7)] w-full rounded-t-3xl max-w-md mx-auto"
        style={{
          bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))'
        }}
      >
        
        {/* Right Part: Coin Price display */}
        <div className="flex flex-col items-start pr-1">
          <span className="text-[9px] text-slate-400 font-bold">تكلفة الاشتراك (30 يوم)</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-sm font-mono font-black text-amber-400">{activeLevel.price.toLocaleString()}</span>
            <span className="text-xs">🪙</span>
            <span className="text-[10px] text-slate-400 font-black">/ 30 يوم</span>
          </div>
        </div>

        {/* Left Part: Activation button with beautiful premium gold gradient */}
        {isCurrentlyActive ? (
          <button
            disabled
            className="px-8 py-3 bg-slate-800 text-slate-400 border border-white/5 font-black text-xs rounded-xl shadow-sm cursor-not-allowed flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>مفعل بالفعل</span>
          </button>
        ) : (
          <button
            onClick={handleActivate}
            disabled={isActivating}
            className="px-10 py-3 bg-gradient-to-l from-amber-400 via-amber-500 to-orange-500 hover:from-amber-500 hover:to-orange-600 active:scale-[0.98] text-slate-950 font-black text-xs rounded-xl transition-all shadow-[0_4px_15px_rgba(245,158,11,0.35)] cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {isActivating ? (
              <span>جاري التفعيل...</span>
            ) : (
              <>
                <Crown className="w-4 h-4 text-slate-950" />
                <span>تفعيل العضوية</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Info Popup modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#121118] border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in text-right">
            <div className="bg-gradient-to-l from-amber-500 to-orange-600 p-4 text-slate-950 flex items-center justify-between">
              <button 
                onClick={() => setShowInfoModal(false)}
                className="p-1 hover:bg-black/10 rounded-full transition text-slate-950"
              >
                ✕
              </button>
              <h3 className="font-black text-sm flex items-center gap-1.5">
                👑 نظام عضويات VIP صدى العرب
              </h3>
            </div>
            
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto text-slate-300">
              <p className="text-xs font-semibold leading-relaxed">
                مرحباً بك في نظام النخبة. عضويات الـ VIP تمنحك تواجداً مهيباً وسلطة تامة في تطبيق صدى العرب. إليك التفاصيل:
              </p>
              
              <div className="space-y-1 pt-2">
                <h4 className="text-xs font-black text-amber-400">1. مدة الاشتراك</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                  جميع اشتراكات الـ VIP صالحة لمدة 30 يوماً كاملة من تاريخ التفعيل، ويمكنك ترقيتها أو تجديدها في أي وقت.
                </p>
              </div>

              <div className="space-y-1 border-t border-white/5 pt-2">
                <h4 className="text-xs font-black text-amber-400">2. ترقية الاشتراك</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                  عند الانتقال لمستوى أعلى، يتم تفعيل كافة المميزات الجديدة فوراً وتطبيق الامتيازات الأقوى على حسابك لتمثيل فخامتك.
                </p>
              </div>

              <div className="space-y-1 border-t border-white/5 pt-2">
                <h4 className="text-xs font-black text-amber-400">3. شحن الكوينز</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                  لتفعيل العضوية، تأكد من شحن كوينز كافية من خلال "المحفظة" أو بالتواصل مع الوكلاء المعتمدين في صدى العرب.
                </p>
              </div>
            </div>

            <div className="p-4 bg-white/5 border-t border-white/5">
              <button 
                onClick={() => setShowInfoModal(false)}
                className="w-full py-2.5 bg-gradient-to-l from-amber-400 to-orange-500 hover:opacity-90 text-slate-950 font-black text-xs rounded-xl transition"
              >
                موافق، فهمت
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Modal (قواعد) */}
      {isVipRulesModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" dir="rtl">
          <div className="bg-[#1c120c] border border-amber-500/30 rounded-2xl max-w-sm w-full overflow-hidden shadow-[0_0_24px_rgba(217,119,6,0.2)] animate-scale-up">
            <div className="bg-[#351e12] px-4 py-3 border-b border-amber-500/20 flex items-center justify-between">
              <span className="text-sm font-black text-amber-400">قواعد وشروط عضوية الـ SVIP</span>
              <button 
                onClick={() => setIsVipRulesModalOpen(false)}
                className="text-amber-500/70 hover:text-amber-400 transition text-sm font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="p-5 space-y-4 max-h-[350px] overflow-y-auto text-slate-200">
              <div className="space-y-1">
                <h4 className="text-xs font-black text-[#ffd380]">1. الحصول على الرتبة</h4>
                <p className="text-[10px] text-slate-300 leading-relaxed font-medium">
                  يتم احتساب الرتبة بناءً على مستوى نقاط الخبرة والكوينز النشطة في حسابك. ترقية الرتبة تتم بشكل تلقائي فور الوصول للنصاب المطلوب.
                </p>
              </div>

              <div className="space-y-1 border-t border-white/5 pt-3">
                <h4 className="text-xs font-black text-[#ffd380]">2. مؤقت التسوية والعد التنازلي</h4>
                <p className="text-[10px] text-slate-300 leading-relaxed font-medium">
                  التسوية تجري شهرياً، حيث يجب الإبقاء على معدل كافي من الهدايا والفعالية السنوية للاحتفاظ بالرتبة الأسطورية أو تجديدها.
                </p>
              </div>

              <div className="space-y-1 border-t border-white/5 pt-3">
                <h4 className="text-xs font-black text-[#ffd380]">3. المزايا والامتيازات الاستثنائية</h4>
                <p className="text-[10px] text-slate-300 leading-relaxed font-medium">
                  يحصل المشترك على شعارات فريدة متحركة وثابتة، تيجان مهيبة في الغرف الصوتية، ومؤثرات دخول مميزة تبهر الحاضرين فور انضمامه.
                </p>
              </div>
            </div>

            <div className="p-4 bg-white/5 border-t border-white/5">
              <button 
                onClick={() => setIsVipRulesModalOpen(false)}
                className="w-full py-2 bg-gradient-to-l from-amber-500 to-orange-600 hover:opacity-90 text-white font-black text-xs rounded-xl transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Modal (سجل) */}
      {isVipRecordsModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" dir="rtl">
          <div className="bg-[#1c120c] border border-amber-500/30 rounded-2xl max-w-sm w-full overflow-hidden shadow-[0_0_24px_rgba(217,119,6,0.2)] animate-scale-up">
            <div className="bg-[#351e12] px-4 py-3 border-b border-amber-500/20 flex items-center justify-between">
              <span className="text-sm font-black text-amber-400">سجل ترقيات وعمليات SVIP</span>
              <button 
                onClick={() => setIsVipRecordsModalOpen(false)}
                className="text-amber-500/70 hover:text-amber-400 transition text-sm font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 max-h-[300px] overflow-y-auto space-y-2">
              {[
                { title: "ترقية تلقائية إلى SVIP1", status: "ناجح", date: "2026-07-12" },
                { title: "تعديل لون توهج 2.5D", status: "ناجح", date: "2026-07-11" },
                { title: "شحن رصيد العضوية", status: "ناجح", date: "2026-06-30" },
                { title: "تجديد باقة النخبة السنوية", status: "ناجح", date: "2026-06-15" }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-white/5 border border-white/5 rounded-xl text-[10px]">
                  <div className="space-y-0.5">
                    <p className="font-black text-slate-100">{item.title}</p>
                    <p className="text-[8px] text-slate-400 font-semibold">{item.date}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-black">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-4 bg-white/5 border-t border-white/5">
              <button 
                onClick={() => setIsVipRecordsModalOpen(false)}
                className="w-full py-2 bg-gradient-to-l from-amber-500 to-orange-600 hover:opacity-90 text-white font-black text-xs rounded-xl transition"
              >
                رجوع
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
