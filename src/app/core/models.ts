export interface Prompt {
  id: string;
  title: string;
  body: string;
  position: number;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  archivedAt: number | null;
}

export interface LibraryItem {
  id: string;
  title: string;
  body: string;
  position: number;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  icon: string;
}

export interface Attachment {
  id: string;
  promptId: string;
  filename: string;
  mimeType: string;
  size: number;
  data: Blob;
  createdAt: number;
}

export interface AppSettings {
  density: 'comfortable' | 'compact';
}

export type LibraryKind = 'quickPrompts' | 'snippets';

export interface MetaRecord {
  key: string;
  value: unknown;
}
