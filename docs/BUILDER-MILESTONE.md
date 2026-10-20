# Integrated builder milestone — October 14, 2026

Implemented the first priority of Mason's StackSynergy brief. Deck Add cards now opens discovery within the deck, keeping its destination fixed. Desktop displays the deck alongside discovery; phone uses Deck / Search cards to add tabs that keep both panels mounted. The existing standalone Search and collection workflows remain available.

The selected board controls both additions and card-detail confirmation. Search and results, filters, list/grid choice and internal scroll survive details and closing/reopening discovery. Deck-list filtering is explicitly named Find in this deck. A persistent summary shows playable count, commander and concise local legality checks, with detailed checks behind Review/Details.

Default searches use the deck format and combined commander identity; commander searches use eligibility without inheriting the previous commander's colors. Use deck rules is an explicit override, not a bypass of deck validation. Board or identity changes invalidate stale search results while retaining the search text. Owned searches apply the same rule constraints. Copy feedback counts all printings of a card on the selected board. Copies per add and Undo last edit use persisted document history. Deck changes never create owned inventory.

Card details within the builder keep the destination fixed. Search results can choose another real Scryfall printing before adding. Existing deck rows now update their printing in place, retaining row identity, quantity, notes, tags and purchase metadata instead of silently adding a duplicate.

## Verified journeys and checks

Headless Chrome ran against an isolated temporary QA account/database at port 13001, with actual Scryfall card/printing data. No QA accounts, decks or inventory were written to Mason's production database. The browser scripts are in the task workspace (`builder-before.cjs`, `builder-after.cjs`); their final log is `checkpoint/builder-journeys.log`. Temporary QA databases are under `/tmp/card-chasm-builder-qa`.

Both desktop (1440×1000) and phone layout (390×844) passed:

1. Open an Atraxa Commander deck and add ten distinct cards, with the route remaining the same deck workspace throughout.
2. Add two copies, observe counts, undo, and observe the saved count restored.
3. Open details, choose a different actual printing, save, and retain query, board and discovery scroll. Sol Ring's provider response contained 145 printings.
4. Close/reopen discovery without losing the search; retain the deck's Find filter.
5. Add to maybeboard, switch to commander discovery, and toggle the explicit rules override.
6. Change an existing Forest row's printing without changing its copy count, row ID, notes, tags or purchase price.
7. Reload and verify the printing and maybeboard additions remain in the saved document.
8. No page exceptions or horizontal overflow.

Final build and lint pass; all 72 tests across 6 files pass. New regressions cover format/commander scope, overrides, colorless/incomplete identity, board-specific counts, owned filtering and printing metadata preservation. A pre-existing randomized solo test was corrected to select a land explicitly when checking land casting; its previous first-hand-card selection could randomly be a creature. Mobile typecheck/lint pass. Expo shell code was unchanged; its live iOS manifest and development bundle return 200 with the current LAN endpoint. Prior native exports and Doctor 21/21 remain historical evidence.

## Visual review

Before and after screenshots use only isolated QA decks and were visually inspected. The mobile review led to removal of the duplicate app header, compact board/copy/undo controls and a persistent deck summary so card results appear in the ordinary phone viewport.

- [Before desktop deck](screenshots/integrated-builder-before-desktop.png)
- [Before desktop global discovery](screenshots/integrated-discovery-before-desktop.png)
- [After desktop builder](screenshots/integrated-builder-after-desktop.png)
- [Before phone deck](screenshots/integrated-builder-before-phone.png)
- [After phone builder](screenshots/integrated-builder-after-phone.png)

## Run and remaining work

From the repository root: `npm run dev:all`. Current live session: Mac http://127.0.0.1:5173, same-network phone web/server http://192.168.4.91:5173, Expo Go exp://192.168.4.91:8081. Restart after network changes so the launcher rediscovers the address. The current development session is assistant terminal 20808; the Mac and session must stay awake. API and web `/api/me` return 200; Metro reports running. No model credentials are configured.

Actual Expo Go phone/simulator interaction is not newly verified. Roblox owns foreground UI; native acceptance requires a coordinated slot to launch Expo Go and run builder journeys 1, 2 and 6. Phone-size browser testing does not prove native permissions, camera, sharing or WebView networking.

This milestone does not claim the full brief complete: the card-centered playtest redesign and accurately sourced commander recommendations are the next implementation batches. Existing playtest UI and suggestions are not reported as redesigned or verified by these builder journeys. EDHREC/Moxfield scraping or undocumented APIs were not introduced; those integrations remain constrained by their terms and the absence of a verified authorized API.

A pre-builder source checkpoint and the completed builder checkpoint are in the task workspace's `checkpoint/`; dependencies, databases, generated bundles, environment files and Git metadata are excluded. Existing user changes remain uncommitted and preserved. Weekly meter at handoff: 86% remaining in the seven-day window.
