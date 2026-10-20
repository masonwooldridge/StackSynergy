# Commander entry usability repair

## Reproduced causes

Baseline actual offscreen runtime: normal typed spaces/apostrophes retained focus and characters, but Enter issued zero lookup requests. Partial name Atraxa was rejected because the builder used the exact-name endpoint and only fell back to theme keywords. Lookup disabled its entire fieldset, so a slow request blocked further typing. Deck Choose commander opened generic search with no focus/scroll handoff. These failures are independent of the deferred Expo Go plain-D shortcut. Mason’s literal Safari typing failure has not yet been directly reproduced; foreground is reserved for Roblox and offscreen WebKit is unavailable. Do not claim that gap is closed.

## Changed path

Builder: Search commanders -> live debounced legal-commander card results -> select a real card -> visible selected confirmation and focus on card-pool Strategy -> choose collection/buy/mixed, budget meaning and amount -> construct/review100 -> save. Input stays editable while search loads, has Enter/Search, Clear, Down-to-results and standard keyboard/touch selection. Spaces and apostrophes are name text rather than an exact-name requirement or query syntax. Stale results cannot replace newer queries; no-result and provider failures have distinct messages, recoverable input and Retry. Construction still disables controls and can be cancelled. Supported construction strategies stay explicit in Strategy; the ambiguous name-or-natural-language-theme prompt is removed.

Deck: +Choose commander -> visible focused Search commanders field -> live partial-name search -> add/replace actual card with existing handlers. Reopening restores focus and retains the query. Partner/add/replace controls, deck rules, ownership, account-copy boundaries, upgrades and all other handlers remain. Card art, near-black typography/identity preserved.

Official interaction reference: https://manabox.app/guides/decks/getting-started/ documents deck name+format, an empty Commander section, typing names and adding cards from results. This app keeps its own licensed typography and bounded rules-based builder.

## Verification

108 tests/12 files; production build, ESLint, diff check pass. Browser regression at390/820/1440 covers actual key input with spaces/apostrophes, rapid changes, clear/focus, Enter, Down/Enter selection and next-step focus, mobile touch, editable loading, stale response ordering, empty/error/recovery and no overflow. Delayed/error response cases are explicit test fixtures. Real provider Krenko partial/full-name lookup ->100-card construction ->guest save ->playtest draw/back/reopen/reload passes. Real Atraxa deck Choose commander/focus/search/add/save/reload/reopen-focus passes390/1440. Guest offline save/export, edit/trash/restore/repeated fresh-ID imports and mock account separation pass, zero account-document writes. Focused contrast audit Home/deck/builder/Settings reports no below-threshold text. All browser checks use isolated fresh storage; no Mason drafts/account documents modified by QA.

Logs/screenshots: workspace checkpoint/commander-usability. Recoverable baseline/final source archives: checkpoint/card-chasm-before-commander-usability.tar.gz and checkpoint/card-chasm-commander-usability-final.tar.gz. No server restart, paid call, publication, security/permission change or deferred shortcut work. Weekly meter69% remaining at final verification. Direct Safari/native interaction remains pending foreground release; do not touch the live draft without inspecting its state first.

## Direct Safari follow-up

After foreground release, verified in a separate temporary Safari tab: clicked commander search, typed Atraxa, Praetors' Voice with spaces/apostrophe, Enter returned its real card and retained input focus. Clear -> Atraxa -> Enter returned three matching legal commanders. Clicked Atraxa, Praetors' Voice; selected confirmation appeared, Strategy received focus and Construct enabled. No deck save/build/account write performed. Closed only the temporary tab; original StackSynergy/StatPad tabs and drafts remained. Literal typing blockage did not reproduce in current Safari. Fixed-path Safari verification is now complete; do not claim an unseen original browser-specific blocker was independently identified. Foreground released immediately afterward.
