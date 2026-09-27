import 'fake-indexeddb/auto';
import { strToU8, zipSync } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import { exportBackup, importBackup, readBackup, type BackupData } from './backup';
import { db, initializeDatabase, SEED_MARKER_KEY } from './database';
import type { Attachment, Prompt } from './models';

const prompt: Prompt = {
  id: 'prompt-one',
  title: 'A prompt',
  body: 'Line one\nLine two',
  position: 0,
  createdAt: 100,
  updatedAt: 200,
  tags: ['test'],
  archivedAt: null,
};

function backupData(): BackupData {
  const data = new Blob(['original bytes'], { type: 'text/plain' });
  const attachment: Attachment = {
    id: 'attachment-one',
    promptId: prompt.id,
    filename: 'notes.txt',
    mimeType: 'text/plain',
    size: data.size,
    data,
    createdAt: 300,
  };
  return { prompts: [prompt], quickPrompts: [], snippets: [], attachments: [attachment], settings: { density: 'compact', theme: 'oled', showQuickPrompts: false } };
}

describe('ZIP backup', () => {
  beforeEach(async () => {
    db.close();
    await db.delete();
    await db.open();
    await db.meta.put({ key: SEED_MARKER_KEY, value: true });
  });

  it('round-trips original blob bytes and settings', async () => {
    const source = backupData();
    await db.prompts.add(source.prompts[0]);
    await db.attachments.add(source.attachments[0]);

    const archive = await exportBackup(source.settings!);
    const restored = await readBackup(archive);

    expect(restored.settings).toEqual({ density: 'compact', theme: 'oled', showQuickPrompts: false });
    expect(restored.prompts).toEqual([prompt]);
    expect(restored.attachments[0].data.type).toBe('text/plain');
    expect(await restored.attachments[0].data.text()).toBe('original bytes');
  });

  it('merges by appending remapped copies and keeping existing records', async () => {
    await initializeDatabase();
    await db.prompts.add({ ...prompt, id: 'existing', title: 'Existing', position: 9 });

    const settings = await importBackup(backupData(), 'merge');

    const records = await db.prompts.orderBy('position').toArray();
    expect(records).toHaveLength(2);
    expect(records[0].id).toBe('existing');
    expect(records[1].id).not.toBe(prompt.id);
    expect(records[1].position).toBe(10);
    const attachment = await db.attachments.toCollection().first();
    expect(attachment?.promptId).toBe(records[1].id);
    expect(await attachment?.data.text()).toBe('original bytes');
    expect(settings).toBeUndefined();
  });

  it('replace is transactional and retains the once-only seed marker', async () => {
    await db.prompts.add({ ...prompt, id: 'old' });
    const settings = await importBackup(backupData(), 'replace');

    expect((await db.prompts.toArray()).map(({ id }) => id)).toEqual(['prompt-one']);
    expect((await db.meta.get(SEED_MARKER_KEY))?.value).toBe(true);
    expect(settings).toEqual({ density: 'compact', theme: 'oled', showQuickPrompts: false });
    expect(await (await db.attachments.get('attachment-one'))?.data.text()).toBe('original bytes');
  });

  it('rejects traversal paths before extracting the archive', async () => {
    const zipped = zipSync({
        'metadata.json': strToU8('{}'),
        '../outside.txt': strToU8('unsafe'),
      });
    const archive = new Blob([new Uint8Array(zipped).buffer]);
    await expect(readBackup(archive)).rejects.toThrow(/unsafe path/);
  });

  it('rejects invalid references and mismatched blob sizes before writing', async () => {
    const source = backupData();
    source.attachments[0] = { ...source.attachments[0], promptId: 'missing', size: 99 };
    await expect(importBackup(source, 'replace')).rejects.toThrow(/missing prompt/);
    expect(await db.prompts.count()).toBe(0);
  });
});
