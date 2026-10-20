import { describe, it, expect } from "vitest";
import { bottomRequired, soloAction, startSolo } from "../shared/solo";
import type { SoloAction, SoloState } from "../shared/solo";
import type { Card, Document, Entry } from "../shared/model";
const land: Card = {
  id: "land",
  name: "Fixture land",
  type_line: "Basic Land — Forest",
};
const commander: Card = {
  id: "commander",
  name: "Fixture commander",
  type_line: "Legendary Creature",
};
function row(
  card: Card,
  qty: number,
  board: Entry["board"] = "mainboard",
): Entry {
  return {
    id: crypto.randomUUID(),
    card,
    qty,
    board,
    language: "en",
    finish: "nonfoil",
    condition: "near_mint",
    notes: "",
    tags: "",
    purchasePrice: "",
  };
}
function deck(format = "modern"): Document {
  return {
    id: crypto.randomUUID(),
    name: "Test-only solo fixture",
    format,
    kind: "deck",
    revision: 1,
    notes: "",
    entries: [
      row(land, 59),
      row(commander, 1, format === "commander" ? "commander" : "mainboard"),
      row(land, 15, "sideboard"),
      row(land, 10, "maybeboard"),
    ],
  };
}
const play = (s: SoloState) => soloAction(s, { type: "keep", bottom: [] });
describe("solo playtest state", () => {
  it("starts with seven hidden-library copies, excludes other boards and preserves deck", () => {
    const d = deck("commander"),
      before = JSON.stringify(d),
      s = startSolo(d);
    expect(s.pieces).toHaveLength(60);
    expect(new Set(s.pieces.map((p) => p.id)).size).toBe(60);
    expect(s.pieces.filter((p) => p.zone === "hand")).toHaveLength(7);
    expect(s.pieces.filter((p) => p.zone === "command")).toHaveLength(1);
    expect(s.life).toBe(40);
    expect(JSON.stringify(d)).toBe(before);
    expect(() => soloAction(s, { type: "draw", count: 1 })).toThrow(/Keep/);
  });
  it("London mulligans require exact unique bottom choices and preserve chosen order", () => {
    let s = startSolo(deck());
    s = soloAction(s, { type: "mulligan" });
    s = soloAction(s, { type: "mulligan" });
    expect(bottomRequired(s)).toBe(2);
    const hand = s.pieces.filter((p) => p.zone === "hand");
    expect(() => soloAction(s, { type: "keep", bottom: [] })).toThrow();
    expect(() =>
      soloAction(s, { type: "keep", bottom: [hand[0].id, hand[0].id] }),
    ).toThrow();
    s = soloAction(s, { type: "keep", bottom: [hand[1].id, hand[0].id] });
    expect(s.pieces.filter((p) => p.zone === "hand")).toHaveLength(5);
    expect(
      s.pieces
        .filter((p) => p.zone === "library")
        .slice(-2)
        .map((p) => p.id),
    ).toEqual([hand[1].id, hand[0].id]);
    expect(() => soloAction(s, { type: "mulligan" })).toThrow();
  });
  it("supports an optional first free mulligan for multiplayer practice", () => {
    let s = startSolo(deck("commander"));
    s = soloAction(s, { type: "mulligan" });
    expect(bottomRequired(s)).toBe(0);
    s = soloAction(s, { type: "mulligan" });
    expect(bottomRequired(s)).toBe(1);
  });
  it("draws from library top, moves top/bottom deterministically and resets zone counters", () => {
    let s = play(startSolo(deck()));
    const id = s.pieces.find((p) => p.zone === "hand")!.id;
    s = soloAction(s, { type: "move", id, zone: "battlefield" });
    s = soloAction(s, { type: "tap", id });
    s = soloAction(s, { type: "counter", id, delta: 3 });
    s = soloAction(s, { type: "move", id, zone: "library", position: "top" });
    expect(s.pieces.find((p) => p.id === id)).toMatchObject({
      tapped: false,
      counters: 0,
      zone: "library",
    });
    s = soloAction(s, { type: "draw", count: 1 });
    expect(s.pieces.find((p) => p.id === id)?.zone).toBe("hand");
    s = soloAction(s, {
      type: "move",
      id,
      zone: "library",
      position: "bottom",
    });
    expect(s.pieces.filter((p) => p.zone === "library").at(-1)?.id).toBe(id);
    expect(s.pieces).toHaveLength(60);
  });
  it("untaps only battlefield cards, optionally draws and clears tracked mana", () => {
    let s = play(startSolo(deck()));
    const id = s.pieces.find((p) => p.zone === "hand")!.id;
    s = soloAction(s, { type: "move", id, zone: "battlefield" });
    s = soloAction(s, { type: "tap", id });
    s = soloAction(s, { type: "mana", color: "G", delta: 3 });
    const previous = s;
    const next = soloAction(s, { type: "nextTurn", draw: true });
    expect(next.turn).toBe(2);
    expect(next.pieces.find((p) => p.id === id)?.tapped).toBe(false);
    expect(next.pieces.filter((p) => p.zone === "hand")).toHaveLength(7);
    expect(next.mana.G).toBe(0);
    expect(previous.mana.G).toBe(3);
    expect(previous.pieces.find((p) => p.id === id)?.tapped).toBe(true);
  });
  it("tracks commander casts independently from generic moves", () => {
    let s = play(startSolo(deck("commander")));
    const id = s.pieces.find((p) => p.zone === "command")!.id;
    s = soloAction(s, { type: "cast", id });
    expect(s.casts[id]).toBe(1);
    expect(s.pieces.find((p) => p.id === id)?.zone).toBe("stack");
    s = soloAction(s, { type: "move", id, zone: "battlefield" });
    s = soloAction(s, { type: "move", id, zone: "command" });
    s = soloAction(s, { type: "cast", id });
    expect(s.casts[id]).toBe(2);
  });
  it("tokens cease to exist after leaving battlefield; life/poison/damage are immutable and bounded", () => {
    let s = play(startSolo(deck()));
    s = soloAction(s, { type: "token", name: "Soldier", stats: "1/1" });
    const token = s.pieces.find((p) => p.token)!;
    s = soloAction(s, { type: "move", id: token.id, zone: "hand" });
    expect(s.pieces.some((p) => p.token)).toBe(false);
    expect(s.pieces).toHaveLength(60);
    const before = s;
    for (const a of [
      { type: "life", delta: -23 },
      { type: "poison", delta: -1 },
      { type: "damage", delta: 5 },
    ] as SoloAction[])
      s = soloAction(s, a);
    expect(s.life).toBe(-3);
    expect(s.poison).toBe(0);
    expect(s.damage).toBe(5);
    expect(before.life).toBe(20);
  });
  it("never duplicates cards through shuffle, redraws or empty-library draws", () => {
    let s = startSolo(deck());
    const ids = new Set(s.pieces.map((p) => p.id));
    for (let i = 0; i < 4; i++) s = soloAction(s, { type: "mulligan" });
    const bottom = s.pieces
      .filter((p) => p.zone === "hand")
      .slice(0, 4)
      .map((p) => p.id);
    s = soloAction(s, { type: "keep", bottom });
    s = soloAction(s, { type: "shuffle" });
    s = soloAction(s, { type: "draw", count: 100 });
    expect(s.pieces.filter((p) => p.zone === "hand")).toHaveLength(60);
    expect(new Set(s.pieces.map((p) => p.id))).toEqual(ids);
    s = soloAction(s, { type: "draw", count: 1 });
    expect(s.log[0]).toBe("Drew 0 cards");
  });
  it("lands bypass the stack, while spells cast and resolve without changing the source deck", () => {
    const d = deck();
    let s = play(startSolo(d));
    const id = s.pieces.find((p) => p.zone === "hand" && p.card.type_line?.includes("Land"))!.id;
    expect(() => soloAction(s, { type: "cast", id })).toThrow(/lands/i);
    s.pieces = s.pieces.map((p) =>
      p.id === id
        ? {
            ...p,
            card: {
              id: "spell",
              name: "Fixture instant",
              type_line: "Instant",
            },
          }
        : p,
    );
    const previous = s;
    s = soloAction(s, { type: "cast", id });
    expect(s.pieces.find((p) => p.id === id)?.zone).toBe("stack");
    s = soloAction(s, { type: "move", id, zone: "graveyard" });
    expect(s.pieces.find((p) => p.id === id)?.zone).toBe("graveyard");
    expect(previous.pieces.find((p) => p.id === id)?.zone).toBe("hand");
    expect(d.entries[0].card).toEqual(land);
  });
});
