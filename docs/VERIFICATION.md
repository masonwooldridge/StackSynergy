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
- Expo's web connection screen was opened in the in-app browser; Connect transitioned to the Open CardChasm action. Native execution remains unverified.

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
