# Commander generator quality checkpoint — October 16, 2026 UTC

Mason reported that the generated Satya deck omitted the recommended cards. The old system fetched a small generic candidate set, misread energy counters as a generic counters strategy, and prioritized cheap filler using an equal per-slot price ceiling. It could also admit Commander-legal auxiliary sticker/Attraction cards that cannot be main-deck cards.

The generator and Suggestions now share commander-specific rules-text ranking. Satya gets energy, creature-copy/enters triggers, token and attack support candidates. Construction reserves a commander core before role allocation and permits more expensive engines when remaining cheapest legal cards can complete the budget. A read-only recommended-card review explains inclusion and exclusion. Same-commander decks in the current library can supply verified reference candidates; those cards count as owned only when present in active binders. Auxiliary cards are excluded and existing saved decks are diagnosed without being rewritten.

This is StackSynergy's own heuristic ranking, not EDHREC/community statistics. No community service was scraped, no account/model purchase made. Role classification and interactions remain approximate; high overlap is a consistency check, not proof of deck strength. The greedy finite candidate pool is not an optimizer. Mana currently uses 36 basics with equal commander-color distribution; creature ETB engines can be overrepresented, conditional draw/removal and temporary mana may count toward role targets. Review the deck before saving or playing.

## Reproducible Satya comparison

Both cases: Satya, Aetherflux Genius; buy all copies; $100 USD purchase budget; no inventory/reference cards. Public card facts and quote snapshots are saved in the task checkpoint's satya-baseline.json / satya-after.json (prices can change).

- Before: complete 100 cards, $30.64; 133 fetched suggestions; 3/20 first displayed recommendations included; invalid auxiliary stickers/Attractions were present.
- After: complete 100 cards, $67.88; 1,006 fetched suggestions; 19/20 first ranked suggestions included; no auxiliary cards. 36 lands, 63 noncommander spells; heuristic roles ramp 8, draw 9, interaction 8 (overlapping).
- These top-20 lists differ because ranking and candidate retrieval changed. This comparison demonstrates consistent recommendation use and improved commander relevance, not a head-to-head competitive benchmark.

| Ranked candidate | Construction result |
| --- | --- |
| Guide of Souls | Included |
| Aetherstorm Roc | Included |
| Nesting Dovehawk | Included |
| Amped Raptor | Included |
| Roil Cartographer | Included |
| Tempest Harvester | Included |
| Robobrain War Mind | Included |
| The Motherlode, Excavator | Included |
| Behemoth of Vault 0 | Included |
| Aether Chaser | Included |
| Aether Swooper | Included |
| Inspired Inventor | Included |
| Whirler Virtuoso | Included |
| Aether Inspector | Included |
| Cayth, Famed Mechanist | Included |
| Minister of Inquiries | Included |
| Thriving Turtle | Included |
| Aether Theorist | Included |
| Assaultron Dominator | Not selected after commander-core, role and budget allocation. |
| Conduit Goblin | Included |
| Eddytrail Hawk | Included |
| Hexgold Slith | Included |
| Riddle Gate Gargoyle | Included |
| Smelted Chargebug | Included |
| Thriving Grubs | Included |
| Volatile Stormdrake | Not selected after commander-core, role and budget allocation. |
| Aethertorch Renegade | Included |
| Cyclops Superconductor | Included |
| Electrostatic Pummeler | Not selected after commander-core, role and budget allocation. |
| Electrozoa | Included |

## Strategy profile

Builder and Suggestions share 38 supported mechanic tags (up to 3), Scryfall creature-type choices (up to 2), and custom organization-only labels. Alias search includes lifegain/aristocrats/superfriends/blink/spellslinger. Goblins/Elves normalize to catalog types. Changelings and cards mentioning the type can match. Unknown imported mechanic labels stay descriptive; unrecognized catalog types move to descriptive labels. Custom labels do not alter search queries or scores. Optional document.strategy is backward compatible; guest export/import/copies retain it. Suggestions requires an explicit save of the profile.

## Verified and rollout status

118 tests across 14 files pass; production TypeScript/Vite build and ESLint pass. Regression cases cover energy versus +1/+1 counters, selected mechanics/types, descriptive-only labels, budget engines, auxiliary exclusions, reference cards not being owned, and optional metadata schema. Actual API construction used a separate loopback test server with temporary databases, never the user's database.

Initial shared API reload was rejected by automatic approval review because parent coordination was required. Parent subsequently granted explicit coordination; the same scoped API reload succeeded. Existing PID70833/launcher70832 were verified against the project and persistent database, then replaced by API8555/launcher8552 on the same port3001 with the same allowed origins. A SQLite backup was saved before reload. Users, sessions, documents, history and rooms had identical row counts and content digests afterward. Vite69694, Metro67146, StatPad97814 and foreground apps were unchanged. Canonical Vite→API construction returned the same complete Satya100/$67.88/19-of-20 result. Canonical headless UI acceptance passed (27/30 audit candidates included, card viewer, alias/catalog/custom-label entry), without route mocks or user-library writes. Phone foreground verification of the activated backend remains deferred to preserve Roblox review.

## Run

From the repository root, npm run dev:all starts the web/API/Expo session. Expo belongs in mobile/, not the repository root. See EXPO.md for setup. Use the launcher's discovered Wi-Fi address; historical addresses in earlier notes may be stale. During this checkpoint the shared session used 192.168.4.25:5173 and Expo :8081. Do not start a duplicate session on occupied ports. The coordinated API reload is complete; the existing session is ready.

Headless browser acceptance also passed against the isolated real API: Satya partial-name selection, complete construction, recommended-card review (27/30 included), Guide of Souls full viewer/Escape, lifegain alias, Scryfall catalog Goblins→Goblin and custom descriptive label entry; no page errors. Guest context was isolated and no user library was touched. Native viewer front/back/zoom and explicit rules pane were previously verified in Expo Go on iPhone17Pro simulator; no new foreground/native QA was attempted during the exam task. Temporary API was stopped after verification. Account save roundtrip for the new optional profile remains untested on the live user database; schema and guest compatibility are covered by tests.
