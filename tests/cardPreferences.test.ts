import { expect, it } from "vitest";
import type { Card } from "../shared/model";
import {
  mechanicalPrerequisites,
  sharedTypeCastCount,
} from "../shared/mechanicalSupport";
import {
  messagePreferences,
  setCardPreference,
  preferenceFor,
  normalizePreferences,
} from "../shared/cardPreferences";
import { conversationIntent } from "../shared/aiConversationMemory";
const card = (name: string, type = "Creature — Nymph", text = ""): Card => ({
  id: crypto.randomUUID(),
  oracle_id: crypto.randomUUID(),
  name,
  type_line: type,
  oracle_text: text,
});
it("counts castable matching types, changelings and Kindred spells, not generated tokens or duplicate printings", () => {
  const leader = card("Commander", "Legendary Creature — Nymph Warrior"),
    engine = card(
      "Shared engine",
      "Legendary Enchantment — Background",
      'Commander creatures you own have "Whenever you cast a spell that shares a creature type with this creature, draw a card."',
    );
  const spells = [
    card("Nymph"),
    card("Warrior", "Creature — Human Warrior"),
    card("Kindred", "Kindred Instant — Nymph"),
    card(
      "Changeling",
      "Creature — Shapeshifter",
      "Changeling (This card is every creature type.)",
    ),
    card("Kindred changeling", "Kindred Sorcery — Shapeshifter", "Changeling"),
    card("Multitype", "Enchantment Creature — Nymph Dryad"),
  ];
  const tokenFactory = card(
    "Token factory",
    "Enchantment",
    "Create three Nymph creature tokens.",
  );
  expect(
    sharedTypeCastCount(
      [leader],
      [
        ...spells,
        tokenFactory,
        { ...spells[0], id: crypto.randomUUID() },
        leader,
      ],
    ),
  ).toBe(6);
  expect(mechanicalPrerequisites(engine, spells, [leader])).toEqual([]);
  expect(
    mechanicalPrerequisites(
      engine,
      [...spells.slice(0, 5), tokenFactory],
      [leader],
    ).join(),
  ).toContain("5 selected");
  expect(
    sharedTypeCastCount(
      [card("Front // Back", "Creature — Human", "")],
      [
        {
          ...card("Back-only", "Creature — Elf"),
          card_faces: [
            { name: "Front", type_line: "Creature — Elf" },
            { name: "Back", type_line: "Creature — Human" },
          ],
        },
      ],
    ),
  ).toBe(0);
});
it("keeps rejection stable across printings, discussion and explicit reversal", () => {
  const a = card("A real card"),
    alt = { ...a, id: crypto.randomUUID() };
  let prefs = setCardPreference([], a, "rejected");
  expect(preferenceFor(prefs, alt)?.state).toBe("rejected");
  expect(messagePreferences(prefs, "Why A real card?", [alt])).toEqual(prefs);
  prefs = messagePreferences(prefs, "Reconsider A real card.", [alt]);
  expect(preferenceFor(prefs, a)?.state).toBe("allowed");
  prefs = messagePreferences(prefs, "No thanks.", [alt], [alt]);
  expect(preferenceFor(prefs, a)?.state).toBe("rejected");
  expect(normalizePreferences(JSON.parse(JSON.stringify(prefs)))).toEqual(
    prefs,
  );
});
it("keeps suggested identities separate from deck membership and does not erase history implicitly", () => {
  const a = card("Candidate");
  const prefs = setCardPreference([], a, "suggested");
  const allowed = setCardPreference(prefs, a, "allowed");
  expect(allowed).toHaveLength(1);
  expect(allowed[0].name).toBe("Candidate");
  expect(prefs[0].state).toBe("suggested");
  const full = Array.from({ length: 200 }, (_, i) => ({
    ...prefs[0],
    cardId: crypto.randomUUID(),
    oracleId: crypto.randomUUID(),
    name: "Card " + i,
  }));
  expect(() => setCardPreference(full, card("New"), "rejected")).toThrow(
    "nothing was forgotten",
  );
  expect(full).toHaveLength(200);
});
it("requires explicit reconsideration rather than treating a question as permission", () => {
  const a = card("Entry card"),
    turns = [
      { role: "user" as const, content: "Avoid Entry card." },
      { role: "assistant" as const, content: "Understood." },
      { role: "user" as const, content: "Why Entry card?" },
    ];
  expect(conversationIntent(turns, [a]).rejected).toContain("entry card");
  expect(
    conversationIntent([{ role: "user", content: "Why not Entry card?" }], [a])
      .rejected,
  ).toEqual([]);
});

it("migrates legacy structured transcript choices without leaking scope or forgetting explicit reversal", async () => {
  const { migrateCardPreferences, cardPreferenceStorageKey } =
    await import("../shared/cardPreferences");
  const a = card("Old candidate"),
    installed = card("Installed");
  const turns = [
    { role: "assistant", content: "Consider this.", cards: [a, installed] },
    { role: "user", content: "Avoid Old candidate." },
    { role: "assistant", content: "Understood." },
  ];
  expect(
    migrateCardPreferences(turns, [a, installed], [installed]),
  ).toHaveLength(1);
  expect(
    migrateCardPreferences(turns, [a, installed], [installed])[0].state,
  ).toBe("rejected");
  expect(
    migrateCardPreferences(
      [...turns, { role: "user", content: "Reconsider Old candidate." }],
      [a, installed],
      [installed],
    )[0].state,
  ).toBe("allowed");
  expect(cardPreferenceStorageKey("a", "account", "deck")).not.toBe(
    cardPreferenceStorageKey("b", "account", "deck"),
  );
  expect(cardPreferenceStorageKey("a", "guest", "deck")).not.toBe(
    cardPreferenceStorageKey("a", "account", "deck"),
  );
  expect(cardPreferenceStorageKey("a", "account", "deck")).not.toBe(
    cardPreferenceStorageKey("a", "account", "other"),
  );
});
it('scopes mixed rejection and protection to named clauses rather than rejecting every named card',()=>{
 const a=card('Parallel Lives'),b=card('Seedborn Muse'),namedComma=card('Baylen, the Haymaker');
 let p=messagePreferences([],'Avoid Parallel Lives, but keep Seedborn Muse. Protect Baylen, the Haymaker.',[a,b,namedComma]);
 expect(preferenceFor(p,a)?.state).toBe('rejected');expect(preferenceFor(p,b)?.state).toBe('allowed');expect(preferenceFor(p,namedComma)?.state).toBe('allowed');
 p=messagePreferences(p,'No thanks. Reconsider Parallel Lives.',[a,b],[a,b]);expect(preferenceFor(p,a)?.state).toBe('allowed');expect(preferenceFor(p,b)?.state).toBe('rejected');
});
it('does not turn strategy critiques or card-name substrings into blanket rejections',()=>{
 const a=card('Opt'),b=card('Seedborn Muse');expect(messagePreferences([],'Avoid extra draw; focus on untapping.',[a,b],[a,b])).toEqual([]);expect(messagePreferences([],'Avoid expensive options.',[a,b],[a,b])).toEqual([]);
 expect(preferenceFor(messagePreferences([],'Do not recommend Opt.',[a,b]),a)?.state).toBe('rejected');expect(preferenceFor(messagePreferences(setCardPreference([],b,'rejected'),"Don't reject Seedborn Muse.",[a,b]),b)?.state).toBe('allowed');
});
it('shares clause-aware legacy transcript exclusions and literal punctuation matching',()=>{
 const a=card('Parallel Lives'),b=card('Seedborn Muse'),special=card('Plan A+B (test)'),opt=card('Opt');const mixed=conversationIntent([{role:'user',content:'Avoid Parallel Lives, but keep Seedborn Muse.'},{role:'assistant',content:'Understood.'},{role:'user',content:'Explain the same plan.'}],[a,b]);expect(mixed.rejected).toContain('parallel lives');expect(mixed.rejected).not.toContain('seedborn muse');
 expect(messagePreferences([],'Reject Plan A+B (test).',[special])[0]?.cardId).toBe(special.id);expect(messagePreferences([],'Why avoid Seedborn Muse?',[b])).toEqual([]);expect(conversationIntent([{role:'assistant',content:'Some inexpensive options.'},{role:'user',content:'Other options'}],[opt]).exclude.has('opt')).toBe(false);
});

it('keeps subsequent alternatives distinct after a historical reconsideration and scopes a direct not-card clause',()=>{
 const a=card('Option A'),b=card('Option B');expect(preferenceFor(messagePreferences([],'Keep Option A, not Option B.',[a,b]),b)?.state).toBe('rejected');
 const intent=conversationIntent([{role:'user',content:'Reconsider Option A.'},{role:'assistant',content:'Try Option A.'},{role:'user',content:'Other options'}],[a,b]);expect(intent.exclude.has('option a')).toBe(true);
});
