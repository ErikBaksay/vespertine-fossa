import { AfterViewInit, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { IconComponent } from './icon.component';
@Component({selector:'pq-dialog', standalone:true, imports:[IconComponent], template:`
  <dialog #dialog (cancel)="onCancel($event)" [class.wide]="wide()" aria-labelledby="dialog-title">
    <header class="dialog-header"><div><span class="eyebrow">PROMPT QUEUE</span><h2 id="dialog-title">{{heading()}}</h2></div><button class="icon-button" type="button" aria-label="Close dialog" [disabled]="busy()" (click)="dismiss.emit()"><pq-icon name="x"/></button></header>
    <ng-content/>
  </dialog>`, styles:`dialog{border:1px solid var(--border);border-radius:18px;background:var(--surface);color:var(--ink);padding:28px;width:min(560px,calc(100vw - 36px));max-height:90dvh;overflow:auto;box-shadow:0 24px 100px #34291d30}dialog.wide{width:min(820px,calc(100vw - 36px))}dialog::backdrop{background:#2c241f45;backdrop-filter:blur(4px)}.dialog-header{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:24px}h2{font-size:27px;margin:6px 0 0}.eyebrow{font-size:10px;letter-spacing:.16em;color:var(--muted)}@media(max-width:600px){dialog{padding:20px}}`})
export class DialogComponent implements AfterViewInit {
  heading = input.required<string>(); wide = input(false); busy = input(false); dismiss = output<void>(); dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  ngAfterViewInit():void { this.dialog().nativeElement.showModal(); }
  onCancel(event: Event):void { event.preventDefault(); if(!this.busy()) this.dismiss.emit(); }
}
