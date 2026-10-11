import { MIN_SAMPLE, EdgeAnalytics } from '../dashboard/edge-analytics';
import { MistakeCost } from '../mistakes/mistakes';
import { DayStats, ReportTab, TagGroupReport, TagRow } from './report-logic';

// One line in "What's working" / "What's hurting"
export interface Finding {
  label: string;
  source: string; // where it comes from: "Session", "Emotion", a tag group's name...
  tab: ReportTab; // the tab with the full chart
  total: number;
  winRate: number | null; // null for mistakes, where "times" is what matters
  net: number;
}

// The biggest wins and leaks, at most one per source so one report can't fill the
// list. Groups need MIN_SAMPLE trades, so one lucky trade isn't a "finding".
export function buildFindings(
  input: {
    days: DayStats[];
    edge: EdgeAnalytics;
    tags: TagGroupReport[];
    mistakes: MistakeCost;
  },
  count = 3,
): { working: Finding[]; hurting: Finding[] } {
  const all: Finding[] = [];
  const add = (
    source: string,
    tab: ReportTab,
    label: string,
    g: { total: number; winRate: number; net: number },
  ) => all.push({ label, source, tab, total: g.total, winRate: g.winRate, net: g.net });

  for (const d of input.days) add('Day', 'timing', d.name, d);
  for (const s of input.edge.sessions) add('Session', 'timing', s.key, s);
  for (const h of input.edge.hours) add('Entry hour', 'timing', `${h.key}:00 entries`, h);
  for (const e of input.edge.emotions) add('Emotion', 'psychology', e.key, e);
  for (const g of input.edge.grades) add('Grade', 'psychology', `${g.key} grade`, g);
  for (const group of input.tags) for (const t of group.rows) add(group.name, 'tags', t.name, t);
  for (const m of input.mistakes.rows) {
    all.push({
      label: m.name,
      source: 'Mistake',
      tab: 'discipline',
      total: m.count,
      winRate: null,
      net: m.net,
    });
  }

  const eligible = all.filter((f) => f.total >= MIN_SAMPLE);
  const pickTop = (list: Finding[]) => {
    const seen = new Set<string>();
    const out: Finding[] = [];
    for (const f of list) {
      if (seen.has(f.source)) continue;
      seen.add(f.source);
      out.push(f);
      if (out.length === count) break;
    }
    return out;
  };
  return {
    working: pickTop(
      eligible.filter((f) => f.net > 0 && f.source !== 'Mistake').sort((a, b) => b.net - a.net),
    ),
    hurting: pickTop(eligible.filter((f) => f.net < 0).sort((a, b) => a.net - b.net)),
  };
}

// Best and worst tags across every group: all of them when there are few,
// otherwise the top 3 and bottom 2
export function tagExtremes(tags: TagGroupReport[]): (TagRow & { group: string })[] {
  const rows = tags
    .flatMap((g) => g.rows.map((r) => ({ ...r, group: g.name })))
    .sort((a, b) => b.net - a.net);
  return rows.length <= 5 ? rows : [...rows.slice(0, 3), ...rows.slice(-2)];
}
