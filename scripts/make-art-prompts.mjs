// scripts/make-art-prompts.mjs
//
// Generates docs/art-prompts.md from the game's own data tables, so the list is
// exactly what the game can actually produce - no invented breeds, no colour
// combinations that never roll, nothing missed. Re-run after adding content.
//
// Output format: contact sheets. Each block is one complete, self-contained
// prompt that produces a grid of six images. Nothing has to be pasted in front
// of it and nothing is generated one at a time.
import { transformSync } from "@babel/core";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();
const React = { useState: () => {}, useEffect: () => {}, useCallback: () => {}, useRef: () => {} };
const sandbox = { console, Math, Object, Array, Date, JSON, Boolean, String, Number, React };
vm.createContext(sandbox);
for (const f of ["data.jsx", "genetics.jsx", "simulation.jsx"]) {
  const file = path.join(ROOT, "js", f);
  vm.runInContext(transformSync(fs.readFileSync(file, "utf8"),
    { presets: ["@babel/preset-react"], filename: file }).code, sandbox, { filename: file });
}
vm.runInContext(`globalThis.G = {
  BREEDS, BREED_COLOR_PROFILE, HEIGHT_WEIGHT, HORSE_BREEDS, CATTLE_BREEDS,
  ITEMS, UPGRADES, HUNTS, TRIALS, HORSE_SHOWS, LAND_SIZES, HOUSE_TYPES, LAND_LOCATIONS,
  TRUCKS, TRAILERS, SEASONS, CLINICS, REGISTRIES, BREED_GROUP_LABELS, PERSONALITIES
};`, sandbox);
const G = sandbox.G;

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const out = [];
const w = (line = "") => out.push(line);

const PER_SHEET = 6;

/* Baked into the front of every single sheet. Repeated rather than referenced,
   because the whole point is that a block can be pasted on its own. */
const STYLE =
  "Flat vector illustration. Clean thick dark-brown outlines, flat colour fills, " +
  "minimal cel shading, no gradients, no textures, no photorealism. Warm earthy " +
  "palette. Characterful but anatomically honest - working animals, not mascots.";

const SHEET_RULES =
  "Arrange as a 3 across by 2 down grid, six cells, generous even white gutters " +
  "between cells and a clear margin around the edge. Plain flat white background " +
  "throughout. Every subject drawn at the same scale, same camera distance, same " +
  "lighting, centred in its own cell. No text, no labels, no numbers, no borders, " +
  "no drop shadows, no ground shadows. Each cell must contain exactly one subject.";

let sheetNo = 0;
function sheet(title, subjectLine, cells, extra) {
  sheetNo += 1;
  w(`### Sheet ${sheetNo} — ${title}`);
  w();
  w("Cells, left to right, top to bottom:");
  w();
  cells.forEach((c, i) => w(`${i + 1}. \`${c.file}\` — ${c.short}`));
  w();
  w("```");
  w(`${STYLE} ${SHEET_RULES}`);
  w();
  w(subjectLine);
  w();
  cells.forEach((c, i) => w(`${i + 1}. ${c.prompt}`));
  if (extra) { w(); w(extra); }
  w("```");
  w();
}

function chunk(arr, n) {
  const outArr = [];
  for (let i = 0; i < arr.length; i += n) outArr.push(arr.slice(i, i + n));
  return outArr;
}

/* --------------------------------------------------------------- preamble -- */
w("# Art sheets — Sundown Kennels Simulator");
w();
w("Generated from the game's own data tables by `scripts/make-art-prompts.mjs`.");
w();
w("**Each block below is one complete prompt that produces six images.** Paste a");
w("block, get a sheet back, send me the sheet and I will cut it into the six files");
w("named above it and wire them in. Nothing needs pasting in front of anything.");
w();
w("Work top to bottom. The sheets are ordered so that stopping at any point still");
w("leaves the game better than it was — the dog breeds first, because that is what");
w("a player looks at most.");
w();
w("**On style:** flat vector rather than photoreal. Not taste — photoreal AI animals");
w("drift in lighting, camera and detail between generations, and two hundred of them");
w("will not look like one game. Flat art with a fixed brief holds together, matches");
w("the item icons already in the game, and reads at the size these are actually shown.");
w();
w("---");
w();

/* ------------------------------------------------------------------- dogs -- */
w("## Dogs");
w();
w("The game rolls a dog's colour and pattern from genetics, so these sheets cover");
w("breed and build. Colour variants follow further down.");
w();

const dogCells = Object.entries(G.BREEDS).map(([name, b]) => {
  const hw = G.HEIGHT_WEIGHT[name] || {};
  const h = hw.mH ? `${hw.mH[0]}-${hw.mH[1]} inches at the shoulder` : "medium build";
  const wt = hw.mW ? `, ${hw.mW[0]}-${hw.mW[1]} lb` : "";
  const prof = G.BREED_COLOR_PROFILE[name];
  const colour = prof && prof.bases.length ? prof.bases[0] : "fawn";
  const pattern = prof ? Object.keys(prof.patterns)[0] : "solid";
  const group = G.BREED_GROUP_LABELS[b.group] || b.group;
  return {
    file: `dogs/${slug(name)}.png`,
    short: `${name} — adult male, ${colour}${pattern !== "solid" ? " " + pattern : ""}`,
    prompt: `Adult male ${name}, a ${group.toLowerCase()} breed. ${h}${wt}. ` +
      `${colour.charAt(0).toUpperCase() + colour.slice(1)} coat, ${pattern} pattern. ` +
      `Standing square in left-facing side profile, alert working expression, ` +
      `fit hard condition with visible muscling, plain leather collar.`,
  };
});
chunk(dogCells, PER_SHEET).forEach((cells, i) => {
  sheet(`dog breeds ${i * PER_SHEET + 1}–${i * PER_SHEET + cells.length}`,
    "Six different dog breeds, one per cell, all standing in left-facing side profile:",
    cells);
});

/* ------------------------------------------------------------- dog coats --- */
w("## Dog coat variants");
w();
w("Every colour and pattern the genetics can actually roll. Same breed appears more");
w("than once with different coats — that is the point, the picture has to match what");
w("the profile says.");
w();

const coatCells = [];
for (const [name, prof] of Object.entries(G.BREED_COLOR_PROFILE)) {
  for (const base of prof.bases) {
    for (const pat of Object.keys(prof.patterns)) {
      const patDesc = {
        solid: "one even solid coat with no markings",
        brindle: "tiger-striped brindle, darker stripes running over the base colour",
        piebald: "large irregular white patches over roughly forty percent of the body, hard-edged",
        merle: "mottled merle, irregular torn-edged lighter patches scattered over the base, one blue eye",
        saddle: "a darker saddle marking across the back and sides with lighter legs and face",
        tricolor: "black saddle, tan points on the face and legs, white chest and feet",
        ticked: "fine dark speckled ticking scattered across the white areas",
      }[pat] || pat;
      const hw = G.HEIGHT_WEIGHT[name] || {};
      coatCells.push({
        file: `dogs/${slug(name)}--${base}--${pat}.png`,
        short: `${name} — ${base}, ${pat}`,
        prompt: `Adult ${name}${hw.mH ? `, ${hw.mH[0]}-${hw.mH[1]} inches at the shoulder` : ""}. ` +
          `${base.charAt(0).toUpperCase() + base.slice(1)} base coat with ${patDesc}. ` +
          `Left-facing side profile, standing square, working condition.`,
      });
    }
  }
}
chunk(coatCells, PER_SHEET).forEach((cells, i) => {
  sheet(`dog coats ${i * PER_SHEET + 1}–${i * PER_SHEET + cells.length}`,
    "Six dogs, one per cell, each with a specific breed and coat:",
    cells);
});

/* ----------------------------------------------------------------- horses -- */
w("## Horses");
w();
const horseCells = Object.entries(G.HORSE_BREEDS).map(([name, b]) => ({
  file: `horses/${slug(name)}.png`,
  short: `${name}${b.hands ? ` — ${b.hands[0]}-${b.hands[1]} hands` : ""}`,
  prompt: `Adult ${name} horse${b.hands ? `, ${b.hands[0]} to ${b.hands[1]} hands tall` : ""}, ` +
    `breed-correct build and head. Bay coat with black points, black mane and tail. ` +
    `Untacked, standing square in left-facing side profile, calm alert expression.`,
}));
chunk(horseCells, PER_SHEET).forEach((cells, i) => {
  sheet(`horse breeds ${i * PER_SHEET + 1}–${i * PER_SHEET + cells.length}`,
    "Six different horse breeds, one per cell, all in left-facing side profile:",
    cells);
});

/* ----------------------------------------------------------------- cattle -- */
w("## Cattle");
w();
const cattleCells = Object.entries(G.CATTLE_BREEDS).map(([name, b]) => ({
  file: `cattle/${slug(name)}.png`,
  short: `${name} — ${b.color || "breed-typical"}`,
  prompt: `Mature ${name} cow, breed-correct build, horns and head shape. ` +
    `${b.color || "Breed-typical"} coloured, ${b.pattern === "varies" ? "solid" : (b.pattern || "solid")} coat. ` +
    `Standing square in left-facing side profile.`,
}));
chunk(cattleCells, PER_SHEET).forEach((cells, i) => {
  sheet(`cattle breeds ${i * PER_SHEET + 1}–${i * PER_SHEET + cells.length}`,
    "Six different cattle breeds, one per cell, all in left-facing side profile:",
    cells);
});

/* ------------------------------------------------------------------ items -- */
w("## Items and equipment");
w();
const itemCells = Object.entries(G.ITEMS).map(([id, it]) => ({
  file: `items/${slug(id)}.png`,
  short: it.name,
  prompt: `${it.name} — ${it.desc} Single object, three-quarter view, centred, ` +
    `no hands and no animals in frame.`,
}));
chunk(itemCells, PER_SHEET).forEach((cells, i) => {
  sheet(`items ${i * PER_SHEET + 1}–${i * PER_SHEET + cells.length}`,
    "Six separate objects, one per cell, product-style with nothing else in frame:",
    cells);
});

/* --------------------------------------------------------------- buildings -- */
w("## Buildings and places");
w();
const buildingCells = [
  ...Object.entries(G.UPGRADES).map(([id, up]) => ({
    file: `upgrades/${slug(id)}.png`, short: up.name,
    prompt: `${up.name} — a small farm building. ${up.desc} Three-quarter view, whole structure in frame.`,
  })),
  ...G.CLINICS.map((c) => ({
    file: `clinics/${slug(c.id)}.png`, short: c.name,
    prompt: `${c.name} — a rural veterinary practice. ${c.blurb} ` +
      `The building should look like what it costs. Three-quarter view.`,
  })),
  ...Object.entries(G.HOUSE_TYPES).map(([id, h]) => ({
    file: `houses/${slug(id)}.png`, short: h.label || id,
    prompt: `A ${(h.label || id).toLowerCase()} — rural American farmhouse. Three-quarter view, whole building in frame.`,
  })),
];
chunk(buildingCells, PER_SHEET).forEach((cells, i) => {
  sheet(`buildings ${i * PER_SHEET + 1}–${i * PER_SHEET + cells.length}`,
    "Six separate buildings, one per cell, three-quarter view with no background scenery:",
    cells);
});

/* ---------------------------------------------------------------- vehicles -- */
w("## Trucks and trailers");
w();
const vehicleCells = [
  ...Object.entries(G.TRUCKS).map(([id, t]) => ({
    file: `trucks/${slug(id)}.png`, short: t.label || id,
    prompt: `A ${(t.label || id).toLowerCase()} pickup truck, working farm vehicle with honest wear, ` +
      `some dust and a few dents. Three-quarter front view, left-facing.`,
  })),
  ...Object.entries(G.TRAILERS).map(([id, t]) => ({
    file: `trailers/${slug(id)}.png`, short: t.label || id,
    prompt: `A ${(t.label || id).toLowerCase()} — livestock or dog-box trailer, unhitched. ` +
      `Three-quarter view, left-facing, working condition.`,
  })),
];
chunk(vehicleCells, PER_SHEET).forEach((cells, i) => {
  sheet(`vehicles ${i * PER_SHEET + 1}–${i * PER_SHEET + cells.length}`,
    "Six separate vehicles, one per cell, no background and no people:",
    cells);
});

/* ------------------------------------------------------------------ scenes -- */
w("## Scenes, events and badges");
w();
const sceneCells = [
  ...Object.entries(G.HUNTS).map(([id, h]) => ({
    file: `hunts/${slug(id)}.png`, short: h.label,
    prompt: `${h.label} — a wide landscape scene of the country this hunt happens in. ` +
      `${h.desc || ""} No dogs and no people in frame, just the ground and the cover.`,
  })),
  ...Object.entries(G.TRIALS).map(([id, t]) => ({
    file: `trials/${slug(id)}.png`, short: t.label,
    prompt: `${t.label} — the equipment and setting for this dog sport with no dog in frame. ${t.desc || ""}`,
  })),
  ...Object.entries(G.SEASONS).map(([id, s]) => ({
    file: `seasons/${slug(id)}.png`, short: s.label || id,
    prompt: `${s.label || id} — a rural southern landscape in that season, wide and simple, no animals.`,
  })),
  ...Object.entries(G.REGISTRIES).map(([id, r]) => ({
    file: `registries/${slug(id)}.png`, short: r.name,
    prompt: `A stamped registry seal or crest for the ${r.name}. Circular, embossed look, ` +
      `dark brown and antique gold only, no photographic detail.`,
  })),
  ...Object.entries(G.PERSONALITIES).map(([id, p]) => ({
    file: `personality/${slug(id)}.png`, short: p.name,
    prompt: `A small round badge icon representing a "${p.name}" dog temperament. ${p.blurb} ` +
      `Simple symbolic mark, no lettering.`,
  })),
];
chunk(sceneCells, PER_SHEET).forEach((cells, i) => {
  sheet(`scenes and badges ${i * PER_SHEET + 1}–${i * PER_SHEET + cells.length}`,
    "Six separate images, one per cell:",
    cells);
});

/* ---------------------------------------------------------------- one-offs -- */
w("## One-offs");
w();
w("These are single images rather than sheets, because each needs the whole frame.");
w();
w("### `world/atlas-map.png` — the county map");
w();
w("```");
w(`${STYLE} A hand-drawn illustrated county map in the style of an old survey ` +
  `or a theme-park guide, top-down three-quarter perspective. Rural American ` +
  `southern county: a kennel and farmhouse, a market square with several shops, ` +
  `a veterinary clinic, an adoption centre, trial grounds with a show ring, and ` +
  `wooded hunting country with a creek. Dirt roads connecting them. Buildings ` +
  `clearly separated with space around each one so they can be made clickable. ` +
  `No text and no labels anywhere. Warm parchment background.`);
w("```");
w();
w("### `world/title-hero.png` — title screen banner");
w();
w("```");
w(`${STYLE} A wide banner illustration, roughly 3 to 1, of a working dog kennel ` +
  `at sundown in the rural American south. Long low kennel runs, a pickup truck, ` +
  `pine treeline, warm orange sky. Empty space across the middle of the frame ` +
  `where a logo will sit. No text, no lettering, no dogs in close-up.`);
w("```");
w();
w("### `world/empty-pen.png` — placeholder for animals with no picture");
w();
w("```");
w(`${STYLE} An empty kennel run with the gate standing open, seen straight on. ` +
  `Quiet and neutral rather than sad. Plain flat background, no text, no animals.`);
w("```");
w();
w("---");
w();

/* ---------------------------------------------------------------- totals ---- */
const totals = [
  ["Dog breeds", dogCells.length],
  ["Dog coat variants", coatCells.length],
  ["Horses", horseCells.length],
  ["Cattle", cattleCells.length],
  ["Items", itemCells.length],
  ["Buildings", buildingCells.length],
  ["Vehicles", vehicleCells.length],
  ["Scenes and badges", sceneCells.length],
  ["One-offs", 3],
];
const grand = totals.reduce((n, [, v]) => n + v, 0);
w("## Totals");
w();
w("| Set | Images | Sheets |");
w("| --- | ---: | ---: |");
for (const [k, v] of totals) w(`| ${k} | ${v} | ${k === "One-offs" ? "—" : Math.ceil(v / PER_SHEET)} |`);
w(`| **Everything** | **${grand}** | **${sheetNo}** |`);
w();
w("Sheet 1 through 5 are the thirty dog breeds. Those alone put a breed-correct");
w("picture on every dog in the game, which is most of what a player reads on a card.");
w("Do those first and check the style is right before going further.");
w();
w("## Where they go");
w();
w("Send me the sheets. I will cut each one into the six files named above it, drop");
w("them in `assets/`, and wire them in — the code already prefers a real image file");
w("over a drawing wherever one exists.");
w();

fs.mkdirSync(path.join(ROOT, "docs"), { recursive: true });
const dest = path.join(ROOT, "docs", "art-prompts.md");
fs.writeFileSync(dest, out.join("\n"));
console.log(`wrote ${dest}`);
console.log(`${grand} images across ${sheetNo} sheets + 3 one-offs`);
for (const [k, v] of totals) console.log(`  ${k.padEnd(20)} ${String(v).padStart(4)}  ${k === "One-offs" ? "" : Math.ceil(v / PER_SHEET) + " sheets"}`);
