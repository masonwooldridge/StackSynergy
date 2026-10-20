import type {Card} from './model';
import {strategyTags,matchingTags} from './strategyTags';
import {cardText} from './recommendations';
export interface StrategySelection {tags:string[];creatureTypes:string[];labels:string[]}
const strings=(value:unknown,max:number)=>Array.isArray(value)?[...new Set(value.filter((v):v is string=>typeof v==='string').map(v=>v.trim().slice(0,60)).filter(Boolean))].slice(0,max):[];
export function normalizeSelection(value:unknown):StrategySelection{const v=value&&typeof value==='object'?value as Record<string,unknown>:{};const tags=strings(v.tags,12),known=new Set(strategyTags.map(t=>t.id));return{tags:tags.filter(t=>known.has(t)).slice(0,3),creatureTypes:strings(v.creatureTypes,2),labels:strings([...(Array.isArray(v.labels)?v.labels:[]),...tags.filter(t=>!known.has(t))],12)}}
export function typeMatches(card:Card,type:string){const text=[card.type_line,...(card.card_faces||[]).map(f=>f.type_line),cardText(card)].filter(Boolean).join('\n');const escaped=type.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp('\\b'+escaped+'s?\\b','i').test(text)||/\bchangeling\b/i.test(cardText(card));}
export function selectionMatches(card:Card,selection:StrategySelection){return [...matchingTags(card,selection.tags).map(t=>t.label),...selection.creatureTypes.filter(type=>typeMatches(card,type)).map(type=>type+' typal')];}
export function selectionQuery(selection:StrategySelection){const parts=[...strategyTags.filter(t=>selection.tags.includes(t.id)).map(t=>t.query),...selection.creatureTypes.map(t=>`(t:${JSON.stringify(t)} or o:${JSON.stringify(t)} or o:changeling)`)];return parts.length?'('+parts.join(' or ')+')':'';}
export function selectionSummary(selection:StrategySelection){return [...strategyTags.filter(t=>selection.tags.includes(t.id)).map(t=>t.label),...selection.creatureTypes.map(t=>t+' typal')].join(' + ')||'Commander mechanics';}
