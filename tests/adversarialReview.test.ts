import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import type { Card } from "../shared/model";
import {
  landManaProfile,
  landManaSources,
  basicManaTargets,
} from "../shared/basicMana";
const cards = JSON.parse(
  readFileSync(
    new URL("./fixtures/adversarialLands.json", import.meta.url),
    "utf8",
  ),
) as Card[];
const c = (name: string) => {
  const card = cards.find((c) => c.name === name);
  if (!card) throw Error(name);
  return card;
};
it("does not credit conditional Gate, legend, opposing-land or retention-dependent colors from provider produced_mana", () => {
  for (const name of ["Gond Gate", "The Grey Havens"]) {
    expect(landManaSources(c(name), ["W", "R", "G"])).toEqual(["C"]);
    expect(
      landManaProfile(c(name), ["W", "R", "G"]).conditionalSources.length,
    ).toBeGreaterThan(0);
  }
  for (const name of ["Exotic Orchard", "Glimmervoid"])
    expect(landManaSources(c(name), ["W", "R", "G"])).toEqual([]);
});
it("retains unrestricted commander-identity, painland, typed dual and tapped-land colors", () => {
  expect(landManaSources(c("Command Tower"), ["W", "R", "G"])).toEqual([
    "W",
    "R",
    "G",
  ]);
  expect(landManaSources(c("Brushland"), ["W", "G"]).sort()).toEqual([
    "C",
    "G",
    "W",
  ]);
  const typed = {
    id: "typed",
    name: "Typed dual fixture",
    type_line: "Land — Forest Plains",
    oracle_text: "This land enters tapped.",
  } as Card;
  expect(landManaSources(typed, ["W", "G"]).sort()).toEqual(["G", "W"]);
  expect(landManaProfile(typed, ["W", "G"]).entersTapped).toBe(true);
});
it("does not let a conditional colored land reduce a commander-only splash floor", () => {
  const leader = {
    id: "cmd",
    name: "Splash fixture",
    mana_cost: "{G}{U}",
    type_line: "Legendary Creature",
  } as Card;
  const green = {
    id: "g",
    name: "Green fixture",
    mana_cost: "{G}{G}",
    type_line: "Creature",
  } as Card;
  const t = basicManaTargets(
    [
      { card: leader, qty: 1 },
      { card: green, qty: 63 },
      { card: c("The Grey Havens"), qty: 1 },
    ],
    ["G", "U"],
    35,
    leader,
  );
  expect(t.U).toBeGreaterThanOrEqual(8);
  expect(t.G + t.U).toBe(35);
});
