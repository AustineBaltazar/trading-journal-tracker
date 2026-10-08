import { autoOutcome, countOutcomes, emotionsOf, outcomeOf, winRate } from './outcome';

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
