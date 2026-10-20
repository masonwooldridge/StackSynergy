import type {Card} from './model';
export interface BuildIntent {primary:'commander'|'tokens';tokenEngine?:'any'|'lasting';combat:'balanced'|'large-hasty';supplementalDraw:'normal'|'reduced'}
export function normalizeBuildIntent(value?:Partial<BuildIntent>):BuildIntent{return{tokenEngine:value?.tokenEngine==='lasting'?'lasting':'any',primary:value?.primary==='tokens'?'tokens':'commander',combat:value?.combat==='large-hasty'?'large-hasty':'balanced',supplementalDraw:value?.supplementalDraw==='reduced'?'reduced':'normal'};}
const clean=(text:string)=>text.replace(/\([^()]*\)/g,'');
/** Conservative Oracle-text evidence. Counts cards, not a simulated number of tokens. */
export function tokenProductionProfile(card:Card){
 const faces=card.card_faces?.length?(card.layout==='adventure'||card.layout==='modal_dfc'?card.card_faces:[card.card_faces[0]]):[{oracle_text:card.oracle_text||'',type_line:card.type_line,mana_cost:card.mana_cost}];
 const text=clean(faces.map(f=>f.oracle_text||'').join('\n'));
 let ownCreature=false,ownResource=false,repeatable=false,burst=false,scalable=false,large=false,opponentOnly=false,conditional=false,ultimateOnly=false,tokenHaste=false,productionMana=card.cmc||0;
 const creationLines:string[]=[];
 for(const face of faces)for(const line of clean(face.oracle_text||'').split(/\n/)){
  if(/^if\b[^.]*would[^.]*(?:creat|token)/i.test(line))continue;
  for(const match of line.matchAll(/\bcreates?\b[^.\n]*?\btokens?\b[^.\n]*/gi)){
   const prefix=line.slice(0,match.index),clause=match[0];
   const opposing=/(?:its|their|that creature.s|that permanent.s) controllers?\s+(?:may\s+)?$|(?:target|an?|each|that|the) opponents?\s+(?:may\s+)?$|(?:that player|they)\s+(?:may\s+)?$/i.test(prefix)||/under (?:target|an?|that|the) opponent.s control/i.test(clause);
   if(opposing){opponentOnly=true;continue;}
   const creature=/creature tokens?|tokens?[^.]*cop(?:y|ies) of[^.]*creature|tokens?[^.]*that.s a copy of[^.]*creature/i.test(clause);
   if(!creature&&!/Treasure|Food|Clue|Blood|Map|Powerstone|Incubator|Junk|artifact tokens?/i.test(clause))continue;
   const ultimate=/^[−-][4-9]\s*:/i.test(line.trim());ultimateOnly ||= ultimate;
   if(ultimate)continue;
   ownCreature ||= creature;ownResource ||= !creature;creationLines.push(line);
   repeatable ||= /whenever|at the beginning/i.test(line)||(/^\s*•/.test(line)&&/whenever|at the beginning/i.test(face.oracle_text||''))||/^[^:\n]+:/.test(line.trim());
   const many=/\b(?:two|three|four|five|six|seven|eight|nine|ten|\d{2,}|[2-9]|x|that many)\b[^.]{0,55}\btokens\b/i.test(clause);
   burst ||= many;scalable ||= /\b[xX]\b|for each|that many|equal to/i.test(clause);
   large ||= /\b(?:[3-9]|\d{2,}|X)\/(?:[3-9]|\d{2,}|X)\b/.test(clause);
   tokenHaste ||= creature&&/\bhaste\b/i.test(clause);
   const gates=[...prefix.matchAll(/If X is (\d+) or more/gi)];if(gates.length)productionMana=Math.max(productionMana,(card.cmc||0)+Number(gates[gates.length-1][1]));
   conditional ||= /if|whenever[^.]*deals combat damage|sacrifice|as an additional cost|only if/i.test(line);
   if(face!==faces[0]&&face.mana_cost){const value=[...face.mana_cost.matchAll(/\{([^}]+)\}/g)].reduce((n,m)=>n+(/^\d+$/.test(m[1])?Number(m[1]):1),0);productionMana=Math.max(productionMana,value);}
  }
 }
 if(/\binvestigate\b/i.test(text))ownResource=true;
 const selfSacrifice=creationLines.length>0&&creationLines.every(line=>/^[^:]*sacrifice this (?:artifact|creature|permanent)[^:]*:/i.test(line));
 if(selfSacrifice||creationLines.every(line=>/^\s*Exhaust\s*[—-]/i.test(line)))repeatable=false;
 const teamHaste=(!/(?:equipped|enchanted|nontoken) creatures (?:you control )?(?:have|gain)/i.test(text))&&(/(?:creatures|creature tokens) you control (?:have|gain)[^.\n]*haste|(?:other|all) creatures (?:you control )?(?:have|gain)[^.\n]*haste/i.test(text)||(!/nontoken/i.test(text)&&/whenever[^.\n]*creature[^.\n]*enters[^.\n]*(?:gains?|has) haste/i.test(text)));
 const teamPump=/(?:creatures|creature tokens) you control (?:get|gain)[^.\n]*(?:\+\d+\/\+\d+|\+X\/\+X|double strike|trample)/i.test(text)||/put (?:a|one|two|three|\d+) \+1\/\+1 counters? on each (?:creature|creature token) you control/i.test(text);
 const tokenMultiplier=/if[^.\n]*would[^.\n]*(?:creat|token)[^.\n]*(?:twice|instead|plus|additional)|populate/i.test(text);
 const requiresSetup=/when (?:this (?:creature|permanent)) dies|remove[^.\n]*counters? from (?:each|two|three)|put a card exiled with[^.\n]*graveyard/i.test(text);
 const reliableCreatureMaker=ownCreature&&!requiresSetup&&productionMana<=7;
 const temporary=creationLines.some(line=>/exile (?:it|them|those tokens|that token)|sacrifice (?:it|them|those tokens|that token)/i.test(line+' '+text)&&/at (?:the beginning of )?(?:the )?(?:next )?end (?:step|of combat)|at end of combat/i.test(text));
 const lastingCreatureMaker=ownCreature&&!temporary;
 // Repetition must be inherent to a permanent, not flashback/recast, death, targeting, combat damage or a scarce resource gate.
 const permanent=/Creature|Artifact|Enchantment|Planeswalker/.test(faces[0]?.type_line||card.type_line||'');
 const fragileGate=requiresSetup||/whenever[^.\n]*(?:dies|die|deals?[^.\n]*damage|becomes? the target)|whenever you (?:cast|sacrifice)|remove[^:]*counter|exile[^:]*from your graveyard|tap[^:]*untapped (?:artifact|creature)|activate only if|roll|flip|coin|if you control[^.\n]*(?:or more|modified)/i.test(creationLines.join(' '));
 const engineLines=creationLines.filter(originalLine=>{
  const line=originalLine.replace(/"[^"]*"/g,'');
  const inherited=/^\s*•/.test(line)?text.split(line)[0].split('\n').slice(-2).join(' '):'';
  const trigger=line+' '+inherited;
  const repeating=/whenever[^.\n]*(?:land[^.\n]*enters|you attack|this (?:creature|permanent) attacks|enters or attacks)|at the beginning of (?:your|each)[^.\n]*(?:upkeep|end step|combat)|^[^:\n]+:/i.test(trigger);
  const gated=/sacrifice|exile[^:]*:|remove[^:]*counter|discard|devotion|if[^.\n]*(?:seven|five|or more)|number of Bobbleheads|tap X untapped|dealt damage|becomes the target|combat damage|Grandeur|Exhaust|^[−-]\d|activate only if/i.test(trigger);
  return repeating&&!gated;
 });
 const lastingEngine=lastingCreatureMaker&&permanent&&engineLines.length>0&&!fragileGate&&productionMana<=6&&!/Saga/.test(faces[0]?.type_line||card.type_line||'');
 const recurringUntap=permanent&&/untap (?:all (?:other )?(?:creatures|permanents)|all (?:creatures|permanents) you control|each (?:other )?creature you control)|untap[^.\n]*permanents you control/i.test(text)&&/during each other player|during each opponent|at the beginning|whenever|^[^:\n]+:/im.test(text)&&!/untap[^.\n]*(?:opponent|defending player)[^.\n]*controls/i.test(text);
 const otherTurnUntap=recurringUntap&&/during each other player's untap step|during each opponent.s untap step/i.test(text);
 const massUntap=/untap all (?:creatures|permanents) you control|untap each creature you control/i.test(text);
 const untapSupport=recurringUntap||massUntap;
 const popularity=Math.max(0,18-Math.log2(Math.max(1,card.edhrec_rank||200000)));
 const landfallEngine=lastingEngine&&/landfall|whenever a land[^.\n]*enters/i.test(engineLines.join(' '));
 const automaticEngine=lastingEngine&&/at the beginning|whenever you attack|enters or attacks/i.test(engineLines.join(' '));
 const engineScore=(lastingEngine?100+(landfallEngine?45:automaticEngine?25:0):lastingCreatureMaker?15:temporary?-100:0)+(otherTurnUntap?200:recurringUntap?100:massUntap?55:0)+popularity*4;
 const score=(ownCreature?70:ownResource?12:0)+(repeatable?24:0)+(burst?12:0)+(scalable?8:0)+(large?8:0)+(tokenHaste?12:0)-(conditional?6:0)-Math.min(productionMana,12)*3;
 return{otherTurnUntap,engineLines,landfallEngine,automaticEngine,temporary,lastingCreatureMaker,lastingEngine,recurringUntap,massUntap,untapSupport,engineScore,ownCreature,reliableCreatureMaker,requiresSetup,ownResource,repeatable,burst,scalable,large,opponentOnly,conditional,ultimateOnly,tokenHaste,teamHaste,teamPump,tokenMultiplier,productionMana,score,creationLines};
}
export const lastingTokenQueries=[
 '(t:creature or t:enchantment or t:artifact) o:create o:token (o:landfall or o:"land enters" or o:"land you control enters")',
 '(t:creature or t:enchantment or t:artifact) o:create o:token (o:upkeep or o:"end step" or o:"beginning of combat") mv<=6',
 '(t:creature or t:enchantment or t:artifact) o:create o:token o:":" mv<=5',
 'o:untap (o:"permanents you control" or o:"creatures you control" or o:"all creatures")',
 'o:"creatures you control" (o:"get +" or o:trample or o:"double strike")',
];
export const tokenPlanQueries=[
 '(t:creature or t:artifact or t:enchantment) o:create o:token (o:whenever or o:"at the beginning") mv<=5',
 '(t:creature or t:artifact or t:enchantment) o:create o:"creature token" mv<=4',
 '(t:instant or t:sorcery) o:create o:"creature token" (o:two or o:three or o:X or o:"for each")',
 'o:create o:"creature token" mv>=5 mv<=8',
 'o:"creatures you control" o:haste',
 '(o:"creature tokens" o:haste) or (o:"Whenever" o:"creature" o:enters o:haste)',
 '(o:"creatures you control" (o:"get +" or o:"double strike" or o:trample)) or (o:token o:"twice")',
];
export function productionAudit(entries:{card:Card;qty:number;board:string}[]){const cards=entries.filter(e=>e.board==='mainboard'&&!/\bLand\b/.test(e.card.card_faces?.[0]?.type_line||e.card.type_line||''));const count=(test:(p:ReturnType<typeof tokenProductionProfile>)=>boolean)=>cards.reduce((n,e)=>n+(test(tokenProductionProfile(e.card))?e.qty:0),0);return{lastingCreatureTokenMakers:count(p=>p.lastingCreatureMaker),lastingTokenEngines:count(p=>p.lastingEngine),temporaryCreatureTokenMakers:count(p=>p.ownCreature&&p.temporary),recurringUntapSources:count(p=>p.recurringUntap),massUntapSources:count(p=>p.massUntap),ownCreatureTokenMakers:count(p=>p.ownCreature),reliableOwnCreatureTokenMakers:count(p=>p.reliableCreatureMaker),recurringCapableCreatureMakers:count(p=>p.reliableCreatureMaker&&p.repeatable),burstOrScalableCreatureMakers:count(p=>p.ownCreature&&(p.burst||p.scalable)),resourceOnlyTokenMakers:count(p=>p.ownResource&&!p.ownCreature),teamHasteSources:count(p=>p.teamHaste),hastyTokenMakers:count(p=>p.ownCreature&&p.tokenHaste),teamPumpOrTokenMultipliers:count(p=>p.teamPump||p.tokenMultiplier),largeCreatureTokenMakers:count(p=>p.ownCreature&&p.large)};}
