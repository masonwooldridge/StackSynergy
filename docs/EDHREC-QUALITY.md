# Commander recommendation quality — 2026-10-19

This changes actual discovery, ranking and selection. No model was trained, no paid API was used and no credentials were added. The live frontend and API use the new shared logic; Safari remains on the existing :5173 preview. Existing styling and saved decks are preserved.

## Public sources and freshness

Reviewed the permitted public commander pages on October 19:

- [Satya](https://edhrec.com/commanders/satya-aetherflux-genius): energy, clones and tokens; selected examples emphasize repeatable energy, creature entry and additional attacks.
- [Krenko](https://edhrec.com/commanders/krenko-mob-boss): Goblins/tokens; selected examples cover fuel, haste, sacrifice and damage payoffs.
- [Muldrotha](https://edhrec.com/commanders/muldrotha-the-gravetide): reanimator/self-mill/graveyard; selected examples cover recurring sacrifice permanents and fuel.
- [Talrand](https://edhrec.com/commanders/talrand-sky-summoner): spellslinger/control; selected examples cover cheap selection and cast-trigger engines.

Also inspected [Satya's aggregate composition](https://edhrec.com/average-decks/satya-aetherflux-genius) (28 noncommander creatures, 37 lands) and [Talrand's](https://edhrec.com/average-decks/talrand-sky-summoner) (11 noncommander creatures, 40 instants/sorceries, 35 lands). These are context, not templates or mandatory quotas; those unfiltered aggregates do not match every budget/bracket. No full deck was copied or imported.

The source file contains only eight manually reviewed example names per commander (32 total), source URL, theme and review date. Names were resolved to actual Scryfall facts; exact-name search back-face matches are filtered. Reported EDHREC inclusion/lift percentages were inspected as context but are not stored, used as weights, or presented as live data. The small evidence bonus applies only after a card has a functional commander-rule match. Other commanders explicitly show no reviewed EDHREC profile.

App Scryfall cache expires after 24 hours. For fair algorithm comparison, both versions use identical frozen mixed-age public facts: the preserved baseline support pool plus refreshed first-page commander discovery and example searches. This is not a claim that every benchmark price/legality was freshly fetched today. The separate live UI journey uses the running API's normal current discovery/cache. Estimates exclude taxes/shipping and vendor availability.

## What changed

- Functional packages fill gaps after essential primary-role allocation: energy engines/copy value/attack access; typal fuel/engines; graveyard fuel/sacrifice value; cheap spell selection/spell engines. Packages may overlap; primary roles still count each copy once.
- Satya no longer treats every energy body as an equally good engine. Repeatable energy and useful outlets rank higher; copied-entry value must actually trigger from that creature entering. Landfall, non-token-only rewards, cast-only entry effects, singleton same-name searches and simple rummaging no longer receive misleading copied-value credit.
- Cheap spell ranking applies a modest high-mana penalty and penalizes cards with no normal mana cost instead of treating them as free casts. Talrand no longer selects Evermind/Ancestral Vision as ordinary cheap spells in this matrix.
- Equal draw/discard exchanges do not fill net-advantage slots. Own-board blink and delayed non-attacker punishment do not fill general wipe slots. Existing one-damage-ping and transform-only-land corrections remain enforced.
- Reviewed source/theme/package counts appear inside existing optional detail sections, keeping the restrained design intact.

No constraints are relaxed: singleton exceptions, color identity, supplied Commander legality, bracket cap, binder ownership, price availability and purchase/market budgets still govern every choice. Budget remains a ceiling; no spending target or costly-card quota was added.

## Identical-pool before/after

Four archetypes × $25/$50/$100/$200 = 16 paired comparisons. All new builds complete with 100 cards and 36 playable land allocations, all primary-role and package targets, within budget. Independent checks verify copy limits, colors, supplied legality, bracket-3 cap, exclusive primary totals, owned-only reconstruction and the Path of Mettle regressions.

Final estimated purchases (snapshot USD):

|Commander|$25 cap|$50 cap|$100 cap|$200 cap|
|---|---:|---:|---:|---:|
|Satya|$24.99|$49.12|$80.34|$104.73|
|Krenko|$25.00|$49.96|$70.49|$113.35|
|Muldrotha|$24.89|$38.12|$54.59|$86.74|
|Talrand|$25.00|$46.81|$66.96|$74.01|

At $100 on identical facts:

|Measure|Before|After|
|---|---:|---:|
|Satya creature count (including commander)|41|32|
|Satya meaningful copied-entry package|4|18|
|Satya attack-access package|1|5|
|Satya mean nonland mana value|2.51|2.25|
|Krenko typal engines|5|8|
|Talrand cheap selection|4|8|
|Talrand cast engines|0|2|

Muldrotha already had abundant fuel/sacrifice pieces; the new $100 build retains that plan, adds reviewed reusable tools, and changes mean nonland mana value slightly from 1.65 to 1.70. Lower curve is not automatically better. Counts of overlapping packages are not totals of independent cards and are not strength scores.

Manual sample review drove fixes rather than optimizing these metrics: the initial candidate review found false value from landfall and non-token triggers, Ideas Unbound being treated as net gain, and Legion's Initiative/Siren's Call being treated as general wipes. Those rules now have focused regressions. Final Satya includes Decoction Module, Izzet Generatorium, Guide of Souls, Roil Cartographer, Lightning Runner and Solemn Simulacrum, replacing several one-shot energy bodies. Krenko gains useful Goblin support rather than only Goblin names; Talrand has both selection and cast payoffs; Muldrotha keeps replayable permanent answers and sacrifice tools. Reviewed-example overlap is recorded but is not the optimization objective.

Final $100 Satya primary allocations and purchase spend:

|Role|Cards|USD|
|---|---:|---:|
|commander|1|$0.35|
|mana|36|$14.76|
|ramp|10|$9.90|
|advantage|10|$11.49|
|interaction|8|$9.43|
|wipes|3|$5.78|
|protection|3|$0.47|
|finisher|4|$7.60|
|synergy|25|$20.56|

Exclusive Satya types: 1 planeswalker, 32 creatures (including commander), 13 artifacts, 9 instants, 4 sorceries, 5 enchantments, 36 lands. Sum 100; artifact creatures appear only under Creature. No hard type quotas were introduced.

## Verification and limits

158 tests across 21 files pass; production TypeScript/Vite build, additional final typecheck and ESLint pass. Vite's existing >500 kB bundle advisory remains. The final live headless guest journey passes at phone and desktop widths: commander entry/navigation, bracket, complete build, remove/undo, local save/reload, sort and full-art viewer; touch-emulated Chromium page scrolling passes. User accounts, sessions, documents, history and rooms retain exact baseline digests. Normal API watcher reloads apply shared-source changes; no duplicate server or port-5186 action occurred. Safari focus was not taken during this batch.

Evidence: execution workspace `checkpoint/edhrec-quality/` contains frozen before/after builds, source-resolved example facts, discovery pools, comparison scripts/logs, independent invariants, tests/build/lint logs, live guest journey logs and data digests. Recoverable archives: `checkpoint/card-chasm-before-edhrec-quality.tar.gz` and `checkpoint/card-chasm-edhrec-quality-final.tar.gz` with SHA256.

Limits: four explicitly reviewed commanders, not a full EDHREC integration or automatic refresh. Generic packages remain conservative rules-text heuristics, not a complete Magic rules engine. Conditional effects, X costs, sequencing, mana timing, combos and lethal lines still need human playtesting. Inclusion does not establish win rate, budget optimization or bracket intent. Actual native iPhone/Expo software-keyboard/swipe QA remains pending because no Simulator UI-control tool is exposed; browser checks do not prove native behavior.
