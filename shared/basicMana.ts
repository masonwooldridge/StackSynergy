import {isLandSlot,playableLandFace} from './landAllocation';
import type {Card} from './model';
const symbols=['W','U','B','R','G','C'];
export type ManaCounts=Record<string,number>;
export function manaDemand(cards:{card:Card;qty:number}[]):ManaCounts {
 const demand:ManaCounts={};
 for(const {card,qty} of cards){if(isLandSlot(card))continue;const costs=card.mana_cost!==undefined?[card.mana_cost]:(card.card_faces||[]).map(f=>f.mana_cost||'');
  for(const cost of costs)for(const match of cost.matchAll(/\{([^}]+)\}/g)){const parts=match[1].split('/'),colors=parts.filter(p=>symbols.includes(p));if(!colors.length)continue;const divisor=colors.length+(parts.some(p=>/^\d+$/.test(p))?1:0);for(const color of colors)demand[color]=(demand[color]||0)+qty/divisor;}
 }
 return demand;
}
export function landManaSources(input:Card,identity:string[]):string[]{
 const card=playableLandFace(input);if(!card)return [];
 if(card.produced_mana)return [...new Set(card.produced_mana.filter(s=>symbols.includes(s)))];
 const type=card.type_line||'',basics:Record<string,string>={Plains:'W',Island:'U',Swamp:'B',Mountain:'R',Forest:'G',Wastes:'C'};
 const types=Object.entries(basics).filter(([t])=>new RegExp('\\b'+t+'\\b').test(type+(/\bBasic\b/.test(type)?' '+card.name:''))).map(([,s])=>s);if(types.length)return types;
 const text=card.oracle_text||'';if(/Add (?:one mana|two mana|three mana|mana) of any color/i.test(text))return identity.filter(s=>s!=='C');
 const ability=text.match(/(?:^|\n)\{T\}: Add[^.\n]*/g)?.join(' ')||'';return symbols.filter(s=>ability.includes('{'+s+'}'));
}
export function basicManaTargets(entries:{card:Card;qty:number}[],identity:string[],basicCount:number,commander?:Card):ManaCounts {
 const demand=manaDemand(entries);if(!Object.values(demand).some(Boolean))for(const s of identity.length?identity:['C'])demand[s]=1;
 const total=Object.values(demand).reduce((a,b)=>a+b,0),fixed:ManaCounts={};let nonbasics=0;
 for(const {card,qty} of entries){if(!isLandSlot(card)||/\bBasic\b/.test(card.type_line||''))continue;nonbasics+=qty;const sources=landManaSources(card,identity);for(const s of sources)fixed[s]=(fixed[s]||0)+qty/sources.length;}
 const weights=Object.fromEntries(Object.entries(demand).map(([s,n])=>[s,Math.max(0,(basicCount+nonbasics)*n/total-(fixed[s]||0))]));
 const sum=Object.values(weights).reduce((a,b)=>a+b,0);const exact=Object.entries(weights).map(([s,n])=>({s,n:sum?basicCount*n/sum:0}));const targets=Object.fromEntries(exact.map(({s,n})=>[s,Math.floor(n)]));let left=basicCount-Object.values(targets).reduce((a,b)=>a+b,0);
 for(const {s} of exact.sort((a,b)=>(b.n%1)-(a.n%1)||symbols.indexOf(a.s)-symbols.indexOf(b.s))){if(left--<=0)break;targets[s]++;}
 for(const s of Object.keys(demand)){if(targets[s]||fixed[s]>=1)continue;const donor=Object.keys(targets).sort((a,b)=>targets[b]-targets[a]).find(c=>targets[c]>1);if(donor){targets[donor]--;targets[s]=1;}}
 // A commander-only splash must not shrink to one land just because the other
 // 63 spells dominate total pip counts. This floor is a heuristic, not cast odds.
 if(commander){const commanderPips=manaDemand([{card:commander,qty:1}]);const floors:ManaCounts={};for(const [color,pips] of Object.entries(commanderPips))floors[color]=Math.max(0,Math.ceil(8+4*Math.max(0,pips-1)-(fixed[color]||0)));
  const requested=Object.values(floors).reduce((a,b)=>a+b,0);if(requested>basicCount)for(const color of Object.keys(floors))floors[color]=Math.floor(floors[color]*basicCount/requested);
  for(const color of Object.keys(floors))while((targets[color]||0)<floors[color]){const donor=Object.keys(targets).sort((a,b)=>(targets[b]-(floors[b]||0))-(targets[a]-(floors[a]||0))).find(c=>targets[c]>(floors[c]||0));if(!donor)break;targets[donor]--;targets[color]=(targets[color]||0)+1;}
 }return targets;
}
