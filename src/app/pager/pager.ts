import { Component, computed, input, output } from '@angular/core';

// The page numbers to show: all of them when there are few, otherwise
// 1 … 4 5 6 … 12 around the current page (0 stands for "…")
export function pageList(page: number, pages: number): number[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const start = Math.max(2, Math.min(page - 1, pages - 4));
  const end = Math.min(pages - 1, Math.max(page + 1, 5));
  const list = [1];
  if (start > 2) list.push(0);
  for (let p = start; p <= end; p++) list.push(p);
  if (end < pages - 1) list.push(0);
  list.push(pages);
  return list;
}

// "Showing 1–8 of 23" is up to the page; this is ‹ Prev 1 2 3 Next ›
@Component({
  selector: 'app-pager',
  template: `
    <nav aria-label="Pages" class="flex items-center gap-1 text-xs">
      <button
        type="button"
        [disabled]="page() <= 1"
        (click)="go(page() - 1)"
        class="px-2.5 py-1.5 rounded-lg border border-[#1F293D] text-slate-400 hover:text-white hover:bg-[#121722] disabled:opacity-40 disabled:pointer-events-none"
      >
        ‹ Prev
      </button>
      @for (p of numbers(); track $index) {
        @if (p === 0) {
          <span class="px-1.5 text-slate-500">…</span>
        } @else {
          <button
            type="button"
            (click)="go(p)"
            [attr.aria-current]="p === page() ? 'page' : null"
            class="min-w-8 px-2 py-1.5 rounded-lg border font-mono"
            [class]="
              p === page()
                ? 'bg-blue-500/15 border-blue-500/50 text-white font-semibold'
                : 'border-[#1F293D] text-slate-400 hover:text-white hover:bg-[#121722]'
            "
          >
            {{ p }}
          </button>
        }
      }
      <button
        type="button"
        [disabled]="page() >= pages()"
        (click)="go(page() + 1)"
        class="px-2.5 py-1.5 rounded-lg border border-[#1F293D] text-slate-400 hover:text-white hover:bg-[#121722] disabled:opacity-40 disabled:pointer-events-none"
      >
        Next ›
      </button>
    </nav>
  `,
})
export class Pager {
  readonly page = input.required<number>();
  readonly pages = input.required<number>();
  readonly pageChange = output<number>();
  readonly numbers = computed(() => pageList(this.page(), this.pages()));

  go(p: number) {
    if (p >= 1 && p <= this.pages() && p !== this.page()) this.pageChange.emit(p);
  }
}
