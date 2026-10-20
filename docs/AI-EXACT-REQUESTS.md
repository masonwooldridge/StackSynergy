# Exact AI requests and paired preview — 2026-10-20

The concrete request **“add more 5-mana creatures”** is now enforced as:

- Add actual creatures with canonical mana value **exactly 5**, not 5+ and not noncreatures.
- Cut a different, nonmatching slot, so any selected swap increases the matching mainboard count.
- Retain legality, colors, singleton, commander/land/count, protected cards, role/package floors, bracket rules and new-purchase/owned constraints.

Previously the planner had no formal type/mana filter and its generic curve penalty could reject a move up to five mana. The new request state is parsed from user messages only, carried across all available conversation history, included in candidate searches and comparisons, frozen with the server review, and checked again against canonical cards before apply. An explicit later cost can update it; a generic follow-up does not forget it. “5+”/“at least 5” is a separate explicit request. “Replace 5-mana creatures” can retain the same count; “more” must produce a positive increase. Explicit multi-addition requests require the corresponding selected increase, within the three-swap review limit.

If hard constraints have no compliant proposal, the server returns a precise no-match explanation **before making a model request**. It never broadens the request to cheaper or unrelated cards. New same-deck conversations invalidate older server review tokens, so an old proposal cannot be applied after a new constraint is submitted.

The paired preview now shows both full cards, names, exact card type, printed mana cost, numeric mana value, price/new-purchase estimate, reason, tradeoff and role/curve comparison. It also shows **Your request**, proposed matching count and selected matching count. Either card opens the full viewer. Apply remains explicit and is disabled until the selected increase meets the request; applied history shows only the swaps actually chosen.

## Verified example

In an isolated Satya copy, **Hill Giant (Creature — Giant, MV 4) → Mulldrifter (Creature — Elemental, MV 5)** costs an estimated **$0.33** in the frozen public card snapshot. Matching mainboard creatures increase **2 → 3** while the deck stays at 100 cards. Mulldrifter's alternate evoke cost does not change its canonical mana value of 5. This is an offline/mock-backed demonstration, not a new live model result or playtest.

## Checks

- **234 tests pass across 26 files**; typecheck, lint and build pass. Existing bundle-size advisory remains.
- Exact numeric/word/hyphenated and cost-after-type forms; exact five versus explicit five-plus; missing/unknown values; front-face type versus a creature back face; budget/owned/protected conflicts; more versus replace; positive count; minimum selected increase; seven-message inherited constraints; wrong model selections; and old-review invalidation are covered.
- Headless Chrome at **393 and 1440px** verifies actual type/mana/count preview, image/detail viewer, explicit review and real server apply with an injected mock provider. The matching group increases by one, 100-card count and untouched comparison document remain intact. Follow-up constraints, no-match under $0/owned-only and rejected wrong-type/cost output pass end to end.
- Earlier preview QA also covers no-swap/errors, stale deck/context, long replies and save/reload. The preceding 16 frozen generator regressions passed; originals were not overwritten. See [AI-PREVIEW-QUALITY.md](AI-PREVIEW-QUALITY.md) for the card-function fixes and before/after recommendation examples.
- **No paid calls in this entire preview/constraint batch.** Credential values were neither accessed by these checks nor displayed. The main conservative ledger remains **$0.09834**, pending **0**, unblocked, with its persistent **$4** ceiling unchanged. AI remains enabled under earlier authorization. Statsplice and paused Roblox were not operated.

The request parser supports tested common forms, not arbitrary natural-language constraints or a complete MTG rules engine. Detected conflicts ask for clarification. Users should verify the visible request banner, actual card effects and tradeoffs. General recommendation quality, fresh model compliance and native Expo device rendering were not re-evaluated live. Any targeted paid test needs renewed permission; none was made or automatically queued.

Evidence: delegated workspace `checkpoint/ai-exact-five/{tests.log,ui.log,ui-receipt.json,lint.log,build.log,exact-five-preview-393.png,exact-five-preview-1440.png}`. The Library preview was updated in place (same identity/version history) to `/exact-five-preview-393.png`, `libfile_f877ae526998819188c091c5d7346c24`. Source checkpoint: `checkpoint/card-chasm-exact-request-final.tar.gz`, excluding credentials, databases and dependencies. Preserve the current monetary ledger separately; never restore an old spend ledger with source recovery.
