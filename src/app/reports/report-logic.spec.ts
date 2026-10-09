import { buildDayOfWeek, isRangeKey, rangeDates, tradesInRange } from './report-logic';

describe('rangeDates', () => {
  const today = '2026-10-10';

  it('counts back from today', () => {
    expect(rangeDates('month', today)).toEqual({ from: '2026-10-01', to: today });
    expect(rangeDates('30d', today)).toEqual({ from: '2026-09-11', to: today });
    expect(rangeDates('3m', today)).toEqual({ from: '2026-07-11', to: today });
    expect(rangeDates('all', today)).toEqual({ from: null, to: null });
  });

  it('handles month ends and year changes', () => {
    expect(rangeDates('3m', '2026-05-31')).toEqual({ from: '2026-03-04', to: '2026-05-31' });
    expect(rangeDates('30d', '2026-01-15')).toEqual({ from: '2025-12-17', to: '2026-01-15' });
  });

  it('custom keeps valid dates, leaves blanks open and flips a backwards range', () => {
    expect(rangeDates('custom', today, { from: '2026-09-01', to: '2026-09-30' })).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(rangeDates('custom', today, { from: '2026-09-01', to: null })).toEqual({
      from: '2026-09-01',
      to: null,
    });
    expect(rangeDates('custom', today, { from: '2026-09-30', to: '2026-09-01' })).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(rangeDates('custom', today, { from: 'nope', to: '' })).toEqual({ from: null, to: null });
  });

  it('recognises range keys', () => {
    expect(isRangeKey('3m')).toBe(true);
    expect(isRangeKey('year')).toBe(false);
  });
});

describe('tradesInRange', () => {
  const trades = ['2026-08-31', '2026-09-01', '2026-09-30', '2026-10-01'].map((trade_date, id) => ({
    id,
    trade_date,
  }));

  it('includes both ends', () => {
    const ids = tradesInRange(trades, { from: '2026-09-01', to: '2026-09-30' }).map((t) => t.id);
    expect(ids).toEqual([1, 2]);
  });

  it('open ends keep everything on that side', () => {
    expect(tradesInRange(trades, { from: null, to: '2026-09-01' }).map((t) => t.id)).toEqual([
      0, 1,
    ]);
    expect(tradesInRange(trades, { from: null, to: null })).toHaveLength(4);
  });
});

describe('buildDayOfWeek', () => {
  it('groups by weekday with net P/L and leaves break-evens out of the win rate', () => {
    const days = buildDayOfWeek([
      { trade_date: '2026-09-07', netPnl: 100 }, // Monday
      { trade_date: '2026-09-14', netPnl: -40 }, // Monday
      { trade_date: '2026-09-21', netPnl: -1.24, outcome: 'be' }, // Monday
      { trade_date: '2026-09-11', netPnl: 50 }, // Friday
      { trade_date: '2026-09-12', netPnl: 999 }, // Saturday: not shown
    ]);
    expect(days[0]).toEqual({
      name: 'Monday',
      total: 3,
      wins: 1,
      losses: 1,
      breakEvens: 1,
      winRate: 50,
      net: 58.76,
    });
    expect(days[4]).toMatchObject({ name: 'Friday', total: 1, winRate: 100, net: 50 });
    expect(days[1].total).toBe(0);
  });
});
