# Staged Breeding Event — Dogs (Sub-project 1)

Status: Approved for planning
Date: 2026-08-16

## Summary

Replace the instant "click Breed → litter appears" flow with a real staged
event: committing to breed starts a pregnancy that takes real in-game days
to complete, and when it does — during *any* action that advances a day,
regardless of which tab the player is on — a birth event fires. Most births
are routine and reveal the litter the same way breeding already does today;
some have complications, and the player makes a real decision (assist
personally, free but risky, or call the vet, safer but costs money) before
the litter reveals.

This completes a half-built feature already in the codebase:
`pregnantDaysLeft` is already threaded through `tick()` in `game.jsx` —
decremented every day, and dogs whose count hits zero are already collected
into `next.pendingWhelps` — but no code path ever actually *sets*
`pregnantDaysLeft` on a dam. Player breeding (`doBreed`), stud service
(`doStudService`), and accepted AI breeding requests all currently call
`breedPuppies()` synchronously and reveal the result the same tick. This
spec wires the existing scaffolding up rather than inventing a parallel one.

Horses and cattle are explicitly out of scope for this spec — see the
"Sub-project 2" note at the end. Nothing in this design should make that
follow-up harder; the state shape (a "pending pregnancy" payload carried on
the animal, a global `pendingWhelps` queue) is species-agnostic by
construction.

## Constraints carried over from the request

- "More advanced," staged, event-like — not just richer instant output.
- Dogs first, as the reference implementation; horses/cattle are a
  follow-up once this ships.
- The birth event is a real decision (assist vs. vet), not a timing
  mini-game — reuses the existing decision-modal pattern the hunt's bayed
  event already established, not a new interaction mechanic.
- A pregnant dam becomes unavailable for hunting/trials as well as
  breeding for the duration — pregnancy is a genuine two-week tradeoff, not
  a free action.
- Reuse existing systems wherever possible: the `tick()`/`update()`/
  `addLog()` persistence path, the existing `LitterPicker` reveal screen,
  the existing inbreeding/merle/MSTN warning notes, the existing modal CSS
  classes (`kg-modal-backdrop`/`kg-modal`).
- No bundler, no new npm dependencies — same global-script-scope
  constraint as every other feature in this codebase.

## Data model

**Per-dog, on the dam:**

```js
{
  pregnantDaysLeft: number,        // already exists in tick(), currently always 0/unset
  pendingPregnancy: {              // NEW — the litter, rolled and frozen at conception
    litter: {...},                 // the exact object breedPuppies() already returns
    sireId: string, sireName: string,
    label: string,                 // "Diesel × Ruby" or the stud-service label, same
                                    // strings doBreed/doStudService already build today
    foundedBloodlineName: string | null,
  } | null,
}
```

Genetics are rolled once, at conception (`doBreed`/`doStudService` call
time) — real dog genetics are fixed at conception, not at birth, so this is
both simpler and more accurate than re-rolling later. `pendingPregnancy` is
never shown to the player; it's just held until the birth event.

**Global, on `state` (already exists, currently always empty):**

```js
pendingWhelps: Array<{ damId: string, damName: string, pendingPregnancy: {...} }>
```

`tick()` already builds a `whelped` array of dam ids whose
`pregnantDaysLeft` hit zero this tick (`game.jsx:825-828`) and assigns it to
`next.pendingWhelps` (`game.jsx:840`) — this spec changes that array's
element shape from a bare id to the object above (carrying the dam's name
and a copy of her `pendingPregnancy` payload, since the birth-event modal
needs both and the dam's own `pendingPregnancy` field is cleared to `null`
the same tick), and adds the one missing piece: something that actually
*sets* `pregnantDaysLeft` and `pendingPregnancy` in the first place.

**Constant:**

```js
const GESTATION_DAYS = 14;
const COMPLICATION_BASE_CHANCE = 0.15;
```

## Flow

1. **Commit** — `doBreed()`/`doStudService()` still call `breedPuppies()`
   immediately (litter is determined now), but instead of setting
   `pendingLitter` (which drives the reveal screen today), they set the
   dam's `pregnantDaysLeft = GESTATION_DAYS` and `pendingPregnancy` to the
   rolled litter + label info, via the same `update()`/`tick()` call that
   already applies the cooldown/health cost. The dam's status now reads
   "Pregnant — N days left" (new status, same visual slot `statusOf()`
   already uses for "Injured").
2. **Time passes** — no new mechanism. Every existing day-advancing action
   (`doHunt`, `doTrial`, resting, etc.) already calls `tick()`, which
   already decrements `pregnantDaysLeft` and already collects zeroed-out
   dams into `pendingWhelps`. A pregnant dam is excluded from
   `canHunt`/`canBreed`-style eligibility checks for the duration (extends
   the existing gating pattern — `canHunt`, `canTrial`, wherever those are
   checked — one added condition, not new logic).
3. **Birth event fires** — the App component watches `state.pendingWhelps`.
   Non-empty means at least one dam is due; take the first entry (process
   one at a time — if two dams whelp the same tick, the second waits its
   turn, same one-slot-at-a-time pattern `pendingLitter` already uses for
   litter reveals). Roll for complications:
   - **No complications (85% base, lower probability the higher the
     complication roll — see below):** skip straight to reveal (step 5),
     no modal, just a log line ("`Diesel × Ruby` whelped safely — 4 pups.").
   - **Complications:** open `BirthEventModal` (new component,
     `components.jsx`, same `kg-modal-backdrop`/`kg-modal` structure as
     `BayedEventModal`).
4. **Complication decision** — the modal shows two choices:
   - **Assist personally** (free): a real risk roll. On success (60%), no
     penalty. On failure (40%), the dam takes a real health hit
     (`randInt(15, 30)`) and one random pup from the pre-rolled litter is
     removed (a real loss, not just a stat penalty — mirrors the existing
     "not every pup makes the grade" culling flavor already in
     `breedPuppies`).
   - **Call the vet** (costs `Math.round(computeValue(dam) * 0.12)`,
     rounded to a clean number): near-guaranteed safe outcome (95% success,
     same failure consequence as above on the 5% miss) — the price is for
     certainty, not a guarantee.
5. **Reveal** — the litter (as rolled, minus any pup lost to complications)
   feeds into the *existing* `pendingLitter`/`LitterPicker` flow, completely
   unchanged from today. The dam's `pendingPregnancy` is cleared.

## Complication chance formula

```js
function complicationChance(dam, litterSize) {
  let chance = COMPLICATION_BASE_CHANCE;
  if (isInbred /* already computed at conception, carried in pendingPregnancy */) chance += 0.12;
  if (dam.health < 70) chance += 0.08;
  if (litterSize >= 5) chance += 0.05;
  return clamp(chance, 0, 0.6);
}
```

Rolled once, at conception time (frozen into `pendingPregnancy` alongside
the litter), not re-rolled at birth — the risk is determined by conditions
at breeding, matching how the litter itself is frozen then too. This keeps
the birth event itself simple: by the time it fires, whether there's a
complication is already decided; the event just reveals it and asks for a
decision if there is one.

## UI / components

- **`js/components.jsx`**: new `BirthEventModal({ damName, onAssist,
  onVet, vetCost })` — same structural pattern as `BayedEventModal`
  (`kg-modal-backdrop` / `kg-modal`, two-button decision).
- **`js/game.jsx`**:
  - `doBreed()`/`doStudService()` modified to set pregnancy fields instead
    of `pendingLitter` directly.
  - `tick()`'s existing `pendingWhelps` construction (`game.jsx:825-840`)
    extended to carry the richer payload described above.
  - A render-time check (not a `useEffect` — `pendingWhelps` is derived
    from `state`, which already triggers a re-render on every `update()`
    call, so checking `state.pendingWhelps.length > 0` directly in the JSX
    is sufficient and avoids an extra effect) renders `BirthEventModal`
    when the front of the `pendingWhelps` queue has a live complication
    still needing a decision, and drives straight to `pendingLitter` when
    it doesn't.
  - `canHunt`/wherever trial eligibility is checked: one added condition
    excluding dogs with `pregnantDaysLeft > 0`.
- **`styles.css`**: minimal — the "Pregnant — N days left" status badge
  reuses the existing status-badge classes (`statusOf()` already returns a
  `{ label, tone }` pair rendered through the existing `Badge` component;
  this is a new case in that function, not new CSS).

## Mobile / desktop

No new interaction surface beyond a two-button modal, already responsive
via the existing `kg-modal` styles.

## Testing

- Extends `check:syntax` automatically (new code lives in already-covered
  files).
- New Node-`vm`-sandboxed unit tests (same technique
  `scripts/test-grouphunt.mjs` established) for `complicationChance()` and
  the assist/vet resolution math — pure, deterministic-given-seed logic,
  fully testable without a browser.
- Extends `scripts/smoke-test.mjs`: breed a pair, fast-forward days (the
  smoke test can call the day-advancing action repeatedly, or the plan may
  choose a shorter `GESTATION_DAYS` value behind a test hook — left for the
  implementation plan to decide the cheapest reliable approach), confirm
  the birth event/reveal path completes with zero console errors.

## Explicitly out of scope (Sub-project 2)

- Horses and cattle getting this same staged pregnancy/birth-event flow.
  The state shape here (`pregnantDaysLeft` + a frozen `pendingPregnancy`
  payload + a global `pendingWhelps` queue) is deliberately species-agnostic
  so this can generalize into `LIVESTOCK_CONFIG` later without rework —
  but wiring it up for horses/cattle, and any species-specific flavor
  (foaling vs. calving language, different gestation lengths, different
  complication framing) is a separate follow-up spec once this ships and
  plays well for dogs.
