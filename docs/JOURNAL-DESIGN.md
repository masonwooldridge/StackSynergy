# StackSynergy · The deck journal

Historical milestone; current visual direction is documented in [DARK-DESIGN.md](DARK-DESIGN.md).

Implemented against Pasted text(1).md, read in full (77 lines) from Library libfile_09c0b2113f008191bd93b1809f434168.

## Direction and scope

A working card-table/deck-journal identity: warm ivory (#f3efe6), charcoal (#252e28), restrained copper (#854425), Iowan Old Style/Georgia serif headings, Avenir/system working text and monospace labels/count metadata. No new external font, image-generation or UI package dependency. Actual Scryfall card images identify decks/binders; icons now use cards and tools rather than AI sparkles. Opaque navigation, square-edged ruled sections, restrained radii and a clear working hierarchy replace the dark repeated-card presentation. Dark playtesting remains a deliberate card-table surface.

Focused journeys: Home with immediate New deck action, real library tallies and a quiet guest-storage note; library rows with commander/card covers and wrapping names; integrated deck/search working space with readable group headers; full builder arranged as commander, card pool and explicit budget steps, with a real selected-commander preview and reviewable cost/result hierarchy. Existing navigation, guest save/history/trash/import/export, account-copy safeguards, recommendations, complete-deck checks and budget upgrades remain. No artificial usage data, cloud-backup claim or paid model call introduced.

At390px the navigation is evenly spaced along the bottom and forms use16px inputs to avoid iOS input zoom; tablet820px adapts to a working two-column builder with fixed bottom navigation; desktop1440px retains compact charcoal navigation and wider deck/discovery space. Focus rings are3px, working actions use44px minimum touch targets, selected/disabled/loading/error states are visible, and reduced motion is respected.

## Rendered review and corrections

Before and after views were rendered from isolated QA guest contexts at390×844,820×1180,1440×1000 for Home/library/deck/builder. The fully-loaded before capture used the source checkpoint served only on temporary15174; live source/data were not overwritten. QA names are explicitly prefixed QA and are not Mason's inventory. Card facts/art are real public Scryfall data. The native screenshot shows the actual app, signed out, not the seeded QA library.

Review fixed an old dark group header on the paper surface, low-contrast metadata/wordmark, cramped mobile tools/navigation, and an8px tablet overflow caused by bottom navigation participating in flex layout. Computed foreground/background contrast checks found no below-threshold text in reviewed Home/deck/builder/settings screens after corrections; this is a focused check, not a full accessibility certification.

State QA passed at390/820/1440: empty Home, no-account create, valid148-character document names, visible focus, disabled/loading lookup, retained input and recoverable provider error, reduced motion, and no horizontal page overflow. A provider outage is now reported as an outage; only an actual provider404 falls back from an exact commander lookup to supported-theme interpretation. No unsupported claim that a commander is nonexistent during a network error.

Actual native review observed the new ivory builder and copper/charcoal shell on iPhone17Pro. It exposed a same-URI Fast Refresh readiness race: reconnecting set loaded=false even though the WebView did not navigate and would not issue a new load event. Removed that redundant reset and request a readiness acknowledgement only from the same origin with a rendered root. Native AX afterward shows Camera/Photos enabled; no picker or hardware permissions were invoked. No forced app reload or storage reset was used for this correction.

## Verified results

108 tests across12 files passed; production build and web ESLint passed; mobile TypeScript/ESLint passed including final readiness change. Expo iOS/Android/web export succeeded at /tmp/card-chasm-journal-bundles; the final readiness correction also exported iOS at /tmp/card-chasm-journal-final-ios.

Headless guest acceptance passed offline local create/save/reload/export, name/notes edits, trash/restore, repeated JSON import with original identities preserved, and mocked login/account/guest/signout boundaries with no real-account writes. Real public-card Krenko build still produced a complete100-card deck and passed guest save → playtest draw → back/reopen → reload. Model upgrade controls and account-copy safeguards were preserved, not exercised with real credentials or paid API calls. Camera hardware, sharing destinations, physical phones and native full-deck editing were not verified in this design batch.

## Prior reliability work preserved

The200-owned-printing cap is removed. Every unique active-binder printing is verified in sequential25-item progress chunks; failure/cancellation cannot produce a partial collection feasibility result. Regression verifies270 printings, including eligible cards after position200.

Native guest recovery stores validated origin-separated snapshots in alternating project-document files; an interrupted write preserves a valid previous slot. A cleared empty WebView cannot overwrite the last nonempty snapshot. Explicit Recovery export + Settings JSON import creates new guest copies and leaves originals intact. It does not silently migrate between servers, copy account documents/cookies, or transfer playtest sessions. Real native export/share/reimport remains pending; unit tests and native initial capture/readiness are not proof of the complete sharing flow.

## Remaining limits

The Expo Go SDK57 plain-d/r native shortcut is explicitly deferred and NOT fixed by the redesign. No Safari switch, native install, global keyboard/security change, signout or credential operation occurred. Guest storage remains browser/app/origin scoped; the shell still needs the served interface rather than being a fully offline cold-launch app. The supported builder is rules-based, one commander and six keyword themes, with a finite provider pool; it is not general model AI or a competitive-strength guarantee.
