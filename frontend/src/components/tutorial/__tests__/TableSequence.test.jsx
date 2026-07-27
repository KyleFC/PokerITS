import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import TableSequence from '../TableSequence';
import ActionExplorer from '../ActionExplorer';
import { buildFrames, SEATS, HERO, BUTTON, DEAL_FRAMES, RIVER_FRAMES } from '../sequences';

// jsdom has no IntersectionObserver, so TableSequence falls back to playing
// immediately — which is what these tests drive.

const FRAMES = buildFrames([
  { caption: 'First frame', hold: 1000 },
  { caption: 'Second frame', heroCards: ['As', 'Kd'], hold: 1000 },
  { caption: 'Third frame', board: ['Kc', '9h', '4s'], pot: 6 },
]);

// The timeout for the *next* frame is only scheduled once the current state
// update has committed, so one flush advances one frame however far the clock
// is pushed. Each call here = one frame.
const nextFrame = (count = 1) => {
  for (let i = 0; i < count; i += 1) {
    act(() => vi.advanceTimersByTime(5000));
  }
};

const renderSequence = (props = {}) =>
  render(<TableSequence seats={SEATS} hero={HERO} button={BUTTON} frames={FRAMES} {...props} />);

describe('TableSequence', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('starts on the first frame and advances on its own', () => {
    renderSequence();
    expect(screen.getByText('First frame')).toBeInTheDocument();

    nextFrame();
    expect(screen.getByText('Second frame')).toBeInTheDocument();

    nextFrame();
    expect(screen.getByText('Third frame')).toBeInTheDocument();
  });

  it('stops on the last frame and offers a replay', () => {
    renderSequence();
    nextFrame(4); // more flushes than there are frames — it must not wrap round

    expect(screen.getByText('Third frame')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /replay/i }));
    expect(screen.getByText('First frame')).toBeInTheDocument();
  });

  it('pauses and lets a student step through by hand', () => {
    renderSequence();

    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    nextFrame(3);
    expect(screen.getByText('First frame')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /step 3 of 3/i }));
    expect(screen.getByText('Third frame')).toBeInTheDocument();
  });

  it('deals the hero two hole cards before the rest of the table gets theirs', () => {
    const { container } = render(
      <TableSequence seats={SEATS} hero={HERO} button={BUTTON} frames={DEAL_FRAMES} />
    );
    // Face-down cards are the only ones rendered as a patterned card back.
    const faceDown = () => container.querySelectorAll('.from-indigo-800').length;

    // Frame 3 of the deal script: the hero's two cards, alone on the table.
    nextFrame(2);
    expect(screen.getByText(/your hole cards/)).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('K')).toBeInTheDocument();
    expect(faceDown()).toBe(0);

    // Only then does everyone else get theirs — two apiece for five players.
    nextFrame();
    expect(screen.getByText(/Everyone else gets two as well/)).toBeInTheDocument();
    expect(faceDown()).toBe(10);
  });
});

describe('sequences', () => {
  it('merges each step onto the one before it', () => {
    const frames = buildFrames([
      { caption: 'a', pot: 1, heroCards: ['As', 'Kd'] },
      { caption: 'b', pot: 2 },
    ]);

    // The hero's cards persist even though step two never mentions them.
    expect(frames[1]).toMatchObject({ caption: 'b', pot: 2, heroCards: ['As', 'Kd'] });
  });

  it('clears the spotlight after the step that asked for it', () => {
    const frames = buildFrames([{ caption: 'a', highlight: 'hero' }, { caption: 'b' }]);
    expect(frames[0].highlight).toBe('hero');
    expect(frames[1].highlight).toBeNull();
  });

  it('runs one continuous hand from the deal through to the river', () => {
    const river = RIVER_FRAMES[RIVER_FRAMES.length - 1];
    expect(river.board).toEqual(['Kc', '9h', '4s', 'Td', '2c']);
    expect(river.heroCards).toEqual(['As', 'Kd']);
  });
});

describe('ActionExplorer', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('plays the picked action and shows who acts next', () => {
    render(<ActionExplorer />);

    // Fold is selected by default.
    expect(screen.getByText(/MP bets 3 BB\. To keep playing/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Raise/ }));
    expect(screen.getByText('MP bets 3 BB.')).toBeInTheDocument();

    nextFrame();
    expect(screen.getByText(/you increase it to 10 BB/)).toBeInTheDocument();
    expect(screen.getByText('10 BB')).toBeInTheDocument();

    nextFrame();
    expect(screen.getByText(/when it gets back to MP/)).toBeInTheDocument();
  });

  it('folding takes the hero out of the hand', () => {
    render(<ActionExplorer />);
    // The hero's A♠ is on the table; nothing else on this board is an ace.
    expect(screen.getByText('A')).toBeInTheDocument();

    nextFrame();
    expect(screen.getByText(/you throw your cards away/)).toBeInTheDocument();
    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });
});
