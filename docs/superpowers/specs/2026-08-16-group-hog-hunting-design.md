# Group Hog Hunting — Phase 1: Core Hunt Loop

Status: Approved for planning
Date: 2026-08-16

## Summary

Replace the existing instant "Group hog hunt" (pick 2+ dogs, average their
stats, resolve immediately) with a staged, role-based group hunt: the player
assigns dogs to Bay or Catch roles, watches a zone map while bay dogs search,
gets a bayed event with a real decision (release catch dogs or call off),
watches catch dogs travel to the bay site, plays a timing-bar mini-game to
land the catch, and gets a results summary. Solo hunting (`doHunt`) is
untouched.

Trackers and the "dog gets lost mid-hunt" system described in the original
request are **explicitly out of scope for this phase** — they're a
self-contained follow-up once this core loop ships. Nothing in this design
should make that follow-up harder to add later (the zone/tick simulation it
would hook into already exists after this phase).

## Constraints carried over from the request

- Do not redesign the existing game or change its UI style beyond what's
  needed to display the new screens.
- Do not remove or break existing features other than the old instant
  group-hunt path, which this explicitly supersedes (confirmed with the
  player).
- Reuse existing dog/player/money/inventory/kennel/progression systems
  wherever possible — no parallel stat system, no parallel currency.
- Works on mobile and desktop.
- No bundler, no new npm dependencies — plain React 18 + Babel-in-browser,
  global script scope, files loaded in dependency order via `<script>` tags
  in `index.html`, same as every other file in `js/`.

## Data model

**No new fields on the dog object.** Role suitability is computed live from
the six stats every dog already has: `gameness`, `grip`, `nose`, `stamina`,
`speed`, `conformation`. This keeps breeding, save migration, and genetics
completely untouched — a dog bred for a role is just a dog whose existing
stats happen to score well against that role's weights.

```js
// js/grouphunt.jsx
const BAY_WEIGHTS   = { nose: 0.4, speed: 0.25, stamina: 0.25, gameness: 0.1 };
const CATCH_WEIGHTS = { grip: 0.4, gameness: 0.3, conformation: 0.2, stamina: 0.1 };
```

Suitability % = `statScore(dog.stats, weights)` (the same helper
`resolveHunt` already uses in `simulation.jsx`), clamped 0-100. Displayed as
a `RoleBadge` on `DogCard` only inside the group-hunt picker screen — it does
not appear on dog cards elsewhere in the game.

Group-size limits reuse the existing `FAME_TIERS` from `simulation.jsx`
one-for-one — no new progression currency:

```js
// js/grouphunt.jsx
const GROUP_HUNT_LIMITS = [
  { fameMin: 0,   bay: 2, catch: 1 }, // Unknown
  { fameMin: 15,  bay: 2, catch: 1 }, // Locally Known
  { fameMin: 40,  bay: 3, catch: 2 }, // Regional Name
  { fameMin: 80,  bay: 4, catch: 3 }, // County Famous
  { fameMin: 150, bay: 4, catch: 3 }, // State Renowned
  { fameMin: 260, bay: 5, catch: 4 }, // Living Legend
];
```

A plain, top-of-file config array — easy to rebalance without touching
logic, per the original request.

## Hunt flow (state machine)

New state slice, `state.groupHunt`, `null` when no hunt is active. Shape:

```js
{
  phase: "setup" | "searching" | "bayed" | "traveling" | "catching" | "results",
  zones: [...],              // static zone list for this hunt instance
  bayDogIds: [...],
  catchDogIds: [...],
  dogZones: { [dogId]: zoneKey },   // current position
  dogStatus: { [dogId]: "searching" | "baying" | "traveling" | "idle" },
  hog: { zoneKey, weightLbs, difficulty, found: bool },
  tickHandle: ...,           // interval id, cleared on unmount/phase change
  miniGame: { meter, round, sweetSpot, marker } | null,
  result: {...} | null,
}
```

Phase transitions:

1. **setup** — role-assignment screen (see below). "Hunt" button starts the
   hunt, seeds zones/hog, moves to `searching`.
2. **searching** — a `setInterval` tick (~1.5s) moves each bay dog between
   zones, weighted by that dog's bay suitability + `rand`, same flavor of
   randomness `resolveHunt` already uses. Each tick has a chance (scaled by
   suitability and elapsed ticks, so it can't hang forever) to bay the hog.
   On success: interval clears, phase → `bayed`.
3. **bayed** — modal: `🐗 HOG BAYED!`, bay dog names, hog's zone revealed.
   Two buttons: **Release Catch Dogs** → `traveling`. **Call Off** → small
   consolation payout + XP, phase → `results` directly, hunt ends without
   risk.
4. **traveling** — catch dogs tick toward the hog's zone the same way (this
   direction is deterministic, not weighted search — they know where to go
   once bayed). A "skip travel" button is available for players who don't
   want to wait through the ticks. On arrival: phase → `catching`.
5. **catching** — `CatchMiniGame` opens: a marker sweeps a bar, a "sweet
   spot" window (sized/timed by difficulty) appears each round, player
   taps/clicks when the marker is inside it. Hits raise a control meter,
   misses drop it and give the hog a chance to land a hit back (small chance
   of dog injury, using the existing `INJURIES` table). Meter empty →
   escape. Meter full → catch. Either way, phase → `results`.
6. **results** — summary card: hog weight, tier, bay/catch dog names and
   roles, a performance % (derived from mini-game hit rate + search
   efficiency), payout via existing `hogPayout(weightLbs)`, dog XP. Logged
   into the existing `catches` array (already sorted/sliced to 25) with
   richer provenance (which dogs did which job) than today's flat
   `"pack of N"` string.

`catchWeight(huntKey, tier, groupSize)` is reused for the base weight roll,
called with `groupSize` = number of catch dogs (not total group size) so
weight scales with actual catching power, matching the original spec's
"bigger groups handle bigger hogs" intent.

## Mini-game difficulty

Sweet-spot size and marker speed are derived from:

- Hog weight tier (heavier = smaller/faster sweet spot)
- Sum of catch dogs' `CATCH_WEIGHTS` scores
- Number of catch dogs (more dogs = a little forgiveness, matching the
  "2+ strong catch dogs for a large hog" guidance)
- Remaining stamina after travel (dogs that searched/traveled longer arrive
  more gassed, per the existing `agePrime`/stamina-decay pattern used
  elsewhere in `simulation.jsx`)

Per-round hit tolerance keeps a random component so identical setups don't
play out identically every time, per the "not fully deterministic"
requirement.

## UI / components

- **`js/grouphunt.jsx`** (new, loaded after `simulation.jsx`, before
  `game.jsx`): `BAY_WEIGHTS`, `CATCH_WEIGHTS`, `GROUP_HUNT_LIMITS`, role
  suitability calc, zone data, search/travel tick logic, mini-game
  difficulty + resolution. Pure functions, no React — same shape as
  `simulation.jsx`.
- **`components.jsx`** additions: `RoleBadge` (small % pill for
  Bay/Catch), `HuntMap` (zone grid + dog position icons + status list),
  `BayedEventModal`, `CatchMiniGame`.
- **`game.jsx`**: removes `doGroupHunt` and the old instant group-hunt JSX
  block; adds `state.groupHunt` handling, `doStartGroupHunt`,
  `doReleaseCatchDogs`, `doCallOff`, `doSkipTravel`, mini-game tap handler,
  and phase-driven rendering inside the existing `tab === "hunt"` section.
- **`index.html`**: one new `<script src="js/grouphunt.jsx" type="text/babel">`
  tag, positioned after `simulation.jsx` and before `game.jsx`.
- **`styles.css`**: new `kg-` prefixed classes for the zone map grid, zone
  tiles, dog position markers, and the mini-game bar — following the
  existing design system, both night and day themes covered.

## Mobile / desktop

Zone map is a CSS grid that reflows to a single column under the existing
mobile breakpoint. Mini-game interaction is a plain `onClick` (fires for
both touch and mouse), with touch-sized tap targets.

## Testing

- `npm run check:syntax` picks up `grouphunt.jsx` automatically (it globs
  `js/*.jsx`).
- `npm run check:smoke` gets a new scripted pass: start a group hunt, drive
  it through search → bay → release → mini-game → results, assert no
  console errors, matching the existing pattern of clicking through tabs in
  a real headless browser.

## Explicitly out of scope (Phase 2)

- Trackers as a hireable/leveled service or dog role.
- Dogs going "lost" mid-hunt and needing to be found.
- Any tracker-specific breeding/role-suitability surfacing.

These are deferred to a follow-up spec once the core loop is live and
playtested.
