import {
  Component,
  HostListener,
  OnDestroy,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES = 6;

export interface GalleryImage {
  id: number;
  caption: string | null;
  url: string;
}

// Where a gallery's images live on the API.
//   POST {base}/upload-url -> { key, uploadUrl }, POST {base} to confirm,
//   PATCH / DELETE {item}/:id for one image.
// body is sent with both POSTs (e.g. the journal section), params on every call.
export interface ImageTarget {
  base: string;
  item: string;
  body?: Record<string, string>;
  params?: Record<string, string>;
}

export function imageFileError(file: { type: string; size: number }): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'Images must be PNG, JPG or WebP.';
  if (file.size > MAX_IMAGE_BYTES) return 'Images must be 5 MB or smaller.';
  return null;
}

interface Upload {
  id: number;
  name: string;
  progress: number; // 0-100
}

// A picked file waiting for its target (a trade that isn't saved yet)
interface Queued {
  id: number;
  file: File;
  url: string; // local object URL for the preview
  caption: string | null;
}

let nextLocalId = 1;

// Thumbnails, uploader and full-size viewer for a set of chart screenshots.
// Uploads go: ask the API for a signed link -> PUT to S3 -> confirm with the API.
// Without a target, picked files are queued locally until uploadQueued(target).
@Component({
  selector: 'app-image-gallery',
  host: { class: 'block' },
  templateUrl: './image-gallery.html',
})
export class ImageGallery implements OnDestroy {
  private http = inject(HttpClient);

  target = input<ImageTarget | null>(null);
  images = input<GalleryImage[]>([]);
  addLabel = input('Add chart');

  added = output<GalleryImage>();
  removed = output<number>();
  captioned = output<{ id: number; caption: string | null }>();

  uploads = signal<Upload[]>([]);
  queued = signal<Queued[]>([]);
  error = signal('');
  dragging = signal(false);
  viewing = signal<number | null>(null); // index into shown()
  editingCaptionId = signal<number | null>(null);

  // Saved images and queued previews, in the order they're shown
  readonly shown = computed<GalleryImage[]>(() => [
    ...this.images(),
    ...this.queued().map((q) => ({ id: -q.id, caption: q.caption, url: q.url })),
  ]);
  readonly canAdd = computed(() => this.shown().length + this.uploads().length < MAX_IMAGES);
  readonly viewed = computed(() => {
    const i = this.viewing();
    return i === null ? null : (this.shown()[i] ?? null);
  });

  private authHeaders() {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
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
        this.error.set(`Up to ${MAX_IMAGES} images here.`);
        return;
      }
      const target = this.target();
      if (target) {
        this.upload(file, target).then((image) => image && this.added.emit(image));
      } else {
        const url = URL.createObjectURL(file);
        this.queued.update((list) => [...list, { id: nextLocalId++, file, url, caption: null }]);
      }
    }
  }

  // Uploads everything queued to a target that now exists. Resolves with the
  // number of files that failed (their error is shown in the gallery).
  async uploadQueued(target: ImageTarget): Promise<number> {
    const queued = this.queued();
    const results = await Promise.all(
      queued.map(async (q) => {
        const image = await this.upload(q.file, target, q.caption);
        if (image) {
          this.dropQueued(q.id);
          this.added.emit(image);
        }
        return image;
      }),
    );
    return results.filter((image) => !image).length;
  }

  private upload(file: File, target: ImageTarget, caption: string | null = null) {
    return new Promise<GalleryImage | null>((resolve) => {
      const upload: Upload = { id: nextLocalId++, name: file.name, progress: 0 };
      this.uploads.update((list) => [...list, upload]);
      const setProgress = (progress: number) =>
        this.uploads.update((list) =>
          list.map((u) => (u.id === upload.id ? { ...u, progress } : u)),
        );
      const finish = (image: GalleryImage | null, problem?: string) => {
        this.uploads.update((list) => list.filter((u) => u.id !== upload.id));
        if (problem) this.error.set(problem);
        resolve(image);
      };
      const failed = (err: any) =>
        finish(null, err?.error?.error || `${file.name} couldn't be uploaded.`);
      const options = { headers: this.authHeaders(), params: target.params ?? {} };

      this.http
        .post<{ key: string; uploadUrl: string }>(
          `${target.base}/upload-url`,
          { ...target.body, content_type: file.type, size_bytes: file.size },
          options,
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
                    const body = caption
                      ? { ...target.body, key, caption }
                      : { ...target.body, key };
                    this.http
                      .post<GalleryImage>(target.base, body, options)
                      .subscribe({ next: (image) => finish(image), error: failed });
                  }
                },
                error: failed,
              });
          },
          error: failed,
        });
    });
  }

  private dropQueued(localId: number) {
    const item = this.queued().find((q) => q.id === localId);
    if (item) URL.revokeObjectURL(item.url);
    this.queued.update((list) => list.filter((q) => q.id !== localId));
  }

  saveCaption(image: GalleryImage, value: string) {
    this.editingCaptionId.set(null);
    const caption = value.trim() || null;
    if (caption === image.caption) return;
    if (image.id < 0) {
      this.queued.update((list) => list.map((q) => (q.id === -image.id ? { ...q, caption } : q)));
      return;
    }
    const target = this.target();
    if (!target) return;
    this.http
      .patch(
        `${target.item}/${image.id}`,
        { caption },
        { headers: this.authHeaders(), params: target.params ?? {} },
      )
      .subscribe({
        next: () => this.captioned.emit({ id: image.id, caption }),
        error: () => this.error.set("The caption couldn't be saved."),
      });
  }

  remove(image: GalleryImage) {
    if (image.id < 0) {
      if (this.viewing() !== null) this.viewing.set(null);
      this.dropQueued(-image.id);
      return;
    }
    if (!confirm('Delete this image?')) return;
    const target = this.target();
    if (!target) return;
    this.http
      .delete(`${target.item}/${image.id}`, {
        headers: this.authHeaders(),
        params: target.params ?? {},
      })
      .subscribe({
        next: () => {
          if (this.viewing() !== null) this.viewing.set(null);
          this.removed.emit(image.id);
        },
        error: () => this.error.set("The image couldn't be deleted."),
      });
  }

  // Forget queued files (e.g. "Save and add another" starting a fresh trade)
  clearQueued() {
    for (const q of this.queued()) URL.revokeObjectURL(q.url);
    this.queued.set([]);
    this.error.set('');
  }

  open(index: number) {
    this.viewing.set(index);
  }

  close() {
    this.viewing.set(null);
  }

  step(delta: number) {
    const i = this.viewing();
    const count = this.shown().length;
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

  ngOnDestroy() {
    for (const q of this.queued()) URL.revokeObjectURL(q.url);
  }
}
