import React, { useState, useEffect } from 'react';
import { ChevronRight, Trash2, Heart, MessageSquare, Plus, AlertCircle, Sparkles } from 'lucide-react';
import { AppUser } from '../../types';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, doc, query, onSnapshot, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

interface Moment {
  id: string;
  text: string;
  timestamp: string;
  likes: number;
  commentsCount: number;
  likedBy?: string[];
}

interface Props {
  onBack: () => void;
  currentUser: AppUser | null;
}

export default function MyPostsView({ onBack, currentUser }: Props) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const container = document.getElementById('smartphone-screen') || document.querySelector('.overflow-y-auto');
    if (container) {
      container.scrollTop = 0;
    }
  }, []);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [newMomentText, setNewMomentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) return;

    const q = query(collection(db, `users/${currentUser.id}/moments`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbMoments = snapshot.docs.map(doc => doc.data() as Moment);
      if (dbMoments.length === 0) {
        // Set some default pretty moments if they have none
        setMoments([
          {
            id: 'default-1',
            text: 'أهلاً بكم في صفحتي الشخصية على صدى العرب! 🌟 يسعدني تواجدكم ومشاركتي لحظاتي الجميلة.',
            timestamp: 'منذ يومين',
            likes: 12,
            commentsCount: 3,
            likedBy: []
          },
          {
            id: 'default-2',
            text: 'مجلس اليوم كان رائعاً جداً وممتلئاً بالضحك والأوقات الطيبة مع الأصدقاء. شكراً لكل من حضر ودعم المايك! 🎙️✨',
            timestamp: 'منذ ٣ أيام',
            likes: 18,
            commentsCount: 5,
            likedBy: []
          }
        ]);
      } else {
        setMoments(dbMoments.sort((a, b) => b.id.localeCompare(a.id)));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${currentUser.id}/moments`);
    });

    return () => unsubscribe();
  }, [currentUser?.id]);

  const handlePostMoment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMomentText.trim() || !currentUser?.id) return;

    setIsSubmitting(true);
    const newMoment: Moment = {
      id: `moment_${Date.now()}`,
      text: newMomentText,
      timestamp: 'الآن',
      likes: 0,
      commentsCount: 0,
      likedBy: []
    };

    try {
      await setDoc(doc(db, `users/${currentUser.id}/moments`, newMoment.id), newMoment);
      setNewMomentText('');
    } catch (err) {
      console.error('Error posting moment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMoment = async (id: string) => {
    if (!currentUser?.id) return;
    try {
      await deleteDoc(doc(db, `users/${currentUser.id}/moments`, id));
    } catch (err) {
      console.error('Error deleting moment:', err);
    }
  };

  const handleToggleLike = async (moment: Moment) => {
    if (!currentUser?.id) return;
    try {
      const currentLikedBy = moment.likedBy || [];
      const alreadyLiked = currentLikedBy.includes(currentUser.id);
      const updatedLikedBy = alreadyLiked 
        ? currentLikedBy.filter(uid => uid !== currentUser.id)
        : [...currentLikedBy, currentUser.id];
      const newLikesCount = alreadyLiked 
        ? Math.max(0, moment.likes - 1)
        : moment.likes + 1;

      const momentRef = doc(db, `users/${currentUser.id}/moments`, moment.id);
      await setDoc(momentRef, {
        ...moment,
        likes: newLikesCount,
        likedBy: updatedLikedBy
      }, { merge: true });
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  return (
    <div className="flex-grow flex flex-col bg-slate-50 min-h-full" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-l from-indigo-900 to-purple-800 text-white pt-8 pb-5 px-4 shadow-md flex items-center justify-between">
        <h2 className="font-black text-base flex items-center gap-1.5">
          <Sparkles className="w-5 h-5 text-yellow-300" />
          منشوراتي ولحظاتي
        </h2>
        <button onClick={onBack} className="p-1 hover:bg-white/10 rounded-full transition">
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto w-full flex-grow overflow-y-auto pb-10">
        {/* Create Moment Box */}
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 space-y-3">
          <h3 className="text-xs font-black text-slate-800 flex items-center gap-1">
            <span>✨</span> شارك ما يدور في ذهنك اليوم...
          </h3>
          <form onSubmit={handlePostMoment} className="space-y-3">
            <textarea
              value={newMomentText}
              onChange={(e) => setNewMomentText(e.target.value)}
              placeholder="اكتب لحظة جديدة، خاطرة، أو إعلان لغرفتك الصوتية..."
              maxLength={250}
              className="w-full h-24 bg-slate-50 border border-slate-100 rounded-2xl p-3 text-xs outline-none focus:ring-2 focus:ring-purple-500/20 focus:bg-white transition-all text-right resize-none text-slate-700 font-semibold"
            />
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-mono">{newMomentText.length}/250</span>
              <button
                type="submit"
                disabled={isSubmitting || !newMomentText.trim()}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-100 disabled:to-slate-100 text-white disabled:text-slate-400 font-black text-xs px-5 py-2 rounded-xl transition shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>نشر اللحظة</span>
              </button>
            </div>
          </form>
        </div>

        {/* List of Moments */}
        <div className="space-y-3">
          <h3 className="text-xs font-black text-slate-500 mr-1">جميع لحظاتي المنشورة ({moments.length})</h3>
          
          {moments.map((moment) => {
            const hasLiked = currentUser?.id && moment.likedBy?.includes(currentUser.id);
            return (
              <div 
                key={moment.id} 
                className="bg-white rounded-3xl p-4 shadow-xs border border-slate-100 space-y-3 relative group"
              >
                {/* Author Info & Date */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img 
                      src={currentUser?.avatar || "https://api.dicebear.com/7.x/adventurer/svg"} 
                      className="w-8 h-8 rounded-full border border-slate-100" 
                      alt="" 
                    />
                    <div>
                      <span className="text-xs font-black text-slate-800 block">{currentUser?.name || "مستكشف صدى"}</span>
                      <span className="text-[8px] text-slate-400 font-bold block">{moment.timestamp}</span>
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button 
                    onClick={() => handleDeleteMoment(moment.id)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="حذف اللحظة"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Content text */}
                <p className="text-xs text-slate-700 leading-relaxed font-semibold whitespace-pre-wrap">
                  {moment.text}
                </p>

                {/* Likes / Comments Counts */}
                <div className="flex items-center gap-4 border-t border-slate-50 pt-2.5 text-[10px] text-slate-400 font-bold">
                  <button 
                    onClick={() => handleToggleLike(moment)}
                    className={`flex items-center gap-1 hover:text-red-500 transition cursor-pointer ${hasLiked ? 'text-red-500' : 'text-slate-400'}`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${hasLiked ? 'fill-red-500 text-red-500' : ''}`} />
                    <span className="font-mono">{moment.likes}</span>
                  </button>

                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-300" />
                    <span className="font-mono">{moment.commentsCount}</span>
                  </span>
                </div>
              </div>
            );
          })}

          {moments.length === 0 && (
            <div className="bg-white rounded-3xl p-8 text-center text-slate-400 space-y-2 border border-dashed border-slate-200">
              <span className="text-3xl block">💭</span>
              <p className="text-xs font-bold text-slate-500">لا يوجد لديك منشورات بعد</p>
              <p className="text-[10px] text-slate-400 leading-relaxed">اكتب وانشر لحظتك الأولى لتظهر هنا وفي حسابك الشخصي للجميع!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
