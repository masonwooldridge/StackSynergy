# Basic mana allocation — October16,2026

The builder still reserves36 lands before choosing spells so land costs remain funded. Once the exact spell list is selected, it computes colored pip demand from those spells and the commander and exchanges basics toward that distribution. Each swap refunds one actual allocated copy and uses the existing legality/copy/ownership/quote/budget checks for its replacement. A failed exchange restores the original copy and cost. It does not change the chosen spells, nonbasics or land count, and never edits saved decks.

Generic/X costs do not count as explicit colorless requirements. C symbols do; Wastes can be used in colored decks when available. Two-color hybrid pips split demand between their colors. Two-or-color hybrids receive half colored demand; Phyrexian pips retain conservative colored demand. Multi-face cards use top-level cost when present, otherwise available face costs. Known nonbasic produced_mana sources receive fractional credit across the colors they produce (one total credit per land). Basic land types and direct tap-for-mana/any-color text provide a conservative fallback; color identity alone is not treated as production. Unknown sources receive no assumed credit. At least one basic is targeted for a demanded color without known nonbasic coverage when enough basic slots exist.

## Verified results

129 tests across15 files pass; TypeScript/Vite production build and lint pass. Asymmetric fixture: green-heavy green/blue commander deck now allocates28 Forests/8 Islands instead of18/18 after the commander source guardrail described below, including commander cost. The same fixture with18/18 owned basics remains18/18 at$0 purchases without inventing ownership. An unaffordable replacement restores18/18 and remains within budget and100 cards. Explicit C inside a green deck allocates35 Forests/1 Wastes. Hybrid/Phyrexian/generic/X parsing, absent-cost fallback and nonbasic production credits have focused cases. A75%-green/25%-blue demand with8 existing green nonbasics targets19 Forests/9 Islands for28 basics, rather than21/7 without source credit.

Canonical real public-card cases, $100 buy-all purchase cap:

| Commander | Basics after allocation | Final estimate | Result |
| --- | --- | --- | --- |
| Muldrotha |16 Swamp /12 Forest /8 Island|$93.89|Legal100;20/20 top nonland suggestions|
| Satya |11 Plains /12 Mountain /13 Island|$69.56|Legal100;19/20 top suggestions|
| Krenko |36 Mountain|$45.04|Legal100|
| Talrand |36 Island|$84.56|Legal100|

Real-data exact-binder owned-only cases still complete at$0 purchases with no missing copies. Empty owned libraries reject completion. $5 buy cases remain incomplete without overspending. Canonical headless UI acceptance passes against the real running API without route mocks or user-library changes. Results/quotes are snapshots; public candidate JSON and logs live in the task checkpoint/tag-completion (mana-real-cases.log, mana-satya.log, mana-browser.log, mana-tests.log, mana-build.log, mana-lint.log).

## Limits and running

This is a pip-weighted basics heuristic, not an advanced mana optimizer or a cast-on-curve probability model. It does not optimize colored activation costs, source timing, fetch sequences, snow costs, devotion, commander recasts or hybrid payment choices. Flexible nonbasics get fractional credit, not simultaneous multiple mana. The initial36-land reservation can constrain spell selection, and unavailable/expensive/unowned basics can prevent ideal target allocation. Missing cost facts use equal commander-identity weights only when no pip demand is known; unavailable source facts are not invented. Existing saved decks are not rebalanced automatically.

No API restart or extra service is needed for this frontend/shared-builder change. Use the existing coordinated Vite/Expo session; see EXPO.md for normal startup. No foreground/native actions were taken during this batch.

## Resilience follow-up: commander source guardrail

The earlier35/1 example exposed a real limitation: assigning one Island technically covers a required blue pip but leaves very poor access to the commander. Commander mana colors now target at least8 basic-equivalent sources for one pip, plus4 for each additional same-color pip, reduced by known fractional nonbasic coverage. Floors scale down when basic slots cannot satisfy all requested colors. These are conservative heuristic guardrails, not cast-on-curve reliability guarantees; restricted/slow sources can still fail in actual play, and budget/ownership may prevent reaching the target. The green-heavy GU fixture now targets28 Forests/8 Islands, with actual commander cost included. Four existing blue sources lower the required blue basics to4. The128-test checkpoint is superseded by129 passing tests and the resilience checkpoint.
