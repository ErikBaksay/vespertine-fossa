import { Injectable, signal } from '@angular/core';
@Injectable({providedIn:'root'})
export class StorageService {
  usage=signal<number|null>(null);quota=signal<number|null>(null);persisted=signal<boolean|null>(null);checking=signal(false);
  constructor(){void this.refresh();}
  async refresh():Promise<void>{
    try{if(navigator.storage?.estimate){const estimate=await navigator.storage.estimate();this.usage.set(estimate.usage??null);this.quota.set(estimate.quota??null);}if(navigator.storage?.persisted)this.persisted.set(await navigator.storage.persisted());}catch{this.usage.set(null);this.quota.set(null);}
  }
  async requestPersistence():Promise<boolean|null>{if(!navigator.storage?.persist)return null;this.checking.set(true);try{const value=await navigator.storage.persist();this.persisted.set(value);await this.refresh();return value;}finally{this.checking.set(false);}}
  percent():number{return this.quota()?Math.min(100,100*(this.usage()??0)/this.quota()!):0;}
}
