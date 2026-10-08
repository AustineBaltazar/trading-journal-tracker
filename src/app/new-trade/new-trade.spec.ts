import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NewTrade } from './new-trade';

describe('NewTrade', () => {
  let component: NewTrade;
  let fixture: ComponentFixture<NewTrade>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewTrade],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(NewTrade);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
