import { qualityScore, rememberedFee, rememberFee, suggestSession } from './trade-form-logic';

describe('suggestSession', () => {
  it('maps entry times (New York time) to sessions', () => {
    expect(suggestSession('10:53')).toBe('New York AM');
    expect(suggestSession('14:23')).toBe('New York PM');
    expect(suggestSession('03:39')).toBe('London');
    expect(suggestSession('20:15')).toBe('Asian');
    expect(suggestSession('01:30')).toBe('Asian');
    expect(suggestSession('17:30')).toBe('');
    expect(suggestSession('')).toBe('');
  });
});

describe('qualityScore', () => {
  const base = {
    rulesFollowed: 3,
    rulesTotal: 3,
    mistakes: 0,
    rMultiple: 2.8,
    answersYes: 3,
    answersTotal: 3,
    grade: 'B+',
  };

  it('adds up rules, mistakes, stop, answers and grade (demo trade #121 = 97)', () => {
    const s = qualityScore(base);
    expect(s.score).toBe(97);
    expect(s.label).toBe('Strong execution');
    expect(s.parts.map((p) => `${p.label} ${p.earned}/${p.max}`)).toEqual([
      'Rules 35/35',
      'No mistakes 25/25',
      'Stop respected 15/15',
      'Review answers 15/15',
      'Grade B+ 7/10',
    ]);
  });

  it('a losing trade that followed the plan can score 100', () => {
    expect(qualityScore({ ...base, rMultiple: -1, grade: 'A+' }).score).toBe(100);
  });

  it('punishes a moved stop and mistakes', () => {
    const s = qualityScore({
      ...base,
      rulesFollowed: 1,
      mistakes: 2,
      rMultiple: -1.5,
      answersYes: 0,
      grade: 'D',
    });
    expect(s.score).toBe(13);
    expect(s.label).toBe('Poor execution');
  });

  it('leaves out parts it has no data for', () => {
    const s = qualityScore({
      ...base,
      rulesTotal: 0,
      rulesFollowed: 0,
      rMultiple: null,
      answersTotal: 0,
      answersYes: 0,
      grade: '',
    });
    expect(s.parts.map((p) => p.label)).toEqual(['No mistakes']);
    expect(s.score).toBe(100);
  });
});

describe('fee per contract', () => {
  afterEach(() => localStorage.removeItem('feePerContract:MNQ'));

  it('is remembered per symbol', () => {
    expect(rememberedFee('MNQ')).toBeNull();
    rememberFee('MNQ', 4.96, 4);
    expect(rememberedFee('MNQ')).toBe(1.24);
    rememberFee('MNQ', 0, 4);
    expect(rememberedFee('MNQ')).toBe(1.24);
  });
});
