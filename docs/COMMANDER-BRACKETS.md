# Commander bracket targets — checked October16,2026

## Behavior

Full construction now asks for a Target Commander bracket before its action is enabled. All5 targets are available: Exhibition, Core, Upgraded, Optimized and cEDH. Changing the target invalidates the previous result and cancels obsolete construction requests. Generated decks retain optional commanderBracket metadata through guest saves/reloads, exports/copies and the activated server schema; older documents without it remain compatible. Finished decks display their saved target and expose the same accessible reference.

Wizards' [current Commander page](https://magic.wizards.com/en/formats/commander) was retrieved2026-10-16. Its embedded official content supplied the53-name Game Changer snapshot and five bracket descriptions. [Wizards' October21,2025 update](https://magic.wizards.com/en/news/announcements/commander-brackets-beta-update-october-21-2025) supplies the intent/turn-context discussion and removal of old tutor-count restrictions. Current live format-page content takes precedence over historical lists. Reference includes checked date, source links, all5 summaries, general turn expectations, searchable card/color-group list, result counts and empty state; it uses normal labeled controls/details and44px actions. No scraped community power/popularity claims.

Card selection enforces the verified default Game Changer caps:0 for brackets1/2,3 for bracket3, no cap for4/5. Commander and mainboard quantities count, across printings/faces; double-faced front names and curly apostrophes match. Rules/legality/color, ownership and price constraints continue applying. Required unknown purchase quotes never become free. The budget-feasibility reserve now excludes Game Changer filler unavailable under the target; it cannot justify a costly engine using forbidden cheap cards. Recommendation review explains exclusions due to the cap. validateDeck diagnoses a saved deck exceeding its chosen cap. No saved deck is silently rewritten.

## Important limit

A bracket is a target, not a guaranteed power estimate. Automatic checking covers the Game Changer cap, not full bracket certification: theme, intent, actual win speed, two-card infinite combos, extra-turn chains and mass land denial require human review/pregame discussion. These behaviors are explicitly named in the UI caveat. The generator does not promise turn timing or cEDH competitiveness. Brackets4 and5 have the same card cap; their intent/metagame differ. Bracket1 can have agreed thematic Rule0 exceptions, but this builder deliberately uses the default zero limit and normal Commander legality. Do not imply it builds every possible agreed exception. The reference is a dated snapshot, not automatically refreshed; recheck Wizards before play. Game Changers and banned cards are separate lists.

## Verified

136 tests across17 files pass; production TypeScript/Vite build and ESLint pass. Targeted tests cover all5 caps, commander counting, later saved violations, double-face/name normalization, optional metadata compatibility, ownership/zero-budget rejection and budget feasibility with forbidden cheap filler. Build emits its nonblocking>500kB chunk warning (507.39kB JS,159.38kB gzip); no dependency/layout refactor was attempted for this bounded feature.

Headless actual canonical runtime at393px and1440px: bracket required; all5 descriptions;53-card reference search and no-results state; actual Satya bracket2 construction completes100 with0 Game Changers; guest save/reload preserves bracket2 and cards; finished-deck reference works; no page errors. Only isolated browser guest data was written. No real account save or new phone foreground test was performed. Native limitations remain in NATIVE-INPUT-DIAGNOSTIC.md.

The initially rejected API reload did not execute. After Mason explicitly approved the API-only restart, verified old API9271/launcher9270 were gracefully replaced by API31707/launcher31704 on3001, preserving current HOST/origins, persistent database and card cache. Recoverable SQLite backup was taken before reload. User/session/document/history/room digests are unchanged afterward. Vite69694 on5173 and Metro67146 on8081 were not restarted. New API source loads the optional bracket schema; live account mutation was intentionally not exercised.

Evidence: task checkpoint/brackets contains official-commander.html, official-extracted.json, tests-final.log, build-final.log, lint-final.log, ui.log, ui-saved-fixture.json, reference-desktop.png and data-preserved.json. Source data lives in shared/commanderBracketData.json; refresh it from the official source and adjust tests if Wizards changes the list/caps. No account credentials, database contents or dependencies are included in the final source archive.

Run with the existing coordinated session. Normal fresh startup is npm run dev:all from the repository root (see EXPO.md); do not launch duplicate sessions on occupied ports.

Meter: owner-confirmed45% remaining at12:55UTC authorized this bounded pass; actual meter restored during completion and read44% remaining. New user floor25% respected. No broader work performed.
