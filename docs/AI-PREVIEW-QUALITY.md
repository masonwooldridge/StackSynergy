> Latest exact mana/type and count requirements: [AI-EXACT-REQUESTS.md](AI-EXACT-REQUESTS.md). The original preview results below remain historical evidence.

# AI card preview and recommendation corrections — 2026-10-20

AI proposals now appear directly inside the assistant reply, above the composer. Every swap has full removed/added card images, printing-aware removed-card USD estimate, added-card market estimate and new-purchase amount, a concise deck-specific reason, tradeoff, role-count comparison and mana-value comparison. Either card opens the existing full-card/rules viewer. No card changes occur until the user selects a pair and presses Apply reviewed swaps.

Old previews remain visible as applied or inactive history. Deck, inventory or budget changes invalidate pending previews; expired reviews stop offering Apply. Server apply still checks original deck/inventory content, review lifetime, ownership, exact selected pairs, legality, colors, singleton, commander/count, role/package floors, bracket constraints, owned copies and addition budget. Cuts provide no sale credit. Unknown prices are never represented as free purchases.

## What was wrong

The earlier UI placed reviews below the composer and showed only a small added-card image. Removed printings were absent from the response, and no clear paired comparison appeared in the conversation. Assistant replies could be longer than the 2,000-character history input limit, causing a valid follow-up to fail schema validation. Context changes also discarded the whole visible transcript.

Recent user chat is held only in the open page's React memory; it is not persisted in the app DB or browser storage. No private browser session or unrelated account data was accessed. Diagnosis used the saved earlier live-test responses and source inspection. The saved outputs showed actual weak substitutions and inconsistent names/IDs, not just transport errors.

## Recommendation changes

The model receives goal-focused candidate searches, deck role/curve analysis and up to three compared, server-validated pairs. Exact pair membership is enforced again after model output; the model cannot recombine an allowed cut with another option's addition. Its structured schema includes exact pair alternatives. Displayed action labels, prices and comparison reasons come from canonical card records and deterministic comparisons, so free-form prose cannot rename the actual change.

The planner now honors requested cuts, protected card names and keep-removal intent; rejects irrelevant roles, obvious equivalent sidegrades, excessive curve increases, unrequested coin-flip outcomes and X costs whose printed mana value hides their required investment; and retains all existing legality/count/budget checks. Shared role corrections distinguish one-use mana filters and permanent exchanges from reliable acceleration/draw, delayed one-shot cantrips from persistent draw engines, energy upkeep from energy generation, and self-countering clauses from interaction. Chaos Warp's shuffle removal is recognized as interaction. Creature-entry draw is recognized for commanders that can reuse it.

If no clear compatible improvement exists, the conversation explicitly says no swaps are queued. Unavailable candidate searches are reported rather than silently implying a complete search. Grounded cards discussed in prose can still receive artwork/details even if the model omits its card-reference list. These are conservative heuristics and exact-data controls, not training, full rules reasoning, power certification or win-rate evidence.

## Before / after evidence

| Case | Earlier recorded/incorrect behavior | Revised offline result |
| --- | --- | --- |
| Satya, requested draw | Hill Giant → Static Prison, with energy maintenance described as an engine | Hill Giant → Spirited Companion, $0.32 in the frozen pool; creature-entry draw works with copies, mana value 4 → 2; gives up the 3/3 body |
| Existing interaction | Actual structured cut Chaos Warp → Barbed Sextant while prose named Hill Giant | Exact-pair enforcement prevents mixed selections; mana-neutral one-shot filter is rejected as ramp/draw; keep-removal intent protects interaction |
| Equivalent draw bodies | Potential substitution without a meaningful functional gain | Wall of Omens → Spirited Companion rejected as a sidegrade |
| Talrand card advantage | Delayed one-card cantrips or X-cost hand filtering could look like cheap draw engines | No improvement proposed in the tested frozen pool rather than a forced substitution |

The first comparison uses an expanded, goal-focused frozen card pool and the revised deterministic planner; it is not a controlled live-model or playtesting comparison. Additional synthetic weakened-slot checks passed for Satya, Krenko and Muldrotha, with all selected combinations validated and originals unchanged. Krenko selected General Kreat, the Boltbringer over Goblin Piker ($7.48); Muldrotha selected Altar of the Wretched over Walking Corpse ($1.86). These remain conditional recommendations requiring card-text review, not blanket endorsements.

## Verified and remaining limits

- **216 tests passed in 25 files**, including new real-card/goal/curve/history regression cases. Typecheck, lint and build pass; existing >500kB bundle advisory remains.
- Headless Chrome at **393px and 1440px**: both real card images/prices load; both cards open the full viewer and restore focus on close; explicit selection required; actual server review/apply handlers with an injected mock provider; isolated guest save/reload and untouched comparison document preserved; no horizontal overflow or page errors.
- No-swap, provider-error, client context invalidation, actual stale-payload server rejection and follow-up after a long assistant reply pass end to end.
- All **16 frozen generator regressions** (Satya/Krenko/Muldrotha/Talrand at $25/$50/$100/$200, plus owned-only reconstruction) pass after the shared role corrections. Earlier snapshot files were not overwritten.
- **Zero paid calls in this batch.** The UI harness intercepts every assistant request and forwards chat/apply only to an ephemeral backend with a mock provider; it never loads or accesses the real provider credential. The main ledger stayed at **$0.09834 conservative use, pending 0, blocked false**, exactly the baseline. The persistent $4 ceiling is unchanged. AI remains enabled as previously authorized; no credentials/billing settings changed.
- No new live model evaluation or native phone runtime test occurred. Complex rules, conditional engines and user intent can still be misclassified. The tested improvement is a clearer review experience and better bounded candidate selection, not proof of broadly strong deck advice. A targeted live follow-up would need renewed permission: two prompts would reserve at most $0.4144 in total under the unchanged guard, with model token cost bounded by half that at reviewed rates; no such calls were made.

Evidence in the delegated workspace: `checkpoint/ai-preview-quality/{evaluation.json,generator-regression.json,ui.log,ui-receipt.json,tests.log,build.log,lint.log}`. Images: `paired-preview-393.png`, `paired-preview-1440.png`, `conversation-393.png`, `conversation-1440.png`, `no-swap-393.png`. The phone preview is saved to Library as `/paired-preview-393.png` (`libfile_f877ae526998819188c091c5d7346c24`), with local Library identity metadata applied. It is clearly an offline QA proposal, not a fresh live model result.

Recoverable source checkpoints: `checkpoint/card-chasm-before-preview-quality.tar.gz` and `checkpoint/card-chasm-preview-quality-final.tar.gz`. Both exclude credentials, dependencies and data. Preserve the CURRENT spend ledger separately; never restore an old ledger when recovering source. Original Safari/account decks, Statsplice and paused Roblox were not edited or operated.
