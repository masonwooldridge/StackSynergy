# StackSynergy · Dark card room

Replaces the ivory journal direction at Mason’s request. Reference: current official ManaBox collection/deck screenshots at https://manabox.app/ (reviewed October16,2026). Follows all77 lines of the earlier Library design brief, Pasted text(1).md.

## Implemented

Neutral charcoal canvas (#202124), slightly raised working surfaces (#292b2f), white text, legible gray metadata, one amber action/selection accent (#f3b84b). Compact Avenir/system type hierarchy with monospace counters and construction steps replaces oversized editorial serif headings. Opaque navigation, restrained5px artwork tiles, solid labels separate from imagery, ruled tools and clear selected tabs. No gradients, glow, external font dependencies or invented statistics introduced. Real commander/card art identifies decks and binders; optional art_crop typing uses provider artwork with existing card-image fallback. Existing stored document schema and identities unchanged.

Home prioritizes New deck and the real library. Deck library uses two artwork columns on phone and a responsive grid on desktop; binders remain compact labeled rows. Builder retains commander/card-pool/budget steps, truthful pricing and review/save controls. Integrated discovery, upgrades, collection, search and playtest controls keep their handlers. Native shell matches the dark palette. All source changes are presentation/type-only; no package, account, database or guest data migration.

## Verification

108 existing tests across12 files pass. Production TypeScript/Vite build and ESLint pass; mobile TypeScript/ESLint pass. git diff --check passes. iOS Expo export runs from mobile/ (root correctly rejects Expo export).

Actual headless review:390×844 phone,820×1180 tablet,1440×1000 desktop; Home/library/integrated deck/builder. No page errors or horizontal overflow. Focused computed text contrast audit of Home/deck/builder/Settings reports no below-threshold text. Empty/create/148-character names/focus/loading/disabled/recoverable provider error/reduced-motion checks pass at390/820/1440. Corrected legacy thumbnail flex-basis and binder selector specificity found during pixel review. Not a full accessibility certification.

Guest acceptance in fresh isolated contexts: offline create/save/reload/export, edits/trash/restore/repeated imports with fresh IDs; mocked account/guest/signout separation, zero account-document writes. Real public-card Krenko100-card construction -> review -> guest save -> playtest Keep7/Draw -> back/reopen/reload passes. No model API request or spending. Actual native simulator screenshot confirms dark builder and matching Expo chrome; background capture only, no foreground UI operations during Roblox video capture.

## Run

From repository root: npm run dev:all starts web/API/Expo; npm run dev:iphone also opens simulator. Reuse existing services when running. For diagnostics/export: cd mobile then npx expo export --platform ios. Guest data stays scoped to browser/app and origin; export before changing origin. This remains a native Expo shell around the served responsive app; no offline cold-launch or standalone release-build claim.

## Deliverables and limits

Before-source checkpoint: /Users/masonwooldridge/Documents/Codex/2026-10-14/task-3/checkpoint/card-chasm-before-dark-pass.tar.gz. Final source archive and verification logs under that workspace/checkpoint. Screenshots under docs/screenshots/dark-*.png; web images use explicitly labeled QA sample decks, not Mason inventory; native image is actual unseeded guest app.

Deferred Expo Go plain-D shortcut untouched. No camera hardware, native recovery/share destination, physical phone or standalone native build verification in this pass. No publishing, security/permission change, unrelated edit, dependency upgrade, process restart or paid service. Foreground released throughout Roblox capture.
