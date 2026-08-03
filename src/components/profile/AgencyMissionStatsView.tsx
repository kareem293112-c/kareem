import React, { useState, useEffect } from 'react';
import { AppUser } from '../../types';
import { ChevronRight, Award, Users, TrendingUp } from 'lucide-react';

interface Props {
  onBack: () => void;
  agencyMembers: AppUser[];
}

export default function AgencyMissionStatsView({ onBack, agencyMembers }: Props) {
  const [stats, setStats] = useState({
    completedHosts: [] as AppUser[],
    totalPotentialEarnings: 0
  });

  useEffect(() => {
    // Filter members who completed the 15-day mission
    const completed = agencyMembers.filter(member => 
      (member.hostMissionDaysCompleted || 0) >= 15 && member.hostMissionClaimed
    );
    
    // Each completed mission earns 3000 diamonds (5 USD) for the agency owner
    const totalEarnings = completed.length * 3000;

    setStats({
      completedHosts: completed,
      totalPotentialEarnings: totalEarnings
    });
  }, [agencyMembers]);

  return (
    <div className="fixed inset-0 bg-[#07070a]/98 z-50 flex flex-col font-cairo" dir="rtl">
      <div className="flex items-center justify-between px-4 py-4 bg-gradient-to-l from-indigo-900 to-[#07070a] border-b border-white/10 shrink-0">
        <button onClick={onBack} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition active:scale-95">
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
        <h2 className="text-sm font-black text-white flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span>إحصائيات إنجاز المضيفين</span>
        </h2>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="bg-gradient-to-br from-indigo-950 to-slate-900 border border-indigo-500/30 rounded-3xl p-5 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
              <Award className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold">إجمالي أرباح الوكيل من المهمات</p>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-black text-xl text-emerald-400">{stats.totalPotentialEarnings.toLocaleString()}</span>
                <span className="text-xs text-emerald-300">💎 ألماس</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-indigo-400" />
            <h4 className="text-sm font-black text-white">المضيفون الذين أتموا المهمة ({stats.completedHosts.length})</h4>
          </div>

          <div className="divide-y divide-white/5 max-h-96 overflow-y-auto pr-1">
            {stats.completedHosts.map((host) => (
              <div key={host.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <img src={host.avatar} alt={host.name} className="w-10 h-10 rounded-full object-cover bg-slate-800" />
                  <div className="text-right space-y-0.5">
                    <h5 className="text-xs font-black text-white">{host.name}</h5>
                    <p className="text-[9px] text-slate-400">آيدي: {host.displayId || host.id}</p>
                  </div>
                </div>
                <div className="text-left">
                  <span className="text-emerald-400 text-[10px] font-black bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">تم الإنجاز</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
