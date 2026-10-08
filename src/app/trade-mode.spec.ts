import { TestBed } from '@angular/core/testing';
import { ModeBadge, TradeModeService } from './trade-mode';

describe('TradeModeService', () => {
  beforeEach(() => localStorage.removeItem('tradeMode'));
  afterEach(() => localStorage.removeItem('tradeMode'));

  it('starts in live mode', () => {
    expect(TestBed.inject(TradeModeService).mode()).toBe('live');
  });

  it('remembers the chosen mode', () => {
    TestBed.inject(TradeModeService).set('backtest');
    expect(localStorage.getItem('tradeMode')).toBe('backtest');
  });

  it('restores a stored mode and ignores junk values', () => {
    localStorage.setItem('tradeMode', 'backtest');
    expect(new TradeModeService().isBacktest()).toBe(true);
    localStorage.setItem('tradeMode', 'paper');
    expect(new TradeModeService().mode()).toBe('live');
  });
});

describe('ModeBadge', () => {
  afterEach(() => localStorage.removeItem('tradeMode'));

  it('shows only in backtest mode', async () => {
    const fixture = TestBed.createComponent(ModeBadge);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).not.toContain('BACKTEST');

    TestBed.inject(TradeModeService).set('backtest');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('BACKTEST');
  });
});
