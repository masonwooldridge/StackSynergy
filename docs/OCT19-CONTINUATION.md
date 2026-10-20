# October 19 focused continuation

## Changes

- Commander choice now focuses the card-pool section and scrolls the required bracket choice into view. It no longer jumps past bracket to Strategy or programmatically focuses a native select. The next Tab reaches bracket. Search result keyboard navigation supports Up/Down/Home/End; Escape returns to search. IME composition is not submitted as a finished search.
- One/two-damage creature pings no longer fill dedicated board-wipe slots. Path of Mettle's one-damage entry trigger was a demonstrated false positive. Destruction/exile sweeps and damage sweeps of at least three or X remain heuristically eligible. This is a support-selection rule, not a guarantee of clearing every board. Front-face-only support analysis and the prior transform/modal land distinction remain intact.
- Near-black styling, clickable artwork and full viewer, sorting, bracket rules, role allocation, budget and binder constraints, remove/undo and saved documents are preserved.

## Verification

150 tests across 20 files pass. Root production TypeScript/Vite build and ESLint pass; mobile TypeScript/ESLint pass. Vite retains its existing >500 kB chunk advisory. No dependency or native API changes.

Headless Chrome at 393×852 (touch emulation) and 1440×852 passes actual live search → keyboard result navigation → commander choice → bracket → purchase source → construct → draft remove/undo → guest save → reload → sort → full-art viewer/close. Each independently saved 100 cards in isolated ephemeral browser contexts. Only the initial page load and explicit reload navigated the main document; typing did not reload it. No page JS errors or horizontal overflow. A CDP touch drag scrolls the page in mobile Chromium. Separate manual New deck creation with the text `Energy r d guest` persists after reload. Screenshots inspected visually.

## Captured public-card matrix

These use preserved October 16 card/price snapshots, not newly promised market prices. All sixteen builds remain complete at 100 cards, have 36 playable land allocations, stay within cap, and meet all primary-role targets. Each generated deck, represented as an active binder, reconstructs at zero purchases without missing cards. Budget is a ceiling and is not forced to be spent.

|Commander|$25 cap|$50 cap|$100 cap|$200 cap|
|---|---:|---:|---:|---:|
|Satya|$24.97|$35.64|$65.91|$116.95|
|Krenko|$25.00|$47.42|$62.15|$104.88|
|Muldrotha|$23.48|$36.12|$52.47|$100.85|
|Talrand|$25.00|$41.85|$62.95|$78.99|

The $100 Satya snapshot costs $65.91: 41 creatures, 8 artifacts, 7 instants, 2 sorceries, 5 enchantments, 36 lands and 1 battle, using exclusive front-face type grouping. Primary allocations: commander 1, mana 36, ramp 10, advantage 10, interaction 8, wipes 3, protection 3, payoff support 4, synergy 25. Its wipe allocation now includes a replacement rather than miscrediting Path of Mettle. Examples of commander-linked selections include Guide of Souls, Aetherstorm Roc, Amped Raptor and Roil Cartographer for energy/creature-entering value; Krenko has Goblins/token generators; Muldrotha has recurring permanents such as Codex Shredder and Combat Courier; Talrand favors cheap instant/sorcery spells. These are auditable rule matches, not proof of competitive strength. Repeated cantrips, conditional effects, finishing lines and actual play still need human review.

Full snapshots include cost/role/type totals, positive commander-rule scores and example reasons. Positive scores must not be interpreted as independent strength ratings. The live UI journeys use the running API's card discovery and current cached facts; their exact lists may differ from the preserved matrix.

## Services and data

No StackSynergy workers or listeners were running at inspection. Started the existing `npm run dev:all` once, without foreground interaction. Web http://127.0.0.1:5173, API :3001 and Metro :8081 return 200. LAN web http://192.168.4.25:5173. Port 5186 and unrelated projects were not touched. Log: execution workspace `checkpoint/oct19/dev.log`. Run the existing launcher only when those ports are free. Do not duplicate it while this session is running.

Read-only digests for users, sessions, documents, history and rooms match the pre-work checkpoint. All QA writes went to isolated browser guest storage. No account saves, credentials, publishing, purchases or security changes.

## Remaining native dependency

Actual iPhone/Expo software-keyboard input and real-touch scrolling are pending, not denied: no Simulator UI-control tool is exposed in this execution session. Browser emulation and passing mobile source checks do not prove WKWebView/native behavior. The earlier Expo Go hardware-key interception hypothesis remains unconfirmed. At a coordinated native slot, focus an unsaved guest field and compare software-keyboard r/d versus hardware input, then real swipe, select commander/bracket and build/save/reopen a disposable guest deck. Do not change global keyboard/security settings or clear storage. This pass changed web/shared code and did not claim to fix native host shortcut routing.

Evidence and screenshots: execution workspace `checkpoint/oct19/` (`journeys.log`, `manual-guest.log`, `matrix.log`, `tests.log`, `build.log`, `lint.log`, `mobile-check.log`, `data-preserved.json`, `guest-deck-393.png`, `guest-deck-1440.png`, `commander-next-step-393.png`). Recoverable before/after source archives live beside that folder and exclude databases, secrets, dependencies and build outputs. No commit/reset was made because the project already had extensive user changes.


## Restrained visual redesign requested during this pass

Removed the decorative commander-workbench intro, large placeholder panel, slogan-like Library copy and repeated readiness badges. Navigation now says Deck builder. Headings are smaller; labels are direct (Build deck, Commander, Cards & bracket, Budget, Save deck). A selected commander still has clickable full-card artwork, but an empty decorative preview no longer consumes a column.

Deck contents appear earlier: a single Deck tab returns from Stats, Search or Suggestions; Add cards and commander Suggestions retain discovery. The duplicate Deck/Search/Suggestions strip is removed. Counts, bracket and clickable checks share a compact line. Long grouping/price/rules explanations remain available in disclosures. Main/Side/Maybe/Commander tabs fit a phone row. Touch targets remain at least 44 px for changed controls. Card artwork, price labels, quantity/removal/undo and sorting remain intact.

Generated drafts open the full card list by default, with Save deck above it. Construction checks, role table and recommendation audit remain available on demand. Role shortfall warnings stay visible even when the table is closed. No generator capability was removed; no budget spending target was added.

Before/after screenshots use the same isolated Satya deck fixture at 393, 820 and 1440 px widths. At 393×1000, the former first screen showed controls/explanation only; the revised screen reaches two complete card rows and part of the next. Both initial and selected-commander builder screens were captured. All responsive captures have no horizontal page overflow and were visually inspected at phone and desktop sizes.

Final verification: 150 tests, root build/typecheck/lint pass. The redesigned live guest journey passes at 393 and 1440 px: typed commander lookup/navigation, bracket focus, touch-emulated browser scroll, 100-card build, draft removal/undo, guest save/reload, sorting and full-art viewer. Additional responsive checks verify Deck returns from Stats and closes Add cards/Suggestions at 393/820/1440. Data digests still match pre-work state. Native iPhone/Expo keyboard and actual touch behavior remain pending as above.

Mason explicitly asked to see the app while work continued. macOS accepted `open -a Safari` for http://127.0.0.1:5173/?screen=Assistant. The existing Vite preview updates live; no other tabs were closed and no further foreground navigation was performed. No Simulator setup or security settings were changed. Safari's exact visible window state was not independently inspected because this session lacks a desktop UI tool.

Evidence: `checkpoint/oct19/design-before-{deck,builder,commander}-{393,820,1440}.png`, matching `design-after-*` images, `design-after.log`, `redesign-journeys.log`, final `design-tests.log`, `design-build.log`, `design-lint.log`, `design-typecheck.log`, and `design-data-preserved.json`. Earlier screenshots and functional checkpoint remain preserved. Latest source checkpoint: `checkpoint/card-chasm-oct19-design-final.tar.gz` with adjacent SHA256 file.
