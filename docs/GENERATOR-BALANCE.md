# Commander construction balance — 2026-10-16

Commander relevance previously let synergy creatures consume support slots. The generator now discovers verified support candidates, allocates exclusive primary roles before synergy, caps commander-score influence on support choices, and spreads spell budget across roles. One card cannot fill multiple primary quotas. Affordable basic printing selection avoids prematurely exhausting spell budget; owned-only reservation preserves available colorless basics.

## Authored reading

- [Brian Cain, How to Build a Commander Deck](https://edhrec.com/guides/how-to-build-a-commander-deck): role planning, mana, velocity, interaction and playtesting; guidelines adapt to commander.
- [Cooper Gottfried, Upgrading Your Commander Deck](https://edhrec.com/guides/edhrec-guide-to-upgrading-your-commander-deck): adjust support for curve, commander and plan.
- [Tomer Abramovici, Budget Commander checklist](https://www.mtggoldfish.com/articles/shrine-tribal-50-100-200-budget-commander): distribute support and upgrades throughout a budget deck. Historical prices are not today's quotes.

Our starting heuristics: 36 mana slots; ramp 10, advantage 10, targeted interaction 8, wipes 3, protection 3, payoff/finisher support 4, remaining slots synergy. Typal starts with interaction 7 and wipes 2. Muldrotha favors replayable permanents; Talrand retains spell density. No instant/enchantment quotas or trained model. Curve affects support quality; land count is currently fixed.

Spell budget allowances: ramp 15%, advantage 18%, interaction 14%, wipes 8%, protection 7%, finishers 12%, synergy 26%. Cheap fallback fills scarce roles. Noncommander spell purchases are capped at 15% of total budget (25% at or below $25), with a $1 floor; commander cost is exempt. Unused budget is allowed: finite-pool greedy selection is not global optimization or a full-budget upgrade pass. Quotes exclude tax/shipping and can change.

## Before/after Satya

Preserved prior public build (not Mason's saved deck): $69.56, 58 creatures, 6 artifacts, 36 lands, zero instants/sorceries/enchantments. Retrospective exclusive classification with the new rules: ramp 8, advantage 8, interaction 4, wipes/protection 0, payoff 1, synergy 42.

New $100-cap build after the double-faced-land fix: $65.17, 41 creatures, 8 artifacts, 7 instants, 2 sorceries, 5 enchantments, 36 lands, 1 Other (battle). Types are exclusive and sum to 100. The earlier explanation about an artifact land was incorrect: Path of Mettle has a transform-only land back, which had been incorrectly counted as a land slot. It now uses a nonland allocation; this example has 36 front-face lands and zero modal land slots. Primary role costs:

|Role|Cards|USD purchases|
|---|---:|---:|
|commander|1|$0.35|
|mana|36|$14.77|
|ramp|10|$9.92|
|advantage|10|$11.52|
|interaction|8|$9.71|
|wipes|3|$5.62|
|protection|3|$0.87|
|finisher|4|$5.39|
|synergy|25|$7.02|

## Public-card matrix

All 16 builds complete within budget and meet primary-role targets. Exact generated deck represented as an active binder reconstructs at $0 with no missing copies; empty owned inventory fails honestly.

|Commander|$25 cap|$50 cap|$100 cap|$200 cap|
|---|---:|---:|---:|---:|
|Satya (land fix)|$24.45|$35.65|$65.17|$116.21|
|Krenko|$24.88|$47.41|$61.73|$104.88|
|Muldrotha|$23.05|$35.67|$56.62|$105.03|
|Talrand|$25.00|$42.32|$63.42|$79.46|

At $100, Talrand has 31 instants + 10 sorceries; Muldrotha has 28 creatures + 16 artifacts + 18 enchantments; Krenko has 30 creatures. Counts include commander; each type table sums to 100.

## Verification and running

149 tests across 20 files, TypeScript/Vite build and ESLint pass. Existing Vite >500 kB bundle advisory remains. Headless Chrome at 393 and 1440 px checks artwork, sorting, overflow, removal/undo/focus and isolated guest persistence. Live Satya build verifies balance report, 99-to-100 draft undo and complete-save gating without library writes. Manual draft edits hide stale construction totals; undo restores the prior report. Read-only baseline digests match users, sessions, documents, history and rooms. No foreground interaction, service restart, publishing or account change.

Run `npm run dev:all` from project root; see EXPO.md for Expo setup. Existing services remain running. In Assistant choose commander, bracket, budget and source; construct, inspect Construction balance & budget, then review before saving. Existing saved decks are not rewritten. Evidence: execution workspace `checkpoint/generator-balance/` contains snapshots, scripts, logs, screenshots and digest results. Recoverable source archive: `checkpoint/card-chasm-generator-balance-final.tar.gz` beside it.

Limitations: conservative front-face text heuristics can miss valid modal support and misclassify conditional abilities. A payoff slot is not proof of a lethal win condition. Bounded discovery can leave gaps, reported as warnings. Bracket checks cannot certify intent or combo speed. Actual playtesting and the separate native Expo input/scroll QA remain open; browser-width checks do not prove native phone support. This is rule/ranking implementation, not model training.


## Double-faced land correction

Land allocation now distinguishes front-face lands, modal double-faced cards with a playable land back, and transform-only land backs. Only the first two fill normal land slots. Mana-source accounting reads the selected playable land face instead of aggregate back-face mana. [Wizards: Zendikar Rising Mechanics](https://magic.wizards.com/en/news/feature/zendikar-rising-mechanics-2020-09-01) confirms the modal choice distinction. Unknown layout with a nonland front is conservative and not a land slot.

Targeted regressions cover all three kinds, front-only mana, and actual 36-land construction. The updated Satya recheck at $25/$50/$100/$200 completes at $24.45/$35.65/$65.17/$116.21, each with 36 front-face lands, all role targets, verified 100 cards and owned-binder reconstruction. Other commanders' matrix entries above retain the preceding verification snapshot; this narrow pass reran Satya only. Evidence: `land-recheck.log`, `satya-land-fixed-*.json`, `land-tests.log`, `land-build.log`, `land-lint.log`. Existing headless UI evidence predates this classification-only fix; no UI changes were made. The running Vite service serves the new classifier; generator execution remains frontend-side, with API card discovery unchanged. Saved decks were not rewritten.

Updated checkpoint: `checkpoint/card-chasm-land-classification-final.tar.gz`.
