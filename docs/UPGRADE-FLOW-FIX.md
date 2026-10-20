# Existing-deck upgrade flow repair — 2026-10-19

## Reproduced causes

The only existing upgrade form posted to /api/assistant and disabled Analyze & propose unless an account library, signed-in user and configured model credential were all present. Guest decks and the current no-model configuration therefore had no functioning upgrade path. The form was also buried below the complete new-deck builder. The deck action simply navigated there without selecting an upgrade tool.

## Implemented repair

A local rules-based Commander upgrade tool now works in guest and account libraries without model setup or paid calls. New deck / Upgrade existing deck navigation exposes the two tools directly. The deck's Upgrade deck action opens the selected deck in upgrade mode; reopening that contextual route retains upgrade mode. Existing optional server-model analysis remains separate and collapsed; it was not called in QA.

The planner verifies current existing-deck facts, uses the improved commander/function ranking, and proposes at most five atomic cut-one/add-one pairs. Each proposal preserves commander, lands, total count, singleton/color/legality and the saved bracket. Existing functional-role and theme-package floors are retained. Cards explicitly named in deck notes are conservatively protected; heuristics still cannot certify every combo. Reasons show the actual commander/function match.

Budget means new purchases only, with no sale credit for cuts; verified owned copies cost zero. Unpriced purchases do not become free. Ownership comes from verified active binders, never decks or wishlists. Deck revision/content and active binder signatures are rechecked before apply. Individual selection combinations are validated, so a partial selection cannot silently violate constraints. Generation cancellation and option changes abort/stale-guard previous results. Apply uses the existing guest/account save path and revision safeguards. No automatic apply.

Clear feedback covers unsupported formats, missing/multiple commanders, incomplete count, invalid budget, provider failure, stale deck/inventory, invalid selections and no verified improvement fitting the pool. This bounded local tool currently handles complete, single-commander 100-card Commander decks and nonland replacements; it does not invent repairs for incomplete decks or alter mana bases. Other formats retain card search and optional existing model analysis.

## Verified results

- 162 tests across 22 files pass, including new planner regression tests. Production TypeScript/Vite build and ESLint pass. Existing >500 kB Vite bundle advisory remains.
- Isolated real-card Satya fixture: actual guest find upgrades → cancel → retry → select paired swap → preview at 100 cards → apply → open → reload passes at 393 px and 1440 px. Original source fixture and separately stored original document remain unchanged. Browser request checks confirm no account/model API writes; no page errors or horizontal overflow.
- Explicit deck action opens upgrade mode for that deck and restores the context on reload.
- Verified owned-only, $0 budget preview/apply passes; binder quantities/content remain unchanged.
- Clear 99-card error, negative-budget disabled action and empty-owned/no-apply result pass.
- A separate Krenko preview yields five valid swaps totaling $4.84 within a $5 new-purchase cap, preserving 100 cards without mutating the source.
- The first final desktop run overlapped an application hot reload; the stable-source desktop rerun passes. See desktop-final.log for final evidence.

Evidence: execution workspace checkpoint/upgrade-fix/ contains unit/build/lint logs, guest journey scripts/results, error/owned/entry checks, Krenko preview and isolated review screenshots. Recoverable source checkpoints: checkpoint/card-chasm-before-upgrade-fix.tar.gz and checkpoint/card-chasm-upgrade-fix-final.tar.gz with adjacent SHA256.

## Preservation and remaining verification

Actual Safari guest review document4ed0530e-8759-4c73-bc85-839f5c021b98 was not edited or used as an apply target. Tests used ephemeral headless browser storage and randomized clone IDs based on its exported snapshot. No account-deck mutation, credentials, publishing, purchase, security setting or port5186 change. Existing :5173 preview remains running; no foreground automation was used.

Actual signed-in account apply and native iPhone/Expo UI were intentionally not exercised on user data. Both library modes share the same pure planner and existing onSave path, but browser guest verification does not establish those journeys. Optional paid model analysis was not invoked. Suggested swaps require human review for conditional effects and combinations; no win-rate claim is made.
