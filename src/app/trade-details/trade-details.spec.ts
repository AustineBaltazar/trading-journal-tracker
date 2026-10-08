import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TradeDetails } from './trade-details';

describe('TradeDetails', () => {
  let component: TradeDetails;
  let fixture: ComponentFixture<TradeDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TradeDetails],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TradeDetails);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
