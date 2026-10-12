import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

type Kind = 'bug' | 'idea' | 'other';

// "Send feedback" in the sidebar on every page, and its small form
@Component({
  selector: 'app-feedback',
  imports: [FormsModule],
  template: `
    @if (open()) {
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby="feedback-title"
        class="fixed left-[17rem] bottom-5 z-50 w-[340px] max-w-[calc(100vw-2rem)] bg-tone-121722 border border-tone-1f293d rounded-2xl p-4 shadow-2xl shadow-black/60"
        (keydown.escape)="close()"
      >
        @if (sent()) {
          <p id="feedback-title" class="text-sm font-semibold text-white mb-1">Thank you!</p>
          <p class="text-xs text-slate-400 mb-3">Your feedback went straight to the developer.</p>
          <button
            type="button"
            (click)="close()"
            class="w-full border border-tone-1f293d text-slate-300 hover:text-white text-sm py-2 rounded-xl"
          >
            Close
          </button>
        } @else {
          <form (ngSubmit)="send()">
            <div class="flex items-center justify-between mb-3">
              <p id="feedback-title" class="text-sm font-semibold text-white">Send feedback</p>
              <button
                type="button"
                (click)="close()"
                aria-label="Close"
                class="text-slate-500 hover:text-slate-200 px-1"
              >
                ✕
              </button>
            </div>
            <div
              role="radiogroup"
              aria-label="Kind of feedback"
              class="grid grid-cols-3 gap-1 p-1 bg-tone-0e131c border border-tone-1f293d rounded-xl text-xs mb-3"
            >
              @for (option of kinds; track option.value) {
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="kind() === option.value"
                  (click)="kind.set(option.value)"
                  class="py-1.5 rounded-lg border transition-colors"
                  [class]="
                    kind() === option.value
                      ? 'bg-blue-500/15 text-blue-100 border-blue-500/40'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  "
                >
                  {{ option.label }}
                </button>
              }
            </div>
            <label for="feedback-message" class="sr-only">Your message</label>
            <textarea
              #messageBox
              id="feedback-message"
              name="message"
              rows="4"
              maxlength="2000"
              [(ngModel)]="message"
              [placeholder]="placeholder()"
              class="w-full bg-tone-0e131c border border-tone-1f293d focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-200 text-sm rounded-xl px-3 py-2 mb-2 resize-none"
            ></textarea>
            <label class="flex items-center gap-2 text-[11px] text-slate-400 mb-3 cursor-pointer">
              <input
                type="checkbox"
                [(ngModel)]="includePage"
                name="includePage"
                class="h-3.5 w-3.5 accent-blue-600"
              />
              Include the page I'm on ({{ page() }})
            </label>
            @if (error()) {
              <p role="alert" class="text-xs text-rose-300 mb-2">{{ error() }}</p>
            }
            <button
              type="submit"
              [disabled]="sending() || !message.trim()"
              class="w-full bg-gradient-to-r from-blue-600 to-emerald-500 text-on-solid font-semibold text-sm py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ sending() ? 'Sending…' : 'Send' }}
            </button>
          </form>
        }
      </div>
    }
    <button
      type="button"
      (click)="open() ? close() : show()"
      [attr.aria-expanded]="open()"
      class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors"
      [class]="
        open()
          ? 'bg-blue-500/10 text-blue-100 border-blue-500/30'
          : 'border-dashed border-tone-26354f text-slate-400 hover:text-slate-100 hover:border-slate-500'
      "
    >
      <span aria-hidden="true">💬</span> Send feedback
    </button>
  `,
})
export class FeedbackButton {
  private http = inject(HttpClient);
  private router = inject(Router);
  private messageBox = viewChild<ElementRef<HTMLTextAreaElement>>('messageBox');

  readonly kinds: { value: Kind; label: string }[] = [
    { value: 'bug', label: '🐞 Bug' },
    { value: 'idea', label: '💡 Idea' },
    { value: 'other', label: '💬 Other' },
  ];
  open = signal(false);
  kind = signal<Kind>('bug');
  message = '';
  includePage = true;
  sending = signal(false);
  sent = signal(false);
  error = signal('');
  page = signal('');

  placeholder() {
    return this.kind() === 'bug'
      ? 'What happened? What did you expect?'
      : this.kind() === 'idea'
        ? 'What would make your journal better?'
        : 'Anything on your mind';
  }

  show() {
    this.page.set(this.router.url.split('?')[0]);
    this.sent.set(false);
    this.error.set('');
    this.open.set(true);
    setTimeout(() => this.messageBox()?.nativeElement.focus());
  }

  close() {
    this.open.set(false);
  }

  send() {
    if (this.sending() || !this.message.trim()) return;
    this.sending.set(true);
    this.error.set('');
    this.http
      .post(`${environment.apiUrl}/feedback`, {
        kind: this.kind(),
        message: this.message,
        page: this.includePage ? this.page() : undefined,
      })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.sent.set(true);
          this.message = '';
        },
        error: (err) => {
          this.sending.set(false);
          this.error.set(err.error?.error || 'Something went wrong sending your feedback.');
        },
      });
  }
}
