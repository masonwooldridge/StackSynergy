# Verification — 2026-10-12

Implementation is incomplete. No public deployment or paid model calls performed.

## Passing checks
- Production build and TypeScript checks pass, including server/shared code.
- ESLint passes.
- 24 automated tests pass: format sizes, basic attributes, Oracle copy exceptions, cross-printing copy aggregation, restricted cards, commander identity/pairs, CSV quoted metadata round trips, board sections, OCR query preparation, HTTP authentication/account isolation, conflicting document revisions, hidden payload filtering, ownership checks, duplicate and stale game commands, and two independent authenticated HTTP clients hosting/joining/drawing/reconnecting.
- Dependency audit after updates reports zero vulnerabilities.

## Browser evidence
- Original MVP was run before changes.
- Live Scryfall search for Lightning Bolt returned verified card identities.
- Created explicitly labeled local account `browser-acceptance@cardchasm.invalid` and `Browser acceptance · test binder`. These are acceptance records, not user inventory or demo data.
- Uploaded a real Scryfall Lightning Bolt image through the scanner. OCR generated verified alternatives. Selected Lightning Bolt, corrected printing to Magic 2011 #149, changed quantity to two, and saved to the test binder.
- Collection displayed M11 #149, quantity two; reload retained both.
- Narrow/mobile layout inspected in the in-app browser. Physical camera, Safari and complete mobile workflows remain unverified.
- Browser development reloads exposed an origin proxy mismatch; repaired and rechecked successful account creation. Backend restarts can require page refresh; errors now explain this.

## Preliminary OCR measurement

Opt-in script: `npx tsx tests/evaluate-scanner.ts`. Five clean public Scryfall card images, default English Tesseract OCR, Node 26.10. Name visibility measures whether OCR text contains the expected front-face name, **not full application matching or exact printing accuracy**.

| Card | OCR confidence | Time | Expected name visible |
|---|---:|---:|---|
| Lightning Bolt | 62 | 377ms | yes |
| Sol Ring | 53 | 473ms | yes |
| Delver of Secrets | 61 | 554ms | yes |
| Fire // Ice | 36 | 572ms | no |
| Forest | 58 | 554ms | yes |

Raw source URLs, printing IDs, images and results are in ignored `data/scanner-evaluation/`. This tiny clean-image set is not representative enough to claim full-catalog/camera recognition. Split cards, rotated images, alternate art, tokens, non-English names, old frames, glare, blur and real device photos require a larger evaluation. Browser Lightning Bolt identity→printing correction→save was independently exercised. Scanner never auto-saves guesses.

## Not accepted yet
- Live AI: server-side credential absent; configurable integration exists but no live model acceptance.
- Multiplayer: independent HTTP accounts tested; independent browser clients, four players, cross-device and crash recovery still require acceptance.
- Full product/parity scope: see PROGRESS.md and PARITY.md. No full-completion claim.

## Expo checks — 2026-10-12

- Expo SDK 57 project: iOS, Android and web bundles successfully exported using `npx expo export --platform all`.
- Expo Doctor: 21/21 checks passed; SDK dependency version check passed.
- Mobile TypeScript and ESLint passed; existing web build/lint passed; root tests increased to 27 with native bridge validation coverage.
- No physical device or simulator acceptance performed. Native camera, photo permissions, WebView login-cookie persistence, share-sheet exports and local-network access require on-device acceptance.
- Separate mobile dependency audit reports upstream Expo/toolchain advisories (including braces, node-forge, uuid and decode-uri-component). Compatible automatic fixes were applied, but npm proposes incompatible SDK changes for remaining advisories. No forced downgrade/upgrade was applied. The prior zero-vulnerability result applies to the root web/backend dependencies, not the new mobile dependency tree. Reassess SDK patches before public release.
- Expo's web connection screen was opened in the in-app browser; Connect transitioned to the Open StackSynergy action. Native execution remains unverified.

## Design and Safari/native review — 2026-10-12

- Replaced the generic purple presentation with an original archival visual system: charcoal/forest surfaces, antique gold, serif display typography, custom crest and consistent SVG navigation, subtle geometric seal, and verified Scryfall card imagery. No fake inventory or market data added for presentation.
- Safari: website opened and live card search passed; acceptance account sign-in, existing M11 Lightning Bolt binder data, verified `60 Forest` import into explicitly labeled `[QA] Basic-land tabletop`, saved-deck playtest and opening-hand draw passed (library 53 / hand 7).
- Actual Expo Go app launched in the installed iPhone 16e / iOS 26 simulator. Connection to local backend and native photo-picker launch/cancel passed. Native compact header and phone layout visually reviewed. Fixed iOS input autozoom with 16px mobile input text and confirmed focus no longer expands/crops the viewport.
- Native automated email typing repeatedly triggered the Expo Go simulator's project reload behavior; native sign-in/session/share-sheet acceptance remains unverified. Safari account acceptance is independent of that limitation. Physical camera cannot be validated with a simulator.
- Added dialog focus trapping/restoration and Escape dismissal, reset page scroll on navigation, select relevant documents on Collections/Decks switching, prevent repeating opening-seven with a nonempty hand, reset life/turn/mulligans/tax/damage on tabletop restart, and replace meaningless collection validation metric with extra-copy count.
- Final web build/lint, mobile typecheck/lint and 27 tests passed. Final iOS/Android Metro bundle export passed. Expo Doctor passed in the preceding increment.
- Saved actual simulator screenshot in `docs/screenshots/expo-ios.png`. Safari website, VS Code repository and Expo simulator left open. No publication, paid model calls or commits performed.


## October 13 workflow acceptance

- Safari, existing test account: opened saved 60-Forest deck, Add cards retained target/mainboard, searched Forest, tapped direct +, saw saved 61 quantity, Done returned to editor, minus restored 60. Owned inventory remained separate.
- Phone-sized browser (390 × 844): deck/library/collection navigation, missing tab (60 required, zero owned), all-owned card location (two Lightning Bolt, M11 #149 in the test binder) verified; DOM body width stayed 390. This is responsive browser acceptance, not native simulator acceptance.
- Automated: production build, lint, 33 tests, Expo typecheck/lint passed. Tests use isolated temporary accounts/database and explicit fixtures, never seeded into user records.
- New atomic inventory tests verify metadata conservation, other-account rejection, stale revisions, history barrier, coordinated undo and repeat-undo rejection.
- Native simulator inspection timed out on each attempted binding/screenshot; newest Expo visual acceptance cannot be claimed. Existing native camera/sign-in/share limits remain.

## Solo playtest overhaul — October 13

42 automated tests pass (9 new solo-engine tests). New coverage: opening seven/command-zone initialization and board exclusions; exact unique London bottom selection and ordering; configurable free mulligan; top/bottom draw order; immutable moves and zone-state reset; next-turn battlefield untap/draw/mana; independent commander cast counts; token cessation and tracker bounds; shuffle/mulligan/draw conservation and empty-library behavior.

Web build/lint and Expo typecheck/lint passed. Manual browser acceptance covered mulligan → selected bottom → keep six → play land → tap → life adjustment → next turn → full-state undo. Responsive 390px DOM width matched viewport with no overflow; all five hand images loaded at natural width 488. Reload/open-deck/playtest resumed prior local game. Card zoom dialog and focus return passed. Native simulator inspection again timed out; no updated native visual or physical-device acceptance is claimed. D/T keyboard shortcuts verified in browser: tapped land untapped with T, then D drew exactly one (hand 5 → 6, library 54 → 53). Drag/drop is implemented but not yet explicitly exercised through UI automation. Casting/spell resolution and commander taxation are unit-tested; mixed-deck browser acceptance remains pending.

## Reliability increment — October 13, 2026

64 tests pass (42 baseline + 22 added), production build passes, web lint passes without warnings, mobile typecheck/lint pass. All new HTTP fixtures use temporary SQLite databases and isolated accounts. No live AI service or physical device was used. CI is authored but has not run on GitHub; clean installation from lockfiles has not been independently re-verified.

Regression evidence:
- Opponent serialization is checked for hidden name, printing identity and Oracle identity after private counters, hidden moves, shuffling and reconnect cloning. Deliberate reveal becomes public; library returns hide pieces again. Previously persisted leaking counter logs are scrubbed. Unauthorized actors, known command IDs, invalid counters/zones and private flips reject without mutation.
- Proposal account/deck/revision, exact sideboard cut, multiple printings, partial selection, total cost, missing prices, owned quantities and repeated selections are covered without model calls. Two simultaneous real HTTP acceptance requests produce one success and one rejection; saved revision increments once. Other-account and stale application reject.
- Authoritative resolution replaces forged client metadata with provider fixture facts; failed resolution never falls back to client rule facts. Repeated card identities resolve once. Room start requires unanimous casual agreement for unchecked decks. Owner validation diagnostics do not expose card names to opponents.
- Commander Background/Vehicle, matching partner variant, Doctor with extra types, front-face and incomplete-format metadata cases are covered. Source: [official rules effective September 25, 2026](https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.txt), especially 903.3 and 702.124. Complete companion/interchangeable-name/special-construction validation remains outstanding.
- Printing pagination uses a deterministic two-page fixture including a later collector number and duplicate ID. This establishes pagination behavior, not exhaustive live printing/provider coverage.
- Scanner duplicate gate tests distinguish uploads, recent repeated camera text, changed identities and elapsed windows. Worker lifetime/navigation queue were inspected in code; no new image-to-save accuracy, latency or physical-copy acceptance measurements were collected. The old five-image OCR measurement is historical and does not validate the changed pipeline.
- Delayed older room responses and responses after leaving are rejected by the shared client gate. Independent HTTP clients verify host transfer and final-member cleanup. These checks do not replace four independent browser/device clients, latency measurements, disconnect grace or restart acceptance.
- Solo persistence rejects missing mana, malformed numeric fields, invalid zones and duplicate piece IDs; valid free-mulligan bounds are retained. Storage failure copy is implemented; a browser storage-quota failure was not induced.

Browser acceptance, read-only against existing labeled QA documents: opened the QA deck (60 cards), global Search, searched Lightning Bolt, opened details and closed. The destination remained empty and Add disabled. The selected printing displayed its available finishes and read-only language. Browser Back returned to the same deck URL; Forward restored Lightning Bolt, two results and empty destination. No inventory or deck quantity was edited. After screenshot: docs/screenshots/reliability-search.jpg. A new before screenshot was not captured; previous screenshots remain untouched.

### Exact local run instructions

From `/Users/masonwooldridge/Documents/Coding/card-chasm`:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Existing backend defaults to `data/cardchasm.sqlite`; do not replace it for tests. Automated tests select temporary database/cache paths themselves.

```sh
npm test
npm run build
npm run lint
npm ci --prefix mobile
npm run mobile:check
npm run mobile
```

AI UI remains unavailable without a server credential. Automated proposal tests need no credential or paid request. Native configuration/run details remain in EXPO.md.

Outstanding acceptance: backup restoration/conflict recovery; inventory/import round trips and valuation refresh; scanner batch-save/cancellation/timeout and representative full pipeline measurements; multiplayer opening/keep/bottom/library/token/commander operations, four independent clients, latency/disconnect/restart; mobile onboarding/offline/session/back/accessibility and physical camera/photo/share flows; large-library performance, clean install and release hardening. No production-ready or full-parity claim.

## Safari / Expo startup repair — October 13, 2026

Found two competing Vite sessions and a loopback-only backend. A fresh iPhone WebView exposed the actual blank-screen cause: installed React 19.3.0 and React DOM 19.1.0. Pinned both root packages to 19.2.3 and regenerated only the Vite optimization cache. Added a runtime package-version regression test (65 total passing tests). Build, web lint and mobile typecheck/lint pass.

Started `npm run dev:iphone` in the user's VS Code repository terminal. New coordinated launcher rejects occupied ports, starts web/API/Metro, binds for local Wi-Fi access and supplies EXPO_PUBLIC_CARDCHASM_URL automatically. Mobile remembers successful configured endpoints and reports page errors instead of silently showing black content. Existing database and user inventory were retained.

Actual UI evidence: Safari rendered Home on loopback at the beginning of the repair; iPhone 16e/iOS 26 Expo Go rendered Home and Search, then returned two live Lightning Bolt results with card art. Native Photos picker opened. Mac locking then prevented completing photo cancellation and final Safari navigation. Native sign-in/session persistence and a physical iPhone were not verified. Current screenshot `docs/screenshots/expo-repaired.png` shows the native photo picker; `expo-phone-qr.png` encodes the current LAN Expo address. Those addresses are network-specific. HTTP probes after the interruption still confirm web/API and Expo Metro are running.

Restart from repo root: `npm run dev:iphone` (includes simulator) or `npm run dev:all` (physical phone). Safari uses http://127.0.0.1:5173; physical Expo Go uses exp://192.168.1.23:8081 on the same Wi-Fi. The launcher prints newly detected addresses each run. Leave its VS Code terminal running and the Mac awake.
