import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Attachment, LibraryItem, LibraryKind, Prompt } from '../core/models';
import { StoreService } from '../core/store.service';
import { UiService } from '../core/ui.service';
import { formatBytes } from '../core/files';
import { DialogComponent } from '../shared/dialog.component';
import { IconComponent } from '../shared/icon.component';
export type EditorKind = 'prompt' | LibraryKind;
@Component({selector:'pq-editor',standalone:true,imports:[FormsModule,DialogComponent,IconComponent],template:`
  <pq-dialog [heading]="heading()" [wide]="true" [busy]="saving()" (dismiss)="cancel()">
    <form (ngSubmit)="save()" (paste)="paste($event)">
      <label for="editor-title">Title</label><input id="editor-title" name="title" [(ngModel)]="title" required maxlength="250" [placeholder]="kind() === 'commands' ? 'Give your command a name' : 'Give your next idea a name'" autofocus>
      <div class="body-label"><label for="editor-body">{{kind() === 'commands' ? 'Command' : kind() === 'snippets' ? 'Snippet' : 'Prompt'}}</label><span>{{body.length.toLocaleString()}} characters</span></div>
      <textarea id="editor-body" name="body" [(ngModel)]="body" required rows="11" spellcheck="false" [class.command-body]="kind() === 'commands'" [placeholder]="kind() === 'commands' ? 'Paste or write your command here.' : 'Write your prompt here. Take your time — it will be here when you’re ready.'"></textarea>
      <label for="editor-tags">Tags <span class="optional">optional, separated by commas</span></label><input id="editor-tags" name="tags" [(ngModel)]="tags" placeholder="development, frontend">
      @if(kind() === 'prompt'){
        <label>Attachments <span class="optional">original files, kept on your device</span></label>
        <div class="dropzone" [class.dragging]="dragging()" (dragover)="dragOver($event)" (dragleave)="dragging.set(false)" (drop)="drop($event)">
          <pq-icon name="upload-simple"/><span>Drop files here, <button type="button" class="text-button" (click)="picker.click()">browse files</button>, or paste an image</span>
          <input #picker type="file" multiple hidden (change)="selectFiles($event)">
        </div>
        @if(existing().length || files().length){<ul class="editor-files">
          @for(file of existing();track file.id){<li [class.removed]="removed().includes(file.id)"><pq-icon name="file-text"/><span>{{file.filename}} <small>{{size(file.size)}}</small></span><button type="button" class="text-button" (click)="toggleRemoval(file.id)">{{removed().includes(file.id)?'Undo':'Remove'}}</button></li>}
          @for(file of files();track $index){<li><pq-icon name="file-text"/><span>{{file.name}} <small>{{size(file.size)}}</small></span><button type="button" class="text-button" (click)="removeNew($index)">Remove</button></li>}
        </ul>}
      }
      @if(error()){<p class="inline-error" role="alert">{{error()}}</p>}
      <footer class="dialog-actions"><span class="save-note"><pq-icon name="shield"/>Saved only on this device</span><button class="button" type="button" [disabled]="saving()" (click)="cancel()">Cancel</button><button class="button primary" type="submit" [disabled]="saving() || !title.trim() || !body.trim()">{{saving()?'Saving…':item()?'Save changes':'Create ' + (kind() === 'commands'?'command':kind() === 'prompt'?'prompt':kind() === 'snippets'?'snippet':'quick prompt')}}</button></footer>
    </form>
  </pq-dialog>`,styles:`label{display:block;font-size:13px;font-weight:500;margin:18px 0 8px}label:first-child{margin-top:0}input,textarea{width:100%}textarea{min-height:230px;resize:vertical;line-height:1.7;font-size:14px;tab-size:2}.command-body{font-family:monospace}.body-label{display:flex;justify-content:space-between;align-items:baseline}.body-label span,.optional{font-size:11px;font-weight:400;color:var(--muted)}.optional{margin-left:6px}.dropzone{display:flex;align-items:center;justify-content:center;gap:12px;padding:24px 16px;border:1px dashed var(--border-strong);border-radius:9px;font-size:12px;color:var(--muted);background:var(--soft)}.dropzone.dragging{background:var(--selected);border-color:var(--brown)}.editor-files{padding:0;margin:12px 0;list-style:none}.editor-files li{display:flex;align-items:center;gap:10px;padding:9px 4px;font-size:12px;border-bottom:1px solid var(--border)}.editor-files li>span{flex:1;overflow-wrap:anywhere}.editor-files small{color:var(--muted);margin-left:8px}.removed>span{text-decoration:line-through;opacity:.5}.save-note{margin-right:auto;font-size:11px;color:var(--muted);display:flex;align-items:center;gap:6px}.save-note pq-icon{width:14px;height:14px}@media(max-width:600px){.save-note{display:none}.dropzone{align-items:flex-start}}`})
export class EditorComponent implements OnInit {
  kind=input<EditorKind>('prompt');item=input<Prompt|LibraryItem|null>(null);saved=output<void>();dismiss=output<void>();
  store=inject(StoreService);ui=inject(UiService);title='';body='';tags='';files=signal<File[]>([]);removed=signal<string[]>([]);existing=signal<Attachment[]>([]);saving=signal(false);error=signal('');dragging=signal(false);size=formatBytes;
  ngOnInit():void{const item=this.item();if(item){this.title=item.title;this.body=item.body;this.tags=item.tags.join(', ');this.existing.set(this.store.attachments().filter(a=>a.promptId===item.id));}}
  heading():string { return `${this.item()?'Edit':'New'} ${this.kind()==='commands'?'command':this.kind()==='prompt'?'prompt':this.kind()==='quickPrompts'?'quick prompt':'snippet'}`; }
  selectFiles(event:Event):void{const el=event.target as HTMLInputElement;this.addFiles(Array.from(el.files??[]));el.value='';}
  addFiles(files:File[]):void{this.files.update(value=>[...value,...files]);}
  dragOver(event:DragEvent):void{event.preventDefault();this.dragging.set(true);}
  drop(event:DragEvent):void{event.preventDefault();this.dragging.set(false);this.addFiles(Array.from(event.dataTransfer?.files??[]));}
  paste(event:ClipboardEvent):void{if(this.kind()!=='prompt')return;const files=Array.from(event.clipboardData?.items??[]).filter(i=>i.kind==='file'&&i.type.startsWith('image/')).map(i=>i.getAsFile()).filter((f):f is File=>f!==null);if(files.length){event.preventDefault();this.addFiles(files);}}
  removeNew(index:number):void{this.files.update(files=>files.filter((_,i)=>i!==index));}
  toggleRemoval(id:string):void{this.removed.update(ids=>ids.includes(id)?ids.filter(i=>i!==id):[...ids,id]);}
  cancel():void{const item=this.item();const dirty=this.title!==(item?.title??'')||this.body!==(item?.body??'')||this.tags!==(item?.tags.join(', ')??'')||this.files().length>0||this.removed().length>0;if(!dirty||window.confirm('Discard your unsaved changes?'))this.dismiss.emit();}
  async save():Promise<void>{
    if(this.saving()||!this.title.trim()||!this.body.trim())return;
    this.saving.set(true);this.error.set('');const previous=this.item();const now=Date.now();
    const shared={id:previous?.id??crypto.randomUUID(),title:this.title.trim(),body:this.body,tags:[...new Set(this.tags.split(',').map(t=>t.trim()).filter(Boolean))],createdAt:previous?.createdAt??now,updatedAt:now,position:previous?.position??now};
    try{if(this.kind()==='prompt'){const prompt:Prompt={...shared,archivedAt:previous&&'archivedAt'in previous?previous.archivedAt:null};await this.store.savePrompt(prompt,this.files(),this.removed());}
      else{await this.store.saveLibrary(this.kind() as LibraryKind,{...shared,icon:previous&&'icon'in previous?previous.icon:this.kind()==='commands'?'file-code':this.kind()==='snippets'?'file-text':'sparkle'});}
      this.ui.notify(previous?'Changes saved':'Created and saved locally');this.saved.emit();
    }catch(error){this.error.set(error instanceof Error?error.message:'Unable to save. Please try again.');}finally{this.saving.set(false);}
  }
}
