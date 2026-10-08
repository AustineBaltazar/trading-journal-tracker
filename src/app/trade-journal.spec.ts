import {
  compareMonths,
  holdMinutes,
  monthKey,
  monthLabel,
  monthsWithTrades,
  shiftMonth,
  todayLocal,
  tradeDuration,
  tradesInMonth,
} from './trade-journal';

describe('month helpers', () => {
  it('formats keys and labels', () => {
    expect(monthKey({ year: 2026, month: 8 })).toBe('2026-09');
    expect(monthKey({ year: 26, month: 9 })).toBe('0026-10');
    expect(monthLabel({ year: 2026, month: 0 })).toBe('January 2026');
  });

  it('shifts across year boundaries', () => {
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth({ year: 2026, month: 5 }, -18)).toEqual({ year: 2024, month: 11 });
  });

  it('compares months', () => {
    expect(compareMonths({ year: 2026, month: 0 }, { year: 2025, month: 11 })).toBeGreaterThan(0);
    expect(compareMonths({ year: 2026, month: 3 }, { year: 2026, month: 3 })).toBe(0);
  });

  it('finds months with trades and filters by month', () => {
    const trades = [
      { trade_date: '2026-09-02' },
      { trade_date: '2026-09-30' },
      { trade_date: '2026-10-01' },
    ];
    expect([...monthsWithTrades(trades)]).toEqual(['2026-09', '2026-10']);
    expect(tradesInMonth(trades, { year: 2026, month: 8 }).length).toBe(2);
    expect(tradesInMonth(trades, { year: 2026, month: 7 }).length).toBe(0);
  });

  it('computes hold minutes across midnight', () => {
    expect(holdMinutes('09:30', '10:05')).toBe(35);
    expect(holdMinutes('23:30', '00:15')).toBe(45);
    expect(holdMinutes('09:30', null)).toBeNull();
  });
});

describe('todayLocal', () => {
  it('formats the local calendar date as YYYY-MM-DD', () => {
    expect(todayLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(todayLocal(new Date(2026, 9, 8, 0, 5))).toBe('2026-10-08');
  });
});

describe('tradeDuration', () => {
  it('returns null until both times are set', () => {
    expect(tradeDuration('09:30', '')).toBeNull();
    expect(tradeDuration(null, '10:00')).toBeNull();
  });

  it('formats minutes and hours', () => {
    expect(tradeDuration('09:30', '09:42')).toBe('12m');
    expect(tradeDuration('09:30', '10:35')).toBe('1h 05m');
    expect(tradeDuration('09:30', '09:30')).toBe('0m');
  });

  it('wraps past midnight', () => {
    expect(tradeDuration('23:30', '00:15')).toBe('45m');
  });
});
