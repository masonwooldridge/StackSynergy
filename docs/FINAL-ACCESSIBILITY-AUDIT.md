# Final accessibility/usability audit — October16,2026

Bounded offscreen audit of commander→deck and full-card viewer; isolated public-card guest fixture only. No foreground, real account saves, native-setting changes or storage resets.

## Concrete repair

Standalone Rulings & printing on Scryfall action measured223×20 CSS pixels in the full viewer. It now has a scoped44px minimum height with vertical padding and retains its link semantics and visible keyboard focus. Desktop and phone-rules-pane assertions verify44px after the change. No unrelated redesign or speculative native reload workaround was made.

## Verified

- At393px and1440px: viewer opens with focus on Close; Shift+Tab wraps to last action and Tab wraps back; Escape closes and restores the invoking card button. Existing visible focus outline is present. Mobile rules pane exposes oracle text; view controls have aria-pressed state and all measured viewer buttons have44px height.
- Commander search/strategy/source/budget inputs and checkboxes have visible labels; selection hands keyboard focus to strategy. Mechanic labels measured roughly174×51px on the phone layout, exceeding44px preferred target height.
- Commander search status uses role=status; failures use role=alert. Injected construction provider failures expose the error via an alert and re-enable the construction button at both widths. This checks DOM semantics, not actual VoiceOver speech delivery.
- Sampled actual rendered builder text:76 visible text nodes at each width, minimum computed contrast8.57:1, no failures against the scoped3:1 large/4.5:1 normal thresholds. Sampled viewer controls15.39:1; heading16.86:1; oracle8.57:1; external link10.59:1. This foreground/background calculation is a scoped audit, not a claim of full WCAG conformance or assessment of artwork/anti-aliasing/OS UI.
-131 tests across16 files, production TypeScript/Vite build and ESLint pass. Existing end-to-end resilience, guest save/reload and cancellation evidence remains in prior reports; no broader behavior changed in this CSS/link-class repair.

Evidence: task checkpoint/tag-completion/accessibility-before.log (20px action), accessibility-final.log and accessibility-audit.cjs (44px assertions/focus/labels/contrast/error recovery), final-a11y-tests.log, final-a11y-build.log, final-a11y-lint.log. This is the final source change after the native cancellation checkpoint.

## Remaining limits

Actual VoiceOver/navigation announcements, touch input and final Expo native checklist remain pending due the documented host-input/scroll automation limitation. Plain-r ExpoGo reload is a source-backed hypothesis, not a proven latest-session root cause. See NATIVE-INPUT-DIAGNOSTIC.md and NATIVE-FINAL-QA.md. Mana allocation remains heuristic with commander guardrails, and account saving on real data was intentionally not exercised.

## Canonical state

Existing API9271 on3001, Vite69694 on5173, Metro67146 on8081 were preserved. Source/build active in the current Vite session; no API restart was needed for this viewer-target repair. Final runtime metadata and user-data digests are in final-canonical-state.json. Source checkpoint excludes credentials, database files, Git internals, dependencies and generated native directories; no user changes were reset or committed.
