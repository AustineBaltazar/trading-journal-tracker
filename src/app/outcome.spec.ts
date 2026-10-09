import {
  autoOutcome,
  countOutcomes,
  emotionsOf,
  estimateR,
  formatR,
  outcomeOf,
  winRate,
} from './outcome';

describe('outcome', () => {
  it('uses what the API sent, then a picked result, then the prices', () => {
    expect(outcomeOf({ netPnl: -1.24, outcome: 'be' })).toBe('be');
    expect(outcomeOf({ netPnl: 2, result: 'be' })).toBe('be');
    expect(outcomeOf({ netPnl: -1.24, entry_price: '21000.00', exit_price: 21000 })).toBe('be');
    expect(outcomeOf({ netPnl: 50 })).toBe('win');
    expect(outcomeOf({ netPnl: -50 })).toBe('loss');
    expect(outcomeOf({ netPnl: 0 })).toBe('be');
  });

  it('auto: exit at entry is BE even when fees make it negative', () => {
    expect(autoOutcome(21466.5, 21466.5, -1.24)).toBe('be');
    expect(autoOutcome(21466.5, 21466.75, -0.74)).toBe('loss');
  });

  it('leaves break-evens out of the win rate', () => {
    expect(winRate(16, 12)).toBe(57);
    expect(winRate(0, 0)).toBe(0);
    expect(countOutcomes([{ netPnl: 10 }, { netPnl: -5 }, { netPnl: -1, outcome: 'be' }])).toEqual({
      wins: 1,
      losses: 1,
      breakEvens: 1,
      winRate: 50,
    });
  });

  it('reads every emotion, falling back to the single old one', () => {
    expect(emotionsOf({ emotions: ['FOMO', 'Anxious'], emotion: 'FOMO' })).toEqual([
      'FOMO',
      'Anxious',
    ]);
    expect(emotionsOf({ emotions: [], emotion: 'Calm' })).toEqual(['Calm']);
    expect(emotionsOf({})).toEqual([]);
  });
});

describe('R', () => {
  it('formats R with a sign and one decimal', () => {
    expect(formatR(2.83)).toBe('+2.8R');
    expect(formatR(-1)).toBe('-1.0R');
    expect(formatR(0)).toBe('0.0R');
    expect(formatR(null)).toBe('—');
  });

  it('estimates R like the API, and needs a stop on the right side', () => {
    const short = {
      direction: 'short',
      entry_price: 21085.25,
      exit_price: 21028.75,
      stop_price: 21105.25,
      target_price: 21025.25,
    };
    expect(estimateR(short)).toEqual({ rMultiple: 2.83, plannedR: 3, riskPoints: 20 });
    expect(estimateR({ ...short, target_price: '' })?.plannedR).toBeNull();
    expect(estimateR({ ...short, stop_price: null })).toBeNull();
    expect(estimateR({ ...short, stop_price: 21000 })).toBeNull();
  });
});
