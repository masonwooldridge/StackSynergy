import type {Card} from './model';
/** Oracle legality does not establish a physical printing's tournament eligibility. */
export function reproductionReason(card: Card): string | null {
 const set = (card.set || '').toLowerCase();
 if (['30a','ced','cei'].includes(set) || /^wc\d{2}$/.test(set) || card.border_color === 'gold')
   return 'Collectible reproduction / non-tournament printing. Use only with explicit casual-group agreement; Oracle format legality does not make this printing tournament eligible.';
 return null;
}
export function isMainDeckCard(card:Card){const type=card.type_line||'';return !/\b(?:Attraction|Stickers?|Contraption|Scheme|Plane|Phenomenon|Vanguard|Conspiracy)\b/i.test(type)&&!(card.layout&&['token','double_faced_token','emblem','art_series','vanguard','planar','scheme'].includes(card.layout))&&(!card.games||card.games.includes('paper'));}
