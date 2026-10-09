import { Component, input, output } from '@angular/core';

export interface Tag {
  id: number;
  name: string;
  count?: number; // trades in the current mode using it (from GET /tag-groups)
}

export interface TagGroup {
  id: number;
  name: string;
  tags: Tag[];
}

// A trade's tags, grouped the way the user's tag groups are ordered.
// Groups with no tag on this trade are kept, so the page can show "—".
export function tagsByGroup(groups: TagGroup[], tagIds: number[] | undefined) {
  const ids = new Set(tagIds ?? []);
  return groups.map((g) => ({ name: g.name, tags: g.tags.filter((t) => ids.has(t.id)) }));
}

// Toggleable tag chips, one row per group, for the trade forms
@Component({
  selector: 'app-tag-picker',
  host: { class: 'block' },
  template: `
    <div class="flex items-baseline justify-between mb-2">
      <span class="text-xs font-medium text-slate-300">Tags</span>
      <span class="text-[10px] text-slate-500">groups and tags live in the Playbook</span>
    </div>
    @if (groups().length === 0) {
      <p class="text-xs text-slate-500">Add tag groups in the Playbook to tag trades here.</p>
    } @else {
      <div class="space-y-2">
        @for (group of groups(); track group.id) {
          <div class="grid grid-cols-[72px_minmax(0,1fr)] gap-2 items-start">
            <span class="text-[11px] text-slate-400 pt-1">{{ group.name }}</span>
            <div
              class="flex flex-wrap gap-1.5"
              role="group"
              [attr.aria-label]="group.name + ' tags'"
            >
              @for (tag of group.tags; track tag.id) {
                <button
                  type="button"
                  [attr.aria-pressed]="selected().has(tag.id)"
                  (click)="toggle.emit(tag.id)"
                  class="text-xs px-3 py-1 rounded-full border transition-colors"
                  [class]="
                    selected().has(tag.id)
                      ? 'border-slate-300/60 bg-slate-300/15 text-white'
                      : 'border-[#26354f] bg-[#121a2a] text-slate-300 hover:border-slate-500'
                  "
                >
                  {{ tag.name }}
                </button>
              } @empty {
                <span class="text-[11px] text-slate-500 pt-1">No tags yet</span>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class TagPicker {
  groups = input<TagGroup[]>([]);
  selected = input<Set<number>>(new Set());
  toggle = output<number>();
}
