import { describe, expect, it } from "vitest";
import { act, viewRoom, type Room, type Piece } from "../server/game";
import { applyProposal, type Proposal } from "../shared/proposals";
import { newEntry } from "../shared/deckEditing";
import type { Document } from "../shared/model";
import { printingPages } from "../shared/printingPages";
const privateCard = {
  id: crypto.randomUUID(),
  oracle_id: "secret-oracle",
  name: "PRIVATE CARD TEST",
  prices: { usd: "6" },
};
function room(): Room {
  const piece: Piece = {
    id: crypto.randomUUID(),
    card: privateCard,
    zone: "hand",
    tapped: false,
    counters: 0,
    flipped: false,
    revealed: false,
  };
  return {
    code: "fixture",
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
      deckName: "Fixture",
      pieces:
        id === "a"
          ? [piece, { ...piece, id: crypto.randomUUID(), zone: "library" }]
          : [],
      life: 20,
      tax: 0,
      damage: {},
      lastSeen: Date.now(),
      mulligans: 0,
    })),
  };
}
function command(r: Room, action: string, extra = {}) {
  return { id: crypto.randomUUID(), revision: r.revision, action, ...extra };
}
function noSecret(r: Room) {
  const payload = JSON.stringify(viewRoom(r, "b"));
  for (const value of [privateCard.name, privateCard.id, privateCard.oracle_id])
    expect(payload).not.toContain(value);
}
describe("all-channel hidden information", () => {
  it("hides identities, counters and hidden-to-hidden movement, including reconnect", () => {
    let r = room();
    noSecret(r);
    r = act(
      r,
      "a",
      command(r, "counter", { piece: r.players[0].pieces[0].id, value: 4 }),
    );
    noSecret(r);
    r = act(
      r,
      "a",
      command(r, "move", { piece: r.players[0].pieces[0].id, zone: "library" }),
    );
    noSecret(r);
    r = act(r, "a", command(r, "shuffle"));
    noSecret(structuredClone(r));
    expect(viewRoom(r, "a").players[0].pieces).toEqual([]);
  });
  it("discloses deliberate reveals and hides the card again after returning to library", () => {
    let r = room();
    const id = r.players[0].pieces[0].id;
    r = act(r, "a", command(r, "reveal", { piece: id }));
    expect(viewRoom(r, "b").players[0].pieces[0].card.name).toBe(
      privateCard.name,
    );
    r = act(r, "a", command(r, "move", { piece: id, zone: "library" }));
    expect(viewRoom(r, "b").players[0].pieces).toEqual([]);
    // Historic intentional reveal is public knowledge and may remain in the log.
  });
  it("scrubs previously persisted leaking counter logs", () => {
    const r = room();
    r.log.push(`a: updated counters on ${privateCard.name}`);
    noSecret(r);
  });
  it("rejects unauthorized and invalid actions without mutation, even known command IDs", () => {
    const r = room();
    const before = structuredClone(r);
    for (const [actor, action, extra] of [
      ["b", "counter", { piece: r.players[0].pieces[0].id, value: 2 }],
      ["a", "counter", { piece: r.players[0].pieces[0].id, value: 1000 }],
      ["a", "flip", { piece: r.players[0].pieces[0].id }],
      ["a", "move", { piece: r.players[0].pieces[0].id, zone: "invalid" }],
    ] as const) {
      expect(() => act(r, actor, command(r, action, extra))).toThrow();
      expect(r).toEqual(before);
    }
    r.commands.push("known");
    expect(() =>
      act(r, "outsider", { id: "known", revision: 0, action: "draw" }),
    ).toThrow("member");
    expect(() => viewRoom(r, "outsider")).toThrow("member");
  });
});
function setup() {
  const entry = newEntry(privateCard, "sideboard");
  entry.qty = 3;
  const otherPrinting = {
    ...entry,
    id: crypto.randomUUID(),
    card: { ...privateCard, id: crypto.randomUUID() },
    board: "mainboard" as const,
  };
  const deck: Document = {
    id: crypto.randomUUID(),
    revision: 2,
    kind: "deck",
    format: "modern",
    name: "A",
    notes: "",
    entries: [entry, otherPrinting],
  };
  const add = newEntry(privateCard);
  const p: Proposal = {
    id: crypto.randomUUID(),
    accountId: "a",
    deckId: deck.id,
    revision: 2,
    budget: 10,
    ownedOnly: false,
    analysis: "Fixture",
    changes: [
      { id: "cut", entry, before: 3, after: 2, reason: "cut" },
      { id: "add", entry: add, before: 0, after: 2, reason: "add" },
    ],
    rejected: [],
    evidence: "Fixture",
    retrievedAt: "fixture",
  };
  return { p, deck, entry, otherPrinting };
}
describe("proposal safety without a model call", () => {
  it("binds account, deck and revision", () => {
    const { p, deck } = setup();
    expect(() => applyProposal(p, "b", deck, ["cut"], [])).toThrow("account");
    expect(() =>
      applyProposal(p, "a", { ...deck, id: "B" }, ["cut"], []),
    ).toThrow("deck");
    expect(() =>
      applyProposal(p, "a", { ...deck, revision: 3 }, ["cut"], []),
    ).toThrow("changed");
  });
  it("partially applies exact sideboard quantities while preserving other printings and metadata", () => {
    const { p, deck, entry, otherPrinting } = setup();
    const result = applyProposal(p, "a", deck, ["cut"], []).document;
    expect(result.entries.find((e) => e.id === entry.id)).toEqual({
      ...entry,
      qty: 2,
    });
    expect(result.entries.find((e) => e.id === otherPrinting.id)).toEqual(
      otherPrinting,
    );
    expect(deck.entries[0].qty).toBe(3);
  });
  it("enforces total cost, coverage, duplicate selection and available owned quantities", () => {
    const { p, deck, entry } = setup();
    expect(() => applyProposal(p, "a", deck, ["add"], [])).toThrow(
      "total budget",
    );
    expect(() => applyProposal(p, "a", deck, ["cut", "cut"], [])).toThrow(
      "valid changes",
    );
    const owned: Document = {
      ...deck,
      kind: "collection",
      entries: [{ ...entry, qty: 7 }],
    };
    expect(() =>
      applyProposal({ ...p, ownedOnly: true }, "a", deck, ["add"], [owned]),
    ).toThrow("insufficient");
    const unknown = structuredClone(p);
    unknown.changes[1].entry.card.prices = {};
    expect(() => applyProposal(unknown, "a", deck, ["add"], [])).toThrow(
      "coverage",
    );
  });
});
it("printing lookup includes later pages and deduplicates", async () => {
  const later = { ...privateCard, id: "later", collector_number: "250" };
  const calls: number[] = [];
  const result = await printingPages(async (n) => {
    calls.push(n);
    return {
      data: n === 1 ? [privateCard] : [privateCard, later],
      has_more: n === 1,
    };
  });
  expect(calls).toEqual([1, 2]);
  expect(result).toEqual([privateCard, later]);
});

import { authoritativeDeck } from "../server/deckValidation";
import { validateDeck } from "../shared/model";
describe("authoritative deck facts", () => {
  it("replaces forged facts and deduplicates provider identities", async () => {
    const { deck } = setup();
    let calls = 0;
    deck.entries = [
      deck.entries[0],
      { ...deck.entries[0], id: crypto.randomUUID() },
    ];
    const result = await authoritativeDeck(deck, async (id) => {
      calls++;
      return {
        ...privateCard,
        id,
        type_line: "Instant",
        color_identity: [],
        legalities: { modern: "banned" },
      };
    });
    expect(calls).toBe(1);
    expect(result.validation.status).toBe("invalid");
    expect(result.validation.errors.join()).toContain("banned");
  });
  it("never trusts client metadata when provider verification fails", async () => {
    const { deck } = setup();
    const result = await authoritativeDeck(deck, async () => {
      throw Error("offline");
    });
    expect(result.validation.status).toBe("incomplete");
    expect(result.document.entries[0].card.type_line).toBeUndefined();
  });
  it("rejects standalone Background and supports current qualifying Vehicle commanders", () => {
    const { deck } = setup();
    deck.format = "commander";
    const make = (type_line: string, extra = {}) => ({
      ...privateCard,
      type_line,
      color_identity: [],
      legalities: { commander: "legal" },
      ...extra,
    });
    deck.entries = [
      newEntry(make("Legendary Enchantment — Background"), "commander"),
    ];
    expect(validateDeck(deck).errors.join()).toContain("eligibility");
    deck.entries = [
      newEntry(
        make("Legendary Artifact — Vehicle", { power: "5", toughness: "5" }),
        "commander",
      ),
    ];
    expect(validateDeck(deck).errors.join()).not.toContain("eligibility");
  });
  it("requires all players to agree to an unverified casual game", () => {
    const r = room();
    r.started = false;
    expect(() => act(r, "a", command(r, "start"))).toThrow("Every player");
    r.players.forEach((p) => {
      p.acceptsCasual = true;
    });
    expect(act(r, "a", command(r, "start")).started).toBe(true);
  });
  it("keeps validation details out of opponents' payloads", () => {
    const r = room();
    r.players[0].deckValidation = {
      status: "invalid",
      checkedAt: "fixture",
      errors: [privateCard.name],
      warnings: [privateCard.name],
    };
    noSecret(r);
  });
});

import { isSoloState, startSolo } from "../shared/solo";
import { readRoute } from "../src/useAppRoute";
it("validates persisted solo state rather than trusting a pieces array", () => {
  const { deck } = setup();
  const state = startSolo(deck);
  expect(isSoloState(state)).toBe(true);
  expect(isSoloState({ ...state, turn: null })).toBe(false);
  expect(isSoloState({ ...state, mana: {} })).toBe(false);
  expect(
    isSoloState({ ...state, pieces: [state.pieces[0], state.pieces[0]] }),
  ).toBe(false);
  expect(
    isSoloState({ ...state, pieces: [{ ...state.pieces[0], zone: "bad" }] }),
  ).toBe(false);
  expect(isSoloState({ ...state, freeMulligan: true, mulls: 8 })).toBe(true);
});
it("parses supported deep links and safely defaults unknown screens", () => {
  expect(readRoute("?screen=Decks&document=fixture")).toEqual({
    page: "Decks",
    selected: "fixture",
  });
  expect(readRoute("?screen=script")).toEqual({ page: "Home", selected: "" });
});

import { acceptRoom, repeatedCameraFrame } from "../shared/synchronization";
it("suppresses recent stationary camera frames but never independent uploads", () => {
  const previous = { signature: "bolt", at: 1000 };
  expect(repeatedCameraFrame(previous, "bolt", true, 5000)).toBe(true);
  expect(repeatedCameraFrame(previous, "bolt", false, 5000)).toBe(false);
  expect(repeatedCameraFrame(previous, "forest", true, 5000)).toBe(false);
  expect(repeatedCameraFrame(previous, "bolt", true, 14000)).toBe(false);
  expect(repeatedCameraFrame(null, "bolt", true, 5000)).toBe(false);
  expect(repeatedCameraFrame(previous, "", true, 5000)).toBe(false);
});
it("accepts newer room responses while rejecting late polls and responses after leaving", () => {
  const current = { code: "A", revision: 9 };
  expect(acceptRoom(current, { code: "A", revision: 8 })).toBe(current);
  expect(acceptRoom(current, { code: "A", revision: 10 })?.revision).toBe(10);
  expect(acceptRoom(current, { code: "B", revision: 10 })).toBe(current);
  expect(acceptRoom(null, current)).toBeNull();
});
it("uses an available finish when a printing has no nonfoil version", () => {
  expect(newEntry({ ...privateCard, finishes: ["foil"] }).finish).toBe("foil");
});

it("distinguishes current partner variants and rejects a Doctor with extra creature types", () => {
  const { deck } = setup();
  deck.format = "commander";
  const commander = (
    name: string,
    oracle_text: string,
    type_line = "Legendary Creature — Human",
  ) =>
    newEntry(
      {
        ...privateCard,
        id: name,
        oracle_id: name,
        name,
        oracle_text,
        type_line,
        color_identity: [],
        legalities: { commander: "legal" },
      },
      "commander",
    );
  deck.entries = [
    commander("A", "Partner—Survivors"),
    commander("B", "Partner—Survivors"),
  ];
  expect(validateDeck(deck).errors.join()).not.toContain("pairing");
  deck.entries[1].card.oracle_text = "Partner—Character select";
  expect(validateDeck(deck).errors.join()).toContain("pairing");
  deck.entries = [
    commander("A", "Doctor's companion"),
    commander("B", "", "Legendary Creature — Human Time Lord Doctor"),
  ];
  expect(validateDeck(deck).errors.join()).toContain("pairing");
});
it("uses the front face for commander eligibility and reports unknown format facts as incomplete", () => {
  const { deck } = setup();
  deck.format = "commander";
  const card = {
    ...privateCard,
    type_line: "Creature — Human // Legendary Creature — Human",
    card_faces: [
      { name: "Front", type_line: "Creature — Human" },
      { name: "Back", type_line: "Legendary Creature — Human" },
    ],
    legalities: {},
    color_identity: [],
  };
  deck.entries = [newEntry(card, "commander")];
  const result = validateDeck(deck);
  expect(result.errors.join()).toContain("eligibility");
  expect(result.status).toBe("incomplete");
});
