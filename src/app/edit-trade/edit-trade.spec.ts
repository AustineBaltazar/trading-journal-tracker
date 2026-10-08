import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EditTrade } from './edit-trade';

describe('EditTrade', () => {
  let component: EditTrade;
  let fixture: ComponentFixture<EditTrade>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditTrade],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(EditTrade);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
