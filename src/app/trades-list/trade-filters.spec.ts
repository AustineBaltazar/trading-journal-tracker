import { filterTrades, NO_FILTERS, sortTrades, summarizeTrades } from './trade-filters';

const t = (id: number, fields: Record<string, unknown>) => ({
  id,
  trade_date: '2026-09-10',
  entry_time: '09:30',
  netPnl: 0,
  strategy: '',
  session: null,
  emotion: null,
  grade: null,
  rulesFollowed: true,
  ...fields,
});

const trades = [
  t(1, {
    trade_date: '2026-09-01',
    netPnl: 200,
    strategy: 'IFVG reclaim',
    session: 'New York AM',
    emotion: 'Calm',
    grade: 'A',
  }),
  t(2, {
    trade_date: '2026-09-02',
    netPnl: -100,
    strategy: 'SMT divergence',
    session: 'New York PM',
    emotion: 'FOMO',
    grade: 'C',
    rulesFollowed: false,
  }),
  t(3, {
    trade_date: '2026-09-03',
    netPnl: 50,
    strategy: 'Sweep + IFVG',
    session: 'New York AM',
    emotion: 'Calm',
    grade: 'A+',
  }),
  t(4, {
    trade_date: '2026-09-03',
    entry_time: '13:00',
    netPnl: -300,
    strategy: 'Liquidity sweep',
    rulesFollowed: null,
  }),
];
const ids = (list: { id: number }[]) => list.map((x) => x.id);

describe('filterTrades', () => {
  it('returns everything with no filters', () => {
    expect(ids(filterTrades(trades, NO_FILTERS))).toEqual([1, 2, 3, 4]);
  });

  it('combines filters', () => {
    expect(ids(filterTrades(trades, { ...NO_FILTERS, search: 'ifvg' }))).toEqual([1, 3]);
    expect(
      ids(filterTrades(trades, { ...NO_FILTERS, session: 'New York AM', outcome: 'wins' })),
    ).toEqual([1, 3]);
    expect(ids(filterTrades(trades, { ...NO_FILTERS, emotion: 'FOMO' }))).toEqual([2]);
    expect(ids(filterTrades(trades, { ...NO_FILTERS, grade: 'A+' }))).toEqual([3]);
    expect(ids(filterTrades(trades, { ...NO_FILTERS, outcome: 'losses' }))).toEqual([2, 4]);
  });

  it('rules broken only excludes trades with no rules linked', () => {
    expect(ids(filterTrades(trades, { ...NO_FILTERS, rulesBrokenOnly: true }))).toEqual([2]);
  });
});

describe('sortTrades', () => {
  it('sorts by date, newest first by default direction', () => {
    expect(ids(sortTrades(trades, 'date', 'desc'))).toEqual([4, 3, 2, 1]);
    expect(ids(sortTrades(trades, 'date', 'asc'))).toEqual([1, 2, 3, 4]);
  });

  it('sorts grades best first and keeps ungraded trades last either way', () => {
    expect(ids(sortTrades(trades, 'grade', 'asc'))).toEqual([3, 1, 2, 4]);
    expect(ids(sortTrades(trades, 'grade', 'desc'))).toEqual([2, 1, 3, 4]);
  });

  it('sorts by P/L', () => {
    expect(ids(sortTrades(trades, 'pnl', 'desc'))).toEqual([1, 3, 2, 4]);
    expect(ids(sortTrades(trades, 'pnl', 'asc'))).toEqual([4, 2, 3, 1]);
  });

  it('does not mutate the input', () => {
    sortTrades(trades, 'pnl', 'asc');
    expect(ids(trades)).toEqual([1, 2, 3, 4]);
  });
});

describe('summarizeTrades', () => {
  it('computes averages and profit factor', () => {
    expect(summarizeTrades(trades)).toEqual({
      total: 4,
      wins: 2,
      losses: 2,
      netPnl: -150,
      winRate: 50,
      avgWin: 125,
      avgLoss: -200,
      profitFactor: 0.63,
    });
  });

  it('leaves averages empty when there is nothing to average', () => {
    expect(summarizeTrades([{ netPnl: 10 }])).toMatchObject({ avgLoss: null, profitFactor: null });
    expect(summarizeTrades([])).toMatchObject({ total: 0, winRate: 0, avgWin: null });
  });
});
