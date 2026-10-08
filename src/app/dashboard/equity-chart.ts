// SVG layout (viewBox units). The curve and the per-trade bars share the x axis.
export const CHART = {
  width: 720,
  left: 60,
  right: 12,
  top: 12,
  curveHeight: 170,
  gap: 16,
  barsHeight: 48,
  bottom: 24,
};
export const CHART_HEIGHT =
  CHART.top + CHART.curveHeight + CHART.gap + CHART.barsHeight + CHART.bottom;

export interface EquityPoint {
  x: number;
  y: number;
  date: string;
  pnl: number;
  total: number;
}

export interface EquityChart {
  points: EquityPoint[]; // index 0 is the $0 starting point, then one per trade
  linePath: string;
  areaPath: string;
  zeroY: number;
  ticks: { y: number; label: string }[];
  bars: { x: number; y: number; width: number; height: number; positive: boolean }[];
  barsZeroY: number;
  dateLabels: { x: number; label: string; anchor: 'start' | 'middle' | 'end' }[];
  labelY: number;
  drawdown: { x: number; width: number } | null;
  stats: {
    current: number;
    peak: number;
    maxDrawdown: number;
    best: number;
    worst: number;
  };
}

// Rounds a raw step up to 1, 2, 2.5 or 5 x 10^n so axis labels read cleanly.
export function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function formatAxis(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildEquityChart(trades: any[]): EquityChart | null {
  if (trades.length === 0) return null;

  const sorted = [...trades].sort(
    (a, b) => a.trade_date.localeCompare(b.trade_date) || a.id - b.id,
  );

  let total = 0;
  const raw = [{ date: '', pnl: 0, total: 0 }];
  for (const trade of sorted) {
    total += trade.netPnl;
    raw.push({ date: trade.trade_date.substring(0, 10), pnl: trade.netPnl, total: round2(total) });
  }

  // y domain always includes $0, snapped to nice tick boundaries
  const totals = raw.map((p) => p.total);
  const step = niceStep((Math.max(...totals, 0) - Math.min(...totals, 0)) / 4 || 1);
  const lo = Math.floor(Math.min(...totals, 0) / step) * step;
  let hi = Math.ceil(Math.max(...totals, 0) / step) * step;
  if (hi === lo) hi = lo + step;

  const plotWidth = CHART.width - CHART.left - CHART.right;
  const xAt = (i: number) => CHART.left + (i / (raw.length - 1)) * plotWidth;
  const yAt = (v: number) => CHART.top + ((hi - v) / (hi - lo)) * CHART.curveHeight;

  const points: EquityPoint[] = raw.map((p, i) => ({ ...p, x: xAt(i), y: yAt(p.total) }));
  const zeroY = yAt(0);

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const last = points[points.length - 1];
  const areaPath = `${linePath} L${last.x.toFixed(1)},${zeroY.toFixed(1)} L${points[0].x.toFixed(1)},${zeroY.toFixed(1)} Z`;

  const ticks: { y: number; label: string }[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) {
    ticks.push({ y: yAt(v), label: formatAxis(v) });
  }

  // Per-trade P/L bars, scaled to the largest single win or loss
  const barsTop = CHART.top + CHART.curveHeight + CHART.gap;
  const barsZeroY = barsTop + CHART.barsHeight / 2;
  const maxAbs = Math.max(...raw.slice(1).map((p) => Math.abs(p.pnl)), 1);
  const barWidth = Math.max(2, Math.min(14, (plotWidth / sorted.length) * 0.6));
  const bars = points.slice(1).map((p) => {
    const height = Math.max(1, (Math.abs(p.pnl) / maxAbs) * (CHART.barsHeight / 2));
    return {
      x: p.x - barWidth / 2,
      y: p.pnl >= 0 ? barsZeroY - height : barsZeroY,
      width: barWidth,
      height,
      positive: p.pnl >= 0,
    };
  });

  // Largest peak-to-trough drop in the running total
  let peakIndex = 0;
  let maxDrawdown = 0;
  let drawdownFrom = 0;
  let drawdownTo = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].total > points[peakIndex].total) peakIndex = i;
    const drop = points[peakIndex].total - points[i].total;
    if (drop > maxDrawdown) {
      maxDrawdown = drop;
      drawdownFrom = peakIndex;
      drawdownTo = i;
    }
  }

  const labelY = barsTop + CHART.barsHeight + 18;
  const dateLabels: EquityChart['dateLabels'] = [
    { x: points[1].x, label: points[1].date, anchor: 'start' },
  ];
  if (points.length > 3) {
    const mid = points[Math.ceil((points.length - 1) / 2)];
    dateLabels.push({ x: mid.x, label: mid.date, anchor: 'middle' });
  }
  if (points.length > 2) dateLabels.push({ x: last.x, label: last.date, anchor: 'end' });

  const pnls = raw.slice(1).map((p) => p.pnl);
  return {
    points,
    linePath,
    areaPath,
    zeroY,
    ticks,
    bars,
    barsZeroY,
    dateLabels,
    labelY,
    drawdown:
      maxDrawdown > 0
        ? { x: points[drawdownFrom].x, width: points[drawdownTo].x - points[drawdownFrom].x }
        : null,
    stats: {
      current: last.total,
      peak: round2(Math.max(...totals, 0)),
      maxDrawdown: round2(maxDrawdown),
      best: round2(Math.max(...pnls)),
      worst: round2(Math.min(...pnls)),
    },
  };
}
