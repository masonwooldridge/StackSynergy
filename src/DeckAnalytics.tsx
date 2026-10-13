import type { Document } from "../shared/model";
export default function DeckAnalytics({ deck }: { deck: Document }) {
  const entries = deck.entries.filter(
    (e) => e.board === "mainboard" || e.board === "commander",
  );
  const bins = Array(8).fill(0) as number[];
  const colors: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const types: Record<string, number> = {
    Land: 0,
    Creature: 0,
    Artifact: 0,
    Enchantment: 0,
    Instant: 0,
    Sorcery: 0,
    Planeswalker: 0,
    Battle: 0,
  };
  let priced = 0;
  const roles = { ramp: 0, draw: 0, interaction: 0, protection: 0 };
  for (const e of entries) {
    if (!e.card.type_line?.includes("Land"))
      bins[Math.min(7, Math.floor(e.card.cmc || 0))] += e.qty;
    for (const c of e.card.color_identity || [])
      colors[c] = (colors[c] || 0) + e.qty;
    for (const t of Object.keys(types))
      if (e.card.type_line?.includes(t)) types[t] += e.qty;
    if (e.card.prices?.usd) priced += e.qty;
    const text =
      e.card.oracle_text ||
      e.card.card_faces?.map((f) => f.oracle_text).join(" ") ||
      "";
    if (/add \{|search your library for.*land/i.test(text)) roles.ramp += e.qty;
    if (/draw .*card/i.test(text)) roles.draw += e.qty;
    if (/destroy target|exile target|counter target/i.test(text))
      roles.interaction += e.qty;
    if (/hexproof|indestructible|protection from/i.test(text))
      roles.protection += e.qty;
  }
  const max = Math.max(...bins, 1);
  return (
    <div className="analytics">
      <section>
        <h3>Mana curve</h3>
        <div className="curve">
          {bins.map((n, i) => (
            <div key={i}>
              <span>{n}</span>
              <i style={{ height: Math.max(2, (n / max) * 90) }} />
              <small>{i === 7 ? "7+" : i}</small>
            </div>
          ))}
        </div>
        <small>Nonlands · mana value, not cast cost.</small>
      </section>
      <section>
        <h3>Card types</h3>
        {Object.entries(types)
          .filter(([, n]) => n)
          .map(([t, n]) => (
            <p key={t}>
              {t} <strong>{n}</strong>
            </p>
          ))}
      </section>
      <section>
        <h3>Color identity</h3>
        {Object.entries(colors).map(([c, n]) => (
          <p key={c}>
            {c} <strong>{n}</strong>
          </p>
        ))}
        <small>Multicolor cards count in each color.</small>
      </section>
      <section>
        <h3>Role estimates</h3>
        {Object.entries(roles).map(([t, n]) => (
          <p key={t}>
            {t} <strong>{n}</strong>
          </p>
        ))}
        <small>
          Heuristic text matching; overlapping, incomplete roles. {priced}{" "}
          copies with available USD prices. Mana-source production is not
          inferred from identity.
        </small>
      </section>
    </div>
  );
}
