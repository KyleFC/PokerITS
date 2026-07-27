import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, Play, Pause } from 'lucide-react';
import MiniTable from './MiniTable';

// Steps a MiniTable through a scripted list of frames on a timer, with a
// caption under the table and manual controls. Timers are plain setTimeout
// (never rAF) so the sequence keeps advancing in a background/throttled tab.

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
};

const DEFAULT_HOLD = 2200;

// Starts the sequence the first time it scrolls into view. The Game Basics
// page stacks four of these; without this they would all play (and finish) at
// once while the student is still reading the first paragraph.
const useStartsWhenSeen = (ref) => {
  const [seen, setSeen] = useState(typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const el = ref.current;
    if (!el) return undefined;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);

    // IntersectionObserver goes dormant while the document is hidden, which
    // would leave a sequence that is already on screen frozen on frame one.
    // Measure as a backstop, after a beat so the measurement sees settled
    // layout rather than whatever the first commit happened to produce.
    const backstop = setTimeout(() => {
      const rect = el.getBoundingClientRect();
      if (rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0) {
        setSeen(true);
        io.disconnect();
      }
    }, 400);

    return () => {
      clearTimeout(backstop);
      io.disconnect();
    };
  }, [ref]);
  return seen;
};

const TableSequence = ({ title, seats, hero, button, frames, resetKey = 0 }) => {
  const reducedMotion = usePrefersReducedMotion();
  const rootRef = useRef(null);
  const onScreen = useStartsWhenSeen(rootRef);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  // Hitting Play or Replay is explicit intent: it runs the sequence whether or
  // not the visibility trigger ever fired.
  const [userStarted, setUserStarted] = useState(false);
  // Bumping this remounts the table so every entrance animation runs again;
  // React would otherwise keep the already-mounted cards exactly where they are.
  const [runId, setRunId] = useState(0);

  const last = frames.length - 1;

  // A new resetKey (the caller switched scripts, e.g. picked another action)
  // restarts from the top, and counts as the student asking to see it — the
  // action picker can sit well below the fold. Comparing the previous key,
  // rather than tracking "have I mounted", is what makes this safe under
  // StrictMode: its double-invoked effects re-run with the key unchanged.
  const shownKey = useRef(resetKey);
  useEffect(() => {
    if (shownKey.current === resetKey) return;
    shownKey.current = resetKey;
    setStep(0);
    setPlaying(true);
    setRunId((n) => n + 1);
    setUserStarted(true);
  }, [resetKey]);

  // Someone who asked for reduced motion gets the finished frame instead of a
  // sequence that plays itself.
  useEffect(() => {
    if (reducedMotion) {
      setPlaying(false);
      setStep(last);
    }
  }, [reducedMotion, last]);

  // Armed to play, and allowed to: a sequence still below the fold is neither
  // playing nor paused, so the button must offer Play rather than Pause.
  const running = playing && (onScreen || userStarted);

  useEffect(() => {
    if (!running) return undefined;
    if (step >= last) {
      setPlaying(false);
      return undefined;
    }
    const t = setTimeout(() => setStep((s) => Math.min(s + 1, last)), frames[step].hold ?? DEFAULT_HOLD);
    return () => clearTimeout(t);
  }, [running, step, last, frames]);

  const replay = () => {
    setStep(0);
    setRunId((n) => n + 1);
    setPlaying(true);
    setUserStarted(true);
  };

  // Toggle against `running`, not `playing`: a sequence waiting below the fold
  // is armed (`playing`) but not moving, and its button offers Play — so one
  // click has to start it, not pause it.
  const togglePlay = () => {
    setPlaying(!running);
    setUserStarted(true);
  };

  const frame = frames[step];
  const finished = step >= last && !playing;

  return (
    <div ref={rootRef} className="bg-slate-950/60 border border-indigo-500/25 rounded-2xl p-3 sm:p-4 space-y-3">
      {title && (
        <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">{title}</p>
      )}

      <div className="overflow-x-auto">
        <MiniTable key={runId} seats={seats} hero={hero} button={button} frame={frame} />
      </div>

      {/* Fixed height so stepping through captions of different lengths does
          not shuffle the surrounding prose up and down. */}
      <p className="text-sm text-slate-200 leading-snug text-center min-h-[60px] sm:min-h-[40px] flex items-center justify-center px-2">
        {frame.caption}
      </p>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={finished ? replay : togglePlay}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 py-1.5 transition"
        >
          {finished ? (
            <>
              <RotateCcw className="h-3.5 w-3.5" /> Replay
            </>
          ) : running ? (
            <>
              <Pause className="h-3.5 w-3.5" /> Pause
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" /> Play
            </>
          )}
        </button>

        <div className="flex items-center gap-1.5">
          {frames.map((f, i) => (
            <button
              key={i}
              onClick={() => {
                setPlaying(false);
                setStep(i);
              }}
              aria-label={`Step ${i + 1} of ${frames.length}`}
              aria-current={i === step ? 'step' : undefined}
              className={`h-2 rounded-full transition-all ${
                i === step ? 'w-5 bg-indigo-400' : 'w-2 bg-slate-700 hover:bg-slate-600'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TableSequence;
