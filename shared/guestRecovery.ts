import type {Document} from './model';
import { documentSchema } from './documentSchema';
import { MAX_BRIDGE_BYTES,serverOrigin } from './nativeBridge';
export interface RecoveryVault {version:1;sequence:number;snapshots:{origin:string;savedAt:string;documents:Document[]}[]}
export function guestSnapshot(raw:string):Document[]|null {
 try{if(raw.length>MAX_BRIDGE_BYTES)return null;const data=JSON.parse(raw);if(data.type!=='cardchasm:guest-snapshot'||!Array.isArray(data.documents)||data.documents.length>1000)return null;return data.documents.map((d:unknown)=>documentSchema.parse(d) as Document);}catch{return null;}
}
export function readRecoverySlots(slots:(string|null)[]) {
 const valid:{vault:RecoveryVault;index:number}[]=[];
 slots.forEach((raw,index)=>{if(raw===null)return;try{
  if(raw.length>MAX_BRIDGE_BYTES)throw Error();const data=JSON.parse(raw);
  if(data.version!==1||!Number.isSafeInteger(data.sequence)||data.sequence<1||!Array.isArray(data.snapshots))throw Error();
  const snapshots=data.snapshots.map((s:RecoveryVault['snapshots'][number])=>{
   if(typeof s.savedAt!=='string'||!Array.isArray(s.documents)||s.documents.length>1000||serverOrigin(s.origin)!==s.origin)throw Error();
   return {...s,documents:s.documents.map(d=>documentSchema.parse(d) as Document)};
  });valid.push({vault:{version:1,sequence:data.sequence,snapshots},index});
 }catch{/* Keep the other slot available after an interrupted write. */}});
 if(!valid.length){if(slots.some(s=>s!==null))throw Error('Guest recovery files could not be read. Existing files were preserved; use the browser export if available.');return {vault:{version:1,sequence:0,snapshots:[]} as RecoveryVault,index:-1};}
 return valid.sort((a,b)=>b.vault.sequence-a.vault.sequence)[0];
}
/** Write the OTHER slot, preserving the last valid recovery copy through interruption. */
export function planRecoverySnapshot(slots:(string|null)[],origin:string,documents:Document[],now:string) {
 const source=serverOrigin(origin);const parsed=documents.map(d=>documentSchema.parse(d) as Document);const {vault,index}=readRecoverySlots(slots);
 const previous=vault.snapshots.find(s=>s.origin===source);
 // An empty fresh/cleared WebView must not erase its last nonempty recovery copy.
 if((!parsed.length&&previous?.documents.length)||JSON.stringify(previous?.documents)===JSON.stringify(parsed))return null;
 const next:RecoveryVault={version:1,sequence:vault.sequence+1,snapshots:[...vault.snapshots.filter(s=>s.origin!==source),{origin:source,savedAt:now,documents:parsed}]};
 const text=JSON.stringify(next);if(text.length>MAX_BRIDGE_BYTES||!Number.isSafeInteger(next.sequence))throw Error('Native guest recovery is full; export your guest library. Existing recovery files remain intact.');
 return {index:index===0?1:0,text};
}
export function exportRecovery(vault:RecoveryVault) {
 return {version:1,storage:'native-guest-recovery',exportedAt:new Date().toISOString(),sources:vault.snapshots.map(({origin,savedAt,documents})=>({origin,savedAt,documents:documents.length})),documents:vault.snapshots.flatMap(s=>s.documents.map(d=>({...d,name:(d.name+' · recovered').slice(0,150)})))};
}
