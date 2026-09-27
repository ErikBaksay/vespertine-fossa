import { Injectable, signal, type OnDestroy } from '@angular/core';
import { liveQuery, type Subscription } from 'dexie';
import { db, initializeDatabase } from './database';
import type { Attachment, LibraryItem, LibraryKind, Prompt } from './models';

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

@Injectable({ providedIn: 'root' })
export class StoreService implements OnDestroy {
  readonly prompts = signal<Prompt[]>([]);
  readonly quickPrompts = signal<LibraryItem[]>([]);
  readonly snippets = signal<LibraryItem[]>([]);
  readonly commands = signal<LibraryItem[]>([]);
  readonly attachments = signal<Attachment[]>([]);
  readonly ready = signal(false);
  readonly error = signal<string | null>(null);

  private initialization?: Promise<void>;
  private subscription?: Subscription;

  constructor() {
    void this.initialize().catch(() => undefined);
  }

  initialize(): Promise<void> {
    if (this.initialization) return this.initialization;

    this.error.set(null);
    const initialization = initializeDatabase()
      .then(() => new Promise<void>((resolve, reject) => {
        let awaitingFirstRows = true;
        this.subscription = liveQuery(async () => {
          const [prompts, quickPrompts, snippets, commands, attachments] = await Promise.all([
            db.prompts.orderBy('position').toArray(),
            db.quickPrompts.orderBy('position').toArray(),
            db.snippets.orderBy('position').toArray(),
            db.commands.orderBy('position').toArray(),
            db.attachments.orderBy('createdAt').toArray(),
          ]);
          return { prompts, quickPrompts, snippets, commands, attachments };
        }).subscribe({
          next: ({ prompts, quickPrompts, snippets, commands, attachments }) => {
            this.prompts.set(prompts);
            this.quickPrompts.set(quickPrompts);
            this.snippets.set(snippets);
            this.commands.set(commands);
            this.attachments.set(attachments);
            if (awaitingFirstRows) {
              awaitingFirstRows = false;
              this.ready.set(true);
              resolve();
            }
          },
          error: (cause: unknown) => {
            this.error.set(this.messageFor(cause));
            this.ready.set(false);
            this.subscription = undefined;
            this.initialization = undefined;
            if (awaitingFirstRows) {
              awaitingFirstRows = false;
              reject(cause);
            }
          },
        });
      }))
      .catch((cause: unknown) => {
        this.error.set(this.messageFor(cause));
        this.ready.set(false);
        this.subscription?.unsubscribe();
        this.subscription = undefined;
        if (this.initialization === initialization) this.initialization = undefined;
        throw cause;
      });
    this.initialization = initialization;
    return initialization;
  }

  async savePrompt(prompt: Prompt, files: File[], removedAttachmentIds: string[]): Promise<void> {
    await db.transaction('rw', [db.prompts, db.attachments], async () => {
      await db.prompts.put({ ...prompt, tags: [...prompt.tags] });

      if (removedAttachmentIds.length) {
        const owned = await db.attachments.where('id').anyOf([...new Set(removedAttachmentIds)]).toArray();
        await db.attachments.bulkDelete(owned.filter((item) => item.promptId === prompt.id).map((item) => item.id));
      }

      if (files.length) {
        const now = Date.now();
        await db.attachments.bulkAdd(
          files.map((file, index): Attachment => ({
            id: newId(),
            promptId: prompt.id,
            filename: file.name || `attachment-${index + 1}`,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            data: file,
            createdAt: now + index,
          })),
        );
      }
    });
  }

  async saveLibrary(kind: LibraryKind, item: LibraryItem): Promise<void> {
    await db[kind].put({ ...item, tags: [...item.tags] });
  }

  async deleteLibrary(kind: LibraryKind, id: string): Promise<void> {
    await db[kind].delete(id);
  }

  async archivePrompt(id: string): Promise<void> {
    await db.transaction('rw', db.prompts, async () => {
      const prompt = await db.prompts.get(id);
      if (prompt) await db.prompts.put({ ...prompt, archivedAt: Date.now(), updatedAt: Date.now() });
    });
  }

  async restorePrompt(id: string): Promise<void> {
    await db.transaction('rw', db.prompts, async () => {
      const prompt = await db.prompts.get(id);
      if (!prompt) return;
      const active = await db.prompts.filter((item) => item.archivedAt === null).toArray();
      const maxPosition = Math.max(-1, ...active.map((item) => item.position));
      await db.prompts.put({ ...prompt, archivedAt: null, position: maxPosition + 1, updatedAt: Date.now() });
    });
  }

  async deletePrompt(id: string): Promise<void> {
    await db.transaction('rw', [db.prompts, db.attachments], async () => {
      await db.attachments.where('promptId').equals(id).delete();
      await db.prompts.delete(id);
    });
  }

  async deleteAttachment(id: string): Promise<void> {
    await db.attachments.delete(id);
  }

  async reorderPrompts(ids: string[]): Promise<void> {
    if (new Set(ids).size !== ids.length) throw new Error('Prompt order contains duplicate IDs.');
    await db.transaction('rw', db.prompts, async () => {
      const active = await db.prompts.filter((prompt) => prompt.archivedAt === null).toArray();
      const activeIds = new Set(active.map((prompt) => prompt.id));
      if (ids.length !== active.length || ids.some((id) => !activeIds.has(id))) {
        throw new Error('Prompt order must contain every active prompt exactly once.');
      }
      const now = Date.now();
      await db.prompts.bulkPut(ids.map((id, position) => ({ ...active.find((prompt) => prompt.id === id)!, position, updatedAt: now })));
    });
  }

  private messageFor(cause: unknown): string {
    return cause instanceof Error ? cause.message : 'Unable to access local storage.';
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
