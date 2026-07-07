import React from 'react';
import { Check } from 'lucide-react';
import { MASTERY_THRESHOLD } from '../constants';

// BKT parameters (same as backend DEFAULT_PARAMS)
const BKT_PARAMS = {
  p_l0: 0.30,    // Prior knowledge
  p_t: 0.10,     // Transition/Learning
  p_g: 0.25,     // Guess
  p_s: 0.10,     // Slip
};

// One BKT skill progress card for the dashboard grid.
const SkillCard = ({ label, value, showDetails = false }) => {
  const masteryValue = value;
  const isMastered = masteryValue >= MASTERY_THRESHOLD;
  const percentage = Math.round(masteryValue * 100);

  if (showDetails) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
        <div>
          <h3 className="font-semibold text-lg text-slate-100">{label}</h3>
          <span className="text-xs text-slate-400 mt-1 block">BKT Component Values</span>
        </div>

        <div className="space-y-3 mt-2">
          {/* P(Know) - Mastery */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-semibold text-slate-300">Knowledge</span>
              <span className="text-xs font-bold text-indigo-400">
                {(masteryValue * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                style={{ width: `${masteryValue * 100}%` }}
              />
            </div>
          </div>

          {/* P(Slip) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-semibold text-slate-300">Slip</span>
              <span className="text-xs font-bold text-rose-400">
                {(BKT_PARAMS.p_s * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full"
                style={{ width: `${BKT_PARAMS.p_s * 100}%` }}
              />
            </div>
          </div>

          {/* P(Guess) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-semibold text-slate-300">Guess</span>
              <span className="text-xs font-bold text-amber-400">
                {(BKT_PARAMS.p_g * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full"
                style={{ width: `${BKT_PARAMS.p_g * 100}%` }}
              />
            </div>
          </div>

          {/* P(Transition) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-semibold text-slate-300">Transition</span>
              <span className="text-xs font-bold text-cyan-400">
                {(BKT_PARAMS.p_t * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                style={{ width: `${BKT_PARAMS.p_t * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

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
