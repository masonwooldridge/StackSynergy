# CardChasm implementation

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
