import { Injectable, signal } from '@angular/core';
import type { AppSettings } from './models';
@Injectable({ providedIn: 'root' })
export class UiService {
  toast = signal<{text:string;error:boolean}|null>(null);
  settings = signal<AppSettings>(this.loadSettings());
  private timer?: ReturnType<typeof setTimeout>;
  private loadSettings(): AppSettings {
    try { const value: unknown = JSON.parse(localStorage.getItem('prompt-queue-settings') ?? '{}'); return {density: (value as AppSettings)?.density === 'compact' ? 'compact' : 'comfortable'}; } catch { return {density:'comfortable'}; }
  }
  setSettings(settings: AppSettings): void {
    this.settings.set(settings);
    try { localStorage.setItem('prompt-queue-settings', JSON.stringify(settings)); } catch { this.notify('Your preference could not be saved in this browser.', true); }
  }
  notify(text: string, error = false): void { clearTimeout(this.timer); this.toast.set({text,error}); this.timer = setTimeout(() => this.toast.set(null), error ? 6500 : 3200); }
  async run(action: () => Promise<unknown>, success?: string): Promise<boolean> {
    try { await action(); if(success) this.notify(success); return true; }
    catch(error) { this.notify(error instanceof Error ? error.message : 'Something went wrong. Your changes were not saved.', true); return false; }
  }
}
