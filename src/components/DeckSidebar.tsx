import { useDeckStore, getDeckStats } from "../store/useDeckStore";
import { deckToText } from "../utils/exportDeck";

export default function DeckSidebar() {
  const deck = useDeckStore((s) => s.deck);
  const { increment, decrement, removeCard, clearDeck } = useDeckStore();

  const stats = getDeckStats(deck);
  const exportText = deckToText(deck);
  const isEmpty = Object.keys(deck).length === 0;

  return (
    <aside className="w-72 p-4 border-l flex flex-col gap-4">
      {/* header */}
      <header className="flex items-center justify-between">
        <h2 className="font-bold text-lg">Current Deck</h2>
        {!stats.metadataIncomplete ? (
          <span className="text-green-600 text-xl">✓</span>
        ) : (
          <span className="text-red-600 text-xl">✗</span>
        )}
      </header>

      <p className="text-sm">
        {stats.numCards} cards
        {stats.metadataIncomplete &&
          " (import authoritative metadata to validate)"}
      </p>

      {/* empty state */}
      {isEmpty && (
        <p className="text-sm text-gray-500">
          No cards yet — click a card to add.
        </p>
      )}

      {/* card list */}
      <div className="flex-1 overflow-y-auto">
        {Object.values(deck).map(({ card, qty }) => (
          <div
            key={card.id}
            className="flex items-center gap-2 py-1 border-b last:border-b-0"
          >
            <span className="w-8 text-right">{qty}×</span>
            <span className="flex-1 truncate">{card.name}</span>
            <button onClick={() => increment(card.id)}>+</button>
            <button onClick={() => decrement(card.id)}>-</button>
            <button onClick={() => removeCard(card.id)}>🗑️</button>
          </div>
        ))}
      </div>

      {/* footer buttons */}
      {!isEmpty && (
        <div className="flex gap-2">
          <button
            className="flex-1 bg-green-600 text-white px-3 py-1 rounded"
            onClick={() => {
              navigator.clipboard.writeText(exportText);
              alert("Deck copied to clipboard!");
            }}
          >
            Export
          </button>

          <button
            className="flex-1 bg-red-600 text-white px-3 py-1 rounded"
            onClick={clearDeck}
          >
            Clear
          </button>
        </div>
      )}
    </aside>
  );
}
