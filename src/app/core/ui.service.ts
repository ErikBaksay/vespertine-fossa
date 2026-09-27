import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import type { AppSettings } from './models';
@Injectable({ providedIn: 'root' })
export class UiService {
  private document = inject(DOCUMENT);
  toast = signal<{text:string;error:boolean}|null>(null);
  settings = signal<AppSettings>(this.loadSettings());
  private timer?: ReturnType<typeof setTimeout>;
  constructor() { this.applyTheme(); }
  private applyTheme(): void {
    const theme = this.settings().theme ?? 'light';
    this.document.documentElement.dataset['theme'] = theme;
    this.document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'oled' ? '#000000' : theme === 'dark' ? '#191817' : '#f8f4ef');
  }
  private loadSettings(): AppSettings {
    try { const value: unknown = JSON.parse(localStorage.getItem('prompt-queue-settings') ?? '{}'); const saved = value as AppSettings | null; return {theme: saved?.theme === 'dark' || saved?.theme === 'oled' ? saved.theme : 'light', density: saved?.density === 'compact' ? 'compact' : 'comfortable', showQuickPrompts: saved?.showQuickPrompts !== false, showSnippets: saved?.showSnippets !== false, showCommands: saved?.showCommands !== false, showStorage: saved?.showStorage !== false}; } catch { return {density:'comfortable'}; }
  }
  setSettings(settings: Partial<AppSettings>): void {
    this.settings.update(current => ({...current, ...settings}));
    this.applyTheme();
    try { localStorage.setItem('prompt-queue-settings', JSON.stringify(this.settings())); } catch { this.notify('Your preference could not be saved in this browser.', true); }
  }
  notify(text: string, error = false): void { clearTimeout(this.timer); this.toast.set({text,error}); this.timer = setTimeout(() => this.toast.set(null), error ? 6500 : 3200); }
  async run(action: () => Promise<unknown>, success?: string): Promise<boolean> {
    try { await action(); if(success) this.notify(success); return true; }
    catch(error) { this.notify(error instanceof Error ? error.message : 'Something went wrong. Your changes were not saved.', true); return false; }
  }
}
