import { buildHighlights } from './highlights';
import { buildEdgeAnalytics } from './edge-analytics';
import { buildMistakeCost } from '../mistakes/mistakes';

const trade = (fields: Record<string, unknown>) => ({
  trade_date: '2026-09-01',
  netPnl: 0,
  ...fields,
});

describe('buildHighlights', () => {
  const trades = [
    trade({ netPnl: 120, entry_time: '14:05', emotions: ['Calm'], mistakeIds: [] }),
    trade({ netPnl: 80, entry_time: '14:30', emotions: ['Calm'], mistakeIds: [] }),
    trade({ netPnl: 60, entry_time: '14:45', emotions: ['Confident'], mistakeIds: [] }),
    trade({ netPnl: -200, entry_time: '09:40', emotions: ['Revenge', 'FOMO'], mistakeIds: [2] }),
    trade({ netPnl: -90, entry_time: '09:50', emotions: ['Revenge'], mistakeIds: [2, 3] }),
  ];
  const mistakes = [
    { id: 2, name: 'Moved my stop' },
    { id: 3, name: 'Chased the move' },
  ];

  it('picks one finding per report tab, with the numbers behind it', () => {
    const rules = { followedAllPercentage: 40, followedTradesCount: 2, totalTradesWithRules: 5 };
    const list = buildHighlights(
      buildEdgeAnalytics(trades),
      buildMistakeCost(trades, mistakes),
      rules,
    );
    expect(list).toEqual([
      {
        label: 'Costliest emotion',
        value: 'Revenge',
        amount: -290,
        detail: '2 trades',
        tab: 'psychology',
      },
      {
        label: 'Best entry hour',
        value: '14:00',
        amount: null,
        detail: '100% win · 3 trades',
        tab: 'timing',
      },
      {
        label: 'Most expensive mistake',
        value: 'Moved my stop',
        amount: -290,
        detail: '2 trades',
        tab: 'discipline',
      },
      {
        label: 'Followed all rules',
        value: '40%',
        amount: null,
        detail: '2 of 5 trades',
        tab: 'discipline',
      },
    ]);
  });

  it('leaves out findings without enough data', () => {
    const one = [trade({ netPnl: 50, entry_time: '10:00', emotions: ['Calm'], mistakeIds: [] })];
    expect(buildHighlights(buildEdgeAnalytics(one), buildMistakeCost(one, mistakes), null)).toEqual(
      [],
    );
  });
});
