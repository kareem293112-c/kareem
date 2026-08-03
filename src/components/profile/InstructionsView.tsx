import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Info, HelpCircle, BookOpen, Star, Mic, ShieldCheck, Heart } from 'lucide-react';

interface Props {
  onBack: () => void;
}

export default function InstructionsView({ onBack }: Props) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const container = document.getElementById('smartphone-screen') || document.querySelector('.overflow-y-auto');
    if (container) {
      container.scrollTop = 0;
    }
  }, []);
  const [openSection, setOpenSection] = useState<number | null>(0);

  const sections = [
    {
      title: '🎙️ الغرف والمجالس الصوتية',
      icon: <Mic className="w-4 h-4 text-purple-400" />,
      content: (
        <div className="space-y-2 text-slate-300 text-xs font-semibold leading-relaxed">
          <p>
            • غرف صدى العرب الصوتية هي مجالس حية تجمعك بأصدقائك والزوار للمحادثة الفورية وتبادل الهدايا والأنشطة الترفيهية الممتعة.
          </p>
          <p>
            • <strong className="text-purple-300">مالك المجلس والمشرفون:</strong> يملكون كامل الصلاحية لقفل المقاعد، كتم صوت المتحدثين، طرد أو حظر أي مستخدم مخالف لقوانين المنصة.
          </p>
          <p>
            • <strong className="text-purple-300">المقاعد التسعة:</strong> المقعد 0 هو الميكروفون الرئيسي المخصص لمضيف الجلسة، والمقاعد من 1 إلى 8 للضيوف والمشاركين.
          </p>
        </div>
      )
    },
    {
      title: '🎖️ المستويات ونقاط الخبرة (XP)',
      icon: <Star className="w-4 h-4 text-amber-400" />,
      content: (
        <div className="space-y-2 text-slate-300 text-xs font-semibold leading-relaxed">
          <p>
            • ينقسم نظام المستويات لدينا إلى رتبتين فخمتين: <strong className="text-amber-300">مستوى الثروة (Wealth Level)</strong> و <strong className="text-amber-300">مستوى الشعبية (Popularity Level)</strong>.
          </p>
          <p>
            • <strong className="text-amber-300">مستوى الثروة:</strong> يرتفع تلقائياً عند إرسالك الهدايا المبهجة والفاخرة للمستخدمين والمايكات في الغرف.
          </p>
          <p>
            • <strong className="text-amber-300">مستوى الشعبية:</strong> يرتفع عند استلامك للهدايا والإعجابات والمتابعات والورود من أصدقائك والمعجبين بصوتك وأسلوبك.
          </p>
        </div>
      )
    },
    {
      title: '🏢 نظام الوكالات والبوابات المعتمدة',
      icon: <BookOpen className="w-4 h-4 text-indigo-400" />,
      content: (
        <div className="space-y-2 text-slate-300 text-xs font-semibold leading-relaxed">
          <p>
            • <strong className="text-indigo-300">بوابة إدارة الوكالة:</strong> مخصصة لمالكي الوكالات المعتمدين لتوظيف المذيعين والمواهب، ومتابعة ساعات البث والتقارير المالية اليومية بدقة.
          </p>
          <p>
            • <strong className="text-indigo-300">الإنضمام لوكالة:</strong> يمنح المذيعين حوافز ومكافآت شهرية إضافية وهدايا خاصة بناءً على الأداء والدعم المتبادل.
          </p>
          <p>
            • لا يجوز للمستخدم العادي الانضمام لأكثر من وكالة واحدة في نفس الوقت لضمان بيئة مهنية عادلة للجميع.
          </p>
        </div>
      )
    },
    {
      title: '🔒 حماية الحساب وربط الحسابات',
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
      content: (
        <div className="space-y-2 text-slate-300 text-xs font-semibold leading-relaxed">
          <p>
            • ننصح جميع أعضائنا الكرام بزيارة صفحة <strong className="text-emerald-300">"ربط الحساب"</strong> وربط حسابهم بـ البريد الإلكتروني أو الهاتف المحمول فوراً.
          </p>
          <p>
            • الحسابات المرتبطة تتمتع بحماية أمنية مضاعفة وحصانة تامة ضد الضياع، بالإضافة إلى سهولة استعادتها بأي وقت في حال تبديل جهاز الهاتف.
          </p>
        </div>
      )
    },
    {
      title: '💖 الاتصال والشركاء المقربين (CP)',
      icon: <Heart className="w-4 h-4 text-rose-400" />,
      content: (
        <div className="space-y-2 text-slate-300 text-xs font-semibold leading-relaxed">
          <p>
            • بإمكانك ربط اتصال CP (Partner) مع صديقك المقرب ليظهر شعار الشراكة الوثيق بملفك الشخصي ويحتسب أيام صداقتكم المستمرة.
          </p>
          <p>
            • يتم تفعيل الاتصال بموافقة الطرفين من خلال الضغط على زر "طلب اتصال CP" في الملف الشخصي للمستخدم المستهدف.
          </p>
        </div>
      )
    }
  ];

  const toggleSection = (idx: number) => {
    setOpenSection(openSection === idx ? null : idx);
  };

  return (
    <div className="flex-grow flex flex-col bg-[#05030f] text-white min-h-full" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-l from-purple-900 to-indigo-900 pt-8 pb-5 px-4 shadow-md flex items-center justify-between">
        <h2 className="font-black text-base flex items-center gap-1.5 text-white">
          <HelpCircle className="w-5 h-5 text-purple-400" />
          مركز التعليمات والتعريف
        </h2>
        <button onClick={onBack} className="p-1 hover:bg-white/10 rounded-full transition">
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto w-full flex-grow overflow-y-auto pb-10">
        
        {/* Intro */}
        <div className="text-center space-y-2 py-3">
          <div className="text-4xl">📜</div>
          <h3 className="font-black text-sm text-slate-200">دليل المستخدم لصدى العرب</h3>
          <p className="text-[11px] text-slate-400 font-semibold leading-relaxed px-4">
            تصفح المواضيع والتعليمات التوضيحية أدناه لمعرفة تفاصيل وآليات العمل في صدى العرب بكل سهولة ويسر.
          </p>
        </div>

        {/* Accordions */}
        <div className="space-y-2.5">
          {sections.map((sec, idx) => {
            const isOpen = openSection === idx;
            return (
              <div 
                key={idx} 
                className="bg-[#120f26] border border-white/5 rounded-2xl overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => toggleSection(idx)}
                  className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-all text-right cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-white/5 rounded-lg">
                      {sec.icon}
                    </div>
                    <span className="text-xs font-black text-slate-100">{sec.title}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                  <div className="p-4 border-t border-white/5 bg-[#0e0c1f] animate-fade-in">
                    {sec.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Support Link Button */}
        <div className="bg-gradient-to-r from-purple-950 to-[#221035] rounded-3xl p-4 text-center border border-purple-500/10 space-y-2.5 mt-4">
          <span className="text-xl">💬</span>
          <h4 className="text-xs font-black text-purple-300">لم تجد إجابة على استفسارك؟</h4>
          <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
            تواصل مباشرة مع المشرفين المعتمدين وفريق الدعم الفني لصدى العرب عبر تقديم تذكرة اقتراحات أو شكوى!
          </p>
        </div>

      </div>
    </div>
  );
}
