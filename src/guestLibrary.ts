import type { Document } from '../shared/model';
import { documentSchema } from '../shared/documentSchema';
export const GUEST_KEY = 'cardchasm-guest-library-v1';
type History = { document: Document; at: number };
type Move = { before: Document[]; after: Record<string, number>; undone?: boolean };
interface Store { version: 1; documents: Document[]; history: Record<string, History[]>; copies: Record<string, {token:string; target?:string}>; moves:Record<string,Move> }
export type StoragePort = Pick<Storage,'getItem'|'setItem'>;
export class GuestLibrary {
  private storage:StoragePort;
  constructor(storage:StoragePort) { this.storage=storage; }
  private read(): Store {
    const raw=this.storage.getItem(GUEST_KEY);
    if (!raw) return {version:1,documents:[],history:{},copies:{},moves:{}};
    try {
      const data=JSON.parse(raw);
      if(data.version!==1||!Array.isArray(data.documents)||!data.history||!data.copies||!data.moves) throw Error();
      for(const d of data.documents) documentSchema.parse(d);
      return data;
    } catch { throw Error('Guest library could not be read. Storage has been preserved; export the raw guest file before recovery.'); }
  }
  private write(data:Store) {
    try { this.storage.setItem(GUEST_KEY,JSON.stringify(data)); }
    catch { throw Error('Guest changes could not be saved on this device. Storage may be full or blocked. Export your library before closing this page.'); }
    this.publish(data.documents);
  }
  publish(documents=this.list()) {
    try { (globalThis as typeof globalThis & {ReactNativeWebView?:{postMessage:(raw:string)=>void}}).ReactNativeWebView?.postMessage(JSON.stringify({type:"cardchasm:guest-snapshot",documents})); }
    catch { /* Browser save remains valid; no native recovery success is claimed. */ }
  }
  list() { return this.read().documents; }
  history(id:string) { return this.read().history[id]||[]; }
  private apply(data:Store,document:Document) {
    const d=documentSchema.parse(document) as Document;
    const old=data.documents.find(x=>x.id===d.id);
    if(old&&old.revision!==d.revision) throw Error('This guest document changed in another tab. Reopen it before editing.');
    if(old) data.history[d.id]=[{document:old,at:Date.now()},...(data.history[d.id]||[])].slice(0,30);
    const saved={...d,revision:(old?.revision||0)+1};
    data.documents=[...data.documents.filter(x=>x.id!==d.id),saved];return saved;
  }
  save(document:Document) { const data=this.read(),saved=this.apply(data,document);this.write(data);return saved; }
  backup() { return {version:1,storage:'guest-local-only',exportedAt:new Date().toISOString(),documents:this.list()}; }
  importBackup(raw:string) {
    const input=JSON.parse(raw);
    const documents=Array.isArray(input.documents)?input.documents:input.kind?[input]:null;
    if(!documents||documents.length>1000) throw Error('Choose a StackSynergy document or library JSON export (up to 1000 documents).');
    const docs:Document[]=documents.map((d:unknown)=>documentSchema.parse(d) as Document);
    const data=this.read(),added=docs.map(d=>this.apply(data,{...d,id:crypto.randomUUID(),revision:0,entries:d.entries.map(e=>({...e,id:crypto.randomUUID()}))}));
    this.write(data);return added;
  }
  copyRequest(owner:string,document:Document) {
    const data=this.read(),key=JSON.stringify([owner,document.id,document.revision]);
    const existing=data.copies[key];if(existing)return existing;
    const receipt={token:crypto.randomUUID()};data.copies[key]=receipt;this.write(data);return receipt;
  }
  finishCopy(owner:string,document:Document,target:string) {
    const data=this.read(),key=JSON.stringify([owner,document.id,document.revision]);
    const receipt=data.copies[key];if(!receipt)throw Error('Copy receipt missing; guest original is safe.');
    receipt.target=target;this.write(data);
  }
  copyStatus(owner:string,document:Document) { return this.read().copies[JSON.stringify([owner,document.id,document.revision])]; }
  move(source:Document,target:Document,ids:string[]) {
    if(source.id===target.id||source.kind==='deck'||target.kind!==source.kind||source.deleted||target.deleted)throw Error('Move owned cards between binders, or tracking cards between lists.');
    const data=this.read(),chosen=new Set(ids),rows=source.entries.filter(e=>chosen.has(e.id));
    if(rows.length!==chosen.size||!rows.length)throw Error('Choose existing rows.');
    const a=this.apply(data,{...source,entries:source.entries.filter(e=>!chosen.has(e.id))});
    const occupied=new Set(target.entries.map(e=>e.id));
    const b=this.apply(data,{...target,entries:[...target.entries,...rows.map(e=>occupied.has(e.id)?{...e,id:crypto.randomUUID()}:e)]});
    const id=crypto.randomUUID();data.moves[id]={before:[source,target],after:{[source.id]:a.revision,[target.id]:b.revision}};this.write(data);return {id,documents:[a,b]};
  }
  undoMove(id:string) {
    const data=this.read(),move=data.moves[id];if(!move||move.undone)throw Error('No move to undo.');
    for(const before of move.before)if(data.documents.find(d=>d.id===before.id)?.revision!==move.after[before.id])throw Error('A document changed after this move; undo is unavailable.');
    const documents=move.before.map(before=>this.apply(data,{...before,revision:move.after[before.id]}));move.undone=true;this.write(data);return {documents};
  }
}
