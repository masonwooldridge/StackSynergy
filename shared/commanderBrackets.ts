import data from './commanderBracketData.json';
import type {Card,Document} from './model';
export type CommanderBracket=1|2|3|4|5;
export const bracketData=data;
export const brackets=[
 {id:1,name:'Exhibition',description:'Theme and creative expression take priority over strength; discuss unusual rules with your pod.',turns:'Generally at least nine turns before winning or losing.'},
 {id:2,name:'Core',description:'Straightforward, unoptimized social play with visible, disruptable wins. Not defined by a particular precon.',turns:'Generally at least eight turns before winning or losing.'},
 {id:3,name:'Upgraded',description:'Strong synergy and card quality, with proactive and reactive plays and wins built from accrued resources.',turns:'Generally at least six turns before winning or losing.'},
 {id:4,name:'Optimized',description:'Fast, consistent and explosive decks outside the specific cEDH metagame.',turns:'Generally at least four turns before winning or losing.'},
 {id:5,name:'cEDH',description:'Decks tuned for the competitive Commander metagame, prioritizing efficient wins and victory.',turns:'Games may end on any turn.'},
] as const;
const normalize=(name:string)=>name.normalize('NFKC').replace(/[’‘]/g,"'").trim().toLowerCase();
const names=new Set(data.gameChangers.map(c=>normalize(c.name)));
export function isGameChanger(card:Card){return [card.name.split(' // ')[0],...(card.card_faces||[]).map(f=>f.name)].some(name=>names.has(normalize(name)));}
export const gameChangerLimit=(bracket:CommanderBracket)=>bracket<=2?0:bracket===3?3:Infinity;
export function bracketCheck(d:Pick<Document,'entries'|'commanderBracket'>){const cards=d.entries.filter(e=>e.board==='commander'||e.board==='mainboard');const count=cards.reduce((n,e)=>n+(isGameChanger(e.card)?e.qty:0),0),limit=d.commanderBracket?gameChangerLimit(d.commanderBracket):Infinity;return {count,limit,errors:count>limit?[`Bracket ${d.commanderBracket} permits ${limit} Game Changers; this deck has ${count}, including its commander.`]:[]};}
export const bracketCaveat='This is a target and Game Changer count check, not a power-level guarantee. Review theme, intent, win speed, two-card combos, extra turns and mass land denial with your table. The generator does not certify these behaviors or cEDH readiness.';
