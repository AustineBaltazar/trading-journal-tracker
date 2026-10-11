import {
  afterLoss,
  buildPatterns,
  buildRecords,
  byTradesPerDay,
  InsightTrade,
} from './insights-logic';

let nextId = 1;
const t = (date: string, time: string, net: number, extra: Record<string, unknown> = {}): any => ({
  id: nextId++,
  trade_date: date,
  entry_time: time,
  exit_time: null,
  netPnl: net,
  outcome: net > 0 ? 'win' : net < 0 ? 'loss' : 'be',
  ...extra,
});

describe('afterLoss', () => {
  it('counts trades entered within 30 min of a losing trade, same day only', () => {
    const trades: InsightTrade[] = [
      t('2026-09-01', '09:30', -100, { exit_time: '09:40' }),
      t('2026-09-01', '09:55', -50), // 15 min after the loss exit: counts
      t('2026-09-01', '11:00', 80), // after a loss but 65 min later: no
      t('2026-09-02', '09:00', -20), // next day after the 11:00 win: no
      t('2026-09-02', '09:20', 40), // 20 min after a loss: counts
    ];
    expect(afterLoss(trades)).toEqual({ total: 2, wins: 1, losses: 1, winRate: 50, net: -10 });
  });
});

describe('byTradesPerDay', () => {
  it('groups days by how many trades were taken', () => {
    const r = byTradesPerDay([
      t('2026-09-01', '09:00', 10),
      t('2026-09-02', '09:00', -5),
      t('2026-09-02', '10:00', -5),
      t('2026-09-02', '11:00', -5),
    ]);
    expect(r.one.total).toBe(1);
    expect(r.many).toMatchObject({ total: 3, net: -15 });
    expect(r.manyDays).toBe(1);
  });
});

describe('buildRecords', () => {
  it('finds streaks (break-evens skipped), rules kept, best day and month', () => {
    const r = buildRecords([
      t('2026-08-03', '09:00', -10, { rulesFollowed: false }),
      t('2026-08-04', '09:00', -10, { rulesFollowed: true }),
      t('2026-09-01', '09:00', 50, { rulesFollowed: true }),
      t('2026-09-02', '09:00', 0, { rulesFollowed: null }),
      t('2026-09-03', '09:00', 70, { rulesFollowed: true }),
      t('2026-09-03', '10:00', 30, { rulesFollowed: true }),
    ]);
    expect(r.current).toEqual({ outcome: 'win', length: 3 });
    expect(r.bestWinStreak).toEqual({ length: 3, from: '2026-09-01', to: '2026-09-03' });
    expect(r.worstLossStreak).toEqual({ length: 2, from: '2026-08-03', to: '2026-08-04' });
    expect(r.rulesKept).toBe(4);
    expect(r.bestDay).toEqual({ date: '2026-09-03', net: 100 });
    expect(r.bestMonth).toEqual({ month: '2026-09', net: 150 });
  });

  it('is empty without trades', () => {
    expect(buildRecords([])).toMatchObject({ current: null, bestDay: null, bestMonth: null });
  });
});

describe('buildPatterns', () => {
  const text = (p: { parts: { text: string }[] }) => p.parts.map((x) => x.text).join('');
  const groups = [
    {
      id: 1,
      name: 'Market',
      tags: [
        { id: 10, name: 'Trend day' },
        { id: 11, name: 'Range day' },
      ],
    },
  ] as any;

  it('turns groups of 3+ trades into leaks and edges, biggest money first', () => {
    const trades = [
      ...[1, 2, 3, 4].map((d) =>
        t(`2026-09-0${d}`, '10:00', 200, {
          tagIds: [10],
          session: 'New York AM',
          emotions: ['Calm'],
          grade: 'A',
        }),
      ),
      // Each losing group covers different trades, so none of them are merged
      ...[5, 6, 7].map((d) => t(`2026-09-0${d}`, '15:00', -100, { emotions: ['Revenge'] })),
      ...[8, 9].map((d) => t(`2026-09-0${d}`, '15:00', -60, { mistakeIds: [7] })),
      t('2026-09-10', '15:00', -60, { mistakeIds: [7], session: 'New York PM' }),
      ...[11, 12].map((d) => t(`2026-09-${d}`, '15:00', -45, { session: 'New York PM' })),
    ];
    const { leaks, edges } = buildPatterns({
      trades,
      mistakes: [{ id: 7, name: 'Moved my stop' }] as any,
      tagGroups: groups,
      rules: {
        avgPnlRulesFollowed: 120,
        avgPnlRuleBroken: -40,
        followedTradesCount: 4,
        totalTradesWithRules: 8,
      },
    });
    // Trend day, Calm, grade A and New York AM are the same 4 trades: shown once
    expect(edges.map(text).filter((x) => x.includes('+$800'))).toHaveLength(1);
    const leakText = leaks.map(text);
    expect(leakText).toContain('Revenge trades cost $300, 0 of 3 won.');
    expect(leakText).toContain('Moved my stop cost you $180.');
    expect(leakText).toContain('New York PM trades lose $150 (0% win).');
    expect(edges.map(text)).toContain(
      'When you follow every rule you average +$120 vs −$40 when you break one.',
    );
    // ordered by money at stake
    expect(leaks.every((p, i) => i === 0 || leaks[i - 1].weight >= p.weight)).toBe(true);
  });

  it('ignores groups under 3 trades', () => {
    const { leaks, edges } = buildPatterns({
      trades: [
        t('2026-09-01', '10:00', -500, { emotions: ['FOMO'] }),
        t('2026-09-02', '10:00', 500),
      ],
      mistakes: [],
      tagGroups: [],
      rules: null,
    });
    expect([...leaks, ...edges]).toEqual([]);
  });
});

describe('buildPatterns duplicates', () => {
  it('shows two patterns over the same trades once', () => {
    const trades = [1, 2, 3].map((d) =>
      t(`2026-09-0${d}`, '10:00', 100, { session: 'New York AM', emotions: [] }),
    );
    const { edges } = buildPatterns({ trades, mistakes: [], tagGroups: [], rules: null });
    const texts = edges.map((p) => p.parts.map((x) => x.text).join(''));
    // session, 10:00 and the weekday groups all cover the same 3 trades
    expect(texts.filter((s) => s.includes('+$300'))).toHaveLength(1);
  });
});
