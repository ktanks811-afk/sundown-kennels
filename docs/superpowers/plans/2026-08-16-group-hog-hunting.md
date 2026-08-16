# Group Hog Hunting (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the game's instant "Group hog hunt" with a staged, role-based group hunt — assign dogs to Bay/Catch roles, watch a zone map while bay dogs search, get a bayed event with a real release-or-call-off decision, watch catch dogs travel in, play a timing-bar mini-game to land the catch, and see a results summary.

**Architecture:** One new pure-logic file (`js/grouphunt.jsx`, no React — same shape as `simulation.jsx`) holds every formula: role suitability, group-size limits, the search/travel tick simulation, and mini-game difficulty/resolution. New presentational components in `components.jsx` render it. `game.jsx` owns the hunt-in-progress as local component state (`groupHunt`, separate from the persisted `state` object — nothing about a hunt in progress is saved; only the final outcome is, via the existing `update()`/`tick()` path every other action already uses).

**Tech Stack:** React 18 + Babel-in-browser (no bundler, no imports — global script scope, same as the rest of `js/`). Node's built-in `vm`/`assert` modules for unit-testing the new pure logic (no new npm dependency — `@babel/core` is already a devDependency). Playwright for the existing browser smoke test.

**Spec:** `docs/superpowers/specs/2026-08-16-group-hog-hunting-design.md`

## Global Constraints

- Do not redesign the existing game or change its UI style beyond what's needed to display the new screens (from the spec).
- Do not remove or break existing features, **except** the old instant "Group hog hunt" (`doGroupHunt` and its UI block in `game.jsx`), which this explicitly supersedes — confirmed with the player during design.
- Reuse existing dog/player/money/inventory/kennel/progression systems wherever possible — no new dog fields, no parallel stat or currency system.
- Works on mobile and desktop.
- No bundler, no new npm dependencies. Files load via `<script type="text/babel">` tags in `index.html`, in dependency order, sharing one global scope — no `import`/`export`.
- Group-size limits must be defined as a plain, easy-to-edit config array (from the spec) — see `GROUP_HUNT_LIMITS` in Task 1.
- The catch-hog randomness must never be fully deterministic (from the spec) — every roll in this plan keeps a random component even where a stat-driven baseline dominates.
- The original request's "Dog XP" / "Hunting XP" reward line doesn't map to anything in this codebase — there is no XP field anywhere in `js/`. The game's actual progression currency for a successful competitive outing is a small **permanent stat gain** plus **fame gain**, exactly how `doTrial` already rewards a win (`game.jsx:706-728`). This plan reuses that mechanism for a successful catch instead of inventing a new XP stat. This is a deliberate substitution, not a scope cut — flagged here since it diverges from the spec's literal wording.

---

### Task 1: Pure hunt-logic module (`js/grouphunt.jsx`)

**Files:**
- Create: `js/grouphunt.jsx`
- Create: `scripts/test-grouphunt.mjs`
- Modify: `package.json` (add `test:grouphunt` script)
- Modify: `index.html:60-61` (new script tag between `simulation.jsx` and `components.jsx`)

**Interfaces:**
- Consumes: `clamp(v, lo=0, hi=100)`, `rand(min, max)`, `randInt(min, max)`, `statScore(stats, weights)` (all `js/genetics.jsx`); `catchWeight(huntKey, tier, groupSize)` (`js/simulation.jsx:142-162`); dog objects shaped like `{ id, stats: { gameness, grip, nose, stamina, speed, conformation } }`.
- Produces (used by later tasks):
  - `BAY_WEIGHTS`, `CATCH_WEIGHTS` — weight tables
  - `baySuitability(dog): number` (0-100), `catchSuitability(dog): number` (0-100)
  - `GROUP_HUNT_LIMITS: Array<{fameMin, bay, catch, label}>`, `groupHuntLimit(fame): {fameMin, bay, catch, label}`
  - `HUNT_ZONES: Array<{key, label}>`, `CAMP_ZONE: string`
  - `SEARCH_TICK_MS`, `MAX_SEARCH_TICKS`, `TRAVEL_TICKS` — constants
  - `searchTickChance(bayDogs, ticksElapsed): number` (0-1)
  - `searchTier(bayDogs): "Excellent"|"Good"|"Fair"|"Poor"`
  - `rollHog(bayDogs, catchDogs): { weightLbs, tier, zoneKey, found: false }`
  - `stepSearch(groupHunt): groupHunt` — advances one search tick
  - `stepTravel(groupHunt): groupHunt` — advances one travel tick, seeds `miniGame` on arrival
  - `miniGameDifficulty(hog, catchDogs): { sweetSpotPct, sweepMs }`
  - `rollSweetSpot(sweetSpotPct): { start, end }`
  - `resolveMiniGameTap(miniGame, markerPct): { hit, hogHit, outcome, next }`
  - `MINIGAME_START_METER`, `MINIGAME_MAX_ROUNDS` — constants (used by Task 5 to render round counters)
  - `groupHunt` shape consumed by `stepSearch`/`stepTravel`: `{ phase, bayDogIds, catchDogIds, dogsById, dogZones, ticksElapsed, travelTicks, hog, miniGame }`

- [ ] **Step 1: Write the failing test file**

Create `scripts/test-grouphunt.mjs`. It Babel-transforms `data.jsx`, `genetics.jsx`, `simulation.jsx`, `grouphunt.jsx` (in that load order) and runs them in a `node:vm` sandbox — the same trick `scripts/check-syntax.mjs` already uses `@babel/core` for, avoiding any need to add `export` statements that would break the browser's global-scope loading:

```js
// scripts/test-grouphunt.mjs
// Unit tests for the pure group-hunt logic. These files have no
// import/export (the game loads them as global-scope <script> tags), so we
// Babel-transform and eval them into a vm sandbox in real load order instead
// of importing them — same approach scripts/check-syntax.mjs uses to parse
// them, just carried one step further into actually running the code.
import { transformSync } from "@babel/core";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = process.cwd();
const LOAD_ORDER = ["data.jsx", "genetics.jsx", "simulation.jsx", "grouphunt.jsx"];

const sandbox = { console, Math, Object, Array, Date, JSON, Boolean, String, Number };
vm.createContext(sandbox);
for (const f of LOAD_ORDER) {
  const file = path.join(ROOT, "js", f);
  const code = transformSync(fs.readFileSync(file, "utf8"), { presets: ["@babel/preset-react"], filename: file }).code;
  vm.runInContext(code, sandbox, { filename: file });
}

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`OK    ${name}`); }
  catch (e) { failed++; console.error(`FAIL  ${name}`); console.error(`      ${e.message}`); }
}

const bayDog = { id: "b1", stats: { gameness: 40, grip: 20, nose: 90, stamina: 85, speed: 80, conformation: 50 } };
const catchDog = { id: "c1", stats: { gameness: 85, grip: 90, nose: 20, stamina: 60, speed: 40, conformation: 75 } };
const weakDog = { id: "w1", stats: { gameness: 10, grip: 10, nose: 10, stamina: 10, speed: 10, conformation: 10 } };

test("baySuitability rewards nose/speed/stamina over grip/gameness", () => {
  assert.ok(sandbox.baySuitability(bayDog) > sandbox.baySuitability(catchDog));
});

test("catchSuitability rewards grip/gameness/conformation over nose", () => {
  assert.ok(sandbox.catchSuitability(catchDog) > sandbox.catchSuitability(bayDog));
});

test("suitability is always clamped 0-100", () => {
  const s1 = sandbox.baySuitability(bayDog), s2 = sandbox.catchSuitability(weakDog);
  assert.ok(s1 >= 0 && s1 <= 100);
  assert.ok(s2 >= 0 && s2 <= 100);
});

test("groupHuntLimit returns the lowest tier below 0 fame", () => {
  const limit = sandbox.groupHuntLimit(0);
  assert.equal(limit.bay, 2);
  assert.equal(limit.catch, 1);
});

test("groupHuntLimit steps up at each fame threshold", () => {
  assert.equal(sandbox.groupHuntLimit(40).bay, 3);
  assert.equal(sandbox.groupHuntLimit(260).bay, 5);
  assert.equal(sandbox.groupHuntLimit(260).catch, 4);
});

test("searchTickChance is forced to 1 at the tick cap", () => {
  const chance = sandbox.searchTickChance([weakDog], sandbox.MAX_SEARCH_TICKS - 1);
  assert.equal(chance, 1);
});

test("searchTickChance rises with a stronger pack", () => {
  const weak = sandbox.searchTickChance([weakDog], 0);
  const strong = sandbox.searchTickChance([bayDog], 0);
  assert.ok(strong > weak);
});

test("rollHog produces a weight in the valid clamp range with a tier and zone", () => {
  const hog = sandbox.rollHog([bayDog], [catchDog]);
  assert.ok(hog.weightLbs >= 100 && hog.weightLbs <= 1200);
  assert.ok(["Excellent", "Good", "Fair", "Poor"].includes(hog.tier));
  assert.ok(sandbox.HUNT_ZONES.some((z) => z.key === hog.zoneKey));
  assert.equal(hog.found, false);
});

test("stepSearch always moves bay dogs and increments ticksElapsed", () => {
  const gh = { phase: "searching", bayDogIds: ["b1"], catchDogIds: [], dogsById: { b1: bayDog }, dogZones: { b1: "camp" }, ticksElapsed: 0, travelTicks: 0, hog: { weightLbs: 200, tier: "Good", zoneKey: "creek", found: false }, miniGame: null };
  const next = sandbox.stepSearch(gh);
  assert.equal(next.ticksElapsed, 1);
  assert.ok(sandbox.HUNT_ZONES.some((z) => z.key === next.dogZones.b1));
});

test("stepSearch forces a bay by the tick cap", () => {
  let gh = { phase: "searching", bayDogIds: ["w1"], catchDogIds: [], dogsById: { w1: weakDog }, dogZones: { w1: "camp" }, ticksElapsed: sandbox.MAX_SEARCH_TICKS - 2, travelTicks: 0, hog: { weightLbs: 200, tier: "Good", zoneKey: "creek", found: false }, miniGame: null };
  gh = sandbox.stepSearch(gh);
  assert.equal(gh.phase, "bayed");
  assert.equal(gh.hog.found, true);
});

test("stepTravel moves catch dogs toward the hog's zone and seeds a mini-game on arrival", () => {
  let gh = { phase: "traveling", bayDogIds: ["b1"], catchDogIds: ["c1"], dogsById: { b1: bayDog, c1: catchDog }, dogZones: { b1: "creek", c1: "camp" }, ticksElapsed: 5, travelTicks: sandbox.TRAVEL_TICKS - 1, hog: { weightLbs: 300, tier: "Good", zoneKey: "ridge", found: true }, miniGame: null };
  gh = sandbox.stepTravel(gh);
  assert.equal(gh.phase, "catching");
  assert.equal(gh.dogZones.c1, "ridge");
  assert.ok(gh.miniGame);
  assert.equal(gh.miniGame.meter, sandbox.MINIGAME_START_METER);
  assert.ok(gh.miniGame.sweetSpot.end > gh.miniGame.sweetSpot.start);
});

test("miniGameDifficulty gives a bigger hog a smaller sweet spot for the same dogs", () => {
  const small = sandbox.miniGameDifficulty({ weightLbs: 100 }, [catchDog]);
  const huge = sandbox.miniGameDifficulty({ weightLbs: 1000 }, [catchDog]);
  assert.ok(huge.sweetSpotPct < small.sweetSpotPct);
});

test("resolveMiniGameTap: a hit inside the sweet spot raises the meter with no outcome yet", () => {
  const mg = { meter: 50, round: 0, sweetSpotPct: 30, sweepMs: 1500, sweetSpot: { start: 40, end: 70 } };
  const { hit, outcome, next } = sandbox.resolveMiniGameTap(mg, 55);
  assert.equal(hit, true);
  assert.equal(outcome, null);
  assert.ok(next.meter > mg.meter);
});

test("resolveMiniGameTap: meter reaching 100 resolves as caught", () => {
  const mg = { meter: 90, round: 0, sweetSpotPct: 30, sweepMs: 1500, sweetSpot: { start: 40, end: 70 } };
  const { outcome } = sandbox.resolveMiniGameTap(mg, 55);
  assert.equal(outcome, "caught");
});

test("resolveMiniGameTap: meter reaching 0 resolves as escaped", () => {
  const mg = { meter: 10, round: 0, sweetSpotPct: 10, sweepMs: 1500, sweetSpot: { start: 40, end: 50 } };
  const { outcome } = sandbox.resolveMiniGameTap(mg, 99);
  assert.equal(outcome, "escaped");
});

test("resolveMiniGameTap forces an outcome at the round cap", () => {
  const mg = { meter: 60, round: sandbox.MINIGAME_MAX_ROUNDS - 1, sweetSpotPct: 10, sweepMs: 1500, sweetSpot: { start: 0, end: 10 } };
  const { outcome } = sandbox.resolveMiniGameTap(mg, 99);
  assert.ok(outcome === "caught" || outcome === "escaped");
});

process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run the test file to verify it fails**

Run: `node scripts/test-grouphunt.mjs`
Expected: crashes immediately — `js/grouphunt.jsx` doesn't exist yet (`ENOENT`).

- [ ] **Step 3: Implement `js/grouphunt.jsx`**

```js
/* js/grouphunt.jsx */
/* Group hog hunting: role suitability, the staged zone search, the bayed
   event, catch-dog travel, and the catch mini-game. Pure logic only — no
   React — same shape as simulation.jsx. Loaded after simulation.jsx (needs
   statScore, catchWeight) and before components.jsx (which renders it). */

const BAY_WEIGHTS   = { nose: 0.4, speed: 0.25, stamina: 0.25, gameness: 0.1 };
const CATCH_WEIGHTS = { grip: 0.4, gameness: 0.3, conformation: 0.2, stamina: 0.1 };

function baySuitability(dog) { return Math.round(clamp(statScore(dog.stats, BAY_WEIGHTS))); }
function catchSuitability(dog) { return Math.round(clamp(statScore(dog.stats, CATCH_WEIGHTS))); }

/* Group size grows with fame — the same six tiers the rest of the game
   already uses (see FAME_TIERS, simulation.jsx). A plain config array so
   these are easy to rebalance later without touching any logic. */
const GROUP_HUNT_LIMITS = [
  { fameMin: 0,   bay: 2, catch: 1, label: "Unknown" },
  { fameMin: 15,  bay: 2, catch: 1, label: "Locally Known" },
  { fameMin: 40,  bay: 3, catch: 2, label: "Regional Name" },
  { fameMin: 80,  bay: 4, catch: 3, label: "County Famous" },
  { fameMin: 150, bay: 4, catch: 3, label: "State Renowned" },
  { fameMin: 260, bay: 5, catch: 4, label: "Living Legend" },
];
function groupHuntLimit(fame) {
  let limit = GROUP_HUNT_LIMITS[0];
  for (const l of GROUP_HUNT_LIMITS) { if ((fame || 0) >= l.fameMin) limit = l; }
  return limit;
}

/* Named zones the map is built from, plus a fixed staging point the group
   starts from before a hog is bayed. */
const HUNT_ZONES = [
  { key: "creek",   label: "North Creek" },
  { key: "thicket", label: "The Thicket" },
  { key: "ridge",   label: "Ridge Line" },
  { key: "bottoms", label: "River Bottoms" },
  { key: "cutover", label: "The Cutover" },
  { key: "flats",   label: "Pine Flats" },
];
const CAMP_ZONE = "camp";

const SEARCH_TICK_MS = 1500;
const MAX_SEARCH_TICKS = 20;   // hard cap — a hunt can never hang, even with a weak or empty pack
const TRAVEL_TICKS = 3;

/* Chance the pack bays the hog on a given tick. Escalates every tick and is
   forced to 1 right before the cap, so a search always resolves in bounded
   time no matter how weak the pack is. */
function searchTickChance(bayDogs, ticksElapsed) {
  if (ticksElapsed >= MAX_SEARCH_TICKS - 1) return 1;
  const avg = bayDogs.length ? bayDogs.reduce((s, d) => s + baySuitability(d), 0) / bayDogs.length : 30;
  const base = 0.12 + avg / 300;                       // ~0.12 to ~0.45 from suitability alone
  const escalation = Math.min(ticksElapsed * 0.05, 0.6);
  return Math.min(base + escalation, 0.95);
}

/* Mirrors resolveHunt's own tier thresholds (simulation.jsx) so a group
   hunt is calibrated on the same scale a solo hunt already uses. */
function searchTier(bayDogs) {
  const avg = bayDogs.length ? bayDogs.reduce((s, d) => s + baySuitability(d), 0) / bayDogs.length : 30;
  const roll = avg + rand(-15, 15);
  if (roll >= 85) return "Excellent";
  if (roll >= 65) return "Good";
  if (roll >= 45) return "Fair";
  return "Poor";
}

/* Rolls the hog once the hunt starts. Reuses catchWeight (simulation.jsx) —
   the same curve solo/instant-group hunts already use — keyed off the bay
   pack's search tier and the number of catch dogs brought along, so a
   bigger, better-matched group has a real shot at something huge. */
function rollHog(bayDogs, catchDogs) {
  const tier = searchTier(bayDogs);
  const weightLbs = catchWeight("hog", tier, catchDogs.length || 1);
  return { weightLbs, tier, zoneKey: HUNT_ZONES[randInt(0, HUNT_ZONES.length - 1)].key, found: false };
}

/* One search tick: bay dogs hop to a random zone (cosmetic — this is a
   staged zone map, not free positioning) and roll to see if the hog gets
   bayed this tick. */
function stepSearch(groupHunt) {
  const dogZones = { ...groupHunt.dogZones };
  groupHunt.bayDogIds.forEach((id) => { dogZones[id] = HUNT_ZONES[randInt(0, HUNT_ZONES.length - 1)].key; });
  const ticksElapsed = groupHunt.ticksElapsed + 1;
  const bayDogs = groupHunt.bayDogIds.map((id) => groupHunt.dogsById[id]);
  const found = Math.random() < searchTickChance(bayDogs, ticksElapsed);
  if (found) {
    return { ...groupHunt, dogZones, ticksElapsed, phase: "bayed", hog: { ...groupHunt.hog, found: true } };
  }
  return { ...groupHunt, dogZones, ticksElapsed };
}

/* One travel tick: catch dogs move toward the hog's zone. Like the search
   step, this is cosmetic zone-hopping, not real pathing — but they only
   land ON the hog's zone on the arrival tick, so the map actually shows
   them "still closing in" for the ticks before that instead of teleporting
   there immediately. Seeds the mini-game the moment they arrive. */
function stepTravel(groupHunt) {
  const dogZones = { ...groupHunt.dogZones };
  const travelTicks = groupHunt.travelTicks + 1;
  const arrived = travelTicks >= TRAVEL_TICKS;
  groupHunt.catchDogIds.forEach((id) => {
    dogZones[id] = arrived ? groupHunt.hog.zoneKey : HUNT_ZONES[randInt(0, HUNT_ZONES.length - 1)].key;
  });
  if (arrived) {
    const catchDogs = groupHunt.catchDogIds.map((id) => groupHunt.dogsById[id]);
    const { sweetSpotPct, sweepMs } = miniGameDifficulty(groupHunt.hog, catchDogs);
    const miniGame = { meter: MINIGAME_START_METER, round: 0, sweetSpotPct, sweepMs, sweetSpot: rollSweetSpot(sweetSpotPct) };
    return { ...groupHunt, dogZones, travelTicks, phase: "catching", miniGame };
  }
  return { ...groupHunt, dogZones, travelTicks };
}

/* -------------------------- catch mini-game -------------------------- */

const MINIGAME_START_METER = 50;
const MINIGAME_HIT_GAIN = 22;
const MINIGAME_MISS_LOSS = 18;
const MINIGAME_HOG_HIT_CHANCE = 0.35;   // chance a miss also costs a dog some health
const MINIGAME_MAX_ROUNDS = 8;

/* Sweet-spot width (% of the bar) and marker sweep speed for a round.
   Bigger hog + weaker/fewer catch dogs = a smaller, faster window. */
function miniGameDifficulty(hog, catchDogs) {
  const catchPower = catchDogs.length ? catchDogs.reduce((s, d) => s + catchSuitability(d), 0) / catchDogs.length : 20;
  const packBonus = Math.min((catchDogs.length - 1) * 8, 24);
  const netPower = clamp(catchPower + packBonus);
  const sizeFactor = clamp(hog.weightLbs / 12, 20, 100);
  const edge = netPower - sizeFactor;                 // positive = dogs favored
  const sweetSpotPct = clamp(26 + edge / 4, 10, 42);
  const sweepMs = clamp(1800 - edge * 6, 900, 2200);
  return { sweetSpotPct, sweepMs };
}

function rollSweetSpot(sweetSpotPct) {
  const start = rand(0, 100 - sweetSpotPct);
  return { start, end: start + sweetSpotPct };
}

/* Resolves a single tap against the current sweep position (0-100). Keeps a
   random component (hog fighting back on a miss) even though the odds are
   stat-driven, per the "not fully deterministic" requirement. */
function resolveMiniGameTap(miniGame, markerPct) {
  const hit = markerPct >= miniGame.sweetSpot.start && markerPct <= miniGame.sweetSpot.end;
  const meter = clamp(miniGame.meter + (hit ? MINIGAME_HIT_GAIN : -MINIGAME_MISS_LOSS), 0, 100);
  const round = miniGame.round + 1;
  const hogHit = !hit && Math.random() < MINIGAME_HOG_HIT_CHANCE;
  let outcome = null;
  if (meter >= 100) outcome = "caught";
  else if (meter <= 0) outcome = "escaped";
  else if (round >= MINIGAME_MAX_ROUNDS) outcome = meter >= MINIGAME_START_METER ? "caught" : "escaped";
  return { hit, hogHit, outcome, next: { ...miniGame, meter, round, sweetSpot: outcome ? miniGame.sweetSpot : rollSweetSpot(miniGame.sweetSpotPct) } };
}
```

- [ ] **Step 4: Run the test file to verify it passes**

Run: `node scripts/test-grouphunt.mjs`
Expected: every `OK` line printed, exit code 0.

- [ ] **Step 5: Wire the test into `package.json` and add the script tag**

In `package.json`, add alongside the existing scripts:

```json
    "check:syntax": "node scripts/check-syntax.mjs",
    "check:smoke": "node scripts/smoke-test.mjs",
    "test:grouphunt": "node scripts/test-grouphunt.mjs"
```

In `index.html`, insert a new line between the `simulation.jsx` and `components.jsx` tags (currently `index.html:60-61`):

```html
<script type="text/babel" src="js/simulation.jsx"></script>
<script type="text/babel" src="js/grouphunt.jsx"></script>
<script type="text/babel" src="js/components.jsx"></script>
```

- [ ] **Step 6: Run the full syntax check to make sure the new file parses cleanly in the same pipeline as everything else**

Run: `npm run check:syntax`
Expected: `OK    grouphunt.jsx` alongside the other five files, exit code 0.

- [ ] **Step 7: Commit**

```bash
git add js/grouphunt.jsx scripts/test-grouphunt.mjs package.json index.html
git commit -m "Add group-hunt logic module: role suitability, search/travel ticks, catch mini-game"
```

---

### Task 2: Setup screen — role assignment, fame-gated limits, role badges

**Files:**
- Modify: `js/components.jsx` (add `RoleBadge`)
- Modify: `js/game.jsx` (remove `doGroupHunt` + old group-hunt state/UI, add setup state + handlers + new UI)
- Modify: `styles.css` (role badge + setup grid styles)

**Interfaces:**
- Consumes from Task 1: `groupHuntLimit(fame)`, `baySuitability(dog)`, `catchSuitability(dog)`
- Consumes existing: `canHunt(dog)` (`simulation.jsx:221`), `DogCard` (`components.jsx:97`), `state.dogs`, `state.fame`
- Produces (used by later tasks): `groupSetup` state shape `{ bayIds: string[], catchIds: string[] }`; `groupHunt` state (`null` until started); handler `doStartGroupHunt()`

This task removes the old group-hunt code first, then builds the new setup screen in its place.

- [ ] **Step 1: Remove the old instant group hunt**

In `js/game.jsx`, delete the `doGroupHunt` function (`game.jsx:625-650`) and the old group-hunt JSX block inside the `tab === "hunt"` section (`game.jsx:1413-1434`, the `<hr />` through the closing `</>` for "Group hog hunt"). Delete the `groupHuntPicks` state declaration (`game.jsx:30`, `const [groupHuntPicks, setGroupHuntPicks] = useState([]);`) and its setter calls.

- [ ] **Step 2: Run the syntax check to confirm the removal didn't break parsing**

Run: `npm run check:syntax`
Expected: `OK    game.jsx`, exit code 0. (This won't catch the now-dangling references to `groupHuntPicks`/`doGroupHunt` if any remain — the next step does, via a real browser.)

- [ ] **Step 3: Run the existing smoke test to confirm nothing broke**

Run: `npx playwright install chromium` (first time only), then `npm run check:smoke`
Expected: `Smoke test passed: onboarding + every tab loaded with zero console errors.` If it fails referencing `groupHuntPicks` or `doGroupHunt`, a reference was missed — search `js/game.jsx` for both names and remove any left over.

- [ ] **Step 4: Add `RoleBadge` to `components.jsx`**

Append near `Badge` (`components.jsx:18`):

```jsx
/* A small suitability-percent pill for the group-hunt role pickers — not
   shown on DogCard anywhere else in the game. */
function RoleBadge({ label, value }) {
  const tone = value >= 75 ? "olive" : value >= 45 ? "denim" : "rust";
  return <span className={"kg-rolebadge kg-rolebadge--" + tone}>{label} {value}%</span>;
}
```

- [ ] **Step 5: Add setup state and handlers to `game.jsx`**

Near the other hunt-related state (`game.jsx:29`, right after `huntPick`):

```js
const [groupSetup, setGroupSetup] = useState({ bayIds: [], catchIds: [] });
const [groupHunt, setGroupHunt] = useState(null);
```

Add handlers near `doHunt` (after its closing brace, `game.jsx:623`):

```js
function toggleBayPick(dogId) {
  setGroupSetup((p) => {
    if (p.bayIds.includes(dogId)) return { ...p, bayIds: p.bayIds.filter((id) => id !== dogId) };
    const limit = groupHuntLimit(state.fame || 0);
    if (p.bayIds.length >= limit.bay) return p;
    return { ...p, bayIds: [...p.bayIds, dogId], catchIds: p.catchIds.filter((id) => id !== dogId) };
  });
}
function toggleCatchPick(dogId) {
  setGroupSetup((p) => {
    if (p.catchIds.includes(dogId)) return { ...p, catchIds: p.catchIds.filter((id) => id !== dogId) };
    const limit = groupHuntLimit(state.fame || 0);
    if (p.catchIds.length >= limit.catch) return p;
    return { ...p, catchIds: [...p.catchIds, dogId], bayIds: p.bayIds.filter((id) => id !== dogId) };
  });
}
function doStartGroupHunt() {
  const bayDogs = state.dogs.filter((d) => groupSetup.bayIds.includes(d.id));
  const catchDogs = state.dogs.filter((d) => groupSetup.catchIds.includes(d.id));
  if (bayDogs.length < 1 || catchDogs.length < 1) return;
  const dogsById = {};
  [...bayDogs, ...catchDogs].forEach((d) => { dogsById[d.id] = d; });
  const dogZones = {};
  [...bayDogs, ...catchDogs].forEach((d) => { dogZones[d.id] = CAMP_ZONE; });
  setGroupHunt({
    phase: "searching",
    bayDogIds: bayDogs.map((d) => d.id),
    catchDogIds: catchDogs.map((d) => d.id),
    dogsById,
    dogZones,
    ticksElapsed: 0,
    travelTicks: 0,
    hog: rollHog(bayDogs, catchDogs),
    miniGame: null,
  });
}
```

- [ ] **Step 6: Add the setup UI to the hunt tab**

In `js/game.jsx`, in the `tab === "hunt"` section, replace where the old group-hunt block used to be (same spot deleted in Step 1) with:

```jsx
<hr className="kg-divider" />
<h2 className="kg-subhead">Group Hunt</h2>
{!groupHunt && (
  <>
    <p className="kg-hint">ℹ Build a hunting party: bay dogs find and hold the hog, catch dogs bring it down. Your kennel's fame sets how big a group you can field.</p>
    <p className="kg-note">{fameTier(state.fame || 0).label} — up to {groupHuntLimit(state.fame || 0).bay} bay dogs, {groupHuntLimit(state.fame || 0).catch} catch dogs.</p>
    {huntableDogs.length < 2 ? <p className="kg-empty">Need at least 2 dogs fit to hunt to build a group.</p> : (
      <>
        <h3 className="kg-subhead" style={{ fontSize: 15 }}>Bay dogs ({groupSetup.bayIds.length}/{groupHuntLimit(state.fame || 0).bay})</h3>
        <div className="kg-grid" style={{ marginBottom: 18 }}>
          {huntableDogs.map((dog) => {
            const picked = groupSetup.bayIds.includes(dog.id);
            const disabled = !picked && groupSetup.bayIds.length >= groupHuntLimit(state.fame || 0).bay;
            return (
              <DogCard key={dog.id} dog={dog} onView={setViewDog}
                footer={<>
                  <RoleBadge label="Bay" value={baySuitability(dog)} />
                  <button className={"kg-btn kg-btn--sm " + (picked ? "" : "kg-btn--ghost")} disabled={disabled}
                    onClick={() => toggleBayPick(dog.id)}>{picked ? "✓ Bay dog" : "Add as bay dog"}</button>
                </>} />
            );
          })}
        </div>
        <h3 className="kg-subhead" style={{ fontSize: 15 }}>Catch dogs ({groupSetup.catchIds.length}/{groupHuntLimit(state.fame || 0).catch})</h3>
        <div className="kg-grid" style={{ marginBottom: 18 }}>
          {huntableDogs.map((dog) => {
            const picked = groupSetup.catchIds.includes(dog.id);
            const disabled = !picked && groupSetup.catchIds.length >= groupHuntLimit(state.fame || 0).catch;
            return (
              <DogCard key={dog.id} dog={dog} onView={setViewDog}
                footer={<>
                  <RoleBadge label="Catch" value={catchSuitability(dog)} />
                  <button className={"kg-btn kg-btn--sm " + (picked ? "" : "kg-btn--ghost")} disabled={disabled}
                    onClick={() => toggleCatchPick(dog.id)}>{picked ? "✓ Catch dog" : "Add as catch dog"}</button>
                </>} />
            );
          })}
        </div>
        <button className="kg-btn kg-btn--gold" disabled={groupSetup.bayIds.length < 1 || groupSetup.catchIds.length < 1} onClick={doStartGroupHunt}>
          {groupSetup.bayIds.length < 1 ? "Pick at least 1 bay dog" : groupSetup.catchIds.length < 1 ? "Pick at least 1 catch dog" : "Head out"}
        </button>
      </>
    )}
  </>
)}
```

A dog can only hold one role at a time — `toggleBayPick`/`toggleCatchPick` each strip the dog from the other list when picked, so `DogCard` never shows it selected in both places.

- [ ] **Step 7: Manual verification**

Run a local server (`python -m http.server 8000` or double-click `serve.cmd`) and open `http://localhost:8000`. Get through onboarding, go to the Hunt tab, and confirm: the "Group Hunt" section renders below the solo-hunt picker; role badges show a `%` per dog; picking a dog for Bay removes it from the Catch pool and vice versa; the Add buttons disable once the fame-tier limit is hit; "Head out" is disabled until at least one dog is in each role.

- [ ] **Step 8: Add CSS**

Append to `styles.css` (near the existing `.kg-huntcard` rules, `styles.css:375-385`):

```css
.kg-rolebadge { display:inline-block; font-size:11px; font-weight:600; padding:3px 9px; border-radius:999px; margin-right:8px; letter-spacing:0.01em; }
.kg-rolebadge--olive { color: var(--olive); background: rgba(70,179,122,0.13); border:1px solid rgba(70,179,122,0.3); }
.kg-rolebadge--denim { color: var(--denim); background: rgba(134,176,209,0.13); border:1px solid rgba(134,176,209,0.3); }
.kg-rolebadge--rust  { color: var(--rust);  background: rgba(224,72,74,0.13);   border:1px solid rgba(224,72,74,0.3); }
```

No `[data-theme="light"]` override needed — these reuse the existing `--olive`/`--denim`/`--rust` tokens, which are already redefined for the light theme elsewhere in the file.

- [ ] **Step 9: Commit**

```bash
git add js/components.jsx js/game.jsx styles.css
git commit -m "Add group-hunt role assignment screen with fame-gated limits"
```

---

### Task 3: Search phase — zone map, live tick, bayed detection

**Files:**
- Modify: `js/components.jsx` (add `HuntMap`)
- Modify: `js/game.jsx` (tick effect, render the map during `searching`)
- Modify: `styles.css` (zone map styles)

**Interfaces:**
- Consumes from Task 1: `stepSearch(groupHunt)`, `HUNT_ZONES`, `CAMP_ZONE`, `SEARCH_TICK_MS`
- Consumes from Task 2: `groupHunt` state, `setGroupHunt`
- Produces (used by later tasks): `HuntMap({ zones, dogZones, dogsById, bayDogIds, catchDogIds, hogZoneKey })` component, reused again in Task 4's traveling phase.

- [ ] **Step 1: Add `HuntMap` to `components.jsx`**

Append after `RoleBadge`:

```jsx
/* The staged zone map — a grid of named areas with dog markers that hop
   between zones on each simulation tick (see stepSearch/stepTravel in
   grouphunt.jsx). Not a free-position map: markers snap to whichever zone
   tile they currently occupy. */
function HuntMap({ zones, dogZones, dogsById, bayDogIds, catchDogIds, hogZoneKey }) {
  return (
    <div className="kg-huntmap">
      <div className="kg-huntmap__grid">
        {zones.map((zone) => {
          const here = Object.entries(dogZones).filter(([, z]) => z === zone.key).map(([id]) => id);
          return (
            <div key={zone.key} className={"kg-zone" + (hogZoneKey === zone.key ? " kg-zone--hog" : "")}>
              <span className="kg-zone__label">{zone.label}</span>
              <div className="kg-zone__dogs">
                {here.map((id) => (
                  <span key={id} className={"kg-dogmarker " + (bayDogIds.includes(id) ? "kg-dogmarker--bay" : "kg-dogmarker--catch")} title={dogsById[id].name}>
                    {bayDogIds.includes(id) ? "🐕" : "🐾"}
                  </span>
                ))}
                {hogZoneKey === zone.key && <span className="kg-dogmarker kg-dogmarker--hog" title="Hog">🐗</span>}
              </div>
            </div>
          );
        })}
      </div>
      <ul className="kg-huntmap__status">
        {[...bayDogIds, ...catchDogIds].map((id) => {
          const dog = dogsById[id];
          const zone = zones.find((z) => z.key === dogZones[id]);
          const isBay = bayDogIds.includes(id);
          return (
            <li key={id}>
              🐕 <strong>{dog.name}</strong> — {zone ? zone.label : "Camp"}
              <span className="kg-huntmap__statustag"> · {isBay ? "Searching" : "Standing by"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Add the tick effect and searching-phase render to `game.jsx`**

Add a `useRef` near the other refs (`game.jsx:50`, after `cloudTimer`):

```js
const huntTickRef = useRef(null);
```

Add the tick effect near the other `useEffect` calls (after the one at `game.jsx:71-...`):

```js
useEffect(() => {
  if (!groupHunt || groupHunt.phase !== "searching") return;
  huntTickRef.current = setInterval(() => {
    setGroupHunt((p) => (p && p.phase === "searching" ? stepSearch(p) : p));
  }, SEARCH_TICK_MS);
  return () => clearInterval(huntTickRef.current);
}, [groupHunt && groupHunt.phase]);
```

In the hunt tab JSX, right after the setup block added in Task 2, add the searching-phase render:

```jsx
{groupHunt && groupHunt.phase === "searching" && (
  <div className="kg-huntsession">
    <p className="kg-note">🔎 Your bay dogs are working the ground — the hog's exact location is still unknown.</p>
    <HuntMap zones={HUNT_ZONES} dogZones={groupHunt.dogZones} dogsById={groupHunt.dogsById}
      bayDogIds={groupHunt.bayDogIds} catchDogIds={groupHunt.catchDogIds} hogZoneKey={null} />
  </div>
)}
```

- [ ] **Step 3: Manual verification**

Serve the game, start a group hunt from the setup screen, and confirm: a "🔎 …" note and the zone grid appear immediately; bay dog markers (🐕) jump between zone tiles roughly every 1.5 seconds; the status list below the grid updates every tick; within at most ~20 ticks (~30s) the hunt always advances (visually: the searching view disappears — Task 4 adds what replaces it, so for this task it's enough that it doesn't get stuck rendering "searching" forever). Confirm on a narrow (mobile-width) browser window that the zone grid reflows to a single column and doesn't cause horizontal scrolling.

- [ ] **Step 4: Add CSS**

Append to `styles.css`:

```css
.kg-huntmap { margin: 14px 0 20px; }
.kg-huntmap__grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap:10px; margin-bottom:16px; }
.kg-zone {
  background: var(--paper-dark); border:1px solid var(--border); border-radius: var(--r-sm);
  padding:12px; min-height:64px; transition: border-color 0.3s, background 0.3s;
}
.kg-zone--hog { border-color: var(--rust); background: rgba(224,72,74,0.09); }
.kg-zone__label { font-size:12px; font-weight:600; color: var(--ink-soft); display:block; margin-bottom:8px; }
.kg-zone__dogs { display:flex; flex-wrap:wrap; gap:6px; font-size:18px; }
.kg-dogmarker { transition: transform 0.25s; }
.kg-dogmarker--hog { filter: drop-shadow(0 0 4px rgba(224,72,74,0.6)); }
.kg-huntmap__status { list-style:none; margin:0; padding:0; font-size:13px; color: var(--ink-soft); display:flex; flex-direction:column; gap:4px; }
.kg-huntmap__statustag { color: var(--denim); }
@media (max-width: 640px) { .kg-huntmap__grid { grid-template-columns: 1fr 1fr; } }
```

- [ ] **Step 5: Commit**

```bash
git add js/components.jsx js/game.jsx styles.css
git commit -m "Add zone map and live search-tick engine for group hunts"
```

---

### Task 4: Bayed event, Call Off, and the results screen

**Files:**
- Modify: `js/components.jsx` (add `BayedEventModal`)
- Modify: `js/game.jsx` (bayed/call-off handlers, `finishGroupHunt`, results render)
- Modify: `styles.css` (bayed modal + results card styles)

This task makes the **shortest full loop playable end to end**: setup → search → bayed → call off → results.

**Interfaces:**
- Consumes from Task 1: `hogPayout(weightLbs)`, `rollInjury(huntKey)` (`simulation.jsx`); `clamp`, `randInt`, `genId`, `fmtMoney` (`genetics.jsx`); `tick`, `update`, `addLog` (`game.jsx`)
- Consumes from Task 2/3: `groupHunt`, `setGroupHunt`, `setGroupSetup`
- Produces (used by Task 5): `finishGroupHunt(outcome)` where `outcome = { caught: bool, calledOff: bool, bayDogs: Dog[], catchDogs: Dog[], hog: {weightLbs, tier}, }` — Task 5's mini-game tap handler calls this same function.

- [ ] **Step 1: Add `BayedEventModal` to `components.jsx`**

```jsx
function BayedEventModal({ hog, bayDogs, zoneLabel, onRelease, onCallOff }) {
  return (
    <div className="kg-modal-backdrop">
      <div className="kg-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="kg-modal__head"><h2>🐗 HOG BAYED!</h2></div>
        <p>Your bay dogs have a hog bayed at <strong>{zoneLabel}</strong>.</p>
        <p className="kg-note">Bay dogs: {bayDogs.map((d) => d.name).join(", ")}</p>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button className="kg-btn kg-btn--gold" onClick={onRelease}>Release Catch Dogs</button>
          <button className="kg-btn kg-btn--ghost" onClick={onCallOff}>Call Off</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `finishGroupHunt` and the call-off/release handlers to `game.jsx`**

Add after `doStartGroupHunt` (from Task 2):

```js
function finishGroupHunt(outcome) {
  const { caught, calledOff, bayDogs, catchDogs, hog } = outcome;
  const payout = caught ? hogPayout(hog.weightLbs) : 0;
  const fameGain = caught ? 4 : calledOff ? 0 : 1;
  update((prev) => {
    const overrides = {};
    bayDogs.forEach((d) => { overrides[d.id] = { healthDelta: -randInt(2, 8) }; });
    catchDogs.forEach((d) => {
      const hurt = !calledOff && !caught && Math.random() < 0.3;
      overrides[d.id] = { healthDelta: hurt ? -randInt(15, 35) : -randInt(5, 15), injury: hurt ? rollInjury("hog") : undefined };
    });
    let next = tick(prev, 1, overrides);
    next.cash = Math.round(next.cash + payout);
    next.fame = (prev.fame || 0) + fameGain;
    if (caught) {
      const bayGain = randInt(1, 3), catchGain = randInt(1, 3);
      next.dogs = next.dogs.map((d) => {
        if (bayDogs.some((b) => b.id === d.id)) return { ...d, stats: { ...d.stats, nose: clamp(d.stats.nose + bayGain), speed: clamp(d.stats.speed + bayGain) } };
        if (catchDogs.some((c) => c.id === d.id)) return { ...d, stats: { ...d.stats, grip: clamp(d.stats.grip + catchGain), gameness: clamp(d.stats.gameness + catchGain) } };
        return d;
      });
    }
    const names = [...bayDogs, ...catchDogs].map((d) => d.name).join(", ");
    if (caught) {
      next.catches = [...next.catches, { id: genId(), day: prev.day + 1, kennelName: prev.kennelName, dogName: `${names} (group hunt)`, breed: "Group Hunt", huntType: "Hog Hunt", tier: hog.tier, weightLbs: hog.weightLbs, payout }]
        .sort((a, b) => (b.weightLbs || b.payout) - (a.weightLbs || a.payout)).slice(0, 25);
    }
    const msg = calledOff
      ? `Called the pack (${names}) off a bayed hog rather than risk it.`
      : caught
      ? `The pack (${names}) bayed and caught a ${hog.weightLbs}lb hog — earned ${fmtMoney(payout)}.`
      : `The pack (${names}) had a hog bayed but it fought free before the catch dogs could finish it.`;
    return addLog(next, caught ? "hunt" : calledOff ? "info" : "injury", msg);
  });
  setGroupSetup({ bayIds: [], catchIds: [] });
}

function doCallOffGroupHunt() {
  const bayDogs = groupHunt.bayDogIds.map((id) => groupHunt.dogsById[id]);
  finishGroupHunt({ caught: false, calledOff: true, bayDogs, catchDogs: [], hog: groupHunt.hog });
  setGroupHunt((p) => (p ? { ...p, phase: "results", result: { calledOff: true } } : p));
}

function doReleaseCatchDogs() {
  setGroupHunt((p) => (p ? { ...p, phase: "traveling", travelTicks: 0 } : p));
}

function doEndGroupHuntSession() {
  setGroupHunt(null);
}
```

- [ ] **Step 3: Render the bayed modal and the results card in `game.jsx`**

Immediately after the `searching` block added in Task 3:

```jsx
{groupHunt && groupHunt.phase === "bayed" && (
  <BayedEventModal hog={groupHunt.hog} bayDogs={groupHunt.bayDogIds.map((id) => groupHunt.dogsById[id])}
    zoneLabel={(HUNT_ZONES.find((z) => z.key === groupHunt.hog.zoneKey) || {}).label}
    onRelease={doReleaseCatchDogs} onCallOff={doCallOffGroupHunt} />
)}
{groupHunt && groupHunt.phase === "results" && (
  <div className="kg-huntresult">
    {groupHunt.result && groupHunt.result.calledOff ? (
      <p>Called the pack off. No payout, but no risk either — they're back safe.</p>
    ) : (
      <p>Hunt resolved — check the day's log for how it went.</p>
    )}
    <button className="kg-btn" onClick={doEndGroupHuntSession}>Back to the kennel</button>
  </div>
)}
```

(Task 5 replaces the generic "Hunt resolved…" branch with a full stat card once `outcome`/`hitRate` data exists to show.)

- [ ] **Step 4: Manual verification**

Serve the game, start a group hunt, wait for `🐗 HOG BAYED!` to appear, click **Call Off**, and confirm: the modal closes, a "Called the pack off…" line appears in the day's log (Overview or wherever the log renders), cash is unchanged, and the "Back to the kennel" button returns you to the setup screen (an empty `groupSetup` — both role lists cleared). Start a second hunt to confirm the setup screen is clean (no leftover picks from the first run).

- [ ] **Step 5: Run the smoke test**

Run: `npm run check:smoke`
Expected: still passes — the smoke test doesn't drive a hunt yet (Task 6 adds that), it's just confirming this task didn't introduce a console error on page load / tab clicks.

- [ ] **Step 6: Add CSS**

Append to `styles.css`:

```css
.kg-huntresult { background: var(--paper-dark); border:1px solid var(--border); border-radius: var(--r-md); padding:20px; margin-top:14px; }
```

- [ ] **Step 7: Commit**

```bash
git add js/components.jsx js/game.jsx styles.css
git commit -m "Add bayed event, call-off path, and a minimal results screen"
```

---

### Task 5: Travel phase, catch mini-game, and the full results card

**Files:**
- Modify: `js/components.jsx` (add `CatchMiniGame`, expand results rendering)
- Modify: `js/game.jsx` (travel tick, mini-game tap handler, richer `finishGroupHunt` call, full results card)
- Modify: `styles.css` (mini-game bar styles)

This task completes the loop: Release Catch Dogs → travel → mini-game → caught/escaped → full results.

**Interfaces:**
- Consumes from Task 1: `stepTravel`, `resolveMiniGameTap`, `MINIGAME_MAX_ROUNDS`, `TRAVEL_TICKS`
- Consumes from Task 3: `HuntMap`
- Consumes from Task 4: `finishGroupHunt(outcome)`

- [ ] **Step 1: Add the travel tick effect to `game.jsx`**

Extend the tick effect from Task 3 to also drive `traveling`:

```js
useEffect(() => {
  if (!groupHunt) return;
  if (groupHunt.phase !== "searching" && groupHunt.phase !== "traveling") return;
  const step = groupHunt.phase === "searching" ? stepSearch : stepTravel;
  huntTickRef.current = setInterval(() => {
    setGroupHunt((p) => (p && p.phase === groupHunt.phase ? step(p) : p));
  }, SEARCH_TICK_MS);
  return () => clearInterval(huntTickRef.current);
}, [groupHunt && groupHunt.phase]);
```

This replaces the effect added in Task 3 (same dependency array, now branching on phase).

- [ ] **Step 2: Add the traveling-phase render**

Right after the `bayed` block (Task 4, Step 3):

```jsx
{groupHunt && groupHunt.phase === "traveling" && (
  <div className="kg-huntsession">
    <p className="kg-note">🐾 Catch dogs are closing in on the bayed hog.</p>
    <HuntMap zones={HUNT_ZONES} dogZones={groupHunt.dogZones} dogsById={groupHunt.dogsById}
      bayDogIds={groupHunt.bayDogIds} catchDogIds={groupHunt.catchDogIds} hogZoneKey={groupHunt.hog.zoneKey} />
    <button className="kg-btn kg-btn--ghost kg-btn--sm" onClick={() => setGroupHunt((p) => (p ? { ...p, travelTicks: TRAVEL_TICKS } : p))}>Skip ahead</button>
  </div>
)}
```

(Setting `travelTicks` to `TRAVEL_TICKS` lets the next tick's `stepTravel` call see it's already at the cap and transition to `catching` on its own — no separate skip codepath to keep in sync with `stepTravel`'s arrival logic.)

- [ ] **Step 3: Add `CatchMiniGame` to `components.jsx`**

```jsx
/* A marker sweeps 0-100 on a repeating CSS animation; the player taps when
   it's inside the sweet spot. onTap receives the marker's estimated
   position at the moment of the tap. */
function CatchMiniGame({ miniGame, onTap }) {
  // useRef/useEffect are destructured from React once, at the top of
  // data.jsx (the first file loaded) — every later file, this one included,
  // uses them bare rather than as React.useRef/React.useEffect.
  const startRef = useRef(Date.now());

  useEffect(() => { startRef.current = Date.now(); }, [miniGame.round]);

  function handleTap() {
    const elapsed = (Date.now() - startRef.current) % miniGame.sweepMs;
    const phase = elapsed / miniGame.sweepMs;                          // 0-1, sweeps back and forth
    const pct = phase < 0.5 ? phase * 2 * 100 : (1 - phase) * 2 * 100;
    onTap(pct);
  }

  return (
    <div className="kg-minigame">
      <p className="kg-note">Round {miniGame.round + 1} of {MINIGAME_MAX_ROUNDS} — tap when the marker crosses the highlighted zone.</p>
      <div className="kg-minigame__meter"><div className="kg-minigame__meterfill" style={{ width: miniGame.meter + "%" }} /></div>
      <div className="kg-minigame__bar">
        <div className="kg-minigame__sweetspot" style={{ left: miniGame.sweetSpot.start + "%", width: (miniGame.sweetSpot.end - miniGame.sweetSpot.start) + "%" }} />
        <div className="kg-minigame__marker" style={{ animationDuration: miniGame.sweepMs + "ms" }} />
      </div>
      <button className="kg-btn kg-btn--gold" onClick={handleTap}>Tap!</button>
    </div>
  );
}
```

The marker's visual sweep is pure CSS (`Step 6` below defines the `@keyframes`); `handleTap` independently recomputes the same back-and-forth position from elapsed time so the hit test doesn't depend on reading DOM layout.

- [ ] **Step 4: Add the mini-game tap handler and full results to `game.jsx`**

```js
function doMiniGameTap(markerPct) {
  if (!groupHunt || groupHunt.phase !== "catching") return;
  const { outcome, next } = resolveMiniGameTap(groupHunt.miniGame, markerPct);
  if (!outcome) { setGroupHunt((p) => ({ ...p, miniGame: next })); return; }
  const bayDogs = groupHunt.bayDogIds.map((id) => groupHunt.dogsById[id]);
  const catchDogs = groupHunt.catchDogIds.map((id) => groupHunt.dogsById[id]);
  const hog = groupHunt.hog;
  finishGroupHunt({ caught: outcome === "caught", calledOff: false, bayDogs, catchDogs, hog });
  setGroupHunt((p) => (p ? { ...p, miniGame: next, phase: "results", result: { calledOff: false, caught: outcome === "caught", hog, bayDogs, catchDogs, meter: next.meter } } : p));
}
```

Replace the `catching`-phase gap and the Task 4 placeholder results branch:

```jsx
{groupHunt && groupHunt.phase === "catching" && (
  <CatchMiniGame miniGame={groupHunt.miniGame} onTap={doMiniGameTap} />
)}
{groupHunt && groupHunt.phase === "results" && (
  <div className="kg-huntresult">
    {groupHunt.result && groupHunt.result.calledOff ? (
      <p>Called the pack off. No payout, but no risk either — they're back safe.</p>
    ) : groupHunt.result && groupHunt.result.caught ? (
      <>
        <h2 className="kg-subhead">🐗 HOG CAUGHT!</h2>
        <p>Hog: {groupHunt.result.hog.weightLbs}lb ({groupHunt.result.hog.tier})</p>
        <p className="kg-note">Bay dogs: {groupHunt.result.bayDogs.map((d) => d.name).join(", ")}</p>
        <p className="kg-note">Catch dogs: {groupHunt.result.catchDogs.map((d) => d.name).join(", ")}</p>
        <p>Reward: {fmtMoney(hogPayout(groupHunt.result.hog.weightLbs))}</p>
      </>
    ) : (
      <>
        <h2 className="kg-subhead">HOG GOT AWAY!</h2>
        <p>The hog fought free before the catch dogs could finish it.</p>
      </>
    )}
    <button className="kg-btn" onClick={doEndGroupHuntSession}>Back to the kennel</button>
  </div>
)}
```

- [ ] **Step 5: Manual verification**

Serve the game, run a full hunt: pick strong bay/catch dogs, wait for the bay, click **Release Catch Dogs**, watch the map until catch dogs reach the hog's zone (or click **Skip ahead**), then play the mini-game — tap a few times, including at least one deliberate miss. Confirm: the meter moves up on a hit and down on a miss; the round counter advances; the game ends within 8 rounds either way; the results card shows the correct outcome (🐗 HOG CAUGHT! with real weight/dog names, or HOG GOT AWAY!); cash and the day's log reflect the same outcome (compare against the "Overview" log after clicking back).

- [ ] **Step 6: Add CSS**

Append to `styles.css`:

```css
.kg-minigame { background: var(--paper-dark); border:1px solid var(--border); border-radius: var(--r-md); padding:18px; margin:14px 0; }
.kg-minigame__meter { height:10px; border-radius:999px; background: var(--paper); border:1px solid var(--border); overflow:hidden; margin-bottom:14px; }
.kg-minigame__meterfill { height:100%; background: var(--gold); transition: width 0.25s; }
.kg-minigame__bar { position:relative; height:28px; border-radius: var(--r-sm); background: var(--paper); border:1px solid var(--border); margin-bottom:14px; overflow:hidden; }
.kg-minigame__sweetspot { position:absolute; top:0; bottom:0; background: rgba(70,179,122,0.35); border-left:2px solid var(--olive); border-right:2px solid var(--olive); }
.kg-minigame__marker {
  position:absolute; top:0; bottom:0; width:3px; background: var(--rust);
  animation-name: kg-minigame-sweep; animation-timing-function: linear; animation-iteration-count: infinite;
}
@keyframes kg-minigame-sweep { 0% { left:0%; } 50% { left:100%; } 100% { left:0%; } }
```

- [ ] **Step 7: Commit**

```bash
git add js/components.jsx js/game.jsx styles.css
git commit -m "Add travel phase, catch mini-game, and the full group-hunt results card"
```

---

### Task 6: Extend the Playwright smoke test to drive a full group hunt

**Files:**
- Modify: `scripts/smoke-test.mjs`

**Interfaces:**
- Consumes: the finished feature from Tasks 2-5 — `.kg-huntcard`-style buttons, `RoleBadge`/`DogCard` footer buttons, `BayedEventModal`, results card — all via their rendered text/roles, same style the existing smoke test already uses (`page.getByRole`, `.kg-card`, etc.)

The mini-game's timing makes a scripted "win" unreliable to assert on (the whole point of Task 5's manual check was confirming it can go either way). This test drives the **Call Off** path instead — it's the shortest route that still exercises setup, search, the live tick loop, and the bayed event, which is where a cross-file signature mismatch would actually show up as a console error.

- [ ] **Step 1: Add the group-hunt pass**

In `scripts/smoke-test.mjs`, after the existing tab-clicking loop (before `await browser.close();`, currently around line 73):

```js
  // Group hunt: pick a bay dog and a catch dog, start the hunt, wait for the
  // bay (search ticks are randomized but forced to resolve inside
  // MAX_SEARCH_TICKS * SEARCH_TICK_MS ~= 30s — see grouphunt.jsx), then call
  // off rather than trying to script the timing-based catch mini-game.
  await page.locator(".kg-tab", { hasText: /hunt/i }).first().click();
  await page.waitForTimeout(300);
  const bayButtons = page.getByRole("button", { name: /add as bay dog/i });
  const catchButtons = page.getByRole("button", { name: /add as catch dog/i });
  if (await bayButtons.count() && await catchButtons.count()) {
    await bayButtons.first().click();
    await catchButtons.first().click();
    await page.waitForTimeout(200);
    const headOutBtn = page.getByRole("button", { name: /head out/i });
    if (await headOutBtn.count()) {
      await headOutBtn.first().click();
      const bayedHeading = page.getByText(/HOG BAYED/i);
      await bayedHeading.waitFor({ timeout: 35000 });
      const callOffBtn = page.getByRole("button", { name: /call off/i });
      await callOffBtn.first().click();
      await page.waitForTimeout(300);
      const backBtn = page.getByRole("button", { name: /back to the kennel/i });
      if (await backBtn.count()) { await backBtn.first().click(); await page.waitForTimeout(200); }
      console.log("Group hunt: setup -> search -> bayed -> call off -> results completed.");
    } else {
      console.log("Group hunt: not enough eligible dogs to head out — skipping the rest of this pass.");
    }
  } else {
    console.log("Group hunt: no eligible dogs for a fresh kennel — skipping this pass.");
  }
```

- [ ] **Step 2: Run the smoke test**

Run: `npx playwright install chromium` (if not already installed), then `npm run check:smoke`
Expected: `Group hunt: setup -> search -> bayed -> call off -> results completed.` printed, followed by `Smoke test passed: onboarding + every tab loaded with zero console errors.`, exit code 0.

If it times out waiting for `HOG BAYED`, re-check `MAX_SEARCH_TICKS`/`SEARCH_TICK_MS` in `js/grouphunt.jsx` against the `{ timeout: 35000 }` above — the wait must exceed the worst-case search time (`MAX_SEARCH_TICKS * SEARCH_TICK_MS` = 20 × 1500ms = 30s).

- [ ] **Step 3: Run the full CI suite locally**

Run: `npm run check:syntax && npm run test:grouphunt && npm run check:smoke`
Expected: all three pass, confirming the feature is complete and doesn't regress anything else.

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-test.mjs
git commit -m "Extend smoke test to drive a full group hunt through the call-off path"
```

---

## Post-plan note

Trackers and the "dog gets lost mid-hunt" system are deliberately not part of this plan — see the spec's "Explicitly out of scope" section. Once this ships and gets played, that's a separate brainstorming pass.
