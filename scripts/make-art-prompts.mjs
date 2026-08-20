// scripts/make-art-prompts.mjs
//
// Generates docs/art-prompts.md from the game's own data tables, so the list
// is exactly what the game can actually produce - no invented breeds, no
// colour combinations that never roll, nothing missed.
//
// Re-run it after adding breeds or items and the brief regenerates.
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
  BREEDS, BREED_COLOR_PROFILE, HEIGHT_WEIGHT, HORSE_BREEDS, CATTLE_BREEDS, HORSE_BASES,
  ITEMS, UPGRADES, HUNTS, TRIALS, HORSE_SHOWS, LAND_SIZES, HOUSE_TYPES, LAND_LOCATIONS,
  TRUCKS, TRAILERS, SEASONS, CLINICS, REGISTRIES, BREED_GROUP_LABELS, PERSONALITIES
};`, sandbox);
const G = sandbox.G;

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const out = [];
const w = (line = "") => out.push(line);

/* Written once at the top and referenced by every prompt, rather than repeated
   360 times - a generator that reads the same preamble each run is far more
   likely to stay consistent than one fed 360 slightly different descriptions. */
const STYLE = [
  "Flat vector illustration, clean thick dark outline, limited flat colour areas, subtle cel shading only.",
  "Strict left-facing side profile, standing square, whole animal in frame, hooves/paws on an invisible ground line.",
  "Transparent background. No scenery, no text, no shadow on the ground, no border.",
  "Warm earthy palette. Friendly and characterful but anatomically honest - a working animal, not a mascot.",
  "Consistent camera distance and proportion across every image in the set.",
].join(" ");

w("# Art brief — Sundown Kennels Simulator");
w();
w("Generated from the game's own data tables by `scripts/make-art-prompts.mjs`.");
w("Re-run that script after adding breeds or items and this file regenerates.");
w();
w("---");
w();
w("## The style, and why");
w();
w("**Flat vector illustration. Not photoreal, not cartoon-goofy.**");
w();
w("Four reasons, in order of how much they matter:");
w();
w("1. **It stays coherent across hundreds of images.** Photoreal AI animals drift badly");
w("   between generations — different lighting, different camera, different level of");
w("   detail. Two hundred photoreal dogs will not look like they belong to one game.");
w("   Flat art with a fixed brief holds together.");
w("2. **Flat colour areas can be tinted precisely.** This is what makes the image");
w("   actually match the description — see the plan below.");
w("3. **It matches the item icons already in the game**, which are flat SVG with a");
w("   chunky outline.");
w("4. **It reads at 200px on a card.** Photoreal detail is wasted at the size these");
w("   are actually displayed.");
w();
w("Every prompt below should be prefixed with this style line:");
w();
w("```");
w(STYLE);
w("```");
w();
w("---");
w();

/* ---------------------------------------------------------------- the plan -- */
let dogCombos = 0, dogPatternImages = 0;
for (const [name, prof] of Object.entries(G.BREED_COLOR_PROFILE)) {
  dogCombos += prof.bases.length * Object.keys(prof.patterns).length;
  dogPatternImages += Object.keys(prof.patterns).length;
}

w("## The important decision: how the image matches the dog");
w();
w(`The game can roll **${dogCombos} distinct dog appearances** (breed × base colour ×`);
w("coat pattern). Generating all of them is possible but it is the wrong shape of work,");
w("because an AI asked for \"a chocolate Plott Hound\" will give you *a* brown dog, not");
w("the exact `#5b3a2a` the genetics rolled. The picture would be approximately right,");
w("which on a page that also prints the exact colour name reads as a bug.");
w();
w("**Recommended: generate breed × pattern, tint the colour at runtime.**");
w();
w(`- Patterns are structural — brindle striping, piebald patches, merle mottling, a`);
w("  saddle marking. Those need real art.");
w("- Base colour is a flat fill. The game already knows the exact hex it rolled");
w("  (`COLOR_HEX` in `data.jsx`), so it can recolour a flat coat region exactly.");
w(`- That turns **${dogCombos} images into ${dogPatternImages}** — and the colour is then`);
w("  *guaranteed* to match the description rather than approximately matching it.");
w();
w("For this to work, each image needs the coat as **one flat fill area in a neutral");
w("mid-grey**, with markings, nose, eyes and outline on top in fixed colours. Say so in");
w("the prompt — it is included below.");
w();
w("If you would rather not do the tinting work, Tier 2b lists all");
w(`${dogCombos} colour-specific prompts instead. Both are here; use one or the other.`);
w();
w("---");
w();

/* ------------------------------------------------------------------ tier 1 -- */
w("## Tier 1 — one hero image per breed (59 images)");
w();
w("Start here. Gets a breed-correct picture on every animal in the game. Colour will");
w("not match yet, but breed, build and size will — which is most of what a player reads.");
w();

w("### Dogs (30)");
w();
for (const [name, b] of Object.entries(G.BREEDS)) {
  const hw = G.HEIGHT_WEIGHT[name] || {};
  const h = hw.mH ? `${hw.mH[0]}–${hw.mH[1]} in at the shoulder` : "medium build";
  const wt = hw.mW ? `${hw.mW[0]}–${hw.mW[1]} lb` : "";
  const group = G.BREED_GROUP_LABELS[b.group] || b.group;
  w(`- \`dogs/${slug(name)}.png\` — **${name}** (${group}). Adult male in working`);
  w(`  condition, ${h}${wt ? ", " + wt : ""}. Coat as ONE flat mid-grey fill for tinting;`);
  w("  keep nose, eyes, claws and outline dark and unaffected.");
}
w();

w("### Horses (15)");
w();
for (const [name, b] of Object.entries(G.HORSE_BREEDS)) {
  const hands = b.hands ? `${b.hands[0]}–${b.hands[1]} hands` : "";
  w(`- \`horses/${slug(name)}.png\` — **${name}**${hands ? `, ${hands}` : ""}. Adult, tacked`);
  w("  up in nothing, standing square. Body as ONE flat mid-grey fill for tinting; mane,");
  w("  tail, hooves and outline fixed dark.");
}
w();

w("### Cattle (14)");
w();
for (const [name, b] of Object.entries(G.CATTLE_BREEDS)) {
  w(`- \`cattle/${slug(name)}.png\` — **${name}**, mature animal.`);
  w(`  Breed-correct horns and build. Standard colour for the breed is ${b.color || "breed-typical"}`);
  w(`  (${b.pattern || "solid"}); paint it that way rather than grey — cattle colour is`);
  w("  fixed per breed in this game, so these do not need tinting.");
}
w();
w("---");
w();

/* ------------------------------------------------------------------ tier 2 -- */
w(`## Tier 2a — dog coat patterns (${dogPatternImages} images) — RECOMMENDED`);
w();
w("One per breed × pattern, coat in neutral grey, tinted at runtime. Combined with");
w(`Tier 1 this covers all ${dogCombos} appearances exactly.`);
w();
for (const [name, prof] of Object.entries(G.BREED_COLOR_PROFILE)) {
  const pats = Object.keys(prof.patterns);
  w(`**${name}** — ${pats.length} pattern${pats.length > 1 ? "s" : ""}`);
  for (const pat of pats) {
    const desc = {
      solid: "one even coat, no markings",
      brindle: "tiger-striped brindle over the whole body, stripes darker than the base",
      piebald: "large irregular white patches over roughly 40% of the body, hard edges",
      merle: "mottled merle — irregular lighter torn-edge patches over the base, one blue eye",
      saddle: "a darker saddle marking over the back and sides, lighter legs and face",
      tricolor: "black saddle, tan points on face and legs, white chest and feet",
      ticked: "fine speckled ticking scattered over white areas",
    }[pat] || pat;
    w(`- \`dogs/${slug(name)}--${pat}.png\` — ${desc}. Base coat as one flat mid-grey`);
    w("  fill; markings a fixed darker grey so both tint together predictably.");
  }
  w();
}
w("---");
w();

w(`## Tier 2b — every dog appearance spelled out (${dogCombos} images) — ALTERNATIVE`);
w();
w("Use this **instead of** Tier 2a if you would rather not do runtime tinting. Colour");
w("will be approximate rather than exact.");
w();
for (const [name, prof] of Object.entries(G.BREED_COLOR_PROFILE)) {
  for (const base of prof.bases) {
    for (const pat of Object.keys(prof.patterns)) {
      w(`- \`dogs/${slug(name)}--${base}--${pat}.png\` — ${base} ${name}, ${pat} coat.`);
    }
  }
}
w();
w("---");
w();

/* ------------------------------------------------------------------ tier 3 -- */
w("## Tier 3 — the world");
w();
w("Everything that is not an animal. These are one-offs, so they can be richer than");
w("the animal set — but keep the same flat-vector language.");
w();

const section = (title, note) => { w(`### ${title}`); w(); if (note) { w(note); w(); } };

section("Items (31)", "Replaces the SVG icons currently drawn in `js/icons.jsx`. Square, centred, transparent.");
for (const [id, it] of Object.entries(G.ITEMS)) {
  w(`- \`items/${slug(id)}.png\` — **${it.name}**. ${it.desc}`);
}
w();

section("Kennel upgrades (5)", "Small building illustrations for the store cards.");
for (const [id, up] of Object.entries(G.UPGRADES)) {
  w(`- \`upgrades/${slug(id)}.png\` — **${up.name}**. ${up.desc}`);
}
w();

section("Hunts (4)", "Scene tiles for the hunt picker — quarry and country, no dogs in frame.");
for (const [id, h] of Object.entries(G.HUNTS)) {
  w(`- \`hunts/${slug(id)}.png\` — **${h.label}**. ${h.desc || ""}`);
}
w();

section("Trials and shows", "Event tiles.");
for (const [id, t] of Object.entries(G.TRIALS)) {
  w(`- \`trials/${slug(id)}.png\` — **${t.label}**. ${t.desc || ""}`);
}
for (const [id, ev] of Object.entries(G.HORSE_SHOWS)) {
  w(`- \`shows/${slug(id)}.png\` — **${ev.label || id}**. ${ev.desc || "Horse show event tile."}`);
}
w();

section("Property (37)", "Land, houses and where the place sits.");
for (const [id, l] of Object.entries(G.LAND_SIZES)) w(`- \`land/${slug(id)}.png\` — **${l.label || id}**`);
for (const [id, h] of Object.entries(G.HOUSE_TYPES)) w(`- \`houses/${slug(id)}.png\` — **${h.label || id}**`);
for (const [id, l] of Object.entries(G.LAND_LOCATIONS)) w(`- \`locations/${slug(id)}.png\` — **${l.label || id}**`);
w();

section("Trucks and trailers (19)", "Three-quarter view, working vehicles with some age on them.");
for (const [id, t] of Object.entries(G.TRUCKS)) w(`- \`trucks/${slug(id)}.png\` — **${t.label || id}**`);
for (const [id, t] of Object.entries(G.TRAILERS)) w(`- \`trailers/${slug(id)}.png\` — **${t.label || id}**`);
w();

section("Clinics (4)", "Small building portraits — each should look like its price.");
for (const c of G.CLINICS) w(`- \`clinics/${slug(c.id)}.png\` — **${c.name}**. ${c.blurb}`);
w();

section("Registries (5)", "Crest or seal, not a building. Stamped-looking, single colour plus gold.");
for (const [id, r] of Object.entries(G.REGISTRIES)) w(`- \`registries/${slug(id)}.png\` — **${r.name}**. ${r.blurb}`);
w();

section("Seasons (4)", "Small banner strips for the rail's Game Time box.");
for (const [id, s] of Object.entries(G.SEASONS)) w(`- \`seasons/${slug(id)}.png\` — **${s.label || id}**`);
w();

section("Personalities (6)", "Small round badges for the animal profile.");
for (const [id, p] of Object.entries(G.PERSONALITIES)) w(`- \`personality/${slug(id)}.png\` — **${p.name}**. ${p.blurb}`);
w();

section("One-offs (3)");
w("- `world/atlas-map.png` — the illustrated county map for the Atlas page. Hand-drawn");
w("  survey feel, labelled buildings for the kennel, market, clinics, adoption centre,");
w("  trial grounds and the hunting country. Needs clickable regions, so keep the");
w("  buildings well separated.");
w("- `world/title-hero.png` — wide banner for the title screen, behind the logo.");
w("- `world/empty-pen.png` — the placeholder shown where an animal has no picture yet.");
w();
w("---");
w();

/* --------------------------------------------------------------- the totals -- */
const counts = {
  "Tier 1 breed heroes": 30 + Object.keys(G.HORSE_BREEDS).length + Object.keys(G.CATTLE_BREEDS).length,
  "Tier 2a coat patterns (recommended)": dogPatternImages,
  "Tier 2b every appearance (alternative)": dogCombos,
  "Tier 3 world art": Object.keys(G.ITEMS).length + Object.keys(G.UPGRADES).length +
    Object.keys(G.HUNTS).length + Object.keys(G.TRIALS).length + Object.keys(G.HORSE_SHOWS).length +
    Object.keys(G.LAND_SIZES).length + Object.keys(G.HOUSE_TYPES).length + Object.keys(G.LAND_LOCATIONS).length +
    Object.keys(G.TRUCKS).length + Object.keys(G.TRAILERS).length + G.CLINICS.length +
    Object.keys(G.REGISTRIES).length + Object.keys(G.SEASONS).length + Object.keys(G.PERSONALITIES).length + 3,
};
w("## Totals");
w();
w("| Set | Images |");
w("| --- | ---: |");
for (const [k, v] of Object.entries(counts)) w(`| ${k} | ${v} |`);
w(`| **Recommended path (1 + 2a + 3)** | **${counts["Tier 1 breed heroes"] + counts["Tier 2a coat patterns (recommended)"] + counts["Tier 3 world art"]}** |`);
w();
w("## Where to put them");
w();
w("Drop them in `assets/` following the paths above — `assets/dogs/plott-hound.png`");
w("and so on. The code already prefers a real file over a drawing wherever one exists");
w("(`ItemIcon` in `js/icons.jsx` does this today), and the same pattern extends to");
w("animals. Send them over and I will wire them up.");
w();

fs.mkdirSync(path.join(ROOT, "docs"), { recursive: true });
const dest = path.join(ROOT, "docs", "art-prompts.md");
fs.writeFileSync(dest, out.join("\n"));
console.log(`wrote ${dest} — ${out.length} lines`);
for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(40)} ${v}`);
