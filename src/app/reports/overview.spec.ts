import { buildFindings, tagExtremes } from './overview';
import { buildEdgeAnalytics } from '../dashboard/edge-analytics';
import { DayStats, TagGroupReport, TagRow } from './report-logic';
import { MistakeCost } from '../mistakes/mistakes';

const g = (key: string, total: number, winRate: number, net: number) => ({
  key,
  total,
  wins: 0,
  losses: 0,
  breakEvens: 0,
  winRate,
  net,
});
const day = (name: string, total: number, net: number): DayStats => ({
  name,
  total,
  wins: 0,
  losses: 0,
  breakEvens: 0,
  winRate: 50,
  net,
});
const tag = (id: number, name: string, total: number, net: number): TagRow => ({
  id,
  name,
  total,
  wins: 0,
  losses: 0,
  breakEvens: 0,
  winRate: net > 0 ? 100 : 0,
  avgR: null,
  withR: 0,
  net,
});
const noMistakes: MistakeCost = {
  total: { count: 0, net: 0 },
  clean: { count: 0, net: 0, winRate: 0 },
  withMistakes: { count: 0, net: 0, winRate: 0 },
  rows: [],
};

describe('buildFindings', () => {
  const edge = {
    ...buildEdgeAnalytics([]),
    sessions: [g('New York AM', 27, 76, 4869), g('London', 11, 50, -755)],
    emotions: [g('Calm', 22, 95, 4553), g('Confident', 17, 88, 4448), g('FOMO', 5, 0, -2393)],
  };
  const tags: TagGroupReport[] = [
    {
      name: 'Market',
      rows: [tag(1, 'Trend day', 25, 8426), tag(2, 'Range day', 18, -2952)],
      untagged: 0,
    },
    { name: 'News', rows: [tag(3, 'CPI', 2, 1823)], untagged: 0 },
  ];
  const mistakes: MistakeCost = {
    ...noMistakes,
    rows: [
      { id: 1, name: 'Moved my stop', count: 8, winRate: 0, net: -1493 },
      { id: 2, name: 'Chased the move', count: 1, winRate: 0, net: -759 },
    ],
  };

  it('picks the biggest money groups, one per source, with 3+ trades', () => {
    const f = buildFindings({ days: [day('Wednesday', 10, 2086)], edge, tags, mistakes });
    expect(f.working.map((x) => x.label)).toEqual(['Trend day', 'New York AM', 'Calm']);
    expect(f.hurting.map((x) => x.label)).toEqual(['Range day', 'FOMO', 'Moved my stop']);
    // Confident is a second Emotion; CPI and "Chased the move" have under 3 trades
    expect(f.hurting.find((x) => x.source === 'Mistake')).toMatchObject({
      total: 8,
      winRate: null,
      tab: 'discipline',
    });
    expect(f.working[0]).toMatchObject({ source: 'Market', tab: 'tags' });
  });

  it('is empty when nothing has enough trades', () => {
    const f = buildFindings({
      days: [day('Monday', 2, 500)],
      edge: buildEdgeAnalytics([]),
      tags: [],
      mistakes: noMistakes,
    });
    expect(f).toEqual({ working: [], hurting: [] });
  });
});

describe('tagExtremes', () => {
  it('shows every tag when few, else the best 3 and worst 2', () => {
    const few: TagGroupReport[] = [
      { name: 'Setup', rows: [tag(1, 'A', 3, 5), tag(2, 'B', 3, -5)], untagged: 0 },
    ];
    expect(tagExtremes(few).map((r) => r.name)).toEqual(['A', 'B']);
    const many: TagGroupReport[] = [
      { name: 'Setup', rows: [1, 2, 3, 4].map((i) => tag(i, `S${i}`, 3, i * 100)), untagged: 0 },
      { name: 'News', rows: [5, 6, 7].map((i) => tag(i, `N${i}`, 3, -i * 10)), untagged: 0 },
    ];
    expect(tagExtremes(many).map((r) => `${r.group}:${r.name}`)).toEqual([
      'Setup:S4',
      'Setup:S3',
      'Setup:S2',
      'News:N6',
      'News:N7',
    ]);
  });
});
