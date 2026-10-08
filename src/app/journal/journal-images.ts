import { Component, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { imageFileError, JournalImage, MAX_IMAGES_PER_SECTION } from './journal-logic';

interface Upload {
  id: number;
  name: string;
  progress: number; // 0-100
}

let nextUploadId = 1;

// Thumbnails, uploader and full-size viewer for one section of a journal day.
// Uploads go: ask the API for a signed link -> PUT to S3 -> confirm with the API.
@Component({
  selector: 'app-journal-images',
  templateUrl: './journal-images.html',
})
export class JournalImages {
  private http = inject(HttpClient);

  date = input.required<string>();
  mode = input.required<string>();
  section = input.required<'pre' | 'post'>();
  images = input<JournalImage[]>([]);

  added = output<JournalImage>();
  removed = output<number>();
  captioned = output<{ id: number; caption: string | null }>();

  uploads = signal<Upload[]>([]);
  error = signal('');
  dragging = signal(false);
  viewing = signal<number | null>(null); // index into images()
  editingCaptionId = signal<number | null>(null);

  readonly maxImages = MAX_IMAGES_PER_SECTION;
  readonly canAdd = computed(
    () => this.images().length + this.uploads().length < MAX_IMAGES_PER_SECTION,
  );
  readonly viewed = computed(() => {
    const i = this.viewing();
    return i === null ? null : (this.images()[i] ?? null);
  });

  private authHeaders() {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  }

  private api(path: string) {
    return `${environment.apiUrl}/journal/${this.date()}${path}`;
  }

  onPick(event: Event) {
    const input = event.target as HTMLInputElement;
    this.addFiles([...(input.files ?? [])]);
    input.value = '';
  }

  onPaste(event: ClipboardEvent) {
    const files = [...(event.clipboardData?.files ?? [])];
    if (files.length === 0) return;
    event.preventDefault();
    this.addFiles(files);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(false);
    this.addFiles([...(event.dataTransfer?.files ?? [])]);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(true);
  }

  addFiles(files: File[]) {
    this.error.set('');
    for (const file of files) {
      const problem = imageFileError(file);
      if (problem) {
        this.error.set(`${file.name}: ${problem}`);
        continue;
      }
      if (!this.canAdd()) {
        this.error.set(`Up to ${MAX_IMAGES_PER_SECTION} images here.`);
        return;
      }
      this.upload(file);
    }
  }

  private upload(file: File) {
    const upload: Upload = { id: nextUploadId++, name: file.name, progress: 0 };
    this.uploads.update((list) => [...list, upload]);
    const setProgress = (progress: number) =>
      this.uploads.update((list) => list.map((u) => (u.id === upload.id ? { ...u, progress } : u)));
    const done = (problem?: string) => {
      this.uploads.update((list) => list.filter((u) => u.id !== upload.id));
      if (problem) this.error.set(problem);
    };
    const failed = (err: any) => done(err?.error?.error || `${file.name} couldn't be uploaded.`);
    const params = { mode: this.mode() };

    this.http
      .post<{ key: string; uploadUrl: string }>(
        this.api('/images/upload-url'),
        { section: this.section(), content_type: file.type, size_bytes: file.size },
        { ...this.authHeaders(), params },
      )
      .subscribe({
        next: ({ key, uploadUrl }) => {
          // Straight to S3: no Authorization header, the URL itself is signed
          this.http
            .put(uploadUrl, file, {
              headers: { 'Content-Type': file.type },
              reportProgress: true,
              observe: 'events',
            })
            .subscribe({
              next: (event) => {
                if (event.type === HttpEventType.UploadProgress && event.total) {
                  setProgress(Math.round((event.loaded / event.total) * 100));
                }
                if (event.type === HttpEventType.Response) {
                  this.http
                    .post<JournalImage>(
                      this.api('/images'),
                      { key, section: this.section() },
                      { ...this.authHeaders(), params },
                    )
                    .subscribe({
                      next: (image) => {
                        done();
                        this.added.emit(image);
                      },
                      error: failed,
                    });
                }
              },
              error: failed,
            });
        },
        error: failed,
      });
  }

  saveCaption(image: JournalImage, value: string) {
    this.editingCaptionId.set(null);
    const caption = value.trim() || null;
    if (caption === image.caption) return;
    this.http
      .patch(`${environment.apiUrl}/journal/images/${image.id}`, { caption }, this.authHeaders())
      .subscribe({
        next: () => this.captioned.emit({ id: image.id, caption }),
        error: () => this.error.set("The caption couldn't be saved."),
      });
  }

  remove(image: JournalImage) {
    if (!confirm('Delete this image?')) return;
    this.http
      .delete(`${environment.apiUrl}/journal/images/${image.id}`, this.authHeaders())
      .subscribe({
        next: () => {
          if (this.viewing() !== null) this.viewing.set(null);
          this.removed.emit(image.id);
        },
        error: () => this.error.set("The image couldn't be deleted."),
      });
  }

  open(index: number) {
    this.viewing.set(index);
  }

  close() {
    this.viewing.set(null);
  }

  step(delta: number) {
    const i = this.viewing();
    const count = this.images().length;
    if (i === null || count === 0) return;
    this.viewing.set((i + delta + count) % count);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent) {
    if (this.viewing() === null) return;
    if (event.key === 'Escape') this.close();
    else if (event.key === 'ArrowRight') this.step(1);
    else if (event.key === 'ArrowLeft') this.step(-1);
  }
}
