import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TradeModeService } from '../trade-mode';
import { provideRouter } from '@angular/router';
import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('requests every stat for the current mode and reloads on switch', async () => {
    const http = TestBed.inject(HttpTestingController);
    const requests = () =>
      http
        .match(() => true)
        .map(
          (r) => `${r.request.url.split('/').slice(3).join('/')}?${r.request.params.get('mode')}`,
        )
        .sort();
    expect(requests()).toEqual(['rule-adherence?live', 'trades/summary?live', 'trades?live']);

    TestBed.inject(TradeModeService).set('backtest');
    await fixture.whenStable();
    expect(requests()).toEqual([
      'rule-adherence?backtest',
      'trades/summary?backtest',
      'trades?backtest',
    ]);
    localStorage.removeItem('tradeMode');
  });
});
