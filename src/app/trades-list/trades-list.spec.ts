import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MODE_SWITCH } from '../trade-mode';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TradeModeService } from '../trade-mode';
import { provideRouter } from '@angular/router';
import { TradesList } from './trades-list';

describe('TradesList', () => {
  let component: TradesList;
  let fixture: ComponentFixture<TradesList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TradesList],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TradesList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Only while the Live / Eval / Backtest switch is on
  it.skipIf(!MODE_SWITCH)('loads the current mode and reloads when it changes', async () => {
    const http = TestBed.inject(HttpTestingController);
    const modeOf = () =>
      http.match((r) => r.url.endsWith('/trades')).map((r) => r.request.params.get('mode'));
    expect(modeOf()).toEqual(['live']);

    TestBed.inject(TradeModeService).set('backtest');
    await fixture.whenStable();
    expect(modeOf()).toEqual(['backtest']);
    localStorage.removeItem('tradeMode');
  });

  it('shows 10 trades a page, and filters or sorting go back to page 1', () => {
    const month = component.viewedMonth();
    const day = (d: number) =>
      `${month.year}-${String(month.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    component.trades.set(
      Array.from({ length: 23 }, (_, i) => ({ id: i + 1, trade_date: day((i % 28) + 1), pnl: i })),
    );
    expect(component.pages()).toBe(3);
    expect(component.pageTrades().length).toBe(10);
    component.setPage(3);
    expect(component.pageTrades().length).toBe(3);
    expect([component.firstShown(), component.lastShown()]).toEqual([21, 23]);
    component.sortBy('pnl');
    expect(component.currentPage()).toBe(1);
    component.setPageSize(25);
    expect(component.pages()).toBe(1);
    expect(localStorage.getItem('tradesPageSize')).toBe('25');
    localStorage.removeItem('tradesPageSize');
  });
});
