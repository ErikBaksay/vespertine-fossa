import Dexie, { type EntityTable } from 'dexie';
import type { Attachment, LibraryItem, MetaRecord, Prompt } from './models';
import { createSeedData } from './seed';

export const SEED_MARKER_KEY = 'initial-data-seeded-v1';

export class PromptQueueDatabase extends Dexie {
  prompts!: EntityTable<Prompt, 'id'>;
  quickPrompts!: EntityTable<LibraryItem, 'id'>;
  snippets!: EntityTable<LibraryItem, 'id'>;
  commands!: EntityTable<LibraryItem, 'id'>;
  attachments!: EntityTable<Attachment, 'id'>;
  meta!: EntityTable<MetaRecord, 'key'>;

  constructor(name = 'prompt-queue') {
    super(name);
    this.version(1).stores({
      prompts: '&id, position, archivedAt, updatedAt, *tags',
      quickPrompts: '&id, position, updatedAt, *tags',
      snippets: '&id, position, updatedAt, *tags',
      attachments: '&id, promptId, createdAt',
      meta: '&key',
    });
    this.version(2).stores({
      prompts: '&id, position, archivedAt, updatedAt, *tags',
      quickPrompts: '&id, position, updatedAt, *tags',
      snippets: '&id, position, updatedAt, *tags',
      commands: '&id, position, updatedAt, *tags',
      attachments: '&id, promptId, createdAt',
      meta: '&key',
    });
  }
}

export const db = new PromptQueueDatabase();

export async function initializeDatabase(database: PromptQueueDatabase = db): Promise<void> {
  await database.transaction(
    'rw',
    [database.prompts, database.quickPrompts, database.snippets, database.commands, database.attachments, database.meta],
    async () => {
      if (await database.meta.get(SEED_MARKER_KEY)) return;

      const seed = createSeedData();
      await database.prompts.bulkAdd(seed.prompts);
      await database.quickPrompts.bulkAdd(seed.quickPrompts);
      await database.snippets.bulkAdd(seed.snippets);
      await database.attachments.bulkAdd(seed.attachments);
      await database.meta.add({ key: SEED_MARKER_KEY, value: true });
    },
  );
}
