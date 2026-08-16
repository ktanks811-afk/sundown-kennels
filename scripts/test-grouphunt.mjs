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

const React = { useState: () => {}, useEffect: () => {}, useCallback: () => {}, useRef: () => {} };
const ReactDOM = { createRoot: () => ({}) };
const sandbox = { console, Math, Object, Array, Date, JSON, Boolean, String, Number, React, ReactDOM };
vm.createContext(sandbox);
for (const f of LOAD_ORDER) {
  const file = path.join(ROOT, "js", f);
  const code = transformSync(fs.readFileSync(file, "utf8"), { presets: ["@babel/preset-react"], filename: file }).code;
  vm.runInContext(code, sandbox, { filename: file });
}

// After loading grouphunt.jsx, run code in the sandbox that exposes constants
// by assigning them to a global getter function that the test harness can access
vm.runInContext(`
  globalThis.CONSTANTS = {
    BAY_WEIGHTS, CATCH_WEIGHTS, GROUP_HUNT_LIMITS, HUNT_ZONES, CAMP_ZONE,
    SEARCH_TICK_MS, MAX_SEARCH_TICKS, TRAVEL_TICKS,
    MINIGAME_START_METER, MINIGAME_MAX_ROUNDS
  };
`, sandbox);

// Copy constants from the globalThis.CONSTANTS object to sandbox
Object.assign(sandbox, sandbox.CONSTANTS);

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
