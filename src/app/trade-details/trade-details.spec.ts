import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TradeDetails } from './trade-details';

describe('TradeDetails', () => {
  let component: TradeDetails;
  let fixture: ComponentFixture<TradeDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TradeDetails],
    }).compileComponents();

    fixture = TestBed.createComponent(TradeDetails);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
