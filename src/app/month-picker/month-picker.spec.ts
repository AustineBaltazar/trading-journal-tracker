import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MonthPicker } from './month-picker';
import { currentMonth, shiftMonth, YearMonth } from '../trade-journal';

describe('MonthPicker', () => {
  let fixture: ComponentFixture<MonthPicker>;
  let picker: MonthPicker;
  let emitted: YearMonth[];
  const el = () => fixture.nativeElement as HTMLElement;
  const label = () => el().querySelector<HTMLButtonElement>('[data-month-label]')!;
  const monthButton = (m: number) => el().querySelector<HTMLButtonElement>(`[data-month="${m}"]`);

  async function setup(value: YearMonth, marked = new Set<string>()) {
    await TestBed.configureTestingModule({ imports: [MonthPicker] }).compileComponents();
    fixture = TestBed.createComponent(MonthPicker);
    picker = fixture.componentInstance;
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('marked', marked);
    emitted = [];
    picker.valueChange.subscribe((v) => emitted.push(v));
    await fixture.whenStable();
  }

  it('shows the month and steps with the arrows', async () => {
    await setup({ year: 2026, month: 8 });
    expect(label().textContent).toContain('September 2026');
    el().querySelector<HTMLButtonElement>('[aria-label="Previous month"]')!.click();
    expect(emitted).toEqual([{ year: 2026, month: 7 }]);
  });

  it('cannot step past the current month', async () => {
    await setup(currentMonth());
    const next = el().querySelector<HTMLButtonElement>('[aria-label="Next month"]')!;
    expect(next.disabled).toBe(true);
    picker.step(1);
    expect(emitted).toEqual([]);
  });

  it('opens a month grid, marks months with trades, and picks a month', async () => {
    const value = shiftMonth(currentMonth(), -12);
    await setup(value, new Set([`${value.year}-03`]));
    label().click();
    await fixture.whenStable();

    expect(el().querySelector('[role="dialog"]')).toBeTruthy();
    expect(monthButton(value.month)!.getAttribute('aria-current')).toBe('date');
    expect(monthButton(2)!.querySelector('.bg-emerald-400')).toBeTruthy();

    monthButton(2)!.click();
    await fixture.whenStable();
    expect(emitted).toEqual([{ year: value.year, month: 2 }]);
    expect(el().querySelector('[role="dialog"]')).toBeNull();
  });

  it('disables future months in the current year', async () => {
    const now = currentMonth();
    await setup(now);
    label().click();
    await fixture.whenStable();
    if (now.month < 11) expect(monthButton(now.month + 1)!.disabled).toBe(true);
    expect(monthButton(now.month)!.disabled).toBe(false);
  });

  it('closes on Escape and on an outside click', async () => {
    await setup({ year: 2026, month: 8 });
    label().click();
    await fixture.whenStable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(el().querySelector('[role="dialog"]')).toBeNull();

    label().click();
    await fixture.whenStable();
    document.body.click();
    await fixture.whenStable();
    expect(el().querySelector('[role="dialog"]')).toBeNull();
  });

  it('"This month" jumps to the current month', async () => {
    await setup({ year: 2025, month: 1 });
    label().click();
    await fixture.whenStable();
    [...el().querySelectorAll('button')]
      .find((b) => b.textContent?.includes('This month'))!
      .click();
    expect(emitted).toEqual([currentMonth()]);
  });
});
