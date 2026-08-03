import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc, updateDoc } from 'firebase/firestore';

export default function SupportView({ onBack, currentUser, setSupportChatOpen, activeSupportTicket }: any) {
  const issues = [
    'مشكلة إعادة الشحن',
    'مشكلة التطبيق',
    'اقتراحات الميزة',
    'مشاكل أخرى'
  ];

  const handleIssueSelect = async (issueText: string) => {
    // Open chat
    setSupportChatOpen(true);
    // Here you would ideally send the first message, but since it's global, we just open the chat drawer.
  };

  return (
    <div className="flex-grow flex flex-col bg-slate-50" dir="rtl">
      <div className="bg-white p-4 flex items-center justify-between shadow-sm relative z-10">
        <h2 className="font-bold text-lg text-slate-800">الأسئلة والاقتراحات</h2>
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition">
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      <div className="bg-orange-50 px-4 py-2">
         <span className="text-xs text-orange-600 font-bold">الرجاء تحديد مشكلتك</span>
      </div>

      <div className="bg-white flex-grow">
        <div className="space-y-1">
          {issues.map((item, i) => (
             <button 
               key={i} 
               onClick={() => handleIssueSelect(item)}
               className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition border-b border-slate-100"
             >
                <span className="text-sm font-semibold text-slate-700">{item}</span>
                <ChevronRight className="w-4 h-4 text-slate-300" />
             </button>
          ))}
        </div>
      </div>
      
      {/* Footer quick link to chat */}
      <div className="p-4 bg-white border-t border-slate-100">
         <button onClick={() => setSupportChatOpen(true)} className="w-full py-3.5 bg-amber-500 text-white rounded-full font-bold text-sm hover:bg-amber-600 transition shadow-sm">
            الدعم المباشر (خدمة العملاء الذكية) 🎧
         </button>
      </div>
    </div>
  );
}
