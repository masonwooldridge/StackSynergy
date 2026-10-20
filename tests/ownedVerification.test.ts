import {expect,it} from 'vitest';
import {verifyOwnedPrintings} from '../shared/ownedVerification';
import {buildCommanderDeck} from '../shared/deckBuilder';
import type {Card,Document} from '../shared/model';
import {newEntry} from '../shared/deckEditing';
const card=(name:string,color='G'):Card=>({id:crypto.randomUUID(),oracle_id:crypto.randomUUID(),name,type_line:'Creature',color_identity:[color],legalities:{commander:'legal'},prices:{usd:'0.10'},finishes:['nonfoil']});
const binder=(cards:Card[]):Document=>({id:crypto.randomUUID(),name:'Large owned library',kind:'collection',format:'commander',notes:'',revision:1,entries:cards.map(c=>newEntry(c))});
it('verifies every printing beyond200, deduplicates identities only, and retains a feasible late collection-only deck',async()=>{
 const irrelevant=Array.from({length:205},(_,n)=>card('Off color '+n,'R')),commander={...card('Commander'),type_line:'Legendary Creature'},forest={...card('Forest'),type_line:'Basic Land — Forest'},spells=Array.from({length:63},(_,n)=>card('Late spell '+n));
 const d=binder([...irrelevant,commander,forest,...spells]);d.entries.find(e=>e.card.id===forest.id)!.qty=36;
 const facts=new Map(d.entries.map(e=>[e.card.id,e.card])),seen:string[]=[],progress:number[]=[];
 const candidates=await verifyOwnedPrintings([d,{...d,id:crypto.randomUUID()}],async id=>{seen.push(id);return facts.get(id)!;},{progress:done=>progress.push(done)});
 expect(seen).toHaveLength(270);expect(candidates.at(-1)?.id).toBe(spells.at(-1)?.id);expect(progress.at(-1)).toBe(270);
 const result=buildCommanderDeck({commander,candidates,documents:[d],mode:'owned',budget:0,budgetMeaning:'purchases',strategy:'auto',fetchedAt:'now'});expect(result.complete).toBe(true);expect(result.document.entries.reduce((n,e)=>n+e.qty,0)).toBe(100);
});
it('cancels across chunk boundaries and rejects network failure instead of returning partial feasibility',async()=>{
 const cards=Array.from({length:230},(_,n)=>card('Owned '+n)),d=binder(cards);let count=0;
 await expect(verifyOwnedPrintings([d],async id=>cards.find(c=>c.id===id)!,{cancelled:()=>count===26,progress:done=>{count=done;}})).rejects.toThrow(/stopped/);expect(count).toBe(26);
 let index=0;await expect(verifyOwnedPrintings([d],async id=>{if(index++===205)throw Error('Offline');return cards.find(c=>c.id===id)!;})).rejects.toThrow(/205\/230.*partial collection.*Offline/);
});
it('never trusts a mismatched card response or includes wishlist/deleted inventory',async()=>{const c=card('A');await expect(verifyOwnedPrintings([binder([c])],async()=>card('Wrong'))).rejects.toThrow(/wrong printing/);expect(await verifyOwnedPrintings([{...binder([c]),deleted:true},{...binder([c]),kind:'wishlist'}],async()=>c)).toEqual([]);});
