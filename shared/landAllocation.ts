import type {Card} from './model';
export const frontFaceType=(card:Card)=>card.card_faces?.[0]?.type_line??card.type_line?.split(' // ')[0]??'';
export function landAllocation(card:Card):'front'|'modal'|'conditional'|'none' {
 if(/\bLand\b/.test(frontFaceType(card)))return 'front';
 const back=card.card_faces?.slice(1).some(face=>/\bLand\b/.test(face.type_line||''))??/\bLand\b/.test(card.type_line?.split(' // ').slice(1).join(' ')||'');
 return back?(card.layout==='modal_dfc'?'modal':'conditional'):'none';
}
export const isLandSlot=(card:Card)=>['front','modal'].includes(landAllocation(card));
// Only a playable land face supplies unconditional land-slot mana. Do not use
// aggregate produced_mana from a conditional back or from the spell face.
export function playableLandFace(card:Card):Card|null {
 const kind=landAllocation(card);if(kind!=='front'&&kind!=='modal')return null;
 const face=kind==='front'?card.card_faces?.[0]:card.card_faces?.slice(1).find(f=>/\bLand\b/.test(f.type_line||''));
 return face?{...card,...face,type_line:face.type_line,oracle_text:face.oracle_text,produced_mana:undefined,card_faces:undefined}:card;
}
