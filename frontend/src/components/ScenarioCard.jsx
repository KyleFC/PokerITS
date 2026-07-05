import React from 'react';
import { ArrowRight } from 'lucide-react';
import { SKILL_LABELS } from '../constants';

// A single diagnostic scenario tile in the quiz bank grid.
const ScenarioCard = ({ scenario, onStart }) => {
  return (
    <div className="bg-slate-900 border border-slate-850 hover:border-slate-700/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition group">
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <span className="bg-slate-800 text-slate-300 text-xs px-3 py-1 rounded-lg border border-slate-750 font-medium">
            {SKILL_LABELS[scenario.skill] || scenario.skill}
          </span>
          <span className="text-[11px] text-slate-500 font-mono">{scenario.id}</span>
        </div>
        <h4 className="font-bold text-slate-100 group-hover:text-indigo-400 transition text-base leading-snug">{scenario.title}</h4>
        <p className="text-slate-400 text-sm mt-2 line-clamp-3 leading-relaxed">{scenario.description}</p>
      </div>

      <button
        onClick={() => onStart(scenario)}
        className="mt-6 w-full flex items-center justify-center gap-2 bg-slate-800/60 hover:bg-indigo-600 text-slate-200 hover:text-white font-semibold py-2.5 px-4 rounded-xl border border-slate-700 group-hover:border-indigo-500/50 transition cursor-pointer text-sm shadow-sm"
      >
        <span>Test Skill</span>
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </button>
    </div>
  );
};

export default ScenarioCard;
