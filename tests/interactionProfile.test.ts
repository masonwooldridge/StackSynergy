import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import type { Card } from "../shared/model";
import { interactionProfile } from "../shared/interactionProfile";
import { constructionRoles } from "../shared/constructionPlan";
import { discussionCardFacts } from "../shared/discussionGrounding";
import { mechanicalPrerequisites } from "../shared/mechanicalSupport";
const facts = JSON.parse(
  readFileSync(
    new URL("./fixtures/interactionCards.json", import.meta.url),
    "utf8",
  ),
) as Card[];
const fact = (name: string) => {
  const c = facts.find((c) => c.name === name);
  if (!c) throw Error(name);
  return c;
};
const c = (name: string, text: string, type = "Instant"): Card => ({
  id: crypto.randomUUID(),
  oracle_id: crypto.randomUUID(),
  name,
  type_line: type,
  oracle_text: text,
  cmc: 1,
  mana_cost: "{U}",
});
const commander = c(
  "Spells leader",
  "Whenever you cast an instant or sorcery spell, create a 2/2 blue Drake creature token.",
  "Legendary Creature",
);
it("describes Repeal as value-limited variable-payment tempo while preserving its printed value", () => {
  const card = fact("Repeal"),
    p = interactionProfile(card);
  expect(p.primary).toBe(true);
  expect(p.effects[0]).toMatchObject({
    kind: "bounce",
    breadth: "value-limited",
    duration: "hand",
    route: "spell",
  });
  expect(p.notes.join(" ")).toContain("tempo, not permanent removal");
  expect(p.notes.join(" ")).toContain("chosen X");
  expect(card.cmc).toBe(1);
  expect(constructionRoles(card, commander)).toContain("interaction");
});
it("distinguishes Retraction Helix granting an ability from immediate bounce without banning its spell synergies", () => {
  const card = fact("Retraction Helix"),
    p = interactionProfile(card, [commander]);
  expect(p.primary).toBe(false);
  expect(p.effects[0]).toMatchObject({ route: "granted", duration: "hand" });
  expect(p.notes.join(" ")).toContain("1 distinct creature/token sources");
  expect(p.notes.join(" ")).toContain("summoning-sickness");
  expect(mechanicalPrerequisites(card, [commander])).toEqual([]);
  expect(constructionRoles(card, commander, [commander])).not.toContain(
    "interaction",
  );
  const direct = c("Bounce", "Return target creature to its owner's hand.");
  expect(interactionProfile(direct).primary).toBe(true);
  const activated = c(
    "Artifact bounce",
    "{U}, Sacrifice this artifact: Return target creature to its owner's hand.",
    "Artifact",
  );
  expect(interactionProfile(activated).effects[0]).toMatchObject({
    route: "activated",
    primary: true,
  });
});
it("retains efficient exact-value and type-limited counters with honest breadth", () => {
  expect(interactionProfile(fact("Spell Snare")).effects[0]).toMatchObject({
    kind: "counter",
    breadth: "value-limited",
    duration: "stack-answer",
    primary: true,
  });
  expect(constructionRoles(fact("Spell Snare"), commander)).toContain(
    "interaction",
  );
  expect(interactionProfile(fact("Counterspell")).effects[0].breadth).toBe(
    "general",
  );
  expect(interactionProfile(fact("Negate")).effects[0]).toMatchObject({
    breadth: "type-limited",
    primary: true,
  });
});
it("separates the restricted normal Wash Away from its broader alternative cleave cost", () => {
  const card = fact("Wash Away"),
    p = interactionProfile(card);
  expect(p.effects).toHaveLength(2);
  expect(p.effects[0].breadth).toBe("conditional");
  expect(p.effects[0].alternativeCost).toBeUndefined();
  expect(p.effects[1]).toMatchObject({
    breadth: "general",
    alternativeCost: "{1}{U}{U}",
  });
  expect(p.notes.join(" ")).toContain("replaces the normal casting cost");
  expect(card.cmc).toBe(1);
});
it("distinguishes suspend, linked exile, ordinary exile and blink", () => {
  const suspend = interactionProfile(fact("Suspend"));
  expect(suspend.effects[0]).toMatchObject({
    duration: "temporary-exile",
    primary: true,
  });
  expect(suspend.notes.join(" ")).toContain("may be cast later");
  expect(
    interactionProfile(fact("Swords to Plowshares")).effects[0].duration,
  ).toBe("exile");
  expect(
    interactionProfile(
      c(
        "Linked exile fixture",
        "When this enchantment enters, exile target nonland permanent an opponent controls until this enchantment leaves the battlefield.",
        "Enchantment",
      ),
    ).effects[0],
  ).toMatchObject({
    duration: "linked-exile",
    primary: true,
  });
  const blink = c(
    "Blink",
    "Exile target nonland permanent, then return it to the battlefield tapped under its owner's control.",
  );
  expect(interactionProfile(blink).effects[0]).toMatchObject({
    duration: "blink",
    primary: false,
  });
  expect(constructionRoles(blink, commander)).not.toContain("interaction");
});
it("evaluates modal answers independently so a blink mode does not erase a separate real answer", () => {
  const modal = c(
    "Modal",
    "Choose one —\n• Exile target creature, then return it to the battlefield.\n• Counter target spell.",
  );
  expect(interactionProfile(modal).effects.map((e) => e.primary)).toEqual([
    false,
    true,
  ]);
  expect(constructionRoles(modal, commander)).toContain("interaction");
  const spree = c(
    "Modes",
    "Spree\n+ {3} — Create a token.\n+ {1}{U} — Counter target spell.",
  );
  expect(interactionProfile(spree).effects[0].additionalModeCost).toBe(
    "{1}{U}",
  );
});
it("shares the same capabilities with grounded discussion and construction without treating every answer as permanent removal", () => {
  for (const card of facts) {
    const p = interactionProfile(card);
    expect(discussionCardFacts(card).interaction).toEqual(p);
    expect(constructionRoles(card, commander).includes("interaction")).toBe(
      p.primary,
    );
  }
});
it("keeps previous conditional-answer boundaries and does not mistake reminder abilities for immediate interaction", () => {
  for (const text of [
    "Counter target spell if it was kicked.",
    "Counter target spell that targets a player.",
    "Return target creature you control to its owner's hand.",
    "Exile target creature card from a graveyard.",
  ])
    expect(interactionProfile(c("Utility", text)).primary).toBe(false);
  expect(
    interactionProfile(
      c(
        "Reminder",
        "Create a Clue token. (It's an artifact with \"{2}, Sacrifice this artifact: Return target creature to its owner's hand.\")",
      ),
    ).present,
  ).toBe(false);
});

it("includes shared capabilities in answer requests and named discussion without turning rejections into new recommendations", async () => {
  const { discussionGrounding } = await import("../shared/discussionGrounding");
  const { parseAIRequest } = await import("../shared/aiConstraints");
  const goal =
    "Explain Repeal, Retraction Helix, Spell Snare, Wash Away and Suspend. No edits.";
  const request = parseAIRequest([{ role: "user", content: goal }]);
  const g = discussionGrounding(facts, undefined, request, goal, ["repeal"]);
  for (const name of [
    "Repeal",
    "Retraction Helix",
    "Spell Snare",
    "Wash Away",
    "Suspend",
  ])
    expect(g.evidence.find((c) => c.name === name)?.interaction).toEqual(
      interactionProfile(fact(name)),
    );
  expect(g.newOptionDiscussionIds).not.toContain(fact("Repeal").id);
  const general = discussionGrounding(
    facts,
    undefined,
    request,
    "Compare interaction and removal options.",
  );
  expect(general.evidence.length).toBeGreaterThan(0);
});

it("keeps own exile and color-restricted answers out of primary coverage and prices the eligible opposing-target ability", async () => {
  const { deploymentCost } = await import("../shared/deploymentCost");
  expect(interactionProfile(fact("Synod Sanctum")).primary).toBe(false);
  for (const name of ["Gideon's Defeat", "Infernal Reckoning"])
    expect(interactionProfile(fact(name))).toMatchObject({
      primary: false,
      effects: [expect.objectContaining({ breadth: "conditional" })],
    });
  const p = interactionProfile(fact("Helvault"));
  expect(p.effects.map((e) => e.primary)).toEqual([false, true]);
  expect(p.effects[1]).toMatchObject({
    activationCost: "{7}, {T}",
    duration: "linked-exile",
  });
  expect(deploymentCost(fact("Helvault"), "interaction").activationMana).toBe(
    7,
  );
  expect(p.notes.join(" ")).toContain("linked return condition");
});

it("keeps alternative-cost flags consistent with the shared cleave route", async () => {
  const { deploymentCost } = await import("../shared/deploymentCost");
  const card = fact("Wash Away");
  expect(interactionProfile(card).alternativeCosts).toEqual([
    { kind: "cleave", cost: "{1}{U}{U}" },
  ]);
  expect(deploymentCost(card).alternative).toBe(true);
  expect(deploymentCost(card).printedManaValue).toBe(1);
});
