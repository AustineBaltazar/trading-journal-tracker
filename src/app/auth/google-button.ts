import { AfterViewInit, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { environment } from '../../environments/environment';

interface GoogleIdApi {
  initialize(options: Record<string, unknown>): void;
  renderButton(el: HTMLElement, options: Record<string, unknown>): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

export const googleOn = () => Boolean(environment.googleClientId);

let script: Promise<void> | null = null;
function loadGoogle(): Promise<void> {
  script ??= new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = 'https://accounts.google.com/gsi/client?hl=en';
    tag.async = true;
    tag.onload = () => resolve();
    tag.onerror = () => {
      script = null;
      reject(new Error('Google sign-in failed to load'));
    };
    document.head.appendChild(tag);
  });
  return script;
}

// Google's own "Sign in with Google" button. Emits the signed ID token
// ("credential") that the API checks with Google.
@Component({
  selector: 'app-google-button',
  host: { class: 'block' },
  template: `<div #box class="flex justify-center min-h-[40px]"></div>`,
})
export class GoogleButton implements AfterViewInit {
  text = input<'continue_with' | 'signup_with' | 'signin_with'>('continue_with');
  width = input(300);
  credential = output<string>();
  failed = output<void>();
  private box = viewChild.required<ElementRef<HTMLElement>>('box');

  ngAfterViewInit() {
    loadGoogle()
      .then(() => {
        const api = window.google?.accounts.id;
        if (!api) throw new Error('Google sign-in is unavailable');
        api.initialize({
          client_id: environment.googleClientId,
          callback: (response: { credential?: string }) => {
            if (response.credential) this.credential.emit(response.credential);
          },
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        api.renderButton(this.box().nativeElement, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: this.text(),
          logo_alignment: 'left',
          // The site is in English, so the button is too (Google otherwise follows the browser)
          locale: 'en',
          width: this.width(),
        });
      })
      .catch(() => this.failed.emit());
  }
}
