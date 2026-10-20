# Focused strategic discussion improvement

## Evidence and reproduced failures
Read the preserved eight-attempt evaluation and actual combat, clone, creature-draw and protection responses. The batch remains a failed/partial strategic evaluation; its standalone evasion case was never run. Added four initially failing regression tests for an attacking-token wording variation, possessive/already-run membership claims, an artifact-type legend-rule loophole/copied-entry denial, and damage-prevention-as-evasion/removal protection. The before receipt records4/4failures; corrected coverage now passes.

## Implemented
Added bounded discussion grounding from canonical card facts: actual front-face type, draw-event categories/conditions, copy replacement and exceptions, attack versus combat-damage timing, setup costs and limitations. Installed discussion is separated from new options, using canonical identity, positive quantity and all document boards. Rejected/previous-alternative names stay out of new discussion options while named explanations remain allowed. The model still receives current deck state and prior conversation; mutation requires existing validated swap options.

Added standalone evasion retrieval for direct unblockability and conditional/setup alternatives. Strengthened narrow response checks for the observed combat/copy/type/membership contradictions and direct advice to add installed/rejected cards. Wrong replies fail closed without a retry or deck mutation. Creature-draw checks allow explicitly labeled noncreature comparisons and honest missing coverage. These are targeted checks, not a comprehensive rules engine or semantic proof.

A mocked follow-up exposed discussion-only intent being lost after “other options”; explicit no-edit intent now carries forward until the user explicitly requests changes.

Reviewed Wizards’ current linked Comprehensive Rules, effective September25,2026:508.4,603.6a,707.2,704.5j,707.9b. Guide embeds rule numbers and the official source. Card text is preserved canonical Scryfall grounding from prior evaluation artifacts, with provenance in the fixture. Source: https://magic.wizards.com/en/rules and https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.txt .

## Verified result
373tests/36files pass, along with production build, TypeScript and lint. New tests cover creature/noncreature distinction, clone exceptions, evasion versus damage prevention, shroud/setup caveats, sideboard/alternate-print membership, rejected options, correct negation, actual API context and refusal behavior. Mocked browser tests confirm bad membership/combat prose is not displayed, corrected discussion succeeds, account writes=0 and isolated deck state is unchanged. Existing Search and continuous-conversation safeguards remain. Build retains existing bundle-size/dependency-comment advisories.

No paid AI calls, provider-setting/budget/credential changes, saved user deck/collection changes or publishing. Eight-attempt paid approval remains exhausted regardless of weekly usage reset. This verifies retrieval, evidence and guardrail behavior, not live model compliance or improved strategic judgment. Regex checks have bounded coverage and may miss other phrasings or need refinement for legitimate complex exceptions. No live finisher-quality, clone-answer completeness or standalone-evasion quality pass is claimed.

## Useful next feedback
Mason can provide the exact prompt and answer that felt wrong, the intended card role, and one acceptable versus unacceptable example. Useful distinctions: draw on an actual creature card versus a noncreature creature-payoff; single-entry value versus recurring draw; unblockability versus protection from combat damage or removal. A deck export plus the last few concrete playtest problems and protected cards is more useful than a general power rating. Existing answers/screenshots are enough; no new paid run is needed for that feedback.

Future manually reviewed cases (not blind holdouts): Satya copying Combat Celebrant during an attack and what a later extra combat requires; copying Spark Double versus an ordinary clone and then copying that result; repeatable creature-card draw with exact conditions; standalone evasion with setup cost and limitations; absent-versus-installed card claims before/after isolated edits; discussion-only follow-ups with rejected options. Any live model evaluation requires new explicit spending authorization and should score full answer accuracy/completeness, not only guardrail success.

Task evidence: checkpoint/strategy-pass/{before.log,after-focused.log,tests.log,build.log,lint.log,rendered.json}. Recoverable source: checkpoint/card-chasm-strategy-pass-final.tar.gz.
