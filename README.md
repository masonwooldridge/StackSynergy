# CardChasm

React + TypeScript MTG companion, with an Express/SQLite local backend. This is an active implementation, **not full ManaBox parity or final acceptance**. See [progress and exact continuation](docs/PROGRESS.md), [source-linked parity](docs/PARITY.md), and [verification](docs/VERIFICATION.md).

## Run locally

Requires Node.js 22.16+ (tested with 26.10) and npm. SQLite data is created automatically; no external database account is needed.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open http://127.0.0.1:5173. Create a local account in Settings with an email-shaped identifier and password of at least 12 characters. Email is not sent or verified. Create a binder/deck, search cards, review printing and save. Existing original MVP browser storage is preserved; Settings → Copy original MVP deck imports it explicitly using verified Scryfall metadata.

The API runs at 127.0.0.1:3001. Persistent files live in ignored `data/`. Back up this directory while the server is stopped, or use Settings → Download full backup. Document trash and Undo last saved edit are recoverable. Full backup restore UI remains pending.

## Verification

```sh
npm run build
npm run lint
npm test
npm audit
# Optional real public-image OCR evaluation, requires network:
npx tsx tests/evaluate-scanner.ts
```

Tests use clearly marked fixtures and temporary databases; they never insert into your archive. OCR evaluation downloads public Scryfall images into ignored data/scanner-evaluation and does not create saved cards.

## Model assistant

No credentials are included. Leave AI_API_KEY blank until you authorize provider usage and its costs. Configure a compatible chat-completions endpoint with AI_BASE_URL, AI_MODEL, and AI_API_KEY. The default optional endpoint is OpenAI. Credentials stay on the server; max 20 requests/account/UTC day by default (AI_DAILY_LIMIT). No live model acceptance has been performed. Additions are checked against Scryfall, format, commander identity, available per-card USD budget and optional ownership. Applying the whole diff requires final deck validation. There is no EDHREC/Moxfield API integration or fabricated community evidence.

## Multiplayer

Separate accounts can host/join by code, load decks, ready and start. Commander allows up to four accounts, other formats two. Polling synchronizes every two seconds. Rooms and actions persist in SQLite, and reconnect uses the same authenticated account and code. The server filters hand/library payloads, owns shuffles, rejects acting on others' cards, deduplicates command IDs and rejects stale revisions. Rules resolution remains manual. This is not a full Magic rules engine. Current limitations include private library search, deck legality enforcement at ready time, host transfer and finished-room lifecycle.

## Deployment

See [deployment guide](docs/DEPLOYMENT.md). Nothing has been published. Current defaults bind to loopback; do not expose an unfinished development server directly to the internet.

Card names, text and imagery are provided by Scryfall and belong to Wizards of the Coast. CardChasm is unofficial fan content. Available prices are estimates, not an offer to buy or sell.

## Expo mobile app

Run `npm run mobile:install`, then use `npm run mobile:backend` and `npm run mobile` in separate terminals. Connect Expo Go to the QR code and enter your computer's Wi-Fi server address. See [Expo setup and limitations](docs/EXPO.md) for device addresses, native camera/photos, exports, and builds. The mobile app shares the existing server database.
