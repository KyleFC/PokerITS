import React from 'react';
import { Check } from 'lucide-react';
import { MASTERY_THRESHOLD } from '../constants';

// One BKT skill progress card for the dashboard grid.
const SkillCard = ({ label, value }) => {
  const isMastered = value >= MASTERY_THRESHOLD;
  const percentage = Math.round(value * 100);

  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 shadow-xl hover:shadow-indigo-500/5 transition flex flex-col gap-4 group">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-lg text-slate-100 group-hover:text-indigo-400 transition">{label}</h3>
          <span className="text-xs text-slate-400 mt-1 block">BKT Mastery Estimate</span>
        </div>
        {isMastered ? (
          <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-1 rounded-full border border-emerald-500/20 font-semibold flex items-center gap-1.5 shadow-sm">
            <Check className="h-3 w-3" /> Mastered
          </span>
        ) : (
          <span className="bg-amber-500/10 text-amber-400 text-xs px-2.5 py-1 rounded-full border border-amber-500/20 font-semibold shadow-sm">
            Learning
          </span>
        )}
      </div>

      <div className="mt-2">
        <div className="flex justify-between items-end mb-1.5 text-xs font-semibold">
          <span className="text-slate-400">Progress</span>
          <span className="text-indigo-400">{percentage}%</span>
        </div>
        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isMastered ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default SkillCard;
