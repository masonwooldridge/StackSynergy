# Run StackSynergy with Expo

StackSynergy now has an Expo SDK 57 mobile app in `mobile/`. It uses Expo Router, a native WebView containing the existing working interface, native camera/photo selection, and native export sharing. Accounts, decks, inventory, AI and rooms use the same backend. It is an online client; the backend is still required. It is not a fully native interface or an offline bundled catalog.

## Recommended local web + iPhone session (October 13 repair)

From the repository root, run `npm run dev:iphone` in VS Code's terminal. It starts one coordinated session for Vite, the existing API/database and Expo Go, opens the iOS simulator, and supplies the computer's Wi-Fi address to the app automatically. For a physical iPhone without launching the simulator, use `npm run dev:all`. Stop previous StackSynergy processes first; the launcher deliberately rejects occupied ports instead of silently switching Safari to another port.

- Safari: http://127.0.0.1:5173
- Current Wi-Fi app address (October 14): http://10.47.237.193:5173
- Current Expo Go address (October 14): exp://10.47.237.193:8081

Both devices must be on the same Wi-Fi. Keep the VS Code terminal and Mac awake. The address may change on another network; restarting the launcher discovers it again. `CARDCHASM_DEV_IP` can select a specific network interface if necessary. This is a local development session, not public hosting. The server data directory is preserved.

The mobile shell automatically connects to the supplied endpoint and remembers successful manually configured endpoints. Outside the coordinated launcher, development fallback uses Expo's host address with backend port 3001. Native JavaScript errors now appear with Retry instead of leaving a silent blank page.

Root React and React DOM are pinned to the same 19.2.3 release. The previous installed 19.3.0/19.1.0 mismatch caused a blank page in fresh Safari/WebView sessions even though builds and TypeScript checks passed. A runtime-version regression test now catches that defect. Mobile's SDK-managed React remains 19.2.3.

Verified this repair: API reachable through loopback and Wi-Fi; Expo iPhone 16e/iOS 26 simulator automatically connects, renders Home, navigates to Search, and displays live Lightning Bolt results. Native Photos picker opens. Further UI checks were interrupted when the Mac locked; photo cancellation, native sign-in/session persistence, physical iPhone camera and physical-device networking remain unverified. The simulator is signed out; log in with your existing account to access your collection. No account/inventory data was replaced.

## October 14 startup correction

Run Expo from `mobile/`, never with `npx expo start` at the repository root. The root is the Vite/backend package; its accidental Expo dependency causes Expo to select `expo/AppEntry.js` and fail to resolve `../../App`. A root configuration guard now explains the correct commands before generating a misleading QR code. `npm run expo` is an alias for the mobile-only start command; `npm run dev:all` supplies all three services and the phone endpoint.

If `dev:all` reports port 8081 occupied, stop the old root Expo session in its own terminal with Ctrl-C, then rerun `npm run dev:all`. This repair does not kill existing processes. An Expo QR alone does not start the StackSynergy API or web interface.

## First run

From the repository root:

```sh
npm ci
npm run mobile:install
```

Stop any existing StackSynergy development server using port 3001. In terminal one:

```sh
npm run mobile:backend
```

This builds the web interface and starts the backend on your local network at port 3001. This command deliberately listens on your Wi-Fi interfaces; use a trusted local network. Your normal `npm run dev` remains loopback-only. Keep the same `data/` directory to preserve saved data.

In terminal two:

```sh
npm run mobile
```

Scan Expo's QR code with Expo Go on a phone compatible with SDK 57. Both phone and computer must be on the same Wi-Fi. In the StackSynergy connection screen enter `http://YOUR_COMPUTER_WIFI_IP:3001`. Find your computer's Wi-Fi IP in macOS System Settings → Wi-Fi → Details → TCP/IP. `localhost` on your phone refers to the phone, not the computer. Allow local network access if prompted.

Optional: copy `mobile/.env.example` to `mobile/.env` and set EXPO_PUBLIC_CARDCHASM_URL to prefill the address. This variable is public; never put model/API secrets in it. Connect with the same account used in the web app to access the same saved data. Login cookies are maintained inside the app's WebView; Safari/browser sessions are separate.

On an iOS simulator, `http://localhost:3001` normally reaches the Mac. On Android Emulator use `http://10.0.2.2:3001`. Physical device execution and camera acceptance still need testing.

## Scanning and exports

After the app finishes loading, Camera and Photos in the native top bar open the platform picker. Camera requests permission when tapped; denial offers the Photos alternative. Selected image bytes pass to the existing English OCR review queue; users still review identity, printing, quantity and destination before saving. Nothing is automatically added to inventory. Large photos over the bridge limit are rejected with an explanation.

Decklist, CSV, JSON and backup exports use the device share sheet. Choose a save destination there. Export files are temporarily stored in the app cache. The application does not silently transmit exports to anyone. Incoming bridge messages are validated and filenames are sanitized.

## Development builds

`cd mobile` and use `npx expo run:ios` or `npx expo run:android` if local native tools are installed. For a development build that connects over local HTTP, explicitly set `CARDCHASM_ALLOW_HTTP=1` when generating/building it. Config plugins generate native directories; don't edit them manually. Leave this flag unset for release builds and use an HTTPS backend. Expo Go's native app configuration is controlled by Expo, not this project's plugins.

No EAS account, paid builds, signing, publishing, or store submission has been performed. Bundle identifiers `com.cardchasm.app` are placeholders and should be confirmed before distribution. Full offline/native feature migration remains separate future work.

## Checks

```sh
npm run mobile:check
cd mobile
npx expo install --check
npx expo export --platform all
```

Root `npm run build`, `npm run lint`, and `npm test` still verify the web/backend app. Mobile native APIs require an actual device or simulator for final acceptance; successful bundling does not prove camera, permissions, session persistence or sharing behavior on-device.

Latest verification: iOS/Android/web bundle export passes, Expo Doctor 21/21 passes, SDK versions match, mobile lint/typechecks and the existing web checks pass, and 27 root tests pass. Mobile's upstream dependency tree still reports audit advisories; do not use `npm audit fix --force` to replace SDK versions incompatibly. Review current SDK patches before release.

## Verified October 14, 2026 (filesystem/terminal pass)

- Before the change, root `expo export --platform ios` failed: `Unable to resolve module ../../App` from `node_modules/expo/AppEntry.js`.
- After the change, root `expo config --type public` exits intentionally with the correct `npm run dev:all` / `npm run expo` instructions. Root `npm run expo` delegates to the same mobile start command as `npm run mobile`.
- `npm run build`, `npm run lint`, and `npm test`: pass, 65 tests across 5 files.
- `npm run mobile:check`: typecheck and lint pass.
- In `mobile/`, `expo install --check`: local SDK map reports dependencies up to date (initial sandbox network was disabled). Network-enabled `npx --yes expo-doctor`: 21/21 checks pass.
- In `mobile/`, `expo export --platform all --output-dir /tmp/card-chasm-mobile-verified`: iOS, Android and web export pass.
- Existing Expo listener PID 7170 on port 8081 had repository-root cwd; no API/Vite listeners were present during inspection. No existing process was stopped or restarted.
- This pass did not operate the desktop or verify phone/simulator rendering, camera, sharing, login or LAN connectivity. Previous October 13 UI results above are historical, not new acceptance evidence. Restart using the correct coordinated launcher before device testing.

The pre-change source checkpoint is at `/Users/masonwooldridge/Documents/Codex/2026-10-14/task-3/checkpoint/card-chasm-before-expo-fix.tar.gz`. It includes existing tracked/untracked source changes, excludes dependencies, generated bundles, `.git`, data and environment files, and does not replace the user database. Extract into a separate directory for recovery/comparison; do not overwrite current work blindly.

Official references consulted: [SDK 57 compatibility](https://docs.expo.dev/versions/v57.0.0/), [Router entrypoint](https://docs.expo.dev/router/installation/), [project configuration](https://docs.expo.dev/workflow/configuration/).

## October 14 live runtime follow-up

With explicit restart authorization, PID 7170 was freshly verified as Mason's root StackSynergy `expo start` process with repository-root cwd, then gracefully stopped using SIGTERM. Only this project was restarted using `npm run dev:all`. The stack remains running in the assistant terminal session; keep that session/Mac awake. Restart with the same command if it stops or the network changes.

Working session addresses:

- Mac: http://127.0.0.1:5173
- Same-network phone web / native server setting: http://10.47.237.193:5173
- Expo Go: exp://10.47.237.193:8081 (SDK 57 compatible client required)

The launcher previously configured only the LAN origin, making browser API writes from its advertised loopback URL fail with 403. It now supplies explicit loopback aliases via `APP_ORIGINS`; the backend accepts those exact origins in addition to `APP_ORIGIN` and same-origin requests. No wildcard origin allowance was added. Existing single `APP_ORIGIN` deployment configuration remains supported.

Verified live: API `/api/me` returns 200 through loopback, direct LAN API port 3001 and LAN Vite proxy; LAN web index returns 200; Metro status returns running. iOS and Android Expo manifests select `expo-router/entry` and their development bundles return 200 with `http://10.47.237.193:5173` embedded. Validation-only login requests from loopback, localhost and LAN origins reach credential validation (400); an unrelated origin remains rejected (403). No accounts were created or signed in. API reports `aiConfigured:false`, since no `.env` exists; model features require the user's own configuration.

After the origin fix: build and lint pass, all 66 tests pass, including an explicit local-origin regression plus the existing rejected-origin check. Previous mobile exports/Doctor/typecheck/lint remain unchanged and passed. No desktop focus was taken. Phone/simulator rendering, login persistence, camera and sharing are still unverified in this pass; successful native bundling is not device acceptance.

Listeners at verification: Vite PID 9639 on 5173, mobile Expo PID 9641 on 8081, API PID 9644 on 3001. These are this repair's newly launched processes, not Studio. Weekly meter: 88% remaining in the seven-day window.

## October 14 simulator launch

At Mason's request, StackSynergy was opened in the installed Expo Go SDK 57 app on the iPhone 16e / iOS 26.0 simulator (device UUID `10206696-D528-4E27-AA35-C80B73721074`). Xcode 26.3 and the runtime were already installed; no downloads, runtime installation, account changes or simulator erasure were performed.

The installed app path identifies Expo Go 57.0.9. The existing Metro URL `exp://127.0.0.1:8081` was opened with simctl. StackSynergy automatically connected to `http://192.168.4.91:5173` and visibly rendered its Home screen, including native Camera/Photos/Server controls and the web navigation. The simulator was then brought to the foreground only after Roblox confirmed its work saved and the UI slot released. The actual Simulator window was visually verified using computer use and left open for Mason.

[Confirmed native Home screen](screenshots/expo-simulator-oct14-home.png)

The simulator is signed out. Zero visible cards/binders/decks reflects that signed-out session, not deletion of saved user data. Existing account/deck data was not changed. This verifies actual native launch, WebView rendering and automatic backend connection; it does not yet verify all six signed-in deck journeys, camera hardware, sharing or session persistence on a physical phone.

Commander recommendation work was preserved during this launch: `shared/recommendations.ts`, `src/CommanderSuggestions.tsx`, the `/api/suggestions` route and builder integration are implemented; build/lint and 82 tests pass. An actual Scryfall-backed Atraxa response returned 134 candidates with all requested categories available. Browser journeys for this recommendation batch are still pending, so it is not yet reported as a completed recommendation milestone.
