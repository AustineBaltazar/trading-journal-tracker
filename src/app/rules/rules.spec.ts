import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Rules } from './rules';

describe('Rules', () => {
  let component: Rules;
  let fixture: ComponentFixture<Rules>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Rules],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Rules);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
