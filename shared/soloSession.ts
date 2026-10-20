import type { Card } from "./model";
import { isSoloState, type SoloState, type SoloPiece } from "./solo";
type CompactState = Omit<SoloState, "pieces"> & { pieces: (Omit<SoloPiece, "card"> & { cardId: string })[] };
export function encodeSoloSession(version: string, state: SoloState, past: SoloState[], future: SoloState[]) {
  const cards: Record<string, Card> = Object.create(null);
  const compact = (snapshot: SoloState): CompactState => ({ ...snapshot, pieces: snapshot.pieces.map(({ card, ...piece }) => {
    cards[card.id] = card;
    return { ...piece, cardId: card.id };
  }) });
  const current = compact(state), history = past.slice(-50).map(compact), redo = future.slice(0, 50).map(compact);
  return JSON.stringify({ schema: 3, version, cards, state: current, past: history, future: redo });
}
export function decodeSoloSession(raw: string | null): { version: string; state: SoloState; past: SoloState[]; future: SoloState[] } | null {
  try {
    if (!raw || raw.length > 5_000_000) return null;
    const data = JSON.parse(raw);
    if (typeof data?.version !== "string") return null;
    const inflate = (snapshot: CompactState): SoloState => ({ ...snapshot, pieces: snapshot.pieces.map(({ cardId, ...piece }) => ({ ...piece, card: Object.prototype.hasOwnProperty.call(data.cards, cardId) ? data.cards[cardId] : undefined })) });
    const current = data.schema === 3 ? inflate(data.state) : data.state;
    if (!isSoloState(current)) return null;
    const history = (items: unknown): SoloState[] => {
      if (!Array.isArray(items)) return [];
      return items.slice(0, 50).flatMap((snapshot) => { try { const state = data.schema === 3 ? inflate(snapshot) : snapshot; return isSoloState(state) ? [state] : []; } catch { return []; } });
    };
    return { version: data.version, state: current, past: history(data.past), future: history(data.future) };
  } catch { return null; }
}
