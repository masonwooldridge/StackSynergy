# Run CardChasm with Expo

CardChasm now has an Expo SDK 57 mobile app in `mobile/`. It uses Expo Router, a native WebView containing the existing working interface, native camera/photo selection, and native export sharing. Accounts, decks, inventory, AI and rooms use the same backend. It is an online client; the backend is still required. It is not a fully native interface or an offline bundled catalog.

## First run

From the repository root:

```sh
npm ci
npm run mobile:install
```

Stop any existing CardChasm development server using port 3001. In terminal one:

```sh
npm run mobile:backend
```

This builds the web interface and starts the backend on your local network at port 3001. This command deliberately listens on your Wi-Fi interfaces; use a trusted local network. Your normal `npm run dev` remains loopback-only. Keep the same `data/` directory to preserve saved data.

In terminal two:

```sh
npm run mobile
```

Scan Expo's QR code with Expo Go on a phone compatible with SDK 57. Both phone and computer must be on the same Wi-Fi. In the CardChasm connection screen enter `http://YOUR_COMPUTER_WIFI_IP:3001`. Find your computer's Wi-Fi IP in macOS System Settings → Wi-Fi → Details → TCP/IP. `localhost` on your phone refers to the phone, not the computer. Allow local network access if prompted.

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
