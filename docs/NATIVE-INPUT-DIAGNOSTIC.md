# Native input/reload diagnostic — October16,2026

Bounded offscreen investigation only; Roblox retained foreground. No application code, preferences, developer tooling, storage or user documents changed.

## Evidence

- Installed simulator host is ExpoGo57.0.9; project Expo package~57.0.28, ReactNative0.86.3 and react-native-webview13.16.1. Existing app source intentionally reloads WebView only through the error-bar Retry control. Connection setup sets its URI; navigation-state handling records canGoBack. No handler tied to typing Energy/Fable or ordinary r was found in StackSynergy. This is source inspection, not proof against every native lifecycle bug.
- Existing Metro output /tmp/card-chasm-metro-evening.log shows bundle activity but no timestamped cause or matching JS exception explaining the native symptom. Metro process67146 stdin is /dev/null, excluding Metro terminal hotkey input. Simulator unified-log search for the attempted00:38–00:41 window returned no matching reload/crash/keyboard attribution; inconclusive rather than proof of no native problem.
- Upstream ExpoGo native source registers plain r/modifierFlags0 to refresh the visible app, and plain d/modifierFlags0 to its developer menu. It also has simulator hardware-key processing and first-responder checks involving WKContentView. Source: https://github.com/expo/expo/blob/main/apps/expo-go/ios/Exponent/Kernel/DevSupport/EXKernelDevKeyCommands.m . The locally cached inspected source /tmp/EXKernelDevKeyCommands.m contains the same plain-r refresh binding. Exact correspondence between current upstream source and every installed57.0.9 binary path was not proven.
- Earlier trusted native-session evidence checkpoint/expo-plain-d-shortcut.txt records actual d-key interception twice, including with the commander input focused. The latest native symptoms occurred with strings containing r; Satya typed successfully. Together these support an ExpoGo/native-key-routing hypothesis, but plain-r interception was NOT isolated in the latest session. Do not state it as a confirmed root cause or fix it by disabling global development tools.
- Controlled headless mobile Chromium,393×852/touch context, keyboard-typed Satya→selected commander→Energy mechanic and Fable of the Mirror-Breaker search preserved all characters, selected Energy and returned the card. Instrumented actual main-document navigation requests detected no reload while typing/searching. Intentional History API query changes are not counted as document reloads. Evidence: task checkpoint/tag-completion/input-reload-control.cjs and .log. This does not emulate native ExpoGo UIKeyCommands and does not prove WebKit behavior.
- Playwright's WebKit executable is absent at its expected local path. A headless WebKit test could not run with available runtimes; no browser was installed merely to stretch this diagnostic batch.

## Result and exact remaining manual QA

No reproducible application defect established; no speculative code fix made. Existing131-test/build/lint results apply to unchanged application source. Native build/cancel/retry/multi-tag/viewer/save checklist remains partly pending as recorded in NATIVE-FINAL-RESULT.md.

At the next coordinated foreground slot, use only a clearly disposable unsaved guest form:

1. Record whether the iPhone software keyboard is visible or Mac hardware keyboard input is being used. Focus a field and visually verify its caret. Type lowercase r alone using the software keyboard, then separately with Mac input; repeat with d and a neutral key. Observe whether text inserts, the developer menu opens or the whole Expo app reloads. Do not save the form.
2. Repeat Energy/Fable with the software keyboard or deliberate native paste after verified focus. Compare with the Mac automation route. A failure only through hardware/automation points toward host routing; software-key failure still needs native debugging.
3. Manually swipe the builder page with an actual touch drag. Distinguish inaccessible automation scrolling from a real WebView scroll defect. Do not change global Simulator keyboard or developer preferences as a speculative workaround.
4. If needed and coordinated, use a separate temporary iPhone Safari page as a control for the same public app, preserving all existing Safari tabs/drafts and leaving the Expo library intact. Do not claim Safari proves ExpoGo support.
5. Only after input/scroll is reliable, finish NATIVE-FINAL-QA.md: real build, cancellation/retry, two strategies, full viewer/face/zoom/close and isolated guest save/reload. No live account saves or storage reset.

If plain-r ExpoGo interception is confirmed, an app JavaScript key handler is not evidence of a native shortcut fix. A development/production client without ExpoGo host bindings may be a future scoped option; none was built/installed or proposed as already working here.

Meter before/after:51% used,49% remaining; weekly10080-minute window resets2026-10-22 06:13:09UTC. No foreground was taken during this diagnostic.
