import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, WifiOff } from 'lucide-react';
import WidgetFrame from './WidgetFrame';
import { pokerService } from '../../../services/api';

// How wide each 6-max position opens, from the live /api/poker/ranges/
// endpoint — the same charts the graders use, so these percentages can never
// drift from what the drills grade against. Renders a graceful error state so
// the lesson still reads with the backend down.
const POSITION_ORDER = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];

const OpeningRangeLadder = () => {
  const [positions, setPositions] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    pokerService
      .getPreflopRanges()
      .then((data) => {
        const byCode = Object.fromEntries((data.six_max?.positions || []).map((p) => [p.code, p]));
        setPositions(POSITION_ORDER.map((code) => byCode[code]).filter(Boolean));
      })
      .catch(() => setFailed(true));
  }, []);

  const maxFraction = positions?.length
    ? Math.max(...positions.map((p) => p.fraction || 0))
    : 1;

  return (
    <WidgetFrame title="How wide each seat opens (live chart data)">
      {failed ? (
        <p className="text-sm text-slate-400 flex items-center gap-2">
          <WifiOff className="h-4 w-4 text-slate-500 shrink-0" />
          Couldn't load the charts right now — the full grids are on the Ranges page when you're back online.
        </p>
      ) : !positions ? (
        <p className="text-sm text-slate-500">Loading chart data…</p>
      ) : (
        <div className="space-y-2.5">
          {positions.map((p) => {
            const fractionPct = Math.round((p.fraction || 0) * 100);
            return (
              <div key={p.code} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-300 w-10 shrink-0">{p.code}</span>
                <div className="flex-1 h-6 bg-slate-800/70 rounded-md overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-md flex items-center justify-end pr-2"
                    style={{ width: `${Math.max(8, ((p.fraction || 0) / maxFraction) * 100)}%` }}
                  >
                    <span className="text-[11px] font-bold text-white tabular-nums">{fractionPct}%</span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 w-28 shrink-0 hidden sm:block truncate">{p.name}</span>
              </div>
            );
          })}
          <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
            Percentage of all 1,326 starting combos each position opens. Later seats face fewer
            players behind them, so they can open wider.
          </p>
        </div>
      )}
      <Link
        to="/ranges"
        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
      >
        Explore the full charts and test yourself <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </WidgetFrame>
  );
};

export default OpeningRangeLadder;
