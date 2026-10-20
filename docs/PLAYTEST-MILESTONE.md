# Card-centered playtest milestone — October 14, 2026

The battlefield and hand now share the main workspace. Global sidebar, bottom navigation and duplicate app header collapse during playtest; Back to deck and the deck selector remain. A compact toolbar exposes life, draw, next turn/untap and undo. Library, graveyard, exile, stack and command zone are count-based buttons; contents open on request. Library shuffle/top-card inspection/search live in its zone drawer. Redo, phase stepping, draw count, turn preferences, mana, tokens, counters, random tools, game history and New game remain available through Options or selected-card actions.

Opening hand, mulligan and keep remain explicit. New game requires confirmation, cancellation leaves state unchanged, and undo restores the previous game. Empty/commander-only decks show Build this deck rather than Keep 0. Incomplete decks can still be tested, with a concise notice. The retained engine is a manual goldfish: users resolve costs, triggers and combat themselves.

Session storage now normalizes card facts once instead of repeating them for every snapshot. Up to 50 undo and redo snapshots persist with the current state. Existing full-state sessions migrate without resetting. Damaged history entries do not destroy an otherwise valid game. The builder stays mounted while briefly playtesting, preserving search/filter context. Returning to the builder or reloading restores playtest state and history. Changed saved decks no longer silently erase an existing playtest; a notice explains that New game loads the updated deck. Reset undo also retains the old source-deck version.

## Expo workflow

`mobile/App.tsx` renders this same web workspace in `react-native-webview` with `source={{ uri: url }}`. There is no separate native playtest component to redesign. These source changes therefore reach the actual Expo WebView workflow. The native shell and its camera/sharing bridge were preserved; no native API or dependency change was made. Live Vite serves the new Tabletop module, and the existing Expo/Metro stack remains running.

Actual Expo Go interaction is still pending a coordinated foreground slot because Roblox owns desktop UI. Headless mobile/touch emulation and a smaller WebView-like viewport are evidence of web behavior, not proof of native device rendering, keyboard, permissions or networking.

## Verification

Before changes, actual opening/playing desktop and phone screens were captured. After changes, screenshots were visually reviewed; review exposed phone clipping, and the toolbar/empty rows were tightened. A strict check verifies the entire tapped land is inside the viewport, alongside the visible hand and battlefield. This passes at 1440×1000, mobile/touch 390×844 and a shorter 390×720 frame.

Desktop and phone journeys in headless Chrome passed against an isolated QA database/account:

- Open deck, retain builder Find/search text, start playtest, mulligan and keep.
- Select a land using a touch tap on phone, play it, tap it, draw, move it to graveyard and undo.
- Next turn untaps and draws; undo restores the previous turn/tap state.
- Enlarge/close a card preview without changing the game.
- Return to the builder with filter/search context preserved; return to playtest and reload with state and undo history preserved.
- Undo after reload, redo through Options, and inspect only the library's top card.
- Change the saved deck quantity in the QA backend; reload and preserve the original session with an explicit notice.
- Cancel New game without changing state; confirm New game, then undo the reset.
- Open an empty deck and return directly to its builder; no Keep 0 action.
- No page exceptions or horizontal overflow. Full played-card visibility passes, including the short frame.

Final build/lint and all 76 tests across 7 files pass. Mobile typecheck/lint pass. New regressions cover persistent undo/redo, storage size reduction, legacy migration, broken current state, damaged history, bounded snapshots and empty-deck keeps. Prior builder tests remain passing. `git diff --check` passes.

QA scripts/log: task workspace `playtest-before.cjs`, `playtest-after.cjs`, `checkpoint/playtest-journeys.log`. QA data stays under `/tmp/card-chasm-builder-qa`; no test accounts/decks were written to Mason's database. The QA backend is stopped after verification. Existing user changes remain uncommitted and preserved.

## Screenshots and checkpoints

- [Before desktop playing](screenshots/card-centered-playtest-before-playing-desktop.png)
- [After desktop playing](screenshots/card-centered-playtest-after-playing-desktop.png)
- [Before phone playing](screenshots/card-centered-playtest-before-playing-phone.png)
- [After phone playing](screenshots/card-centered-playtest-after-playing-phone.png)
- [Short phone frame](screenshots/card-centered-playtest-after-phone-webview-size.png)
- [After desktop opening](screenshots/card-centered-playtest-after-opening-desktop.png)
- [After phone opening](screenshots/card-centered-playtest-after-opening-phone.png)

Library saving was attempted for four QA-only before/after playing screenshots using the supported helper. It failed during hosted-app tool discovery with `TLS`, before any save was confirmed. No Library file IDs were returned. Local screenshot deliverables remain available; there is no pending/uncertain Library save to assume succeeded.

Pre-playtest and completed-playtest source archives are in the task workspace's `checkpoint/`. They exclude dependencies, user databases, environment files, generated bundles and Git metadata. Extract separately for recovery/comparison.

## Live session and next work

Existing live stack remains in assistant terminal session 20808: web http://192.168.4.91:5173, Expo Go exp://192.168.4.91:8081. Mac API, LAN web API and Metro status return 200; the live Tabletop module contains the new toolbar/session implementation. Keep the Mac and session awake; restart `npm run dev:all` after network changes.

Next implementation batch: commander recommendations inside the builder, with truthful supported-card explanations and filtering, permitted source links and user-pasted deck import. No EDHREC/Moxfield scraping or undocumented APIs were added. Current weekly meter: 84% remaining in the seven-day window.
