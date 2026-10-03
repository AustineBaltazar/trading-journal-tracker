import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Playbook } from './playbook';

describe('Playbook', () => {
  let component: Playbook;
  let fixture: ComponentFixture<Playbook>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Playbook],
    }).compileComponents();

    fixture = TestBed.createComponent(Playbook);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
