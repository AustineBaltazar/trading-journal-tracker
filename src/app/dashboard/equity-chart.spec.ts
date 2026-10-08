import { buildEquityChart, CHART, niceStep } from './equity-chart';

const trade = (id: number, trade_date: string, netPnl: number) => ({ id, trade_date, netPnl });

describe('niceStep', () => {
  it('rounds up to 1, 2, 2.5 or 5 times a power of ten', () => {
    expect(niceStep(0.8)).toBe(1);
    expect(niceStep(180)).toBe(200);
    expect(niceStep(240)).toBe(250);
    expect(niceStep(380)).toBe(500);
    expect(niceStep(700)).toBe(1000);
  });
});

describe('buildEquityChart', () => {
  it('returns null with no trades', () => {
    expect(buildEquityChart([])).toBeNull();
  });

  it('builds a running total in date order, then id order', () => {
    const chart = buildEquityChart([
      trade(3, '2026-10-02', -300),
      trade(2, '2026-10-01', 200),
      trade(1, '2026-10-01', 100),
    ])!;
    expect(chart.points.map((p) => p.total)).toEqual([0, 100, 300, 0]);
    expect(chart.points[1].date).toBe('2026-10-01');
  });

  it('computes stats including the largest peak-to-trough drop', () => {
    const chart = buildEquityChart([
      trade(1, '2026-10-01', 400),
      trade(2, '2026-10-02', -600),
      trade(3, '2026-10-03', 100),
      trade(4, '2026-10-04', 300),
    ])!;
    expect(chart.stats).toEqual({
      current: 200,
      peak: 400,
      maxDrawdown: 600,
      best: 400,
      worst: -600,
    });
    expect(chart.drawdown!.x).toBeCloseTo(chart.points[1].x);
    expect(chart.drawdown!.width).toBeCloseTo(chart.points[2].x - chart.points[1].x);
  });

  it('puts $0 on a tick and keeps every point inside the curve area', () => {
    const chart = buildEquityChart([trade(1, '2026-10-01', -250), trade(2, '2026-10-02', 900)])!;
    expect(chart.ticks.some((t) => t.label === '$0' && Math.abs(t.y - chart.zeroY) < 0.01)).toBe(
      true,
    );
    for (const p of chart.points) {
      expect(p.y).toBeGreaterThanOrEqual(CHART.top - 0.01);
      expect(p.y).toBeLessThanOrEqual(CHART.top + CHART.curveHeight + 0.01);
    }
  });

  it('draws winning bars up and losing bars down from the bar baseline', () => {
    const chart = buildEquityChart([trade(1, '2026-10-01', 100), trade(2, '2026-10-02', -50)])!;
    const [win, loss] = chart.bars;
    expect(win.positive).toBe(true);
    expect(win.y + win.height).toBeCloseTo(chart.barsZeroY);
    expect(loss.positive).toBe(false);
    expect(loss.y).toBeCloseTo(chart.barsZeroY);
    expect(loss.height).toBeCloseTo(win.height / 2);
  });
});
