/* Genetics and dog generation: coat color inheritance, hidden carriers,
   traits, the myostatin growth mutation, conformation grading, bully class,
   rarity, size, and the breeding roll that produces a litter.

   Pure functions — no React, no state. */

/* --------------------------------- helpers --------------------------------- */

const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const genId = () => "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmtMoney = (n) => "$" + Math.round(n).toLocaleString("en-US");
const ageLabel = (days) => (days < 30 ? days + "d" : Math.floor(days / 30) + "mo");
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const randomName = (sex) => { const pool = sex === "M" ? NAMES_M : NAMES_F; return pool[randInt(0, pool.length - 1)]; };
const overallRating = (stats) => Math.round(STAT_KEYS.reduce((a, k) => a + stats[k], 0) / STAT_KEYS.length);
const statScore = (stats, weights) => Object.entries(weights).reduce((s, [k, w]) => s + stats[k] * w, 0);

function breedShort(breedName) { return BREEDS[breedName] ? BREEDS[breedName].short : breedName; }

/* Every mix gets its own generated tag name instead of a generic "X/Y
   Cross" label — a short fragment from each parent breed, fused into one
   word. Mixing a mix further just chains the fragments on, so a dog with
   three or four breeds behind it ends up with a longer, more distinctive
   (and rarer) name than a first-generation cross — genetics compounding
   into the name the same way it compounds into rarity. */
const BREED_FRAGMENTS = {
  "American Pit Bull Terrier": "Pit", "Catahoula Leopard Dog": "Cata", "Black Mouth Cur": "Cur",
  "Blue Lacy": "Lacy", "Plott Hound": "Plott", "Mountain Cur": "Mtn", "American Bulldog": "Bull",
  "American Leopard Hound": "Leo", "Treeing Walker Coonhound": "Walker", "Redbone Coonhound": "Red",
  "Bluetick Coonhound": "Tick", "Dogo Argentino": "Dogo", "Cane Corso": "Corso", "Airedale Terrier": "Aire",
};
function fragmentFor(breedName) {
  return BREED_FRAGMENTS[breedName] || breedName.replace(/[^A-Za-z]/g, "").slice(0, 8);
}
function generateMixName(breedA, breedB) {
  const [x, y] = [breedA, breedB].sort();
  const name = fragmentFor(x) + fragmentFor(y);
  return name.length > 22 ? name.slice(0, 22) : name;
}
/* Bandog: a real, named type — crossing an APBT with a big mastiff-type breed
   (Cane Corso, Dogo Argentino, American Bulldog) to combine terrier gameness
   with mastiff size/power. Modern usage traces to the 1960s "bandogge"
   revival. Modeled here as bigger, stronger, and faster than either parent. */
const BANDOG_PARTNERS = ["Cane Corso", "Dogo Argentino", "American Bulldog"];
function isBandogPair(breedA, breedB) {
  return (breedA === "American Pit Bull Terrier" && BANDOG_PARTNERS.includes(breedB)) ||
         (breedB === "American Pit Bull Terrier" && BANDOG_PARTNERS.includes(breedA));
}
/* Any name ending in "Bandog" (plus the bare legacy "Bandog" tag) counts as
   part of the lineage — this is what lets sizing, stat bonuses, and bully
   classification keep recognizing a dog as a Bandog even once it's carrying
   a sub-type name like "CorsoBandog" or "DogoBullBandog". */
function isBandogBreed(breedName) {
  return breedName === "Bandog" || breedName.endsWith("Bandog");
}
function bandogPartnerFrag(breedName) {
  if (BANDOG_PARTNERS.includes(breedName)) return fragmentFor(breedName);
  if (breedName === "Bandog") return "";
  if (breedName.endsWith("Bandog")) return breedName.slice(0, -6);
  return "";
}
/* Every Bandog now gets a sub-type name based on which big breed(s) are
   actually behind it — APBT x Cane Corso makes a "CorsoBandog", APBT x
   Dogo Argentino a "DogoBandog", and so on. Breeding two different
   sub-type Bandogs together fuses both partner names into one, so a line
   that's picked up both Corso and Dogo blood becomes "CorsoDogoBandog" —
   more breeds behind it, a longer name, and (per the rarity system) a
   rarer, pricier dog. */
function generateBandogName(sire, dam) {
  const fresh = isBandogPair(sire.breed, dam.breed);
  const frags = new Set();
  if (fresh) {
    const partnerBreed = sire.breed === "American Pit Bull Terrier" ? dam.breed : sire.breed;
    frags.add(fragmentFor(partnerBreed));
  }
  if (isBandogBreed(sire.breed)) { const f = bandogPartnerFrag(sire.breed); if (f) frags.add(f); }
  if (isBandogBreed(dam.breed)) { const f = bandogPartnerFrag(dam.breed); if (f) frags.add(f); }
  if (frags.size === 0) return "Bandog";
  const name = Array.from(frags).sort().join("") + "Bandog";
  return name.length > 22 ? name.slice(0, 22) : name;
}
function pickWeighted(weightsObj) {
  const entries = Object.entries(weightsObj);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) { if (r < w) return k; r -= w; }
  return entries[0][0];
}
function colorLabel(colorGenes) {
  if (colorGenes.pattern === "solid") return cap(colorGenes.base);
  return cap(colorGenes.base) + " " + cap(colorGenes.pattern);
}
function shade(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) + Math.round(2.55 * percent);
  let g = ((num >> 8) & 0xff) + Math.round(2.55 * percent);
  let b = (num & 0xff) + Math.round(2.55 * percent);
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function hashStr(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return h; }
function mulberry32(seed) {
  let s = seed;
  return function () {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randomColorGenes(breedName) {
  const profile = BREED_COLOR_PROFILE[breedName] || BREED_COLOR_PROFILE["American Pit Bull Terrier"];
  const base = profile.bases[randInt(0, profile.bases.length - 1)];
  const pattern = pickWeighted(profile.patterns);
  return { base, pattern, merleAlleles: pattern === "merle" ? 1 : 0 };
}
/* Inheritance draws from each parent's VISIBLE trait plus whatever hidden
   trait they carry — the same basic logic as a recessive allele resurfacing
   from a grandparent, just simplified to one hidden slot per parent instead
   of a full diploid model. Merle stays a true dominant-gene punnett square
   since that part is accurately single-gene in real dogs. */
function inheritColorGenes(sire, dam) {
  const sM = sire.colorGenes.merleAlleles, dM = dam.colorGenes.merleAlleles;
  let merleAlleles;
  if (sM >= 1 && dM >= 1) { const r = Math.random(); merleAlleles = r < 0.25 ? 2 : r < 0.75 ? 1 : 0; }
  else if (sM >= 1 || dM >= 1) merleAlleles = Math.random() < 0.5 ? 1 : 0;
  else merleAlleles = 0;
  let pattern;
  if (merleAlleles >= 1) pattern = "merle";
  else {
    const candidates = [sire.colorGenes.pattern, dam.colorGenes.pattern, sire.hiddenPattern, dam.hiddenPattern].filter((p) => p && p !== "merle");
    pattern = candidates.length ? candidates[randInt(0, candidates.length - 1)] : "solid";
  }
  const baseCandidates = [sire.colorGenes.base, dam.colorGenes.base, sire.hiddenColor, dam.hiddenColor].filter(Boolean);
  const base = baseCandidates[randInt(0, baseCandidates.length - 1)];
  return { base, pattern, merleAlleles };
}
function rollHiddenGenes(colorGenes, sire, dam) {
  let hiddenColor = null;
  if (Math.random() < 0.3) {
    const pool = [sire.colorGenes.base, dam.colorGenes.base, sire.hiddenColor, dam.hiddenColor].filter((c) => c && c !== colorGenes.base);
    if (pool.length) hiddenColor = pool[randInt(0, pool.length - 1)];
  }
  let hiddenPattern = null;
  if (Math.random() < 0.3 && colorGenes.pattern !== "merle") {
    const pool = [sire.colorGenes.pattern, dam.colorGenes.pattern, sire.hiddenPattern, dam.hiddenPattern].filter((p) => p && p !== "merle" && p !== colorGenes.pattern);
    if (pool.length) hiddenPattern = pool[randInt(0, pool.length - 1)];
  }
  return { hiddenColor, hiddenPattern };
}
function rollFounderHiddenGenes(colorGenes) {
  let hiddenColor = null;
  if (Math.random() < 0.3) { const opts = COLOR_NAMES.filter((c) => c !== colorGenes.base); hiddenColor = opts[randInt(0, opts.length - 1)]; }
  let hiddenPattern = null;
  if (Math.random() < 0.3 && colorGenes.pattern !== "merle") { const opts = ["solid", "brindle", "piebald", "saddle", "tricolor", "ticked"].filter((p) => p !== colorGenes.pattern); hiddenPattern = opts[randInt(0, opts.length - 1)]; }
  return { hiddenColor, hiddenPattern };
}
/* American Bully size classes, researched from the ABKC and UKC breed
   standards (height at withers, measured to the ABKC's 2021 amendment):
   Pocket: males 14-under 17in, females 13-under 16in
   Standard: males 17-20in, females 16-19in
   Classic: same height as Standard — the real distinction is a lighter
     frame and less mass, not height, so it's approximated here from
     weight-for-height rather than invented as a separate height band
   XL: males over 20-23in, females over 19-22in
   XXL: not an official ABKC/UKC class — informally used for dogs running
     roughly 2-3in taller and 20-30lb heavier than XL
   Important honesty note: the American Bully is its own breed (APBT x
   American Staffordshire Terrier, with historical Bulldog influence), not
   the same thing as a Bandog. In practice, though, people casually slap
   "XL Bully" on any big, heavily-muscled APBT-type dog by height alone —
   which is exactly what this tag models, on your APBT and Bandog stock. */
const BULLY_CLASSES = {
  pocket: { label: "Pocket Bully", desc: "Under the Pocket height ceiling — compact, dense, and just as much bully as the bigger classes, only in a smaller frame." },
  classic: { label: "Classic Bully", desc: "Standard height range, but a lighter frame and less overall mass — more of the original American Pit Bull Terrier athleticism showing through." },
  standard: { label: "Standard Bully", desc: "The breed's baseline — heavy bone, thick muscle, and the classic blocky bully silhouette at a middle height." },
  xl: { label: "XL Bully", desc: "Taller than Standard, same heavy-muscled build scaled up — the size class most people picture when they hear 'bully.'" },
  xxl: { label: "XXL Bully", desc: "Bigger than any officially recognized class — not an ABKC/UKC size, just what breeders informally call anything running past XL height and weight." },
};
/* Body-type grade — separate from the working stat bars, this judges
   structure the way a bench-show judge would: soundness, proportion, and
   freedom from faults, rather than gameness or grip. */
function conformationGrade(dog) {
  let score = dog.stats.conformation;
  if (dog.impaired) score -= 15;
  if (dog.colorGenes.merleAlleles === 2) score -= 5;
  if (dog.culled) score -= 20;
  score = clamp(score, 0, 100);
  if (score >= 90) return { grade: "A+", tone: "gold", desc: "Exceptional structure — exactly what a judge is looking for." };
  if (score >= 80) return { grade: "A", tone: "gold", desc: "Excellent, standard-correct build." };
  if (score >= 70) return { grade: "B+", tone: "olive", desc: "Strong structure with only minor faults." };
  if (score >= 60) return { grade: "B", tone: "olive", desc: "Solid, sound, unremarkable structure." };
  if (score >= 50) return { grade: "C+", tone: "denim", desc: "Workable but noticeably off breed type." };
  if (score >= 40) return { grade: "C", tone: "denim", desc: "Several structural faults." };
  if (score >= 25) return { grade: "D", tone: "rust", desc: "Poor structure — would place last in any bench show." };
  return { grade: "F", tone: "rust", desc: "Serious structural faults." };
}
function bullyClass(dog) {
  if (dog.breed !== "Bandog" && dog.breed !== "American Pit Bull Terrier") return null;
  const isM = dog.sex === "M";
  const min = isM ? 14 : 13, stdLo = isM ? 17 : 16, stdHi = isM ? 20 : 19, xlHi = isM ? 23 : 22;
  const h = dog.heightIn;
  if (h < min) return null;
  if (h < stdLo) return { key: "pocket", ...BULLY_CLASSES.pocket };
  if (h <= stdHi) {
    const dense = dog.weightLb >= h * 3;
    return dense ? { key: "standard", ...BULLY_CLASSES.standard } : { key: "classic", ...BULLY_CLASSES.classic };
  }
  if (h <= xlHi) return { key: "xl", ...BULLY_CLASSES.xl };
  return { key: "xxl", ...BULLY_CLASSES.xxl };
}
function computeRarity(dog) {
  let score = 0;
  score += { solid: 0, brindle: 1, saddle: 2, piebald: 2, tricolor: 2, ticked: 3, merle: 4 }[dog.colorGenes.pattern] || 0;
  if (dog.crossBred && dog.breed !== "Bandog") score += 2;
  if (isBandogBreed(dog.breed)) score += 3;
  /* A longer generated mix name means more distinct breeds fused into this
     one line — genuinely rarer, so the name itself feeds rarity. */
  if (dog.crossBred && !BREEDS[dog.breed] && dog.breed !== "Bandog") score += Math.min(dog.breed.length / 6, 3.5);
  if (dog.mstnAlleles === 1) score += 2;
  if (dog.mstnAlleles === 2) score += 4;
  score += (dog.traits ? dog.traits.length : 0) * 1.5;
  if (dog.generation > 1) score += Math.min(dog.generation - 1, 3) * 0.5;
  const bc = bullyClass(dog);
  if (bc && bc.key === "xl") score += 2;
  if (bc && bc.key === "xxl") score += 4;
  if (bc && bc.key === "pocket") score += 1;
  const profile = BREED_COLOR_PROFILE[dog.breed];
  if (profile && !profile.bases.includes(dog.colorGenes.base)) score += 2;
  if (profile && !(dog.colorGenes.pattern in profile.patterns)) score += 2;
  /* Crossbreds and Bandogs already score above just for being mixed — a
     clean purebred line has never scored anything on its own. Give it
     three ways to earn rarity purely through careful, purebred breeding
     instead of an odd color falling out of the litter. */
  if (!dog.crossBred) {
    score += 1; // true to type, unmixed
    /* A bloodline can only be founded by two papered, unbred purebreds of
       the same breed (see doBreed) — it's an established line the player
       built, not a random roll, so it earns real weight, growing with
       every generation it's carried down. */
    if (dog.bloodline) score += Math.min(1 + (dog.generation - 1) * 0.3, 3);
    /* "Breeding up": pick the biggest pups each litter, breed them back
       together, and the line drifts past its breed's own standard over
       generations (see inheritSize — each pup's size comes from its actual
       parents' size, not a fixed template, so this compounds). Reward that
       investment instead of it paying out nothing at sale time. */
    const hw = HEIGHT_WEIGHT[dog.breed];
    if (hw) {
      const maxH = Math.max(hw.mH[1], hw.fH[1]);
      const maxW = Math.max(hw.mW[1], hw.fW[1]);
      const overH = Math.max(0, dog.heightIn - maxH) / maxH;
      const overW = Math.max(0, dog.weightLb - maxW) / maxW;
      score += Math.min((overH + overW) * 6, 4);
    }
  }
  if (score >= 7) return { tier: "Legendary", mult: 1.6, tone: "gold" };
  if (score >= 4.5) return { tier: "Rare", mult: 1.35, tone: "rust" };
  if (score >= 2) return { tier: "Uncommon", mult: 1.15, tone: "denim" };
  return { tier: "Common", mult: 1, tone: "tan" };
}
function starTrait(dog) {
  let bestKey = STAT_KEYS[0], bestVal = -1;
  STAT_KEYS.forEach((k) => { if (dog.stats[k] > bestVal) { bestVal = dog.stats[k]; bestKey = k; } });
  return { key: bestKey, value: bestVal, stars: clamp(Math.round(bestVal / 20), 1, 5) };
}
function starString(n) { return "★".repeat(n) + "☆".repeat(5 - n); }

function sizeFromStats(breed, sex, stats) {
  const hw = HEIGHT_WEIGHT[breed] || HEIGHT_WEIGHT["American Pit Bull Terrier"];
  const hRange = sex === "M" ? hw.mH : hw.fH;
  const wRange = sex === "M" ? hw.mW : hw.fW;
  const sizeFactor = clamp(stats.conformation / 100 + rand(-0.15, 0.15), 0, 1);
  const heightIn = Math.round((hRange[0] + sizeFactor * (hRange[1] - hRange[0])) * 10) / 10;
  const weightLb = Math.round(wRange[0] + sizeFactor * (wRange[1] - wRange[0]));
  return { heightIn, weightLb };
}
function inheritSize(sire, dam, inbred) {
  const spread = inbred ? 2.1 : 1.5;
  const heightIn = clamp(Math.round(((sire.heightIn + dam.heightIn) / 2 + rand(-spread, spread)) * 10) / 10, 12, 32);
  const weightLb = clamp(Math.round((sire.weightLb + dam.weightLb) / 2 + rand(-spread * 4, spread * 4)), 18, 135);
  return { heightIn, weightLb };
}
/* Bandog lines only grow from here — breeding two Bandogs takes the LARGER
   parent's size as the floor and adds pure growth, never shrinks. Bringing
   in a smaller outside dog dilutes the size (weighted toward the Bandog
   parent) but still always adds a positive size bump — still an enhanced
   mix, just not a bigger one than the purebred Bandog line would produce. */
function bandogSize(sire, dam, inbred) {
  const sireIsBandog = isBandogBreed(sire.breed);
  const damIsBandog = isBandogBreed(dam.breed);
  if (sireIsBandog && damIsBandog) {
    const heightIn = clamp(Math.round((Math.max(sire.heightIn, dam.heightIn) + rand(0.3, 1.8)) * 10) / 10, 12, 34);
    const weightLb = clamp(Math.round(Math.max(sire.weightLb, dam.weightLb) + randInt(6, 18)), 18, 160);
    return { heightIn, weightLb };
  }
  const bandogParent = sireIsBandog ? sire : dam;
  const otherParent = sireIsBandog ? dam : sire;
  const heightIn = clamp(Math.round((bandogParent.heightIn * 0.65 + otherParent.heightIn * 0.35 + rand(0.2, 1.2)) * 10) / 10, 12, 32);
  const weightLb = clamp(Math.round(bandogParent.weightLb * 0.65 + otherParent.weightLb * 0.35 + randInt(4, 12)), 18, 150);
  return { heightIn, weightLb };
}

/* Physical traits, researched against real canine genetics where a real
   gene is documented. A few (marked real:false) are gameplay abstractions
   of natural individual variation rather than a single named gene — those
   are flagged honestly in their own description text rather than invented
   as fake science. */
const TRAIT_DEFS = {
  myostatin1: { name: "Muscled (MSTN)", tone: "rust", effects: { grip: 5, conformation: 4 }, real: true,
    desc: "One copy of a myostatin (MSTN) gene mutation — the same one documented in athletic 'bully' whippets — limits the protein that normally caps muscle growth, adding noticeably more lean muscle." },
  myostatin2: { name: "Double Muscled (MSTN/MSTN)", tone: "rust", effects: { grip: 14, conformation: 10, stamina: -6 }, real: true,
    desc: "Two copies of the myostatin mutation — true double-muscling, dramatic added mass and power at a real cost to endurance, exactly as documented in homozygous 'bully whippets'." },
  ridgeback: { name: "Dorsal Ridge", tone: "denim", founderChance: 0.05, effects: {}, real: true,
    desc: "A reversed ridge of hair along the spine from a dominant gene — the same trait that defines the Rhodesian Ridgeback. Purely cosmetic, though ridgeback lines carry a documented risk of dermoid sinus." },
  bobtail: { name: "Natural Bobtail", tone: "denim", founderChance: 0.04, effects: {}, real: true,
    desc: "A short or absent tail from a dominant T-box gene mutation, the same one found in some Australian Shepherds and Corgis. Two copies is lethal early in development, so bobtail dogs only ever carry one." },
  furnishings: { name: "Furnished Coat", tone: "tan", founderChance: 0.08, effects: {}, real: true,
    desc: "The wiry coat, beard, and eyebrows of a wire-haired terrier, governed by the RSPO2 gene. Cosmetic." },
  longcoat: { name: "Long Coat", tone: "tan", founderChance: 0.08, effects: {}, real: true,
    desc: "A recessive FGF5 mutation that grows a longer, fluffier coat than the breed standard. Cosmetic, more upkeep in hot weather." },
  doubledew: { name: "Double Dewclaws", tone: "tan", founderChance: 0.03, effects: { stamina: 2 }, real: true,
    desc: "An extra set of rear dewclaws — documented in breeds like the Great Pyrenees, thought to help traction on rough or icy ground." },
  weathercoat: { name: "Heavy Double Coat", tone: "tan", founderChance: 0.06, effects: { stamina: 2 }, real: true,
    desc: "A dense insulating undercoat under the guard hairs, common in cold-climate working lines — genuinely useful on cold or wet hunts." },
  broadskull: { name: "Broad Skull", tone: "rust", founderChance: 0.07, effects: { grip: 4, conformation: 2 }, real: false,
    desc: "An unusually wide, heavy skull and jaw hinge. Not one named gene — more a byproduct of generations of selecting hard for bite strength." },
  longteeth: { name: "Extended Dentition", tone: "rust", founderChance: 0.06, effects: { grip: 5 }, real: false,
    desc: "Noticeably longer canine teeth than breed standard. Tooth proportions do vary naturally between individuals; this is the exaggerated end of that range, favored in old-school catch-dog lines." },
  rangy: { name: "Rangy Build", tone: "olive", founderChance: 0.08, effects: { speed: 4, grip: -2 }, real: false,
    desc: "A long-legged, lean build for covering ground fast, at some cost to raw grip strength." },
  stocky: { name: "Stocky Build", tone: "olive", founderChance: 0.08, effects: { grip: 3, conformation: 3, speed: -3 }, real: false,
    desc: "A low, heavy-boned, thickset build — more power, less top end." },
  supernose: { name: "Exceptional Scenting", tone: "gold", founderChance: 0.05, effects: { nose: 6 }, real: false,
    desc: "A nose that outperforms the rest of the litter. Individual variation in olfactory receptor genes is real and documented; this is simply the high end of it." },
};
const COSMETIC_TRAIT_KEYS = Object.keys(TRAIT_DEFS).filter((k) => k !== "myostatin1" && k !== "myostatin2");

function applyTraitEffects(stats, traits, mstnAlleles) {
  const out = { ...stats };
  traits.forEach((key) => {
    const def = TRAIT_DEFS[key];
    if (def && def.effects) Object.entries(def.effects).forEach(([k, v]) => (out[k] = clamp(out[k] + v)));
  });
  if (mstnAlleles === 1) Object.entries(TRAIT_DEFS.myostatin1.effects).forEach(([k, v]) => (out[k] = clamp(out[k] + v)));
  if (mstnAlleles === 2) Object.entries(TRAIT_DEFS.myostatin2.effects).forEach(([k, v]) => (out[k] = clamp(out[k] + v)));
  return out;
}
function rollFounderTraits() {
  const traits = [];
  const hiddenTraits = [];
  for (const key of COSMETIC_TRAIT_KEYS) {
    const def = TRAIT_DEFS[key];
    if (traits.length < 2 && Math.random() < def.founderChance) traits.push(key);
    else if (hiddenTraits.length < 2 && Math.random() < def.founderChance * 0.6) hiddenTraits.push(key);
  }
  const r = Math.random();
  const mstnAlleles = r < 0.005 ? 2 : r < 0.06 ? 1 : 0;
  return { traits, hiddenTraits, mstnAlleles };
}
function inheritTraits(sire, dam) {
  const pool = Array.from(new Set([...(sire.traits || []), ...(dam.traits || []), ...(sire.hiddenTraits || []), ...(dam.hiddenTraits || [])]));
  const traits = [];
  const hiddenTraits = [];
  pool.forEach((key) => {
    if (traits.length < 2 && Math.random() < 0.45) traits.push(key);
    else if (hiddenTraits.length < 2 && Math.random() < 0.3) hiddenTraits.push(key);
  });
  const sM = sire.mstnAlleles || 0, dM = dam.mstnAlleles || 0;
  let mstnAlleles;
  if (sM >= 1 && dM >= 1) { const r = Math.random(); mstnAlleles = r < 0.25 ? 2 : r < 0.75 ? 1 : 0; }
  else if (sM >= 1 || dM >= 1) mstnAlleles = Math.random() < 0.5 ? 1 : 0;
  else mstnAlleles = 0;
  return { traits, hiddenTraits, mstnAlleles };
}

/* The myostatin mutation doesn't just add muscle — real double-muscled
   animals also run measurably bigger. Modeled here as a 75% chance per
   generation of an added growth spurt in height and/or weight, scaled by
   how many copies of the mutation the dog carries, and it inherits right
   alongside the myostatin allele itself — so it genuinely runs in the
   bloodline rather than being a one-off roll. */
function applyGrowthMutation(heightIn, weightLb, mstnAlleles) {
  if (!mstnAlleles || Math.random() >= 0.75) return { heightIn, weightLb, grew: false };
  const mult = mstnAlleles === 2 ? 1.6 : 1;
  const heightBoost = rand(0.4, 1.6) * mult;
  const weightBoost = randInt(6, 16) * mult;
  return {
    heightIn: clamp(Math.round((heightIn + heightBoost) * 10) / 10, 10, 34),
    weightLb: clamp(Math.round(weightLb + weightBoost), 15, 160),
    grew: true,
  };
}

function generateRandomDog(breedName) {
  const breed = breedName || BREED_NAMES[randInt(0, BREED_NAMES.length - 1)];
  const base = BREEDS[breed].base;
  let stats = {};
  STAT_KEYS.forEach((k) => (stats[k] = clamp(Math.round(base[k] + rand(-14, 14)))));
  const sex = Math.random() < 0.5 ? "M" : "F";
  const { traits, hiddenTraits, mstnAlleles } = rollFounderTraits();
  stats = applyTraitEffects(stats, traits, mstnAlleles);
  const baseSize = sizeFromStats(breed, sex, stats);
  const { heightIn, weightLb, grew: grewBigger } = applyGrowthMutation(baseSize.heightIn, baseSize.weightLb, mstnAlleles);
  let impaired = false;
  if (breed === "Dogo Argentino" && Math.random() < 0.1) {
    impaired = true;
    stats.nose = clamp(stats.nose - randInt(10, 25));
  }
  const colorGenes = randomColorGenes(breed);
  const { hiddenColor, hiddenPattern } = rollFounderHiddenGenes(colorGenes);
  return {
    id: genId(), name: randomName(sex), breed, sex, stats,
    colorGenes, crossBred: false, impaired,
    hiddenColor, hiddenPattern, traits, hiddenTraits, mstnAlleles, grewBigger,
    heightIn, weightLb,
    registered: false, regNumber: null, bloodline: null,
    health: randInt(80, 100), ageDays: randInt(220, 950),
    temperament: rollTemperament(), titles: [], injury: null, pregnantDaysLeft: 0,
    sire: null, dam: null, pedigree: null, generation: 1, breedCooldown: 0, bornDay: null,
  };
}
function generateAiDog(breedName) {
  const dog = generateRandomDog(breedName);
  STAT_KEYS.forEach((k) => (dog.stats[k] = clamp(dog.stats[k] + randInt(3, 10))));
  dog.health = 100;
  return dog;
}

function computeValue(dog) {
  const rating = overallRating(dog.stats);
  const genBonus = Math.min(dog.generation - 1, 4) * 30;
  const rarity = computeRarity(dog);
  const papersMult = dog.registered ? 1.15 : 1;
  const culledMult = dog.culled ? 0.55 : 1;
  // A registry entry on either parent is worth real money on the pup - see
  // registryOffspringBonus. Applied at valuation rather than baked in at
  // birth, so entering a line later still pays on pups already on the ground.
  const lineage = typeof registryOffspringBonus === "function" ? registryOffspringBonus(dog) : 1;
  return Math.round(lineage * rating * 16 * rarity.mult * papersMult * culledMult + dog.health * 2 + genBonus);
}

function isInbred(sire, dam) {
  return !!((sire.sire && (sire.sire === dam.name || sire.dam === dam.name)) || (dam.sire && (dam.sire === sire.name || dam.dam === sire.name)));
}

function breedPuppies(sire, dam, day, bloodline) {
  const inbred = isInbred(sire, dam);
  const crossBred = sire.breed !== dam.breed;
  const freshBandogCross = isBandogPair(sire.breed, dam.breed);
  const bandogLineage = isBandogBreed(sire.breed) || isBandogBreed(dam.breed);
  const bandog = freshBandogCross || bandogLineage;
  const label = bandog ? generateBandogName(sire, dam) : crossBred ? generateMixName(sire.breed, dam.breed) : sire.breed;
  const litterSize = randInt(2, 5);
  const pups = [];
  let doubleMerleWarned = false;
  for (let i = 0; i < litterSize; i++) {
    const sex = Math.random() < 0.5 ? "M" : "F";
    const stats = {};
    STAT_KEYS.forEach((k) => {
      const avg = (sire.stats[k] + dam.stats[k]) / 2;
      const spread = inbred ? 14 : 9;
      const penalty = inbred ? -8 : 0;
      stats[k] = clamp(Math.round(avg + penalty + rand(-spread, spread)));
    });
    if (bandog) {
      ["gameness", "grip", "conformation", "speed"].forEach((k) => (stats[k] = clamp(stats[k] + randInt(5, 12))));
    } else if (crossBred) {
      const boosted = new Set();
      while (boosted.size < 2) boosted.add(STAT_KEYS[randInt(0, STAT_KEYS.length - 1)]);
      boosted.forEach((k) => (stats[k] = clamp(stats[k] + randInt(2, 5))));
    }
    const { traits, hiddenTraits, mstnAlleles } = inheritTraits(sire, dam);
    Object.assign(stats, applyTraitEffects(stats, traits, mstnAlleles));
    const colorGenes = inheritColorGenes(sire, dam);
    const { hiddenColor, hiddenPattern } = rollHiddenGenes(colorGenes, sire, dam);
    let heightIn, weightLb;
    if (bandogLineage) {
      ({ heightIn, weightLb } = bandogSize(sire, dam, inbred));
    } else {
      ({ heightIn, weightLb } = inheritSize(sire, dam, inbred));
      if (freshBandogCross) {
        heightIn = clamp(Math.round((heightIn + rand(0.5, 2)) * 10) / 10, 12, 32);
        weightLb = clamp(weightLb + randInt(8, 20), 18, 140);
      }
    }
    const grownSize = applyGrowthMutation(heightIn, weightLb, mstnAlleles);
    heightIn = grownSize.heightIn; weightLb = grownSize.weightLb;
    const grewBigger = grownSize.grew;
    let health = inbred ? randInt(55, 80) : 100;
    let impaired = false;
    if (colorGenes.merleAlleles === 2) {
      doubleMerleWarned = true;
      impaired = Math.random() < 0.7;
      if (impaired) {
        stats.nose = clamp(stats.nose - randInt(15, 30));
        stats.stamina = clamp(stats.stamina - randInt(5, 15));
        health = clamp(health - 20);
      }
    }
    /* Not every pup in a real litter is breeding or sale quality — a small
       chance of a genuinely below-par pup, worse odds in a close breeding. */
    const culled = Math.random() < (inbred ? 0.22 : 0.08);
    if (culled) {
      STAT_KEYS.forEach((k) => (stats[k] = clamp(stats[k] - randInt(10, 25))));
      health = clamp(health - randInt(10, 20));
    }
    pups.push({
      id: genId(), name: randomName(sex), breed: label, sex, stats, colorGenes, crossBred: crossBred || bandog, impaired,
      hiddenColor, hiddenPattern, traits, hiddenTraits, mstnAlleles, grewBigger, culled,
      heightIn, weightLb, registered: false, regNumber: null, bloodline: bloodline || null,
      health, ageDays: 0, sire: sire.name, dam: dam.name,
      temperament: inheritTemperament(sire, dam), titles: [], injury: null, pregnantDaysLeft: 0,
      pedigree: {
        sire: { name: sire.name, breed: sire.breed, colorGenes: sire.colorGenes, bloodline: sire.bloodline || null, regNumber: sire.regNumber || null, pedigree: sire.pedigree || null },
        dam: { name: dam.name, breed: dam.breed, colorGenes: dam.colorGenes, bloodline: dam.bloodline || null, regNumber: dam.regNumber || null, pedigree: dam.pedigree || null },
      },
      generation: Math.max(sire.generation, dam.generation) + 1, breedCooldown: 0, bornDay: day,
    });
  }
  return { pups, inbred, doubleMerleWarned, bandog, doubleMuscledCount: pups.filter((p) => p.mstnAlleles === 2).length, culledCount: pups.filter((p) => p.culled).length, grewBiggerCount: pups.filter((p) => p.grewBigger).length };
}

/* --------------------------------- horses --------------------------------- */
const horseRating = (stats) => Math.round(HORSE_STAT_KEYS.reduce((s, k) => s + stats[k], 0) / HORSE_STAT_KEYS.length);

/* Simplified real coat genetics: base coat (extension/agouti), a dilution
   gene (cream/dun/champagne/silver — cream is dosage-dependent, one copy
   vs two gives a different result), and an overlay pattern (grey, roan,
   tobiano/overo pinto, or appaloosa leopard complex). */
const HORSE_BASES = ["chestnut", "bay", "black"];
const HORSE_DILUTIONS = ["none", "cream", "dun", "champagne", "silver"];
const HORSE_PATTERNS = ["none", "grey", "roan", "tobiano", "overo", "appaloosa"];
function horseColorLabel(g) {
  if (g.pattern === "grey" && g.greyAlleles > 0) return "Grey";
  let base = g.base === "chestnut" ? "Chestnut" : g.base === "bay" ? "Bay" : "Black";
  if (g.dilution === "cream") {
    const table = {
      chestnut: ["", "Palomino", "Cremello"],
      bay: ["", "Buckskin", "Perlino"],
      black: ["", "Smoky Black", "Smoky Cream"],
    };
    base = table[g.base][g.dilutionAlleles] || base;
  } else if (g.dilution === "dun") {
    base = g.base === "chestnut" ? "Red Dun" : g.base === "bay" ? "Bay Dun" : "Grullo";
  } else if (g.dilution === "champagne") {
    base = g.base === "chestnut" ? "Gold Champagne" : g.base === "bay" ? "Amber Champagne" : "Classic Champagne";
  } else if (g.dilution === "silver" && g.base !== "chestnut") {
    base = g.base === "bay" ? "Silver Bay" : "Silver Black";
  }
  if (g.pattern === "roan") return base + " Roan";
  if (g.pattern === "tobiano") return base + " Tobiano Pinto";
  if (g.pattern === "overo") return base + " Overo Pinto";
  if (g.pattern === "appaloosa") return base + " Leopard Appaloosa";
  return base;
}
function generateHorseColorGenes(breedName) {
  const appaloosaBreeds = ["Appaloosa"];
  const pintoBreeds = ["Paint Horse", "Mustang"];
  const base = HORSE_BASES[randInt(0, 2)];
  const dilRoll = Math.random();
  const dilution = dilRoll < 0.12 ? "cream" : dilRoll < 0.2 ? "dun" : dilRoll < 0.25 ? "champagne" : dilRoll < 0.3 ? "silver" : "none";
  const dilutionAlleles = dilution === "cream" ? (Math.random() < 0.15 ? 2 : 1) : dilution !== "none" ? 1 : 0;
  let pattern = "none";
  const pr = Math.random();
  if (pr < 0.1) pattern = "grey";
  else if (pr < 0.16) pattern = "roan";
  else if (appaloosaBreeds.includes(breedName) ? pr < 0.75 : pr < 0.19) pattern = "appaloosa";
  else if (pintoBreeds.includes(breedName) ? pr < 0.7 : pr < 0.24) pattern = Math.random() < 0.5 ? "tobiano" : "overo";
  const greyAlleles = pattern === "grey" ? 1 : 0;
  return { base, dilution, dilutionAlleles, pattern, greyAlleles };
}
function inheritHorseColorGenes(sire, dam) {
  const pick = (a, b) => (Math.random() < 0.5 ? a : b);
  return {
    base: pick(sire.colorGenes.base, dam.colorGenes.base),
    dilution: pick(sire.colorGenes.dilution, dam.colorGenes.dilution),
    dilutionAlleles: Math.max(0, Math.round((sire.colorGenes.dilutionAlleles + dam.colorGenes.dilutionAlleles) / 2)),
    pattern: pick(sire.colorGenes.pattern, dam.colorGenes.pattern),
    greyAlleles: pick(sire.colorGenes.greyAlleles, dam.colorGenes.greyAlleles),
  };
}
const HORSE_NAMES_M = ["Trigger", "Whiskey", "Duke", "Cash", "Doc", "Ranger", "Bandit", "Copper", "Blaze", "Ace", "Smoke", "Colt 45", "Diesel", "Marshal", "Rebel", "Outlaw", "Champ", "Jack", "Storm", "Rowdy"];
const HORSE_NAMES_F = ["Buttercup", "Applejack", "Dixie", "Willow", "Sage", "Cheyenne", "Belle", "Ruby", "Sadie", "Misty", "Sable", "Jubilee", "Star", "Piper", "Daisy", "Roxy", "Comet", "Reata", "Sierra", "Honey"];

function generateRandomHorse(breedName, day) {
  const b = HORSE_BREEDS[breedName];
  const stats = {};
  HORSE_STAT_KEYS.forEach((k) => { stats[k] = clamp(Math.round(b.base[k] + rand(-9, 9))); });
  const sex = Math.random() < 0.5 ? "M" : "F";
  const hands = Math.round((b.hands[0] + Math.random() * (b.hands[1] - b.hands[0])) * 10) / 10;
  return {
    id: genId(), name: sex === "M" ? HORSE_NAMES_M[randInt(0, HORSE_NAMES_M.length - 1)] : HORSE_NAMES_F[randInt(0, HORSE_NAMES_F.length - 1)],
    breed: breedName, sex, stats, health: randInt(85, 100),
    ageDays: randInt(365, 1800), bornDay: null, hands,
    colorGenes: generateHorseColorGenes(breedName),
    sire: null, dam: null, generation: 1, registered: false, regNumber: null,
    breedCooldown: 0,
  };
}
function canBreedHorse(h) { return h.ageDays >= 730 && h.health >= 55 && h.breedCooldown <= 0 && !isAnimalRetired("horse", h) && !h.injury; }
function horseValue(h) {
  const rating = horseRating(h.stats);
  const breedMult = h.breed === "Thoroughbred" || h.breed === "Friesian" ? 1.3 : h.breed === "Clydesdale" || h.breed === "Percheron" || h.breed === "Belgian Draft" ? 1.15 : 1;
  return Math.round(rating * 55 * breedMult + (h.registered ? 400 : 0));
}
function breedFoal(sire, dam, day, bloodline) {
  const breedName = sire.breed === dam.breed ? sire.breed : `${sire.breed} × ${dam.breed} Cross`;
  const sex = Math.random() < 0.5 ? "M" : "F";
  const stats = {};
  HORSE_STAT_KEYS.forEach((k) => { stats[k] = clamp(Math.round((sire.stats[k] + dam.stats[k]) / 2 + rand(-8, 8))); });
  const hands = Math.round(((sire.hands + dam.hands) / 2 + rand(-0.4, 0.4)) * 10) / 10;
  return {
    id: genId(), name: sex === "M" ? HORSE_NAMES_M[randInt(0, HORSE_NAMES_M.length - 1)] : HORSE_NAMES_F[randInt(0, HORSE_NAMES_F.length - 1)],
    breed: breedName, sex, stats, health: 100, ageDays: 0, bornDay: day, hands,
    colorGenes: inheritHorseColorGenes(sire, dam),
    sire: sire.name, dam: dam.name, generation: Math.max(sire.generation, dam.generation) + 1,
    registered: false, regNumber: null, breedCooldown: 0, bloodline: bloodline || null,
  };
}

/* --------------------------------- cattle --------------------------------- */
const cattleRating = (stats) => Math.round(CATTLE_STAT_KEYS.reduce((s, k) => s + stats[k], 0) / CATTLE_STAT_KEYS.length);

function cattleColorLabel(breedName, g) {
  const b = CATTLE_BREEDS[breedName];
  // A crossbred calf's breed is a synthetic "X × Y Cross" label, not a real
  // CATTLE_BREEDS key — b is undefined here, so fall back to reading the
  // shape of the inherited genes themselves instead of crashing on b.pattern.
  if (!b) {
    if (g.roan) return g.roan === "solidRed" ? "Dark Red" : g.roan === "solidWhite" ? "White" : "Red Roan";
    if (g.shade) return g.shade;
    return "Mixed";
  }
  if (b.pattern === "roanCapable") return g.roan === "solidRed" ? "Dark Red" : g.roan === "solidWhite" ? "White" : "Red Roan";
  if (b.pattern === "varies") return g.shade + " Longhorn";
  return b.color;
}
function generateCattleColorGenes(breedName) {
  const b = CATTLE_BREEDS[breedName];
  if (b.pattern === "roanCapable") {
    const r = Math.random();
    return { roan: r < 0.15 ? "solidRed" : r < 0.3 ? "solidWhite" : "roan" };
  }
  if (b.pattern === "varies") {
    const shades = ["Red & White", "Black & White", "Brindle", "Solid Red", "Solid Black", "Speckled Grey", "Dun"];
    return { shade: shades[randInt(0, shades.length - 1)] };
  }
  return {};
}
function inheritCattleColorGenes(sire, dam) {
  const breedName = sire.breed === dam.breed ? sire.breed : null;
  if (breedName && CATTLE_BREEDS[breedName].pattern === "roanCapable") {
    const opts = ["solidRed", "roan", "roan", "solidWhite"];
    return { roan: opts[randInt(0, opts.length - 1)] };
  }
  if (breedName && CATTLE_BREEDS[breedName].pattern === "varies") return generateCattleColorGenes(breedName);
  return Math.random() < 0.5 ? sire.colorGenes : dam.colorGenes;
}
const CATTLE_NAMES = ["Big Red", "Bessie", "Duke", "Clover", "Moo-lan", "Tank", "Daisy", "Ferdinand", "Buttercup", "Bruno", "Rosie", "Diesel", "Patches", "Maple", "Ranger", "Pepper", "Dolly", "Otis", "Ginger", "Bruiser"];

function generateRandomCow(breedName, day) {
  const b = CATTLE_BREEDS[breedName];
  const stats = {};
  CATTLE_STAT_KEYS.forEach((k) => { stats[k] = clamp(Math.round(b.base[k] + rand(-8, 8))); });
  const sex = Math.random() < 0.4 ? "M" : "F";
  return {
    id: genId(), name: CATTLE_NAMES[randInt(0, CATTLE_NAMES.length - 1)],
    breed: breedName, sex, stats, health: randInt(85, 100),
    ageDays: randInt(365, 1500), bornDay: null,
    weightLb: Math.round(600 + (stats.weight / 100) * 900 + rand(-60, 60)),
    colorGenes: generateCattleColorGenes(breedName),
    sire: null, dam: null, generation: 1, registered: false, regNumber: null,
    breedCooldown: 0,
  };
}
function canBreedCow(c) { return c.ageDays >= 550 && c.health >= 55 && c.breedCooldown <= 0 && !isAnimalRetired("cattle", c) && !c.injury; }
function cattleAuctionValue(c) {
  return Math.round((c.stats.weight / 100) * c.weightLb * 1.35 + (c.stats.muscle / 100) * 400 + (c.registered ? 250 : 0));
}
function cattlePrivateValue(c) { return Math.round(cattleAuctionValue(c) * 0.7); }
function breedCalf(sire, dam, day, bloodline) {
  const breedName = sire.breed === dam.breed ? sire.breed : `${sire.breed} × ${dam.breed} Cross`;
  const stats = {};
  CATTLE_STAT_KEYS.forEach((k) => { stats[k] = clamp(Math.round((sire.stats[k] + dam.stats[k]) / 2 + rand(-7, 7))); });
  const sex = Math.random() < 0.5 ? "M" : "F";
  return {
    id: genId(), name: CATTLE_NAMES[randInt(0, CATTLE_NAMES.length - 1)],
    breed: breedName, sex, stats, health: 100, ageDays: 0, bornDay: day,
    weightLb: Math.round(65 + rand(-8, 8)),
    colorGenes: inheritCattleColorGenes(sire, dam),
    sire: sire.name, dam: dam.name, generation: Math.max(sire.generation, dam.generation) + 1,
    registered: false, regNumber: null, breedCooldown: 0, bloodline: bloodline || null,
  };
}

