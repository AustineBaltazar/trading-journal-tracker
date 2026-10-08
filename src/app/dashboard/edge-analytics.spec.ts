import { buildEdgeAnalytics, formatMinutes, winRateTier } from './edge-analytics';

const trade = (fields: Record<string, unknown>) => ({
  trade_date: '2026-10-01',
  netPnl: 0,
  ...fields,
});

describe('buildEdgeAnalytics', () => {
  const trades = [
    trade({
      session: 'New York AM',
      emotion: 'Calm',
      grade: 'A',
      entry_time: '09:35',
      exit_time: '09:50',
      netPnl: 100,
    }),
    trade({
      session: 'New York AM',
      emotion: 'Calm',
      grade: 'A+',
      entry_time: '09:40',
      exit_time: '10:00',
      netPnl: 50,
    }),
    trade({
      session: 'New York AM',
      emotion: 'Revenge',
      grade: 'B',
      entry_time: '09:10',
      exit_time: '10:10',
      netPnl: -40,
    }),
    trade({
      session: 'London',
      emotion: 'Revenge',
      grade: 'B',
      entry_time: '03:00',
      exit_time: '03:30',
      netPnl: -200,
    }),
    trade({
      session: 'London',
      emotion: 'Revenge',
      grade: 'C',
      entry_time: '03:15',
      exit_time: '04:15',
      netPnl: -100,
    }),
    trade({
      session: 'London',
      emotion: 'FOMO',
      grade: 'B',
      entry_time: '03:20',
      exit_time: '03:25',
      netPnl: 30,
    }),
    trade({ netPnl: 500 }),
  ];
  const result = buildEdgeAnalytics(trades);

  it('counts tagged and untagged trades separately', () => {
    expect(result.taggedCount).toBe(6);
    expect(result.untaggedCount).toBe(1);
  });

  it('groups by session in the defined order with win rate and net', () => {
    expect(result.sessions).toEqual([
      { key: 'London', total: 3, wins: 1, losses: 2, breakEvens: 0, winRate: 33, net: -270 },
      { key: 'New York AM', total: 3, wins: 2, losses: 1, breakEvens: 0, winRate: 67, net: 110 },
    ]);
  });

  it('picks highlights only from groups with enough trades', () => {
    expect(result.bestSession?.key).toBe('New York AM');
    expect(result.costliestEmotion?.key).toBe('Revenge');
    expect(result.bestHour?.key).toBe('09');
  });

  it('summarizes grades and hold times', () => {
    expect(result.aGradeShare).toBe(33);
    expect(result.mostTakenGrade).toBe('B');
    expect(result.avgHoldWinners).toBe(13);
    expect(result.avgHoldLosers).toBe(50);
  });

  it('counts a trade under each of its emotions', () => {
    const multi = buildEdgeAnalytics([
      trade({ netPnl: 100, emotions: ['Calm', 'Confident'], session: 'London' }),
      trade({ netPnl: -50, emotions: ['Calm'], session: 'London' }),
    ]);
    expect(multi.emotions.map((e) => [e.key, e.total, e.net])).toEqual([
      ['Confident', 1, 100],
      ['Calm', 2, 50],
    ]);
  });

  it('returns empty stats when nothing is tagged', () => {
    const empty = buildEdgeAnalytics([trade({ netPnl: 10 })]);
    expect(empty.taggedCount).toBe(0);
    expect(empty.bestSession).toBeNull();
    expect(empty.aGradeShare).toBeNull();
  });
});

describe('helpers', () => {
  it('maps win rates to tiers', () => {
    expect(winRateTier(70)).toBe('high');
    expect(winRateTier(50)).toBe('mid');
    expect(winRateTier(20)).toBe('low');
  });

  it('formats minutes', () => {
    expect(formatMinutes(null)).toBe('—');
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(65)).toBe('1h 05m');
  });
});
