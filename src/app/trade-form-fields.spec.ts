import { TestBed } from '@angular/core/testing';
import { estimateNetPnl, ResultPicker, toggleEmotion } from './trade-form-fields';

describe('trade form fields', () => {
  it('estimates net P/L like the API', () => {
    const base = { symbol: 'MNQ', direction: 'long', contracts: 2, fees: 2.48 };
    expect(estimateNetPnl({ ...base, entry_price: 21000, exit_price: 21010 })).toBe(37.52);
    expect(
      estimateNetPnl({ ...base, direction: 'short', entry_price: 21000, exit_price: 21010 }),
    ).toBe(-42.48);
    expect(
      estimateNetPnl({
        ...base,
        symbol: 'NQ',
        contracts: 1,
        fees: 0,
        entry_price: 100,
        exit_price: 101,
      }),
    ).toBe(20);
  });

  it('toggles emotions and keeps the standard order', () => {
    expect(toggleEmotion(['FOMO'], 'Confident')).toEqual(['Confident', 'FOMO']);
    expect(toggleEmotion(['Confident', 'FOMO'], 'FOMO')).toEqual(['Confident']);
  });

  it('result picker: tapping the auto choice stays on auto, others override', async () => {
    const fixture = TestBed.createComponent(ResultPicker);
    fixture.componentRef.setInput('auto', 'be');
    fixture.componentRef.setInput('netPnl', -1.24);
    fixture.componentRef.setInput('entryEqualsExit', true);
    await fixture.whenStable();
    const picked: any[] = [];
    fixture.componentInstance.changed.subscribe((v) => picked.push(v));

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Auto-detected: BE');
    expect(text).toContain('fees make it −$1.24');

    const buttons = [...fixture.nativeElement.querySelectorAll('[role=radio]')] as HTMLElement[];
    expect(buttons.map((b) => b.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true']);
    buttons[2].click();
    buttons[0].click();
    expect(picked).toEqual([null, 'win']);
  });
});
