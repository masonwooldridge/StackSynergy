# Live AI smoke test — 2026-10-19

The owner explicitly approved activation and initial live tests within $5 TOTAL, without billing changes, subscriptions or top-ups. Only the nonsecret `AI_CHAT_ENABLED` flag was changed; the owner-supplied credential remained in place and was never displayed or copied into output. The existing API watcher reloaded; preview 5173 and Metro 8081 stayed running.

## Actual results

The configured OpenAI `gpt-5-mini` is available to this account despite its official model page marking it deprecated. A live new-deck conversation returned a Satya energy/entry plan, six verified source cards and clarifying questions. This is conversational planning, not a generated/priced 100-card deck. No deck was saved.

A live upgrade request on an isolated 100-card copy returned a validated **Hill Giant → Static Prison** proposal at **$0.39** against a $25 new-purchase budget. To isolate the final test, all other nonland cards in this synthetic copy were named as protected in its notes. This demonstrates a bounded single-cut scenario, not broad strategic-quality validation. The addition provides an energy/removal option; it does not prove the user's preferred draw/ramp outcome or a win-rate improvement.

Phone-width headless Chrome replayed that actual live response to avoid a further paid call, then performed a REAL `/api/deck-ai/apply` request and saved only to isolated guest browser storage. Explicit checkbox review was required. The result retained 100 cards, commander and land entries, removed Hill Giant and added Static Prison. No account library or actual Safari saved deck was modified. This UI test replayed the response; it did not make another live model call or test native Expo device rendering.

## Cost and ledger

Six actual provider requests were necessary: one incomplete build response, one successful build response, two rejected unsafe/ungrounded upgrade outputs, one upgrade with inconsistent narrative, and the final upgrade. An additional complete-deck context overflow was rejected BEFORE provider access and incurred no model request. No ambiguous charges remain.

Provider-reported aggregate usage: **109,114 input tokens + 3,994 output tokens** (output includes reasoning). At reviewed standard rates, ignoring possible cached-input discounts, the usage-derived upper estimate is **$0.0352665**. This is an estimate from actual usage, not an invoice or confirmation of taxes/currency conversion. The conservative ledger retains **$0.070533** with its 2x margin. All six requests are settled, pending=0 and blocked=false. The persistent $4 conservative ceiling within the $5 approval remains unchanged. The ledger was not reset, reinitialized or topped up. It must be preserved across recovery/restarts.

Sources rechecked before live access: https://developers.openai.com/api/docs/models/gpt-5-mini ($0.25/million input, $0.025/million cached, $2/million output), https://developers.openai.com/api/docs/guides/reasoning (reasoning/output accounting), and https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_new_params_and_tools (documented minimal reasoning and verbosity controls for the GPT-5 series). Live tests confirmed the configured model and controls work for this account; no model substitution occurred.

## Corrections prompted by live testing

- Default reasoning consumed the entire 1,800-token budget before useful output. The adapter now uses documented minimal reasoning and low verbosity within the UNCHANGED output/cost bound. This trades deeper deliberation for bounded conversational responses; it needs further quality evaluation.
- Full-deck context included every format's legality metadata. Only Commander legality is now supplied, retaining the same character bound and authoritative canonical card facts.
- Unsafe/ungrounded model output was rejected without mutation. The provider's structured schema now enumerates verified card IDs and allowable cut/add IDs, with a shortlist of individually validated swap options. Apply still rechecks the selected combination.
- The first successful structured upgrade had prose describing a different cut from its selected ID. Review replies and source cards now derive their action labels from the validated structured pairs, so prose cannot silently change which action is presented. Free-form reasons remain untrusted and require human inspection.
- Candidate searches now prioritize reviewed commander cards, reusable creature-entry effects and energy engines over a primarily generic-artifact pool, with bounded search sizes.

## Remaining limitations and final verification

Advice/reasons can still contain strategic or rules mistakes; server legality/cost checks do not certify every claim, combo, bracket power, tradeoff or deck strength. The successful build reply was not independently validated sentence by sentence. No fine-tuning/training, bulk paid evaluations, public publishing, billing change or external account action occurred. Larger collections, unsupported deck states, unknown pricing or uncertain provider results fail visibly/closed.

AI is left enabled under the owner's activation instruction, subject to the same persistent allowance and pricing expiry of 2026-11-02. Future user sends may incur guarded charges. No further provider calls were made for final checks.

Final verification: **203 tests passed across 24 files**, typecheck/build/lint passed. Build retains the existing >500kB bundle advisory. Focused provider tests are mocked; the six live calls above are separately recorded. Current services 5173/3001/8081 remain available.

Evidence in the delegated workspace: `checkpoint/ai-assistant/live/build-conversation.json`, `build-incomplete.json`, `upgrade-context-rejected.json`, `upgrade-unsafe-rejected.json`, `upgrade-ungrounded-rejected.json`, `upgrade-narrative-mismatch.json`, `upgrade-response.json`, `ui-apply-receipt.json`, `usage-receipt.json`, `review-393.png`. Final source checkpoint: `checkpoint/card-chasm-ai-live-tested-final.tar.gz`, excluding all credentials and databases. Never restore an old budget ledger when restoring source.
