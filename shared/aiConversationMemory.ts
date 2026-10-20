import type { Card } from './model';
import { buildQuote } from './deckBuilder';
export type ConversationTurn = {role:'user'|'assistant';content:string};
export const MAX_CONVERSATION_TURNS = 80;
/** Derived from untrusted conversation; it may narrow choices, never relax validation. */
export function conversationIntent(turns: ConversationTurn[], cards: Card[]) {
  const last=turns[turns.length-1]?.content||'', users=turns.filter(t=>t.role==='user');
  const namesIn=(text:string)=>cards.filter(c=>text.toLocaleLowerCase().includes(c.name.toLocaleLowerCase()));
  const recommendedIn=(text:string)=>{const named=namesIn(text), additions=named.filter(c=>text.includes('→ add 1 '+c.name)||text.includes('-> add '+c.name));return additions.length?additions:named;};
  const lastAssistant=[...turns.slice(0,-1)].reverse().find(t=>t.role==='assistant');
  const previous=lastAssistant?recommendedIn(lastAssistant.content):[];
  const alternatives=/\b(?:other|different|another|alternatives?|instead)\b|not that|not those|cheaper/i.test(last);
  const explain=/^\s*(?:why\b|explain\b|how does\b|what about\b|compare\b)/i.test(last);
  const rejected=new Set<string>();
  for(let i=0;i<turns.length;i++) {
    const turn=turns[i];if(turn.role!=='user')continue;
    const negative=/\b(?:not that|not those|reject|avoid|don't want|do not want|no thanks)\b/i.test(turn.content) || (namesIn(turn.content).length > 0 && /\b(?:not|don't use|do not use)\b/i.test(turn.content));
    if(negative) {const named=namesIn(turn.content),prior=[...turns.slice(0,i)].reverse().find(t=>t.role==='assistant');for(const c of named.length?named:prior?recommendedIn(prior.content):[])rejected.add(c.name.toLocaleLowerCase());}
  }
  // An explicit request to reconsider a named card allows discussion/recommendation again.
  if(!/\b(?:avoid|reject|don't|do not|not)\b/i.test(last))for(const c of namesIn(last))rejected.delete(c.name.toLocaleLowerCase());
  const seen=turns.filter(t=>t.role==='assistant').flatMap(t=>recommendedIn(t.content));
  const previousPrices=previous.map(buildQuote).filter((n):n is number=>n!==null);
  const cheaper=/\bcheaper\b/i.test(last)&&previousPrices.length?Math.max(...previousPrices):null;
  const exclude=new Set([...rejected,...(alternatives&&!explain?seen.map(c=>c.name.toLocaleLowerCase()):[])]);
  if(!/\b(?:avoid|reject|don't|do not|not)\b/i.test(last))for(const c of namesIn(last))exclude.delete(c.name.toLocaleLowerCase());
  const substantive=users.slice(0,-1).reverse().find(t=>!/^(?:other options|more options|another|not that|cheaper|why|try again|undo|keep (?:the )?same|avoid|reconsider|no thanks)\b/i.test(t.content.trim()));
  const goal=substantive && (alternatives||explain||last.length<45)?substantive.content+'\nFollow-up: '+last:last;
  return {alternatives,explain,goal,rejected:[...rejected],previous:previous.map(c=>c.name),exclude,cheaper};
}

export function historicalCardIds(turns: ConversationTurn[]) {
  const ids = new Set<string>();
  for (const turn of [...turns].reverse()) if (turn.role === 'assistant') {
    const references = /\[Historical card references: ([^\]]+)\]/.exec(turn.content)?.[1] || '';
    for (const id of references.split(',')) if (/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id)) ids.add(id);
    if (ids.size >= 8) break;
  }
  return [...ids].slice(0, 8);
}
