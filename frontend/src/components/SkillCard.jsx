import React from 'react';
import { Check } from 'lucide-react';
import { isMastered as isMasteredGate, MASTERY_MIN_OBSERVATIONS } from '../constants';

// Fallback BKT params for the detail view when a per-skill set isn't supplied.
const DEFAULT_BKT_PARAMS = { p_l0: 0.30, p_t: 0.06, p_g: 0.40, p_s: 0.10 };

// One BKT skill progress card for the dashboard grid. `observationCount` gates
// the "Mastered" badge (a high estimate on too little evidence isn't mastery);
// `params` supplies the per-skill BKT values for the detail view.
const SkillCard = ({ label, value, observationCount, params, showDetails = false }) => {
  const masteryValue = value;
  const bkt = params || DEFAULT_BKT_PARAMS;
  const isMastered = isMasteredGate(masteryValue, observationCount);
  const percentage = Math.round(masteryValue * 100);

  // A brand-new account's number is the BKT prior P(L0) — the model's starting
  // assumption before it has seen a single answer. Drawing that as a filled
  // "Progress" bar reads as progress the student never made; a tester assumed
  // another user's data had leaked into their account. So an explicit zero
  // count gets its own state: empty bar, muted number, and a caption saying
  // what the number actually is.
  //
  // Only an explicit 0 means "never attempted". null/undefined means the caller
  // supplied no counts at all, which stays on the old rendering — the same
  // graceful-degradation convention isMastered() documents.
  const noEvidence = observationCount === 0;
  const lowEvidence = observationCount > 0 && observationCount < MASTERY_MIN_OBSERVATIONS;

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
                className="h-full bg-indigo-500 rounded-full"
                style={{ width: `${masteryValue * 100}%` }}
              />
            </div>
          </div>

          {/* P(Slip) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-semibold text-slate-300">Slip</span>
              <span className="text-xs font-bold text-rose-400">
                {(bkt.p_s * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 rounded-full"
                style={{ width: `${bkt.p_s * 100}%` }}
              />
            </div>
          </div>

          {/* P(Guess) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-semibold text-slate-300">Guess</span>
              <span className="text-xs font-bold text-amber-400">
                {(bkt.p_g * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full"
                style={{ width: `${bkt.p_g * 100}%` }}
              />
            </div>
          </div>

          {/* P(Transition) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-semibold text-slate-300">Transition</span>
              <span className="text-xs font-bold text-cyan-400">
                {(bkt.p_t * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-500 rounded-full"
                style={{ width: `${bkt.p_t * 100}%` }}
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
        {noEvidence ? (
          <span className="bg-slate-800/80 text-slate-400 text-xs px-2.5 py-1 rounded-full border border-slate-700 font-semibold shadow-sm">
            Not started
          </span>
        ) : isMastered ? (
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
          <span className="text-slate-400">{noEvidence ? 'Starting estimate' : 'Progress'}</span>
          <span className={noEvidence ? 'text-slate-500' : 'text-indigo-400'}>{percentage}%</span>
        </div>
        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          {/* The bar tracks evidence, so it stays empty until an answer exists —
              the prior belongs to the model, not to the student's progress. */}
          {!noEvidence && (
            <div
              className={`h-full rounded-full transition-all duration-500 ${isMastered ? 'bg-emerald-500' : 'bg-indigo-500'}`}
              style={{ width: `${percentage}%` }}
            />
          )}
        </div>
        {noEvidence && (
          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
            No answers yet — this is where the tutor assumes everyone starts, not progress you have made.
          </p>
        )}
        {lowEvidence && (
          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
            Based on {observationCount} answer{observationCount === 1 ? '' : 's'} — still a rough estimate.
          </p>
        )}
        {observationCount >= MASTERY_MIN_OBSERVATIONS && (
          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
            Based on {observationCount} answers.
          </p>
        )}
      </div>
    </div>
  );
};

export default SkillCard;
