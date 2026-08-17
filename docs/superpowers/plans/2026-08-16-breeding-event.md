# Staged Breeding Event (Dogs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the instant "click Breed → litter appears" flow with a real staged pregnancy: breeding starts a 14-day gestation, and when it completes — during any day-advancing action, on any tab — a birth event fires, usually routine but sometimes a real complication decision, before the litter reveals.

**Architecture:** Complete a half-built feature already in the codebase — `pregnantDaysLeft` and `pendingWhelps` already exist in `tick()` (`js/game.jsx`) but nothing ever sets them. Genetics are still rolled once, immediately, at the moment breeding is committed (litter, complication risk, and vet cost are all frozen into a `pendingPregnancy` payload on the dam at that instant) — only the *reveal* is delayed until the gestation countdown reaches zero. A birth event with two possible outcomes (routine reveal, or a complication decision reusing the hunt's existing decision-modal pattern) sits between "pregnancy ends" and "the existing `LitterPicker` reveal screen," which is otherwise unchanged.

**Tech Stack:** React 18 + Babel-in-browser (no bundler, no imports — global script scope, same as every file in `js/`). Node's built-in `vm`/`assert` for unit-testing the new pure logic (same technique `scripts/test-grouphunt.mjs` already established — no new npm dependency).

**Spec:** `docs/superpowers/specs/2026-08-16-breeding-event-design.md`

## Global Constraints

- Genetics are rolled once, at conception, and frozen — never re-rolled at birth.
- The birth event is a real decision (assist vs. vet), not a timing mini-game — reuse the hunt's existing `kg-modal-backdrop`/`kg-modal` decision pattern (see `BayedEventModal`, `js/components.jsx`), not a new interaction mechanic.
- A pregnant dam becomes unavailable for hunting/trials as well as breeding for the duration.
- Stud service and accepted AI breeding requests go through the same pipeline as player breeding — one gestation/birth system, not several.
- No bundler, no new npm dependencies, no import/export — global script scope, `<script>` tags in `index.html` in dependency order.
- Reuse existing systems: `tick()`/`update()`/`addLog()`, the existing `LitterPicker` reveal screen, the existing inbreeding/merle/MSTN warning notes already built by `breedPuppies()`, the existing modal CSS classes.
- `GESTATION_DAYS = 14`, `COMPLICATION_BASE_CHANCE = 0.15` — exact values from the spec.

---

### Task 1: Pure logic — complication chance, gestation constants, eligibility gating

**Files:**
- Modify: `js/simulation.jsx` (add constants, `complicationChance()`, gate `canHunt`, extend `statusOf`)
- Modify: `js/simulation.jsx` (migration — see Step 6)
- Create: `scripts/test-breeding-event.mjs`
- Modify: `package.json` (add `test:breeding` script)

**Interfaces:**
- Consumes: `clamp(v, lo=0, hi=100)`, `randInt(min, max)` (`js/genetics.jsx`); existing `canHunt`, `statusOf`, `isRetired`, `agePrime` (`js/simulation.jsx`)
- Produces (used by later tasks): `GESTATION_DAYS`, `COMPLICATION_BASE_CHANCE` constants; `complicationChance(dam, inbred, litterSize): number` (0-0.6); updated `canHunt(dog): boolean` (now excludes pregnant dogs); updated `statusOf(dog)` (now shows a day countdown while pregnant)

- [ ] **Step 1: Write the failing test file**

Create `scripts/test-breeding-event.mjs`. Like `test-grouphunt.mjs`, it Babel-transforms and vm-sandboxes `data.jsx`, `genetics.jsx`, `simulation.jsx` in load order (needs `genetics.jsx` for `clamp`/`randInt`, and needs the same `React` stub + `globalThis.CONSTANTS` re-export trick `test-grouphunt.mjs` already uses, since `data.jsx` destructures `React` at its top and this file's top-level `const`s otherwise wouldn't attach to the vm context object):

```js
// scripts/test-breeding-event.mjs
// Unit tests for the pure breeding-event logic added to simulation.jsx.
// Same vm-sandbox technique as scripts/test-grouphunt.mjs: Babel-transform
// and eval data.jsx/genetics.jsx/simulation.jsx in real load order instead
// of importing them (these files have no import/export — the game loads
// them as global-scope <script> tags).
import { transformSync } from "@babel/core";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = process.cwd();
const LOAD_ORDER = ["data.jsx", "genetics.jsx", "simulation.jsx"];

const React = { useState: () => {}, useEffect: () => {}, useCallback: () => {}, useRef: () => {} };
const ReactDOM = { createRoot: () => ({}) };
const sandbox = { console, Math, Object, Array, Date, JSON, Boolean, String, Number, React, ReactDOM };
vm.createContext(sandbox);

// simulation.jsx (and every later file) reference top-level `const`s from
// earlier files as bare globals in the browser's shared script scope, but
// vm.runInContext does NOT attach top-level const/let bindings to the
// context object (only function declarations do) — so re-expose them
// explicitly the same way test-grouphunt.mjs does, via a wrapper that
// assigns every const this file needs onto globalThis.CONSTANTS, then
// copies that onto the sandbox before the next file runs.
for (const f of LOAD_ORDER) {
  const file = path.join(ROOT, "js", f);
  let code = transformSync(fs.readFileSync(file, "utf8"), { presets: ["@babel/preset-react"], filename: file }).code;
  vm.runInContext(code, sandbox, { filename: file });
}
// After data.jsx + genetics.jsx + simulation.jsx have run, pull out every
// name this test needs directly via a final small eval that assigns them
// onto a return object — simplest way to recover top-level consts/functions
// a vm context doesn't expose on its own.
const exported = vm.runInContext(
  "({ GESTATION_DAYS, COMPLICATION_BASE_CHANCE, complicationChance, canHunt, statusOf, clamp, randInt })",
  sandbox
);

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`OK    ${name}`); }
  catch (e) { failed++; console.error(`FAIL  ${name}`); console.error(`      ${e.message}`); }
}

const healthyDam = { health: 90 };
const weakDam = { health: 50 };

test("complicationChance is the base rate for a healthy, non-inbred, small litter", () => {
  const c = exported.complicationChance(healthyDam, false, 3);
  assert.equal(c, exported.COMPLICATION_BASE_CHANCE);
});

test("complicationChance rises for an inbred litter", () => {
  const c = exported.complicationChance(healthyDam, true, 3);
  assert.ok(c > exported.COMPLICATION_BASE_CHANCE);
});

test("complicationChance rises for a dam under 70 health", () => {
  const c = exported.complicationChance(weakDam, false, 3);
  assert.ok(c > exported.COMPLICATION_BASE_CHANCE);
});

test("complicationChance rises for a large litter (5+)", () => {
  const c = exported.complicationChance(healthyDam, false, 5);
  assert.ok(c > exported.COMPLICATION_BASE_CHANCE);
});

test("complicationChance stacks all three risk factors and stays clamped to 0.6", () => {
  const c = exported.complicationChance(weakDam, true, 6);
  assert.ok(c <= 0.6);
  assert.equal(c, 0.6); // 0.15 + 0.12 + 0.08 + 0.05 = 0.40, well under the cap — recheck if this fails
});

test("canHunt excludes a pregnant dog even if otherwise fit", () => {
  const dog = { ageDays: 400, health: 90, breedCooldown: 0, injury: null, pregnantDaysLeft: 5 };
  assert.equal(exported.canHunt(dog), false);
});

test("canHunt still passes a non-pregnant dog with the same stats", () => {
  const dog = { ageDays: 400, health: 90, breedCooldown: 0, injury: null, pregnantDaysLeft: 0 };
  assert.equal(exported.canHunt(dog), true);
});

test("statusOf shows the day countdown while pregnant", () => {
  const dog = { health: 90, ageDays: 400, breedCooldown: 0, pregnantDaysLeft: 6, injury: null };
  const s = exported.statusOf(dog);
  assert.equal(s.label, "In whelp — 6d left");
  assert.equal(s.tone, "gold");
});

process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run the test file to verify it fails**

Run: `node scripts/test-breeding-event.mjs`
Expected: crashes or fails — `complicationChance`/`GESTATION_DAYS`/etc. don't exist yet, and `statusOf`'s current "In whelp" label has no day count.

- [ ] **Step 3: Add the constants, `complicationChance`, and gate `canHunt` in `js/simulation.jsx`**

Add near the top of `js/simulation.jsx`, alongside the other constants (e.g. near `AGE_PRIME_START` etc.):

```js
/* Gestation and the birth event that follows it (see game.jsx's doBreed/
   doStudService/doAcceptBreedingRequest and the pendingWhelps flow). */
const GESTATION_DAYS = 14;
const COMPLICATION_BASE_CHANCE = 0.15;

/* Rolled once, at conception, and frozen into the litter's pendingPregnancy
   payload — the birth event just reveals whatever this decided, it never
   re-rolls. Inbreeding, a run-down dam, and a big litter each raise real
   whelping risk. */
function complicationChance(dam, inbred, litterSize) {
  let chance = COMPLICATION_BASE_CHANCE;
  if (inbred) chance += 0.12;
  if (dam.health < 70) chance += 0.08;
  if (litterSize >= 5) chance += 0.05;
  return clamp(chance, 0, 0.6);
}
```

Modify the existing `canHunt` (find `function canHunt(dog) { return dog.ageDays >= 90 && dog.health >= 35 && !isRetired(dog) && !dog.injury; }`):

```js
function canHunt(dog) { return dog.ageDays >= 90 && dog.health >= 35 && !isRetired(dog) && !dog.injury && !(dog.pregnantDaysLeft > 0); }
```

`canBreed` does NOT need a similar change — breeding already sets `breedCooldownDam = 45` (well past the 14-day gestation), so a pregnant dam is already excluded from re-breeding via the existing cooldown check. Adding a redundant `pregnantDaysLeft` check there would be dead code.

`huntableDogs` (used by the Hunt tab, the Trials tab, and the Group Hunt setup screen — all three filter `state.dogs` with `canHunt`) automatically picks up this change everywhere at once.

- [ ] **Step 4: Extend `statusOf` with the day countdown**

Modify the existing line `if (dog.pregnantDaysLeft > 0) return { label: "In whelp", tone: "gold" };` (this line already exists — it's part of the same unused scaffolding `pregnantDaysLeft` itself is):

```js
if (dog.pregnantDaysLeft > 0) return { label: `In whelp — ${dog.pregnantDaysLeft}d left`, tone: "gold" };
```

- [ ] **Step 5: Run the test file to verify it passes**

Run: `node scripts/test-breeding-event.mjs`
Expected: every `OK` line printed, exit code 0. (If the stacked-risk test's exact expected value doesn't match — e.g. `0.15 + 0.12 + 0.08 + 0.05 = 0.40`, which the test asserts equals `0.6` — fix the test's expected value to `0.4`, not the implementation; the `0.6` cap is meant for factor combinations beyond this plan's three, not this specific case. Verify by hand before changing either side.)

- [ ] **Step 6: Add save migration for the new state shape**

In `js/simulation.jsx`'s `migrateState(s)` function, extend the existing dogs-mapping block (find `pregnantDaysLeft: typeof d.pregnantDaysLeft === "number" ? d.pregnantDaysLeft : 0,` inside the `out.dogs = out.dogs.map(...)` call):

```js
if (Array.isArray(out.dogs)) {
  out.dogs = out.dogs.map((d) => ({
    ...d,
    temperament: d.temperament === undefined ? rollTemperament() : d.temperament,
    titles: Array.isArray(d.titles) ? d.titles : [],
    injury: d.injury === undefined ? null : d.injury,
    pregnantDaysLeft: typeof d.pregnantDaysLeft === "number" ? d.pregnantDaysLeft : 0,
    pendingPregnancy: d.pendingPregnancy || null,
  }));
}
if (!Array.isArray(out.pendingWhelps)) out.pendingWhelps = [];
```

(Add the `if (!Array.isArray(out.pendingWhelps))` line right after the `out.dogs` block, before `return out;`.)

- [ ] **Step 7: Wire the test into `package.json`**

```json
    "test:grouphunt": "node scripts/test-grouphunt.mjs",
    "test:breeding": "node scripts/test-breeding-event.mjs"
```

- [ ] **Step 8: Run the full syntax check**

Run: `npm run check:syntax`
Expected: `OK` on all files, exit code 0.

- [ ] **Step 9: Commit**

```bash
git add js/simulation.jsx scripts/test-breeding-event.mjs package.json
git commit -m "Add gestation constants, complication-chance formula, and pregnancy eligibility gating"
```

---

### Task 2: Start a real pregnancy instead of an instant litter

**Files:**
- Modify: `js/game.jsx` (rewrite `doBreed`, extend `tick()`'s `pendingWhelps` construction)

**Interfaces:**
- Consumes from Task 1: `GESTATION_DAYS`, `complicationChance(dam, inbred, litterSize)`
- Consumes existing: `breedPuppies(sire, dam, day, bloodline)`, `computeValue(dog)`, `tick(prev, days, overrides)`, `update(fn)`
- Produces (used by later tasks): the dam's `pendingPregnancy` shape —
  `{ litter, sireId, sireName, label, foundedBloodlineName, note, complication, vetCost }`
  where `litter` is exactly what `breedPuppies()` returns
  (`{ pups, inbred, doubleMerleWarned, bandog, doubleMuscledCount, culledCount, grewBiggerCount }`);
  `state.pendingWhelps: Array<{ damId, damName, pendingPregnancy }>`

This task makes breeding start a pregnancy. It deliberately does NOT yet build the birth-event UI (Task 3) — after this task, a bred dam will correctly show "In whelp — Nd left" and vanish from the hunt-eligible pool, and `tick()` will correctly move her into `state.pendingWhelps` once the countdown reaches zero, but nothing renders that queue yet. That's expected; verify only what this task claims.

- [ ] **Step 1: Rewrite `doBreed` in `js/game.jsx`**

Replace the existing `doBreed` function (`function doBreed() { ... }`, currently ending with `setNewBloodline("");`):

```js
function doBreed() {
  const sire = state.dogs.find((d) => d.id === breedPick.sireId);
  const dam = state.dogs.find((d) => d.id === breedPick.damId);
  if (!sire || !dam) return;
  const foundedName = newBloodline.trim();
  const bloodline = foundedName || sire.bloodline || dam.bloodline || null;
  const litter = breedPuppies(sire, dam, state.day + 1 + GESTATION_DAYS, bloodline);
  let note = "";
  if (foundedName) note += ` Founded the ${foundedName} bloodline.`;
  if (litter.inbred) note += " Close breeding — litter came in below par.";
  if (litter.doubleMerleWarned) note += " At least one double-merle pup — those carry real risk of deafness or vision problems.";
  if (litter.doubleMuscledCount) note += ` ${litter.doubleMuscledCount} double-muscled (MSTN/MSTN) pup${litter.doubleMuscledCount > 1 ? "s" : ""} — dramatic power, less endurance.`;
  if (litter.culledCount) note += ` ${litter.culledCount} pup${litter.culledCount > 1 ? "s" : ""} came out below standard — not every one in a litter makes the grade.`;
  if (litter.grewBiggerCount) note += ` ${litter.grewBiggerCount} pup${litter.grewBiggerCount > 1 ? "s" : ""} threw a growth mutation — noticeably bigger than expected.`;
  const complication = Math.random() < complicationChance(dam, litter.inbred, litter.pups.length);
  const pendingPregnancy = {
    litter, sireId: sire.id, sireName: sire.name, label: `${sire.name} × ${dam.name}`,
    foundedBloodlineName: foundedName || null, note, complication,
    vetCost: Math.round(computeValue(dam) * 0.12),
  };
  update((prev) => {
    let next = tick(prev, 1, { [sire.id]: { cooldownSet: 10, healthDelta: 0 }, [dam.id]: { cooldownSet: 45, healthDelta: -14 } });
    next.dogs = next.dogs.map((d) => (d.id === dam.id ? { ...d, pregnantDaysLeft: GESTATION_DAYS, pendingPregnancy } : d));
    if (foundedName) {
      next.dogs = next.dogs.map((d) => (d.id === sire.id || d.id === dam.id) ? { ...d, bloodline: foundedName } : d);
    }
    return next;
  });
  setBreedPick({ sireId: null, damId: null });
  setNewBloodline("");
}
```

Note the `next.dogs = next.dogs.map(...)` setting `pregnantDaysLeft`/`pendingPregnancy` happens AFTER `tick()` runs, not via `tick()`'s override system — `tick()` already decrements any existing `pregnantDaysLeft` by the day count on every call, so setting it before `tick()` ran would immediately consume one day of the fresh pregnancy on the same click. Setting it after is what makes clicking Breed show the full 14 days, not 13.

- [ ] **Step 2: Extend `tick()`'s `pendingWhelps` construction in `js/game.jsx`**

Find the gestation block inside `tick()`:

```js
      // Gestation.
      let pregnant = d.pregnantDaysLeft;
      if (typeof pregnant === "number" && pregnant > 0) {
        pregnant = pregnant - days;
        if (pregnant <= 0) { whelped.push(d.id); pregnant = 0; }
      }
```

Change `whelped.push(d.id);` to push the richer payload the birth event needs:

```js
      // Gestation.
      let pregnant = d.pregnantDaysLeft;
      let pendingPregnancy = d.pendingPregnancy;
      if (typeof pregnant === "number" && pregnant > 0) {
        pregnant = pregnant - days;
        if (pregnant <= 0) {
          whelped.push({ damId: d.id, damName: d.name, pendingPregnancy: d.pendingPregnancy });
          pregnant = 0;
          pendingPregnancy = null;
        }
      }
```

And update the `aged` object construction just below (find `const aged = { ...d, ageDays: d.ageDays + days, health: clamp(health), breedCooldown: cooldown, injury, pregnantDaysLeft: pregnant };`) to also carry the now-possibly-cleared `pendingPregnancy`:

```js
      const aged = { ...d, ageDays: d.ageDays + days, health: clamp(health), breedCooldown: cooldown, injury, pregnantDaysLeft: pregnant, pendingPregnancy };
```

`next.pendingWhelps = whelped;` (a few lines below, unchanged) now assigns the richer array.

- [ ] **Step 3: Run the syntax check**

Run: `npm run check:syntax`
Expected: OK on all files.

- [ ] **Step 4: Manual verification**

Serve the game (`python -m http.server 8000` or `./serve.sh`), get through onboarding, go to Breed, pick a sire and dam, click Breed. Confirm: no litter appears immediately; going to the Kennel tab (or wherever dog cards render), the dam now shows a gold "In whelp — 14d left" badge; going to the Hunt tab, the dam is no longer in the huntable-dogs list; going to Trials, same. Advance one day (e.g. Rest a Week, or send another dog on a hunt) and confirm the badge now reads "In whelp — 13d left" (or 7 days fewer if you used Rest a Week).

- [ ] **Step 5: Commit**

```bash
git add js/game.jsx
git commit -m "Make breeding start a real 14-day pregnancy instead of an instant litter"
```

---

### Task 3: The birth event — routine reveal and the complication decision

**Files:**
- Modify: `js/components.jsx` (add `BirthEventModal`)
- Modify: `js/game.jsx` (reveal/resolve handlers, render wiring in both layout returns)

**Interfaces:**
- Consumes from Task 2: `state.pendingWhelps`, dam's `pendingPregnancy` shape
- Consumes existing: `pendingLitter`/`setPendingLitter`, `selectedPupIds`/`setSelectedPupIds`, `dogCapacity`, `fmtMoney`, `addLog`, `clamp`, `randInt`
- Produces (used by Task 4): `startPregnancyPayload(dam, litter, note, label, sireId, sireName, foundedBloodlineName)` — factored out of `doBreed`'s pregnancy-construction logic so Task 4's `doStudService`/`doAcceptBreedingRequest` can build the same shape without duplicating it.

This task completes the loop for player breeding end to end: setup → 14-day wait → birth event (routine or complication) → the existing `LitterPicker` reveal.

- [ ] **Step 1: Factor `doBreed`'s pregnancy-payload construction into a shared helper**

In `js/game.jsx`, extract the payload-building block from Task 2's `doBreed` into a standalone function (add it above `doBreed`):

```js
function startPregnancyPayload(dam, litter, note, label, sireId, sireName, foundedBloodlineName) {
  const complication = Math.random() < complicationChance(dam, litter.inbred, litter.pups.length);
  return {
    litter, sireId, sireName, label, foundedBloodlineName, note, complication,
    vetCost: Math.round(computeValue(dam) * 0.12),
  };
}
```

Update `doBreed` to call it instead of building the object inline:

```js
function doBreed() {
  const sire = state.dogs.find((d) => d.id === breedPick.sireId);
  const dam = state.dogs.find((d) => d.id === breedPick.damId);
  if (!sire || !dam) return;
  const foundedName = newBloodline.trim();
  const bloodline = foundedName || sire.bloodline || dam.bloodline || null;
  const litter = breedPuppies(sire, dam, state.day + 1 + GESTATION_DAYS, bloodline);
  let note = "";
  if (foundedName) note += ` Founded the ${foundedName} bloodline.`;
  if (litter.inbred) note += " Close breeding — litter came in below par.";
  if (litter.doubleMerleWarned) note += " At least one double-merle pup — those carry real risk of deafness or vision problems.";
  if (litter.doubleMuscledCount) note += ` ${litter.doubleMuscledCount} double-muscled (MSTN/MSTN) pup${litter.doubleMuscledCount > 1 ? "s" : ""} — dramatic power, less endurance.`;
  if (litter.culledCount) note += ` ${litter.culledCount} pup${litter.culledCount > 1 ? "s" : ""} came out below standard — not every one in a litter makes the grade.`;
  if (litter.grewBiggerCount) note += ` ${litter.grewBiggerCount} pup${litter.grewBiggerCount > 1 ? "s" : ""} threw a growth mutation — noticeably bigger than expected.`;
  const pendingPregnancy = startPregnancyPayload(dam, litter, note, `${sire.name} × ${dam.name}`, sire.id, sire.name, foundedName || null);
  update((prev) => {
    let next = tick(prev, 1, { [sire.id]: { cooldownSet: 10, healthDelta: 0 }, [dam.id]: { cooldownSet: 45, healthDelta: -14 } });
    next.dogs = next.dogs.map((d) => (d.id === dam.id ? { ...d, pregnantDaysLeft: GESTATION_DAYS, pendingPregnancy } : d));
    if (foundedName) {
      next.dogs = next.dogs.map((d) => (d.id === sire.id || d.id === dam.id) ? { ...d, bloodline: foundedName } : d);
    }
    return next;
  });
  setBreedPick({ sireId: null, damId: null });
  setNewBloodline("");
}
```

- [ ] **Step 2: Add `BirthEventModal` to `js/components.jsx`**

Append after `BayedEventModal`:

```jsx
function BirthEventModal({ damName, vetCost, onAssist, onVet }) {
  return (
    <div className="kg-modal-backdrop">
      <div className="kg-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="kg-modal__head"><h2>🐾 Complications</h2></div>
        <p>{damName} is having a rough whelping.</p>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button className="kg-btn kg-btn--ghost" onClick={onAssist}>Assist personally — free, real risk</button>
          <button className="kg-btn kg-btn--gold" onClick={onVet}>Call the vet — {fmtMoney(vetCost)}</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add the reveal/resolve handlers to `js/game.jsx`**

Add after `doBreed`:

```js
function revealWhelp(due) {
  update((prev) => ({ ...prev, pendingWhelps: prev.pendingWhelps.filter((w) => w.damId !== due.damId) }));
  const room = Math.max(0, dogCapacity - state.dogs.length);
  const { litter, label, note } = due.pendingPregnancy;
  setPendingLitter({ pups: litter.pups, room, note: note + " Whelped safely.", label });
  setSelectedPupIds(litter.pups.slice(0, room).map((p) => p.id));
}

function resolveBirthEvent(due, choice) {
  const { pendingPregnancy } = due;
  const successChance = choice === "vet" ? 0.95 : 0.6;
  const success = Math.random() < successChance;
  let pups = pendingPregnancy.litter.pups;
  let outcomeNote = "";
  let healthDelta = 0;
  if (!success) {
    healthDelta = -randInt(15, 30);
    if (pups.length > 1) {
      const dropIdx = randInt(0, pups.length - 1);
      pups = pups.filter((_, i) => i !== dropIdx);
      outcomeNote = " Lost one pup to complications during whelping.";
    } else {
      outcomeNote = " A rough whelping, but she pulled through.";
    }
  }
  const cost = choice === "vet" ? pendingPregnancy.vetCost : 0;
  update((prev) => {
    let next = { ...prev, pendingWhelps: prev.pendingWhelps.filter((w) => w.damId !== due.damId) };
    if (healthDelta) next.dogs = next.dogs.map((d) => (d.id === due.damId ? { ...d, health: clamp(d.health + healthDelta) } : d));
    if (cost) next.cash = Math.round((next.cash - cost) * 100) / 100;
    return next;
  });
  const room = Math.max(0, dogCapacity - state.dogs.length);
  const assistOutcome = choice === "vet" ? ` Called the vet (${fmtMoney(cost)}).` : success ? " Assisted personally — went fine." : " Assisted personally — rough go of it.";
  setPendingLitter({ pups, room, note: pendingPregnancy.note + outcomeNote + assistOutcome, label: pendingPregnancy.label });
  setSelectedPupIds(pups.slice(0, room).map((p) => p.id));
}
```

- [ ] **Step 4: Wire the render logic in `js/game.jsx`**

Add a `useEffect` near the other effects (this drives the *routine* path — no complication, no decision needed, straight to the litter reveal; the complication path is driven by JSX below, not this effect, since it needs a button click first):

```js
useEffect(() => {
  if (!state || !state.pendingWhelps || state.pendingWhelps.length === 0) return;
  if (pendingLitter) return; // one reveal slot at a time — wait for the current one to clear
  const due = state.pendingWhelps[0];
  if (due.pendingPregnancy.complication) return; // needs a decision — rendered as a modal below instead
  revealWhelp(due);
}, [state && state.pendingWhelps, pendingLitter]);
```

In BOTH of the two top-level layout returns (search for `<LitterPicker litter={pendingLitter}` — it appears twice, once in the "frame" layout return and once in the "classic/sidebar" layout return; add the same line right after each), add:

```jsx
{state.pendingWhelps && state.pendingWhelps.length > 0 && !pendingLitter && state.pendingWhelps[0].pendingPregnancy.complication && (
  <BirthEventModal damName={state.pendingWhelps[0].damName} vetCost={state.pendingWhelps[0].pendingPregnancy.vetCost}
    onAssist={() => resolveBirthEvent(state.pendingWhelps[0], "assist")}
    onVet={() => resolveBirthEvent(state.pendingWhelps[0], "vet")} />
)}
```

- [ ] **Step 5: Run the syntax check**

Run: `npm run check:syntax`
Expected: OK on all files.

- [ ] **Step 6: Manual verification — routine path**

Serve the game, breed a pair, then advance 14 days as cheaply as possible (repeated "Rest a Week" clicks, or send the sire hunting/training repeatedly — anything that calls a day-advancing action). Confirm: once the countdown reaches zero, the `LitterPicker` reveal screen appears automatically (no modal, since most litters are routine), the note ends in "Whelped safely.", and confirming the litter works exactly as before.

- [ ] **Step 7: Manual verification — complication path**

Complications are probabilistic (~15%+ base), so force one for testing: temporarily change `COMPLICATION_BASE_CHANCE` in `js/simulation.jsx` to `1` (100%), breed a pair, advance 14 days, confirm the `🐾 Complications` modal appears with "Assist personally" and "Call the vet" buttons showing the correct cost. Click each in separate test runs and confirm: Assist costs nothing but can reduce the dam's health and occasionally drop a pup; Call the vet deducts the shown cost from cash and rarely fails. After both are verified, **revert `COMPLICATION_BASE_CHANCE` back to `0.15`** — do not leave the test value committed.

- [ ] **Step 8: Run `test:breeding` and the full syntax check again post-revert**

Run: `npm run test:breeding && npm run check:syntax`
Expected: both pass, confirming `COMPLICATION_BASE_CHANCE` is back to its real value (the Task 1 tests assert against `exported.COMPLICATION_BASE_CHANCE` directly, so this doesn't catch a wrong *value* on its own — additionally grep the file to confirm: `grep "COMPLICATION_BASE_CHANCE = " js/simulation.jsx` should show `0.15`, not `1`).

- [ ] **Step 9: Commit**

```bash
git add js/components.jsx js/game.jsx
git commit -m "Add the birth event: routine auto-reveal and a real complication decision"
```

---

### Task 4: Extend to stud service and AI breeding requests

**Files:**
- Modify: `js/game.jsx` (`doStudService`, `doAcceptBreedingRequest`)

**Interfaces:**
- Consumes from Task 3: `startPregnancyPayload(dam, litter, note, label, sireId, sireName, foundedBloodlineName)`

This is the task that actually satisfies "same pipeline" from the spec — without it, only player-initiated breeding goes through gestation, while stud service and AI breeding requests would still whelp instantly, which would look like two different, inconsistent systems side by side.

- [ ] **Step 1: Rewrite `doStudService`**

Replace the existing `doStudService` function:

```js
function doStudService(dam, stud) {
  const fee = studFee(stud);
  if (state.cash < fee) return;
  const bloodline = dam.bloodline || null;
  const litter = breedPuppies(stud, dam, state.day + 1 + GESTATION_DAYS, bloodline);
  let note = litter.doubleMerleWarned ? " At least one double-merle pup — risk of deafness or vision problems." : "";
  if (litter.doubleMuscledCount) note += ` ${litter.doubleMuscledCount} double-muscled (MSTN/MSTN) pup${litter.doubleMuscledCount > 1 ? "s" : ""} — dramatic power, less endurance.`;
  if (litter.culledCount) note += ` ${litter.culledCount} pup${litter.culledCount > 1 ? "s" : ""} came out below standard — not every one in a litter makes the grade.`;
  if (litter.grewBiggerCount) note += ` ${litter.grewBiggerCount} pup${litter.grewBiggerCount > 1 ? "s" : ""} threw a growth mutation — noticeably bigger than expected.`;
  const label = `${dam.name} × ${stud.name} out of ${stud.kennelName} (stud fee ${fmtMoney(fee)})`;
  const pendingPregnancy = startPregnancyPayload(dam, litter, note, label, null, stud.name, null);
  update((prev) => {
    let next = tick(prev, 1, { [dam.id]: { cooldownSet: 45, healthDelta: -14 } });
    next.cash = Math.round((next.cash - fee) * 100) / 100;
    next.dogs = next.dogs.map((d) => (d.id === dam.id ? { ...d, pregnantDaysLeft: GESTATION_DAYS, pendingPregnancy } : d));
    return next;
  });
  setStudDamId(null);
}
```

(`sireId: null` is correct here — the stud belongs to another kennel and was never in `state.dogs`, so there's no local id to store; `sireName` alone is enough for display, same as the original code only ever used `stud.name`, never `stud.id`, in its label.)

- [ ] **Step 2: Rewrite `doAcceptBreedingRequest`**

Replace the existing `doAcceptBreedingRequest` function. Note this changes existing behavior in one respect, worth calling out: the current version adds pups directly to `state.dogs` with no capacity/room check at all (every other breeding path in the game already checks room) — routing this through the same `pendingLitter`/`LitterPicker` reveal as everything else fixes that inconsistency as a side effect, not a separate task:

```js
function doAcceptBreedingRequest(offer) {
  const target = state.dogs.find((d) => d.id === offer.targetDogId);
  if (!target) { doDeclineOffer(offer.id); return; }
  const sire = target.sex === "M" ? target : offer.requesterDog;
  const dam = target.sex === "F" ? target : offer.requesterDog;
  const litter = breedPuppies(sire, dam, state.day + 1 + GESTATION_DAYS, target.bloodline || null);
  let note = ` Paid a breeding fee of ${fmtMoney(offer.fee)}.`;
  if (litter.doubleMerleWarned) note += " At least one double-merle pup — risk of deafness or vision problems.";
  if (litter.grewBiggerCount) note += ` ${litter.grewBiggerCount} pup${litter.grewBiggerCount > 1 ? "s" : ""} threw a growth mutation.`;
  const label = `${offer.kennelName} bred their ${offer.requesterDog.name} with your ${target.name}`;
  const pendingPregnancy = startPregnancyPayload(target, litter, note, label, null, offer.requesterDog.name, null);
  update((prev) => {
    let next = tick(prev, 1, { [target.id]: { cooldownSet: 45, healthDelta: -14 } });
    next.cash = Math.round(next.cash + offer.fee);
    next.offers = next.offers.filter((o) => o.id !== offer.id);
    next.dogs = next.dogs.map((d) => (d.id === target.id ? { ...d, pregnantDaysLeft: GESTATION_DAYS, pendingPregnancy } : d));
    return next;
  });
}
```

(`target` is always the player's own dog regardless of sex — `startPregnancyPayload`'s first argument must be the dam whose `pendingDaysLeft`/`pendingPregnancy` gets set, i.e. `target`, not necessarily `dam` — if `target.sex === "M"`, `target` is the sire and `offer.requesterDog` is the dam, but the PLAYER's dog (`target`) is still the one that needs to carry the pregnancy fields on `state.dogs` since `offer.requesterDog` isn't in `state.dogs` at all. This matches the code above: `startPregnancyPayload(target, litter, ...)` and the `next.dogs` map key on `target.id`, regardless of which sex `target` is — biologically odd if `target` is male, but this mirrors how the *existing* code already always applied the cooldown/health cost to `target` regardless of sex, so it's consistent with established behavior, not a new inconsistency.)

- [ ] **Step 3: Run the syntax check**

Run: `npm run check:syntax`
Expected: OK on all files.

- [ ] **Step 4: Manual verification**

Serve the game. For stud service: go to Breed → stud board, book a stud, confirm the dam shows "In whelp" immediately and cash was deducted, then advance 14 days and confirm the litter reveals through the same flow as Task 3's verification. For AI breeding requests: these arrive as random offers over time and aren't reliably triggerable on demand — read the code change carefully instead, and if an offer happens to appear during testing, accept it and confirm the same pregnancy-then-reveal behavior.

- [ ] **Step 5: Commit**

```bash
git add js/game.jsx
git commit -m "Route stud service and AI breeding requests through the same pregnancy pipeline"
```

---

### Task 5: Extend the Playwright smoke test

**Files:**
- Modify: `scripts/smoke-test.mjs`

**Interfaces:**
- Consumes: the finished feature from Tasks 1-4 — dog card status badges, the Breed tab's picker UI, `pendingWhelps`-driven reveal, all via rendered text/roles, same style the existing smoke test already uses.

- [ ] **Step 1: Add the breeding-event pass**

In `scripts/smoke-test.mjs`, after the existing group-hunt pass added previously (before `await browser.close();`):

```js
  // Breeding event: breed the two starter dogs (guaranteed present and of
  // opposite sex from onboarding), then advance days until the pregnancy
  // resolves. GESTATION_DAYS is 14 — "Rest a Week" advances 7 days per
  // click, so two clicks covers it with margin. Complications are
  // probabilistic; this pass accepts either outcome (auto-reveal or the
  // modal) rather than forcing one, since forcing would require a
  // production-code test hook this plan doesn't introduce.
  await page.locator(".kg-tab", { hasText: /breed/i }).first().click();
  await page.waitForTimeout(300);
  const sireSelect = page.locator("select").first();
  const damSelect = page.locator("select").nth(1);
  if (await sireSelect.count() && await damSelect.count()) {
    const sireOpts = await sireSelect.locator("option").allTextContents();
    const damOpts = await damSelect.locator("option").allTextContents();
    if (sireOpts.length > 1 && damOpts.length > 1) {
      await sireSelect.selectOption({ index: 1 });
      await damSelect.selectOption({ index: 1 });
      const breedBtn = page.getByRole("button", { name: /^Breed /i });
      if (await breedBtn.count()) {
        await breedBtn.first().click();
        await page.waitForTimeout(300);
        // Advance past the 14-day gestation via Rest a Week.
        const restBtn = page.getByRole("button", { name: /rest a week/i });
        for (let i = 0; i < 3 && (await restBtn.count()); i++) {
          await restBtn.first().click();
          await page.waitForTimeout(300);
        }
        // Resolve a complication if one came up, otherwise the litter
        // picker should already be open.
        const assistBtn = page.getByRole("button", { name: /assist personally/i });
        if (await assistBtn.count()) { await assistBtn.first().click(); await page.waitForTimeout(300); }
        const confirmBtn = page.getByRole("button", { name: /^(Confirm|Continue)/i });
        if (await confirmBtn.count()) { await confirmBtn.first().click(); await page.waitForTimeout(300); }
        console.log("Breeding event: pregnancy -> (routine or complication) -> litter reveal completed.");
      } else {
        console.log("Breeding event: no eligible pair on a fresh kennel — skipping this pass.");
      }
    } else {
      console.log("Breeding event: not enough breeding-age dogs yet — skipping this pass.");
    }
  }
```

- [ ] **Step 2: Run the smoke test**

Run: `npm run check:smoke`
Expected: `Breeding event: pregnancy -> (routine or complication) -> litter reveal completed.` printed, followed by the existing final pass line, exit code 0.

- [ ] **Step 3: Run the full local CI suite**

Run: `npm run check:syntax && npm run test:grouphunt && npm run test:breeding && npm run check:smoke`
Expected: all four pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-test.mjs
git commit -m "Extend smoke test to drive a full breeding event through to litter reveal"
```
