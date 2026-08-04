import React, { useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { signOut } from 'firebase/auth';

export default function SettingsView({ onBack, currentUser }: any) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const container = document.getElementById('smartphone-screen') || document.querySelector('.overflow-y-auto');
    if (container) {
      container.scrollTop = 0;
    }
  }, []);
  const handleLogout = async () => {
    localStorage.removeItem('sada_last_login');
    localStorage.removeItem('sada_bound_uid');
    try {
      await signOut(auth);
    } catch (e) {}
    window.location.reload();
  };

  const handleClearCache = () => {
    sessionStorage.clear();
    alert('تم مسح جميع الكاش المؤقت والذاكرة المحلية بنجاح!');
    window.location.reload();
  };

  return (
    <div className="flex-grow flex flex-col bg-slate-50" dir="rtl">
      <div className="bg-white p-4 flex items-center justify-between shadow-sm relative z-10">
        <h2 className="font-bold text-lg text-slate-800">الإعدادات</h2>
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition">
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      <div className="mt-2 bg-white flex-grow">
        <div className="space-y-1 p-2">
          {['تعديل البيانات الشخصية', 'إعدادات اللغة', 'قائمة الحظر', 'عننا'].map((item, i) => (
             <button key={i} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition border-b border-slate-100">
                <span className="text-sm font-semibold text-slate-700">{item}</span>
             </button>
          ))}
        </div>
        
        <div className="p-4 mt-8 space-y-3">
          <button 
            onClick={handleClearCache}
            className="w-full py-3.5 bg-amber-50 text-amber-700 rounded-full font-bold text-sm hover:bg-amber-100 transition border border-amber-200"
          >
            مسح الكاش المؤقت والذاكرة
          </button>

          <button 
            onClick={handleLogout}
            className="w-full py-3.5 bg-red-50 text-red-500 rounded-full font-bold text-sm hover:bg-red-100 transition"
          >
            تسجيل خروج
          </button>
        </div>
      </div>
    </div>
  );
}
