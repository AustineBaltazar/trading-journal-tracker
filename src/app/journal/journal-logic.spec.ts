import {
  focusSessionWarning,
  formatLongDate,
  imageFileError,
  journalCounts,
  shortPnl,
} from './journal-logic';

describe('shortPnl', () => {
  it('keeps calendar cells short', () => {
    expect(shortPnl(414.78)).toBe('+415');
    expect(shortPnl(-31.74)).toBe('−32');
    expect(shortPnl(1195)).toBe('+1.2k');
    expect(shortPnl(-2430)).toBe('−2.4k');
    expect(shortPnl(0)).toBe('0');
  });
});

describe('journalCounts', () => {
  it('counts plans and reviews in the month only', () => {
    expect(
      journalCounts(
        [
          { date: '2026-09-23', hasPlan: true, hasReview: true, imageCount: 0 },
          { date: '2026-09-25', hasPlan: true, hasReview: false, imageCount: 0 },
          { date: '2026-09-15', hasPlan: false, hasReview: true, imageCount: 0 },
          { date: '2026-08-31', hasPlan: true, hasReview: true, imageCount: 0 },
        ],
        '2026-09',
      ),
    ).toEqual({ plans: 2, reviews: 2 });
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
