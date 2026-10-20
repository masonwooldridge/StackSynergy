import {expect,it} from 'vitest';
import {guestSnapshot,planRecoverySnapshot,readRecoverySlots,exportRecovery} from '../shared/guestRecovery';
import {GuestLibrary,GUEST_KEY} from '../src/guestLibrary';
import type {Document} from '../shared/model';
const doc=():Document=>({id:crypto.randomUUID(),name:'Private guest deck',kind:'deck',format:'commander',notes:'Local guest notes',entries:[],revision:1});
it('keeps separate LAN origins and a previous valid slot after an interrupted write',()=>{
 const slots:(string|null)[]=[null,null],a=doc(),b=doc();const first=planRecoverySnapshot(slots,'http://192.168.4.91:5173',[a],'first')!;slots[first.index]=first.text;
 const second=planRecoverySnapshot(slots,'http://192.168.4.25:5173',[b],'second')!;expect(second.index).not.toBe(first.index);slots[second.index]=second.text;
 const update=planRecoverySnapshot(slots,'http://192.168.4.91:5173',[{...a,name:'New edit'}],'third')!;slots[update.index]=update.text.slice(0,20);
 const recovered=readRecoverySlots(slots).vault;expect(recovered.snapshots.map(s=>s.documents[0])).toEqual([a,b]);
 expect(planRecoverySnapshot(slots,'http://192.168.4.91:5173',[],'cleared')).toBeNull();
});
it('exports recoverable new copies into a different origin without overwriting existing guest data',()=>{
 const a=doc(),existing=doc();const slot=planRecoverySnapshot([null,null],'http://old.local:5173',[a],'now')!;const vault=readRecoverySlots([slot.text,null]).vault,values=new Map<string,string>(),library=new GuestLibrary({getItem:key=>values.get(key)||null,setItem:(key,value)=>{values.set(key,value);}});library.save({...existing,revision:0});
 const backup=exportRecovery(vault);const [copy]=library.importBackup(JSON.stringify(backup));expect(copy.id).not.toBe(a.id);expect(copy.notes).toBe(a.notes);expect(library.list().find(d=>d.id===existing.id)?.notes).toBe(existing.notes);expect(vault.snapshots[0].documents).toEqual([a]);
});
it('rejects broken recovery files/credentials/oversized or invalid snapshots rather than replacing originals',()=>{
 expect(()=>readRecoverySlots(['broken','broken too'])).toThrow(/preserved/);expect(()=>planRecoverySnapshot([null,null],'http://user:password@host',[doc()],'now')).toThrow();
 expect(guestSnapshot(JSON.stringify({type:'cardchasm:guest-snapshot',documents:[{bad:true}]}))).toBeNull();expect(guestSnapshot(JSON.stringify({type:'cardchasm:guest-snapshot',documents:[doc()]}))).toHaveLength(1);
});
it('publishes only guest documents, never copy receipts/account identifiers, and a bridge failure cannot undo a valid browser save',()=>{
 const messages:string[]=[],global=globalThis as typeof globalThis & {ReactNativeWebView?:{postMessage:(raw:string)=>void}};const prior=global.ReactNativeWebView;global.ReactNativeWebView={postMessage:raw=>{messages.push(raw);}};
 try {const values=new Map<string,string>(),s={getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>{values.set(key,value);}},library=new GuestLibrary(s),d=library.save({...doc(),revision:0});library.copyRequest('private-account-id',d);expect(messages.every(raw=>!raw.includes('private-account-id'))).toBe(true);expect(Object.keys(JSON.parse(messages.at(-1)!))).toEqual(['type','documents']);global.ReactNativeWebView={postMessage:()=>{throw Error('Bridge down');}};expect(()=>library.save({...d,name:'Saved despite bridge error'})).not.toThrow();expect(JSON.parse(values.get(GUEST_KEY)!).documents[0].name).toBe('Saved despite bridge error');}finally{global.ReactNativeWebView=prior;}
});
