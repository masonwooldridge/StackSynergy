import { expect, it } from "vitest";
import type { Card, Document } from "../shared/model";
import { newEntry } from "../shared/deckEditing";
import { commanderMechanic, filterSuggestions, ownedCopies, roleNames, roles, suggestionPrice, suggestionsFor } from "../shared/recommendations";
// Isolated rule fixtures, never shipped as provider/community data.
const commander: Card = { id: "qa-commander", name: "QA commander", oracle_text: "At the beginning of your end step, proliferate.", color_identity: ["G"], type_line: "Legendary Creature", legalities: { commander: "legal" } };
const card: Card = { id: "qa-card", oracle_id: "qa-oracle", name: "QA candidate", oracle_text: "Proliferate. Draw a card.", color_identity: ["G"], type_line: "Sorcery", legalities: { commander: "legal" }, prices: { usd: "2.50" }, finishes: ["nonfoil"] };
const deck: Document = { id: "deck", name: "QA deck", kind: "deck", format: "commander", notes: "", revision: 1, entries: [newEntry(commander, "commander")] };
const options = { role: "all" as const, strategy: "auto" as const, rules: true, owned: false, maxPrice: null };
it("detects actual commander mechanics without treating counterspells as counter synergy", () => {
  expect(commanderMechanic([commander])).toBe("counters");
  expect(commanderMechanic([{ ...commander, oracle_text: "Counter target spell." }])).toBeNull();
  expect(commanderMechanic([{ ...commander, oracle_text: "Create two Goblin creature tokens." }])).toBe("tokens");
  expect(commanderMechanic([{ ...commander, oracle_text: "Whenever you cast an instant or sorcery spell, draw a card." }])).toBe("spells");
});
it("provides mechanic-based reasons and every support category without fabricated metrics", () => {
  expect(Object.keys(roleNames)).toEqual([...roles]);
  const results = suggestionsFor([card], [commander], "auto");
  expect(results[0].reasons.map((reason) => reason.role)).toEqual(["synergy", "draw"]);
  expect(results[0]).not.toHaveProperty("synergyScore");expect(results[0]).not.toHaveProperty("inclusionRate");
  expect(suggestionsFor([{ ...card, oracle_text: "Counter target spell." }], [commander], "auto")[0].reasons.map((reason) => reason.role)).toEqual(["interaction"]);
});
it("filters color/format by default and allows explicit override", () => {
  const cards = [card, { ...card, id: "red", color_identity: ["R"] }, { ...card, id: "banned", legalities: { commander: "banned" } }];
  const candidates = suggestionsFor(cards, [commander], "auto");
  expect(filterSuggestions(candidates, deck, [], options).map((item) => item.card.id)).toEqual([card.id]);
  expect(filterSuggestions(candidates, deck, [], { ...options, rules: false })).toHaveLength(3);
});
it("budgets never interpret missing prices as zero and use the selected default finish", () => {
  const unknown = { ...card, id: "unknown", prices: { usd: null } };
  expect(suggestionPrice(unknown)).toBeNull();expect(suggestionPrice({ ...card, prices: { usd: "" } })).toBeNull();
  expect(suggestionPrice({ ...card, finishes: ["foil"], prices: { usd: null, usd_foil: "1.25" } })).toBe(1.25);
  const candidates = suggestionsFor([card, unknown], [commander], "auto");
  expect(filterSuggestions(candidates, deck, [], { ...options, maxPrice: 3 })).toHaveLength(1);
  expect(filterSuggestions(candidates, deck, [], { ...options, maxPrice: 1 })).toHaveLength(0);
});
it("owned filtering counts oracle copies across collection printings, excludes decks/lists and deleted binders", () => {
  const collection = { ...deck, id: "binder", kind: "collection" as const, entries: [{ ...newEntry({ ...card, id: "other-printing" }), qty: 2 }] };
  expect(ownedCopies(card, [deck, collection, { ...collection, deleted: true }])).toBe(2);
  expect(filterSuggestions(suggestionsFor([card], [commander], "auto"), deck, [collection], { ...options, owned: true })).toHaveLength(1);
  expect(filterSuggestions(suggestionsFor([card], [commander], "auto"), deck, [], { ...options, owned: true })).toHaveLength(0);
});
it("explicit strategy filters matching facts and categories while commander changes recompute reasons", () => {
  const token = { ...card, id: "token-card", oracle_text: "Create a 1/1 creature token. Draw a card." };
  const tokenCommander = { ...commander, oracle_text: "Create two Goblin creature tokens." };
  expect(suggestionsFor([token], [tokenCommander], "auto")[0].reasons[0].role).toBe("synergy");
  expect(suggestionsFor([token], [commander], "auto")[0].reasons[0].role).toBe("draw");
  expect(filterSuggestions(suggestionsFor([card, token], [commander], "tokens"), deck, [], { ...options, role: "draw", strategy: "tokens" })).toHaveLength(1);
});

it("does not label library exile or loss of opposing protection as battlefield support", () => {
  const libraryExile = { ...card, oracle_text: "Exile all other cards from your library." };
  expect(suggestionsFor([libraryExile], [commander], "auto")).toHaveLength(0);
  const removeProtection = { ...card, type_line: "Land", oracle_text: "Creatures your opponents control lose hexproof and shroud and cannot have hexproof or shroud.\n{T}: Add {C}." };
  expect(suggestionsFor([removeProtection], [commander], "auto")[0].reasons.map((reason) => reason.role)).toEqual(["mana"]);
  const boardWipe = { ...card, oracle_text: "Destroy all nonland permanents." };
  expect(suggestionsFor([boardWipe], [commander], "auto")[0].reasons.map((reason) => reason.role)).toEqual(["wipes"]);
});
it("recognizes rocks with written-out mana and positive protection grants", () => {
  const rock = { ...card, type_line: "Artifact", oracle_text: "{T}: Add one mana of any color in your commander's color identity." };
  expect(suggestionsFor([rock], [commander], "auto")[0].reasons.map((reason) => reason.role)).toEqual(["ramp"]);
  const protect = { ...card, oracle_text: "Permanents you control gain hexproof and indestructible until end of turn." };
  expect(suggestionsFor([protect], [commander], "auto")[0].reasons.map((reason) => reason.role)).toEqual(["protection"]);
});

it("does not confuse placement of counters on a target with countering a spell", () => {
  const support = { ...card, type_line: "Land", oracle_text: "Put a +1/+1 counter on each of up to two target creatures." };
  expect(suggestionsFor([support], [commander], "auto")[0].reasons.map((reason) => reason.role)).toEqual(["synergy", "mana"]);
  expect(suggestionsFor([{ ...card, oracle_text: "Counter target spell." }], [commander], "auto")[0].reasons.map((reason) => reason.role)).toEqual(["interaction"]);
});

it('does not count opposing Treasure, temporary mana, filtering or land-to-hand as reliable ramp',()=>{
 const texts=[['Instant',"Counter target spell. Its controller creates two Treasure tokens. (They have \"{T}, Sacrifice this token: Add one mana of any color.\")"],['Artifact','{2}, {T}, Sacrifice this artifact: Add two mana of different colors.'],['Creature','When this creature enters, add {R}.'],['Sorcery','Search your library for a basic land card, reveal it, put it into your hand, then shuffle.']];
 for(const [type_line,oracle_text] of texts)expect(suggestionsFor([{...card,type_line,oracle_text}],[commander],'auto').flatMap(r=>r.reasons.map(v=>v.role))).not.toContain('ramp');
 expect(suggestionsFor([{...card,oracle_text:'Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.'}],[commander],'auto')[0].reasons.map(r=>r.role)).toContain('ramp');
});

it('does not mistake zero-mana-value suspend or conditional counter/Dragon rocks for early reliable mana',()=>{
 for(const extra of [{mana_cost:'',oracle_text:'Suspend 3—{1}.\n{T}: Add one mana of any color.'},{oracle_text:'{T}: Add {C} for each charge counter on this artifact.'},{oracle_text:'{T}: Add {C}. Activate only if you control a Dragon.'},{oracle_text:'{T}: Add {C}. Activate only if this artifact has two or more oil counters.'}])expect(suggestionsFor([{...card,type_line:'Artifact',...extra}],[commander],'auto').flatMap(r=>r.reasons.map(v=>v.role))).not.toContain('ramp');
});
