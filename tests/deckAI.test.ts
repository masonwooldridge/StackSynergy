import { afterEach, expect, it, vi } from "vitest";
import express from "express";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import type { Card, Document } from "../shared/model";
import { newEntry } from "../shared/deckEditing";
import {
  installDeckAI,
  requestOpenAI,
  groundedOutputFormat,
  type AIDeps,
} from "../server/deckAI";
const c = (name: string, text = "", type = "Creature", price = "1"): Card => ({
  id: crypto.randomUUID(),
  oracle_id: crypto.randomUUID(),
  name,
  oracle_text: text,
  type_line: type,
  color_identity: ["G"],
  legalities: { commander: "legal" },
  prices: { usd: price },
  finishes: ["nonfoil"],
  mana_cost: "{1}{G}",
  cmc: 2,
});
const commander = c(
    "Commander",
    "Whenever this attacks, create a token copy of target creature.",
    "Legendary Creature",
  ),
  land = c("Forest", "", "Basic Land — Forest", "0.1"),
  weak = Array.from({ length: 63 }, (_, i) => c("Vanilla " + i));
const deck: Document = {
  id: crypto.randomUUID(),
  name: "Isolated AI deck",
  kind: "deck",
  format: "commander",
  revision: 0,
  notes: "Keep Vanilla 0.",
  commanderBracket: 3,
  entries: [
    { ...newEntry(commander), board: "commander" },
    { ...newEntry(land), qty: 36 },
    ...weak.map((c) => newEntry(c)),
  ],
};
const better = c("Entry cards", "When this creature enters, draw two cards.");
const facts = new Map(
  [...deck.entries.map((e) => e.card), better].map((c) => [c.id, c]),
);
const stops: (() => Promise<void>)[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(stops.splice(0).map((s) => s()));
});
async function app(overrides: Partial<AIDeps> = {}) {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  const provider = vi.fn(async () => ({
    reply: "Draw more cards with Entry cards.",
    cardIds: [better.id],
    swaps: [
      {
        cutEntryId: deck.entries[3].id,
        addCardId: better.id,
        reason: "Replace a vanilla body with an entry draw effect.",
      },
    ],
  }));
  const commit = vi.fn((_owner: string, _before: Document, next: Document) => ({
    ...next,
    revision: 1,
  }));
  installDeckAI(app, {
    enabled: () => true,
    configured: () => true,
    model: () => "mock-only",
    account: (r) => r.headers["x-test-user"] as string | undefined,
    documents: () => [deck],
    commit,
    card: async (path) =>
      path.startsWith("/cards/search")
        ? { data: [better] }
        : facts.get(path.slice(7)),
    provider,
    ...overrides,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  stops.push(() => new Promise((r) => server.close(() => r())));
  const root = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  return {
    provider,
    commit,
    post: async (
      path: string,
      body: unknown,
      headers: Record<string, string> = {},
    ) => {
      const r = await fetch(root + "/api/deck-ai/" + path, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
      return { status: r.status, body: await r.json() };
    },
  };
}
const input = () => ({
  scope: "guest",
  deck,
  collections: [],
  budget: 5,
  bracket: 3,
  ownedOnly: false,
  turns: [
    {
      role: "user",
      content: "Improve card advantage while keeping my commander.",
    },
  ],
});
it("disabled AI never calls grounding or provider", async () => {
  const card = vi.fn(),
    a = await app({ enabled: () => false, card });
  expect((await a.post("chat", input())).status).toBe(503);
  expect(a.provider).not.toHaveBeenCalled();
  expect(card).not.toHaveBeenCalled();
});
it("grounds facts, requires review, preserves count and consumes reviews once", async () => {
  const a = await app(),
    before = JSON.stringify(deck),
    r = await a.post("chat", input());
  expect(r.status).toBe(200);
  expect(r.body.review.pairs).toHaveLength(1);
  expect(r.body.review.pairs[0].cut.id).toBe(deck.entries[3].card.id);
  expect(r.body.review.pairs[0].cutPrice).toBe(1);
  expect(r.body.review.pairs[0].quality.tradeoff).toBeTruthy();
  expect(r.body.reply).toContain(
    "Cut 1 " +
      r.body.review.pairs[0].cutName +
      " → add 1 " +
      r.body.review.pairs[0].add.name,
  );
  expect(a.commit).not.toHaveBeenCalled();
  expect(JSON.stringify(deck)).toBe(before);
  expect(a.provider.mock.calls[0]).toBeDefined();
  const payload = {
    scope: "guest",
    deck,
    collections: [],
    reviewId: r.body.review.id,
    pairIds: [r.body.review.pairs[0].id],
  };
  const applied = await a.post("apply", payload);
  expect(applied.status).toBe(200);
  expect(applied.body.saved).toBe(false);
  expect(
    applied.body.document.entries.reduce(
      (n: number, e: { qty: number }) => n + e.qty,
      0,
    ),
  ).toBe(100);
  expect(applied.body.document.entries[0]).toEqual(deck.entries[0]);
  expect((await a.post("apply", payload)).status).toBe(409);
});
it("rejects stale guest content and scope changes", async () => {
  const a = await app(),
    r = await a.post("chat", input()),
    payload = {
      scope: "guest",
      deck: { ...deck, notes: "changed" },
      collections: [],
      reviewId: r.body.review.id,
      pairIds: [r.body.review.pairs[0].id],
    };
  expect((await a.post("apply", payload)).status).toBe(409);
  expect(
    (
      await a.post(
        "apply",
        { ...payload, scope: "account" },
        { "x-test-user": "someone" },
      )
    ).status,
  ).toBe(409);
  expect(a.commit).not.toHaveBeenCalled();
});
it("requires account auth and uses only server account documents", async () => {
  const a = await app();
  expect(
    (await a.post("chat", { ...input(), scope: "account", deckId: deck.id }))
      .status,
  ).toBe(400);
  const r = await a.post(
    "chat",
    {
      ...input(),
      scope: "account",
      deckId: deck.id,
      deck: { ...deck, name: "UNTRUSTED" },
    },
    { "x-test-user": "owner" },
  );
  expect(r.status).toBe(200);
  const payload = {
    scope: "account",
    reviewId: r.body.review.id,
    pairIds: [r.body.review.pairs[0].id],
  };
  const results = await Promise.all([
    a.post("apply", payload, { "x-test-user": "owner" }),
    a.post("apply", payload, { "x-test-user": "owner" }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  const applied = results.find((r) => r.status === 200)!;
  expect(a.commit).toHaveBeenCalledOnce();
  expect(applied.body.document.name).toBe(deck.name);
});
it.each([
  "unknown",
  "commander",
  "land",
  "protected",
  "budget",
  "offcolor",
  "banned",
  "owned",
])("rejects unsafe %s proposals without saving", async (scenario) => {
  const candidate = {
    ...better,
    ...(scenario === "offcolor" ? { color_identity: ["R"] } : {}),
    ...(scenario === "banned" ? { legalities: { commander: "banned" } } : {}),
  };
  const cut =
    scenario === "commander"
      ? deck.entries[0]
      : scenario === "land"
        ? deck.entries[1]
        : scenario === "protected"
          ? deck.entries[2]
          : deck.entries[3];
  const a = await app({
    card: async (path) =>
      path.startsWith("/cards/search")
        ? { data: [candidate] }
        : facts.get(path.slice(7)),
    provider: async () => ({
      reply: "Test",
      cardIds: [],
      swaps: [
        {
          cutEntryId: cut.id,
          addCardId:
            scenario === "unknown" ? crypto.randomUUID() : candidate.id,
          reason: "Mock-only test",
        },
      ],
    }),
  });
  const r = await a.post("chat", {
    ...input(),
    budget: scenario === "budget" ? 0 : 5,
    ownedOnly: scenario === "owned",
  });
  expect(r.status).toBe(400);
  expect(a.commit).not.toHaveBeenCalled();
});
it("caps messages and per-user requests", async () => {
  const a = await app({
    provider: async () => ({ reply: "Advice only", cardIds: [], swaps: [] }),
  });
  expect(
    (
      await a.post("chat", {
        ...input(),
        turns: [{ role: "user", content: "x".repeat(2001) }],
      })
    ).status,
  ).toBe(400);
  for (let i = 0; i < 3; i++)
    expect((await a.post("chat", input())).status).toBe(200);
  expect((await a.post("chat", input())).body.error).toMatch(/rate limit/);
});
it("Responses adapter sends bounded structured data and handles refusal/incomplete with mocked fetch only", async () => {
  const budget = {
    reserve: vi.fn(() => ({ id: "mock-reservation", reserved: 1 })),
    settle: vi.fn(),
    uncertain: vi.fn(),
  };
  let body: Record<string, unknown> = {};
  const mock = vi.fn(async (_url: unknown, init: RequestInit) => {
    body = JSON.parse(init.body as string);
    return new Response(
      JSON.stringify({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({ reply: "Mock", cardIds: [], swaps: [] }),
              },
            ],
          },
        ],
      }),
    );
  });
  vi.stubGlobal("fetch", mock);
  expect(
    await requestOpenAI(
      { cards: [] },
      [{ role: "user", content: "Hello" }],
      new AbortController().signal,
      budget,
    ),
  ).toEqual({ reply: "Mock", cardIds: [], swaps: [] });
  expect(body.store).toBe(false);
  expect(body).toHaveProperty("reasoning.effort", "minimal");
  expect(body).toHaveProperty("text.verbosity", "low");
  expect(body.max_output_tokens).toBe(1800);
  expect(body).not.toHaveProperty("tools");
  expect(body).toHaveProperty("text.format.type", "json_schema");
  mock.mockImplementation(
    async () =>
      new Response(JSON.stringify({ status: "incomplete", output: [] })),
  );
  await expect(
    requestOpenAI({}, [], new AbortController().signal, budget),
  ).rejects.toThrow(/incomplete/);
  mock.mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          status: "completed",
          output: [{ type: "message", content: [{ type: "refusal" }] }],
        }),
      ),
  );
  await expect(
    requestOpenAI({}, [], new AbortController().signal, budget),
  ).rejects.toThrow(/declined/);
});

it("sends only relevant Commander legality metadata to keep complete-deck context bounded", async () => {
  let context: unknown;
  const a = await app({
    provider: async (c) => {
      context = c;
      return { reply: "Advice", cardIds: [], swaps: [] };
    },
  });
  expect((await a.post("chat", input())).status).toBe(200);
  expect(context).toHaveProperty("cards.0.legalities", { commander: "legal" });
  expect(context).toHaveProperty("validatedSwapOptions");
});

it("constrains provider ID generation to grounded card and allowed swap IDs", () => {
  const format = groundedOutputFormat({
    cards: [better],
    validatedSwapOptions: [
      { cutEntryId: deck.entries[3].id, addCardId: better.id },
    ],
  });
  expect(format.schema.properties.cardIds.items).toEqual({
    type: "string",
    enum: [better.id],
  });
  expect(format.schema.properties.swaps.items.properties.cutEntryId).toEqual({
    type: "string",
    enum: [deck.entries[3].id],
  });
  expect(format.schema.properties.swaps.items.properties.addCardId).toEqual({
    type: "string",
    enum: [better.id],
  });
  expect(
    groundedOutputFormat({ cards: [] }).schema.properties.swaps.maxItems,
  ).toBe(0);
});

it("shows grounded discussion cards even if the model omits its cardIds and explains no active swap", async () => {
  const a = await app({
    provider: async () => ({
      reply: "Discuss Entry cards before changing anything.",
      cardIds: [],
      swaps: [],
    }),
  });
  const r = await a.post("chat", input());
  expect(r.status).toBe(200);
  expect(r.body.cards.map((c: Card) => c.id)).toContain(better.id);
  expect(r.body.review).toBeNull();
  expect(r.body.noSwapReason).toContain("advice");
});
it("reports unavailable candidate searches instead of silently implying a full search found no upgrade", async () => {
  const a = await app({
    card: async (path) => {
      if (path.startsWith("/cards/search"))
        throw Error("QA card search unavailable");
      return facts.get(path.slice(7));
    },
    provider: async () => ({
      reply: "Keep your current list.",
      cardIds: [],
      swaps: [],
    }),
  });
  const r = await a.post("chat", input());
  expect(r.status).toBe(200);
  expect(r.body.noSwapReason).toContain("searches were unavailable");
  expect(r.body.review).toBeNull();
});

it("keeps exact-five constraints through follow-ups and returns full canonical creature metadata with a positive count", async () => {
  const five = {
    ...better,
    id: crypto.randomUUID(),
    oracle_id: crypto.randomUUID(),
    name: "Five-mana draw creature",
    cmc: 5,
    mana_cost: "{3}{G}{G}",
  };
  const provider = vi.fn(async (context: unknown) => {
    const c = context as {
      validatedSwapOptions: { cutEntryId: string; addCardId: string }[];
    };
    expect(c.validatedSwapOptions.length).toBeGreaterThan(0);
    return {
      reply: "Review the five-mana creature.",
      cardIds: [],
      swaps: [
        {
          cutEntryId: c.validatedSwapOptions[0].cutEntryId,
          addCardId: c.validatedSwapOptions[0].addCardId,
          reason: "Mock selection",
        },
      ],
    };
  });
  const a = await app({
    card: async (path) =>
      path.startsWith("/cards/search")
        ? { data: [better, five] }
        : facts.get(path.slice(7)),
    provider,
  });
  const r = await a.post("chat", {
    ...input(),
    turns: [
      { role: "user", content: "Add more 5 mana creatures" },
      { role: "assistant", content: "I will keep the exact cost." },
      { role: "user", content: "Keep those restrictions" },
      { role: "assistant", content: "Understood" },
      { role: "user", content: "Show another option" },
      { role: "assistant", content: "Still five" },
      { role: "user", content: "Try again" },
    ],
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  expect(r.body.review.pairs[0].add.cmc).toBe(5);
  expect(r.body.review.pairs[0].add.type_line).toContain("Creature");
  expect(
    r.body.review.matchingAfter - r.body.review.matchingBefore,
  ).toBeGreaterThan(0);
  expect(r.body.review.constraintSummary).toContain("exactly 5");
  const applied = await a.post("apply", {
    scope: "guest",
    deck,
    collections: [],
    reviewId: r.body.review.id,
    pairIds: [r.body.review.pairs[0].id],
  });
  expect(applied.status).toBe(200);
  expect(
    applied.body.document.entries.some(
      (e: { card: Card }) => e.card.id === five.id,
    ),
  ).toBe(true);
});
it("does not display a cheaper unrelated addition when the exact-five request cannot fit budget or owned inventory", async () => {
  const provider = vi.fn(async () => ({
    reply: "No exact match fits.",
    cardIds: [],
    swaps: [],
  }));
  const a = await app({ provider });
  const r = await a.post("chat", {
    ...input(),
    ownedOnly: true,
    budget: 0,
    turns: [{ role: "user", content: "Add more five mana creatures" }],
  });
  expect(r.status).toBe(200);
  expect(r.body.review).toBeNull();
  expect(r.body.noSwapReason).toContain("exactly 5");
  expect(r.body.noSwapReason).toContain("not broadened");
  expect(provider).not.toHaveBeenCalled();
  expect(a.commit).not.toHaveBeenCalled();
});
it("rejects a model selecting a known four-mana card for an exact-five request without saving", async () => {
  const five = {
    ...better,
    id: crypto.randomUUID(),
    oracle_id: crypto.randomUUID(),
    cmc: 5,
  };
  const four = {
    ...better,
    id: crypto.randomUUID(),
    oracle_id: crypto.randomUUID(),
    cmc: 4,
  };
  const a = await app({
    card: async (path) =>
      path.startsWith("/cards/search")
        ? { data: [four, five] }
        : facts.get(path.slice(7)),
    provider: async () => ({
      reply: "Wrong choice",
      cardIds: [four.id],
      swaps: [
        {
          cutEntryId: deck.entries[3].id,
          addCardId: four.id,
          reason: "Mock attempted violation",
        },
      ],
    }),
  });
  expect(
    (
      await a.post("chat", {
        ...input(),
        turns: [{ role: "user", content: "Add more 5 mana creatures" }],
      })
    ).status,
  ).toBe(400);
  expect(a.commit).not.toHaveBeenCalled();
});

it("a follow-up with new constraints invalidates an older same-deck review at the server", async () => {
  const five = {
    ...better,
    id: crypto.randomUUID(),
    oracle_id: crypto.randomUUID(),
    name: "New five",
    cmc: 5,
  };
  const a = await app({
    card: async (path) =>
      path.startsWith("/cards/search")
        ? { data: [better, five] }
        : facts.get(path.slice(7)),
    provider: async (context: unknown) => {
      const c = context as {
        validatedSwapOptions: { cutEntryId: string; addCardId: string }[];
      };
      return {
        reply: "Review",
        cardIds: [],
        swaps: [
          {
            cutEntryId: c.validatedSwapOptions[0].cutEntryId,
            addCardId: c.validatedSwapOptions[0].addCardId,
            reason: "Mock choice",
          },
        ],
      };
    },
  });
  const old = await a.post("chat", input());
  expect(old.status).toBe(200);
  const next = await a.post("chat", {
    ...input(),
    turns: [{ role: "user", content: "Add more 5 mana creatures" }],
  });
  expect(next.status).toBe(200);
  const stale = await a.post("apply", {
    scope: "guest",
    deck,
    collections: [],
    reviewId: old.body.review.id,
    pairIds: [old.body.review.pairs[0].id],
  });
  expect(stale.status).toBe(409);
  expect(stale.body.error).toContain("replaced");
  expect(a.commit).not.toHaveBeenCalled();
});
it.each([
  "What are mana rocks?",
  "add more counters",
  "Keep Sol Ring, replace other expensive rocks",
])(
  "answers glossary or ambiguity locally without a paid provider: %s",
  async (prompt) => {
    const a = await app();
    const result = await a.post("chat", {
      ...input(),
      turns: [{ role: "user", content: prompt }],
    });
    expect(result.status).toBe(200);
    expect(result.body.review).toBeNull();
    expect(result.body.source.toLowerCase()).toContain("no model request made");
    expect(a.provider).not.toHaveBeenCalled();
    expect(a.commit).not.toHaveBeenCalled();
  },
);

it("grounds the combined rock request before mock selection and rejects tapped/draw-only alternatives", async () => {
  const canonical = JSON.parse(
    readFileSync(
      new URL("./fixtures/mtgTermCards.json", import.meta.url),
      "utf8",
    ),
  ).cards as Card[];
  const candidates = canonical.filter((c) =>
    [
      "Mind Stone",
      "Coldsteel Heart",
      "Prophetic Prism",
      "Llanowar Elves",
    ].includes(c.name),
  );
  const stone = candidates.find((c) => c.name === "Mind Stone")!;
  // Canonical rules text, explicitly mocked QA pricing; fixture printing has unknown price.
  stone.prices = { usd: "1.00" };
  const provider = vi.fn(async (context: unknown) => {
    const ctx = context as {
      validatedSwapOptions: { cutEntryId: string; addCardId: string }[];
    };
    expect(ctx.validatedSwapOptions.length).toBeGreaterThan(0);
    expect(
      (context as { bindingRequest: unknown }).bindingRequest,
    ).toMatchObject({
      mechanics: ["mana-rock"],
      manaValue: 2,
      relation: "exact",
      purchaseBudget: 4.99,
      noTapped: true,
    });
    expect(
      ctx.validatedSwapOptions.every((p) => p.addCardId === stone.id),
    ).toBe(true);
    return {
      reply: "Mock selection of a grounded rock.",
      cardIds: [],
      swaps: [
        {
          cutEntryId: ctx.validatedSwapOptions[0].cutEntryId,
          addCardId: ctx.validatedSwapOptions[0].addCardId,
          reason: "Mock selection",
        },
      ],
    };
  });
  const a = await app({
    provider,
    card: async (path) =>
      path.startsWith("/cards/search")
        ? { data: candidates }
        : facts.get(path.slice(7)) ||
          canonical.find((c) => c.id === path.slice(7)),
  });
  const response = await a.post("chat", {
    ...input(),
    turns: [
      {
        role: "user",
        content: "more two mana rocks under $5, no tapped rocks",
      },
    ],
  });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  expect(provider).toHaveBeenCalledOnce();
  expect(response.body.review.pairs[0].add.name).toBe("Mind Stone");
  expect(response.body.review.matchingAfter).toBeGreaterThan(
    response.body.review.matchingBefore,
  );
  expect(a.commit).not.toHaveBeenCalled();
});
it.each(["What are mana rocks?", "add more counters"])(
  "invalidates an older review even when the follow-up returns locally: %s",
  async (prompt) => {
    const a = await app();
    const old = await a.post("chat", input());
    expect(old.body.review).toBeTruthy();
    const followup = await a.post("chat", {
      ...input(),
      turns: [{ role: "user", content: prompt }],
    });
    expect(followup.status).toBe(200);
    const stale = await a.post("apply", {
      scope: "guest",
      deck,
      collections: [],
      reviewId: old.body.review.id,
      pairIds: [old.body.review.pairs[0].id],
    });
    expect(stale.status).toBe(409);
    expect(a.commit).not.toHaveBeenCalled();
  },
);

it("does not create a review from an older in-flight response after a newer local clarification", async () => {
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>((r) => (release = r)),
    began = new Promise<void>((r) => (started = r));
  const provider = vi.fn(async (context: unknown) => {
    started();
    await gate;
    const c = context as {
      validatedSwapOptions: { cutEntryId: string; addCardId: string }[];
    };
    return {
      reply: "Older response",
      cardIds: [],
      swaps: [
        {
          cutEntryId: c.validatedSwapOptions[0].cutEntryId,
          addCardId: c.validatedSwapOptions[0].addCardId,
          reason: "Mock older selection",
        },
      ],
    };
  });
  const a = await app({ provider });
  const pending = a.post("chat", input());
  await began;
  const newer = await a.post("chat", {
    ...input(),
    turns: [{ role: "user", content: "add more counters" }],
  });
  expect(newer.status).toBe(200);
  release();
  const old = await pending;
  expect(old.status).toBe(400);
  expect(old.body.error).toContain("newer request");
  expect(old.body.review).toBeUndefined();
  expect(a.commit).not.toHaveBeenCalled();
});
it("allows strategic discussion of rocks with a complete deck while offering no mutation options", async () => {
  const provider = vi.fn(async (context: unknown) => {
    expect(
      (context as { validatedSwapOptions: unknown[] }).validatedSwapOptions,
    ).toEqual([]);
    return {
      reply:
        "Reference mock discussion; assess early mana and colors before adding rocks.",
      cardIds: [],
      swaps: [],
    };
  });
  const a = await app({ provider });
  const result = await a.post("chat", {
    ...input(),
    turns: [
      {
        role: "user",
        content: "Explain whether my deck needs more mana rocks",
      },
    ],
  });
  expect(result.status).toBe(200);
  expect(provider).toHaveBeenCalledOnce();
  expect(result.body.review).toBeNull();
  expect(result.body.noSwapReason).toContain("Discussion only");
  expect(a.commit).not.toHaveBeenCalled();
});
it("replaces supplied card labels/rules/prices with canonical facts before the provider sees context", async () => {
  const provider = vi.fn(async (context: unknown) => {
    const ctx = context as {
      cards: { id: string; name: string; oracle: string; usd: number }[];
    };
    const known = ctx.cards.find((c) => c.id === better.id)!;
    const replaced = ctx.cards.find((c) => c.id === deck.entries[3].card.id)!;
    expect(replaced.name).toBe(deck.entries[3].card.name);
    expect(replaced.oracle).toBe(deck.entries[3].card.oracle_text);
    expect(replaced.usd).toBe(1);
    expect(known.name).toBe(better.name);
    expect(known.oracle).toBe(better.oracle_text);
    expect(known.usd).toBe(1);
    return { reply: "Mock grounded advice.", cardIds: [better.id], swaps: [] };
  });
  const forged = structuredClone(deck);
  forged.entries[3].card = {
    ...forged.entries[3].card,
    name: "Forged supplied name",
    oracle_text: "Invented supplied rules",
    prices: { usd: "0" },
  };
  const a = await app({ provider });
  const result = await a.post("chat", { ...input(), deck: forged });
  expect(result.status).toBe(200);
  expect(provider).toHaveBeenCalledOnce();
  expect(JSON.stringify(result.body)).not.toContain("Forged supplied name");
  expect(a.commit).not.toHaveBeenCalled();
});
it("rejects an ungrounded response citation even when no swap is proposed", async () => {
  const a = await app({
    provider: async () => ({
      reply: "Mock ungrounded reference",
      cardIds: [crypto.randomUUID()],
      swaps: [],
    }),
  });
  const result = await a.post("chat", input());
  expect(result.status).toBe(400);
  expect(result.body.error).toContain("ungrounded");
  expect(a.commit).not.toHaveBeenCalled();
});
it("renders sources for named grounded advice cards instead of an unrelated model-provided known ID", async () => {
  const a = await app({
    provider: async () => ({
      reply: "Entry cards provides entry draw, with a tradeoff.",
      cardIds: [weak[0].id],
      swaps: [],
    }),
  });
  const result = await a.post("chat", input());
  expect(result.status).toBe(200);
  expect(result.body.cards.map((c: Card) => c.id)).toContain(better.id);
  expect(result.body.cards.map((c: Card) => c.id)).not.toContain(weak[0].id);
  expect(a.commit).not.toHaveBeenCalled();
});
it.each([
  "Explain repeatable creature-based card draw for my Satya bracket 4 deck. Distinguish engines from cantrips.",
  "Explain how to protect attacking Satya in my bracket 4 deck. Distinguish combat protection from removal protection.",
])(
  "routes a contextual deck discussion to the provider instead of a generic dictionary: %s",
  async (prompt) => {
    const paths: string[] = [];
    const provider = vi.fn(async (context: unknown) => {
      expect(
        (context as { validatedSwapOptions: unknown[] }).validatedSwapOptions,
      ).toEqual([]);
      return { reply: "Mock contextual discussion.", cardIds: [], swaps: [] };
    });
    const a = await app({
      provider,
      card: async (path) => {
        paths.push(path);
        return path.startsWith("/cards/search")
          ? { data: [better] }
          : facts.get(path.slice(7));
      },
    });
    const result = await a.post("chat", {
      ...input(),
      turns: [{ role: "user", content: prompt }],
    });
    expect(result.status).toBe(200);
    expect(provider).toHaveBeenCalledOnce();
    expect(
      paths
        .filter((p) => p.startsWith("/cards/search"))
        .every((p) => !decodeURIComponent(p).includes("usd<=")),
    ).toBe(true);
    expect(result.body.review).toBeNull();
    expect(a.commit).not.toHaveBeenCalled();
  },
);

it('does not repeat the previous shortlist when a follow-up asks for other options', async () => {
  let tick=Date.now();
  const second=c('Other entry cards','When this creature enters, draw three cards.');
  const provider=vi.fn(async(context:unknown)=>({reply:'Review a different draw option.',cardIds:[],swaps:(context as {validatedSwapOptions:{cutEntryId:string;addCardId:string}[]}).validatedSwapOptions.slice(0,1).map((p)=>({cutEntryId:p.cutEntryId,addCardId:p.addCardId,reason:'Mock choice of a validated option.'}))}));
  const a=await app({now:()=>tick,provider,card:async path=>path.startsWith('/cards/search')?{data:[better,second]}:path.slice(7)===second.id?second:facts.get(path.slice(7))});
  const first=await a.post('chat',input());expect(first.status).toBe(200);expect(first.body.review).not.toBeNull();tick+=61000;
  const next=await a.post('chat',{...input(),turns:[...input().turns,{role:'assistant',content:first.body.reply},{role:'user',content:'Other options, not that.'}]});expect(next.status).toBe(200);
  expect(next.body.review?.pairs.map((p:{add:{id:string}})=>p.add.id)||[]).not.toContain(first.body.review.pairs[0].add.id);
});


it('explains exhausted alternatives without another provider call and allows discussing a rejected card', async () => {
  let tick=Date.now(); const received:{context:unknown;turns:{role:string;content:string}[]}[]=[];
  const provider=async(context:unknown,turns:{role:"user"|"assistant";content:string}[])=>{received.push({context,turns});const ctx=context as {requestMode:string;validatedSwapOptions:{cutEntryId:string;addCardId:string}[]};return{reply:'Entry cards draws cards when it enters.',cardIds:[better.id],swaps:ctx.requestMode==='explain'?[]:ctx.validatedSwapOptions.slice(0,1).map(p=>({cutEntryId:p.cutEntryId,addCardId:p.addCardId,reason:'Mock validated draw choice.'}))};};
  const a=await app({now:()=>tick,provider});const first=await a.post('chat',input());expect(first.status,JSON.stringify(first.body)).toBe(200);expect(first.body.review).not.toBeNull();tick+=61000;
  const turns=[...input().turns,{role:'assistant',content:first.body.reply},{role:'user',content:'Other options, not that.'}];const alternative=await a.post('chat',{...input(),turns});expect(alternative.status).toBe(200);expect(alternative.body.review).toBeNull();expect(alternative.body.reply).toContain('No new eligible options');expect(received).toHaveLength(1);tick+=61000;
  const why=await a.post('chat',{...input(),turns:[...turns,{role:'assistant',content:alternative.body.reply},{role:'user',content:'Why Entry cards?'}]});expect(why.status).toBe(200);expect(why.body.review).toBeNull();expect(why.body.reply).toContain('Entry cards');expect(received[1].turns).toHaveLength(5);expect((received[1].context as {requestMode:string}).requestMode).toBe('explain');
});

it('passes more than twelve messages plus latest verified deck state to the mock provider', async () => {
  let context:unknown,history:unknown;const a=await app({provider:async(ctx,turns)=>{context=ctx;history=turns;return{reply:'Entry cards can help draw cards.',cardIds:[better.id],swaps:[]};}});
  const turns=[...input().turns,...Array.from({length:14},(_,i)=>({role:i%2?'user':'assistant',content:i%2?'Keep the same constraints.':'Previous option was discussed.'}))];const changed={...deck,notes:'Updated notes after undo.',revision:4};const result=await a.post('chat',{...input(),deck:changed,turns});expect(result.status).toBe(200);expect(history).toEqual(turns);expect((context as {deck:{notes:string}}).deck.notes).toBe(changed.notes);expect((context as {goal:string}).goal).toContain('card advantage');
});


it('reverifies a historical recommendation by ID when it is absent from fresh search results', async () => {
  let context:unknown;const a=await app({card:async path=>path.startsWith('/cards/search')?{data:[]}:facts.get(path.slice(7)),provider:async ctx=>{context=ctx;return{reply:'Entry cards draws two cards when it enters.',cardIds:[better.id],swaps:[]};}});
  const result=await a.post('chat',{...input(),turns:[...input().turns,{role:'assistant',content:'[Historical card references: '+better.id+']\nPreviously suggested Entry cards.'},{role:'user',content:'Why Entry cards?'}]});expect(result.status,JSON.stringify(result.body)).toBe(200);expect(result.body.review).toBeNull();expect((context as {cards:{id:string;oracle:string}[]}).cards.find(c=>c.id===better.id)?.oracle).toContain('draw two cards');
});


it('does not claim to undo or queue repeat suggestions when asked to undo in chat', async()=>{const a=await app();const result=await a.post('chat',{...input(),turns:[...input().turns,{role:'assistant',content:'A previous review was applied.'},{role:'user',content:'Undo that.'}]});expect(result.status).toBe(200);expect(result.body.reply).toContain('I have not undone');expect(result.body.review).toBeNull();expect(a.provider).not.toHaveBeenCalled();expect(a.commit).not.toHaveBeenCalled();});

it('supplies verified discussion evidence and rejects noncreature-only answers to creature-draw requests',async()=>{
 const canonical=(JSON.parse(readFileSync(new URL('./fixtures/discussionEvidenceCards.json',import.meta.url),'utf8')).cards as Card[]),engine=canonical.find(c=>c.name==='Enduring Curiosity')!,mission=canonical.find(c=>c.name==='Reconnaissance Mission')!;let context:unknown;
 const a=await app({card:async path=>path.startsWith('/cards/search')?{data:[engine,mission]}:facts.get(path.slice(7)),provider:async ctx=>{context=ctx;return{reply:'Repeatable creature draw engines: Reconnaissance Mission rewards combat damage.',cardIds:[mission.id],swaps:[]};}});
 const result=await a.post('chat',{...input(),turns:[{role:'user',content:'Explain repeatable creature draw for my deck. No edits.'}]});expect(result.status,JSON.stringify(result.body)).toBe(400);expect(result.body.error).toContain('noncreature');const guide=(context as {discussionGrounding:{newOptionDiscussionIds:string[];evidence:{id:string;isCreatureCard:boolean}[]}}).discussionGrounding;expect(guide.newOptionDiscussionIds).toContain(engine.id);expect(guide.newOptionDiscussionIds).not.toContain(mission.id);expect(guide.evidence.find(c=>c.id===engine.id)?.isCreatureCard).toBe(true);expect(a.commit).not.toHaveBeenCalled();
});

it('keeps prior rejection out of new discussion options and rejects directly recommending it again',async()=>{
 const canonical=(JSON.parse(readFileSync(new URL('./fixtures/discussionEvidenceCards.json',import.meta.url),'utf8')).cards as Card[]),engine=canonical.find(c=>c.name==='Enduring Curiosity')!,other=canonical.find(c=>c.name==='Faerie Mastermind')!;let context:unknown;
 const a=await app({card:async path=>path.startsWith('/cards/search')?{data:[engine,other]}:facts.get(path.slice(7)),provider:async ctx=>{context=ctx;return{reply:'Add Enduring Curiosity for recurring creature draw.',cardIds:[engine.id],swaps:[]};}});
 const result=await a.post('chat',{...input(),turns:[{role:'user',content:'Explain repeatable creature draw for my deck. No edits.'},{role:'assistant',content:'Consider adding Enduring Curiosity.'},{role:'user',content:'Other options, not that.'}]});expect(result.status,JSON.stringify(result.body)).toBe(400);expect(result.body.error).toContain('rejected');expect((context as {discussionGrounding:{newOptionDiscussionIds:string[]}}).discussionGrounding.newOptionDiscussionIds).not.toContain(engine.id);expect(a.commit).not.toHaveBeenCalled();
});

it('rejects an invented installed-card claim in a mocked protection discussion',async()=>{
 const canonical=(JSON.parse(readFileSync(new URL('./fixtures/discussionEvidenceCards.json',import.meta.url),'utf8')).cards as Card[]),gate=canonical.find(c=>c.name==='Dolmen Gate')!;
 const a=await app({card:async path=>path.startsWith('/cards/search')?{data:[gate]}:facts.get(path.slice(7)),provider:async()=>({reply:'Your Dolmen Gate prevents combat damage to your attackers.',cardIds:[gate.id],swaps:[]})});const result=await a.post('chat',{...input(),turns:[{role:'user',content:'Explain combat protection for my deck. No edits.'}]});expect(result.status,JSON.stringify(result.body)).toBe(400);expect(result.body.error).toContain('installed card');expect(a.commit).not.toHaveBeenCalled();
});
