import { TestBed } from '@angular/core/testing';
import { ModeBadge, TradeModeService, MODE_SWITCH } from './trade-mode';

describe('TradeModeService', () => {
  beforeEach(() => localStorage.removeItem('tradeMode'));
  afterEach(() => localStorage.removeItem('tradeMode'));

  it('starts in live mode', () => {
    expect(TestBed.inject(TradeModeService).mode()).toBe('live');
  });

  it.skipIf(MODE_SWITCH)('stays live while the switch is off, even with a stored mode', () => {
    localStorage.setItem('tradeMode', 'backtest');
    const service = TestBed.inject(TradeModeService);
    expect(service.mode()).toBe('live');
    service.set('eval');
    expect(service.mode()).toBe('live');
  });

  // Only while the Live / Eval / Backtest switch is on
  it.skipIf(!MODE_SWITCH)('remembers the chosen mode', () => {
    TestBed.inject(TradeModeService).set('backtest');
    expect(localStorage.getItem('tradeMode')).toBe('backtest');
  });

  // Only while the Live / Eval / Backtest switch is on
  it.skipIf(!MODE_SWITCH)('restores a stored mode and ignores junk values', () => {
    localStorage.setItem('tradeMode', 'backtest');
    expect(new TradeModeService().isBacktest()).toBe(true);
    localStorage.setItem('tradeMode', 'paper');
    expect(new TradeModeService().mode()).toBe('live');
  });
});

describe('ModeBadge', () => {
  afterEach(() => localStorage.removeItem('tradeMode'));

  // Only while the Live / Eval / Backtest switch is on
  it.skipIf(!MODE_SWITCH)('shows only in backtest mode', async () => {
    const fixture = TestBed.createComponent(ModeBadge);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).not.toContain('BACKTEST');

    TestBed.inject(TradeModeService).set('backtest');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('BACKTEST');
  });
});
