import React, { useState, useEffect } from 'react';
import { ChevronRight, Edit2, Lock, Save, Globe, User, Calendar, Smile, RefreshCw, Sparkles } from 'lucide-react';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Jack',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Leo',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Nala',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Buster',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Coco',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Cleo',
];

export default function EditProfileView({ onBack, currentUser }: any) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const container = document.getElementById('smartphone-screen') || document.querySelector('.overflow-y-auto');
    if (container) {
      container.scrollTop = 0;
    }
  }, []);
  const [name, setName] = useState(currentUser?.name || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');
  const [gender, setGender] = useState(currentUser?.gender || '');
  const [birthdate, setBirthdate] = useState(currentUser?.birthdate || '');
  const [country, setCountry] = useState(currentUser?.country || 'العراق');

  const [isEditingBio, setIsEditingBio] = useState(false);
  const [isChangingAvatar, setIsChangingAvatar] = useState(false);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Determine if fields are locked or editable (locked if they already have values)
  const isBirthdateLocked = !!currentUser?.birthdate;
  const isGenderLocked = !!currentUser?.gender;

  // Sync state if currentUser updates
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setBio(currentUser.bio || '');
      setAvatar(currentUser.avatar || '');
      setGender(currentUser.gender || '');
      setBirthdate(currentUser.birthdate || '');
      setCountry(currentUser.country || 'العراق');
    }
  }, [currentUser]);

  const handleSaveAll = async () => {
    if (!currentUser?.id) return;
    if (!name.trim()) {
      alert("الرجاء إدخال الاسم المكتوب بشكل صحيح.");
      return;
    }

    setIsSaving(true);
    try {
      const updates: any = {
        name: name.trim(),
        bio: bio.trim(),
        avatar: avatar,
        country: country
      };

      // Only allow updating gender and birthdate if they were not set previously
      if (!isBirthdateLocked && birthdate) {
        updates.birthdate = birthdate;
      }
      if (!isGenderLocked && gender) {
        updates.gender = gender;
      }

      await updateDoc(doc(db, "users", currentUser.id), updates);
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      alert("تم حفظ جميع التعديلات بنجاح!");
    } catch (error) {
      console.error("Error updating profile", error);
      alert("حدث خطأ أثناء حفظ التعديلات.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 256;
        const MAX_HEIGHT = 256;
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
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
          setAvatar(compressedBase64);
          setIsChangingAvatar(false);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex-grow flex flex-col bg-slate-50 relative h-full w-full" dir="rtl">
      {/* Header */}
      <div className="bg-white p-4 flex items-center justify-between shadow-sm relative z-10 shrink-0">
        <h2 className="font-bold text-lg text-slate-800">تعديل البروفايل</h2>
        <div className="flex items-center gap-2">
           <button 
             onClick={handleSaveAll}
             disabled={isSaving}
             className={`text-xs font-black px-4 py-1.5 rounded-full flex items-center gap-1 transition-all shadow-sm ${
               saveSuccess 
                 ? 'bg-emerald-500 text-white' 
                 : 'bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 cursor-pointer'
             }`}
           >
             {isSaving ? (
               <RefreshCw className="w-3 h-3 animate-spin" />
             ) : (
               <Save className="w-3 h-3" />
             )}
             <span>{saveSuccess ? 'تم الحفظ!' : 'حفظ التغييرات'}</span>
           </button>
           <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition cursor-pointer">
             <ChevronRight className="w-5 h-5 text-slate-600" />
           </button>
        </div>
      </div>

      <div className="overflow-y-auto p-4 space-y-6 flex-grow pb-12">
        {/* Avatar Section */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 text-7xl opacity-5 -translate-y-4 translate-x-4">✨</div>
          
          <div className="relative group">
            <img 
              src={avatar || "https://api.dicebear.com/7.x/adventurer/svg"} 
              alt={name} 
              className="w-24 h-24 rounded-full border-4 border-amber-100 shadow-md bg-slate-50 object-cover" 
            />
            <button 
              onClick={() => setIsChangingAvatar(!isChangingAvatar)}
              className="absolute bottom-1 right-1 bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white p-2 rounded-full border-2 border-white shadow-lg transition-all active:scale-90 cursor-pointer"
              title="تغيير الصورة"
            >
               <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <button 
            onClick={() => setIsChangingAvatar(!isChangingAvatar)}
            className="text-[11px] text-slate-500 mt-3 font-bold hover:text-amber-600 transition cursor-pointer bg-slate-100 px-3 py-1 rounded-full flex items-center gap-1"
          >
            <span>🖼️</span> تغيير الصورة الشخصية
          </button>

          {/* Change Avatar Panel (Expands in-place) */}
          {isChangingAvatar && (
            <div className="w-full mt-4 p-4 border border-slate-100 bg-slate-50/50 rounded-xl space-y-4 animate-fade-in text-right">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-[11px] font-black text-slate-500">اختر من الأفاتارات المميزة:</span>
                
                {/* Small compact upload button */}
                <label 
                  htmlFor="avatar-upload" 
                  className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200 text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                >
                  <span>📷</span> اختيار من المعرض
                </label>
                <input
                  type="file"
                  id="avatar-upload"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
              
              <div className="grid grid-cols-4 gap-2">
                {PRESET_AVATARS.map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setAvatar(url);
                      setIsChangingAvatar(false);
                    }}
                    className={`p-1 bg-white rounded-lg border-2 hover:scale-105 transition-all cursor-pointer ${
                      avatar === url ? 'border-amber-400 shadow-sm' : 'border-slate-100'
                    }`}
                  >
                    <img src={url} alt="preset" className="w-12 h-12 mx-auto rounded-full" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bio Section (Edits in-place exactly as requested) */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3">
          <div className="flex justify-between items-center text-xs text-slate-500 font-bold">
            <span className="flex items-center gap-1">
              <span>📝</span> السيرة الذاتية (البيانات الخاصة)
            </span>
            {!isEditingBio && (
              <button 
                onClick={() => setIsEditingBio(true)}
                className="text-[10px] text-amber-500 hover:text-amber-600 font-black transition cursor-pointer"
              >
                تعديل السيرة
              </button>
            )}
          </div>

          {isEditingBio ? (
            <div className="space-y-2 animate-fade-in">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="اكتب شيئاً عن نفسك، اهتماماتك أو سيرتك هنا..."
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-3 text-xs text-right outline-none focus:border-amber-400 min-h-[100px] transition-all resize-none"
                maxLength={150}
              />
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                <span>{bio.length}/150 حرفاً</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      setIsEditingBio(false);
                      // Instantly save bio locally, user can hit main save or update Firestore right now
                    }}
                    className="bg-slate-100 text-slate-600 font-bold px-3 py-1 rounded-lg hover:bg-slate-200 transition cursor-pointer"
                  >
                    تم
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => setIsEditingBio(true)}
              className="w-full bg-slate-50/70 p-4 rounded-xl border border-slate-100/80 min-h-[80px] text-xs text-slate-700 leading-relaxed cursor-pointer hover:bg-slate-100/50 transition-all text-right"
              title="اضغط لتعديل السيرة الذاتية في مكانها"
            >
              {bio ? (
                <p className="whitespace-pre-wrap">{bio}</p>
              ) : (
                <p className="text-slate-400 font-bold italic flex items-center justify-center py-4 gap-1">
                  <span>💭</span> اضغط هنا لكتابة نبذة تعريفية أو سيرة ذاتية في مكانها...
                </p>
              )}
            </div>
          )}
        </div>

        {/* Basic Info Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="bg-slate-50/80 px-4 py-3 text-xs text-slate-500 font-black border-b border-slate-100 flex items-center gap-1">
            <span>📇</span> البيانات الأساسية والتحقق
          </div>
          
          <div className="divide-y divide-slate-100">
            {/* Name - Always open and editable */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
              <span className="text-xs font-black text-slate-700 flex items-center gap-1 shrink-0">
                <User className="w-3.5 h-3.5 text-slate-400" /> الاسم المكتوب
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="أدخل اسمك الكريم..."
                className="w-full sm:max-w-[200px] bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs text-right outline-none focus:border-amber-400 transition"
              />
            </div>

            {/* Display ID - Read-only */}
            <div className="p-4 flex justify-between items-center bg-white">
              <span className="text-xs font-black text-slate-700 flex items-center gap-1">
                <span>🎫</span> بطاقة المستخدم (الآيدي)
              </span>
              <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">
                ID: {currentUser?.displayId || currentUser?.id}
              </span>
            </div>

            {/* Gender - Locked after first entry */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
              <span className="text-xs font-black text-slate-700 flex items-center gap-1 shrink-0">
                <span>👥</span> نوع الجنس
              </span>
              
              {isGenderLocked ? (
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>{currentUser.gender === 'male' ? 'ذكر' : 'أنثى'}</span>
                  <span className="text-[9px] text-slate-400 font-black">(مؤكد وغير قابل للتعديل)</span>
                </div>
              ) : (
                <div className="flex gap-2 w-full sm:max-w-[200px]">
                  <button
                    onClick={() => setGender('male')}
                    className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all border ${
                      gender === 'male'
                        ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    🙋‍♂️ ذكر
                  </button>
                  <button
                    onClick={() => setGender('female')}
                    className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all border ${
                      gender === 'female'
                        ? 'bg-pink-50 text-pink-600 border-pink-200 shadow-sm'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    🙋‍♀️ أنثى
                  </button>
                </div>
              )}
            </div>

            {/* Birthday - Locked after first entry */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
              <span className="text-xs font-black text-slate-700 flex items-center gap-1 shrink-0">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> تاريخ الميلاد
              </span>
              
              {isBirthdateLocked ? (
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span className="font-mono">{currentUser.birthdate}</span>
                  <span className="text-[9px] text-slate-400 font-black">(مؤكد وغير قابل للتعديل)</span>
                </div>
              ) : (
                <div className="w-full sm:max-w-[200px] flex flex-col gap-1">
                  <input
                    type="date"
                    value={birthdate}
                    onChange={(e) => setBirthdate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs text-right outline-none focus:border-amber-400 transition"
                  />
                  <span className="text-[9px] text-amber-600 font-black text-right">⚠️ يمكن التعديل لمرة واحدة فقط ثم يقفل نهائياً!</span>
                </div>
              )}
            </div>

            {/* Country */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
              <span className="text-xs font-black text-slate-700 flex items-center gap-1 shrink-0">
                <Globe className="w-3.5 h-3.5 text-slate-400" /> الدولة / الإقليم
              </span>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full sm:max-w-[200px] bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs text-right outline-none focus:border-amber-400 transition cursor-pointer"
              >
                <option value="العراق">العراق 🇮🇶</option>
                <option value="السعودية">السعودية 🇸🇦</option>
                <option value="سوريا">سوريا 🇸🇾</option>
                <option value="مصر">مصر 🇪🇬</option>
                <option value="الأردن">الأردن 🇯🇴</option>
                <option value="اليمن">اليمن 🇾🇪</option>
                <option value="المغرب">المغرب 🇲🇦</option>
                <option value="الجزائر">الجزائر 🇩🇿</option>
                <option value="تونس">تونس 🇹🇳</option>
                <option value="ليبيا">ليبيا 🇱🇾</option>
                <option value="فلسطين">فلسطين 🇵🇸</option>
                <option value="لبنان">لبنان 🇱🇧</option>
                <option value="الكويت">الكويت 🇰🇼</option>
                <option value="الإمارات">الإمارات 🇦🇪</option>
                <option value="قطر">قطر 🇶🇦</option>
                <option value="البحرين">البحرين 🇧🇭</option>
                <option value="عمان">عمان 🇴🇲</option>
                <option value="السودان">السودان 🇸🇩</option>
                <option value="تركيا">تركيا 🇹🇷</option>
                <option value="أخرى">دولة أخرى 🌍</option>
              </select>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
