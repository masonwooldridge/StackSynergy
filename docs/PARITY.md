# ManaBox parity checklist

Research date: 2026-10-12. Status means implemented behavior, not full acceptance. ManaBox branding/assets are not reused. Official sources: [product](https://www.manabox.app/), [subscriptions](https://manabox.app/guides/general/subscriptions/), [cloud sync](https://manabox.app/guides/sync/cloud-sync/), [collection import/export](https://manabox.app/guides/collection/import-export/), [collector mode](https://manabox.app/guides/collection/collector-mode/). Public subscription guide confirms Pro features exist but does not provide an exhaustive entitlement matrix; exact current free/Pro boundaries still need official in-app verification.

| Feature                                     | Official evidence | Status                                                 | Acceptance                                              |
| ------------------------------------------- | ----------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| Search + advanced filters                   | product           | Online Scryfall query, filters, pagination, owned-only search                 | Search names, types, colors; provider outage            |
| Offline search                              | product           | Pending                                                | Search without connectivity                             |
| Camera scanner                              | product           | English OCR review implemented, unmeasured             | Real camera and image identity/printing correction/save |
| Collection/binders                          | product           | Owned binders, tracking lists, all-owned view, metadata, atomic moves            | Reload and second account isolation                     |
| Collector set completion                    | collector mode    | Pending                                                | Owned/missing grouped printings                         |
| Unlimited decks                             | product           | Deck library, format setup, contextual + add, boards, missing-owned list                                | Save/duplicate/export multiple decks                    |
| Deck charts                                 | product           | Curve/color/type and heuristic roles implemented       | Review authoritative quantities and classifications  |
| Simulator                                   | product           | Card table, guided mulligan, local resume, full-state undo/redo                       | Browser draw/mulligan/move/tap/undo/resume; native pending                     |
| Multiple market prices                      | product           | Available Scryfall USD only                            | Source/currency/time; unavailable price state           |
| Multilingual card search                    | product           | Scryfall queries; English OCR only                     | Supported languages and printed names                   |
| Multi-currency conversion                   | product           | Pending                                                | Source-dated conversion                                 |
| News feed                                   | product           | Pending                                                | Attribution + live sources                              |
| Fair trade tool                             | product           | Pending                                                | Two sides, price/quantity reconciliation                |
| Browsable rulebook                          | product           | Official external link only                            | Current indexed rulebook                                |
| Text/CSV imports                            | import/export     | Text/CSV printing review and row error preview implemented              | Quantities, metadata, documented ManaBox headers        |
| Collection export                           | import/export     | JSON, decklist and metadata CSV implemented    | Round trip supported metadata                           |
| Pro cloud sync                              | cloud sync        | Account-backed server persistence, refresh/conflicts   | Two clients concurrent changes/reload                   |
| Pro recovery points                         | cloud sync        | History undo + document trash/restore UI; move-specific undo | Restore without losing newer backup                     |
| Pro binders / subscription expiry retention | subscriptions     | No paid tiers; data retained in trash                  | Restore document and entries                            |
| Other Pro entitlements                      | subscriptions     | Unverified                                             | Obtain current official entitlement list                |

Additional requested scope: multiplayer, live AI assistant and secure backend are tracked in PROGRESS.md; these go beyond the public ManaBox product checklist.

## Provider decisions

- [Scryfall access requirements](https://scryfall.com/docs/faqs/i-m-having-trouble-accessing-the-scryfall-api-or-i-m-blocked-17): descriptive User-Agent/Accept, serialized requests 150ms apart, 24h SQLite cache, no retries on 429. Bulk/offline catalog remains pending. Images retain Scryfall URLs and attribution.
- [Magic rules](https://magic.wizards.com/en/rules), [Commander](https://magic.wizards.com/en/formats/commander): validator uses attributes and card text, never name substring to identify basic lands. Special rules need additional coverage.
- [EDHREC FAQ](https://edhrec.com/faq) explains its statistical evidence and source decks, but does not establish permission for a general public API. [Moxfield help](https://moxfield.com/help) did not expose API documentation in this research. No scraping, private API calls or access-control bypass. User-provided decklists and public links remain the integration path until authorized access is established.

## Usability revision — October 13

Following official [deck workflow](https://manabox.app/guides/decks/getting-started/), [collection workflow](https://manabox.app/guides/collection/getting-started/) and [scanner workflow](https://manabox.app/guides/scanner/getting-started/):

- Five primary destinations: Home, Search, Collection, Decks, More. Phone bottom navigation; secondary tools stay in More and the desktop sidebar.
- Deck/binder library first, named creation sheet with deck format, contextual search with persistent destination/board and direct + add.
- Cards, Missing, Stats, Import/export and Details separated. Quantity steppers, grouped/type/tag lists, commander selection and bulk row selection.
- Owned binders and non-owned lists remain distinct. All-owned cards show their binder location. Atomic binder/list moves preserve entire lots and have a coordinated undo; history cannot cross a move independently.
- Missing-owned compares playable boards across printings, excludes maybeboard/wishlists, and exports a shopping list. No cross-deck reservations claimed.

This is functional workflow alignment, not full ManaBox feature parity. Offline catalog, collector completion, trade tools, multi-market/currency pricing, multilingual OCR, news and comprehensive browsable rules remain pending. Native acceptance and multiplayer/AI remaining work is tracked in PROGRESS.md and VERIFICATION.md.
