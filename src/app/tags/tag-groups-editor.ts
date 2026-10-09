import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { TradeModeService } from '../trade-mode';
import { Tag, TagGroup } from './tags';

// Playbook section: tag groups (Setup, News, Market...) and their tags
@Component({
  selector: 'app-tag-groups-editor',
  imports: [FormsModule, DecimalPipe],
  host: { class: 'block' },
  template: `
    <section class="bg-[#121722] border border-[#1F293D] rounded-2xl shadow-xl overflow-hidden">
      <div class="px-6 py-5 border-b border-[#1F293D]/60">
        <h2 class="text-sm font-semibold text-white tracking-tight">Tags</h2>
        <p class="text-xs text-slate-400 mt-0.5">
          Groups of tags you put on trades, like Setup, News or Market. Reports breaks your results
          down by each group.
        </p>
      </div>

      @if (error()) {
        <p class="px-6 pt-4 text-xs text-rose-400" role="alert">{{ error() }}</p>
      }

      <div class="divide-y divide-[#1F293D]/40">
        @for (group of groups(); track group.id) {
          <div class="px-6 py-4 space-y-3">
            <div class="flex items-center justify-between gap-3">
              @if (editingGroupId() === group.id) {
                <form (ngSubmit)="renameGroup(group)" class="flex gap-2 flex-1">
                  <input
                    type="text"
                    [(ngModel)]="editGroupName"
                    name="editGroupName"
                    maxlength="40"
                    aria-label="Group name"
                    class="flex-1 bg-[#0E131C] border border-blue-500 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none"
                  />
                  <button type="submit" class="text-xs text-blue-300 hover:text-blue-200">
                    Save
                  </button>
                  <button
                    type="button"
                    (click)="editingGroupId.set(null)"
                    class="text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </form>
              } @else {
                <h3 class="text-sm font-semibold text-slate-100">{{ group.name }}</h3>
                <div class="flex gap-3 text-xs">
                  <button
                    type="button"
                    (click)="startRename(group)"
                    class="text-slate-400 hover:text-white"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    (click)="deleteGroup(group)"
                    class="text-rose-400/80 hover:text-rose-300"
                  >
                    Delete
                  </button>
                </div>
              }
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              @for (tag of group.tags; track tag.id) {
                <span
                  class="inline-flex items-center gap-1.5 text-xs pl-3 pr-1.5 py-1 rounded-full border border-slate-400/35 bg-[#0E131C] text-slate-200"
                >
                  {{ tag.name }}
                  @let st = statsByTag().get(tag.id);
                  <span class="font-mono text-[10px] text-slate-500">{{
                    trades() ? (st?.count ?? 0) : (tag.count ?? 0)
                  }}</span>
                  @if (trades() && st) {
                    <span
                      class="font-mono text-[10px]"
                      [class.text-emerald-400]="st.net > 0"
                      [class.text-rose-400]="st.net < 0"
                      >{{ st.net > 0 ? '+' : st.net < 0 ? '-' : '' }}\${{
                        (st.net < 0 ? -st.net : st.net) | number: '1.2-2'
                      }}</span
                    >
                  }
                  <button
                    type="button"
                    (click)="deleteTag(group, tag)"
                    [attr.aria-label]="'Delete ' + tag.name"
                    class="w-4 h-4 rounded-full text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 leading-none"
                  >
                    ×
                  </button>
                </span>
              }
              <form (ngSubmit)="addTag(group)" class="inline-flex">
                <input
                  type="text"
                  [ngModel]="newTagNames()[group.id] ?? ''"
                  (ngModelChange)="setNewTagName(group.id, $event)"
                  [name]="'newTag' + group.id"
                  maxlength="40"
                  [attr.aria-label]="'New ' + group.name + ' tag'"
                  placeholder="+ Add tag"
                  class="w-28 bg-transparent border border-dashed border-[#2b3a55] rounded-full px-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:w-40 transition-all"
                />
              </form>
            </div>
          </div>
        } @empty {
          <p class="px-6 py-4 text-sm text-slate-500">No tag groups yet. Add one below.</p>
        }
      </div>

      <form
        (ngSubmit)="addGroup()"
        class="px-6 py-4 border-t border-[#1F293D]/60 flex gap-2 bg-[#0E131C]/40"
      >
        <input
          type="text"
          [(ngModel)]="newGroupName"
          name="newGroupName"
          maxlength="40"
          placeholder="New group, e.g. Confluence"
          class="flex-1 bg-[#0E131C] border border-[#1F293D] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
        />
        <button
          type="submit"
          class="px-3 py-2 rounded-lg text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all"
        >
          + Add group
        </button>
      </form>
    </section>
  `,
})
export class TagGroupsEditor {
  private http = inject(HttpClient);
  private tradeMode = inject(TradeModeService);

  // Trades to total up per tag (the Playbook passes the ones in its date range)
  trades = input<{ tagIds?: number[]; netPnl: number }[] | null>(null);
  readonly statsByTag = computed(() => {
    const map = new Map<number, { count: number; net: number }>();
    for (const t of this.trades() ?? []) {
      for (const id of t.tagIds ?? []) {
        const s = map.get(id) ?? { count: 0, net: 0 };
        s.count += 1;
        s.net += t.netPnl;
        map.set(id, s);
      }
    }
    return map;
  });

  groups = signal<TagGroup[]>([]);
  error = signal('');
  editingGroupId = signal<number | null>(null);
  newTagNames = signal<Record<number, string>>({});
  newGroupName = '';
  editGroupName = '';

  constructor() {
    // Tag counts follow the live/backtest switch
    effect(() => this.load(this.tradeMode.mode()));
  }

  private headers() {
    return { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
  }

  private fail(fallback: string) {
    return (err: any) => this.error.set(err.error?.error || fallback);
  }

  private load(mode: string) {
    this.http
      .get<{ groups: TagGroup[] }>(`${environment.apiUrl}/tag-groups`, {
        ...this.headers(),
        params: { mode },
      })
      .subscribe((response) => {
        if (this.tradeMode.mode() === mode) this.groups.set(response.groups);
      });
  }

  private updateGroup(id: number, change: (g: TagGroup) => TagGroup) {
    this.groups.update((list) => list.map((g) => (g.id === id ? change(g) : g)));
  }

  setNewTagName(groupId: number, value: string) {
    this.newTagNames.update((names) => ({ ...names, [groupId]: value }));
  }

  addGroup() {
    this.error.set('');
    if (!this.newGroupName.trim()) return;
    this.http
      .post<TagGroup>(
        `${environment.apiUrl}/tag-groups`,
        { name: this.newGroupName },
        this.headers(),
      )
      .subscribe({
        next: (group) => {
          this.groups.update((list) => [...list, group]);
          this.newGroupName = '';
        },
        error: this.fail('Something went wrong adding the group.'),
      });
  }

  startRename(group: TagGroup) {
    this.editingGroupId.set(group.id);
    this.editGroupName = group.name;
  }

  renameGroup(group: TagGroup) {
    this.error.set('');
    if (!this.editGroupName.trim()) return;
    this.http
      .put<TagGroup>(
        `${environment.apiUrl}/tag-groups/${group.id}`,
        { name: this.editGroupName },
        this.headers(),
      )
      .subscribe({
        next: (saved) => {
          this.updateGroup(group.id, (g) => ({ ...g, name: saved.name }));
          this.editingGroupId.set(null);
        },
        error: this.fail('Something went wrong renaming the group.'),
      });
  }

  deleteGroup(group: TagGroup) {
    const used = group.tags.reduce((n, t) => n + (t.count ?? 0), 0);
    const note = used ? ` Its tags will be removed from your trades.` : '';
    if (!confirm(`Delete the "${group.name}" group and its ${group.tags.length} tags?${note}`))
      return;
    this.http.delete(`${environment.apiUrl}/tag-groups/${group.id}`, this.headers()).subscribe({
      next: () => this.groups.update((list) => list.filter((g) => g.id !== group.id)),
      error: this.fail('Something went wrong deleting the group.'),
    });
  }

  addTag(group: TagGroup) {
    this.error.set('');
    const name = (this.newTagNames()[group.id] ?? '').trim();
    if (!name) return;
    this.http
      .post<Tag>(`${environment.apiUrl}/tag-groups/${group.id}/tags`, { name }, this.headers())
      .subscribe({
        next: (tag) => {
          this.updateGroup(group.id, (g) => ({ ...g, tags: [...g.tags, tag] }));
          this.setNewTagName(group.id, '');
        },
        error: this.fail('Something went wrong adding the tag.'),
      });
  }

  deleteTag(group: TagGroup, tag: Tag) {
    const used = tag.count
      ? ` It will be removed from ${tag.count} ${tag.count === 1 ? 'trade' : 'trades'}.`
      : '';
    if (!confirm(`Delete the tag "${tag.name}"?${used}`)) return;
    this.http.delete(`${environment.apiUrl}/tags/${tag.id}`, this.headers()).subscribe({
      next: () =>
        this.updateGroup(group.id, (g) => ({ ...g, tags: g.tags.filter((t) => t.id !== tag.id) })),
      error: this.fail('Something went wrong deleting the tag.'),
    });
  }
}
