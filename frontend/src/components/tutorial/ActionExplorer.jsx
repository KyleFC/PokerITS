import React, { useState } from 'react';
import TableSequence from './TableSequence';
import { ACTIONS, SEATS, HERO, BUTTON } from './sequences';

// "What each action does" — pick an action, watch it happen on the table and
// see who acts next. The five actions each need their own set-up spot (you
// cannot check facing a bet, or call when there is none), so every button
// swaps in a different script rather than continuing one hand.
const ActionExplorer = () => {
  const [selected, setSelected] = useState(ACTIONS[0].id);
  const action = ACTIONS.find((a) => a.id === selected) || ACTIONS[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.id}
            onClick={() => setSelected(a.id)}
            aria-pressed={a.id === selected}
            className={`px-3 py-2 rounded-lg border text-left transition ${
              a.id === selected
                ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700/60 hover:text-white'
            }`}
          >
            <span className="block text-sm font-bold leading-none">{a.label}</span>
            <span className={`block text-[10px] mt-1 leading-none ${a.id === selected ? 'text-indigo-100' : 'text-slate-500'}`}>
              {a.blurb}
            </span>
          </button>
        ))}
      </div>

      <TableSequence
        seats={SEATS}
        hero={HERO}
        button={BUTTON}
        frames={action.frames}
        resetKey={action.id}
      />
    </div>
  );
};

export default ActionExplorer;
