import React, { useState, useEffect } from 'react';

// Fold / Check / Call / Raise controls for a live hero decision, shared by the
// Heads Up Arena and the Exploit Lab. Presentational: it reads the server's
// `legal_actions` and calls `onAct(action)` — it computes no poker math.
const ActionBar = ({ legal = [], busy = false, onAct }) => {
  const raiseSpec = legal.find((a) => a.type === 'raise_to');
  const callAction = legal.find((a) => a.type === 'call');
  const canCheck = legal.some((a) => a.type === 'check');
  const canFold = legal.some((a) => a.type === 'fold');

  const [raiseAmount, setRaiseAmount] = useState(null);
  // Reset the typed raise back to the minimum whenever the legal raise window
  // changes (a new street / decision), so a stale amount never carries over.
  useEffect(() => {
    setRaiseAmount(null);
  }, [raiseSpec?.min_bb, raiseSpec?.max_bb]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {canFold && (
          <button
            onClick={() => onAct({ type: 'fold' })}
            disabled={busy}
            className="px-6 py-3 rounded-xl border border-rose-600/40 hover:border-rose-500 text-rose-300 bg-rose-500/5 font-bold transition disabled:opacity-50 cursor-pointer"
          >
            Fold
          </button>
        )}
        {canCheck && (
          <button
            onClick={() => onAct({ type: 'check' })}
            disabled={busy}
            className="px-6 py-3 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-200 bg-slate-800/40 font-bold transition disabled:opacity-50 cursor-pointer"
          >
            Check
          </button>
        )}
        {callAction && (
          <button
            onClick={() => onAct({ type: 'call' })}
            disabled={busy}
            className="px-6 py-3 rounded-xl border border-sky-600/50 hover:border-sky-500 text-sky-300 bg-sky-500/10 font-bold transition disabled:opacity-50 cursor-pointer"
          >
            Call {callAction.amount_bb} BB
          </button>
        )}
        {raiseSpec && (
          <div className="flex items-center gap-2 bg-slate-950/50 border border-slate-800 rounded-xl p-1.5">
            <input
              type="number"
              step="0.5"
              min={raiseSpec.min_bb}
              max={raiseSpec.max_bb}
              value={raiseAmount ?? raiseSpec.min_bb}
              onChange={(e) => setRaiseAmount(e.target.value)}
              className="w-20 bg-transparent text-slate-100 font-bold text-center outline-none"
            />
            <button
              onClick={() => {
                // Keep raiseAmount as the raw string so the field can be
                // cleared; coerce here and fall back to the minimum when it
                // isn't a finite number (parseFloat('') is NaN, which `??`
                // would not catch).
                const n = parseFloat(raiseAmount);
                onAct({
                  type: 'raise_to',
                  amount_bb: Number.isFinite(n) ? n : raiseSpec.min_bb,
                });
              }}
              disabled={busy}
              className="px-5 py-2.5 rounded-lg border border-indigo-600/50 hover:border-indigo-500 text-indigo-300 bg-indigo-500/10 font-bold transition disabled:opacity-50 cursor-pointer"
            >
              Raise to
            </button>
          </div>
        )}
      </div>
      <p className="text-center text-xs text-slate-500">
        Raise range: {raiseSpec ? `${raiseSpec.min_bb}–${raiseSpec.max_bb} BB` : '—'}
      </p>
    </div>
  );
};

export default ActionBar;
