import { EvalAttempt, evalProgress, PRESETS } from './eval-logic';

const growth = PRESETS.find((p) => p.key === 'tradeify-growth-25k')!.rules;
const attempt = (extra: Partial<EvalAttempt> = {}): EvalAttempt => ({
  id: 1,
  ...growth,
  startedOn: '2026-10-13',
  endedOn: null,
  result: null,
  failReason: null,
  ...extra,
});
let id = 1;
const t = (date: string, net: number, time = '10:00') => ({
  id: id++,
  trade_date: date,
  entry_time: time,
  netPnl: net,
  outcome: (net > 0 ? 'win' : net < 0 ? 'loss' : 'be') as 'win' | 'loss' | 'be',
});

describe('evalProgress', () => {
  const trades = [
    t('2026-10-10', 999), // before the attempt: not counted
    t('2026-10-13', 400),
    t('2026-10-14', 300),
    t('2026-10-14', -100, '11:00'),
    t('2026-10-15', -150),
    t('2026-10-17', -200), // today
  ];

  it('tracks profit, the end-of-day trailing floor and today', () => {
    const p = evalProgress(attempt(), trades, '2026-10-17');
    expect(p.trades).toHaveLength(5);
    expect(p.profit).toBe(250);
    expect(p.balance).toBe(25250);
    // highest end-of-day balance was 25,600 (after the 14th); today doesn't move it
    expect(p.highBalance).toBe(25600);
    expect(p.floor).toBe(24600);
    expect(p.roomLeft).toBe(650);
    // $600 daily limit, down $200 today: $400 left, below the $650 drawdown room
    expect(p.today).toEqual({ net: -200, trades: 1, left: 400, canLose: 400 });
    expect(p.avgLoss).toBe(150);
    expect(p.stopsLeft).toBe(2);
    expect(p.targetLeft).toBe(1250);
    expect(p.targetPct).toBe(17);
    expect(p.daysTraded).toBe(4);
    expect(p.days.map((d) => d.net)).toEqual([400, 200, -150, -200]);
    expect(p.status).toBe('on-track');
  });

  it('live trailing drawdown follows the highest balance trade by trade', () => {
    const p = evalProgress(attempt({ drawdownType: 'trailing' }), trades, '2026-10-17');
    expect(p.highBalance).toBe(25700); // 25,000 + 400 + 300 before the -100
    expect(p.floor).toBe(24700);
  });

  it('a fixed drawdown never moves', () => {
    expect(evalProgress(attempt({ drawdownType: 'static' }), trades, '2026-10-17').floor).toBe(
      24000,
    );
  });

  it('flags a broken daily limit, close calls and a breach', () => {
    const p = evalProgress(attempt(), [t('2026-10-13', -800)], '2026-10-14');
    expect(p.days[0].hitDailyLimit).toBe(true);
    expect(p.roomLeft).toBe(200);
    expect(p.status).toBe('close'); // under 25% of the $1,000 drawdown left
    const breached = evalProgress(attempt(), [t('2026-10-13', -1000)], '2026-10-14');
    expect(breached.status).toBe('breached');
    expect(breached.today.canLose).toBe(0);
  });

  it('Select: needs 3 days and a best day within 40% of profit', () => {
    const select = attempt({ ...PRESETS.find((p) => p.key === 'tradeify-select-25k')!.rules });
    const oneBigDay = evalProgress(select, [t('2026-10-13', 1600)], '2026-10-14');
    expect(oneBigDay.status).toBe('almost');
    expect(oneBigDay.daysNeeded).toBe(2);
    expect(oneBigDay.consistency).toBe(100);
    expect(oneBigDay.consistencyOk).toBe(false);
    expect(oneBigDay.today.left).toBeNull(); // no daily limit on Select
    const spread = evalProgress(
      select,
      [t('2026-10-13', 600), t('2026-10-14', 500), t('2026-10-15', 500)],
      '2026-10-16',
    );
    expect(spread.consistency).toBe(38);
    expect(spread.status).toBe('target-reached');
  });

  it('an ended attempt only counts its own dates', () => {
    const ended = attempt({ endedOn: '2026-10-14', result: 'failed' });
    expect(evalProgress(ended, trades, '2026-10-17').profit).toBe(600);
  });
});
