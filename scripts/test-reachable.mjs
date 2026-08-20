// scripts/test-reachable.mjs
//
// Every screen that has a route must be reachable from every layout.
//
// This exists because ten screens - everything built across four phases -
// were reachable only from the homestead layout. Anyone still on the frame or
// sidebar layout could not get to Search, the Arcade, the Bank, the Clinics,
// the care checklist, Achievements, the breed Registries, or three of the
// ranch tabs. Nothing went red, because each screen worked perfectly once you
// arrived: there was simply no way to arrive.
//
// The smoke test already checks the other direction - that every nav
// destination leads to a real route. This is the mirror of it, and the pair
// close the loop: no route without a door, no door without a route.
import { transformSync } from "@babel/core";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = process.cwd();
const React = { useState: () => {}, useEffect: () => {}, useCallback: () => {}, useRef: () => {} };
const sandbox = { console, Math, Object, Array, Date, JSON, Boolean, String, Number, React };
vm.createContext(sandbox);
for (const f of ["data.jsx", "router.jsx"]) {
  const file = path.join(ROOT, "js", f);
  vm.runInContext(
    transformSync(fs.readFileSync(file, "utf8"), { presets: ["@babel/preset-react"], filename: file }).code,
    sandbox, { filename: file });
}
vm.runInContext(`
  globalThis.NAVDATA = { ROUTES, MENUS, NAV, ATLAS_MENU, HOME_NAV, MARKET_NAV, RANCH_TABS, HOME_QUICK_LINKS, LAYOUTS };
`, sandbox);
const D = sandbox.NAVDATA;

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`OK    ${name}`); }
  catch (e) { failed++; console.error(`FAIL  ${name}`); console.error(`      ${e.message}`); }
}

// Admin is deliberately hidden until a code is entered, so it is exempt.
const HIDDEN = new Set(["admin"]);
const routed = [...new Set(
  D.ROUTES.filter((r) => !r.alias && r.path.indexOf(":") === -1).map((r) => r.screen)
)].filter((s) => !HIDDEN.has(s)).sort();

function reachableFrom(layout) {
  const seen = new Set();
  if (layout === "frame") {
    D.MENUS.forEach((m) => m.columns.forEach((c) => c.items.forEach((i) => seen.add(i.id))));
  } else if (layout === "classic") {
    D.NAV.forEach((n) => { seen.add(n.id); (n.children || []).forEach((c) => seen.add(c.id)); });
  } else {
    D.HOME_NAV.forEach((n) => n.tab && seen.add(n.tab));
    D.ATLAS_MENU.forEach((c) => c.items.forEach((i) => seen.add(i.id)));
    D.MARKET_NAV.forEach((g) => g.items.forEach((i) => seen.add(i.id)));
    D.RANCH_TABS.forEach((t) => seen.add(t.id));
    D.HOME_QUICK_LINKS.forEach((l) => seen.add(l.id));
  }
  return seen;
}

test("there is more than one screen to check", () => {
  assert.ok(routed.length > 20, `only found ${routed.length} routed screens`);
});

for (const layout of ["home", "frame", "classic"]) {
  test(`every screen is reachable from the ${layout} layout`, () => {
    const seen = reachableFrom(layout);
    const missing = routed.filter((s) => !seen.has(s));
    assert.equal(missing.join(", "), "", `no way to reach: ${missing.join(", ")}`);
  });
}

test("every nav destination has a route behind it", () => {
  const routedAll = new Set(D.ROUTES.map((r) => r.screen));
  const bad = [];
  for (const layout of ["home", "frame", "classic"]) {
    for (const id of reachableFrom(layout)) {
      // Top-level ids in NAV are groupings, not screens; they only need a route
      // if nothing claims them as a child.
      if (!routedAll.has(id)) bad.push(`${layout}: ${id}`);
    }
  }
  const groupings = new Set(D.NAV.filter((n) => n.children).map((n) => n.id));
  const real = bad.filter((b) => !groupings.has(b.split(": ")[1]));
  assert.equal(real.join(", "), "", `nav points at screens with no route: ${real.join(", ")}`);
});

test("every layout in the picker is one the app can render", () => {
  // Spread into this realm first: arrays built inside the vm sandbox have a
  // different Array prototype, and deepStrictEqual compares prototypes.
  const ids = [...D.LAYOUTS].map((l) => l.id).sort().join(",");
  assert.equal(ids, "classic,frame,home");
});

process.exit(failed ? 1 : 0);
