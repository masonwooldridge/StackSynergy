# End-to-end resilience review — October16,2026

Headless fresh guest contexts used the real canonical Vite/API runtime. No foreground/native actions or live account/deck writes occurred. Requests were deliberately delayed or failed only inside the isolated browser to test recovery; retries used canonical data. The exported fixture is a synthetic generated Talrand deck, not a user deck.

Verified journeys:

- Commander search: hold the old Satya response, type Talrand, receive the old response afterward; Talrand remains current and Satya does not reappear. A simulated503 search error shows the message and explicit Retry succeeds for Krenko.
- Construction failure: simulated provider failure displays an actionable error and re-enables construction.
- Cancel/change/retry: hold a verification response, cancel, select Talrand, then release the old request. No stale result replaces the new commander. A subsequent multi-strategy Talrand build completes.
- Multi-strategy/save/reload: select Instants & sorceries plus Tokens, construct100, save in isolated guest storage, reload. All100 cards, quantities, entry identifiers and both profile tags persist.
- Finished-deck card details: Talrand opens the full viewer; Escape closes it and restores focus. Viewing/reloading leaves exact saved entries unchanged.
- Collection-only boundary: the saved deck does not become binder inventory. With no binder, construction returns incomplete and the Save complete deck button is disabled. Real-data exact-binder fixtures continue completing at$0 purchases with no missing copies.

No user-facing regression was reproduced in those flows. One concrete heuristic defect was corrected:35/1 mana allocation could starve a secondary color required to cast the commander. Commander source floors now apply as described in BASIC-MANA.md. The asymmetric fixture is28/8; owned18/18 remains constrained18/18; expensive swaps roll back safely.

129 tests across15 files, production TypeScript/Vite build and lint pass. Real-case final Muldrotha is16 Swamp/12 Forest/8 Island,$93.89; Satya11 Plains/12 Mountain/13 Island,$69.56. Both legal100, within$100; nonland suggestion overlap remains20/20 and overall19/20 respectively. Krenko$45.04 and Talrand$84.56 remain complete/legal. $5 constrained cases remain incomplete and under budget.

Evidence in task checkpoint/tag-completion: resilience-browser.log, search-resilience.log, resilience-tests.log, resilience-build.log, resilience-lint.log, resilience-real-cases.log, resilience-satya.log and resilience-saved-guest.json. Main persistent user data digests remain unchanged.

Limits: source floors are heuristics, not mana-probability guarantees; activation costs/timing/fetching/snow remain unmodeled. Large same-commander reference decks require sequential verification and can make collection-only verification slower even when no binder exists. Cancellation suppresses stale UI updates but does not currently abort every underlying provider request. No account save roundtrip or new phone foreground QA was performed. Existing native viewer evidence is from the earlier Expo simulator check. No API reload was needed for this frontend/shared-builder source-floor fix.
