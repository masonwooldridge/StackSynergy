# Bounded recommendation-quality pass — 2026-10-20

## What changed

The AI swap ranking now uses `shared/strategicQuality.ts`, a transparent heuristic profile rather than a calibrated power rating. It records casting plus first equip cost, non-mana activation cost, creature tap delay, attack versus combat-damage prerequisites, low-impact single-card entry effects, symmetric exposure and combat protection. It adds explanations to proposed swaps. Existing canonical eligibility, exact user constraints, color identity, budget, protected cards and explicit apply remain authoritative.

For bracket-4 targets, single-card entry cantrips receive a modest lower-impact adjustment; this does not prohibit Inspiring Overseer or apply the same preference to every bracket. Equip/setup and shroud conflicts lower the default rank of Cloak for a targeted-copy commander. Symmetrical no-blocking effects receive a risk adjustment, not a Bedlam blacklist. Combat-damage prevention for attackers is now recognized as protection, including Dolmen Gate; its explanation explicitly says it does not stop removal. Equipment shroud also counts as protection while retaining its copy-target conflict.

A simplified early-ramp sequence compares the intended commander deployment with land drops alone. Mind Stone can advance a four-mana play from turn four to three, whereas Darksteel Ingot does not under those assumptions. The function assumes the ramp card is available, one untapped land per turn, sufficient colors, no opponents, and no interaction. It is not opening-hand sampling, a mulligan model, goldfishing, or a reliable win-rate estimate. Explicitly requested mana values bypass the generic slow-ramp casting-cost penalty; requirements such as equip still matter.

Role analysis now reports unique functional slots, one heuristic primary role per slot, overlapping role availability and conditional slots. Valid overlap remains counted; secondary ranking bonuses are reduced most for conditional or alternative effects rather than treated as independent guaranteed resources. Existing role floors remain conservative safety checks. Primary role is assigned by existing support heuristics, not an authoritative taxonomy. Conditional counts are coarse flags and are not probabilities of drawing/using an effect.

Purchase-budget checks still sum actual proposed purchases and never use price as a positive power signal. A swap consuming over half the remaining budget explains that concentration so the user can compare other gaps. This pass does not implement a whole-deck marginal-value optimizer, reliable color/turn simulation, complete route-to-lethal validator, or disruption-recovery simulation.

## Reproducible before/after evidence

Evidence root: `/Users/masonwooldridge/Documents/Codex/2026-10-14/task-3/checkpoint/ai-ranking/`.

`targeted.mts` imports the pre-change shared source recovered from the terminology checkpoint and the current source. It assesses canonical cached cards against the same isolated Satya deck copy and Hill Giant cut. Historical cached prices are not current vendor claims. Scores are internal pairwise heuristics and should only be compared within the same request.

| Request / candidate | Before | After | Interpretation |
| --- | ---: | ---: | --- |
| Draw / Inspiring Overseer | 106 | 88 | Lower-impact entry cantrip discounted; still eligible |
| Draw / Mulldrifter | 101 | 101 | Substantive draw now ranks above Overseer for this comparison |
| Protection / Whispersilk Cloak | Excluded | 115 | Protection recognized; five total first-use mana and shroud conflict explained |
| Protection / Dolmen Gate | Excluded | 143 | Combat protection recognized; ranks above Cloak here, subject to budget |
| Combat / Combat Celebrant | 65 | 59 | Exert-as-it-attacks needs a declared attack; a Satya token entering attacking does not trigger it |
| Combat / Port Razer | 54 | 54 | Combat damage may trigger from an entering-attacking copy; no invented global haste prerequisite |

The table does **not** claim Celebrant versus Razer is optimally ordered. Complete extra-combat routes, evasion and board support remain contextual; these generic scores still put Celebrant ahead. No model responses were generated or scored.

`compare.mts` freezes generated decks using the pre-change builder and uses the same cached candidate pools: Satya copies/energy, Krenko goblins, Muldrotha permanent recursion, and Talrand spells, each at $25/$100. The candidate scan is limited to the first 100 ranked printings before deduplication (43–52 distinct cards per case), with one fixed cut per deck. `comparison-summary.json` verifies identical commander, budget, cut, card count and deck price before/after.

**Result: top three unchanged in all eight broad comparisons.** Accepted counts also remained unchanged (Satya 50/1, Krenko 47/0, Muldrotha 2/0, Talrand 42/0 at $25/$100 respectively). This is a useful sensitivity/coverage limitation, not evidence of general strategic improvement. Zero eligible swaps for several stronger $100 decks should not be interpreted as proof of optimal decks. The fixed cut and bounded pool can miss worthwhile upgrades; broader weak thematic recommendations may remain. The targeted comparisons demonstrate specific improvements only.

Verification: **323 tests / 29 files pass**, build/typecheck and lint pass. The build retains its large-bundle advisory. Eight new deterministic profile/interaction tests cover setup cost, cantrip preference scope, exert timing, exact mana preference, symmetric risk (synthetic Oracle-style fixture), early ramp sequencing and combat protection. These are development mechanics checks, not held-out live-reasoning scores. The eight reserved live prompts in `evals/mtg-requests.json` remain unscored. The offline generator structural regression remains **16/16**, with 100-card, budget and owned-rebuild checks over four archetypes and four budgets; that is not strategic-quality certification.

The actual running API status exposes `strategicQualityVersion: 2026-10-20.1`; source watch and the built preview contain the change. No foreground UI, services, ports or user decks were changed. No paid calls, training jobs, credential edits or ledger resets occurred. Before/after conservative spending is **$0.128062**, pending zero, unblocked. No weekly-meter recheck was performed per the user's later instruction.

## Research and preference provenance

- [Brian Cain, How to Build a Commander Deck](https://edhrec.com/articles/how-to-build-a-commander-deck): reviewed article; plan-first construction, role selection, turn mapping versus raw mana curve. Numerical baselines are guidelines and require context, not universal quotas.
- [Official October 2025 bracket update](https://magic.wizards.com/en/news/announcements/commander-brackets-beta-update-october-21-2025): reviewed official source for the optimized target context; brackets are not a numerical card-power certification.
- Parent-reviewed [John Sherwood digital deckbuilding guide](https://edhrec.com/articles/digital-deckbuilding-the-how-to-guide-to-building-a-commander-deck-using-edhrec-archidekt-and-commander-spellbook): discovery statistics are not proof of effectiveness; verify strategic packages and combo conditions.
- Parent-reviewed [Brew for Your Buck](https://edhrec.com/articles/brew-for-your-buck-the-legend-persists): preserve coherent packages and reliable mana in budget substitutions; article prices are historical.
- Parent crosschecked [February 2026 bracket update](https://magic.wizards.com/en/news/announcements/commander-brackets-beta-update-february-9-2026).
- Parent reviewed only a public machine-transcript excerpt through 9:07 of [The Command Zone #733](https://www.youtube.com/watch?v=fxBCPGaWu9Y), available via [Podscan](https://podscan.fm/podcasts/the-command-zone/episodes/why-overlap-is-the-key-to-good-deck-building-733). Its role-overlap nuance informed the audit. No full video was watched or claimed reviewed.

User ratings are scoped to the user's bracket-4 Satya target: Overseer is weak filler; Bedlam interesting but risky as a default; Cloak acceptable but slow; Dolmen Gate desirable if affordable. The implementation uses general rules-text features rather than universal card bans. Positive overall feedback authorized no automatic deck changes.

Stop point: bounded offline quality pass completed. The next useful step is a separately authorized small live held-out evaluation scored independently for retrieval recall, hard constraints and strategic reasoning. No broader quality claim is warranted by these offline results.
