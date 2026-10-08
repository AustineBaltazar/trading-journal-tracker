import { buildCalendarMonth, dayStyle } from './calendar';

const trade = (trade_date: string, netPnl: number, rulesFollowed: boolean | null = true) => ({
  trade_date,
  netPnl,
  rulesFollowed,
});

const layout = (year: number, month: number) =>
  buildCalendarMonth([], { year, month }, '').weeks.map((w) =>
    w.days.map((d) => (d ? d.day : null)),
  );

describe('buildCalendarMonth layout', () => {
  it('starts on the right weekday when the month starts mid-week', () => {
    // September 2026 starts on a Tuesday
    expect(layout(2026, 8)[0]).toEqual([null, 1, 2, 3, 4]);
  });

  it('starts on Monday when the month starts on a Saturday', () => {
    // August 2026 starts on a Saturday
    const weeks = layout(2026, 7);
    expect(weeks[0]).toEqual([3, 4, 5, 6, 7]);
    expect(weeks.every((w) => w.length === 5)).toBe(true);
    expect(weeks.length).toBe(5);
    expect(weeks[4]).toEqual([31, null, null, null, null]);
  });

  it('starts on Monday when the month starts on a Sunday', () => {
    // November 2026 starts on a Sunday
    expect(layout(2026, 10)[0]).toEqual([2, 3, 4, 5, 6]);
  });

  it('handles a month that starts on Monday', () => {
    // February 2027 starts on a Monday and has exactly 4 weeks
    expect(layout(2027, 1)).toEqual([
      [1, 2, 3, 4, 5],
      [8, 9, 10, 11, 12],
      [15, 16, 17, 18, 19],
      [22, 23, 24, 25, 26],
    ]);
  });
});

describe('buildCalendarMonth stats', () => {
  const trades = [
    trade('2026-09-02', 400),
    trade('2026-09-02', -100, false),
    trade('2026-09-03', -50),
    trade('2026-09-08', 200),
    trade('2026-10-01', 999),
  ];
  const cal = buildCalendarMonth(trades, { year: 2026, month: 8 }, '2026-09-08');

  it('rolls trades up per day', () => {
    const sep2 = cal.weeks[0].days[2]!;
    expect(sep2).toMatchObject({ pnl: 300, wins: 1, losses: 1, count: 2, ruleBroken: true });
    expect(sep2.strength).toBe(1);
    expect(cal.weeks[0].days[3]!.strength).toBeCloseTo(50 / 300);
  });

  it('totals each week and marks today', () => {
    expect(cal.weeks[0]).toMatchObject({ pnl: 250, count: 3 });
    expect(cal.weeks[1]).toMatchObject({ pnl: 200, count: 1 });
    expect(cal.weeks[1].days[1]!.isToday).toBe(true);
  });

  it('summarizes only the viewed month', () => {
    expect(cal.summary.net).toBe(450);
    expect(cal.summary.greenDays).toBe(2);
    expect(cal.summary.redDays).toBe(1);
    expect(cal.summary.best!.date).toBe('2026-09-02');
    expect(cal.summary.worst!.date).toBe('2026-09-03');
  });

  it('colors traded days only', () => {
    expect(dayStyle(cal.weeks[0].days[2]!)!['background-color']).toBe('rgba(16,185,129,0.55)');
    expect(dayStyle(cal.weeks[0].days[3]!)!['background-color']).toContain('244,63,94');
    expect(dayStyle(cal.weeks[0].days[4]!)).toBeNull();
  });

  it('counts break-evens and shows a BE-only day in gray', () => {
    const beTrades = [
      { ...trade('2026-09-08', 132.52), outcome: 'win' },
      { ...trade('2026-09-08', -1.24), outcome: 'be' },
      { ...trade('2026-09-09', -1.24), outcome: 'be' },
    ];
    const month = buildCalendarMonth(beTrades, { year: 2026, month: 8 }, '');
    const [mixed, beOnly] = [month.weeks[1].days[1]!, month.weeks[1].days[2]!];
    expect(mixed).toMatchObject({ wins: 1, losses: 0, breakEvens: 1 });
    expect(dayStyle(mixed)!['background-color']).toContain('16,185,129');
    expect(beOnly).toMatchObject({ wins: 0, losses: 0, breakEvens: 1 });
    expect(dayStyle(beOnly)!['background-color']).toBe('rgba(148,163,184,0.12)');
  });
});
