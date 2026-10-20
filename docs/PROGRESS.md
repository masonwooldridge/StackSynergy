# StackSynergy implementation

Started 2026-10-12. Existing React/TypeScript/Vite app evolved in place. Original uncommitted package and lockfile edits retained. Original `card-chasm-deck` browser storage remains untouched; Settings offers an explicit verified copy into account storage.

## Plan and current status

1. Inspect/run original app — done; browser rendered original search/deck MVP.
2. Persistent backend, accounts, migrations, Scryfall cache — implemented; verify isolation/conflicts.
3. Search, printing detail, inventory, multiple decks, legality — implemented first increment; parity gaps below.
4. OCR scanner review — implemented English OCR; camera/upload evaluation still required.
5. Manual solo tabletop — implemented initial controls; advanced tools still required.
6. Real multiplayer — server-authoritative rooms and polling implemented; separate-account acceptance still required.
7. Live assistant — optional configurable model service, verified additions and review diff implemented; no credential used, live acceptance pending.
8. Tests, browser acceptance, deployment — in progress.

## Exact continuation / remaining acceptance

- Measure scanner recognition on representative legally usable images: modern/old frames, split/DFC, tokens, alternate art, languages, low light/blur. No performance claim yet. English OCR is not a full-catalog image recognizer. Add visible set/collector parsing, confidence alternatives, continuous camera capture with robust duplicate suppression and manual correction.
- Inventory: folders, batch selection/edit/move, set completion, sort/filter controls, currencies/exchange rates, valuation timestamps per lot, missing/duplicate dashboards, restore individual removed entries, backup restore and import column mapping.
- Decks: categories/tags UI, privacy sharing, comprehensive special construction rules and latest rules fixtures, refresh legalities before validation, charts, mana-source/role analysis, companion validation.
- Tabletop: persisted solo sessions, private library search/reorder, token customization/counter decrement, per-opponent commander damage, robust opening-hand/mulligan state machine and probability calculator, life/turn undo.
- Multiplayer: independent browser accounts + 4-player acceptance, private search/reorder, invite links, security/race/restart tests, disconnect grace/host transfer, archive finished rooms, rules-consistent ready validation, push realtime transport if polling latency is insufficient. Current local HTTP server binds loopback; use authenticated HTTPS reverse proxy for remote clients.
- AI: live configured provider acceptance (requires user credential and authorization to incur usage), per-account durable usage limits, total-deck budget, explicit power constraints, commander/theme recommendation mode, review individual changes and handle invalid intermediate decks. Community sources remain links + user imports; no approved API access established.
- Product: Safari and mobile physical camera testing, focus trap/keyboard modal close, error boundaries, offline catalog/search, trade tools, multilingual catalog, news, comprehensive rulebook and premium parity.
- Infrastructure: password reset/email verification, session management, stronger auth-specific rate limiting, backups retention/restore, deployment TLS/proxy configuration and production hardening.

No full parity or full-app completion claim is justified until these items and acceptance tests are complete.

## Interruption checkpoint
- Latest checks: build/typechecks, lint and 24 automated tests pass; npm audit zero vulnerabilities.
- Added CSV metadata/board round trips, initial curve/color/type/heuristic role analytics, continuous camera capture controls, OCR query cleanup/footer hints, edit recovery, and stricter auth/model usage limits after the initial checklist above.
- Real browser upload → identity review → different printing → quantity two → binder save → reload passed. See VERIFICATION.md for measurements and limits.
- Start with `npm run dev`; open http://127.0.0.1:5173. The development server was left running when interrupted. No commits, publishing or paid model calls made.
- Resume by reconciling this checkpoint with the remaining checklist, adding atomic bulk inventory moves and restore/import UX, then completing scanner evaluation, tabletop gaps, live AI acceptance, multiplayer browser/security acceptance and official parity gaps. Do not mark the entire request complete.

## Expo addition

User requested Expo support. Added isolated SDK 57 project in mobile/, Expo Router, native WebView client of the existing app, native camera/photo → OCR bridge, share-sheet exports, connection/retry UI, Android back handling, local-network backend script, configurable server origin, and local-HTTP Web Crypto UUID fallback. Existing web commands and data paths retained. See EXPO.md for setup. Physical device camera/session/sharing acceptance remains outstanding; full native/offline implementation is not claimed.

## Visual review and opened previews

Magic-inspired archival theme applied across website and Expo shell. Safari live search/login/persistence/import/playtest acceptance performed. Actual Expo Go simulator connection and native Photos picker verified. iOS input zoom and duplicate branding repaired, keyboard modal focus and page scroll improved. Native typing automation repeatedly reloaded Expo Go, so native login/sharing and physical camera acceptance remain outstanding. See VERIFICATION.md for exact evidence and screenshot. VS Code is open to this repository; Safari serves http://127.0.0.1:5173; Expo Metro runs on port 8081 and iPhone 16e simulator loads http://localhost:3001. Processes left running for user review.

## Neutral dark palette revision

User requested a simple social-app-like dark palette. Added centralized `src/theme.css` with near-black/charcoal surfaces and gray borders, restrained mana-blue actions, violet/green secondary accents and a small five-color mana palette. Removed the green/gold presentation, decorative seal/frame and serif styling. Matched Expo native shell colors and typography. Website build/lint and mobile typecheck/lint pass; Safari and Expo visual review performed. Data and feature behavior unchanged.


## ManaBox-style workflow revision — October 13

Implemented task-first Home/Search/Collection/Decks/More, mobile bottom navigation, library overview screens, name/format creation sheet, contextual search with destination/board and direct + add, list/grid results and pagination, local owned-only search, deck card quantity controls and grouping, separated statistics/import/settings, commander section, all-owned inventory with binder locations, and missing-owned comparison/export.

Bulk selection supports recoverable removal and atomic same-kind binder/list moves. Moves preserve lots and inventory totals, reject stale revisions/other accounts, and undo both sides together. Generic document history is bounded by inventory moves to prevent one-sided snapshot restoration.

Validation: web build/typecheck and lint passed; 33 automated tests passed, including exact printing/board quantities, inventory independence, missing-owned aggregation and HTTP move/isolation/conflict/undo. Expo typecheck/lint passed. Safari direct-add → saved quantity → decrement acceptance passed on the existing explicitly labeled test deck; test quantity restored to 60. Responsive 390px Home/deck/library/missing/all-owned checks showed no document horizontal overflow. Owned binder retained two Lightning Bolts.

Simulator controls timed out during this revision despite the existing Expo process continuing. This revision's Expo visual/reconnect acceptance remains unverified. Built web bundle contains the update; Expo WebView will receive it after reconnect/reload. Prior native/physical acceptance limits still apply. No claim of all-feature ManaBox parity or complete original scope.

## Card-focused refinement and solo playtest — October 13

Replaced the flat solo zone grid with a card table: concealed library, opening-seven review, London mulligan selection in chosen bottom order, first-free option, separate land/permanent rows, horizontally scrollable hand, command zone, stack/graveyard/exile browsers and selected-card actions. Opening review shows the hand before the unused battlefield. Phone actions use a bottom sheet and enlarged card preview; desktop supports zone drops and D/T shortcuts.

Added immutable solo state engine, full-state undo/redo for the active session, local game-state resume keyed to deck content, optional draw with next turn, battlefield-only untap, phase controls/mana clearing, mana pool, poison/damage trackers, custom tokens/counters, per-commander casts/tax, library top/bottom/search/peek, and restart review with undo. Sideboard/maybeboard are excluded; solo changes never alter the saved deck. Lands have Play land instead of Cast; instants/sorceries resolve to the graveyard by default. Costs, triggers, combat and special card effects remain manual.

Tightened Home/library/editor spacing, reduced repeated dashboard blocks, used compact neutral card rows and improved card art prominence while preserving the dark mana palette. No ManaBox branding or assets reused.

Browser acceptance: reviewed opening hand, mulliganed to six with selected bottom card, kept, moved land to battlefield, tapped, reduced life, next-turn untap/draw, then undo restored turn, hand, library and tap state together. At 390px, resumed game after refresh with life 19, turn 1, five-card hand, 54-card library and tapped land; no horizontal document overflow, all hand images loaded. Enlarged card dialog opened and restored focus on close. Desktop Safari reviewed separately. Native simulator still times out; Expo visual acceptance remains blocked, not claimed.

## Reliability increment — October 13, 2026

Reviewed baseline bf69233 and preserved the pre-existing package.json, package-lock.json, tsconfig.json and .expo changes. No synced project references, account records, collection quantities, decks or original MVP storage were used as disposable fixtures.

Implemented:
- Central public-piece policy, member checks before command deduplication, private counter logs and scrubbing of historical counter logs in serialized views. Validation diagnostics are visible only to the deck owner. Zone changes clear tap/counter/face state.
- Durable server proposals bound to account/deck/revision and budget/owned-only constraints. Model output specifies exact cut entry IDs, quantities and addition boards. Review has individual selection and exact quantities; atomic server application rechecks ownership/revision, quantity coverage and total budget, and rejects repeat application. Ambiguous transport errors in gameplay retry one stable command ID once. No paid model call performed.
- Server deck fact resolution before verified room loading, with cached provider facts replacing client rule metadata. Casual loading is explicitly labeled unverified; every player must agree before starting with an unchecked deck. Missing/special construction facts remain incomplete. Unfinished decks remain saveable.
- Rules reviewed against the September 25, 2026 comprehensive rules linked from the official rules page: qualifying Vehicle/Spacecraft eligibility, standalone Background rejection, front-face eligibility, matching partner variants and Doctor's companion type constraints. This is not a comprehensive construction-rule implementation; companion and unimplemented special conditions require manual review.
- Global browsing no longer assigns the selected document as destination. Printing lookups aggregate all pages for both details and set-based imports. Printing filter, printing-specific language/available finishes and matching finish price; quick additions choose an available finish.
- URL screen/document/query/destination context, browser Back/Forward, retained in-memory search results/filters. Search query and document survive refresh. Full filter/scroll restoration across refresh remains incomplete.
- Scanner worker reuse with cleanup; duplicate suppression limited to recent camera text frames, uploads treated independently, explicit scan-another-copy, navigation-persisted review queue, thumbnails and secondary recognition diagnostics. This is still heuristic text recognition, not physical-copy tracking or a complete batch-save workflow.
- Monotonic room response acceptance, no resurrection after leaving, intentional leave/concede, host transfer, last-member cleanup, finished games and exclusion of stale public lobbies. Full disconnect grace/archive lifecycle and four-client acceptance remain open.
- Solo saved-state shape validation and visible persistence errors, preserving undo/redo behavior. CI added for isolated tests/build/lint and mobile typecheck/lint.

Evidence: 64 automated tests, build, web lint, mobile typecheck/lint pass. Browser deck → global Search → Lightning Bolt → details → close retained empty destination; Back/Forward returned to deck/search with query/results. Screenshot: docs/screenshots/reliability-search.jpg. Full failure/evidence/limitations and run instructions are in RELIABILITY.md and VERIFICATION.md. This increment does not complete the full requested application scope.

Guest-first local library and a constraint-checked, rules-based full Commander builder are implemented. See GUEST-AND-FULL-BUILDER.md for safe account copies, verification and native/offline limits.

Deck-journal redesign implemented and rendered at mobile/tablet/desktop sizes. See JOURNAL-DESIGN.md for before/after evidence,108 passing tests and remaining native/shortcut limits.

## Dark card room visual pass — October16,2026

Implemented Mason’s ManaBox-inspired charcoal/minimal-color direction; see DARK-DESIGN.md for exact scope, run instructions, verified results and screenshots. Preserves guest/account/full-builder/upgrades/playtest behavior.

## StackSynergy identity polish — October16,2026

Dark direction retained; licensed local typography, split-card crest, sharper details implemented and rendered offscreen. See IDENTITY-POLISH.md. Native review deferred during Roblox capture.

## Commander usability repair — October16,2026

Reproduced exact-name/Enter/focus failures, replaced builder lookup with live commander card selection and improved deck-search handoff. Runtime regressions and full real-card build/save/playtest pass. Direct Safari typing reproduction still pending shared foreground. See COMMANDER-USABILITY.md.

## Full card viewer and multi-tag construction — October16,2026

Large read-only card details/zoom/both faces added to finished decks and builder rows.38 independent supported MTG tags, up to3, influence full construction.111 tests/build/lint pass; see CARD-DETAILS-AND-TAGS.md for exact coverage and remaining gaps.


## Commander recommendation consistency — October 16, 2026 UTC

Satya-specific energy/copy/ETB ranking now drives both Suggestions and full construction, with inclusion/exclusion review and verified same-commander library references. Added typal/catalog/custom descriptive strategy metadata.118 tests/build/lint pass; isolated API produces100 cards at$67.88 including19/20 first ranked suggestions. Main shared API reload remains pending coordination following automatic approval rejection. Exact comparison, weaknesses, rollout and run instructions: GENERATOR-QUALITY.md.


Coordinated activation follow-up: parent explicitly approved the previously blocked API-only reload. New canonical API8555 now serves the current code on3001; canonical Satya and headless UI acceptance pass, user data digests unchanged, unrelated services untouched. See GENERATOR-QUALITY.md.


## Cross-commander quality review — October16,2026

Krenko/Muldrotha/Talrand review repaired missing typal/spell-trigger/permanent-replay relevance and false/slow ramp allocation.122 tests/build/lint and canonical UI pass. Final legal100-card buy drafts:$45.04/$96.45/$84.56; exact-binder owned-only and incomplete$5 budgets verified. Satya remains100/$68.67/19-of-20. See CROSS-COMMANDER-REVIEW.md for examples and remaining limits.


## Basic mana allocation — October16,2026

Pip-weighted post-construction basic swaps now account for selected spells, commander cost and known nonbasic production, preserving ownership/budget/land count.128 tests/build/lint and canonical UI pass. Muldrotha17B/12G/7U basics;$93.25; Satya11W/12R/13U;$69.56. See BASIC-MANA.md for constraints and exact evidence. This supersedes equal-basic limitations noted in earlier checkpoints.


## Resilience review — October16,2026

Headless fault/recovery, stale commander responses, cancellation, multi-tag build/save/reload, finished viewer focus/data preservation and owned-only no-binder boundaries pass.129 tests/build/lint pass. Corrected commander-only secondary mana starvation: asymmetric35/1 becomes28/8; real Muldrotha16B/12G/8U,$93.89. See RESILIENCE-REVIEW.md.


## Request cancellation — October16,2026

Commander lookup and all construction fetches accept AbortSignals and abort on cancel/change/unmount. Expected aborts stay quiet; stale guards retained.131 tests/build/lint plus observed browser abort events and end-to-end resilience pass. See REQUEST-CANCELLATION.md and pending NATIVE-FINAL-QA.md. No foreground/account writes/API restart.


## Final native QA attempt — October16,2026

Actual iPhone17Pro/iOS26 Expo client: Satya partial search/result/select and strategy panel pass. Native lower-control scrolling/text routing blocked remainder; two input attempts reloaded to empty guest Home. No saves/account writes; stopped bounded attempt and released foreground.49% weekly remains. See NATIVE-FINAL-RESULT.md and screenshot native-final-home-preserved.png in task checkpoint.


## Native input diagnostic — October16,2026

Offscreen source/log review found upstream ExpoGo plain-r refresh binding and prior native d interception evidence, but latest r-path attribution remains unconfirmed. Exact-string mobile Chromium keyboard control passes without document reload; headless WebKit runtime unavailable. No app defect reproduced or speculative source change. Exact manual isolation steps saved in NATIVE-INPUT-DIAGNOSTIC.md.49% weekly remains.


## Final accessibility/usability audit — October16,2026

131 tests/build/lint pass. Phone/desktop focus trap, Escape/return, labels, alert/status and scoped contrast checks pass. Standalone viewer Scryfall link increased20→44px target height and measured after. Native/VoiceOver limits retained; no speculative changes. See FINAL-ACCESSIBILITY-AUDIT.md.


## Commander bracket targets — October16,2026

Required bracket choice, dated official53-name searchable Game Changer reference, actual0/0/3/unlimited selection caps and saved validation implemented. Budget reserve respects forbidden filler.136 tests/build/lint and canonical phone-width/desktop guest build/save/reload pass. Approved API-only restart activated optional metadata schema; user data digests unchanged. Full bracket intent/combo/power certification remains human review. See COMMANDER-BRACKETS.md.


## Card sorting and thumbnails — October16,2026

Exact requested type order, finish-aware per-copy USD ascending/descending within groups or whole list, unavailable-last, and accessible lazy thumbnail→high-resolution viewer added to finished/generated reviews.139 tests/build/lint and desktop/phone-width/failure/both-face UI checks pass; user data unchanged. Screenshot Library IDs and deterministic precedence in CARD-SORTING-AND-THUMBNAILS.md. No foreground/services touched.


## Artwork previews and safe removal — October16,2026

Actual Mason reference visually inspected. Landscape art-crop/price-badge previews, finished one/all-copy removal with safe current-document undo, and local generated-draft removal with accurate counts/prices and disabled incomplete saving implemented.142 tests/build/lint and canonical desktop/phone-width data-preservation/undo/reload/focus checks pass. See ARTWORK-AND-REMOVAL.md for screenshots, session-undo limit and exact evidence. No real account/deck QA writes or foreground.


2026-10-16: Functional primary-role allocation and budget distribution verified across 4 commanders × 4 budgets; 147 tests, build/lint, headless UI pass. Saved data digests unchanged. See GENERATOR-BALANCE.md.

2026-10-16: Corrected transform-only land backs being counted as normal land slots. Front lands and modal playable land backs are handled distinctly. 149 tests/build/lint pass; Satya four-budget recheck has 36 front lands and meets all targets. See GENERATOR-BALANCE.md correction.

2026-10-19: Focused continuation repairs commander→bracket focus/scroll and keyboard result navigation; excludes one/two-damage false wipe slots. 150 tests/build/lint/mobile checks pass, 16 captured builds plus live phone-width/desktop guest save/reload and manual creation pass. Saved-data digests unchanged. Native UI testing remains unavailable. See OCT19-CONTINUATION.md.

2026-10-19 design follow-up: restrained deck/builder layout, shorter human labels, less decoration, compact navigation and card list shown first. Before/after phone/tablet/desktop screenshots and redesigned guest save/reload journeys pass; 150 tests/build/lint pass. Live preview opened in Safari at Mason’s request. See OCT19-CONTINUATION.md.

2026-10-19: Added dated, manually reviewed EDHREC examples for Satya/Krenko/Muldrotha/Talrand, functional theme packages, improved copied-entry/energy/curve ranking and conservative draw/wipe fixes. 16 paired frozen-pool builds plus independent constraints and live guest UI journeys pass; 158 tests/build/typecheck/lint pass. No model training or live inclusion feed. See EDHREC-QUALITY.md.

2026-10-19: Repaired credential-gated existing-deck upgrade flow with local paired upgrade review/apply for guest/account libraries and direct New deck/Upgrade navigation. Addition-budget, ownership, stale-state and count/role/bracket checks enforced. 162 tests/build/lint and phone/desktop guest plus owned-only UI journeys pass. Original Satya review deck untouched. See UPGRADE-FLOW-FIX.md.
