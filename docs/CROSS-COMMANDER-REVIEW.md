# Cross-commander review — October 16, 2026

Three public Scryfall commander cases were selected for different plans: Krenko (mono-red Goblin tokens), Muldrotha (three-color permanent replay), Talrand (mono-blue instant/sorcery triggers). No user deck was modified. All are Commander legal under provider facts. This is StackSynergy rules-text ranking, not community popularity or competitive testing.

## Defects reproduced and repaired

- Krenko lacked typal candidate retrieval/ranking and produced mostly unrelated token makers. Commander creature subtypes explicitly mentioned in its oracle text now drive typal candidates and relevance. This is generic text/type detection, not commander-name special cases.
- Talrand's token wording masked its spell-cast trigger. Instant/sorcery triggers now retrieve and rank cheap spells independently of the existing token mechanic.
- Muldrotha's generic graveyard queries favored recursion spells instead of recurring permanents. Permanent-from-graveyard text now favors permanents with sacrifice, mill or enters abilities to review for recurring value.
- Ramp counters incorrectly included opponent Treasure reminder text, one-shot mana, filtering and land-to-hand tutors. Conservative ramp now counts direct repeatable tap-for-mana abilities and battlefield land development. It excludes delayed suspend/no-mana-cost cards and counter/Dragon-gated abilities from reliable-ramp targets. Sacrifice-a-land searches are conservatively excluded; this can miss real net-positive ramp.
- Available early ramp was displaced by cheaper three-mana sources. Ramp allocation now prioritizes lower mana value after ownership priority, retaining budget feasibility. It does not force top recommendations into every role.

## Same-case final results

Buy every copy; $100 purchase budget; 36 lands plus 63 spells plus commander. All three final drafts have exactly100 cards, no validation warnings/errors, legal color identity and singleton rules. Quote snapshots are estimates, not offers.

| Commander | Original → final purchase estimate | First20 nonland ranked suggestions included | Final spell types (front face) |
| --- | --- | --- | --- |
| Krenko, Mob Boss | $92.94 → $45.04 | 20/20 | 58 permanents; 5 instants/sorceries |
| Muldrotha, the Gravetide | $63.56 → $96.45 | 20/20 | 62 permanents; 1 instants/sorceries |
| Talrand, Sky Summoner | $99.83 → $84.56 | 19/20 | 8 permanents; 55 instants/sorceries |

Recommendation lists changed with the fixes; overlap measures consistency, not competitive strength. Whole-list first20 overlap is Krenko18, Muldrotha20, Talrand18; lands account for part of the difference because construction reserves basics. Each final draft meets the current heuristic8-ramp target; draw counts8/8/9 and interaction8/25/18, respectively. Roles overlap and conditional draw/removal can inflate counts. Muldrotha still has excessive interaction overlap and a creature-heavy permanent mix; this review does not claim optimized cohesion.

For each commander, an isolated exact binder fixture containing the constructed cards completes collection-only mode at $0 new purchases with no missing copies. Empty collection-only mode rejects completion. With a $5 buy budget each returns incomplete and stays below$5 (4.93/4.92/4.91); no fabricated filler or free unknown quotes. No private library inventory was read as recommendation data.

Satya regression after conservative mana allocation remains complete100, $68.67,19/20 top recommendations included. Canonical headless UI acceptance passes, including full construction, recommendation audit27/30, card viewer, mechanic alias, Goblins→Goblin catalog selection and custom descriptive label entry.

## Evidence and limits

122 tests across14 files, production TypeScript/Vite build and lint pass. Real canonical Vite/API requests used current provider facts; no UI route mocks. Baseline/final public facts, complete card lists, budget/ownership checks and logs are retained under the task checkpoint/tag-completion (`*-before.json`, `*-review.json`, `cross-final.log`, `cross-tests.log`, `cross-build.log`, `cross-lint.log`, `cross-browser.log`).

The candidate pool remains finite, ordered first pages; it can miss stronger or more expensive engines. No competitive games were simulated. Basic mana distribution is equal by commander color, not pip-demand optimized. Creature-type inference only covers explicitly mentioned commander subtypes and simple plurals; selected catalog types cover more cases manually. Ranking is heuristic and interactions need human review, especially restricted or conditional abilities. Card text does not provide popularity statistics. Native foreground and account saving were not exercised during Roblox review.

The API-only coordinated reload activated generic ranking profiles; subsequent role/allocation changes execute in the current frontend/shared builder and production build. Existing user data and unrelated services are preserved. Run with the existing dev session; see EXPO.md for normal startup. No extra service needs starting.
