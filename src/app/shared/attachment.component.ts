import { Component, effect, input, output, signal } from '@angular/core';
import { Attachment } from '../core/models';
import { formatBytes, isPreviewImage } from '../core/files';
import { IconComponent } from './icon.component';
@Component({selector:'pq-attachment', standalone:true, imports:[IconComponent], template:`
  <button type="button" class="attachment" (click)="open.emit(attachment())" [attr.aria-label]="'View ' + attachment().filename">
    @if(url()){<img class="thumbnail" [src]="url()" alt="">} @else {<span class="file-icon" [class.code]="icon() === 'file-code'" [class.pdf]="icon() === 'file-pdf'"><pq-icon [name]="icon()"/></span>}
    <span class="attachment-label"><span class="filename">{{attachment().filename}}</span><span class="file-size">{{size(attachment().size)}}</span></span>
  </button>`, styles:`:host{display:inline-block;max-width:100%}.attachment{display:flex;align-items:center;gap:11px;padding:5px 13px 5px 5px;background:var(--soft);border:1px solid transparent;border-radius:8px;min-height:52px;max-width:230px;text-align:left}.attachment:hover{border-color:var(--border-strong);background:var(--hover)}.thumbnail,.file-icon{width:40px;height:40px;border-radius:6px;flex-shrink:0}.thumbnail{object-fit:cover}.file-icon{display:grid;place-items:center;background:var(--neutral-bg,#f1eae3);color:var(--brown)}.file-icon pq-icon{width:25px;height:25px}.file-icon.code{background:var(--blue-bg,#e3efff)}.file-icon.pdf{background:var(--coral-bg,#ffe5dc)}.attachment-label{min-width:0;display:grid;gap:3px}.filename{font-size:12px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.file-size{font-size:11px;color:var(--muted)}`})
export class AttachmentComponent {
  attachment=input.required<Attachment>(); open=output<Attachment>(); url=signal(''); size=formatBytes;
  icon():string { const name=this.attachment().filename; return /\.pdf$/i.test(name)?'file-pdf':/\.(md|patch|json|js|ts|css|html)$/i.test(name)?'file-code':'file-text'; }
  constructor(){effect(onCleanup=>{const a=this.attachment(); const url=isPreviewImage(a.mimeType)?URL.createObjectURL(a.data):'';this.url.set(url);onCleanup(()=>{if(url)URL.revokeObjectURL(url);});});}
}
