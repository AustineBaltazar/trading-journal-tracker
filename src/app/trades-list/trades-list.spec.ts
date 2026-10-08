import { ComponentFixture, TestBed } from '@angular/core/testing';
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

  it('loads the current mode and reloads when it changes', async () => {
    const http = TestBed.inject(HttpTestingController);
    const modeOf = () =>
      http.match((r) => r.url.endsWith('/trades')).map((r) => r.request.params.get('mode'));
    expect(modeOf()).toEqual(['live']);

    TestBed.inject(TradeModeService).set('backtest');
    await fixture.whenStable();
    expect(modeOf()).toEqual(['backtest']);
    localStorage.removeItem('tradeMode');
  });
});
