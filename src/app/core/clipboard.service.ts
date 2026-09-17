import { Injectable, inject } from '@angular/core';
import { UiService } from './ui.service';
@Injectable({providedIn:'root'})
export class ClipboardService {
  private ui = inject(UiService);
  async copy(text: string): Promise<void> {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const focused = document.activeElement as HTMLElement | null;
        const textarea = document.createElement('textarea');
        textarea.value = text; textarea.setAttribute('readonly', '');
        textarea.style.cssText = 'position:fixed;left:-9999px;top:0';
        // Keep the fallback inside a modal if one is active.
        (document.querySelector('dialog[open]') ?? document.body).appendChild(textarea);
        try { textarea.select(); if (!document.execCommand('copy')) throw new Error('Copy unavailable'); }
        finally { textarea.remove(); focused?.focus(); }
      }
      this.ui.notify('Copied to clipboard');
    } catch { this.ui.notify('Clipboard access was denied. Open the editor to select and copy the text manually.', true); }
  }
}
