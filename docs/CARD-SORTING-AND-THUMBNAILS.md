# Card type/price sorting and thumbnail review — October16,2026

Finished deck/list rows and generated100-card reviews now default to grouped types in Mason's requested order: Planeswalker, Creature, Artifact, Instant, Sorcery, Enchantment, Land. Unsupported types such as Battle remain visible once under Other, after Land. Multiple printed types use the first matching type in that priority; Artifact Creature is Creature, Artifact Land is Artifact. Only the front-face printed type determines the group for double-faced/modal cards. Quantities are summed in group headings; entries appear once. Source entries/order/quantities are never mutated by presentation sorting.

Group and sort controls are separate: Group by type/tag/no grouping on finished lists; type/no grouping on generated reviews. Sort by Name A–Z, Price low→high or Price high→low. Prices sort within current groups; select No grouping for whole-list prices. Help text states this explicitly. Prices are per copy in USD for the entry's selected nonfoil/foil/etched finish, not row totals or historical purchase price. Missing/blank/invalid/negative prices sort last in either direction; zero is a valid price. Name/entry-ID ties give deterministic order. Existing budget/ownership/quote rules and bracket targets remain unchanged.

Generated text-only View card rows now show small clickable card thumbnails; recommendation audit rows also have thumbnails. Finished rows share the same thumbnail implementation. Provider small images are preferred, falling back to the existing image resolver; images are lazy-loaded/async decoded and42×59px. Missing or failed images display Image unavailable while the surrounding labeled button remains usable. Enter/Space retain normal button semantics, and opening uses the existing high-resolution viewer with front/back, zoom, mobile rules pane, Escape/Close and focus restoration. Decorative thumbnail images have empty alt inside aria-hidden wrappers; the button provides the card/action name.

Screenshot review also exposed the prior bracket reference inside the sticky deck summary, consuming mobile space. The long reference now sits in normal deck content; the sticky summary retains a compact saved bracket target. This preserves reference access and leaves new sorting controls unobstructed in the normal page flow.

## Verification

139 tests across18 files pass. Production TypeScript/Vite build and lint pass. Existing nonblocking>500kB chunk warning remains (about511kB JS); no broad dependency/refactor work.

Focused tests cover exact type precedence, multi-type uniqueness/front-face handling, nonfoil/foil unit pricing, ascending/descending/unavailable-last behavior, grouping/whole-list order and byte-identical entry data after sorting. Actual canonical headless UI at393/1440px verifies finished grouping/order, whole-list price sorting, lazy thumbnails, Enter→viewer/Escape→focus return and unchanged stored entries. Generated real Satya bracket3/$100 builds100 and supports the same review controls/viewer. Simulated image-request failures display fallback while details remain operable. A real Fable of the Mirror-Breaker fixture verifies finished-thumbnail→full viewer→back image→zoom→mobile back-face rules/PT→Close/focus.

All browser writes were isolated guest fixtures, never Mason's guest/account library. No foreground use, API/Metro/Vite/StatPad restart, account save, publication or reset occurred. Existing user/session/document/history/room digests remain unchanged. Source changes are frontend/shared presentation only; no API reload required.

Evidence: task checkpoint/card-sorting/ui.log, faces.log, UI scripts, source tests/cardPresentation.test.ts and task checkpoint/sort-tests.log, sort-build.log, sort-lint.log. Screenshots use public real-card fixtures, not private user decks; finished fixture intentionally contains one card of each type and is clearly labeled QA, not a validated100-card deck.

## Library screenshots

- Phone finished list: libfile_0f229bc2a4f88191a791a976fff3775f (finished-393.png)
- Desktop finished list: libfile_2f24830d3e3481918f9586a28d5fde78 (finished-1440.png)
- Phone generated review: libfile_eadc42583a588191b9616e16676d7714 (generated-393.png)

All3 Library creates succeeded and returned local identity metadata was applied successfully. The prepared-upload helper reported prepare_uploads unavailable before starting writes, so the documented ordered direct-create fallback was used. IDs and file correlation are saved in checkpoint/card-sorting/library-results.json.

Native Expo foreground/VoiceOver remain pending per existing NATIVE-FINAL-QA.md; mobile-width browser checks do not prove actual phone input reliability. Prices are cached provider snapshots and may change. Normal startup remains npm run dev:all from project root; use the existing coordinated session and avoid duplicate ports.

Meter:43% remaining before this batch,41% remaining at final checks; user reserve25%, wrap30%. No broader work performed.
