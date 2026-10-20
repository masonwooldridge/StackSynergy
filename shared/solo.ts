import type { Card, Document } from "./model";
export const soloZones = [
  "library",
  "hand",
  "battlefield",
  "graveyard",
  "exile",
  "command",
  "stack",
] as const;
export type SoloZone = (typeof soloZones)[number];
export const phases = [
  "Untap",
  "Upkeep",
  "Draw",
  "Main 1",
  "Combat",
  "Main 2",
  "End",
] as const;
export type SoloPiece = {
  id: string;
  card: Card;
  zone: SoloZone;
  tapped: boolean;
  flipped: boolean;
  counters: number;
  token?: boolean;
};
export type SoloState = {
  pieces: SoloPiece[];
  life: number;
  poison: number;
  damage: number;
  turn: number;
  phase: number;
  mulls: number;
  freeMulligan: boolean;
  stage: "opening" | "playing";
  mana: Record<string, number>;
  casts: Record<string, number>;
  log: string[];
};
export type SoloAction =
  | { type: "draw"; count: number }
  | { type: "mulligan" }
  | { type: "keep"; bottom: string[] }
  | { type: "move"; id: string; zone: SoloZone; position?: "top" | "bottom" }
  | { type: "tap" | "flip" | "cast" | "removeToken"; id: string }
  | { type: "counter"; id: string; delta: number }
  | { type: "life" | "poison" | "damage"; delta: number }
  | { type: "mana"; color: string; delta: number }
  | { type: "nextTurn"; draw: boolean }
  | { type: "phase" }
  | { type: "shuffle" }
  | { type: "token"; name: string; stats: string }
  | { type: "freeMulligan"; value: boolean };
export function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const limit = 4294967296 - (4294967296 % (i + 1));
    let x;
    do {
      x = crypto.getRandomValues(new Uint32Array(1))[0];
    } while (x >= limit);
    const j = x % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const reset = (p: SoloPiece, zone: SoloZone): SoloPiece => ({
  ...p,
  zone,
  tapped: false,
  counters: 0,
  flipped: false,
});
function draw(state: SoloState, count: number) {
  const ids = new Set(
    state.pieces
      .filter((p) => p.zone === "library")
      .slice(0, count)
      .map((p) => p.id),
  );
  state.pieces = state.pieces.map((p) =>
    ids.has(p.id) ? { ...p, zone: "hand" } : p,
  );
  return ids.size;
}
export function startSolo(deck: Document): SoloState {
  const pieces = shuffle(
    deck.entries
      .filter((e) => e.board === "mainboard" || e.board === "commander")
      .flatMap((e) =>
        Array.from({ length: e.qty }, () => ({
          id: crypto.randomUUID(),
          card: e.card,
          zone: (e.board === "commander" ? "command" : "library") as SoloZone,
          tapped: false,
          flipped: false,
          counters: 0,
        })),
      ),
  );
  const state: SoloState = {
    pieces,
    life: deck.format === "commander" ? 40 : 20,
    poison: 0,
    damage: 0,
    turn: 1,
    phase: 0,
    mulls: 0,
    freeMulligan: deck.format === "commander",
    stage: "opening",
    mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    casts: {},
    log: [],
  };
  const n = draw(state, 7);
  state.log = [`Opening hand: ${n} cards`];
  return state;
}
export function bottomRequired(s: SoloState) {
  return Math.min(7, Math.max(0, s.mulls - (s.freeMulligan ? 1 : 0)));
}
export function soloAction(previous: SoloState, action: SoloAction): SoloState {
  const s: SoloState = {
    ...previous,
    pieces: previous.pieces.map((p) => ({ ...p })),
    mana: { ...previous.mana },
    casts: { ...previous.casts },
    log: [...previous.log],
  };
  const p =
    "id" in action ? s.pieces.find((p) => p.id === action.id) : undefined;
  if ("id" in action && !p) throw Error("Select a card first.");
  let message = "";
  switch (action.type) {
    case "mulligan": {
      if (s.stage !== "opening")
        throw Error("Restart to test another opening hand.");
      if (s.mulls >= 7 + (s.freeMulligan ? 1 : 0))
        throw Error("You have reached a zero-card keep.");
      s.pieces = shuffle(
        s.pieces.map((p) => (p.zone === "hand" ? reset(p, "library") : p)),
      );
      s.mulls++;
      draw(s, 7);
      message = `Mulligan ${s.mulls}: choose ${bottomRequired(s)} to bottom when keeping`;
      break;
    }
    case "keep": {
      if (s.stage !== "opening") throw Error("Opening hand already kept.");
      if (!s.pieces.some((piece) => piece.zone === "hand")) throw Error("Add mainboard cards before keeping an opening hand.");
      const ids = new Set(action.bottom);
      if (
        ids.size !== action.bottom.length ||
        ids.size !==
          Math.min(
            bottomRequired(s),
            s.pieces.filter((p) => p.zone === "hand").length,
          ) ||
        action.bottom.some(
          (id) => !s.pieces.some((p) => p.id === id && p.zone === "hand"),
        )
      )
        throw Error(
          `Choose ${bottomRequired(s)} cards from your hand to bottom.`,
        );
      const bottom = action.bottom.map((id) =>
        reset(
          s.pieces.find((p) => p.id === id)!,
          "library",
        ),
      );
      s.pieces = [...s.pieces.filter((p) => !ids.has(p.id)), ...bottom];
      s.stage = "playing";
      s.phase = 3;
      message = `Kept ${s.pieces.filter((p) => p.zone === "hand").length} cards`;
      break;
    }
    case "draw":
      if (s.stage !== "playing") throw Error("Keep your opening hand first.");
      message = `Drew ${draw(s, Math.min(100, Math.max(1, Math.floor(action.count))))} cards`;
      break;
    case "move": {
      if (s.stage !== "playing") throw Error("Keep your opening hand first.");
      const moved =
        p!.zone === action.zone ? { ...p! } : reset(p!, action.zone);
      s.pieces = s.pieces.filter((x) => x.id !== p!.id);
      if (p!.token && action.zone !== "battlefield") {
        message = `${p!.card.name} token left the battlefield`;
        break;
      }
      if (action.zone === "library" && action.position !== "bottom")
        s.pieces = [moved, ...s.pieces];
      else s.pieces.push(moved);
      message = `${p!.card.name} → ${action.zone}${action.zone === "library" ? ` ${action.position || "top"}` : ""}`;
      break;
    }
    case "tap":
      if (p!.zone !== "battlefield")
        throw Error("Only battlefield cards can tap.");
      p!.tapped = !p!.tapped;
      message = `${p!.tapped ? "Tapped" : "Untapped"} ${p!.card.name}`;
      break;
    case "flip":
      p!.flipped = !p!.flipped;
      message = `Turned over ${p!.card.name}`;
      break;
    case "counter":
      p!.counters = Math.max(0, p!.counters + action.delta);
      message = `${p!.card.name}: ${p!.counters} counters`;
      break;
    case "cast": {
      if (s.stage !== "playing" || !["hand", "command"].includes(p!.zone))
        throw Error("Cast from your hand or command zone.");
      if ((p!.card.type_line || "").includes("Land"))
        throw Error("Play lands directly onto the battlefield.");
      if (p!.zone === "command") s.casts[p!.id] = (s.casts[p!.id] || 0) + 1;
      p!.zone = "stack";
      message = `Cast ${p!.card.name} (pay costs manually)`;
      break;
    }
    case "removeToken":
      if (!p!.token) throw Error("Only tokens can be removed.");
      s.pieces = s.pieces.filter((x) => x.id !== p!.id);
      message = `Removed ${p!.card.name}`;
      break;
    case "life":
      s.life += action.delta;
      message = `Life ${s.life}`;
      break;
    case "poison":
    case "damage":
      s[action.type] = Math.max(0, s[action.type] + action.delta);
      message = `${action.type} ${s[action.type]}`;
      break;
    case "mana":
      if (!(action.color in s.mana)) throw Error("Unknown mana color.");
      s.mana[action.color] = Math.max(0, s.mana[action.color] + action.delta);
      message = `${action.color} mana ${s.mana[action.color]}`;
      break;
    case "nextTurn":
      if (s.stage !== "playing") throw Error("Keep your opening hand first.");
      s.turn++;
      s.phase = action.draw ? 3 : 0;
      s.pieces = s.pieces.map((p) =>
        p.zone === "battlefield" ? { ...p, tapped: false } : p,
      );
      s.mana = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
      message = `Turn ${s.turn}: untapped${action.draw ? `, drew ${draw(s, 1)}` : ""}`;
      break;
    case "phase":
      if (s.stage !== "playing") throw Error("Keep your opening hand first.");
      if (s.phase === phases.length - 1)
        return soloAction(s, { type: "nextTurn", draw: false });
      s.phase++;
      s.mana = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
      message = phases[s.phase];
      break;
    case "shuffle":
      s.pieces = [
        ...s.pieces.filter((p) => p.zone !== "library"),
        ...shuffle(s.pieces.filter((p) => p.zone === "library")),
      ];
      message = "Shuffled library";
      break;
    case "token":
      if (s.stage !== "playing") throw Error("Keep your opening hand first.");
      s.pieces.push({
        id: crypto.randomUUID(),
        card: {
          id: crypto.randomUUID(),
          name: action.name.trim().slice(0, 80) || "Token",
          type_line: "Token Creature",
          oracle_text: action.stats.slice(0, 120),
        },
        zone: "battlefield",
        token: true,
        tapped: false,
        flipped: false,
        counters: 0,
      });
      message = `Created ${action.name || "Token"}`;
      break;
    case "freeMulligan":
      if (s.stage !== "opening")
        throw Error("Mulligan settings apply before keeping.");
      s.freeMulligan = action.value;
      message = action.value ? "First mulligan free" : "No free mulligan";
      break;
  }
  s.log = [message, ...s.log].slice(0, 150);
  return s;
}

/** Treat persisted browser data as untrusted; reject malformed sessions before rendering. */
export function isSoloState(value: unknown): value is SoloState {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  const integer = (v: unknown) =>
    typeof v === "number" && Number.isSafeInteger(v) && Math.abs(v) <= 1000000;
  const record = (v: unknown) =>
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.values(v).every((n) => integer(n) && (n as number) >= 0);
  if (
    !["life", "poison", "damage", "turn", "phase", "mulls"].every((key) =>
      integer(s[key]),
    ) ||
    (s.phase as number) < 0 ||
    (s.phase as number) >= phases.length ||
    (s.turn as number) < 1 ||
    (s.mulls as number) < 0 ||
    (s.mulls as number) > (s.freeMulligan ? 8 : 7) ||
    typeof s.freeMulligan !== "boolean" ||
    !["opening", "playing"].includes(String(s.stage)) ||
    !record(s.mana) ||
    !record(s.casts) ||
    !Array.isArray(s.log) ||
    s.log.length > 1000 ||
    !s.log.every((line) => typeof line === "string" && line.length <= 10000) ||
    !Array.isArray(s.pieces) ||
    s.pieces.length > 10000
  )
    return false;
  if (
    !["W", "U", "B", "R", "G", "C"].every((color) =>
      integer((s.mana as Record<string, unknown>)[color]),
    )
  )
    return false;
  const ids = new Set<string>();
  return s.pieces.every((piece) => {
    if (!piece || typeof piece !== "object") return false;
    const p = piece as Record<string, unknown>;
    if (
      typeof p.id !== "string" ||
      ids.has(p.id) ||
      !soloZones.includes(p.zone as SoloZone) ||
      typeof p.tapped !== "boolean" ||
      typeof p.flipped !== "boolean" ||
      !integer(p.counters) ||
      (p.token !== undefined && typeof p.token !== "boolean") ||
      !p.card ||
      typeof p.card !== "object"
    )
      return false;
    const c = p.card as Record<string, unknown>;
    if (
      typeof c.id !== "string" ||
      typeof c.name !== "string" ||
      c.name.length > 300
    )
      return false;
    for (const key of [
      "type_line",
      "oracle_text",
      "mana_cost",
      "imageUrl",
      "power",
      "toughness",
    ]) {
      if (c[key] !== undefined && typeof c[key] !== "string") return false;
    }
    const imageValid = (v: unknown) =>
      v === undefined ||
      (!!v &&
        typeof v === "object" &&
        typeof (v as Record<string, unknown>).normal === "string");
    if (!imageValid(c.image_uris)) return false;
    if (
      c.card_faces !== undefined &&
      (!Array.isArray(c.card_faces) ||
        !c.card_faces.every(
          (face) =>
            face &&
            typeof face === "object" &&
            typeof face.name === "string" &&
            imageValid(face.image_uris),
        ))
    )
      return false;
    ids.add(p.id);
    return true;
  });
}
