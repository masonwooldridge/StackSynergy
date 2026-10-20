# Completed bounded live evaluation

**Eight paid attempts completed; no ninth call.** Ten HTTP responses include two free, incorrectly routed glossary responses that were fixed before their actual paid evaluations. The clone retest replaced the original standalone evasion case; evasion is not a separate tested case. No saved deck was edited or applied.

## Measured cost

189,319 input tokens and 6,296 output tokens yield **$0.05992175 before any cached-input discount** at the verified [GPT-5 mini rates](https://developers.openai.com/api/docs/models/gpt-5-mini). The ledger does not retain cached-token counts; this is a usage-derived estimate, not an invoice. The existing full-input-price 2× conservative accounting charged **$0.1198435**, moving the ledger from **$0.128062 to $0.2479055**. Pending 0, unblocked. The $1.66 additional cap, existing $4 cutoff, model, output bound, rate limits and persistent guard were unchanged. All errors/incomplete responses count toward eight; the clone retest used the entire 1,800-token output bound and was charged.

An initial transmission denial occurred before execution. The user then explicitly approved the isolated deck copy, notes and eight prompts going to OpenAI's API; the denied operation was retried once. Three paid calls initially ran, then the evaluator stopped on a quality failure. The parent explicitly directed continuation within the same eight-attempt allowance. No credential changes, top-ups, subscriptions or publication occurred.

## Actual results, separated by criterion

| Paid attempt | Actual application/model result | Hard constraints / strategic assessment |
| --- | --- | --- |
| 1: Two-mana rocks | Hill Giant → Cryptex; Prophetic Prism → Azorius Signet; $0.49 retrieved purchase total | Mana value, artifact function, untapped entry, sub-$5 budget and net group increase pass. Local review overstated Cryptex's reliable early-ramp sequence. |
| 2: Exclusion/reversal | Same eligible rock pairs, while retaining no-dork restriction | Explicit role reversal and hard constraints pass. Raw model rationale is not observed: the app rewrites review prose from validated pair reasons. |
| 3: Creature clones | Discussed Saheeli Rai and Splinter Twin; acknowledged absent creature clones; displayed unrelated Cryptic Trilobite source | Partial, not a strategic pass. Original query omitted dedicated clones; confusing legend/ETB wording and source mismatch. |
| 4: Clone fix retest | Corrected query supplied Clone, Phyrexian Metamorph and Spark Double, but provider hit output limit | **Failed/incomplete**, HTTP400; no usable answer or changes. Retrieval repair is observed, reasoning improvement is not. |
| 5: Extra combats | Discussed Lightning Runner and Combat Celebrant | **Rules failure:** explicitly claimed a token entering attacking triggers when-attacks abilities. That contradicts the rule despite the prior instruction. No edits proposed. |
| 6: Six–eight mana finishers | Discussed Aethertide Whale (6), explicitly excluded Aether Refinery as a noncreature | No edits; range/type distinction partly respected. Narrow retrieval and weak finisher assessment: a large flying energy body is not a demonstrated lethal route. |
| 7: Repeatable creature draw | Discussed Reconnaissance Mission and Idol of Oblivion | These are recurring combat/token engines but **not creature cards**; the requested creature options were supplied in context, including Enduring Curiosity, and ignored. Partial/unsatisfactory for the intended creature-based request. |
| 8: Attacking-commander protection | Discussed Dolmen Gate, Cloak, Greaves/Boots and interaction; acknowledged high Dolmen price | Some correct combat/removal and setup distinctions, but **falsely called retrieved Dolmen Gate/Cloak installed**, and overgeneralized protection. No edits. |

The live data is **not a strategic-quality pass**. Prompt corrections alone did not reliably resolve rules or instruction compliance. There was one incomplete paid response, a severe attack-trigger error, and residual type/membership confusion. The two rock controls demonstrate bounded validated selection, not general expert reasoning. The original standalone evasion case remains untested.

Both draw and protection first hit the local glossary route at zero paid cost because “my Satya bracket 4 deck” did not match the old “my deck” string check. The route was corrected and the two unspent paid slots used for their actual runs. This produced ten HTTP responses but exactly eight settled provider records.

## Scope and source evidence

Requests used the existing running `/api/deck-ai/chat`, real OpenAI adapter and guard. An isolated guest fixture had a new ID, bracket 4, and Mind Stone replaced with legal Prophetic Prism to open a rock slot. No account request or `/apply` was sent. Purchase budget remained $5 for all cases; this is not a full $300 deck evaluation. After the routing fix, discussion retrieval may include higher-priced sources to explain affordability; discussion has no mutation options and the purchase budget is not increased.

Grounding files reconstruct exact public cache keys after each HTTP call; they are not intercepted provider payloads. Before clone retrieval repair, none of the three cheap reference clones were present. The corrected actual retest query supplied all three, although the answer was incomplete. The draw query supplied Enduring Curiosity, Faerie Mastermind, Welcoming Vampire and Tandem Lookout; the model's noncreature response therefore cannot be blamed only on missing retrieval. The protection query supplied Dolmen Gate and other choices, but a candidate list was confused with deck membership.

## Offline corrections and limits

- Cryptex's collect-evidence cost is conditional, no longer reliable acceleration or a guaranteed early-ramp sequence; its review explains graveyard-resource consumption.
- Clone discussion uses clone sources rather than generic ETB creatures. Added targeted creature-draw, protection and explicit finisher-range discussion retrieval.
- Contextual discussions reach the advisor, while plain term definitions stay local. Discussion can verify sources outside the purchase cap without proposing purchases.
- Provider context now explicitly marks `inDeck` and `deckQuantity`; source cards deduplicate printings and match names in prose. Internal UUIDs are removed from displayed prose. Instructions now request concise replies and actual requested card types. Instructions did not always prevent long/id-heavy outputs in the live cases; no extra call tests the final changes.
- Narrow factual checks now reject the observed entering-attacking/attack-trigger claim and explicit false “candidate is in deck” claims. These are targeted safeguards, **not a complete Magic rules engine or universal semantic verifier**. They preserve no-change behavior rather than displaying a known false answer.

**339 tests / 31 files pass**, build/typecheck and lint pass. Build retains bundle-size and dependency-comment advisories. The final safeguards, membership metadata and concise-output changes have offline coverage but **no paid retest**, because eight attempts are exhausted. Mocked browser QA remains separate from actual model evaluation. Original live responses are preserved unchanged for review.

## Deliverables

Evidence root: `/Users/masonwooldridge/Documents/Codex/2026-10-14/task-3/checkpoint/ai-live-approved/`.

`results.json` contains all ten HTTP responses and settled usage rows; `completed-summary.json` separates paid/free attempts and cost. Per-case `*-request.json`, `*-result.json` and `*-grounding.json` preserve actual prompts, answers and source reconstruction. `complete-tests.log`, `complete-build.log` and `complete-lint.log` are final offline checks. Exclusive locks remain in place; do not rerun the saved runners as an implicit retry.

Any related reference prompts used for these fixes are development-exposed, not blind holdouts. No fine-tuning or training occurred. Further paid evaluation requires a new instruction and must not be represented as part of this exhausted eight-attempt batch.
