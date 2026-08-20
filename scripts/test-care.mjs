// scripts/test-care.mjs
// Unit tests for the phase 5 care rules — personality, mood and vaccination.
// Same vm-sandbox approach as test-grouphunt.mjs: these files have no
// import/export (the game loads them as global <script> tags), so they get
// Babel-transformed and evaluated into a sandbox in real load order.
//
// These rules are pure functions of a dog and an item, which is exactly the
// kind of thing that should not need a browser to check.
import { transformSync } from "@babel/core";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = process.cwd();
const LOAD_ORDER = ["data.jsx", "genetics.jsx", "simulation.jsx"];

const React = { useState: () => {}, useEffect: () => {}, useCallback: () => {}, useRef: () => {} };
const sandbox = { console, Math, Object, Array, Date, JSON, Boolean, String, Number, React };
vm.createContext(sandbox);
for (const f of LOAD_ORDER) {
  const file = path.join(ROOT, "js", f);
  const code = transformSync(fs.readFileSync(file, "utf8"), { presets: ["@babel/preset-react"], filename: file }).code;
  vm.runInContext(code, sandbox, { filename: file });
}

// Top-level `const` in a script creates a lexical binding, not a property of
// the global object, so these are not reachable by destructuring the sandbox.
// Same trick test-grouphunt.mjs uses: hand them out from inside.
vm.runInContext(`
  globalThis.CARE = { ITEMS, PERSONALITIES, PERSONALITY_KEYS, MOOD_MAX, MOOD_DECAY_PER_DAY };
`, sandbox);
const { ITEMS, PERSONALITIES, PERSONALITY_KEYS, MOOD_MAX } = sandbox.CARE;
// Function declarations do land on the global object, so these come straight off.
const { applyItem, personalityOf, moodOf, isVaccinated, moodMultiplier } = sandbox;

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`OK    ${name}`); }
  catch (e) { failed++; console.error(`FAIL  ${name}`); console.error(`      ${e.message}`); }
}

const toyFor = (type) => Object.keys(ITEMS).find((k) => ITEMS[k].cat === "toy" && ITEMS[k].forPersonality === type);
const dogWith = (type, extra = {}) => ({ id: "test-dog", name: "Test", personality: type, mood: 0, stats: {}, ...extra });

test("every personality has a toy made for it", () => {
  for (const type of PERSONALITY_KEYS) {
    assert.ok(toyFor(type), `no toy targets the ${type} personality`);
  }
});

test("the right toy is worth twice the wrong one", () => {
  const dog = dogWith("bold");
  const right = applyItem(dog, toyFor("bold"), {}, 1, 1);
  const wrong = applyItem(dog, toyFor("steady"), {}, 1, 1);
  assert.ok(right.dog.mood > wrong.dog.mood, "matched toy should give more mood");
  assert.equal(right.dog.mood, wrong.dog.mood * 2, "mismatch should be exactly half");
});

test("the wrong toy still does something", () => {
  const dog = dogWith("bold");
  const wrong = applyItem(dog, toyFor("steady"), {}, 1, 1);
  assert.ok(wrong.dog.mood > 0, "a mismatched toy that did nothing would read as a bug");
});

test("a mismatch says so rather than passing silently", () => {
  const dog = dogWith("bold");
  const wrong = applyItem(dog, toyFor("steady"), {}, 1, 1);
  assert.match(wrong.msg, /half/i, "the message should tell the player why it was worth less");
});

test("mood is capped rather than stacking without limit", () => {
  let dog = dogWith("bold", { mood: MOOD_MAX - 1 });
  for (let i = 0; i < 5; i++) dog = applyItem(dog, toyFor("bold"), {}, 1, 1).dog;
  assert.equal(dog.mood, MOOD_MAX);
});

test("personality is stable for a given dog and spread across types", () => {
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    const d = { id: "dog-" + i };
    const a = personalityOf(d), b = personalityOf(d);
    assert.equal(a, b, "same dog must always get the same personality");
    assert.ok(PERSONALITIES[a], `${a} is not a real personality`);
    seen.add(a);
  }
  assert.equal(seen.size, PERSONALITY_KEYS.length, "every personality should turn up across 400 dogs");
});

test("an explicit personality wins over the derived one", () => {
  assert.equal(personalityOf({ id: "dog-1", personality: "wary" }), "wary");
});

test("mood bends performance without dominating it", () => {
  const low = moodMultiplier({ mood: 0 });
  const high = moodMultiplier({ mood: MOOD_MAX });
  assert.ok(low < 1 && high > 1, "mood should cut both ways");
  assert.ok(high / low < 1.2, "mood must not outweigh the stats a dog was bred for");
});

test("vaccination lapses on its own", () => {
  const dog = { vaccinatedUntilDay: 100 };
  assert.equal(isVaccinated(dog, 99), true);
  assert.equal(isVaccinated(dog, 100), true, "still good on the last day");
  assert.equal(isVaccinated(dog, 101), false, "lapsed the day after");
  assert.equal(isVaccinated({}, 1), false, "never vaccinated is not vaccinated");
});

test("a vaccination is dated from the day it is given", () => {
  const dog = dogWith("bold");
  const res = applyItem(dog, "vaccine", {}, 1, 500);
  assert.equal(res.dog.vaccinatedUntilDay, 500 + ITEMS.vaccine.vaccinates);
  assert.equal(isVaccinated(res.dog, 500 + ITEMS.vaccine.vaccinates), true);
  assert.equal(isVaccinated(res.dog, 500 + ITEMS.vaccine.vaccinates + 1), false);
});

test("moodOf treats an old dog with no mood field as content", () => {
  assert.equal(moodOf({ id: "x" }), MOOD_MAX);
});

process.exit(failed ? 1 : 0);
