import type {Card,Document} from './model';
export class VerificationStopped extends Error {}
/** Every unique owned printing is verified; chunks bound progress, never truncate the pool. */
export async function verifyOwnedPrintings(documents:Document[],resolve:(id:string)=>Promise<Card>,options:{cancelled?:()=>boolean;progress?:(done:number,total:number)=>void;chunkSize?:number}={}) {
 const ids=[...new Set(documents.filter(d=>d.kind==='collection'&&!d.deleted).flatMap(d=>d.entries.map(e=>e.card.id)))];
 const size=options.chunkSize??25;if(!Number.isInteger(size)||size<1)throw Error('Invalid verification chunk size.');
 const cards:Card[]=[];options.progress?.(0,ids.length);
 const check=()=>{if(options.cancelled?.())throw new VerificationStopped('Verification stopped. No partial collection was used to build a deck.');};
 for(let offset=0;offset<ids.length;offset+=size){
  for(const id of ids.slice(offset,offset+size)){
   check();let card:Card;
   try{card=await resolve(id);}catch(error){check();throw Error(`Verified ${cards.length}/${ids.length} owned printings. Cannot build from a partial collection: ${(error as Error).message}`);}
   check();if(card.id!==id)throw Error(`Card provider returned the wrong printing. Verified ${cards.length}/${ids.length}; no partial build produced.`);
   cards.push(card);options.progress?.(cards.length,ids.length);
  }
 }
 check();return cards;
}
