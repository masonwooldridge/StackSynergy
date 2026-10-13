# Deployment and database

No paid services or publication performed.

1. Use Node 22.16+ on a persistent host. Run `npm ci`, `npm run build`, and the checks in README.
2. Copy `.env.example` to a private `.env`. Set APP_ORIGIN to the exact HTTPS origin. Keep AI credentials blank unless model usage/cost is authorized. Never expose `.env`, `data/` or SQLite files through static hosting.
3. Run `npm start` behind a reverse proxy with TLS. Forward the public Host header so same-origin checks use the public hostname. The production server binds 127.0.0.1:3001; proxy `/` to that address. It serves the built frontend and API together.
4. Production session cookies are Secure, HttpOnly and SameSite=Strict. HTTP without TLS will not work for production login. Mobile camera requires HTTPS or localhost.
5. Mount a durable `data/` directory. Schema version 1 is installed idempotently on startup. Future schema changes must use versioned migrations and backup before applying.
6. For consistent filesystem backups, stop the server and copy all data files, including SQLite WAL files if present. Keep encrypted off-host backups with restricted access. Test restoration into a separate directory by setting DATABASE_PATH and CARD_CACHE. Downloaded JSON backups contain private inventory/decks and should stay private.
7. Current single-process SQLite implementation is intended for small deployments. Multiple server instances require a shared transactional database and distributed rate limits/room transport. Do not use ephemeral serverless filesystems.

## Production gaps before a broad public launch

Password reset, email verification, security/penetration review, CSP policy, operational log retention, durable global rate limiting, monitoring, room garbage collection, legalities freshness checks, robust restore flows and complete browser acceptance remain outstanding. Auth endpoints rate-limit attempts by IP; reverse-proxy deployments must deliberately configure trusted proxy handling before relying on client IP limits. Current local development requires no external services except Scryfall and initial OCR model downloads.
