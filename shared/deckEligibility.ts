import type {Card} from './model';
export function isMainDeckCard(card:Card){const type=card.type_line||'';return !/\b(?:Attraction|Stickers?|Contraption|Scheme|Plane|Phenomenon|Vanguard|Conspiracy)\b/i.test(type)&&!(card.layout&&['token','double_faced_token','emblem','art_series','vanguard','planar','scheme'].includes(card.layout))&&(!card.games||card.games.includes('paper'));}
