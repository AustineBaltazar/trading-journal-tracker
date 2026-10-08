import { buildDayList, focusSessionWarning, formatLongDate, imageFileError } from './journal-logic';

describe('buildDayList', () => {
  it('merges trading days and journal days, newest first', () => {
    const rows = buildDayList(
      '2026-09',
      [
        { date: '2026-09-23', hasPlan: true, hasReview: true, imageCount: 2 },
        { date: '2026-09-15', hasPlan: true, hasReview: false, imageCount: 0 },
        { date: '2026-08-31', hasPlan: true, hasReview: true, imageCount: 0 },
      ],
      [
        { trade_date: '2026-09-23', netPnl: -289.5 },
        { trade_date: '2026-09-22', netPnl: 40 },
        { trade_date: '2026-09-22', netPnl: 5.26 },
        { trade_date: '2026-10-01', netPnl: 100 },
      ],
    );
    expect(
      rows.map((r) => [r.date, r.weekday, r.tradeCount, r.pnl, r.hasPlan, r.hasReview]),
    ).toEqual([
      ['2026-09-23', 'Wed', 1, -289.5, true, true],
      ['2026-09-22', 'Tue', 2, 45.26, false, false],
      ['2026-09-15', 'Tue', 0, 0, true, false],
    ]);
  });
});

describe('focusSessionWarning', () => {
  const focus = 'No trades outside New York AM.';

  it('flags trades outside the session named in the focus', () => {
    expect(focusSessionWarning(focus, [{ session: 'New York AM' }, { session: 'Asian' }])).toBe(
      'Your focus was "No trades outside New York AM". A trade was taken in the Asian session.',
    );
  });

  it('stays quiet when trades match or no session is named', () => {
    expect(focusSessionWarning(focus, [{ session: 'New York AM' }])).toBeNull();
    expect(focusSessionWarning('Be patient', [{ session: 'Asian' }])).toBeNull();
    expect(focusSessionWarning(null, [{ session: 'Asian' }])).toBeNull();
    expect(focusSessionWarning(focus, [{ session: null }])).toBeNull();
  });
});

describe('imageFileError', () => {
  it('allows PNG, JPG and WebP up to 5 MB', () => {
    expect(imageFileError({ type: 'image/png', size: 1000 })).toBeNull();
    expect(imageFileError({ type: 'image/webp', size: 5 * 1024 * 1024 })).toBeNull();
    expect(imageFileError({ type: 'image/gif', size: 10 })).toMatch(/PNG, JPG or WebP/);
    expect(imageFileError({ type: 'image/jpeg', size: 5 * 1024 * 1024 + 1 })).toMatch(/5 MB/);
  });
});

it('formats a long date without shifting the day', () => {
  expect(formatLongDate('2026-09-23')).toBe('Wednesday, September 23');
});
