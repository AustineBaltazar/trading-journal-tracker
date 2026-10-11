import { buildEdgeAnalytics, GroupStats, MIN_SAMPLE } from '../dashboard/edge-analytics';
import { buildMistakeCost, Mistake } from '../mistakes/mistakes';
import { outcomeOf, OutcomeFields, winRate } from '../outcome';
import { buildDayOfWeek, buildTagReport, ReportTab } from '../reports/report-logic';
import { TagGroup } from '../tags/tags';

// A sentence is a list of parts so the page can bold names and color money
export interface Part {
  text: string;
  strong?: boolean;
  tone?: 'win' | 'loss';
}

export interface Pattern {
  kind: 'leak' | 'edge';
  category: string; // "Behavior", "Time of day", a tag group's name...
  icon: 'pink' | 'blue' | 'orange' | 'green' | 'slate' | 'cyan';
  parts: Part[];
  meta: string; // "9 trades"
  tab: ReportTab | null; // the Reports tab with the chart behind it
  weight: number; // money at stake, for ordering
}

export interface InsightTrade extends OutcomeFields {
  id: number;
  trade_date: string;
  entry_time?: string | null;
  exit_time?: string | null;
  rulesFollowed?: boolean | null;
}

const money = (n: number) =>
  `${n > 0 ? '+' : n < 0 ? '−' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
const lost = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const pct = (n: number) => `${n}%`;

// "2026-09-03" + "10:05" → sortable key
const when = (t: InsightTrade) => `${t.trade_date.slice(0, 10)} ${t.entry_time ?? '99:99'}`;
export function chronological<T extends InsightTrade>(trades: T[]): T[] {
  return [...trades].sort((a, b) => when(a).localeCompare(when(b)) || a.id - b.id);
}

const minutesOf = (time?: string | null) => {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export interface Sequence {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  net: number;
}

// Trades taken soon after a loss: same day, entered within `gap` minutes of the
// losing trade's exit (or entry, when there's no exit time)
export function afterLoss(trades: InsightTrade[], gap = 30): Sequence {
  const sorted = chronological(trades);
  const picked: InsightTrade[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const next = sorted[i];
    if (outcomeOf(prev) !== 'loss' || prev.trade_date.slice(0, 10) !== next.trade_date.slice(0, 10))
      continue;
    const from = minutesOf(prev.exit_time) ?? minutesOf(prev.entry_time);
    const to = minutesOf(next.entry_time);
    if (from === null || to === null) continue;
    if (to >= from && to - from <= gap) picked.push(next);
  }
  return summarize(picked);
}

// Days by how many trades were taken: 1, 2, or 3+
export function byTradesPerDay(trades: InsightTrade[]) {
  const days = new Map<string, InsightTrade[]>();
  for (const t of trades) {
    const d = t.trade_date.slice(0, 10);
    days.set(d, [...(days.get(d) ?? []), t]);
  }
  const buckets = {
    one: [] as InsightTrade[],
    two: [] as InsightTrade[],
    many: [] as InsightTrade[],
  };
  let manyDays = 0;
  for (const list of days.values()) {
    if (list.length >= 3) manyDays += 1;
    (list.length === 1 ? buckets.one : list.length === 2 ? buckets.two : buckets.many).push(
      ...list,
    );
  }
  return {
    one: summarize(buckets.one),
    two: summarize(buckets.two),
    many: summarize(buckets.many),
    manyDays,
  };
}

function summarize(trades: InsightTrade[]): Sequence {
  let wins = 0;
  let losses = 0;
  for (const t of trades) {
    const o = outcomeOf(t);
    if (o === 'win') wins += 1;
    else if (o === 'loss') losses += 1;
  }
  return {
    total: trades.length,
    wins,
    losses,
    winRate: winRate(wins, losses),
    net: Math.round(trades.reduce((s, t) => s + t.netPnl, 0) * 100) / 100,
  };
}

// ---------- the pattern list ----------

export function buildPatterns(input: {
  trades: (InsightTrade & {
    tagIds?: number[];
    mistakeIds?: number[];
    rMultiple?: number | null;
  })[];
  mistakes: Mistake[];
  tagGroups: TagGroup[];
  rules: {
    avgPnlRulesFollowed: number;
    avgPnlRuleBroken: number;
    followedTradesCount: number;
    totalTradesWithRules: number;
  } | null;
}): { leaks: Pattern[]; edges: Pattern[] } {
  const { trades } = input;
  const out: Pattern[] = [];
  const overall = summarize(trades);
  const enough = (g: { total: number }) => g.total >= MIN_SAMPLE;
  const add = (p: Omit<Pattern, 'weight'>, net: number) =>
    out.push({ ...p, weight: Math.abs(net) });
  const record = (g: { wins?: number; total: number }) => `${g.wins ?? 0} of ${g.total} won`;

  const edge = buildEdgeAnalytics(trades);

  // Emotions: behaviour
  for (const e of edge.emotions.filter(enough)) {
    if (e.net < 0)
      add(
        {
          kind: 'leak',
          category: 'Behavior',
          icon: 'pink',
          parts: [
            { text: `${e.key} trades cost ` },
            { text: lost(e.net), strong: true, tone: 'loss' },
            { text: `, ${record(e)}.` },
          ],
          meta: plural(e.total, 'trade'),
          tab: 'psychology',
        },
        e.net,
      );
    else if (e.winRate >= overall.winRate)
      add(
        {
          kind: 'edge',
          category: 'Behavior',
          icon: 'green',
          parts: [
            { text: `${e.key} trades win ` },
            { text: pct(e.winRate), strong: true },
            { text: ' and make ' },
            { text: money(e.net), strong: true, tone: 'win' },
            { text: '.' },
          ],
          meta: plural(e.total, 'trade'),
          tab: 'psychology',
        },
        e.net,
      );
  }

  // Tags: setups, news, market...
  for (const group of buildTagReport(trades, input.tagGroups)) {
    const rows = group.rows.filter(enough);
    rows.forEach((t, i) => {
      if (t.net < 0) {
        add(
          {
            kind: 'leak',
            category: group.name,
            icon: 'slate',
            parts:
              t.wins === 0
                ? [
                    { text: 'You lose every ' },
                    { text: t.name, strong: true },
                    { text: ' trade: ' },
                    { text: money(t.net), strong: true, tone: 'loss' },
                    { text: '.' },
                  ]
                : [
                    { text: t.name, strong: true },
                    { text: ' trades lose ' },
                    { text: lost(t.net), strong: true, tone: 'loss' },
                    { text: ` (${pct(t.winRate)} win).` },
                  ],
            meta: plural(t.total, 'trade'),
            tab: 'tags',
          },
          t.net,
        );
      } else if (t.net > 0) {
        const best = i === 0 && /setup/i.test(group.name);
        add(
          {
            kind: 'edge',
            category: best ? 'Edge' : group.name,
            icon: best ? 'orange' : 'green',
            parts: best
              ? [
                  { text: 'Strongest setup: ' },
                  { text: t.name, strong: true },
                  {
                    text: `, ${pct(t.winRate)} win${t.avgR !== null ? `, ${t.avgR > 0 ? '+' : ''}${t.avgR.toFixed(1)}R` : ''}.`,
                  },
                ]
              : t.losses === 0
                ? [
                    { text: 'You win every ' },
                    { text: t.name, strong: true },
                    { text: ' trade: ' },
                    { text: money(t.net), strong: true, tone: 'win' },
                    { text: '.' },
                  ]
                : [
                    { text: t.name, strong: true },
                    { text: ` trades win ${pct(t.winRate)} and make ` },
                    { text: money(t.net), strong: true, tone: 'win' },
                    { text: '.' },
                  ],
            meta: best ? `${plural(t.total, 'trade')} · ${money(t.net)}` : plural(t.total, 'trade'),
            tab: 'tags',
          },
          t.net,
        );
      }
    });
  }

  // Timing: sessions, entry hours, weekdays
  const timing = (g: GroupStats, label: string, icon: Pattern['icon'], category: string) => {
    if (!enough(g) || g.net === 0) return;
    const leak = g.net < 0;
    add(
      {
        kind: leak ? 'leak' : 'edge',
        category,
        icon,
        parts: leak
          ? [
              { text: label, strong: true },
              { text: ' trades lose ' },
              { text: lost(g.net), strong: true, tone: 'loss' },
              { text: ` (${pct(g.winRate)} win).` },
            ]
          : [
              { text: label, strong: true },
              { text: ` trades win ${pct(g.winRate)} and make ` },
              { text: money(g.net), strong: true, tone: 'win' },
              { text: '.' },
            ],
        meta: plural(g.total, 'trade'),
        tab: 'timing',
      },
      g.net,
    );
  };
  for (const s of edge.sessions) timing(s, s.key, 'cyan', 'Session');
  for (const h of edge.hours) timing(h, `${h.key}:00`, 'blue', 'Time of day');
  for (const d of buildDayOfWeek(trades)) timing({ ...d, key: d.name }, `${d.name}`, 'blue', 'Day');

  // Grades
  for (const g of edge.grades.filter(enough)) {
    if (g.net === 0) continue;
    add(
      {
        kind: g.net < 0 ? 'leak' : 'edge',
        category: 'Grade',
        icon: g.net < 0 ? 'orange' : 'green',
        parts:
          g.net < 0
            ? [
                { text: `${g.key} grade`, strong: true },
                { text: ' trades lose ' },
                { text: lost(g.net), strong: true, tone: 'loss' },
                { text: `, ${record(g)}.` },
              ]
            : [
                { text: `${g.key} grade`, strong: true },
                { text: ` trades: ${record(g)}, ` },
                { text: money(g.net), strong: true, tone: 'win' },
                { text: '.' },
              ],
        meta: plural(g.total, 'trade'),
        tab: 'psychology',
      },
      g.net,
    );
  }

  // Mistakes
  for (const m of buildMistakeCost(trades, input.mistakes).rows) {
    if (m.count < MIN_SAMPLE || m.net >= 0) continue;
    add(
      {
        kind: 'leak',
        category: 'Mistake',
        icon: 'orange',
        parts: [
          { text: m.name, strong: true },
          { text: ' cost you ' },
          { text: lost(m.net), strong: true, tone: 'loss' },
          { text: '.' },
        ],
        meta: plural(m.count, 'time'),
        tab: 'discipline',
      },
      m.net,
    );
  }

  // Rules
  const r = input.rules;
  if (r && r.totalTradesWithRules >= MIN_SAMPLE && r.avgPnlRulesFollowed > r.avgPnlRuleBroken) {
    add(
      {
        kind: 'edge',
        category: 'Discipline',
        icon: 'green',
        parts: [
          { text: 'When you follow every rule you average ' },
          {
            text: money(r.avgPnlRulesFollowed),
            strong: true,
            tone: r.avgPnlRulesFollowed >= 0 ? 'win' : 'loss',
          },
          { text: ' vs ' },
          {
            text: money(r.avgPnlRuleBroken),
            strong: true,
            tone: r.avgPnlRuleBroken >= 0 ? 'win' : 'loss',
          },
          { text: ' when you break one.' },
        ],
        meta: `${r.followedTradesCount} of ${r.totalTradesWithRules} trades`,
        tab: 'discipline',
      },
      // what breaking rules cost, roughly: the gap times the trades that broke one
      (r.avgPnlRulesFollowed - r.avgPnlRuleBroken) *
        (r.totalTradesWithRules - r.followedTradesCount),
    );
  }

  // Sequences: what you do right after a loss, and on busy days
  const after = afterLoss(trades);
  if (enough(after) && (after.net < 0 || after.winRate + 15 <= overall.winRate)) {
    add(
      {
        kind: 'leak',
        category: 'Sequence',
        icon: 'blue',
        parts: [
          { text: 'Right after a loss, your next trade within 30 min wins only ' },
          { text: pct(after.winRate), strong: true },
          { text: ' (' },
          { text: money(after.net), strong: true, tone: after.net < 0 ? 'loss' : 'win' },
          { text: ').' },
        ],
        meta: plural(after.total, 'trade'),
        tab: null,
      },
      after.net < 0 ? after.net : after.total * 50,
    );
  }
  const busy = byTradesPerDay(trades);
  if (busy.manyDays >= 2 && enough(busy.many) && busy.many.net < 0) {
    add(
      {
        kind: 'leak',
        category: 'Overtrading',
        icon: 'pink',
        parts: [
          { text: 'On days you take ' },
          { text: '3+ trades', strong: true },
          { text: ' you lose ' },
          { text: lost(busy.many.net), strong: true, tone: 'loss' },
          { text: ` (${pct(busy.many.winRate)} win).` },
        ],
        meta: `${plural(busy.manyDays, 'day')} · ${plural(busy.many.total, 'trade')}`,
        tab: null,
      },
      busy.many.net,
    );
  }

  // Strongest first. Two patterns over the very same trades (say "New York AM" and
  // "10:00" when every NY AM trade was at 10) show once.
  const seen = new Set<string>();
  const unique = out
    .sort((a, b) => b.weight - a.weight)
    .filter((p) => {
      const sameTrades = `${p.kind}|${parseInt(p.meta, 10)}|${Math.round(p.weight)}`;
      if (seen.has(sameTrades)) return false;
      seen.add(sameTrades);
      return true;
    });
  return {
    leaks: unique.filter((p) => p.kind === 'leak'),
    edges: unique.filter((p) => p.kind === 'edge'),
  };
}

// ---------- streaks and records ----------

export interface Run {
  length: number;
  from: string | null;
  to: string | null;
}

export interface Records {
  current: { outcome: 'win' | 'loss'; length: number } | null;
  bestWinStreak: Run;
  worstLossStreak: Run;
  rulesKept: number; // trades in a row, up to now, that followed every rule
  bestDay: { date: string; net: number } | null;
  bestMonth: { month: string; net: number } | null;
}

// Break-evens don't break or extend a streak
export function buildRecords(trades: InsightTrade[]): Records {
  const sorted = chronological(trades);
  const best: Run = { length: 0, from: null, to: null };
  const worst: Run = { length: 0, from: null, to: null };
  let run = null as { outcome: 'win' | 'loss'; length: number; from: string } | null;
  for (const t of sorted) {
    const o = outcomeOf(t);
    if (o === 'be') continue;
    const date = t.trade_date.slice(0, 10);
    if (run && run.outcome === o) run.length += 1;
    else run = { outcome: o, length: 1, from: date };
    const target = o === 'win' ? best : worst;
    if (run.length > target.length)
      Object.assign(target, { length: run.length, from: run.from, to: date });
  }

  let rulesKept = 0;
  for (const t of [...sorted].reverse()) {
    if (t.rulesFollowed === true) rulesKept += 1;
    else if (t.rulesFollowed === false) break;
  }

  const sum = (key: (t: InsightTrade) => string) => {
    const totals = new Map<string, number>();
    for (const t of sorted) totals.set(key(t), (totals.get(key(t)) ?? 0) + t.netPnl);
    let top: [string, number] | null = null;
    for (const entry of totals) if (entry[1] > 0 && (!top || entry[1] > top[1])) top = entry;
    return top && { key: top[0], net: Math.round(top[1] * 100) / 100 };
  };
  const day = sum((t) => t.trade_date.slice(0, 10));
  const month = sum((t) => t.trade_date.slice(0, 7));

  return {
    current: run ? { outcome: run.outcome, length: run.length } : null,
    bestWinStreak: best,
    worstLossStreak: worst,
    rulesKept,
    bestDay: day && { date: day.key, net: day.net },
    bestMonth: month && { month: month.key, net: month.net },
  };
}
