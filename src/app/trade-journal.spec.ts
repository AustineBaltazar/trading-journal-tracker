import { todayLocal, tradeDuration } from './trade-journal';

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
