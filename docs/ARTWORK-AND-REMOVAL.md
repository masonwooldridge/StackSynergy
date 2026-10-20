# Artwork previews and easy removal — October16,2026

## Reference inspected

Mason's actual attachment libfile_69254f68900c81918201910dbeb66b12 was retrieved through Library, materialized with Library identity metadata as checkpoint/card-image-removal/reference.png and visually inspected before implementation. It shows dark grouped deck rows with landscape artwork on the left, price badges over the image, names/mana alongside and quantity steppers to the right. The implementation follows the artwork/price presentation while retaining StackSynergy's fonts, colors, existing sorting and full viewer.

## Behavior

Finished rows, the commander preview row and generated reviews now prefer the front-face art_crop image in76×58px landscape previews, with a compact per-copy selected-finish USD price badge. If unavailable, existing card-image resolution provides a fallback; failed images retain a text fallback and working card-details button. Prices and quantities remain visible in textual metadata. Images remain decorative to screen readers, lazy/async loaded, and the labeled parent button opens the existing high-resolution viewer with both faces/zoom/rules/Close/focus behavior. Sorting remains the requested type order with finish-aware price ascending/descending within groups or across the whole list; no card data is reordered or duplicated in storage.

Finished deck rows expose Remove all beside the quantity stepper and printing editor. Minus removes one copy; Remove all removes the row's full quantity. Both provide one-level Undo last removal in the current editor session, including when decrementing the final copy removes the row. Full removal focuses Undo; undo restores focus to the returned card. Quantity buttons and removal actions have44px targets. Status messages announce the action. A successful save is required before recording removal/undo state; failures surface without pretending data changed.

Undo restores the removed copies/row using the CURRENT document, preserving unrelated later edits, latest revision, notes and other cards. It is scoped to the same deck; it cannot mutate binder inventory or another document. If the same row's printing/finish/language was changed after decrement, undo refuses to overwrite it and directs the user to deck history. Full-row undo restores its original metadata/order when possible. Undo is session-only; after reload the saved removal persists and the existing deck Details/history flow is the recovery route. Only the most recent removal has the inline undo action.

Generated reviews have explicit Unsaved draft labeling and minus-one/Remove all actions. These mutate only the local preview, with accurate new card totals, missing-copy counts, deck value/purchase estimates and recommendation presence. Any removal marks the draft incomplete and disables Save reviewed complete deck; undo restores the previous exact construction result, counts/prices and complete-save eligibility. Rebuilding or changing options clears old draft undo so it cannot restore a different commander/result. No automatic filler is inserted and nothing is saved to a library by preview removal. Basic mana/strategy are not silently rebuilt after a manual removal.

## Verification

142 tests across19 files, production TypeScript/Vite build and lint pass. Existing nonblocking JS chunk warning remains (about516kB before gzip); no unrelated refactor. Focused removal tests cover decrement versus full removal, exact restoration, preserved later edits/revision/notes, cross-document and collection rejection, changed-printing safety, and generated99-card costs/missing-count/incomplete-save state.

Canonical headless UI at393px and1440px verifies decrement+undo, full-row removal persisted across reload, full-remove undo/focus restoration, art_crop image and price badge, viewer/keyboard behavior, sorting retained,44px quantity controls and no horizontal overflow. All writes use fresh, clearly named isolated guest fixtures; Mason's decks are never deleted for QA. The initial test failures were harness issues (JSON key-order comparison and reseeding the fixture on reload); structural equality and once-only seeding now test actual persistence. Generated Satya100 verifies remove→99/disabled save/no library write→undo100/enabled save, plus full-row removal/undo. Current both-face viewer regression is logged separately in faces.log.

No foreground use, live account saves, storage reset, publication or service restart. Canonical user/session/deck/history/room digests remain unchanged. These are mobile-width browser checks, not a new Expo/native or VoiceOver certification; native input limitations remain documented separately.

## Deliverables

- Phone finished deck: libfile_4bb53dd4f0488191b4490a580d0a7f4c
- Desktop finished deck: libfile_f481fef47c388191840ad10f830d7c5f
- Phone generated review: libfile_29ac244761dc81918ed9cca67275240f

All3 screenshot Library creates succeeded and local identity metadata was applied. Prepared upload helper reported prepare_uploads unavailable before any write, then the documented ordered direct-create fallback was used. Screenshots are isolated public-card QA fixtures. The source attachment's identity is retained separately; it was not replaced. Library file mappings, ui.log, tests.log, build.log, lint.log, faces.log and canonical-state.json are under task checkpoint/card-image-removal.

No new service is required. Use the existing StackSynergy session or npm run dev:all from project root after stopping duplicates normally; see EXPO.md. Source archive excludes credentials, database contents, dependencies and generated native folders.

Meter before this batch41% remaining, later39%; user reserve25% and wrap30%. Bounded feature only.
