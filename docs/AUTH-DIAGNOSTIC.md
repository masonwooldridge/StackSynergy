# Local account sign-in diagnostic — October 14, 2026

Mason reported Invalid credentials when signing in and Account already exists when attempting registration.

Read-only checks confirmed that login and registration use the same live backend and `/Users/masonwooldridge/Documents/Coding/card-chasm/data/cardchasm.sqlite`. Vite forwards both actions to the same API; the Expo WebView connects to that Vite endpoint. The current password hashing/checking implementation matches the committed implementation: salted scrypt, 64-byte digest and constant-time comparison. Aggregate checks found canonical identifiers and expected hash/salt formats. No raw account identifiers, hashes, salts, submitted credentials or passwords were printed. No accounts/decks were edited for diagnosis.

With an isolated temporary account, an incorrect password reproduced login 401 and duplicate-registration 409. Its original password then authenticated successfully. These responses are consistent with an existing account whose submitted password did not match, but Mason's entered password was not inspected or tried, so its exact cause is not asserted.

A separate reproducible issue was fixed: outer email whitespace previously failed validation. Email is now trimmed and lowercased consistently for both actions. This previously produced 400, so it does not by itself explain the reported 401. Error messages now explain that an existing account must be signed into with its original local-account password and that duplicate registration does not reset that password.

Isolated verification after the fix: registration with upper-case/outer-space email 200; correct-password normalized login 200; wrong-password login 401; duplicate registration 409; original-password login still 200. Build and lint pass, all 85 tests across 8 files pass, and whitespace checks pass. Production API remains reachable. Hashing, password policy, rate limits, cookies and existing credentials were preserved.

Simulator was left open and untouched; no password was typed, guessed, read or reset. The app has no password recovery endpoint. If the original password is unavailable, credential recovery is a separate dependency requiring the user to decide and operate the credential step; this diagnostic did not authorize or perform a reset.
