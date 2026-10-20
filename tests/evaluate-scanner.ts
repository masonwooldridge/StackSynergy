// Opt-in live evaluation. Public Scryfall card images, never demo scan results.
import { createWorker } from "tesseract.js";
import { mkdirSync, writeFileSync } from "node:fs";
const names = [
  "Lightning Bolt",
  "Sol Ring",
  "Delver of Secrets",
  "Fire // Ice",
  "Forest",
];
mkdirSync("data/scanner-evaluation", { recursive: true });
const worker = await createWorker("eng");
const results = [];
for (const name of names) {
  await new Promise((r) => setTimeout(r, 200));
  const r = await fetch(
    "https://api.scryfall.com/cards/named?exact=" + encodeURIComponent(name),
    {
      headers: {
        "User-Agent": "StackSynergy/0.1 scanner evaluation",
        Accept: "application/json",
      },
    },
  );
  if (!r.ok) throw Error(`Scryfall ${r.status}`);
  const c = await r.json();
  const url = c.image_uris?.normal || c.card_faces?.[0]?.image_uris.normal;
  const bytes = Buffer.from(
    await (
      await fetch(url, {
        headers: {
          "User-Agent": "StackSynergy/0.1 scanner evaluation",
          Accept: "image/*",
        },
      })
    ).arrayBuffer(),
  );
  const path = "data/scanner-evaluation/" + c.id + ".jpg";
  writeFileSync(path, bytes);
  const start = Date.now();
  const { data } = await worker.recognize(path);
  const expected = name.split(" // ")[0].toLowerCase();
  const recognized = data.text.toLowerCase();
  results.push({
    name,
    printing: c.id,
    source: c.scryfall_uri,
    path,
    confidence: data.confidence,
    elapsedMs: Date.now() - start,
    nameVisible: recognized.includes(expected),
    text: data.text,
  });
}
await worker.terminate();
writeFileSync(
  "data/scanner-evaluation/results.json",
  JSON.stringify(results, null, 2),
);
console.log(
  JSON.stringify(
    results.map(({ text, ...r }) => ({
      ...r,
      textPreview: text.split("\n").slice(0, 3).join(" "),
    })),
    null,
    2,
  ),
);
