import { expect, it } from "vitest";
import { constructionRoles } from "../shared/constructionPlan";
import { readFileSync } from "node:fs";
import type { Card } from "../shared/model";
import { strategicProfile, rampSequence } from "../shared/strategicQuality";
const facts = JSON.parse(
  readFileSync(
    new URL("./fixtures/strategicCards.json", import.meta.url),
    "utf8",
  ),
).cards as Card[];
const card = (name: string) => {
  const c = facts.find((c) => c.name === name);
  if (!c) throw Error("Missing cached canonical card " + name);
  return c;
};
// Minimal synthetic commander for rule-interaction checks; not a live model test.
const commander = {
  id: "qa",
  name: "QA copy commander",
  type_line: "Legendary Creature",
  cmc: 4,
  oracle_text:
    "Whenever this attacks, create a token copy of another target creature you control. That token enters tapped and attacking.",
} as Card;
it("includes cast and first equip cost and the target-copy shroud conflict", () => {
  const cloak = strategicProfile(card("Whispersilk Cloak"), commander, 4);
  expect(cloak.firstDeploymentMana).toBe(5);
  expect(constructionRoles(card("Whispersilk Cloak"), commander)).toContain(
    "protection",
  );
  expect(cloak.adjustment).toBeLessThan(
    strategicProfile(card("Dolmen Gate"), commander, 4).adjustment,
  );
  expect(cloak.notes.join(" ")).toContain("Shroud");
});
it("discounts entry cantrip filler for a fast target but never bans the card", () => {
  expect(
    strategicProfile(card("Inspiring Overseer"), commander, 4).adjustment,
  ).toBeLessThan(
    strategicProfile(card("Mulldrifter"), commander, 4, true).adjustment,
  );
  expect(
    strategicProfile(card("Inspiring Overseer"), commander, 3).adjustment,
  ).toBe(0);
});
it("separates combat-damage from attack/exert trigger requirements for entering-attacking copies", () => {
  const razer = strategicProfile(card("Port Razer"), commander, 4),
    celebrant = strategicProfile(card("Combat Celebrant"), commander, 4);
  expect(razer.combatDamageTrigger).toBe(true);
  expect(razer.notes.join(" ")).not.toContain("later declared attacks");
  expect(celebrant.notes.join(" ")).toContain("later declared attacks");
});
it("does not penalize explicitly requested higher-cost ramp for its casting cost", () => {
  expect(
    strategicProfile(card("Darksteel Ingot"), commander, 4, true).adjustment,
  ).toBeGreaterThan(
    strategicProfile(card("Darksteel Ingot"), commander, 4, false).adjustment,
  );
});
it("marks symmetrical risk without a named-card blacklist", () => {
  const synthetic = {
    ...card("Dolmen Gate"),
    name: "Synthetic symmetric evasion",
    oracle_text: "Creatures can't block.",
  };
  expect(strategicProfile(synthetic, commander, 4).symmetricExposure).toBe(
    true,
  );
  expect(strategicProfile(synthetic, commander, 4).adjustment).toBeLessThan(0);
});
it("recognizes early mana setup while preserving activation payment information", () => {
  expect(
    strategicProfile(card("Mind Stone"), commander, 4).notes.join(" "),
  ).toContain("Early untapped acceleration");
});

it("maps early ramp to the intended four-mana play under explicit assumptions", () => {
  expect(rampSequence(card("Mind Stone"), 4)?.rampTurn).toBe(3);
  expect(rampSequence(card("Darksteel Ingot"), 4)?.rampTurn).toBe(4);
});

it("offers combat-damage prevention as protection without calling it removal protection", () => {
  expect(constructionRoles(card("Dolmen Gate"), commander)).toContain(
    "protection",
  );
  expect(
    strategicProfile(card("Dolmen Gate"), commander, 4).notes.join(" "),
  ).toContain("does not stop removal");
});
