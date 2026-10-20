# Reliability implementation checklist — October 13, 2026

Existing working tree dependency/configuration edits are retained. Tests must use temporary databases; never use existing collections as fixtures.

## Priority 0
- [ ] Hidden information: reproduce counter on unrevealed hand; opponent serialization must contain no name/identity/order. Audit logs and rejected actions, reveal, shuffle, reconnect and membership.
- [ ] AI: analyze A, switch to B, accept; bind account/deck/revision/constraints on server, explicit entry/board quantity changes, selectable atomic once-only application, quantity-aware ownership and aggregate budget.
- [ ] Authoritative legality: client metadata cannot establish legal status. Resolve server facts before ready; incomplete evidence must remain incomplete. Verify current official construction rules and realistic fixtures.

## Priority 1
- [ ] Scanner: repeated upload copies count; stationary frames suppressed; reuse worker, durable review queue, cancellation, retry and measured full pipeline.
- [ ] Browsing: open/close detail from global Search must retain empty destination.
- [ ] Printing: resolve results beyond page one; printing/finish/language/price consistency.
- [ ] Routes: deep links, refresh, Back/Forward retain search context.
- [ ] Inventory: restore preview/merge/replace/recovery, metadata round trips, stale edits, valuation coverage.

## Priority 2
- [ ] Multiplayer: monotonic polling, retry command IDs, full room lifecycle, opening-hand state machine, manual game operations, independent 2/4-client latency/restart acceptance.
- [ ] Mixed-deck solo browser acceptance; validate saved sessions and expose persistence failures.

## Priority 3–4
- [ ] Mobile endpoint/onboarding/offline/session/back/camera/share acceptance; use installed SDK documentation before API changes.
- [ ] Accessibility, focused workflow design, large collection benchmark, clean install/CI/release review.

For every completed item record implementation and exact evidence below. Passing automated checks alone does not establish device, provider, paid-model or full multiplayer acceptance.

## Completed increments and remaining scope

- Hidden counter reproduction repaired; all-channel serialization, intentional reveal, library returns, legacy log scrubbing and immutable rejection tests pass. Broader face-down permanents are not implemented.
- Proposal reproduction repaired with server binding, selectable exact quantity changes, ownership/budget checks and durable once-only transaction. Live model usefulness and complete authoritative post-change legality remain unverified.
- Browsing destination reproduction repaired and independently browser-verified. Pagination helper is fixture-verified beyond page one; searchable printing/finish/language display implemented.
- Server fact verification, explicit incomplete states and unanimous casual override implemented. Comprehensive special-rule coverage is still open.
- Scanner uploads no longer suffer session-wide text deduplication. Reused worker, short camera frame gate, another-copy action and durable review queue implemented. Full batch save, cancellation, timeout, rotation/cropping and representative physical pipeline metrics remain open.
- Major-screen/document URLs and browser Back/Forward verified; query/results retained during navigation. All filters/scroll positions across refresh still need work.
- Monotonic room client gate, stable retry IDs, leave/concede, host transfer and finished/empty lobby handling implemented and fixture-tested. Four independent browser clients, reconnect grace/archive/restart acceptance and full opening-hand/manual game tools remain open.
- Solo state shape validation and persistence error UI implemented; mixed-deck browser sequences still open.
- CI authored. Native feature work, backup recovery/import/concurrent edit workflows, large-library benchmarking, release review and the remaining product scope are not complete.

Current checks/evidence and exact commands: VERIFICATION.md. No live accounts or inventories were modified in acceptance work.
