import { AfterViewInit, Component, ElementRef, OnDestroy, output, viewChild } from '@angular/core';
import { environment } from '../../environments/environment';

interface TurnstileApi {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export const turnstileOn = () => Boolean(environment.turnstileSiteKey);

let script: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  script ??= new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    tag.async = true;
    tag.onload = () => resolve();
    tag.onerror = () => {
      script = null;
      reject(new Error('Turnstile failed to load'));
    };
    document.head.appendChild(tag);
  });
  return script;
}

// Cloudflare's "are you human" check. Emits a one-time token, or null when it expires.
@Component({
  selector: 'app-turnstile',
  host: { class: 'block' },
  template: `<div #box class="min-h-[65px]"></div>`,
})
export class Turnstile implements AfterViewInit, OnDestroy {
  token = output<string | null>();
  private box = viewChild.required<ElementRef<HTMLElement>>('box');
  private widgetId: string | null = null;
  private destroyed = false;

  ngAfterViewInit() {
    loadTurnstile()
      .then(() => {
        if (this.destroyed || !window.turnstile) return;
        this.widgetId = window.turnstile.render(this.box().nativeElement, {
          sitekey: environment.turnstileSiteKey,
          theme: 'dark',
          callback: (token: string) => this.token.emit(token),
          'expired-callback': () => this.token.emit(null),
          'error-callback': () => this.token.emit(null),
        });
      })
      .catch(() => this.token.emit(null));
  }

  // Tokens work once: call after each submit
  reset() {
    if (this.widgetId && window.turnstile) window.turnstile.reset(this.widgetId);
    this.token.emit(null);
  }

  ngOnDestroy() {
    this.destroyed = true;
    if (this.widgetId && window.turnstile) window.turnstile.remove(this.widgetId);
  }
}
