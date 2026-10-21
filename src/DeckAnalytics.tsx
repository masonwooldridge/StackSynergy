import { colorlessSupport } from "../shared/basicMana";
import { frontFaceType } from "../shared/landAllocation";
import { interactionProfile } from "../shared/interactionProfile";
import { deploymentCost } from "../shared/deploymentCost";
import {
  castThresholdProfile,
  thresholdSupportNote,
} from "../shared/castThreshold";
import { constructionRoles } from "../shared/constructionPlan";
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
    if (!/\bLand\b/.test(frontFaceType(e.card)))
      bins[Math.min(7, Math.floor(e.card.cmc || 0))] += e.qty;
    for (const c of e.card.color_identity || [])
      colors[c] = (colors[c] || 0) + e.qty;
    for (const t of Object.keys(types))
      if (new RegExp("\\b" + t + "\\b").test(frontFaceType(e.card)))
        types[t] += e.qty;
    if (e.card.prices?.usd) priced += e.qty;
    const functional = constructionRoles(
      e.card,
      entries.find((e) => e.board === "commander")?.card || {
        id: "",
        name: "Unspecified commander",
      },
      entries.map((e) => e.card),
    );
    if (functional.includes("ramp")) roles.ramp += e.qty;
    if (functional.includes("advantage")) roles.draw += e.qty;
    if (functional.includes("interaction")) roles.interaction += e.qty;
    if (functional.includes("protection")) roles.protection += e.qty;
  }
  const max = Math.max(...bins, 1),
    colorless = colorlessSupport(entries);
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
        <small>Nonland front faces · mana value, not cast cost.</small>
      </section>
      {colorless.required.length > 0 && (
        <section>
          <h3>Explicit colorless support</h3>
          <p style={{ display: "block" }}>{colorless.note}</p>
        </section>
      )}
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
      {entries.some((e) => castThresholdProfile(e.card)) && (
        <section>
          <h3>Cast-threshold draw</h3>
          {entries
            .filter((e) => castThresholdProfile(e.card))
            .map((e) => (
              <p key={e.id}>
                {thresholdSupportNote(
                  e.card,
                  entries.map((e) => e.card),
                )}
              </p>
            ))}
          <small>
            An entry cantrip alone does not fill a repeated draw-engine slot.
            Counts are available cast choices, not guaranteed triggers.
          </small>
        </section>
      )}
      <details style={{ gridColumn: "1 / -1" }}>
        <summary>Interaction capabilities</summary>
        <p style={{ display: "block" }}>
          Interaction counts eligible answers, not universal or permanent
          removal. Target restrictions, temporary effects and setup remain
          separate.
        </p>
        {entries
          .map((e) => ({
            entry: e,
            profile: interactionProfile(
              e.card,
              entries.map((e) => e.card),
            ),
          }))
          .filter((x) => x.profile.present)
          .map((x) => (
            <p key={x.entry.id} style={{ display: "block" }}>
              <strong>{x.entry.card.name}</strong>:{" "}
              {x.profile.notes.length
                ? x.profile.notes.join(" ")
                : x.profile.effects
                    .map((e) => `${e.kind}: ${e.target}`)
                    .join(" ")}
            </p>
          ))}
      </details>
      <details style={{ gridColumn: "1 / -1" }}>
        <summary>Deployment payments and obligations</summary>
        <p>
          Mana curve uses printed mana value. The following payments and
          conditions are separate; life, cards and sacrifices have no invented
          mana price.
        </p>
        {entries
          .map((e) => ({
            entry: e,
            cost: deploymentCost(
              e.card,
              undefined,
              entries.map((e) => e.card),
            ),
          }))
          .filter((x) => x.cost.notes.length)
          .map((x) => (
            <p key={x.entry.id} style={{ display: "block" }}>
              <strong>{x.entry.card.name}</strong>: {x.cost.notes.join(" ")}
            </p>
          ))}
      </details>
      <section>
        <h3>Role estimates</h3>
        {Object.entries(roles).map(([t, n]) => (
          <p key={t}>
            {t} <strong>{n}</strong>
          </p>
        ))}
        <small>
          Heuristic roles; ramp means nonland acceleration, not ordinary mana
          lands. Overlapping, incomplete roles. {priced} copies with available
          USD prices. Mana-source production is not inferred from identity.
        </small>
      </section>
    </div>
  );
}
