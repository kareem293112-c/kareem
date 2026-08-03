import React, { useState, useEffect } from 'react';
import { ChevronRight, Phone, Mail, ShieldCheck, Save } from 'lucide-react';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { AppUser } from '../../types';

interface Props {
  onBack: () => void;
  currentUser: AppUser | null;
}

export default function AccountLinkView({ onBack, currentUser }: Props) {
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (currentUser) {
      setPhone(currentUser.phone || '');
      setEmail(currentUser.email || '');
    }
  }, [currentUser]);

  const handleSave = async () => {
    if (!currentUser?.id) return;
    
    setIsSaving(true);
    setSuccessMsg('');
    try {
      await updateDoc(doc(db, "users", currentUser.id), {
        phone: phone.trim(),
        email: email.trim(),
      });
      setSuccessMsg('تم ربط وتحديث معلومات الحساب بنجاح! 🔒');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (error) {
      console.error("Error saving account links", error);
      alert("حدث خطأ أثناء محاولة ربط الحساب، يرجى المحاولة لاحقاً.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-grow flex flex-col h-full bg-slate-50 overflow-y-auto" dir="rtl">
      {/* Top Header */}
      <div className="bg-white px-4 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
        <div className="w-6"></div> {/* Spacer */}
        <h1 className="text-sm font-black text-slate-800">ربط الحساب</h1>
        <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-full transition active:scale-95 cursor-pointer">
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Banner Card */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="absolute left-[-20px] bottom-[-20px] text-white opacity-10 text-8xl font-black">
            🔒
          </div>
          <div className="relative z-10 space-y-1 text-right">
            <h3 className="text-sm font-black flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-100" /> أمان حسابك يبدأ من هنا
            </h3>
            <p className="text-[11px] text-amber-50 leading-relaxed font-bold">
              قم بربط حسابك برقم الهاتف والبريد الإلكتروني الآن لضمان عدم ضياع حسابك أو الهوية البرونزية، ولتتمكن من استعادة بياناتك في أي وقت بسهولة تامة وبحماية كاملة.
            </p>
          </div>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="bg-emerald-50 text-emerald-800 text-[11px] font-black p-3.5 rounded-xl border border-emerald-100 text-center animate-fade-in">
            {successMsg}
          </div>
        )}

        {/* Main Inputs Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {/* Phone linking row */}
            <div className="p-4 flex flex-col gap-2 bg-white">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-slate-400" /> رقم الهاتف المحمول
                </span>
                {currentUser?.phone ? (
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                    <span>✓</span> مرتبط
                  </span>
                ) : (
                  <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                    غير مرتبط
                  </span>
                )}
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="أدخل رقم الهاتف مع رمز الدولة (مثال: +9665xxxxxxxx)"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-xs text-left outline-none focus:border-amber-500 font-mono"
                dir="ltr"
              />
            </div>

            {/* Email linking row */}
            <div className="p-4 flex flex-col gap-2 bg-white">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-slate-400" /> البريد الإلكتروني
                </span>
                {currentUser?.email ? (
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                    <span>✓</span> مرتبط
                  </span>
                ) : (
                  <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                    غير مرتبط
                  </span>
                )}
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="أدخل البريد الإلكتروني (مثال: example@domain.com)"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-xs text-left outline-none focus:border-amber-500 font-mono"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl transition-all shadow-sm active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSaving ? (
            <span>جاري الحفظ والربط...</span>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>حفظ وتأكيد عملية الربط</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
