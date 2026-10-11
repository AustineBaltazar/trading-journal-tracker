import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { neighboursOf, TradeDetails } from './trade-details';

const api = environment.apiUrl;

describe('neighboursOf', () => {
  const trades = [
    { id: 5, trade_date: '2026-10-03' },
    { id: 2, trade_date: '2026-10-01' },
    { id: 9, trade_date: '2026-10-01' },
    { id: 7, trade_date: '2026-10-02' },
  ];

  it('finds the trades before and after, by date then id', () => {
    expect(neighboursOf(trades, 9)).toEqual({ prev: 2, next: 7 });
    expect(neighboursOf(trades, 2)).toEqual({ prev: null, next: 9 });
    expect(neighboursOf(trades, 5)).toEqual({ prev: 7, next: null });
    expect(neighboursOf(trades, 99)).toEqual({ prev: null, next: null });
  });
});

describe('TradeDetails', () => {
  let component: TradeDetails;
  let fixture: ComponentFixture<TradeDetails>;
  let backend: HttpTestingController;
  let params: BehaviorSubject<ParamMap>;

  const trade = (id: number) => ({
    id,
    mode: 'live',
    symbol: 'MNQ',
    direction: 'short',
    trade_date: '2026-08-25',
    entry_time: '10:53:00',
    exit_time: '11:13:00',
    contracts: 4,
    entry_price: '21085.25',
    exit_price: '21028.75',
    stop_price: '21105.25',
    target_price: '21025.25',
    fees: '4.96',
    netPnl: 447.04,
    rMultiple: 2.83,
    plannedR: 3,
    grade: 'B+',
    mistakeIds: [],
    tagIds: [],
    images: [],
  });

  // Answers every request the page makes for one trade
  function flushTrade(id: number) {
    backend.expectOne(`${api}/trades/${id}`).flush(trade(id));
    backend.expectOne(`${api}/rules`).flush({ rules: [] });
    backend.expectOne(`${api}/trades/${id}/rules`).flush({
      rules: [
        { id: 1, name: 'IFVG', followed: true },
        { id: 2, name: 'SMT', followed: true },
      ],
    });
    backend
      .expectOne(`${api}/questions`)
      .flush({ questions: [{ id: 3, question_text: 'Did I wait?' }] });
    backend
      .expectOne(`${api}/trades/${id}/answers`)
      .flush({ answers: [{ question_id: 3, choice: 'yes' }] });
    backend
      .expectOne((r) => r.url === `${api}/trades` && r.params.get('mode') === 'live')
      .flush({
        trades: [
          { id: 1, trade_date: '2026-08-24' },
          { id, trade_date: '2026-08-25' },
          { id: 40, trade_date: '2026-08-26' },
        ],
      });
  }

  beforeEach(async () => {
    params = new BehaviorSubject(convertToParamMap({ id: '27' }));
    await TestBed.configureTestingModule({
      imports: [TradeDetails],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TradeDetails);
    component = fixture.componentInstance;
    backend = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    backend.expectOne(`${api}/mistakes`).flush({ mistakes: [] });
    backend.expectOne(`${api}/tag-groups`).flush({ groups: [] });
    flushTrade(27);
    await fixture.whenStable();
  });

  it('scores the trade from what is saved', () => {
    const score = component.score()!;
    // rules 35/35, no mistakes 25/25, stop respected 15/15, answers 15/15, grade B+ 7/10
    expect(score.score).toBe(97);
    expect(score.label).toBe('Strong execution');
    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('Trade quality');
    expect(text).toContain('✓ IFVG');
  });

  it('shows the arrows to the trades either side', () => {
    expect(component.neighbours()).toEqual({ prev: 1, next: 40 });
  });

  it('review answers are buttons that mark the choice', async () => {
    const yes = [...fixture.nativeElement.querySelectorAll('[role=radio]')].find(
      (b: HTMLElement) => b.textContent!.trim() === 'Yes',
    ) as HTMLElement;
    expect(yes.getAttribute('aria-checked')).toBe('true');
    component.setDraftChoice(3, 'no');
    await fixture.whenStable();
    expect(yes.getAttribute('aria-checked')).toBe('false');
  });

  it('loads the other trade when the arrows change the id', () => {
    params.next(convertToParamMap({ id: '40' }));
    expect(component.trade()).toBeNull();
    flushTrade(40);
    expect(component.trade().id).toBe(40);
    backend.verify();
  });
});
