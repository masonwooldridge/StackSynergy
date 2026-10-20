# MTG terminology repair — 2026-10-20

## Diagnosis and bounded repair

The reported “mana rocks” conversation was not persisted, so its exact model response cannot be reconstructed. The inspected app pipeline had concrete weaknesses: generic ramp retrieval mixed artifacts and creatures; the old ramp classifier matched simple `{T}: Add` text and missed paid activation such as Signets; no reusable glossary converted colloquial terms into binding canonical function constraints. This supports an application grounding/filtering diagnosis, not proof that the underlying model does not know Magic.

`shared/mtgGlossary.ts` supplies aliases, definitions, examples, focused retrieval queries, cautious typo matching and ambiguity questions. `shared/mtgCardFunctions.ts` uses front-face card types and Oracle text to distinguish reusable artifacts, creature ramp, land ramp, fixing, cost reduction, rituals, Treasure and one-shot artifacts. It accounts for activation mana, separate sacrifice-draw abilities, artifact-creature hybrids, tapped entry and conditional dependencies. Other function families include draw/cantrip/loot/rummage, removal/wipes/counterspells, protection, blink/bounce, recursion/reanimation, sacrifice/aristocrats, tokens/go-wide/voltron, ETB/death, tutors and stax. Keyword definitions cover additional common terms.

The parser retains exact mana value/type, budget, owned-only, negation, preserved groups and mixed-function constraints through user turns. “More two mana rocks under $5, no tapped rocks” means exactly two mana, artifact acceleration, price at most $4.99 and no enters-tapped source. Unknown purchase prices remain ineligible. A separate sacrifice ability does not disqualify Mind Stone; Prophetic Prism is fixing, Lotus Petal is one-shot, and Silver Myr has both creature/artifact functions. Explicit OR groups use union; ambiguous combinations ask before proposing edits. Generic “counters”, “The Rock deck”, and expensive without price/mana meaning ask clarification. Explain mode cannot offer edits; simple glossary explanations require no provider call.

The composer shows recognized constraints and definitions before submission. Clarification-only requests are visible too. Server canonical validation remains authoritative; glossary text in a prompt alone is insufficient. Existing explicit review/apply protections and user decks are preserved.

## Reproducible evaluation

Run `npm test`, `npm run build`, and `npm run lint` from the repository. Existing app commands remain `npm run dev` for local web/API and `npm run dev:iphone` for the existing Expo wrapper; this terminology batch did not alter the native architecture or establish a new device-runtime result.

`evals/mtg-requests.json` is the reusable evaluation artifact: 20 development requests, canonical positive/negative examples, eight reserved held-out prompts, and scoped user preference feedback. `tests/mtgEvaluation.test.ts` runs 53 assertions/cases: request interpretation and canonical function adherence are separate tests. These are deterministic application tests, not model reasoning scores. `tests/mtgTerminology.test.ts` adds more card-function and constraint edge cases. The canonical fixture has 46 public card records recovered from public retrieval/cache. API tests inject a mock provider and include the combined rock request, local explanations and ambiguity handling. The Mind Stone API test explicitly mocks $1 pricing while retaining canonical rules text; its cached printing has unknown price.

Verified at this checkpoint:

- Full suite: 315 tests across 28 files; build/typecheck and lint pass. Build retains its existing >500kB bundle warning.
- Offline generator regression: 16/16 across Satya, Krenko, Muldrotha and Talrand, budgets $25/$50/$100/$200, with 100-card/budget/owned-rebuild checks. This is structural generation coverage, not strategic-quality certification.
- Actual public Scryfall seed query returned Arcane Signet, Boros Signet and Mind Stone: 3/3 reference recall for this one query. Broad candidate recall is unmeasured. An earlier bulk fetch hit HTTP429 and was stopped in favor of cached public card facts.
- Actual running API `/api/deck-ai/glossary?q=mana%20rocks` and `/api/deck-ai/status` expose glossary version `2026-10-20.1`; Vite serves the changed composer module.
- Headless Chrome at 393px and 1440px verifies recognized exact-rock constraints, ambiguity clarification and no horizontal overflow, using isolated storage and intercepting all AI endpoints. No chat was submitted and no account/deck writes occurred. This is browser UI evidence, not phone-native evidence.
- Paid model calls in this batch: zero. Conservative ledger before/after: $0.128062, pending 0, unblocked, $4 guard ceiling within the previously approved $5. The ledger was read and preserved, never reset. No weekly meter recheck was performed per the later user instruction.

Evidence is under `/Users/masonwooldridge/Documents/Codex/2026-10-14/task-3/checkpoint/ai-terminology/`: full logs, public retrieval receipt, running API responses, isolated UI receipt/screenshots and generator results. Earlier failed development logs are retained as diagnostic history; `tests.log`, `build.log`, `lint.log` and `ui-qa.log` are the final verification records.

## Limits and next bounded evaluation

This is an extensible rules-text heuristic and glossary, not a complete Magic rules engine, exhaustive jargon coverage, training, or weight fine-tuning. Activated/triggered abilities, replacement effects, modal cards, qualifiers and unusual wording can need additional cases. Cautious fuzzy matching does not correct every typo. Candidate retrieval remains bounded to three searches; official functions are locally validated, but full semantic recall is not proven. Existing historical weak live recommendations remain weak baseline evidence and have not been relabeled as success.

The eight held-out prompts are reserved/unscored. Strategic rubrics cover Satya clones, extra-combat timing, repeatable creature draw, six-to-eight-mana finishers, evasion and protection. User ratings apply to this user's bracket-4 Satya target: Inspiring Overseer is weak filler, Bedlam has synergy but should be downgraded as a default due symmetric risk, Whispersilk Cloak is acceptable but slow, and Dolmen Gate is preferred if budget allows. Positive overall feedback is not approval of every card and authorizes no automatic deck edits.

Next live evaluation proposal: after separate authorization for paid calls, run a small fixed held-out set (for example six strategic cases plus two terminology cases), log exact model output/usage with the existing ledger guard, and independently score retrieval recall, hard constraint adherence and strategic quality. Judge immediate impact, efficiency, total setup cost, downside and commander synergy together. Reserve at most eight calls; the current conservative pre-call reservation bound is $0.2072 each ($1.6576 total), not a price quote or expected spend. No live calls or training jobs are authorized by this report.

## Primary references

- [Wizards rules and current Comprehensive Rules](https://magic.wizards.com/en/rules); [2026-09-25 text](https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.txt): mana abilities, copying, entering attacking versus attack triggers.
- [Wizards keyword glossary](https://magic.wizards.com/en/keyword-glossary): canonical terms and counter distinctions.
- [Tarkir Dragonstorm prerelease guide](https://magic.wizards.com/en/news/feature/tarkir-dragonstorm-prerelease-guide) and [Secretversary announcement](https://magic.wizards.com/en/news/announcements/announcing-secret-lairs-secretversary-superdrop-2020-11-25): official use of mana-rock terminology.

Scryfall syntax documentation returned 403 in this environment; the saved actual query response verifies the syntax used, rather than claiming the documentation was read.
