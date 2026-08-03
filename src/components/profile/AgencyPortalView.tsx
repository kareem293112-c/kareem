import React, { useState, useEffect } from 'react';
import AgencyMissionStatsView from './AgencyMissionStatsView';
import { ChevronRight, Search, UserPlus, UserMinus, ShieldAlert, Users, Award, Trash2, Clock, Send, ArrowUpRight, DollarSign, Wallet, History, Calendar, TrendingUp, CheckCircle, XCircle, Info, ChevronDown } from 'lucide-react';
import { AppUser } from '../../types';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { doc, updateDoc, getDoc, collection, query, where, onSnapshot, addDoc, getDocs, deleteDoc } from 'firebase/firestore';

interface Props {
  onBack: () => void;
  currentUser: AppUser | null;
  users: AppUser[];
}

interface AgencyInfo {
  id: string;
  agency_name: string;
  owner_name: string;
  whatsapp_number: string;
  display_id?: string;
  owner_id: string;
  diamonds?: number;
}

export default function AgencyPortalView({ onBack, currentUser, users }: Props) {
  const [agency, setAgency] = useState<AgencyInfo | null>(null);
  const [loadingAgency, setLoadingAgency] = useState(true);
  const [members, setMembers] = useState<AppUser[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [searchId, setSearchId] = useState('');
  const [searchedUser, setSearchedUser] = useState<AppUser | null>(null);
  const [searchError, setSearchError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState<'hosts' | 'agency'>('hosts');
  const [historyRequests, setHistoryRequests] = useState<any[]>([]);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawingAgency, setWithdrawingAgency] = useState(false);
  const [payoutError, setPayoutError] = useState('');
  const [payoutSuccess, setPayoutSuccess] = useState('');
  const [isPayoutAccordionOpen, setIsPayoutAccordionOpen] = useState(false);
  const [isViewingMissionStats, setIsViewingMissionStats] = useState(false);

  // Agency owner confirmation states
  const [isAgencyConfirmOpen, setIsAgencyConfirmOpen] = useState(false);
  const [pendingAgencyAmount, setPendingAgencyAmount] = useState<number>(0);

  // Custom confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: (() => void | Promise<void>) | null;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });

  const triggerConfirmation = (title: string, message: string, onConfirm: () => void | Promise<void>) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm
    });
  };

  // 1. Fetch current user's Agency in real-time
  useEffect(() => {
    if (!currentUser?.id) return;

    const agenciesRef = collection(db, 'agencies');
    
    let unsubscribeDoc: (() => void) | null = null;
    let unsubscribeQuery: (() => void) | null = null;

    const handleAgencyData = (agencyData: any, id: string) => {
      setAgency({
        id,
        ...agencyData
      } as AgencyInfo);
      setLoadingAgency(false);
    };

    if (currentUser.displayId) {
      const docRef = doc(db, 'agencies', currentUser.displayId);
      unsubscribeDoc = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          handleAgencyData(docSnap.data(), docSnap.id);
        } else {
          // Fallback to query by owner_id
          const q = query(agenciesRef, where('owner_id', '==', currentUser.id));
          unsubscribeQuery = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
              const qSnap = snapshot.docs[0];
              handleAgencyData(qSnap.data(), qSnap.id);
            } else {
              setAgency(null);
              setLoadingAgency(false);
            }
          }, (err) => {
            setLoadingAgency(false);
          });
        }
      }, (err) => {
        // Fallback to query on error
        const q = query(agenciesRef, where('owner_id', '==', currentUser.id));
        unsubscribeQuery = onSnapshot(q, (snapshot) => {
          if (!snapshot.empty) {
            const qSnap = snapshot.docs[0];
            handleAgencyData(qSnap.data(), qSnap.id);
          } else {
            setAgency(null);
            setLoadingAgency(false);
          }
        }, (err) => {
          setLoadingAgency(false);
        });
      });
    } else {
      const q = query(agenciesRef, where('owner_id', '==', currentUser.id));
      unsubscribeQuery = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const qSnap = snapshot.docs[0];
          handleAgencyData(qSnap.data(), qSnap.id);
        } else {
          setAgency(null);
          setLoadingAgency(false);
        }
      }, (err) => {
        setLoadingAgency(false);
      });
    }

    return () => {
      if (unsubscribeDoc) unsubscribeDoc();
      if (unsubscribeQuery) unsubscribeQuery();
    };
  }, [currentUser?.id, currentUser?.displayId]);

  // 2. Fetch all agency members in real-time
  useEffect(() => {
    if (!currentUser?.id) return;

    const qIds = [currentUser.id];
    if (currentUser.displayId) {
      qIds.push(currentUser.displayId);
    }

    const q = query(collection(db, 'users'), where('agencyId', 'in', qIds));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const agencyMembers: AppUser[] = [];
      snapshot.forEach((doc) => {
        agencyMembers.push({ id: doc.id, ...doc.data() } as AppUser);
      });
      setMembers(agencyMembers);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "users");
    });

    return () => unsubscribe();
  }, [currentUser?.id, currentUser?.displayId]);

  // 3. Fetch pending invitations in real-time
  useEffect(() => {
    if (!currentUser?.id) return;

    const qIds = [currentUser.id];
    if (currentUser.displayId) {
      qIds.push(currentUser.displayId);
    }

    const q = query(
      collection(db, 'agency_invitations'),
      where('agency_id', 'in', qIds),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setPendingInvitations(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "agency_invitations");
    });

    return () => unsubscribe();
  }, [currentUser?.id, currentUser?.displayId]);

  // 4. Fetch host withdrawal/transfer requests under this agency in real-time
  useEffect(() => {
    if (!currentUser?.id) return;

    const qIds = [currentUser.id];
    if (currentUser.displayId) {
      qIds.push(currentUser.displayId);
    }

    const q = query(
      collection(db, 'withdrawal_requests'),
      where('agencyId', 'in', qIds),
      where('status', '==', 'approved_by_agency')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort locally by created_at descending
      list.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });
      setWithdrawalRequests(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "withdrawal_requests");
    });

    return () => unsubscribe();
  }, [currentUser?.id, currentUser?.displayId]);

  // 5. Fetch all withdrawal history for this agency in real-time
  useEffect(() => {
    if (!currentUser?.id) return;

    const qIds = [currentUser.id];
    if (currentUser.displayId) {
      qIds.push(currentUser.displayId);
    }

    const q = query(
      collection(db, 'withdrawal_requests'),
      where('agencyId', 'in', qIds)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort locally by created_at descending
      list.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });
      setHistoryRequests(list);
    }, (err) => {
      console.error("Error fetching withdrawal history:", err);
    });

    return () => unsubscribe();
  }, [currentUser?.id, currentUser?.displayId]);

  // Cancel invitation
  const handleCancelInvitation = async (invId: string) => {
    triggerConfirmation(
      'إلغاء دعوة الانضمام',
      'هل أنت متأكد من إلغاء دعوة الانضمام هذه؟',
      async () => {
        setActionError('');
        setActionSuccess('');

        try {
          await deleteDoc(doc(db, 'agency_invitations', invId));
          setActionSuccess('تم إلغاء دعوة الانضمام بنجاح.');
          setTimeout(() => setActionSuccess(''), 5000);
        } catch (err) {
          console.error("Error cancelling invitation:", err);
          setActionError('حدث خطأ أثناء إلغاء الدعوة.');
        }
      }
    );
  };

  // Handle Search for a target user to add
  const handleSearchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError('');
    setSearchedUser(null);

    const term = searchId.trim();
    if (!term) {
      setSearchError('الرجاء إدخال رقم الآيدي الخاص بالمستخدم.');
      return;
    }

    try {
      setIsSubmitting(true);
      let target: AppUser | null = null;
      
      // 1. Try finding by displayId
      const qDisplay = query(collection(db, 'users'), where('displayId', '==', term));
      const snapDisplay = await getDocs(qDisplay);
      
      if (!snapDisplay.empty) {
        const docSnap = snapDisplay.docs[0];
        target = { id: docSnap.id, ...docSnap.data() } as AppUser;
      } else {
        // 2. Try finding by originalDisplayId
        const qOrig = query(collection(db, 'users'), where('originalDisplayId', '==', term));
        const snapOrig = await getDocs(qOrig);
        if (!snapOrig.empty) {
          const docSnap = snapOrig.docs[0];
          target = { id: docSnap.id, ...docSnap.data() } as AppUser;
        } else {
          // 3. Try finding by Firestore document ID directly
          const userDocRef = doc(db, 'users', term);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            target = { id: userSnap.id, ...userSnap.data() } as AppUser;
          }
        }
      }

      if (!target) {
        setSearchError('عذراً، لم يتم العثور على أي مستخدم بهذا الآيدي.');
        return;
      }

      if (target.id === currentUser?.id) {
        if (target.agencyId === currentUser.id) {
          setSearchError('أنت مضاف بالفعل كمضيف في وكالتك الخاصة.');
          return;
        }
      } else if (target.agencyId) {
        setSearchError(`هذا المستخدم ينتمي بالفعل لوكالة أخرى (${target.agencyName || 'وكالة غير معروفة'}).`);
        return;
      }

      setSearchedUser(target);
    } catch (err) {
      console.error("Error searching user:", err);
      setSearchError('حدث خطأ أثناء البحث عن المستخدم في قاعدة البيانات.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add user to agency (Send invitation request)
  const handleAddMember = async () => {
    if (!searchedUser || !agency || !currentUser) return;
    setIsSubmitting(true);
    setActionError('');
    setActionSuccess('');

    try {
      if (searchedUser.id === currentUser.id) {
        // Add the owner to their own agency directly
        const userRef = doc(db, 'users', currentUser.id);
        await updateDoc(userRef, {
          agencyId: currentUser.id,
          agencyName: agency.agency_name
        });
        
        setActionSuccess(`تهانينا! لقد انضممت بنجاح كمضيف في وكالتك الخاصة (${agency.agency_name})`);
        setSearchedUser(null);
        setSearchId('');
        setTimeout(() => setActionSuccess(''), 5000);
      } else {
        // Check if there is already an active pending invitation for this user
        const q = query(
          collection(db, 'agency_invitations'),
          where('agency_id', '==', currentUser.id),
          where('target_user_id', '==', searchedUser.id),
          where('status', '==', 'pending')
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setActionError('تم إرسال دعوة بالفعل لهذا المستخدم وهي بانتظار موافقته.');
          return;
        }

        // Create pending invitation
        await addDoc(collection(db, 'agency_invitations'), {
          agency_id: currentUser.id,
          agency_name: agency.agency_name,
          owner_name: agency.owner_name,
          target_user_id: searchedUser.id,
          target_user_name: searchedUser.name,
          target_user_avatar: searchedUser.avatar || '',
          status: 'pending',
          timestamp: new Date().toISOString()
        });

        // Send a private message to the user about the invitation to their inbox
        try {
          await addDoc(collection(db, 'messages'), {
            senderId: currentUser.id,
            senderName: currentUser.name || agency.owner_name,
            senderAvatar: currentUser.avatar || '',
            receiverId: searchedUser.id,
            receiverName: searchedUser.name,
            text: `🏢 دعوة انضمام للوكالة: مرحباً ${searchedUser.name}، لقد أرسلت لك دعوة للانضمام إلى وكالتي المعتمدة (${agency.agency_name}). يرجى الانتقال إلى صفحتك الشخصية (الملف الشخصي) لقبل أو رفض الدعوة.`,
            isEncrypted: false,
            isRead: false,
            timestamp: new Date().toISOString(),
            participants: [currentUser.id, searchedUser.id]
          });
        } catch (msgErr) {
          console.error("Failed to send invitation notification message:", msgErr);
        }

        setActionSuccess(`تم إرسال دعوة الانضمام إلى (${searchedUser.name}) بنجاح! الطلب معلّق بانتظار موافقة المستخدم.`);
        setSearchedUser(null);
        setSearchId('');
        
        setTimeout(() => setActionSuccess(''), 6000);
      }
    } catch (err) {
      console.error("Error creating agency invitation:", err);
      setActionError('حدث خطأ أثناء إرسال الدعوة. الرجاء المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Remove user from agency
  const handleRemoveMember = async (targetUser: AppUser) => {
    triggerConfirmation(
      'طرد عضو من الوكالة',
      `هل أنت متأكد من طرد العضو (${targetUser.name}) من الوكالة؟`,
      async () => {
        setActionError('');
        setActionSuccess('');

        try {
          const userRef = doc(db, 'users', targetUser.id);
          await updateDoc(userRef, {
            agencyId: null,
            agencyName: null
          });

          setActionSuccess(`تم إزالة العضو (${targetUser.name}) من الوكالة بنجاح.`);
          setTimeout(() => setActionSuccess(''), 5000);
        } catch (err) {
          console.error("Error removing member from agency:", err);
          setActionError('حدث خطأ أثناء إزالة العضو.');
        }
      }
    );
  };

  // Transfer host withdrawal request to admin
  const handleTransferToAdmin = async (reqId: string) => {
    setActionError('');
    setActionSuccess('');
    try {
      const docRef = doc(db, 'withdrawal_requests', reqId);
      await updateDoc(docRef, {
        status: 'pending',
        transferred_at: new Date().toISOString()
      });
      setActionSuccess('🎉 تم تحويل طلب السحب بنجاح إلى الإدارة للمراجعة والصرف.');
      setTimeout(() => setActionSuccess(''), 5000);
    } catch (err) {
      console.error("Error transferring to admin:", err);
      setActionError('حدث خطأ أثناء تحويل الطلب للإدارة.');
    }
  };

  // Reject host withdrawal request at agency level and refund diamonds
  const handleRejectAgencyRequest = async (req: any) => {
    triggerConfirmation(
      'رفض طلب السحب',
      `هل أنت متأكد من رفض طلب السحب الخاص بـ (${req.userName}) وإرجاع الألماس لمحفظته؟`,
      async () => {
        setActionError('');
        setActionSuccess('');
        try {
          const userRef = doc(db, "users", req.userId);
          const reqRef = doc(db, "withdrawal_requests", req.id);

          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            setActionError('عذراً، لم يتم العثور على حساب المضيف.');
            return;
          }
          
          const userData = userSnap.data();
          const currentDiamonds = userData.diamonds || 0;
          const currentLocked = userData.lockedDiamonds || 0;
          
          const nextLocked = Math.max(0, currentLocked - req.diamonds_deducted);
          const nextDiamonds = currentDiamonds + req.diamonds_deducted;
          
          await updateDoc(userRef, {
            diamonds: nextDiamonds,
            lockedDiamonds: nextLocked
          });
          
          await updateDoc(reqRef, {
            status: 'rejected_by_agency',
            rejectedAt: new Date().toISOString()
          });

          setActionSuccess('تم رفض طلب السحب بنجاح وإعادة الألماس لرصيد المضيف.');
          setTimeout(() => setActionSuccess(''), 5000);
        } catch (err) {
          console.error("Error rejecting agency request:", err);
          setActionError('حدث خطأ أثناء رفض الطلب وإعادة الألماس.');
        }
      }
    );
  };

  // Submit withdrawal request of agency commission diamonds to the admin
  const handleAgencyPayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutError('');
    setPayoutSuccess('');

    if (!agency || !currentUser) return;
    
    const amount = parseInt(withdrawalAmount.trim());
    if (isNaN(amount) || amount <= 0) {
      setPayoutError('الرجاء إدخال كمية صحيحة أكبر من صفر.');
      return;
    }

    const currentAgencyDiamonds = agency.diamonds || 0;
    if (amount > currentAgencyDiamonds) {
      setPayoutError('عذراً، رصيد الوكالة غير كافٍ لإتمام هذه العملية.');
      return;
    }

    // Show custom confirmation modal instead of immediately submitting
    setPendingAgencyAmount(amount);
    setIsAgencyConfirmOpen(true);
  };

  const executeAgencyWithdrawal = async () => {
    setIsAgencyConfirmOpen(false);
    if (!agency || !currentUser || pendingAgencyAmount <= 0) return;

    setWithdrawingAgency(true);
    setPayoutError('');
    setPayoutSuccess('');

    try {
      const amount = pendingAgencyAmount;
      const currentAgencyDiamonds = agency.diamonds || 0;

      if (amount > currentAgencyDiamonds) {
        setPayoutError('عذراً، رصيد الوكالة غير كافٍ لإتمام هذه العملية.');
        setWithdrawingAgency(false);
        return;
      }

      // Use the loaded agency ID directly!
      const agencyDocId = agency.id;

      // Update agency balance: deduct diamonds
      const agencyRef = doc(db, 'agencies', agencyDocId);
      await updateDoc(agencyRef, {
        diamonds: currentAgencyDiamonds - amount
      });

      // Payout rate for agency commission: $80 per 100,000 diamonds (80% value payout: 60% host + 20% agency)
      const payoutUSD = (amount / 100000) * 80.00;

      // Create a withdrawal request document
      await addDoc(collection(db, "withdrawal_requests"), {
        userId: currentUser.id,
        userDisplayId: currentUser.displayId || currentUser.id,
        userName: `[رئيس الوكالة] ${agency.owner_name}`,
        diamonds_deducted: amount,
        withdrawal_usd: payoutUSD,
        platform_revenue_usd: 0,
        status: 'pending', // Directly goes to administration pending approval
        created_at: new Date().toISOString(),
        agencyId: currentUser.id,
        agencyName: agency.agency_name,
        agencyDisplayId: agency.display_id || null,
        isAgencyPayout: true
      });

      setPayoutSuccess(`🎉 تم تقديم طلب سحب عمولة الوكالة بقيمة $${payoutUSD.toFixed(2)} بنجاح وبانتظار موافقة الإدارة والصرف.`);
      setWithdrawalAmount('');
      setPendingAgencyAmount(0);
      setTimeout(() => setPayoutSuccess(''), 6000);
    } catch (err) {
      console.error("Error submitting agency payout:", err);
      setPayoutError('حدث خطأ أثناء تقديم طلب السحب.');
    } finally {
      setWithdrawingAgency(false);
    }
  };

  if (loadingAgency) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0a0a0f] text-slate-400">
        <p className="font-bold text-sm">جاري تحميل بيانات الوكالة...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-slate-200 font-cairo" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 bg-gradient-to-l from-indigo-900 to-[#0a0a0f] border-b border-white/10 sticky top-0 z-20">
        <button onClick={onBack} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition active:scale-95">
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
        <h2 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400">
          بوابة إدارة الوكالة
        </h2>
        <div className="w-10"></div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Agency Info Display */}
        {agency ? (
          <div className="bg-gradient-to-br from-indigo-800/40 to-indigo-900/40 border border-indigo-500/20 rounded-3xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute -top-10 -right-10 opacity-10 text-9xl pointer-events-none">🏢</div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                <Award className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">{agency.agency_name}</h3>
                <p className="text-xs text-indigo-200">الوكالة الرسمية المعتمدة</p>
              </div>
            </div>

            <div className="bg-black/30 rounded-2xl p-4 space-y-3.5 border border-black/20 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold">صاحب الوكالة:</span>
                <span className="text-slate-200 font-black">{agency.owner_name}</span>
              </div>
              <div className="flex justify-between items-center border-t border-white/5 pt-3">
                <span className="text-slate-400 font-bold">رقم الواتساب:</span>
                <span className="text-indigo-300 font-mono font-bold" dir="ltr">+{agency.whatsapp_number}</span>
              </div>
              <div className="flex justify-between items-center border-t border-white/5 pt-3">
                <span className="text-slate-400 font-bold">رقم الآيدي:</span>
                <span className="text-slate-400 font-mono font-bold">{agency.display_id || agency.id}</span>
              </div>
              <div className="flex justify-between items-center border-t border-white/5 pt-3">
                <span className="text-slate-400 font-bold">عدد الأعضاء الحاليين:</span>
                <span className="text-indigo-400 font-bold">{members.length} عضو</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-6 text-center space-y-3">
            <ShieldAlert className="w-10 h-10 text-red-400 mx-auto" />
            <h3 className="text-sm font-black text-white">لم يتم العثور على وكالة</h3>
            <p className="text-xs text-slate-400">يبدو أنه لم يتم إعطاء وكالة لهذا الحساب بعد أو هناك خطأ في الصلاحيات.</p>
          </div>
        )}

        {agency && (
          <>
            {/* Agency Wallet & History Card */}
            <div className="bg-gradient-to-br from-indigo-950 to-slate-900 border border-indigo-500/30 rounded-3xl p-5 shadow-xl space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/5 blur-3xl pointer-events-none rounded-full"></div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                  <h4 className="text-sm font-black text-white">المحفظة المالية للوكالة</h4>
                </div>
                
                <button
                  onClick={() => setIsViewingHistory(true)}
                  className="bg-indigo-500/10 hover:bg-indigo-500/20 active:scale-95 text-indigo-300 text-xs font-black px-3.5 py-1.5 rounded-full transition border border-indigo-500/20 flex items-center gap-1 cursor-pointer"
                >
                  <History className="w-3.5 h-3.5 text-indigo-400" />
                  <span>السجل السنوي ({historyRequests.length})</span>
                </button>
                <button
                  onClick={() => setIsViewingMissionStats(true)}
                  className="bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 text-emerald-300 text-xs font-black px-3.5 py-1.5 rounded-full transition border border-emerald-500/20 flex items-center gap-1 cursor-pointer"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>إحصائيات المهمات</span>
                </button>
              </div>

              {/* Balance display */}
              <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex justify-between items-center">
                <div className="text-right space-y-1">
                  <span className="text-[10px] text-slate-400 block font-bold">رصيد الوكالة الحالي (العمولات):</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-xl text-emerald-400">
                      {(agency.diamonds || 0).toLocaleString()}
                    </span>
                    <span className="text-xs text-emerald-300">💎 ألماس</span>
                  </div>
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-center">
                  <span className="text-[9px] text-emerald-400 block font-bold">القيمة التقريبية بالدولار</span>
                  <span className="font-mono font-black text-emerald-300 text-sm">
                    ${(((agency.diamonds || 0) / 100000) * 80.00).toFixed(2)} USD
                  </span>
                </div>
              </div>

              {/* Informative prompt explaining the 20% commission rule */}
              <div className="bg-white/5 rounded-xl p-3 flex gap-2 items-start border border-white/5">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-300 leading-relaxed font-semibold">
                  تحصل وكالتك تلقائياً على <span className="text-indigo-400 font-bold">20% عمولة</span> من إجمالي الألماس المسحوب من قبل مضيفيك بمجرد موافقة الإدارة على طلباتهم.
                </p>
              </div>

              {/* Payout Accordion Trigger */}
              <button
                onClick={() => setIsPayoutAccordionOpen(!isPayoutAccordionOpen)}
                className="w-full bg-white/5 hover:bg-white/10 active:scale-[0.99] border border-white/10 rounded-2xl p-3 flex justify-between items-center transition text-xs font-black text-slate-200"
              >
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-indigo-400" />
                  <span>سحب عمولات وأرباح الوكالة من الإدارة</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isPayoutAccordionOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Payout Form Accordion */}
              {isPayoutAccordionOpen && (
                <form onSubmit={handleAgencyPayoutSubmit} className="bg-black/30 border border-white/5 rounded-2xl p-4 space-y-3.5 animate-fade-in text-right">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 block font-bold">الكمية المراد سحبها بالألماس:</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={withdrawalAmount}
                        onChange={(e) => setWithdrawalAmount(e.target.value)}
                        placeholder="الحد الأدنى 1,000 💎"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-right text-white focus:border-indigo-500 outline-none pr-10 font-mono"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs">💎</span>
                    </div>
                  </div>

                  {withdrawalAmount && !isNaN(parseInt(withdrawalAmount)) && (
                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-2.5 text-center text-[10px] text-emerald-400 font-bold flex justify-between items-center">
                      <span>المستلم المستحق للإدارة:</span>
                      <span className="font-mono text-xs font-black">${((parseInt(withdrawalAmount) / 100000) * 80.00).toFixed(2)} USD</span>
                    </div>
                  )}

                  {payoutError && (
                    <p className="text-xs text-red-400 font-bold text-center bg-red-500/10 p-2 rounded-lg">{payoutError}</p>
                  )}
                  {payoutSuccess && (
                    <p className="text-xs text-emerald-400 font-bold text-center bg-emerald-500/10 p-2 rounded-lg">{payoutSuccess}</p>
                  )}

                  <button
                    type="submit"
                    disabled={withdrawingAgency || !withdrawalAmount}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-black text-xs py-3 rounded-xl transition duration-150 flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/20 cursor-pointer disabled:opacity-50"
                  >
                    <span>تقديم طلب سحب العمولات</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </div>
            {/* Add Member Section */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <UserPlus className="w-4 h-4 text-indigo-400" />
                <h4 className="text-sm font-black text-white">إضافة مستخدمين إلى الوكالة</h4>
              </div>

              <form onSubmit={handleSearchUser} className="flex gap-2">
                <input
                  type="text"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder="أدخل آيدي المستخدم (مثال: 1001)"
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-right text-white focus:border-indigo-500 outline-none"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-5 py-3 rounded-xl transition flex items-center gap-1.5 active:scale-95 shrink-0"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>بحث</span>
                </button>
              </form>

              {searchError && (
                <div className="text-red-400 text-xs font-bold bg-red-500/10 p-2.5 rounded-xl text-center">
                  {searchError}
                </div>
              )}

              {/* Searched User Result */}
              {searchedUser && (
                <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex items-center justify-between animate-fade-in">
                  <div className="flex items-center gap-3">
                    <img
                      src={searchedUser.avatar}
                      alt={searchedUser.name}
                      className="w-11 h-11 rounded-full object-cover bg-slate-800"
                    />
                    <div className="text-right space-y-0.5">
                      <h5 className="text-xs font-black text-white">{searchedUser.name}</h5>
                      <p className="text-[10px] text-slate-400">آيدي: {searchedUser.displayId || searchedUser.id}</p>
                    </div>
                  </div>

                  <button
                    onClick={handleAddMember}
                    disabled={isSubmitting}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black px-4 py-2.5 rounded-xl transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50"
                  >
                    <span>{searchedUser.id === currentUser?.id ? 'الانضمام لوكالتك كمضيف' : 'ضم للوكالة'}</span>
                  </button>
                </div>
              )}

              {actionError && (
                <div className="text-red-400 text-xs font-bold bg-red-500/10 p-2.5 rounded-xl text-center">
                  {actionError}
                </div>
              )}

              {actionSuccess && (
                <div className="text-emerald-400 text-xs font-bold bg-emerald-500/10 p-2.5 rounded-xl text-center">
                  {actionSuccess}
                </div>
              )}
            </div>

            {/* Pending Invitations Section */}
            {pendingInvitations.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                  <h4 className="text-sm font-black text-white">دعوات الانضمام المعلقة ({pendingInvitations.length})</h4>
                </div>

                <div className="divide-y divide-white/5 max-h-60 overflow-y-auto pr-1">
                  {pendingInvitations.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={inv.target_user_avatar || 'https://api.dicebear.com/7.x/bottts/svg'}
                          alt={inv.target_user_name}
                          className="w-10 h-10 rounded-full object-cover bg-slate-800"
                        />
                        <div className="text-right space-y-0.5">
                          <h5 className="text-xs font-black text-white">{inv.target_user_name}</h5>
                          <p className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                            <span>●</span> قيد الانتظار...
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleCancelInvitation(inv.id)}
                        className="p-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition active:scale-95"
                        title="إلغاء الدعوة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Members List */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-indigo-400" />
                <h4 className="text-sm font-black text-white">قائمة أعضاء الوكالة ({members.length})</h4>
              </div>

              {members.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4 font-bold">لا يوجد أي أعضاء مضافين في وكالتك حالياً.</p>
              ) : (
                <div className="divide-y divide-white/5 max-h-72 overflow-y-auto pr-1">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-10 h-10 rounded-full object-cover bg-slate-800"
                        />
                        <div className="text-right space-y-0.5">
                          <h5 className="text-xs font-black text-white">{member.name}</h5>
                          <p className="text-[9px] text-slate-400">آيدي: {member.displayId || member.id}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemoveMember(member)}
                        className="p-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition active:scale-95"
                        title="إزالة العضو"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Host Withdrawal/Transfer Requests Section */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-black text-white">التحويلات الواردة من مضيفيك لركيز الوكالة ({withdrawalRequests.length})</h4>
              </div>

              {withdrawalRequests.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4 font-bold">لا يوجد أي تحويلات واردة من مضيفيك حالياً.</p>
              ) : (
                <div className="space-y-3.5 max-h-96 overflow-y-auto pr-1">
                  {withdrawalRequests.map((req) => (
                    <div key={req.id} className="bg-black/30 border border-white/5 rounded-2xl p-4 space-y-3 animate-fade-in">
                      <div className="flex justify-between items-start border-b border-white/5 pb-2">
                        <div>
                          <h5 className="text-xs font-black text-white">{req.userName}</h5>
                          <p className="text-[10px] text-slate-400 font-bold">آيدي المضيف: {req.userDisplayId || req.userId}</p>
                        </div>
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold px-2.5 py-0.5 rounded-full">
                          تم استلام الرصيد بالوكالة
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="bg-white/5 p-2 rounded-xl text-right">
                          <span className="text-slate-400 block mb-0.5">رصيد الألماس المحول:</span>
                          <span className="font-mono font-black text-pink-400 text-xs">
                            {req.diamonds_deducted?.toLocaleString()} 💎
                          </span>
                        </div>
                        <div className="bg-white/5 p-2 rounded-xl text-right">
                          <span className="text-slate-400 block mb-0.5">القيمة المقابلة:</span>
                          <span className="font-mono font-black text-emerald-400 text-xs">
                            ${req.withdrawal_usd?.toFixed(2)} USD
                          </span>
                        </div>
                      </div>

                      <div className="text-[9px] text-slate-500 font-bold text-left">
                        تاريخ التحويل: {req.created_at ? new Date(req.created_at).toLocaleString('ar-EG') : 'غير متوفر'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Yearly History Overlay Modal */}
      {isViewingMissionStats && (
        <AgencyMissionStatsView 
          onBack={() => setIsViewingMissionStats(false)} 
          agencyMembers={members}
        />
      )}
      {isViewingHistory && (
        <div className="fixed inset-0 bg-[#07070a]/98 z-50 flex flex-col font-cairo overflow-hidden" dir="rtl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 bg-gradient-to-l from-indigo-900 to-[#07070a] border-b border-white/10 shrink-0">
            <button
              onClick={() => setIsViewingHistory(false)}
              className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition active:scale-95"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
            <h2 className="text-sm font-black text-white flex items-center gap-1.5">
              <History className="w-4 h-4 text-indigo-400" />
              <span>سجل السحوبات السنوي للوكالة (2026)</span>
            </h2>
            <div className="w-10"></div>
          </div>

          {/* Statistics summary for 2026 */}
          {(() => {
            const currentYear = 2026;
            const yearRequests = historyRequests.filter(req => {
              if (!req.created_at) return false;
              const reqYear = new Date(req.created_at).getFullYear();
              return reqYear === currentYear;
            });

            // Approved host withdrawals under the agency
            const approvedHostReqs = yearRequests.filter(req => !req.isAgencyPayout && (req.status === 'approved' || req.status === 'approved_by_agency'));
            const totalHostWithdrawnDiamonds = approvedHostReqs.reduce((sum, r) => sum + (r.diamonds_deducted || 0), 0);
            const totalHostWithdrawnUSD = approvedHostReqs.reduce((sum, r) => sum + (r.withdrawal_usd || 0), 0);

            // Approved agency payouts from admin
            const approvedAgencyPayouts = yearRequests.filter(req => req.isAgencyPayout && req.status === 'approved');
            const totalAgencyPayoutDiamonds = approvedAgencyPayouts.reduce((sum, r) => sum + (r.diamonds_deducted || 0), 0);
            const totalAgencyPayoutUSD = approvedAgencyPayouts.reduce((sum, r) => sum + (r.withdrawal_usd || 0), 0);

            // Pending agency payouts from admin
            const pendingAgencyPayouts = yearRequests.filter(req => req.isAgencyPayout && req.status === 'pending');
            const totalPendingAgencyPayoutUSD = pendingAgencyPayouts.reduce((sum, r) => sum + (r.withdrawal_usd || 0), 0);

            // Group by month to calculate monthly aggregates for 2026
            const monthlyStats = Array.from({ length: 12 }, (_, i) => {
              const monthName = new Date(currentYear, i).toLocaleString('ar-EG', { month: 'long' });
              const monthReqs = yearRequests.filter(req => {
                if (!req.created_at) return false;
                const date = new Date(req.created_at);
                return date.getMonth() === i;
              });

              const hostApproved = monthReqs.filter(r => !r.isAgencyPayout && (r.status === 'approved' || r.status === 'approved_by_agency'));
              const hostDiamonds = hostApproved.reduce((sum, r) => sum + (r.diamonds_deducted || 0), 0);
              const hostUSD = hostApproved.reduce((sum, r) => sum + (r.withdrawal_usd || 0), 0);

              const agencyApproved = monthReqs.filter(r => r.isAgencyPayout && r.status === 'approved');
              const agencyUSD = agencyApproved.reduce((sum, r) => sum + (r.withdrawal_usd || 0), 0);

              return {
                monthName,
                hostDiamonds,
                hostUSD,
                agencyUSD,
                hasData: hostDiamonds > 0 || agencyUSD > 0
              };
            });

            return (
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Visual Cards for 2026 total performance */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
                  <div className="flex items-center gap-1.5 mb-1 text-slate-300">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-black">أداء الوكالة الإجمالي في {currentYear}</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-black/30 p-3.5 rounded-2xl border border-white/5 text-right">
                      <span className="text-[9px] text-slate-400 block font-bold">سحب مضيفي الوكالة (المدفوع):</span>
                      <span className="font-mono text-sm font-black text-pink-400 block mt-1">
                        {totalHostWithdrawnDiamonds.toLocaleString()} 💎
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        (${totalHostWithdrawnUSD.toFixed(2)})
                      </span>
                    </div>

                    <div className="bg-black/30 p-3.5 rounded-2xl border border-white/5 text-right">
                      <span className="text-[9px] text-slate-400 block font-bold">سحوبات عمولات الوكالة (المدفوعة):</span>
                      <span className="font-mono text-sm font-black text-emerald-400 block mt-1">
                        ${totalAgencyPayoutUSD.toFixed(2)} USD
                      </span>
                      <span className="text-[9px] text-slate-500 block">
                        ({totalAgencyPayoutDiamonds.toLocaleString()} 💎)
                      </span>
                    </div>
                  </div>

                  {totalPendingAgencyPayoutUSD > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-3 rounded-2xl text-xs flex justify-between items-center font-bold">
                      <span>سحوبات الوكالة المعلقة عند الإدارة:</span>
                      <span className="font-mono text-sm font-black">${totalPendingAgencyPayoutUSD.toFixed(2)} USD</span>
                    </div>
                  )}
                </div>

                {/* Navigation Tabs inside logs */}
                <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 shrink-0">
                  <button
                    type="button"
                    onClick={() => setHistoryTab('hosts')}
                    className={`flex-1 py-3 text-xs font-black rounded-xl transition cursor-pointer ${
                      historyTab === 'hosts' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    سحوبات المضيفين على الوكالة
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryTab('agency')}
                    className={`flex-1 py-3 text-xs font-black rounded-xl transition cursor-pointer ${
                      historyTab === 'agency' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    سحوبات الوكالة من الإدارة
                  </button>
                </div>

                {/* Monthly breakdown accordion/list */}
                {historyTab === 'hosts' ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-black text-slate-400">تفاصيل جميع سحوبات المضيفين</h4>
                      <span className="text-[10px] text-slate-500">العدد: {yearRequests.filter(r => !r.isAgencyPayout).length}</span>
                    </div>

                    {yearRequests.filter(r => !r.isAgencyPayout).length === 0 ? (
                      <div className="text-center py-12 text-slate-500 text-xs font-bold">لا يوجد أي سحوبات للمضيفين في هذا العام حالياً.</div>
                    ) : (
                      <div className="space-y-3.5">
                        {yearRequests.filter(r => !r.isAgencyPayout).map((req) => (
                          <div key={req.id} className="bg-black/30 border border-white/5 rounded-2xl p-4 space-y-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <h5 className="text-xs font-black text-white">{req.userName}</h5>
                                <p className="text-[9px] text-slate-400 font-bold">آيدي المضيف: {req.userDisplayId}</p>
                              </div>

                              <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full border ${
                                req.status === 'approved' || req.status === 'approved_by_agency'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                  : req.status === 'pending' || req.status === 'pending_agency'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : 'bg-red-500/10 text-red-400 border-red-500/20'
                              }`}>
                                {req.status === 'approved' ? 'مقبول وتم الدفع' :
                                 req.status === 'approved_by_agency' ? 'مقبول وتم التحويل للوكالة' :
                                 req.status === 'pending' ? 'بانتظار موافقة الإدارة' :
                                 req.status === 'pending_agency' ? 'بانتظار تحويل الوكالة' : 'مرفوض'}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                              <div className="bg-white/5 p-2 rounded-xl text-right">
                                <span className="text-slate-400 block mb-0.5">الألماس المسحوب (التاركت):</span>
                                <span className="font-mono text-pink-400 font-bold">{req.diamonds_deducted?.toLocaleString()} 💎</span>
                              </div>
                              <div className="bg-white/5 p-2 rounded-xl text-right">
                                <span className="text-slate-400 block mb-0.5">مستحق المضيف (70%):</span>
                                <span className="font-mono text-emerald-400 font-bold">${req.withdrawal_usd?.toFixed(2)} USD</span>
                              </div>
                            </div>

                            <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold border-t border-white/5 pt-2">
                              <span>التاريخ: {req.created_at ? new Date(req.created_at).toLocaleDateString('ar-EG', {year: 'numeric', month: 'short', day: 'numeric'}) : '-'}</span>
                              <span>العمولة المقدرة للوكالة: <span className="text-indigo-400 font-black">+{Math.floor(req.diamonds_deducted * 0.20).toLocaleString()} 💎</span></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-black text-slate-400">تفاصيل سحوبات عمولات الوكالة من الإدارة</h4>
                      <span className="text-[10px] text-slate-500">العدد: {yearRequests.filter(r => r.isAgencyPayout).length}</span>
                    </div>

                    {yearRequests.filter(r => r.isAgencyPayout).length === 0 ? (
                      <div className="text-center py-12 text-slate-500 text-xs font-bold">لا توجد سحوبات للوكالة من الإدارة في هذا العام حالياً.</div>
                    ) : (
                      <div className="space-y-3.5">
                        {yearRequests.filter(r => r.isAgencyPayout).map((req) => (
                          <div key={req.id} className="bg-black/30 border border-white/5 rounded-2xl p-4 space-y-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <h5 className="text-xs font-black text-white flex items-center gap-1">سحب عمولات الوكالة</h5>
                                <p className="text-[9px] text-slate-400 font-bold">المستلم: {req.userName}</p>
                              </div>

                              <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full border ${
                                req.status === 'approved' 
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                  : req.status === 'pending'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : 'bg-red-500/10 text-red-400 border-red-500/20'
                              }`}>
                                {req.status === 'approved' ? 'مقبول وتم الصرف' :
                                 req.status === 'pending' ? 'معلق عند الإدارة' : 'مرفوض'}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                              <div className="bg-white/5 p-2 rounded-xl text-right">
                                <span className="text-slate-400 block mb-0.5">عدد ألماس العمولة:</span>
                                <span className="font-mono text-pink-400 font-bold">{req.diamonds_deducted?.toLocaleString()} 💎</span>
                              </div>
                              <div className="bg-white/5 p-2 rounded-xl text-right">
                                <span className="text-slate-400 block mb-0.5">القيمة المصروفة بالدولار:</span>
                                <span className="font-mono text-emerald-400 font-bold">${req.withdrawal_usd?.toFixed(2)} USD</span>
                              </div>
                            </div>

                            <div className="text-[9px] text-slate-500 font-bold border-t border-white/5 pt-2 text-right">
                              التاريخ: {req.created_at ? new Date(req.created_at).toLocaleDateString('ar-EG', {year: 'numeric', month: 'short', day: 'numeric'}) : '-'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Annual monthly analysis list */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-3">
                  <div className="flex items-center gap-1 text-slate-300 mb-1">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    <h4 className="text-xs font-black">التقرير الشهري المفصل لعام {currentYear}</h4>
                  </div>

                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {monthlyStats.map((stat, i) => (
                      <div key={i} className={`p-3 rounded-2xl flex justify-between items-center text-xs ${
                        stat.hasData ? 'bg-indigo-500/5 border border-indigo-500/10' : 'bg-black/20 border border-transparent opacity-50'
                      }`}>
                        <div className="text-right">
                          <span className="font-black text-white">{stat.monthName}</span>
                          {stat.hasData && (
                            <p className="text-[9px] text-slate-400">سحوبات مضيفين: {stat.hostDiamonds.toLocaleString()} 💎</p>
                          )}
                        </div>

                        {stat.hasData ? (
                          <div className="text-left">
                            <span className="font-black text-emerald-400 block">${(stat.hostUSD + stat.agencyUSD).toFixed(2)} USD</span>
                            <span className="text-[9px] text-indigo-300 block">منها عمولة للوكالة: ${stat.agencyUSD.toFixed(2)}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-bold">لا يوجد نشاط</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl text-right animate-scale-up">
            <h3 className="text-sm font-black text-white">{confirmModal.title}</h3>
            <p className="text-xs text-slate-300 font-bold leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={async () => {
                  const onConfirmFunc = confirmModal.onConfirm;
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  if (onConfirmFunc) {
                    await onConfirmFunc();
                  }
                }}
                className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-[11px] font-black py-2.5 rounded-xl transition active:scale-95 cursor-pointer"
              >
                تأكيد العملية
              </button>
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false, onConfirm: null }))}
                className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-bold py-2.5 rounded-xl transition border border-white/10 active:scale-95 cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Agency Withdrawal Confirmation Popup */}
      {isAgencyConfirmOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/85 z-[100] animate-fade-in backdrop-blur-sm"
            onClick={() => setIsAgencyConfirmOpen(false)}
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
            <div className="bg-[#121118] border border-white/10 rounded-[28px] max-w-sm w-full p-6 shadow-2xl space-y-5 text-right font-sans animate-scale-up" dir="rtl">
              
              {/* Header */}
              <div className="border-b border-white/5 pb-3">
                <h3 className="font-black text-base text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-400 to-orange-400">
                  تأكيد طلب السحب المالي للوكالة
                </h3>
              </div>

              {/* Layout Content */}
              <div className="space-y-3.5 text-xs text-slate-300">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <p className="font-semibold text-slate-400 mb-1">الآيدي الحقيقي للحساب المالك:</p>
                  <p className="font-mono text-sm font-black text-amber-300">
                    {currentUser?.displayId || currentUser?.id}
                  </p>
                </div>

                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <p className="font-semibold text-slate-400 mb-1">اسم الوكالة:</p>
                  <p className="text-sm font-black text-indigo-400">
                    {agency?.agency_name}
                  </p>
                </div>

                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <p className="font-semibold text-slate-400 mb-1">الألماس المراد سحبه من العمولات:</p>
                  <p className="font-mono text-sm font-black text-pink-400">
                    {pendingAgencyAmount.toLocaleString()} 💎
                  </p>
                </div>

                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <p className="font-semibold text-slate-400 mb-1">المبلغ المستحق بالدولار للوكالة (90%):</p>
                  <p className="font-mono text-sm font-black text-emerald-400">
                    ${((pendingAgencyAmount / 100000) * 90).toFixed(2)} USD
                  </p>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-3 rounded-xl text-[10px] leading-relaxed font-bold">
                  ⚠️ تنبيه: سيتم إرسال طلب سحب العمولات الخاص بوكالتك مباشرة للإدارة للمراجعة، وسيتم تحويل المستحقات يدوياً فور موافقة الإدارة.
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={executeAgencyWithdrawal}
                  className="w-full py-3.5 bg-gradient-to-l from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 active:scale-[0.98] text-slate-950 font-black text-xs rounded-xl shadow-[0_4px_15px_rgba(245,158,11,0.25)] transition duration-200 cursor-pointer text-center"
                >
                  إرسال الطلب للإدارة
                </button>
                
                <button
                  onClick={() => setIsAgencyConfirmOpen(false)}
                  className="w-full py-3.5 bg-white/5 hover:bg-white/10 active:scale-[0.98] text-slate-300 hover:text-white font-bold text-xs rounded-xl transition duration-200 cursor-pointer text-center"
                >
                  إلغاء
                </button>
              </div>

            </div>
          </div>
        </>
      )}

    </div>
  );
}
