import { Component, effect, input, output, signal } from '@angular/core';
import { Attachment } from '../core/models';
import { downloadBlob, formatBytes, isPreviewImage } from '../core/files';
import { DialogComponent } from './dialog.component';
import { IconComponent } from './icon.component';
@Component({selector:'pq-viewer',standalone:true,imports:[DialogComponent,IconComponent],template:`
  <pq-dialog [heading]="attachment().filename" [wide]="true" (dismiss)="dismiss.emit()">
    <p class="muted">{{attachment().mimeType || 'Unknown file type'}} · {{size(attachment().size)}} · Original file</p>
    @if(image()){<p class="helper">Right-click the image and choose “Copy image” to use it in your AI tool.</p><div class="image-preview"><img [src]="url()" [alt]="attachment().filename"></div>}
    @else if(text() !== null){<pre class="text-preview">{{text()}}</pre>}
    @else{<div class="file-preview"><pq-icon name="file"/><p>Your original file is stored locally and ready to download.</p></div>}
    <footer class="dialog-actions"><button class="button" (click)="dismiss.emit()">Close</button><button class="button primary" (click)="download()"><pq-icon name="download-simple"/>Download original</button></footer>
  </pq-dialog>`,styles:`.image-preview{max-height:56vh;overflow:auto;border-radius:9px;background:var(--soft);text-align:center}.image-preview img{display:block;max-width:100%;height:auto;margin:auto}.text-preview{max-height:50vh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;background:var(--soft);padding:20px;border-radius:9px;font:13px/1.7 monospace}.file-preview{padding:40px;text-align:center;background:var(--soft);border-radius:10px}.file-preview pq-icon{width:50px;height:50px}`})
export class ViewerComponent {
  attachment=input.required<Attachment>();dismiss=output<void>();url=signal('');text=signal<string|null>(null);size=formatBytes;
  image():boolean{return isPreviewImage(this.attachment().mimeType);}
  download():void{downloadBlob(this.attachment().data,this.attachment().filename);}
  constructor(){effect(onCleanup=>{const attachment=this.attachment();let alive=true;const url=this.image()?URL.createObjectURL(attachment.data):'';this.url.set(url);this.text.set(null);if((attachment.mimeType.startsWith('text/')||/\.(md|txt|patch|json|csv|log|ts|js)$/i.test(attachment.filename))&&attachment.size<1_000_000){void attachment.data.text().then(text=>{if(alive)this.text.set(text);});}onCleanup(()=>{alive=false;if(url)URL.revokeObjectURL(url);});});}
}
