import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, initializeDatabase, SEED_MARKER_KEY } from './database';
import { StoreService } from './store.service';

describe('local database', () => {
  beforeEach(async () => {
    db.close();
    await db.delete();
    await db.open();
  });

  it('seeds exactly once and does not resurrect deleted sample data', async () => {
    await initializeDatabase();
    expect(await db.prompts.count()).toBe(4);
    expect(await db.quickPrompts.count()).toBe(8);
    expect(await db.snippets.count()).toBe(3);
    expect(await db.attachments.count()).toBe(5);
    expect((await db.meta.get(SEED_MARKER_KEY))?.value).toBe(true);

    await db.prompts.delete('sample-prompt-tests');
    await initializeDatabase();
    expect(await db.prompts.get('sample-prompt-tests')).toBeUndefined();
    expect(await db.prompts.count()).toBe(3);
  });

  it('reorders all active prompts atomically without changing archived positions', async () => {
    await initializeDatabase();
    await db.prompts.update('sample-prompt-docs', { archivedAt: Date.now() });
    const service = new StoreService();
    await service.initialize();

    await service.reorderPrompts(['sample-prompt-tests', 'sample-prompt-review', 'sample-prompt-implement']);
    const active = await db.prompts.filter((prompt) => prompt.archivedAt === null).sortBy('position');
    expect(active.map(({ id, position }) => [id, position])).toEqual([
      ['sample-prompt-tests', 0],
      ['sample-prompt-review', 1],
      ['sample-prompt-implement', 2],
    ]);
    expect((await db.prompts.get('sample-prompt-docs'))?.position).toBe(3);

    await expect(service.reorderPrompts(['sample-prompt-tests'])).rejects.toThrow(/every active prompt/);
    expect((await db.prompts.get('sample-prompt-review'))?.position).toBe(1);
    service.ngOnDestroy();
  });

  it('preserves existing attachment blobs when a prompt is edited', async () => {
    await initializeDatabase();
    const service = new StoreService();
    await service.initialize();
    const prompt = (await db.prompts.get('sample-prompt-review'))!;
    const original = (await db.attachments.where('promptId').equals(prompt.id).first())!;

    await service.savePrompt({ ...prompt, body: 'Edited body', updatedAt: Date.now() }, [], []);

    const stored = (await db.attachments.get(original.id))!;
    expect(stored.filename).toBe('review-notes.txt');
    expect(await stored.data.text()).toContain('correctness');
    service.ngOnDestroy();
  });

  it('retains attachments through archive and restore, then cascades permanent deletion', async () => {
    await initializeDatabase();
    const service = new StoreService();
    await service.initialize();
    const promptId = 'sample-prompt-review';
    const attachment = (await db.attachments.where('promptId').equals(promptId).first())!;

    await service.archivePrompt(promptId);
    expect(await db.attachments.get(attachment.id)).toBeDefined();
    await service.restorePrompt(promptId);
    expect(await (await db.attachments.get(attachment.id))?.data.text()).toContain('correctness');

    await service.deletePrompt(promptId);
    expect(await db.prompts.get(promptId)).toBeUndefined();
    expect(await db.attachments.where('promptId').equals(promptId).count()).toBe(0);
    service.ngOnDestroy();
  });

  it('allows initialization to be retried after a failure', async () => {
    const transaction = vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('storage unavailable'));
    const service = new StoreService();

    await expect(service.initialize()).rejects.toThrow('storage unavailable');
    expect(service.ready()).toBe(false);
    transaction.mockRestore();

    await service.initialize();
    expect(service.ready()).toBe(true);
    expect(service.error()).toBeNull();
    service.ngOnDestroy();
  });
});
