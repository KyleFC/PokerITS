import React, { useState } from 'react';
import { Calculator, ChevronDown, ChevronUp, X } from 'lucide-react';

// A deliberately *neutral* calculator: plain arithmetic only, with no knowledge
// of pot odds, MDF or any other formula, and never pre-filled from the live
// scenario. Students told us the mental arithmetic was the hard part, not the
// concept — but a widget that applied the formula for them would answer the
// question outright and inflate the very mastery estimate the drill exists to
// measure. Dividing is assistance; knowing what to divide is the skill.

const OPERATORS = {
  '+': '+',
  '-': '-',
  '*': '*',
  '×': '*', // ×
  '/': '/',
  '÷': '/', // ÷
  '(': '(',
  ')': ')',
};

// Split the source into number/operator tokens. Returns null on any character
// the calculator does not accept, so typos surface as "check the expression"
// rather than a silently wrong number.
function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ' || ch === ',') {
      i += 1;
      continue;
    }
    if (ch >= '0' && ch <= '9') {
      let j = i;
      while (j < src.length && ((src[j] >= '0' && src[j] <= '9') || src[j] === '.')) j += 1;
      const value = Number(src.slice(i, j));
      if (!Number.isFinite(value)) return null; // e.g. "1.2.3"
      tokens.push({ type: 'num', value });
      i = j;
      continue;
    }
    if (ch === '.') {
      // A bare leading decimal: ".5" is fine, ".." is not.
      let j = i;
      while (j < src.length && ((src[j] >= '0' && src[j] <= '9') || src[j] === '.')) j += 1;
      const value = Number(src.slice(i, j));
      if (!Number.isFinite(value)) return null;
      tokens.push({ type: 'num', value });
      i = j;
      continue;
    }
    const op = OPERATORS[ch];
    if (!op) return null;
    tokens.push({ type: op });
    i += 1;
  }
  return tokens;
}

// Recursive descent over the usual precedence:
//   expr   := term (('+' | '-') term)*
//   term   := factor (('*' | '/') factor)*
//   factor := ('+' | '-') factor | number | '(' expr ')'
// Returns null for anything malformed or undefined (including /0) so the caller
// has a single "no result" case to render.
function parse(tokens) {
  let pos = 0;
  const peek = () => (pos < tokens.length ? tokens[pos].type : null);

  function factor() {
    const t = peek();
    if (t === '-') {
      pos += 1;
      const v = factor();
      return v === null ? null : -v;
    }
    if (t === '+') {
      pos += 1;
      return factor();
    }
    if (t === 'num') {
      return tokens[pos++].value;
    }
    if (t === '(') {
      pos += 1;
      const v = expr();
      if (v === null || peek() !== ')') return null;
      pos += 1;
      return v;
    }
    return null;
  }

  function term() {
    let left = factor();
    if (left === null) return null;
    while (peek() === '*' || peek() === '/') {
      const op = tokens[pos++].type;
      const right = factor();
      if (right === null) return null;
      if (op === '/' && right === 0) return null;
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  function expr() {
    let left = term();
    if (left === null) return null;
    while (peek() === '+' || peek() === '-') {
      const op = tokens[pos++].type;
      const right = term();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  const value = expr();
  // Trailing junk ("2+3)") is an error, not a partial success.
  if (value === null || pos !== tokens.length) return null;
  return value;
}

// Evaluate an arithmetic expression, or null if it is not a complete valid one.
// Hand-parsed rather than eval()'d: user input should never reach the JS engine.
export function evaluateExpression(src) {
  if (typeof src !== 'string' || !src.trim()) return null;
  const tokens = tokenize(src);
  if (tokens === null || tokens.length === 0) return null;
  const value = parse(tokens);
  return Number.isFinite(value) ? value : null;
}

// Trim floating-point noise (0.30000000000000004) without hiding precision.
const fmtDecimal = (n) => String(Math.round(n * 1e6) / 1e6);

const ScratchPad = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [tape, setTape] = useState([]);

  const value = evaluateExpression(input);
  const typed = input.trim() !== '';
  const invalid = typed && value === null;

  const commit = () => {
    if (value === null) return;
    setTape((t) => [{ input: input.trim(), value }, ...t].slice(0, 4));
    setInput('');
  };

  return (
    <div className="bg-slate-950/40 border border-slate-850 rounded-2xl">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <Calculator className="h-3.5 w-3.5" />
          Scratchpad
          <span className="text-slate-600 font-normal hidden sm:inline">
            — work the numbers out here
          </span>
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
              }}
              placeholder="e.g. 5 / (10 + 5 + 5)"
              aria-label="Scratchpad expression"
              className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
            />
            {typed && (
              <button
                onClick={() => setInput('')}
                aria-label="Clear expression"
                className="px-2.5 rounded-xl border border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Both readouts, because the arithmetic students are doing here is
              usually a ratio they then need to compare against a percentage. */}
          <div className="flex items-center gap-3 min-h-[28px]">
            {value !== null ? (
              <>
                <span className="text-sm font-bold text-slate-200 tabular-nums">
                  = {fmtDecimal(value)}
                </span>
                <span className="text-sm font-bold text-indigo-300 tabular-nums">
                  = {fmtDecimal(Math.round(value * 1000) / 10)}%
                </span>
              </>
            ) : (
              <span className="text-xs text-slate-600">
                {invalid ? 'Check the expression — use only numbers and + - * / ( )' : 'Supports + - * / and parentheses. Enter saves a line.'}
              </span>
            )}
          </div>

          {tape.length > 0 && (
            <ul className="border-t border-slate-900 pt-2 space-y-1">
              {tape.map((row, i) => (
                <li key={`${row.input}-${i}`} className="flex justify-between gap-3 text-xs">
                  <button
                    onClick={() => setInput(row.input)}
                    className="font-mono text-slate-500 hover:text-slate-300 transition truncate cursor-pointer"
                    title="Reuse this line"
                  >
                    {row.input}
                  </button>
                  <span className="font-bold text-slate-400 tabular-nums shrink-0">
                    {fmtDecimal(row.value)} · {fmtDecimal(Math.round(row.value * 1000) / 10)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default ScratchPad;
