import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDropList, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { StoreService } from './core/store.service';
import { UiService } from './core/ui.service';
import { StorageService } from './core/storage.service';
import { Attachment, LibraryItem, LibraryKind, Prompt } from './core/models';
import { downloadBlob, formatBytes } from './core/files';
import { IconComponent } from './shared/icon.component';
import { AttachmentComponent } from './shared/attachment.component';
import { DialogComponent } from './shared/dialog.component';
import { ViewerComponent } from './shared/viewer.component';
import { EditorComponent, EditorKind } from './features/editor.component';
import { PromptCardComponent } from './features/prompt-card.component';
import { LibraryComponent } from './features/library.component';
import { StoragePanelComponent } from './features/storage-panel.component';
import { SettingsComponent } from './features/settings.component';
import { BackupComponent } from './features/backup.component';
type View = 'queue'|LibraryKind|'attachments'|'archive'|'backup'|'settings';
interface Confirmation { title:string; body:string; action:()=>Promise<unknown>; success:string; }
@Component({selector:'app-root',standalone:true,imports:[FormsModule,CdkDropList,IconComponent,AttachmentComponent,DialogComponent,ViewerComponent,EditorComponent,PromptCardComponent,LibraryComponent,StoragePanelComponent,SettingsComponent,BackupComponent],templateUrl:'./app.component.html',styleUrl:'./app.component.scss'})
export class AppComponent {
  store=inject(StoreService);ui=inject(UiService);storage=inject(StorageService);
  narrow=signal(window.innerWidth<=760);view=signal<View>(this.readHash());query=signal('');mobileNav=signal(false);editor=signal<{kind:EditorKind;item:Prompt|LibraryItem|null}|null>(null);viewer=signal<Attachment|null>(null);confirmation=signal<Confirmation|null>(null);confirmBusy=signal(false);confirmError=signal('');
  navigation: {view:View;label:string;icon:string}[]=[{view:'queue',label:'Queue',icon:'user'},{view:'quickPrompts',label:'Quick Prompts',icon:'sparkle'},{view:'snippets',label:'Snippets',icon:'note'},{view:'commands',label:'Commands',icon:'file-code'},{view:'attachments',label:'Attachments',icon:'paperclip'},{view:'archive',label:'Archive',icon:'archive'}];
  active=computed(()=>this.store.prompts().filter(p=>p.archivedAt===null));archived=computed(()=>this.store.prompts().filter(p=>p.archivedAt!==null).sort((a,b)=>(b.archivedAt??0)-(a.archivedAt??0)));
  searching=computed(()=>this.query().trim().length>0);
  prompts=computed(()=>(this.view()==='archive'?this.archived():this.active()).filter(p=>this.matches(p)));
  quickPrompts=computed(()=>this.store.quickPrompts().filter(p=>this.matches(p)));snippets=computed(()=>this.store.snippets().filter(p=>this.matches(p)));commands=computed(()=>this.store.commands().filter(p=>this.matches(p)));
  attachments=computed(()=>this.store.attachments().filter(a=>`${a.filename} ${this.owner(a)?.title??''} ${a.mimeType}`.toLowerCase().includes(this.query().trim().toLowerCase())));
  resultCount=computed(()=>this.prompts().length+this.quickPrompts().length+this.snippets().length+this.commands().length);
  attachmentMap=computed(()=>{const map=new Map<string,Attachment[]>();for(const attachment of this.store.attachments()){const list=map.get(attachment.promptId)??[];list.push(attachment);map.set(attachment.promptId,list);}return map;});
  headings:Record<View,string>={queue:'Your queue',quickPrompts:'Quick prompts',snippets:'Your snippets',commands:'Your commands',attachments:'Your attachments',archive:'Your archive',backup:'Export / Import',settings:'Settings'};
  descriptions:Record<View,string>={queue:'Prepare your next prompts, including attachments. Copy them when you’re ready.',quickPrompts:'Your go-to prompts, ready whenever you need them.',snippets:'The small pieces that make a great prompt. Keep your favorites here.',commands:'Your frequently used commands, ready to copy.',attachments:'Every original file, right where you left it.',archive:'Finished for now. Restore a prompt whenever you need it again.',backup:'Keep a copy of your workspace. Bring it with you.',settings:'A quiet workspace, just the way you like it.'};
  size=formatBytes;
  constructor(){effect(()=>{this.store.attachments();this.store.prompts();void this.storage.refresh();});}
  @HostListener('window:resize') onResize():void{this.narrow.set(window.innerWidth<=760);}
  @HostListener('window:hashchange') onHashChange():void{this.view.set(this.readHash());this.query.set('');this.mobileNav.set(false);}
  @HostListener('document:keydown.escape') closeNav():void{this.mobileNav.set(false);}
  private readHash():View{const value=location.hash.slice(1);return ['queue','quickPrompts','snippets','commands','attachments','archive','backup','settings'].includes(value)?value as View:'queue';}
  navigate(view:View):void{this.view.set(view);this.query.set('');this.mobileNav.set(false);if(location.hash!==`#${view}`)location.hash=view;}
  matches(item:{title:string;body:string;tags:string[]}):boolean{const terms=this.query().trim().toLowerCase().split(/\s+/).filter(Boolean);const haystack=`${item.title}\n${item.body}\n${item.tags.join(' ')}`.toLowerCase();return terms.every(term=>haystack.includes(term));}
  count(view:View):number|null{return view==='queue'?this.active().length:view==='quickPrompts'?this.store.quickPrompts().length:view==='snippets'?this.store.snippets().length:view==='commands'?this.store.commands().length:null;}
  openEditor(kind:EditorKind='prompt',item:Prompt|LibraryItem|null=null):void{this.editor.set({kind,item});}
  skipToContent(event:Event):void{event.preventDefault();document.getElementById('main-content')?.focus();}
  retryStorage():void{void this.ui.run(()=>this.store.initialize());}
  createCurrent():void{this.openEditor(this.view()==='commands'?'commands':this.view()==='quickPrompts'?'quickPrompts':this.view()==='snippets'?'snippets':'prompt');}
  filesFor(id:string):Attachment[]{return this.attachmentMap().get(id)??[];}
  owner(attachment:Attachment):Prompt|undefined{return this.store.prompts().find(p=>p.id===attachment.promptId);}
  openOwner(attachment:Attachment):void{const owner=this.owner(attachment);if(owner)this.openEditor('prompt',owner);}
  download(attachment:Attachment):void{downloadBlob(attachment.data,attachment.filename);}
  archive(prompt:Prompt):void{void this.ui.run(()=>this.store.archivePrompt(prompt.id),'Prompt moved to archive');}
  restore(prompt:Prompt):void{void this.ui.run(()=>this.store.restorePrompt(prompt.id),'Prompt restored to your queue');}
  deletePrompt(prompt:Prompt):void{this.confirmError.set('');this.confirmation.set({title:'Delete this prompt?',body:`“${prompt.title}” and all its attachments will be permanently deleted from this device. This cannot be undone.`,action:()=>this.store.deletePrompt(prompt.id),success:'Prompt permanently deleted'});}
  deleteAttachment(attachment:Attachment):void{this.confirmError.set('');this.confirmation.set({title:'Delete this attachment?',body:`“${attachment.filename}” will be permanently removed from this workspace. The prompt will be kept.`,action:()=>this.store.deleteAttachment(attachment.id),success:'Attachment deleted'});}
  deleteLibrary(kind:LibraryKind,item:LibraryItem):void{this.confirmError.set('');this.confirmation.set({title:`Delete this ${kind==='commands'?'command':kind==='snippets'?'snippet':'quick prompt'}?`,body:`“${item.title}” will be permanently deleted. This cannot be undone.`,action:()=>this.store.deleteLibrary(kind,item.id),success:'Item deleted'});}
  async confirmDelete():Promise<void>{const confirmation=this.confirmation();if(!confirmation||this.confirmBusy())return;this.confirmBusy.set(true);this.confirmError.set('');try{await confirmation.action();this.confirmation.set(null);this.ui.notify(confirmation.success);}catch(error){this.confirmError.set(error instanceof Error?error.message:'Unable to delete. Please try again.');}finally{this.confirmBusy.set(false);}}
  drop(event:CdkDragDrop<Prompt[]>):void{if(this.searching())return;const reordered=[...this.active()];moveItemInArray(reordered,event.previousIndex,event.currentIndex);void this.ui.run(()=>this.store.reorderPrompts(reordered.map(p=>p.id)),'Queue reordered');}
  move(prompt:Prompt,offset:number):void{if(this.searching())return;const reordered=[...this.active()];const index=reordered.findIndex(p=>p.id===prompt.id);const target=index+offset;if(index<0||target<0||target>=reordered.length)return;moveItemInArray(reordered,index,target);void this.ui.run(()=>this.store.reorderPrompts(reordered.map(p=>p.id)),`Moved to position ${target+1}`);}
}
