import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, BookOpen, Zap, Users, DollarSign, Award } from 'lucide-react';
import PageLayout from '../components/PageLayout';

const Tutorial = ({ user, onLogout }) => {
  const [activeSection, setActiveSection] = useState('intro');

  const sections = [
    { id: 'intro', title: 'Introduction', icon: BookOpen },
    { id: 'basics', title: 'Game Basics', icon: Zap },
    { id: 'hands', title: 'Hand Rankings', icon: Award },
    { id: 'position', title: 'Position Strategy', icon: Users },
    { id: 'betting', title: 'Betting Mechanics', icon: DollarSign },
  ];

  const handlePrevious = () => {
    const currentIndex = sections.findIndex(s => s.id === activeSection);
    if (currentIndex > 0) {
      setActiveSection(sections[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    const currentIndex = sections.findIndex(s => s.id === activeSection);
    if (currentIndex < sections.length - 1) {
      setActiveSection(sections[currentIndex + 1].id);
    }
  };

  const currentSectionIndex = sections.findIndex(s => s.id === activeSection);
  const CurrentIcon = sections[currentSectionIndex]?.icon || BookOpen;

  return (
    <PageLayout onLogout={onLogout} user={user}>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Navigation */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-4 py-2">Tutorial Sections</h3>
            {sections.map((section, idx) => {
              const SectionIcon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${activeSection === section.id
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                      : 'text-slate-300 hover:bg-slate-800/50'
                    }`}
                >
                  <SectionIcon className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-medium">{section.title}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 md:p-10">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-indigo-600/20 rounded-lg">
                <CurrentIcon className="h-6 w-6 text-indigo-400" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white">{sections[currentSectionIndex]?.title}</h1>
            </div>

            {/* Content */}
            <div className="text-slate-200 leading-relaxed space-y-6">
              {activeSection === 'intro' && <IntroContent />}
              {activeSection === 'basics' && <BasicsContent />}
              {activeSection === 'hands' && <HandRankingsContent />}
              {activeSection === 'position' && <PositionContent />}
              {activeSection === 'betting' && <BettingContent />}
            </div>

            {/* Navigation */}
            <div className="flex gap-4 mt-12 pt-8 border-t border-slate-700">
              <button
                onClick={handlePrevious}
                disabled={currentSectionIndex === 0}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-slate-800/50 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <div className="flex-1" />
              <button
                onClick={handleNext}
                disabled={currentSectionIndex === sections.length - 1}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

// Content Components
const IntroContent = () => (
  <>
    <p className="text-lg">
      Welcome to No-Limit Texas Hold'em! This tutorial will teach you everything you need to know to start playing poker.
    </p>

    <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-6 space-y-4">
      <h3 className="font-bold text-indigo-300 text-lg">What You'll Learn</h3>
      <ul className="space-y-2 text-sm">
        <li className="flex gap-3">
          <span className="text-indigo-400">•</span>
          <span><strong>Game Basics:</strong> Hand structure, betting rounds, and terminology</span>
        </li>
        <li className="flex gap-3">
          <span className="text-indigo-400">•</span>
          <span><strong>Hand Rankings:</strong> Which hands win in showdown</span>
        </li>
        <li className="flex gap-3">
          <span className="text-indigo-400">•</span>
          <span><strong>Position Strategy:</strong> Why where you sit matters</span>
        </li>
        <li className="flex gap-3">
          <span className="text-indigo-400">•</span>
          <span><strong>Betting Mechanics:</strong> Types of bets and pot odds</span>
        </li>
      </ul>
    </div>

    <h3 className="font-bold text-lg text-white mt-6">Why No-Limit Hold'em?</h3>
    <p>
      No-Limit Hold'em is the most popular poker variant in the world. It's played in casinos, home games, and online. The "no-limit" means you can bet any amount at any time, making it the most dynamic and strategic form of poker.
    </p>

  </>
);

const BasicsContent = () => (
  <>
    <h3 className="font-bold text-lg text-white">How a Hand Works</h3>
    <p>
      Every poker hand follows the same structure. Two players start with private cards, and then community cards are revealed in stages.
    </p>

    <div className="space-y-4">
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
        <h4 className="font-semibold text-indigo-300 mb-3">1. The Deal (Preflop)</h4>
        <p className="text-sm mb-2">Each player receives 2 private cards (called "hole cards") that only they can see.</p>
        <p className="text-xs text-slate-400">The first player after the big blind acts first. The action moves clockwise.</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
        <h4 className="font-semibold text-indigo-300 mb-3">2. The Flop</h4>
        <p className="text-sm mb-2">Three community cards are revealed in the center of the table. Everyone can use these cards.</p>
        <p className="text-xs text-slate-400">Players can now make a 5-card hand using their 2 cards + any 3 of the 5 community cards.</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
        <h4 className="font-semibold text-indigo-300 mb-3">3. The Turn</h4>
        <p className="text-sm mb-2">A fourth community card is revealed.</p>
        <p className="text-xs text-slate-400">Now 6 cards are available to make the best 5-card hand.</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
        <h4 className="font-semibold text-indigo-300 mb-3">4. The River</h4>
        <p className="text-sm mb-2">The fifth and final community card is revealed.</p>
        <p className="text-xs text-slate-400">Now all 7 cards are visible. Players form their best 5-card hand.</p>
      </div>
    </div>

    <h3 className="font-bold text-lg text-white mt-6">Key Terminology</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-slate-800/30 p-4 rounded-lg">
        <p className="font-semibold text-slate-100 text-sm mb-1">Fold</p>
        <p className="text-xs text-slate-400">Give up your hand and lose all money in the pot</p>
      </div>
      <div className="bg-slate-800/30 p-4 rounded-lg">
        <p className="font-semibold text-slate-100 text-sm mb-1">Check</p>
        <p className="text-xs text-slate-400">Pass without betting (only if no one has bet yet)</p>
      </div>
      <div className="bg-slate-800/30 p-4 rounded-lg">
        <p className="font-semibold text-slate-100 text-sm mb-1">Call</p>
        <p className="text-xs text-slate-400">Match the current bet amount</p>
      </div>
      <div className="bg-slate-800/30 p-4 rounded-lg">
        <p className="font-semibold text-slate-100 text-sm mb-1">Raise</p>
        <p className="text-xs text-slate-400">Increase the bet amount</p>
      </div>
      <div className="bg-slate-800/30 p-4 rounded-lg">
        <p className="font-semibold text-slate-100 text-sm mb-1">All-In</p>
        <p className="text-xs text-slate-400">Bet all remaining chips</p>
      </div>
      <div className="bg-slate-800/30 p-4 rounded-lg">
        <p className="font-semibold text-slate-100 text-sm mb-1">Pot</p>
        <p className="text-xs text-slate-400">The total money in the middle of the table</p>
      </div>
    </div>
  </>
);

const HandRankingsContent = () => (
  <>
    <p className="mb-6">
      At showdown (when all betting is complete), the player with the best 5-card hand wins the pot. Here are all poker hands ranked from strongest to weakest:
    </p>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <h4 className="font-bold text-yellow-300 mb-2">🥇 Royal Flush</h4>
        <p className="text-sm text-slate-300 mb-3">A-K-Q-J-10 same suit</p>
        <p className="font-mono text-sm text-yellow-200">A♥ K♥ Q♥ J♥ 10♥</p>
      </div>

      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
        <h4 className="font-bold text-cyan-300 mb-2">🥈 Straight Flush</h4>
        <p className="text-sm text-slate-300 mb-3">5 cards in sequence, same suit</p>
        <p className="font-mono text-sm text-cyan-200">9♠ 8♠ 7♠ 6♠ 5♠</p>
      </div>

      <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
        <h4 className="font-bold text-orange-300 mb-2">🥉 Four of a Kind</h4>
        <p className="text-sm text-slate-300 mb-3">Four cards same rank</p>
        <p className="font-mono text-sm text-orange-200">K♥ K♦ K♠ K♣ Q♥</p>
      </div>

      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
        <h4 className="font-bold text-purple-300 mb-2">4️⃣ Full House</h4>
        <p className="text-sm text-slate-300 mb-3">Three of a kind + pair</p>
        <p className="font-mono text-sm text-purple-200">Q♥ Q♦ Q♠ 7♣ 7♥</p>
      </div>

      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
        <h4 className="font-bold text-green-300 mb-2">5️⃣ Flush</h4>
        <p className="text-sm text-slate-300 mb-3">5 cards same suit</p>
        <p className="font-mono text-sm text-green-200">K♣ J♣ 9♣ 5♣ 3♣</p>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <h4 className="font-bold text-blue-300 mb-2">6️⃣ Straight</h4>
        <p className="text-sm text-slate-300 mb-3">5 cards in sequence</p>
        <p className="font-mono text-sm text-blue-200">10♥ 9♦ 8♠ 7♣ 6♥</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <h4 className="font-bold text-slate-200 mb-2">7️⃣ Three of a Kind</h4>
        <p className="text-sm text-slate-300 mb-3">Three cards same rank</p>
        <p className="font-mono text-sm text-slate-300">8♥ 8♦ 8♠ K♣ J♥</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <h4 className="font-bold text-slate-200 mb-2">8️⃣ Two Pair</h4>
        <p className="text-sm text-slate-300 mb-3">Two pairs of cards</p>
        <p className="font-mono text-sm text-slate-300">J♥ J♦ 5♠ 5♣ 2♥</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <h4 className="font-bold text-slate-200 mb-2">9️⃣ One Pair</h4>
        <p className="text-sm text-slate-300 mb-3">Two cards same rank</p>
        <p className="font-mono text-sm text-slate-300">4♥ 4♦ A♠ K♣ Q♥</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <h4 className="font-bold text-slate-200 mb-2">🔟 High Card</h4>
        <p className="text-sm text-slate-300 mb-3">No combination</p>
        <p className="font-mono text-sm text-slate-300">K♥ J♦ 9♠ 6♣ 3♥</p>
      </div>
    </div>

  </>
);

const PositionContent = () => (
  <>
    <p className="mb-6">
      Position—where you sit relative to other players—is one of the most important concepts in poker. Acting last is a huge advantage because you see what everyone else does before deciding.
    </p>

    <h3 className="font-bold text-lg text-white mb-4">The Three Positions</h3>

    <div className="space-y-4 mb-8">
      <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-lg p-6">
        <h4 className="font-semibold text-red-300 text-lg mb-3">Early Position (Worst)</h4>
        <p className="text-sm mb-3">Sitting right after the big blind. You act first and know the least about what others will do.</p>
        <div className="bg-slate-800/40 rounded p-4 text-sm space-y-2">
          <p><strong>✕ Disadvantage:</strong> Everyone will act after you</p>
          <p><strong>✓ Strategy:</strong> Play only strong hands (top 15%)</p>
          <p><strong>Example hands:</strong> AA, KK, QQ, AK, AQ</p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30 rounded-lg p-6">
        <h4 className="font-semibold text-yellow-300 text-lg mb-3">Middle Position (Moderate)</h4>
        <p className="text-sm mb-3">Sitting in the middle of the action. Some players act before you, some after.</p>
        <div className="bg-slate-800/40 rounded p-4 text-sm space-y-2">
          <p><strong>⚖ Trade-off:</strong> Less advantage than button, more than early</p>
          <p><strong>✓ Strategy:</strong> Play better hands (top 20%)</p>
          <p><strong>Example hands:</strong> AA-JJ, AK, AQ, KQ</p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-lg p-6">
        <h4 className="font-semibold text-green-300 text-lg mb-3">Late Position (Best)</h4>
        <p className="text-sm mb-3">The button (last to act). You have the biggest advantage—see everyone's actions first.</p>
        <div className="bg-slate-800/40 rounded p-4 text-sm space-y-2">
          <p><strong>✓ Advantage:</strong> Last to act on every betting round</p>
          <p><strong>✓ Strategy:</strong> Play wider range of hands (top 30%)</p>
          <p><strong>Example hands:</strong> Any pair, AJ+, KJ, QJ, etc.</p>
        </div>
      </div>
    </div>

    <h3 className="font-bold text-lg text-white mb-4">Why Position Matters</h3>
    <div className="bg-slate-800/40 rounded-lg p-6 space-y-4">
      <div className="flex gap-4">
        <div className="text-2xl">📍</div>
        <div>
          <p className="font-semibold text-slate-100 mb-1">Information Advantage</p>
          <p className="text-sm text-slate-300">Acting last means you know what everyone does before you decide</p>
        </div>
      </div>
      <div className="flex gap-4">
        <div className="text-2xl">💪</div>
        <div>
          <p className="font-semibold text-slate-100 mb-1">Control the Pot Size</p>
          <p className="text-sm text-slate-300">You can check behind (not bet) to keep the pot small, or bet large to build it</p>
        </div>
      </div>
      <div className="flex gap-4">
        <div className="text-2xl">🎯</div>
        <div>
          <p className="font-semibold text-slate-100 mb-1">Steal Blinds</p>
          <p className="text-sm text-slate-300">From late position, you can raise weak hands hoping others fold</p>
        </div>
      </div>
    </div>

  </>
);

const BettingContent = () => (
  <>
    <p className="mb-6">
      Understanding betting mechanics is crucial. Poker is a game of making +EV (positive expected value) decisions, which often involves understanding pot odds.
    </p>

    <h3 className="font-bold text-lg text-white mb-4">Types of Bets</h3>

    <div className="space-y-4 mb-8">
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
        <h4 className="font-semibold text-indigo-300 mb-2">Bet</h4>
        <p className="text-sm text-slate-300">First person to put money in during a betting round</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
        <h4 className="font-semibold text-indigo-300 mb-2">Check</h4>
        <p className="text-sm text-slate-300">Pass without betting (only available if no one has bet yet)</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
        <h4 className="font-semibold text-indigo-300 mb-2">Call</h4>
        <p className="text-sm text-slate-300">Match the current bet to stay in the hand</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
        <h4 className="font-semibold text-indigo-300 mb-2">Raise</h4>
        <p className="text-sm text-slate-300">Increase the bet amount. Others must then call the new amount or fold</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
        <h4 className="font-semibold text-indigo-300 mb-2">Fold</h4>
        <p className="text-sm text-slate-300">Give up your hand and lose all chips already in the pot</p>
      </div>
    </div>

    <h3 className="font-bold text-lg text-white mb-4">Pot Odds (Essential Concept)</h3>
    <p className="mb-4">
      Pot odds tell you the ratio of money in the pot compared to how much you need to call. This helps you decide if calling is profitable.
    </p>

    <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-lg p-6 mb-6">
      <p className="text-sm font-mono text-indigo-200 mb-4">
        <strong>Pot Odds = (Money in pot) ÷ (Cost to call)</strong>
      </p>
      <p className="text-sm text-slate-300 mb-4">
        <strong>Example:</strong> Pot has $100. Opponent bets $20. You need to call $20. <br />
        Pot odds = $120 ÷ $20 = 6:1
      </p>
      <p className="text-sm text-indigo-200">
        This means if your hand wins more than 1 out of every 6 times you're in this situation, it's +EV (profitable) to call.
      </p>
    </div>

    <h3 className="font-bold text-lg text-white mb-4">Hand vs. Range Thinking</h3>

    <div className="space-y-4 mb-8">
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-6">
        <h4 className="font-semibold text-rose-300 mb-3">❌ Beginner Thinking</h4>
        <p className="text-sm text-slate-300">"What hand does my opponent have?"</p>
        <p className="text-xs text-slate-400 mt-2">Problem: You can't know their exact hand—you need to think about all possible hands they could have</p>
      </div>

      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6">
        <h4 className="font-semibold text-green-300 mb-3">✓ Advanced Thinking</h4>
        <p className="text-sm text-slate-300">"What range of hands could my opponent have?"</p>
        <p className="text-xs text-slate-400 mt-2">Better approach: Consider the most likely hands based on their betting pattern</p>
      </div>
    </div>

    <h3 className="font-bold text-lg text-white mb-4">The 3 Reasons to Bet</h3>

    <div className="space-y-4">
      <div className="flex gap-4 bg-slate-800/30 p-5 rounded-lg">
        <div className="text-2xl font-bold text-indigo-400 min-w-8">1</div>
        <div>
          <p className="font-semibold text-slate-100 mb-1">Value Betting</p>
          <p className="text-sm text-slate-300">Bet to win money when you have a strong hand. Opponents call with weaker hands.</p>
        </div>
      </div>

      <div className="flex gap-4 bg-slate-800/30 p-5 rounded-lg">
        <div className="text-2xl font-bold text-indigo-400 min-w-8">2</div>
        <div>
          <p className="font-semibold text-slate-100 mb-1">Bluffing</p>
          <p className="text-sm text-slate-300">Bet with a weak hand hoping opponents fold. You win the pot without showdown.</p>
        </div>
      </div>

      <div className="flex gap-4 bg-slate-800/30 p-5 rounded-lg">
        <div className="text-2xl font-bold text-indigo-400 min-w-8">3</div>
        <div>
          <p className="font-semibold text-slate-100 mb-1">Protection / Semi-Bluff</p>
          <p className="text-sm text-slate-300">Bet with a drawing hand (one that could improve). You win now or improve to win later.</p>
        </div>
      </div>
    </div>

  </>
);

export default Tutorial;
