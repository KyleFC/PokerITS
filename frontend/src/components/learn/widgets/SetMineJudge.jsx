import React, { useState } from 'react';
import WidgetFrame, { Slider, Readout } from './WidgetFrame';
import { setMineRatio, SET_MINE_RULE, SET_FLOP_PCT, fmtBb } from '../../../lessons/math';

// Set-mining judge: price of the call vs effective stack -> stack-to-call
// ratio, judged against the 15-20x rule the implied-odds generator uses.
// The generator only deals clearly-deep (>=20x) or clearly-shallow (<=8x)
// spots; the band between is shaded as the real-life judgment zone.
const CALL_SIZES = [1.5, 2, 2.5, 3, 3.5, 4];

const SetMineJudge = () => {
  const [call, setCall] = useState(2.5);
  const [stack, setStack] = useState(100);

  const ratio = setMineRatio(stack, call);
  const verdict =
    ratio >= SET_MINE_RULE.comfortable
      ? { text: 'Profitable set-mine — call', tone: 'good', chip: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' }
      : ratio < SET_MINE_RULE.min
        ? { text: 'Too shallow — fold', tone: 'bad', chip: 'text-rose-400 bg-rose-500/10 border-rose-500/30' }
        : { text: 'Judgment zone — position and opponent decide', tone: 'warn', chip: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };

  // Ratio meter, capped at 40x for display.
  const meterMax = 40;
  const meterPct = Math.min(ratio, meterMax) / meterMax * 100;

  return (
    <WidgetFrame title="Try it: do you have the implied odds to set-mine?">
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-400">Price of the call (BB)</p>
        <div className="flex flex-wrap gap-2">
          {CALL_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => setCall(size)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                call === size
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
              }`}
            >
              {fmtBb(size)} BB
            </button>
          ))}
        </div>
      </div>

      <Slider
        label="Effective stack"
        display={`${stack} BB`}
        value={stack}
        min={10}
        max={200}
        step={5}
        onChange={setStack}
      />

      {/* Ratio meter with the 15-20x rule band shaded */}
      <div>
        <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 bg-amber-500/25"
            style={{
              left: `${(SET_MINE_RULE.min / meterMax) * 100}%`,
              width: `${((SET_MINE_RULE.comfortable - SET_MINE_RULE.min) / meterMax) * 100}%`,
            }}
          />
          <div
            className={`absolute inset-y-0 left-0 ${
              verdict.tone === 'good' ? 'bg-emerald-500/70' : verdict.tone === 'bad' ? 'bg-rose-500/70' : 'bg-amber-500/70'
            }`}
            style={{ width: `${meterPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-semibold">
          <span>0x</span>
          <span className="text-amber-500/90">15-20x rule band</span>
          <span>{meterMax}x+</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Readout label="Stack-to-call ratio" value={`${ratio.toFixed(1)}x`} tone="accent" />
        <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${verdict.chip}`}>{verdict.text}</span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        You flop a set about {SET_FLOP_PCT}% of the time (~7.5 : 1 against), so the direct price never
        justifies the call — the {fmtBb(call)} BB must be repaid by what you win from{' '}
        {stack} BB stacks on the ~{SET_FLOP_PCT}% of flops you hit, covering the ~{100 - SET_FLOP_PCT}%
        you miss and fold. That is why the rule wants the stack at 15-20x the call, or better.
      </p>
    </WidgetFrame>
  );
};

export default SetMineJudge;
