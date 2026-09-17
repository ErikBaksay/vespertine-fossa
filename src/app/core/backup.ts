import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { db } from './database';
import type { AppSettings, Attachment, LibraryItem, Prompt } from './models';

const FORMAT = 'prompt-queue-backup';
const VERSION = 1;
const METADATA_PATH = 'metadata.json';
const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 1024 * 1024 * 1024;
const MAX_ENTRY_BYTES = 256 * 1024 * 1024;
const MAX_METADATA_BYTES = 10 * 1024 * 1024;
const MAX_ENTRIES = 5_000;
const MAX_TEXT = 2_000_000;
const MAX_DATE_MS = 8_640_000_000_000_000;

export interface BackupData {
  prompts: Prompt[];
  quickPrompts: LibraryItem[];
  snippets: LibraryItem[];
  attachments: Attachment[];
  settings?: AppSettings;
}

interface AttachmentMetadata extends Omit<Attachment, 'data'> {
  path: string;
}

interface BackupMetadata {
  format: typeof FORMAT;
  version: typeof VERSION;
  exportedAt: number;
  prompts: Prompt[];
  quickPrompts: LibraryItem[];
  snippets: LibraryItem[];
  attachments: AttachmentMetadata[];
  settings?: AppSettings;
}

type ArchiveEntry = { name: string; compressed: number; uncompressed: number };

function fail(message: string): never {
  throw new Error(`Invalid Prompt Queue backup: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, field: string, allowEmpty = true, max = MAX_TEXT): string {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && value.length === 0) || value.includes('\0')) {
    fail(`${field} is invalid.`);
  }
  return value;
}

function finiteNumber(value: unknown, field: string, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || (integer && !Number.isInteger(value))) fail(`${field} is invalid.`);
  return value;
}

function timestamp(value: unknown, field: string): number {
  const result = finiteNumber(value, field, true);
  if (result < 0 || result > MAX_DATE_MS) fail(`${field} is outside the supported date range.`);
  return result;
}

function tags(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length > 100) fail(`${field} is invalid.`);
  const result = value.map((tag, index) => text(tag, `${field}[${index}]`, false, 200));
  if (new Set(result).size !== result.length) fail(`${field} contains duplicates.`);
  return result;
}

function validatePrompt(value: unknown, index: number): Prompt {
  if (!isRecord(value)) fail(`prompts[${index}] is invalid.`);
  return {
    id: text(value['id'], `prompts[${index}].id`, false, 200),
    title: text(value['title'], `prompts[${index}].title`, false),
    body: text(value['body'], `prompts[${index}].body`),
    position: finiteNumber(value['position'], `prompts[${index}].position`, true),
    createdAt: timestamp(value['createdAt'], `prompts[${index}].createdAt`),
    updatedAt: timestamp(value['updatedAt'], `prompts[${index}].updatedAt`),
    tags: tags(value['tags'], `prompts[${index}].tags`),
    archivedAt: value['archivedAt'] === null ? null : timestamp(value['archivedAt'], `prompts[${index}].archivedAt`),
  };
}

function validateLibraryItem(value: unknown, collection: string, index: number): LibraryItem {
  if (!isRecord(value)) fail(`${collection}[${index}] is invalid.`);
  return {
    id: text(value['id'], `${collection}[${index}].id`, false, 200),
    title: text(value['title'], `${collection}[${index}].title`, false),
    body: text(value['body'], `${collection}[${index}].body`),
    position: finiteNumber(value['position'], `${collection}[${index}].position`, true),
    createdAt: timestamp(value['createdAt'], `${collection}[${index}].createdAt`),
    updatedAt: timestamp(value['updatedAt'], `${collection}[${index}].updatedAt`),
    tags: tags(value['tags'], `${collection}[${index}].tags`),
    icon: text(value['icon'], `${collection}[${index}].icon`, false, 200),
  };
}

function validateSettings(value: unknown): AppSettings | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) || (value['density'] !== 'comfortable' && value['density'] !== 'compact')) fail('settings are invalid.');
  return { density: value['density'] };
}

function filename(value: unknown, field: string): string {
  const result = text(value, field, false, 255);
  if (result === '.' || result === '..' || /[/\\]/.test(result)) fail(`${field} must be a plain filename.`);
  return result;
}

function mimeType(value: unknown, field: string): string {
  const result = text(value, field, false, 200);
  if (!/^[\w!#$&^_.+-]+\/[\w!#$&^_.+*-]+(?:\s*;[^\r\n]*)?$/.test(result)) fail(`${field} is invalid.`);
  return result;
}

function validateAttachmentMetadata(value: unknown, index: number): AttachmentMetadata {
  if (!isRecord(value)) fail(`attachments[${index}] is invalid.`);
  return {
    id: text(value['id'], `attachments[${index}].id`, false, 200),
    promptId: text(value['promptId'], `attachments[${index}].promptId`, false, 200),
    filename: filename(value['filename'], `attachments[${index}].filename`),
    mimeType: mimeType(value['mimeType'], `attachments[${index}].mimeType`),
    size: finiteNumber(value['size'], `attachments[${index}].size`, true),
    createdAt: timestamp(value['createdAt'], `attachments[${index}].createdAt`),
    path: text(value['path'], `attachments[${index}].path`, false, 500),
  };
}

function uniqueIds(records: { id: string }[], field: string): void {
  const ids = records.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) fail(`${field} contains duplicate IDs.`);
}

function safeArchivePath(path: string): boolean {
  if (!path || path.startsWith('/') || path.startsWith('\\') || /^[a-zA-Z]:/.test(path) || path.includes('\\') || path.includes('\0')) return false;
  return path.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}

function parseMetadata(value: unknown): { metadata: BackupMetadata; attachmentMetadata: AttachmentMetadata[] } {
  if (!isRecord(value) || value['format'] !== FORMAT || value['version'] !== VERSION) fail('format or version is unsupported.');
  if (!Array.isArray(value['prompts']) || !Array.isArray(value['quickPrompts']) || !Array.isArray(value['snippets']) || !Array.isArray(value['attachments'])) {
    fail('record collections are missing.');
  }

  const prompts = value['prompts'].map(validatePrompt);
  const quickPrompts = value['quickPrompts'].map((item, index) => validateLibraryItem(item, 'quickPrompts', index));
  const snippets = value['snippets'].map((item, index) => validateLibraryItem(item, 'snippets', index));
  const attachmentMetadata = value['attachments'].map(validateAttachmentMetadata);
  uniqueIds(prompts, 'prompts');
  uniqueIds(quickPrompts, 'quickPrompts');
  uniqueIds(snippets, 'snippets');
  uniqueIds(attachmentMetadata, 'attachments');
  uniqueIds([...prompts, ...quickPrompts, ...snippets, ...attachmentMetadata], 'all records');

  const promptIds = new Set(prompts.map(({ id }) => id));
  for (const attachment of attachmentMetadata) {
    if (!promptIds.has(attachment.promptId)) fail(`attachment ${attachment.id} references a missing prompt.`);
    if (!safeArchivePath(attachment.path) || attachment.path === METADATA_PATH) fail(`attachment ${attachment.id} has an unsafe path.`);
    if (attachment.size < 0 || attachment.size > MAX_ENTRY_BYTES) fail(`attachment ${attachment.id} has an invalid size.`);
  }
  if (new Set(attachmentMetadata.map(({ path }) => path)).size !== attachmentMetadata.length) fail('attachment paths are duplicated.');

  const metadata: BackupMetadata = {
    format: FORMAT,
    version: VERSION,
    exportedAt: timestamp(value['exportedAt'], 'exportedAt'),
    prompts,
    quickPrompts,
    snippets,
    attachments: attachmentMetadata,
    settings: validateSettings(value['settings']),
  };
  return { metadata, attachmentMetadata };
}

function inspectZip(bytes: Uint8Array): ArchiveEntry[] {
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) fail('archive is too large.');
  if (bytes.byteLength < 22) fail('archive is truncated.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const lowerBound = Math.max(0, bytes.byteLength - 65_557);
  for (let offset = bytes.byteLength - 22; offset >= lowerBound; offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) fail('ZIP directory is missing.');
  const count = view.getUint16(eocd + 10, true);
  const directorySize = view.getUint32(eocd + 12, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  if (count === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) fail('ZIP64 archives are unsupported.');
  if (count === 0 || count > MAX_ENTRIES || directoryOffset + directorySize > eocd) fail('ZIP directory is invalid.');

  const decoder = new TextDecoder('utf-8', { fatal: true });
  const entries: ArchiveEntry[] = [];
  let offset = directoryOffset;
  let totalUncompressed = 0;
  for (let index = 0; index < count; index++) {
    if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== 0x02014b50) fail('ZIP entry is invalid.');
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true);
    const uncompressed = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    if ((flags & 1) !== 0 || (method !== 0 && method !== 8)) fail('encrypted or unsupported ZIP entry.');
    if (uncompressed > MAX_ENTRY_BYTES) fail('ZIP entry is too large.');
    totalUncompressed += uncompressed;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) fail('expanded archive is too large.');
    if (uncompressed > 1024 * 1024 && uncompressed / Math.max(1, compressed) > 300) fail('suspicious ZIP compression ratio.');
    const nameStart = offset + 46;
    const next = nameStart + nameLength + extraLength + commentLength;
    if (next > bytes.byteLength) fail('ZIP entry is truncated.');
    let name: string;
    try {
      name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
    } catch {
      fail('ZIP entry name is not valid UTF-8.');
    }
    if (!safeArchivePath(name)) fail('ZIP contains an unsafe path.');
    entries.push({ name, compressed, uncompressed });
    offset = next;
  }
  if (offset !== directoryOffset + directorySize || new Set(entries.map(({ name }) => name)).size !== entries.length) fail('ZIP directory is inconsistent.');
  return entries;
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function cloneWithIds<T extends { id: string; position: number }>(records: T[], startPosition: number): { records: T[]; ids: Map<string, string> } {
  const ids = new Map<string, string>();
  const recordsWithIds = records
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((record, index) => {
      const id = newId();
      ids.set(record.id, id);
      return { ...record, id, position: startPosition + index };
    });
  return { records: recordsWithIds, ids };
}

export async function exportBackup(settings: AppSettings): Promise<Blob> {
  const [prompts, quickPrompts, snippets, attachments] = await db.transaction(
    'r',
    [db.prompts, db.quickPrompts, db.snippets, db.attachments],
    () => Promise.all([db.prompts.toArray(), db.quickPrompts.toArray(), db.snippets.toArray(), db.attachments.toArray()]),
  );

  const files: Record<string, Uint8Array> = {};
  const attachmentMetadata: AttachmentMetadata[] = [];
  for (const [index, attachment] of attachments.entries()) {
    if (!(attachment.data instanceof Blob) || attachment.data.size !== attachment.size || attachment.size > MAX_ENTRY_BYTES) {
      throw new Error(`Cannot export attachment ${attachment.id}: stored blob metadata is inconsistent.`);
    }
    const path = `attachments/${index}.bin`;
    const { data: _data, ...storedMetadata } = attachment;
    attachmentMetadata.push({ ...storedMetadata, path });
  }
  const metadata: BackupMetadata = {
    format: FORMAT,
    version: VERSION,
    exportedAt: Date.now(),
    prompts,
    quickPrompts,
    snippets,
    attachments: attachmentMetadata,
    settings,
  };
  const { metadata: validatedMetadata } = parseMetadata(metadata);
  if (attachments.length + 1 > MAX_ENTRIES) throw new Error('Cannot export backup: too many attachments.');
  const metadataBytes = strToU8(JSON.stringify(validatedMetadata));
  if (metadataBytes.byteLength > MAX_METADATA_BYTES) throw new Error('Cannot export backup: metadata is too large.');
  const totalUncompressed = metadataBytes.byteLength + attachments.reduce((total, attachment) => total + attachment.size, 0);
  if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) throw new Error('Cannot export backup: expanded data is too large.');
  for (const [index, attachment] of attachments.entries()) {
    files[`attachments/${index}.bin`] = new Uint8Array(await attachment.data.arrayBuffer());
  }
  files[METADATA_PATH] = metadataBytes;
  const zipped = zipSync(files, { level: 6 });
  inspectZip(zipped);
  return new Blob([new Uint8Array(zipped).buffer], { type: 'application/zip' });
}

export async function readBackup(file: Blob): Promise<BackupData> {
  if (file.size > MAX_ARCHIVE_BYTES) fail('archive is too large.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const inspected = inspectZip(bytes);
  const metadataEntry = inspected.find(({ name }) => name === METADATA_PATH);
  if (!metadataEntry || metadataEntry.uncompressed > MAX_METADATA_BYTES) fail('metadata.json is missing or too large.');

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    fail('archive cannot be decompressed.');
  }
  const metadataBytes = files[METADATA_PATH];
  if (!metadataBytes) fail('metadata.json is missing.');
  let rawMetadata: unknown;
  try {
    rawMetadata = JSON.parse(strFromU8(metadataBytes));
  } catch {
    fail('metadata.json is not valid JSON.');
  }
  const { metadata, attachmentMetadata } = parseMetadata(rawMetadata);
  const expectedPaths = new Set([METADATA_PATH, ...attachmentMetadata.map(({ path }) => path)]);
  if (Object.keys(files).some((path) => !expectedPaths.has(path)) || Object.keys(files).length !== expectedPaths.size) fail('archive contains unexpected or missing files.');

  const attachments = attachmentMetadata.map(({ path, ...attachment }): Attachment => {
    const data = files[path];
    if (!data || data.byteLength !== attachment.size) fail(`attachment ${attachment.id} size does not match metadata.`);
    return { ...attachment, data: new Blob([new Uint8Array(data).buffer], { type: attachment.mimeType }) };
  });
  return {
    prompts: metadata.prompts,
    quickPrompts: metadata.quickPrompts,
    snippets: metadata.snippets,
    attachments,
    settings: metadata.settings,
  };
}

export async function importBackup(data: BackupData, mode: 'merge' | 'replace'): Promise<AppSettings | undefined> {
  // Run exported data through the same structural validation used by archive reads.
  const attachmentMetadata: AttachmentMetadata[] = data.attachments.map(({ data: _data, ...item }, index) => ({ ...item, path: `attachments/${index}.bin` }));
  const { metadata, attachmentMetadata: validatedAttachmentMetadata } = parseMetadata({
    format: FORMAT,
    version: VERSION,
    exportedAt: Date.now(),
    prompts: data.prompts,
    quickPrompts: data.quickPrompts,
    snippets: data.snippets,
    attachments: attachmentMetadata,
    settings: data.settings,
  });
  for (const attachment of data.attachments) {
    if (!(attachment.data instanceof Blob) || attachment.data.size !== attachment.size) fail(`attachment ${attachment.id} data is invalid.`);
  }
  const attachments = validatedAttachmentMetadata.map(({ path: _path, ...attachment }, index): Attachment => ({
    ...attachment,
    data: data.attachments[index].data,
  }));

  await db.transaction('rw', [db.prompts, db.quickPrompts, db.snippets, db.attachments], async () => {
    if (mode === 'replace') {
      await Promise.all([db.prompts.clear(), db.quickPrompts.clear(), db.snippets.clear(), db.attachments.clear()]);
      await db.prompts.bulkAdd(metadata.prompts);
      await db.quickPrompts.bulkAdd(metadata.quickPrompts);
      await db.snippets.bulkAdd(metadata.snippets);
      await db.attachments.bulkAdd(attachments);
      return;
    }

    const [currentPrompts, currentQuick, currentSnippets] = await Promise.all([
      db.prompts.toArray(),
      db.quickPrompts.toArray(),
      db.snippets.toArray(),
    ]);
    const nextPosition = (records: { position: number }[]) => Math.max(-1, ...records.map(({ position }) => position)) + 1;
    const promptCopies = cloneWithIds(metadata.prompts, nextPosition(currentPrompts));
    const quickCopies = cloneWithIds(metadata.quickPrompts, nextPosition(currentQuick));
    const snippetCopies = cloneWithIds(metadata.snippets, nextPosition(currentSnippets));
    const attachmentCopies = attachments.map((attachment) => ({
      ...attachment,
      id: newId(),
      promptId: promptCopies.ids.get(attachment.promptId)!,
    }));
    await db.prompts.bulkAdd(promptCopies.records);
    await db.quickPrompts.bulkAdd(quickCopies.records);
    await db.snippets.bulkAdd(snippetCopies.records);
    await db.attachments.bulkAdd(attachmentCopies);
  });
  return mode === 'replace' ? metadata.settings : undefined;
}
