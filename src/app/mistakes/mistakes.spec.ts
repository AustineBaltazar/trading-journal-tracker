import { TestBed } from '@angular/core/testing';
import { buildMistakeCost, MistakePicker } from './mistakes';

const mistakes = [
  { id: 1, name: 'Moved my stop' },
  { id: 2, name: 'Oversized the position' },
  { id: 3, name: 'Exited too early' },
  { id: 4, name: 'Traded during news' },
];

describe('buildMistakeCost', () => {
  const trades = [
    { netPnl: 300 },
    { netPnl: 200, mistakeIds: [] },
    { netPnl: -100 },
    { netPnl: -400, mistakeIds: [1, 2] },
    { netPnl: -150, mistakeIds: [1] },
    { netPnl: 80, mistakeIds: [3] },
  ];
  const cost = buildMistakeCost(trades, mistakes);

  it('splits clean trades from trades with mistakes', () => {
    expect(cost.total).toEqual({ count: 6, net: -70 });
    expect(cost.clean).toEqual({ count: 3, net: 400, winRate: 67 });
    expect(cost.withMistakes).toEqual({ count: 3, net: -470, winRate: 33 });
  });

  it('lists mistakes that happened, most expensive first', () => {
    expect(cost.rows).toEqual([
      { id: 1, name: 'Moved my stop', count: 2, winRate: 0, net: -550 },
      { id: 2, name: 'Oversized the position', count: 1, winRate: 0, net: -400 },
      { id: 3, name: 'Exited too early', count: 1, winRate: 100, net: 80 },
    ]);
  });

  it('handles no trades', () => {
    const empty = buildMistakeCost([], mistakes);
    expect(empty.rows).toEqual([]);
    expect(empty.clean).toEqual({ count: 0, net: 0, winRate: 0 });
  });
});

describe('MistakePicker', () => {
  it('shows chips, the clean state, and emits toggles', async () => {
    const fixture = TestBed.createComponent(MistakePicker);
    fixture.componentRef.setInput('options', mistakes.slice(0, 2));
    fixture.componentRef.setInput('selected', new Set<number>());
    const toggled: number[] = [];
    fixture.componentInstance.toggle.subscribe((id) => toggled.push(id));
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Clean trade');
    el.querySelectorAll('button')[1].click();
    expect(toggled).toEqual([2]);

    fixture.componentRef.setInput('selected', new Set([2]));
    await fixture.whenStable();
    expect(el.querySelectorAll('button')[1].getAttribute('aria-pressed')).toBe('true');
    expect(el.textContent).toContain('1 mistake tagged');
  });
});
