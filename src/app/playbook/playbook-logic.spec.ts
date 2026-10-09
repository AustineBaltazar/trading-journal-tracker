import { mistakeRows, weakestQuestion, weakestRule } from './playbook-logic';

it('weakest rule and question are the ones followed / answered Yes least', () => {
  const rule = (name: string, total: number, followedCount: number) => ({
    ruleId: 1,
    name,
    total,
    followedCount,
    percentage: Math.round((followedCount / total) * 100),
    avgPnlFollowed: null,
    avgPnlBroken: null,
  });
  expect(
    weakestRule([rule('IFVG', 30, 19), rule('SMT', 30, 15), rule('Sweep', 30, 22)])?.name,
  ).toBe('SMT');
  expect(weakestRule([])).toBeNull();
  const q = (id: number, yes: number, total: number) => ({
    id,
    question_text: `q${id}`,
    yes,
    no: total - yes,
    other: 0,
    total,
  });
  expect(weakestQuestion([q(1, 18, 30), q(2, 19, 30), q(3, 10, 20)])?.id).toBe(3);
  expect(weakestQuestion([q(1, 0, 0)])).toBeNull();
});

it('mistake rows: most expensive first with impact, unused last', () => {
  const cost = {
    total: { count: 10, net: 0 },
    clean: { count: 5, net: 0, winRate: 0 },
    withMistakes: { count: 5, net: 0, winRate: 0 },
    rows: [
      { id: 2, name: 'Moved my stop', count: 6, winRate: 0, net: -606.7 },
      { id: 3, name: 'Chased the move', count: 2, winRate: 0, net: -260.7 },
      { id: 4, name: 'Traded during news', count: 1, winRate: 0, net: -5.22 },
      { id: 5, name: 'Exited too early', count: 1, winRate: 100, net: 58.76 },
    ],
  };
  const all = [...cost.rows, { id: 9, name: 'Revenge trade' }];
  expect(mistakeRows(cost, all).map((r) => [r.name, r.impact])).toEqual([
    ['Moved my stop', 'high'],
    ['Chased the move', 'medium'],
    ['Traded during news', 'low'],
    ['Exited too early', 'none'],
    ['Revenge trade', 'unused'],
  ]);
});
