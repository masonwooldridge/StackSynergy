import { tokenProductionProfile } from "./tokenPlan";
import type { Card } from "./model";
import { frontFaceType } from "./landAllocation";
import { frontText, oneShotManaFilter, sacrificesItself } from "./cardFunction";
export interface ManaAbility {
  cost: string;
  effect: string;
  output: number | null;
  manaCost: number;
  net: number | null;
  selfSacrifice: boolean;
  conditional: boolean;
}
const counts: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function outputMana(effect: string): number | null {
  const prose =
    /\badd (one|two|three|four|five|six|seven|eight|nine|ten|\d+) mana/i.exec(
      effect,
    );
  if (prose) return counts[prose[1].toLowerCase()] ?? Number(prose[1]);
  const groups = [...effect.matchAll(/(?:\{[WUBRGC]\})+/g)].map(
    (m) => (m[0].match(/\{/g) || []).length,
  );
  if (/for each|equal to|that much|\{X\}/i.test(effect)) return null;
  return groups.length ? Math.max(...groups) : null;
}
export function manaProfile(card: Card) {
  const text = frontText(card).replace(/\([^()]*\)/g, ""),
    type = frontFaceType(card),
    abilities: ManaAbility[] = [];
  for (const line of text.split("\n")) {
    const m = /^([^:\n]+):\s*(Add\b[^\n]*)/i.exec(line.trim());
    if (!m) continue;
    const cost = m[1],
      effect = m[2],
      tokens = cost.match(/\{[^}]+\}/g) || [];
    const manaCost = tokens.reduce(
        (n, t) =>
          n +
          (/^\{\d+\}$/.test(t)
            ? Number(t.slice(1, -1))
            : /^\{[WUBRGC](?:\/[WUBRGCP])?\}$/.test(t)
              ? 1
              : 0),
        0,
      ),
      out = outputMana(effect);
    const selfSacrifice =
      /sacrifice/i.test(cost) &&
      new RegExp(
        "sacrifice (?:this(?: artifact| creature| permanent)?|" +
          escape(card.name) +
          ")\\b",
        "i",
      ).test(cost);
    abilities.push({
      cost,
      effect,
      output: out,
      manaCost,
      net: out === null ? null : out - manaCost,
      selfSacrifice,
      conditional:
        /\btap (?:an?|another|one|two|three|four|five|six|\d+|x)\b/i.test(
          cost,
        ) ||
        /only if|for each|equal to|spend this mana only|opponent|unless|collect evidence|forage|discard|exile[^:]*graveyard|remove[^:]*counter|pay[^:]*life|sacrifice|tap an? (?:untapped )?creature|tap another|\{E\}|\{Q\}/i.test(
          cost + " " + effect,
        ) ||
        /doesn.t untap|does not untap/i.test(text) ||
        out === null,
    });
  }
  const reusable = abilities.filter(
      (a) => !a.selfSacrifice && (a.net === null || a.net > 0),
    ),
    reliable = reusable.some(
      (a) => a.net !== null && a.net > 0 && !a.conditional,
    ),
    oneShot = abilities.some(
      (a) => a.selfSacrifice && (a.net === null || a.net > 0),
    );
  const producing = abilities.length > 0;
  const ownSubject =
    "(?:this(?: artifact| creature| permanent| enchantment)?|" +
    escape(card.name) +
    "|" +
    escape(card.name.split(",")[0]) +
    ")";
  const entersTapped = new RegExp(
    ownSubject + " enters(?: the battlefield)? tapped",
    "i",
  ).test(text);
  const colors = [
    ...new Set(
      abilities.flatMap((a) =>
        /any colou?r|any type/i.test(a.effect)
          ? ["W", "U", "B", "R", "G"]
          : a.effect.match(/\{[WUBRGC]\}/g)?.map((c) => c[1]) || [],
      ),
    ),
  ];
  const landSearch =
      /search your library[^]*?(?:land|forest|plains|island|swamp|mountain)[^]*?(?:put|puts)[^]*?(?:onto|on) the battlefield/i.test(
        text,
      ),
    landSac = /sacrifice (?:a|another|one) land/i.test(text),
    twoLands = /search your library[^.\n]*two[^.\n]*land/i.test(text);
  const landRamp =
    (landSearch &&
      (!landSac || twoLands) &&
      !(/Land/.test(type) && sacrificesItself(card))) ||
    /play (?:an additional|two additional|one additional) lands?/i.test(text);
  const costReducer =
    /spells[^.\n]*cost[^.\n]*less to cast|abilities[^.\n]*cost[^.\n]*less to activate/i.test(
      text,
    ) && !/this spell costs/i.test(text);
  const ritual =
    /Instant|Sorcery/.test(type) &&
    /\badd\b[^.\n]*(?:mana|\{[WUBRGC]\})/i.test(text) &&
    !oneShotManaFilter(card) &&
    (outputMana(text) === null || (outputMana(text) || 0) > (card.cmc || 0));
  const fixing =
    colors.length > 1 ||
    abilities.some((a) =>
      /any colou?r|any type|different colou?rs?|\{[WUBRG]\} or \{[WUBRG]\}/i.test(
        a.effect,
      ),
    ) ||
    landSearch ||
    /lands you control[^.\n]*(?:have|are)[^.\n]*(?:basic land|add one mana|any colou?r)/i.test(
      text,
    );
  return {
    abilities,
    colors,
    reusableMana: reusable.length > 0,
    reliableAcceleration: reliable,
    manaRock:
      /Artifact/.test(type) && !/Land/.test(type) && reusable.length > 0,
    manaDork:
      /Creature/.test(type) && !/Land/.test(type) && reusable.length > 0,
    oneShotArtifactMana: /Artifact/.test(type) && oneShot,
    conditionalMana: reusable.some((a) => a.conditional),
    manaFilter: producing && !reusable.length && !oneShot,
    entersTapped,
    landRamp,
    costReducer,
    ritual,
    fixing,
  };
}
/** Source-list confidence only: selected support is not an untapped battlefield or cast probability. */
export function manaAvailability(card: Card, context: Card[] = []) {
  const p = manaProfile(card),
    type = frontFaceType(card),
    text = frontText(card),
    notes: string[] = [];
  const colorless = p.abilities.filter(
    (a) =>
      /\{C\}/.test(a.effect) &&
      (a.net === null || a.net > 0) &&
      !a.selfSacrifice,
  );
  const extraTap = colorless.some((a) =>
    /\btap (?:an?|another|one|two|three|four|five|six|\d+|x)\b/i.test(a.cost),
  );
  const needsCreature =
      extraTap && colorless.some((a) => /creature/i.test(a.cost)),
    needsArtifact = extraTap && colorless.some((a) => /artifact/i.test(a.cost));
  const enablers = extraTap
    ? [
        ...new Map(
          context
            .filter(
              (c) => (c.oracle_id || c.id) !== (card.oracle_id || card.id),
            )
            .map((c) => [c.oracle_id || c.id, c]),
        ).values(),
      ].filter((c) => {
        const token = tokenProductionProfile(c),
          t = frontFaceType(c);
        return (
          (needsCreature && (/Creature/.test(t) || token.ownCreature)) ||
          (needsArtifact &&
            (/Artifact/.test(t) ||
              token.ownResource ||
              (token.ownCreature &&
                /creat[^.\n]*artifact creature token/i.test(frontText(c)))))
        );
      }).length
    : 0;
  const summoningDelay =
    /Creature/.test(type) &&
    colorless.some((a) => /\{T\}/.test(a.cost)) &&
    !/\bhaste\b/i.test(text);
  const independent = colorless.some((a) => !a.conditional && a.manaCost === 0);
  const fastIndependent =
    !/Land/.test(type) &&
    (!/Creature/.test(type) || /\bhaste\b/i.test(text)) &&
    typeof card.cmc === "number" &&
    card.cmc <= 2 &&
    !/\{C\}/.test(card.mana_cost || "") &&
    !p.entersTapped &&
    independent;
  if (extraTap)
    notes.push(
      `Colorless engine needs another eligible untapped permanent; ${enablers} distinct selected enablers${enablers ? " provide list support" : " do not establish support"}. Tokens/resources are not assumed already available. This is conditional production, not an independent early source.`,
    );
  if (summoningDelay)
    notes.push(
      "This creature's own {T} mana ability normally waits for haste or a later turn; it is not credited as an independent early colorless source.",
    );
  if (colorless.some((a) => a.conditional) && !extraTap)
    notes.push(
      "Colorless production has an activation/resource restriction; it is not credited as an independent early source.",
    );
  return {
    explicitColorless: colorless.length > 0,
    fastIndependentColorless: fastIndependent,
    delayedColorless: independent && !fastIndependent,
    summoningDelay,
    conditionalColorless: colorless.some((a) => a.conditional),
    additionalTap: extraTap,
    selectedEnablers: enablers,
    conditionalSupportInList: extraTap && enablers > 0,
    notes,
  };
}

export function cardFunctionFacts(card: Card) {
  const raw = frontText(card),
    text = raw.replace(/\([^()]*\)/g, ""),
    type = frontFaceType(card),
    mana = manaProfile(card),
    draw =
      /\bdraw (?:a|one|two|three|four|five|six|seven|x|that many|cards|a number of)[^.\n]*cards?/i.test(
        text,
      );
  const drawIndex = text.search(/\bdraw\b/i),
    discardIndex = text.search(/\bdiscard\b/i),
    discard = discardIndex >= 0,
    loot = draw && discard && drawIndex < discardIndex,
    rummage = draw && discard && discardIndex < drawIndex;
  const cantrip =
    /Instant|Sorcery/.test(type) &&
    draw &&
    !discard &&
    ((/draw (?:a|one) card/i.test(text) &&
      !/draw (?:two|three|four|five|six|seven)/i.test(text)) ||
      /draw three cards[^]*?put two cards from your hand on top/i.test(text));
  const counterspell =
      /counter target[^.\n]{0,45}(?:spell|ability)(?![^.\n]*you control)/i.test(
        text,
      ),
    bounce =
      /return target[^.\n]*(?:creature|permanent|artifact|enchantment)[^.\n]*to (?:its|their) owner's hand/i.test(
        text,
      ) && !/return target[^.\n]*graveyard/i.test(text),
    blink =
      /exile[^]*?(?:return|put)[^]*?(?:battlefield|under (?:your|its owner's) control)/i.test(
        text,
      ) && !/return[^.\n]*to[^.\n]*hand/i.test(text);
  const removal =
    counterspell ||
    bounce ||
    (/(?:destroy|exile) target (?:nonland |noncreature |attacking |blocking |tapped |untapped )?(?:creature|artifact|enchantment|permanent)/i.test(
      text,
    ) &&
      !(/target[^.\n]{0,35}you control/i.test(text) && blink)) ||
    /owner of target[^.\n]*permanent shuffles it into their library/i.test(
      text,
    ) ||
    /deals? [^\n.]{0,20}damage to any target/i.test(text);
  const wipes =
    (/(?:destroy|exile) all[^.\n]{0,60}(?:creatures|nonland permanents|artifacts|enchantments)/i.test(
      text,
    ) &&
      !/all[^.\n]{0,30}you control/i.test(text)) ||
    /damage to each creature|return all[^]*?(?:creatures|nonland permanents)[^]*?hands?|(?:all )?creatures get -[X0-9]+\/-[X0-9]+/i.test(
      text,
    ) ||
    (/overload/i.test(text) && bounce);
  const protection =
    /(?:target (?:creature|permanent)|creatures you control|permanents you control|equipped creature|enchanted creature)[^.\n]*(?:hexproof|indestructible|protection from|ward|shroud|regenerate|phases out)/i.test(
      text,
    ) ||
    /regenerate target creature|phase out[^.\n]*you control|prevent all combat damage[^.\n]*attacking creatures you control/i.test(
      text,
    );
  const auraReanimation =
    /enchant creature card in a graveyard/i.test(text) &&
    /return enchanted creature card to the battlefield/i.test(text);
  const recursion =
      auraReanimation ||
      /return[^]*?(?:card|creature|permanent)[^]*?graveyard[^]*?(?:hand|battlefield)/i.test(
        text,
      ) ||
      /(?:cast|play)[^.\n]*(?:from|in) your graveyard/i.test(text),
    reanimation =
      auraReanimation ||
      /return[^]*?(?:card|creature|permanent)[^]*?graveyard[^]*?(?:to|onto) the battlefield/i.test(
        text,
      );
  const activatedSac =
    /^[^:\n]*sacrifice (?:a |an |another )?(?:creature|artifact|permanent|goblin)[^:\n]*:/im.test(
      text,
    ) &&
    /Creature|Artifact|Enchantment/.test(type) &&
    !(
      /sacrifice (?:this|\bself\b)/i.test(text) &&
      !/sacrifice (?:a|another) (?:creature|artifact|permanent)/i.test(text)
    );
  const death =
      /\b(?:when|whenever)[^.\n]*(?:dies|die|put into a graveyard from the battlefield)/i.test(
        text,
      ),
    etb =
      /\b(?:when|whenever)[^.\n]*enters(?: the battlefield)?/i.test(text) &&
      !/\bwhen you cast[^.\n]*enters/i.test(text),
    aristocrats =
      death &&
      /(?:opponent|each player)[^]*?(?:loses?|damage)|gain[^.\n]*life/i.test(
        text,
      );
  const tokens =
      /creat[^.\n]*(?:token|tokens)/i.test(text) &&
      !/opponent creates|opponents create|its controller creates/i.test(text),
    treasure =
      /creat[^.\n]*treasure/i.test(text) &&
      !/opponent creates|opponents create/i.test(text),
    tutor = /search your library[^]*?(?:card|cards)/i.test(text),
    stax =
      /spells[^.\n]*(?:opponents|players)[^.\n]*cost[^.\n]*more|noncreature spells cost[^.\n]*more|players can.t[^.\n]*(?:cast|untap|search)|can.t cast more than|(?:artifacts|creatures|lands)[^.\n]*enter[^.\n]*tapped/i.test(
        text,
      ),
    counters =
      /proliferate|(?:put|enters with)[^.\n]*counters?|\+1\/\+1 counter/i.test(
        text,
      );
  const freeSacrificeOutlet =
    activatedSac &&
    text.split("\n").some((line) => {
      const m = /^([^:]+):/.exec(line);
      return (
        !!m &&
        /sacrifice (?:a |an |another )?(?:creature|artifact|permanent|goblin)/i.test(
          m[1],
        ) &&
        !/\{(?:[0-9]+|[WUBRGC]|[WUBRG]\/[WUBRGP])\}/.test(m[1])
      );
    });
  const flags: Record<string, boolean> = {
    "mana-rock": mana.manaRock,
    "mana-dork": mana.manaDork,
    "land-ramp": mana.landRamp,
    ramp: mana.manaRock || mana.manaDork || mana.landRamp,
    fixing: mana.fixing,
    "cost-reduction": mana.costReducer,
    ritual: mana.ritual,
    "one-shot-artifact-mana": mana.oneShotArtifactMana,
    treasure: treasure,
    "card-draw": draw,
    cantrip: cantrip,
    loot: loot,
    rummage: rummage,
    removal: removal && !counterspell,
    "board-wipe": wipes,
    counterspell: counterspell,
    "permanent-counters": counters,
    protection: protection,
    blink: blink,
    bounce: bounce,
    recursion: recursion,
    reanimation: reanimation,
    "sacrifice-outlet": activatedSac,
    "free-sacrifice-outlet": freeSacrificeOutlet,
    aristocrats: aristocrats,
    tokens: tokens,
    "go-wide":
      tokens ||
      /creatures you control[^.\n]*(?:get \+|have double strike|gain haste)/i.test(
        text,
      ),
    voltron:
      /Equipment|Aura/.test(type) ||
      /equipped creature|enchanted creature/i.test(text),
    clone:
      /Creature/.test(type) && /\benter(?:s)?[^.\n]*\bas a copy of/i.test(text),
    etb: etb,
    "death-trigger": death,
    tutor: tutor,
    stax: stax,
  };
  return {
    flags,
    mana,
    drawProfile: { draw, cantrip, loot, rummage },
    conditions: [
      ...(mana.manaRock && mana.manaDork
        ? ["Artifact-creature hybrid: both a mana rock and a mana dork."]
        : []),
      ...(mana.conditionalMana
        ? [
            mana.abilities.some((a) => /collect evidence/i.test(a.cost))
              ? "Conditional mana: collecting evidence consumes graveyard cards; early acceleration is not guaranteed."
              : "Conditional mana; inspect the activation/output restrictions.",
          ]
        : []),
      ...(mana.entersTapped
        ? ["Enters tapped, including conditional enters-tapped clauses."]
        : []),
      ...(mana.manaDork
        ? ["Creature tap abilities may need haste or a turn before activation."]
        : []),
      ...(mana.oneShotArtifactMana
        ? ["One-shot artifact mana, not a reusable rock."]
        : []),
    ],
  };
}
