import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TradesList } from './trades-list';

describe('TradesList', () => {
  let component: TradesList;
  let fixture: ComponentFixture<TradesList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TradesList],
    }).compileComponents();

    fixture = TestBed.createComponent(TradesList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
