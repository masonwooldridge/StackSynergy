import Papa from "papaparse";
import type { Entry } from "../shared/model";
export interface ImportRow {
  name: string;
  qty: number;
  set?: string;
  collector?: string;
  id?: string;
  language: string;
  condition: string;
  finish: string;
  purchasePrice: string;
  notes: string;
  tags: string;
  binder?: string;
  board: string;
}
export function parseImport(text: string): {
  rows: ImportRow[];
  errors: string[];
} {
  const rows: ImportRow[] = [];
  const errors: string[] = [];
  const defaults = {
    language: "en",
    condition: "near_mint",
    finish: "nonfoil",
    purchasePrice: "",
    notes: "",
    tags: "",
    board: "mainboard",
  };
  const csv = /\b(Name|Scryfall ID|Quantity)\b.*,/i.test(text.split("\n")[0]);
  if (csv) {
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase(),
    });
    errors.push(...result.errors.map((e) => `CSV ${e.row}: ${e.message}`));
    for (const [i, r] of result.data.entries()) {
      const get = (...keys: string[]) =>
        keys.map((k) => r[k]).find((v) => v !== undefined && v !== "") || "";
      const qty = Number(get("quantity", "qty", "count") || 1);
      const name = get("name", "card name");
      const id = get("scryfall id", "scryfall_id");
      if ((!name && !id) || !Number.isInteger(qty) || qty < 1 || qty > 10000) {
        errors.push(`Row ${i + 2}: missing identity or invalid quantity`);
        continue;
      }
      rows.push({
        ...defaults,
        name,
        id: id || undefined,
        qty,
        set: get("set code", "set") || undefined,
        collector: get("collector number") || undefined,
        language: get("language") || "en",
        condition: get("condition") || "near_mint",
        finish:
          get("finish") ||
          (get("foil").toLowerCase() === "true" ? "foil" : "nonfoil"),
        purchasePrice: get("purchase price"),
        notes: get("notes"),
        tags: get("tags"),
        binder: get("binder name", "binder") || undefined,
        board: get("board") || "mainboard",
      });
    }
  } else {
    let board = "mainboard";
    for (const [i, line] of text.split("\n").entries()) {
      if (!line.trim()) continue;
      if (/^\s*(Deck|Commander|Sideboard|Maybeboard)\s*$/i.test(line)) {
        board = /Commander/i.test(line)
          ? "commander"
          : /Sideboard/i.test(line)
            ? "sideboard"
            : /Maybeboard/i.test(line)
              ? "maybeboard"
              : "mainboard";
        continue;
      }
      const m = line.match(
        /^\s*(\d+)x?\s+(.+?)(?:\s+\(([A-Za-z0-9]+)\)\s+(\S+))?\s*$/,
      );
      if (!m || Number(m[1]) < 1 || Number(m[1]) > 10000) {
        errors.push(
          `Line ${i + 1}: expected quantity and name, optionally (SET) number`,
        );
        continue;
      }
      rows.push({
        ...defaults,
        board,
        qty: Number(m[1]),
        name: m[2],
        set: m[3]?.toLowerCase(),
        collector: m[4],
      });
    }
  }
  return { rows, errors };
}
export function exportCsv(entries: Entry[], binder: string) {
  return Papa.unparse(
    entries.map((e) => ({
      Name: e.card.name,
      Quantity: e.qty,
      "Set code": e.card.set || "",
      "Collector number": e.card.collector_number || "",
      "Scryfall ID": e.card.id,
      Language: e.language,
      Condition: e.condition,
      Foil: e.finish === "foil",
      Finish: e.finish,
      "Purchase price": e.purchasePrice,
      Notes: e.notes,
      Tags: e.tags,
      "Binder Name": binder,
      Board: e.board,
    })),
  );
}
export function exportDeck(entries: Entry[]) {
  return ["commander", "mainboard", "sideboard", "maybeboard"]
    .map((board) => {
      const rows = entries.filter((e) => e.board === board);
      return rows.length
        ? `${board === "mainboard" ? "Deck" : board[0].toUpperCase() + board.slice(1)}\n` +
            rows
              .map(
                (e) =>
                  `${e.qty} ${e.card.name}${e.card.set ? ` (${e.card.set.toUpperCase()}) ${e.card.collector_number}` : ""}`,
              )
              .join("\n")
        : "";
    })
    .filter(Boolean)
    .join("\n\n");
}
