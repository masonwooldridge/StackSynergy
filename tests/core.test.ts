import { describe, it, expect } from "vitest";
import { validateDeck } from "../shared/model";
import type { Card, Document, Entry } from "../shared/model";
import { parseImport, exportCsv, exportDeck } from "../src/imports";
import { act, loadDeck, viewRoom } from "../server/game";
import type { Room } from "../server/game";
// Explicit test fixtures, never shipped to the application database.
const card = (name = "Forest", extra: Partial<Card> = {}): Card => ({
  id: crypto.randomUUID(),
  oracle_id: name,
  name,
  type_line: "Basic Land — Forest",
  color_identity: ["G"],
  legalities: { modern: "legal", commander: "legal", vintage: "legal" },
  ...extra,
});
const entry = (
  c: Card,
  qty = 1,
  board: Entry["board"] = "mainboard",
): Entry => ({
  id: crypto.randomUUID(),
  card: c,
  qty,
  board,
  language: "en",
  condition: "near_mint",
  finish: "nonfoil",
  purchasePrice: "",
  notes: "",
  tags: "",
});
const deck = (entries: Entry[], format = "modern"): Document => ({
  id: crypto.randomUUID(),
  name: "Test fixture",
  kind: "deck",
  format,
  notes: "",
  revision: 0,
  entries,
});
describe("format validation", () => {
  it("allows more than 60 constructed cards and attribute-based basic lands", () =>
    expect(validateDeck(deck([entry(card(), 65)])).errors).toEqual([]));
  it("aggregates prints across boards", () => {
    const c = card("Bolt", { type_line: "Instant" });
    expect(
      validateDeck(
        deck([
          entry(card(), 60),
          entry(c, 4),
          entry({ ...c, id: crypto.randomUUID() }, 1, "sideboard"),
        ]),
      ).errors.join(),
    ).toContain("exceeds 4");
  });
  it("never recognizes basic by name", () =>
    expect(
      validateDeck(
        deck([
          entry(
            card("Basically a Dragon", { type_line: "Creature — Dragon" }),
            60,
          ),
        ]),
      ).errors.join(),
    ).toContain("exceeds 4"));
  it("allows oracle copy exceptions", () =>
    expect(
      validateDeck(
        deck([
          entry(
            card("Rats", {
              type_line: "Creature",
              oracle_text: "A deck can have any number of cards named Rats.",
            }),
            60,
          ),
        ]),
      ).errors,
    ).toEqual([]));
  it("enforces restricted copies", () =>
    expect(
      validateDeck(
        deck(
          [
            entry(card(), 60),
            entry(
              card("Restricted", {
                type_line: "Artifact",
                legalities: { vintage: "restricted" },
              }),
              2,
            ),
          ],
          "vintage",
        ),
      ).errors.join(),
    ).toContain("exceeds 1"));
  it("validates commander color and eligibility", () => {
    const commander = card("Captain", {
      type_line: "Legendary Creature — Elf",
    });
    const d = deck(
      [
        entry(commander, 1, "commander"),
        entry(card(), 98),
        entry(
          card("Off color", { type_line: "Instant", color_identity: ["R"] }),
        ),
      ],
      "commander",
    );
    expect(validateDeck(d).errors.join()).toContain("color identity");
  });
  it("checks commander pairing", () => {
    const a = card("A", {
        type_line: "Legendary Creature",
        oracle_text: "Partner",
      }),
      b = card("B", {
        type_line: "Legendary Creature",
        oracle_text: "Partner",
      });
    expect(
      validateDeck(
        deck(
          [
            entry(a, 1, "commander"),
            entry(b, 1, "commander"),
            entry(card(), 98),
          ],
          "commander",
        ),
      ).errors,
    ).toEqual([]);
  });
});
describe("imports", () => {
  it("round trips CSV quoted metadata and quantities", () => {
    const e = entry(card(), 3);
    e.notes = 'a, b\n"quoted"';
    e.finish = "foil";
    e.purchasePrice = "1.25";
    const p = parseImport(exportCsv([e], "Binder"));
    expect(p.errors).toEqual([]);
    expect(p.rows[0]).toMatchObject({
      qty: 3,
      notes: e.notes,
      finish: "foil",
      purchasePrice: "1.25",
      id: e.card.id,
    });
  });
  it("round trips board sections", () => {
    const entries = [entry(card(), 4), entry(card("Captain"), 1, "commander")];
    const p = parseImport(exportDeck(entries));
    expect(p.rows.map((r) => r.board)).toEqual(["commander", "mainboard"]);
  });
  it("rejects invalid quantities", () =>
    expect(parseImport("0 Forest\nno quantity").errors).toHaveLength(2));
});
function room(): Room {
  const a = deck([entry(card(), 20)]);
  return {
    code: "TEST",
    host: "a",
    public: false,
    format: "modern",
    started: true,
    revision: 0,
    turn: 0,
    log: [],
    commands: [],
    chat: [],
    players: ["a", "b"].map((id) => ({
      id,
      name: id,
      ready: true,
      deckName: a.name,
      pieces: loadDeck(a),
      life: 20,
      tax: 0,
      damage: {},
      lastSeen: Date.now(),
      mulligans: 0,
    })),
  };
}
describe("authoritative tabletop", () => {
  it("never sends library cards or opponent hand", () => {
    let r = room();
    r = act(r, "a", {
      id: crypto.randomUUID(),
      revision: 0,
      action: "opening",
    });
    const v = viewRoom(r, "b");
    expect(v.players[0].pieces).toHaveLength(0);
    expect(v.players[0].handCount).toBe(7);
    expect(v.players[0].libraryCount).toBe(13);
    expect(viewRoom(r, "a").players[0].pieces).toHaveLength(7);
  });
  it("rejects acting on opponent cards", () => {
    const r = room();
    expect(() =>
      act(r, "b", {
        id: crypto.randomUUID(),
        revision: 0,
        action: "move",
        piece: r.players[0].pieces[0].id,
        zone: "battlefield",
      }),
    ).toThrow("own cards");
  });
  it("deduplicates commands before stale check", () => {
    const r = room();
    const command = { id: crypto.randomUUID(), revision: 0, action: "draw" };
    const n = act(r, "a", command);
    expect(act(n, "a", command)).toEqual(n);
  });
  it("rejects stale concurrent writes", () => {
    const r = act(room(), "a", {
      id: crypto.randomUUID(),
      revision: 0,
      action: "draw",
    });
    expect(() =>
      act(r, "b", { id: crypto.randomUUID(), revision: 0, action: "draw" }),
    ).toThrow("Stale");
  });
  it("reveals only intentionally and retains no hidden names in private movement logs", () => {
    let r = act(room(), "a", {
      id: crypto.randomUUID(),
      revision: 0,
      action: "draw",
    });
    const c = r.players[0].pieces.find((c) => c.zone === "hand")!;
    r = act(r, "a", {
      id: crypto.randomUUID(),
      revision: 1,
      action: "reveal",
      piece: c.id,
    });
    expect(viewRoom(r, "b").players[0].pieces[0].card.name).toBe(c.card.name);
  });
  it("only active player may pass turns", () =>
    expect(() =>
      act(room(), "b", {
        id: crypto.randomUUID(),
        revision: 0,
        action: "turn",
      }),
    ).toThrow("active player"));
});

import { scanQueries, visiblePrintingHint } from "../shared/scanner";
describe("OCR query preparation", () => {
  it("preserves name prefixes when OCR appends mana/frame noise", () => {
    expect(scanQueries("(Lightning Bolt BD §")).toContain("Lightning Bolt");
    expect(scanQueries("{( Sol Ring 3)")).toContain("Sol Ring");
    expect(scanQueries("© Delver of Secrets ¢ IE")).toContain(
      "Delver of Secrets",
    );
  });
  it("treats footer evidence as a hint", () =>
    expect(visiblePrintingHint("215/261 DMR")).toEqual({
      set: "dmr",
      collector: "215",
    }));
  it("bounds search work", () =>
    expect(scanQueries("Random ".repeat(1000))).toHaveLength(0));
});

import {
  parseNativeScan,
  parseNativeExport,
  serverOrigin,
} from "../shared/nativeBridge";
describe("Expo bridge boundary", () => {
  it("accepts bounded image data only, never commands or remote URLs", () => {
    expect(
      parseNativeScan(
        JSON.stringify({
          type: "cardchasm:scan",
          id: "test",
          image: "data:image/jpeg;base64,AAAA",
        }),
      )?.id,
    ).toBe("test");
    expect(
      parseNativeScan(
        JSON.stringify({
          type: "cardchasm:scan",
          id: "test",
          image: "https://attacker.invalid/image",
        }),
      ),
    ).toBeNull();
    expect(parseNativeScan("{")).toBeNull();
  });
  it("sanitizes export paths and rejects unsupported payloads", () => {
    expect(
      parseNativeExport(
        JSON.stringify({
          type: "cardchasm:export",
          name: "../../private.json",
          text: "test",
          mime: "application/json",
        }),
      )?.name,
    ).toBe(".._.._private.json");
    expect(
      parseNativeExport(
        JSON.stringify({
          type: "cardchasm:export",
          name: "x",
          text: "test",
          mime: "text/html",
        }),
      ),
    ).toBeNull();
  });
  it("allows server origins without embedded credentials or paths", () => {
    expect(serverOrigin("http://192.168.1.2:3001")).toBe(
      "http://192.168.1.2:3001",
    );
    expect(() => serverOrigin("javascript:alert(1)")).toThrow();
    expect(() => serverOrigin("https://secret@example.com/")).toThrow();
    expect(() => serverOrigin("https://example.com/path")).toThrow();
  });
});

import {
  addCopy,
  changeCopies,
  newEntry,
  cardCount,
  missingCards,
} from "../shared/deckEditing";
describe("contextual card editing", () => {
  it("increments the exact printing on the chosen board without modifying inventory", () => {
    const c = card();
    const inventory = { ...deck([entry(c, 3)]), kind: "collection" as const };
    const original = deck([entry(c, 2)]);
    const changed = addCopy(original, c);
    expect(cardCount(changed)).toBe(3);
    expect(original.entries[0].qty).toBe(2);
    expect(inventory.entries[0].qty).toBe(3);
  });
  it("keeps different printings, metadata lots and boards separate", () => {
    const c = card();
    const e = newEntry(c);
    e.finish = "foil";
    const original = deck([e]);
    expect(addCopy(original, c).entries).toHaveLength(2);
    expect(addCopy(original, c, "sideboard").entries[1].board).toBe(
      "sideboard",
    );
    expect(
      addCopy(original, { ...c, id: crypto.randomUUID() }).entries,
    ).toHaveLength(2);
  });
  it("uses inventory mainboard regardless of a previously selected deck board", () => {
    const inventory = { ...deck([]), kind: "collection" as const };
    expect(addCopy(inventory, card(), "commander").entries[0].board).toBe(
      "mainboard",
    );
  });
  it("removes only the requested entry when decrementing its last copy", () => {
    const a = entry(card(), 1),
      b = entry(card("Other"), 4);
    const changed = changeCopies(deck([a, b]), a.id, -1);
    expect(changed.entries).toEqual([b]);
  });
});

describe("missing owned cards", () => {
  it("combines printings and boards, excludes maybeboard and tracking lists", () => {
    const c = card("Test card"),
      alternate = { ...c, id: crypto.randomUUID() };
    const build = deck([
      entry(c, 3),
      entry(alternate, 2, "sideboard"),
      entry(c, 10, "maybeboard"),
    ]);
    const binder = {
      ...deck([entry(alternate, 2)]),
      kind: "collection" as const,
    };
    const wishlist = { ...deck([entry(c, 100)]), kind: "wishlist" as const };
    const result = missingCards(build, [binder, wishlist]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ qty: 5, owned: 2, missing: 3 });
    expect(binder.entries[0].qty).toBe(2);
  });
});
