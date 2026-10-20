import type {Card} from './model';
// Small, manually reviewed public recommendation sample; no live scraping,
// popularity percentage, deck-list copy or learned model weight.
export const evidenceReviewedAt='2026-10-19';
export const commanderEvidence=[
 {commander:'Satya, Aetherflux Genius',slug:'satya-aetherflux-genius',theme:'Energy / creature enters / copies',cards:['Izzet Generatorium','Decoction Module','Guide of Souls','Roil Cartographer','Lightning Runner','Whirler Virtuoso','Solemn Simulacrum','Glimmer of Genius']},
 {commander:'Krenko, Mob Boss',slug:'krenko-mob-boss',theme:'Goblins / token fuel / haste / damage payoffs',cards:['Goblin Warchief','Skirk Prospector','Impact Tremors','Goblin Matron','Goblin Chieftain','Goblin Bombardment','Pashalik Mons','Siege-Gang Commander']},
 {commander:'Muldrotha, the Gravetide',slug:'muldrotha-the-gravetide',theme:'Self-mill / sacrifice / reusable permanents',cards:['Spore Frog','Sakura-Tribe Elder','Eternal Witness','Seal of Primordium',"Kaya's Ghostform",'Gravebreaker Lamia',"Stitcher's Supplier",'Haywire Mite']},
 {commander:'Talrand, Sky Summoner',slug:'talrand-sky-summoner',theme:'Cheap spells / selection / spell-trigger engines',cards:['Counterspell','Opt','Negate','Brainstorm','Preordain','Ponder','Frantic Search','Archmage Emeritus']},
];
export const evidenceFor=(commanders:Card[])=>commanderEvidence.find(p=>commanders.length===1&&commanders[0].name===p.commander);
export const evidenceUrl=(slug:string)=>'https://edhrec.com/commanders/'+slug;
