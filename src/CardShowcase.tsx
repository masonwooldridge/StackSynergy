import { useEffect, useState } from "react";
import { api } from "./api";
import { image } from "../shared/model";
import type { Card } from "../shared/model";
export default function CardShowcase({
  onSelect,
}: {
  onSelect: (card: Card) => void;
}) {
  const [cards, setCards] = useState<Card[]>([]);
  useEffect(() => {
    let alive = true;
    Promise.allSettled(
      ["The One Ring", "Atraxa, Praetors' Voice", "Lightning Bolt"].map(
        (name) => api<Card>("/cards?mode=named&q=" + encodeURIComponent(name)),
      ),
    ).then((results) => {
      if (alive)
        setCards(
          results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])),
        );
    });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div className="showcase" aria-label="Featured cards from the archive">
      <svg
        className="archive-seal"
        viewBox="0 0 460 460"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="230" cy="230" r="205" />
        <circle cx="230" cy="230" r="193" strokeDasharray="1 14" />
        <circle cx="230" cy="230" r="166" />
        <path d="m230 25 178 307H52ZM230 435 52 128h356Z" />
        <path d="M25 230h410M230 25v410" opacity=".35" />
      </svg>
      <div className="showcase-cards">
        {cards.map((c, i) => (
          <button
            className={`showcase-card showcase-card-${i}`}
            key={c.id}
            aria-label={`View ${c.name}`}
            onClick={() => onSelect(c)}
          >
            {image(c) && <img src={image(c)} alt={c.name} draggable={false} />}
          </button>
        ))}
      </div>
      <span className="showcase-caption">
        FROM THE ARCHIVE <span>✦</span> EXPLORE EVERY PRINTING
      </span>
    </div>
  );
}
