import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { Card } from "../shared/model";
import { parseAIRequest, matchesAIRequest } from "../shared/aiConstraints";
const dataset = JSON.parse(
  readFileSync(new URL("../evals/mtg-requests.json", import.meta.url), "utf8"),
);
const cards = JSON.parse(
  readFileSync(
    new URL("./fixtures/mtgTermCards.json", import.meta.url),
    "utf8",
  ),
).cards as Card[];
for (const c of dataset.cases.filter(
  (c: { split: string }) => c.split === "development",
)) {
  it(`evaluation request constraints: ${c.id}`, () => {
    const request = parseAIRequest([{ role: "user", content: c.prompt }]);
    expect(request).toMatchObject(c.expected);
    expect(Boolean(request.clarifications?.length)).toBe(c.clarification);
  });
  for (const [names, match] of [
    [c.positiveCards, true],
    [c.negativeCards, false],
  ] as const) {
    for (const name of names)
      it(`canonical function adherence: ${c.id} / ${name} / ${match}`, () => {
        const card = cards.find((card) => card.name === name);
        expect(card, "Canonical fixture must exist").toBeDefined();
        expect(
          matchesAIRequest(
            card!,
            parseAIRequest([{ role: "user", content: c.prompt }]),
          ),
        ).toBe(match);
      });
  }
}
it("keeps held-out strategic cases reserved rather than scoring parser tests as model success", () => {
  expect(
    dataset.cases.filter((c: { split: string }) => c.split === "held-out")
      .length,
  ).toBe(3);
  expect(
    dataset.cases
      .filter((c: { split: string }) => c.split === "held-out")
      .every((c: { status: string }) => c.status === "reserved-unscored"),
  ).toBe(true);
});
