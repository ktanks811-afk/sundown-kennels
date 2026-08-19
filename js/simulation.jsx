/* The simulation: hunts and catch weights, trials, the rival-kennel world
   that advances on its own, buyer offers, the social feed, fame tiers,
   net worth, kennel capacity, new-kennel setup, and save migration. */

function resolveHunt(dog, huntKey, day) {
  const hunt = HUNTS[huntKey];
  const season = seasonFor(day || 1);
  const prime = agePrime(dog);

  // Season bends scenting and wind; age bends everything. A dog past its prime
  // still hunts, it just doesn't hunt like it did at four.
  const seasoned = { ...dog.stats };
  seasoned.nose = clamp(seasoned.nose * season.scent);
  seasoned.stamina = clamp(seasoned.stamina * season.stamina);
  STAT_KEYS.forEach((k) => { seasoned[k] = clamp(seasoned[k] * prime.mult); });

  const raw = statScore(seasoned, hunt.weights);
  const roll = raw + rand(-15, 15) + temperamentBonus(dog, "hunt");
  let tier, payMult, injMult;
  if (roll >= 85) { tier = "Excellent"; payMult = 1.6; injMult = 0.5; }
  else if (roll >= 65) { tier = "Good"; payMult = 1.1; injMult = 0.8; }
  else if (roll >= 45) { tier = "Fair"; payMult = 0.62; injMult = 1.1; }
  else { tier = "Poor"; payMult = 0.28; injMult = 1.8; }
  const payout = Math.round(hunt.basePay * payMult * season.pay * (0.85 + Math.random() * 0.3));
  const injured = Math.random() < hunt.injuryRisk * injMult * season.injury * prime.injury;
  const healthLoss = injured ? randInt(18, 40) : randInt(3, 9);
  const injury = injured ? rollInjury(huntKey) : null;
  return { tier, payout, injured, healthLoss, injury, season: season.key };
}

/* --------------------------- age, decline, death --------------------------- */

/* Dogs used to be immortal — age only ever gated minimums, so a fifteen-year-old
   worked exactly like a two-year-old and there was never a reason to breed a
   replacement. This is the curve everything else hangs off. */
const AGE_PRIME_START = 730;    // 2 years
const AGE_PRIME_END   = 1825;   // 5 years
const AGE_VETERAN     = 2555;   // 7 years — decline begins in earnest
const AGE_RETIRE      = 3650;   // 10 years — no longer works or breeds

function agePrime(dog) {
  const a = dog.ageDays || 0;
  if (a < 365) return { mult: 0.82, injury: 1.25, stage: "young" };          // still filling out
  if (a < AGE_PRIME_START) return { mult: 0.94, injury: 1.1, stage: "rising" };
  if (a <= AGE_PRIME_END) return { mult: 1.0, injury: 1.0, stage: "prime" };
  if (a <= AGE_VETERAN) return { mult: 0.93, injury: 1.15, stage: "seasoned" };
  if (a <= AGE_RETIRE) {
    const over = (a - AGE_VETERAN) / (AGE_RETIRE - AGE_VETERAN);
    return { mult: 0.88 - over * 0.2, injury: 1.3 + over * 0.5, stage: "veteran" };
  }
  return { mult: 0.6, injury: 2.2, stage: "retired" };
}
function ageStageLabel(dog) {
  const s = agePrime(dog).stage;
  return { young: "Young", rising: "Coming on", prime: "In his prime", seasoned: "Seasoned", veteran: "Veteran", retired: "Retired" }[s];
}
function isRetired(dog) { return (dog.ageDays || 0) > AGE_RETIRE; }

/* Chance of dying on a given day, rising steeply after ten. Health matters:
   a beat-up old dog is far more fragile than a sound one. */
function deathChancePerDay(dog) {
  const a = dog.ageDays || 0;
  if (a < AGE_VETERAN) return 0;
  const years = a / 365;
  let base = Math.pow((years - 7) / 9, 2) * 0.0016;
  if (dog.health < 40) base *= 2.6;
  else if (dog.health < 70) base *= 1.4;
  return Math.min(base, 0.02);
}

/* --------------------- livestock ageing (horses, cattle) ------------------- */

/* Horses and cattle carried an ageDays field that nothing ever incremented, so
   a thirty-year-old mare worked like a three-year-old and no horse ever died.
   Dogs can't share the dog curve here — a horse peaks between five and fifteen,
   a cow between two and eight. Years, not days, because that's how people
   actually talk about stock. */
const LIFESPANS = {
  horse:  { rising: 3,  primeFrom: 5,  primeTo: 15, veteran: 20, retire: 28, deathFrom: 18, workAge: 3,   breedAge: 2 },
  cattle: { rising: 1.5, primeFrom: 2, primeTo: 8,  veteran: 12, retire: 18, deathFrom: 11, workAge: 1.5, breedAge: 1.5 },
};

function animalYears(animal) { return (animal.ageDays || 0) / 365; }

function animalPrime(kind, animal) {
  const L = LIFESPANS[kind];
  if (!L) return { mult: 1, injury: 1, stage: "prime" };
  const y = animalYears(animal);
  if (y < L.rising) return { mult: 0.78, injury: 1.3, stage: "young" };
  if (y < L.primeFrom) return { mult: 0.92, injury: 1.1, stage: "rising" };
  if (y <= L.primeTo) return { mult: 1, injury: 1, stage: "prime" };
  if (y <= L.veteran) return { mult: 0.93, injury: 1.2, stage: "seasoned" };
  if (y <= L.retire) {
    const over = (y - L.veteran) / (L.retire - L.veteran);
    return { mult: 0.86 - over * 0.22, injury: 1.35 + over * 0.6, stage: "veteran" };
  }
  return { mult: 0.58, injury: 2.2, stage: "retired" };
}

function animalStageLabel(kind, animal) {
  return { young: "Young", rising: "Coming on", prime: "In its prime", seasoned: "Seasoned", veteran: "Veteran", retired: "Retired" }[animalPrime(kind, animal).stage];
}
function isAnimalRetired(kind, animal) {
  const L = LIFESPANS[kind];
  return L ? animalYears(animal) > L.retire : false;
}
function animalDeathChancePerDay(kind, animal) {
  const L = LIFESPANS[kind];
  if (!L) return 0;
  const y = animalYears(animal);
  if (y < L.deathFrom) return 0;
  const span = Math.max(1, L.retire - L.deathFrom);
  let base = Math.pow((y - L.deathFrom) / span, 2) * 0.0014;
  if (animal.health < 40) base *= 2.6;
  else if (animal.health < 70) base *= 1.4;
  return Math.min(base, 0.02);
}

/* One pass shared by both species: age, heal, run down injury and breeding
   clocks, and roll for old age. Returns the survivors plus what happened. */
function ageLivestock(list, kind, days, recovery) {
  const deaths = [];
  const survivors = (list || []).map((a) => {
    const next = {
      ...a,
      ageDays: (a.ageDays || 0) + days,
      health: clamp((a.health || 100) + recovery * days),
      breedCooldown: Math.max(0, (a.breedCooldown || 0) - days),
    };
    if (next.injury && next.injury.daysLeft > 0) {
      const left = next.injury.daysLeft - days;
      next.injury = left <= 0 ? null : { ...next.injury, daysLeft: left };
    }
    for (let i = 0; i < days; i++) {
      if (Math.random() < animalDeathChancePerDay(kind, next)) { deaths.push(next); return null; }
    }
    return next;
  }).filter(Boolean);
  return { survivors, deaths };
}

/* ------------------------------- injuries --------------------------------- */

const INJURIES = {
  cutShoulder: { label: "Cut shoulder", days: 14, desc: "Laid open on a tusk. Needs stitches and rest." },
  tornEar:     { label: "Torn ear",     days: 7,  desc: "Ugly but shallow. Heals clean." },
  crackedTooth:{ label: "Cracked tooth",days: 10, desc: "Caught bone wrong. Sore on the bite for a while." },
  strainedLeg: { label: "Strained leg", days: 18, desc: "Pulled up lame coming out of the thick stuff." },
  puncture:    { label: "Puncture",     days: 21, desc: "Deep and dirty — this is the one that goes septic." },
  brokenRib:   { label: "Cracked rib",  days: 28, desc: "Took a hit going in. Nothing to do but wait." },
};
const INJURY_KEYS = Object.keys(INJURIES);

function rollInjury(huntKey) {
  const heavy = huntKey === "hog";
  const pool = heavy ? INJURY_KEYS : ["tornEar", "strainedLeg", "crackedTooth"];
  const key = pool[randInt(0, pool.length - 1)];
  return { key, daysLeft: INJURIES[key].days + randInt(-3, 4) };
}

/* ------------------------------- avatars ---------------------------------- */

/* Resize whatever the player picked down to a square thumbnail before it goes
   anywhere near the database. A phone photo is 3-6MB; this lands around 30KB,
   which is small enough to live in a column instead of needing a storage
   bucket and its own policy surface. */
const AVATAR_PX = 256;
const AVATAR_MAX_BYTES = 400000;

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file chosen."));
    if (!/^image\//.test(file.type)) return reject(new Error("That's not an image file."));
    if (file.size > 12 * 1024 * 1024) return reject(new Error("That image is over 12MB — pick a smaller one."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Couldn't decode that image."));
      img.onload = () => resolve(img);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* Centre-crop to a square so portrait and landscape photos both come out
   looking deliberate rather than squashed. */
function imageToAvatarDataUrl(img) {
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_PX; canvas.height = AVATAR_PX;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_PX, AVATAR_PX);
  for (const q of [0.82, 0.7, 0.6, 0.5]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length <= AVATAR_MAX_BYTES) return url;
  }
  return canvas.toDataURL("image/jpeg", 0.4);
}

function usernameError(name) {
  const v = (name || "").trim();
  if (v.length < 3) return "Pick something at least 3 characters long.";
  if (v.length > 24) return "That's over 24 characters.";
  if (!/^[A-Za-z0-9 ._-]+$/.test(v)) return "Letters, numbers, spaces, dots, dashes and underscores only.";
  return null;
}

function initialsFor(nameOrEmail) {
  const s = (nameOrEmail || "?").trim();
  const parts = s.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

/* ----------------------------- timed events -------------------------------- */

/* Barrel racing and flat racing are run against a clock in real life, and the
   game was resolving both as a plain win/lose with no time at all — so there
   was nothing to hold a record with. Ability pulls the clock down towards a
   floor nobody beats; age and condition push it back up. */
function raceTime(kind, animal, ev) {
  if (!ev || !ev.timed) return null;
  const t = ev.timed;
  const ability = clamp(statScore(animal.stats, ev.weights));       // 0-100
  const prime = animalPrime(kind, animal);
  const condition = clamp(animal.health) / 100;

  // A perfect animal in its prime approaches the floor but never quite reaches it.
  let secs = t.par - (t.par - t.floor) * (ability / 100);
  secs += (1 - prime.mult) * t.spread * 0.9;      // out of its prime costs real time
  secs += (1 - condition) * t.spread * 0.55;      // so does being sore
  secs += rand(-0.35, 0.9);                       // the day itself
  if (animal.injury) secs += t.spread * 0.4;

  return Math.max(t.floor, Math.round(secs * 100) / 100);
}
function formatRaceTime(secs) {
  return typeof secs === "number" ? secs.toFixed(2) + "s" : "—";
}
/* Personal bests live in the save so they survive signed out. */
function personalBest(state, eventKey) {
  const pb = (state.raceBests || {})[eventKey];
  return pb || null;
}
function withPersonalBest(state, eventKey, entry) {
  const bests = { ...(state.raceBests || {}) };
  const current = bests[eventKey];
  if (!current || entry.seconds < current.seconds) bests[eventKey] = entry;
  return { ...state, raceBests: bests };
}

/* ------------------------------- titles ----------------------------------- */

/* Real registries prefix a dog's name once it's earned something. Titles make
   achievement permanent and visible everywhere the dog appears. */
const TITLES = [
  { key: "CH",   label: "Champion",       wins: 3 },
  { key: "GRCH", label: "Grand Champion", wins: 8 },
  { key: "SUPCH",label: "Supreme Champion", wins: 16 },
];
function titleFor(wins) {
  let earned = null;
  TITLES.forEach((t) => { if (wins >= t.wins) earned = t; });
  return earned;
}
function titledName(dog) {
  const t = titleFor(dog.trialWins || 0);
  return t ? `${t.key} ${dog.name}` : dog.name;
}

/* --------------------------- temperament traits ---------------------------- */

/* Two dogs with identical stats used to play identically. Temperament is what
   breeders actually argue about, so it belongs in the pedigree. */
const TEMPERAMENTS = {
  biddable:   { label: "Biddable",    desc: "Wants to please. Takes training faster than most.", train: 1.4, hunt: 0, trial: 3 },
  hardHeaded: { label: "Hard-headed", desc: "Own mind about everything. Slow to train, hard to stop.", train: 0.6, hunt: 4, trial: -3 },
  hotNosed:   { label: "Hot-nosed",   desc: "Opens on old sign. Busy, but covers ground.", train: 1, hunt: 2, trial: -1 },
  coldNosed:  { label: "Cold-nosed",  desc: "Works a stale track patiently. Slow and certain.", train: 1, hunt: 3, trial: 0 },
  gunShy:     { label: "Gun-shy",     desc: "Flinches at the shot. A real fault in a gun dog.", train: 0.8, hunt: -6, trial: -2 },
  steady:     { label: "Steady",      desc: "Nothing rattles her. Same dog every time out.", train: 1.1, hunt: 1, trial: 4 },
  bold:       { label: "Bold",        desc: "First to the bay and last to quit.", train: 0.9, hunt: 5, trial: 1 },
};
const TEMPERAMENT_KEYS = Object.keys(TEMPERAMENTS);
function rollTemperament() {
  const r = Math.random();
  if (r < 0.10) return null;                       // plain dogs exist
  return TEMPERAMENT_KEYS[randInt(0, TEMPERAMENT_KEYS.length - 1)];
}
function inheritTemperament(sire, dam) {
  const pool = [sire.temperament, dam.temperament].filter(Boolean);
  if (!pool.length || Math.random() < 0.35) return rollTemperament();
  return pool[randInt(0, pool.length - 1)];
}
function temperamentBonus(dog, kind) {
  const t = dog.temperament && TEMPERAMENTS[dog.temperament];
  if (!t) return 0;
  return kind === "hunt" ? t.hunt : kind === "trial" ? t.trial : 0;
}
function trainingMultiplier(dog) {
  const t = dog.temperament && TEMPERAMENTS[dog.temperament];
  return t ? t.train : 1;
}
function catchWeight(huntKey, tier, groupSize) {
  if (huntKey !== "hog") return null;
  const n = groupSize || 1;
  let lo, hi;
  if (tier === "Excellent") { lo = 220; hi = 480; }
  else if (tier === "Good") { lo = 150; hi = 320; }
  else if (tier === "Fair") { lo = 100; hi = 220; }
  else { lo = 100; hi = 160; }
  let weight = randInt(lo, hi);
  if (n > 1) {
    const groupMult = 1 + (n - 1) * 0.35;
    weight = Math.round(weight * groupMult);
    if (tier === "Excellent" && n >= 3) {
      const crit = Math.random();
      if (crit < 0.004) weight = randInt(1000, 1200);       // ~1 in 250 — veryyyyy super rare
      else if (crit < 0.02) weight = randInt(700, 999);      // ~1.6%
      else if (crit < 0.08) weight = randInt(500, 699);      // ~6%
    }
  }
  return clamp(weight, 100, 1200);
}
/* Bigger hog, bigger payday — this is the main hog-hunt income driver now. */
function hogPayout(weightLbs) { return Math.round(weightLbs * rand(2.5, 3.5)); }

/* Upkeep used to be a flat $4/dog/day regardless of size. Now the size genetics
   the game already simulates carry an economic consequence. */
function feedCostPerDay(dog, upgrades) {
  const lb = dog.weightLb || 50;
  let cost = 2 + lb * 0.045;                  // ~$3.35 for a 30lb feist, ~$11 for a 200lb boerboel
  if (dog.ageDays < 90) cost *= 0.6;          // pups eat less
  if (upgrades && upgrades.feedSilo) cost *= 0.75;
  return cost;
}
function kennelUpkeepPerDay(dogs, upgrades) {
  return dogs.reduce((s, d) => s + feedCostPerDay(d, upgrades), 0);
}

/* ----------------------------- hunt reports ------------------------------- */

/* The hunt is the emotional centre of the game and it used to resolve in one
   flat sentence. This gives it a strike, a middle and an ending. */
const HUNT_OPENERS = {
  hog:      ["Cut loose at first grey light.", "Turned out along the creek bottom.", "Struck sign in the cutover before sunup.", "Dropped the tailgate at the edge of the thick stuff."],
  coon:     ["Turned out under a bright moon.", "Cast off along the ridge after dark.", "Struck a track at the field edge.", "Worked the creek line by lamplight."],
  trail:    ["Picked up the line where the blood started.", "Put on the track cold, hours behind.", "Started at the last sign and worked out."],
  squirrel: ["Eased into the hickories after breakfast.", "Worked the timber edge with the young dogs.", "Turned out in the river oaks."],
};
const TIER_MIDDLE = {
  Excellent: ["Struck early, drove hard, and never once lost the line.", "Handled it like a dog twice the experience.", "Made it look easy from the first cast."],
  Good:      ["Worked steady and honest through the heavy cover.", "Took a check or two but sorted it out alone.", "Held the line where a lesser dog would have quit."],
  Fair:      ["Ran hot and lost time doubling back.", "Took a while to settle, then did the job.", "Nothing pretty about it, but it got done."],
  Poor:      ["Never really got started.", "Trailed off and came back empty.", "Couldn't get it worked out and gave up on it."],
};

function huntReport(dog, hunt, result, payout, weightLbs, day) {
  const season = seasonFor(day || 1);
  const key = Object.keys(HUNTS).find((k) => HUNTS[k].label === hunt.label) || "hog";
  const open = HUNT_OPENERS[key] || HUNT_OPENERS.hog;
  const opener = open[randInt(0, open.length - 1)];
  const mid = TIER_MIDDLE[result.tier][randInt(0, TIER_MIDDLE[result.tier].length - 1)];

  let close;
  if (result.injured && result.injury) {
    const inj = INJURIES[result.injury.key];
    close = `Came out of it with a ${inj.label.toLowerCase()} — ${Math.round(result.injury.daysLeft)} days off. Paid ${fmtMoney(payout)}.`;
  } else if (weightLbs && weightLbs >= 700) {
    close = `Caught a ${weightLbs}lb boar — a genuine monster. ${fmtMoney(payout)} at the buyer.`;
  } else if (weightLbs) {
    close = `Caught at ${weightLbs}lb. ${fmtMoney(payout)} at the buyer.`;
  } else {
    close = `${fmtMoney(payout)} for the night's work.`;
  }

  const seasonNote = season.key === "summer" && result.injured ? " The heat did him no favours."
    : season.key === "winter" && result.tier === "Excellent" ? " Cold ground held the scent all morning."
    : "";

  return `${dog.name} — ${opener} ${mid}${seasonNote} ${close}`;
}
function canHunt(dog) { return dog.ageDays >= 90 && dog.health >= 35 && !isRetired(dog) && !dog.injury; }
function canBreed(dog) { return dog.ageDays >= 300 && dog.health >= 50 && dog.breedCooldown <= 0 && !isRetired(dog); }
function statusOf(dog) {
  if (dog.injury) return { label: INJURIES[dog.injury.key] ? INJURIES[dog.injury.key].label : "Injured", tone: "rust" };
  if (dog.health < 35) return { label: "Injured", tone: "rust" };
  if (isRetired(dog)) return { label: "Retired", tone: "tan" };
  if (dog.ageDays < 90) return { label: "Pup", tone: "denim" };
  if (dog.pregnantDaysLeft > 0) return { label: "In whelp", tone: "gold" };
  if (dog.breedCooldown > 0) return { label: "Resting", tone: "tan" };
  if (agePrime(dog).stage === "veteran") return { label: "Veteran", tone: "tan" };
  return { label: "Ready", tone: "olive" };
}
function generateMarket(n, day) {
  return Array.from({ length: n }, () => {
    const dog = generateRandomDog();
    const price = Math.round(computeValue(dog) * rand(1.05, 1.45));
    return { ...dog, price, listedDay: day };
  });
}
function initAiKennels() {
  const out = {};
  AI_KENNEL_DEFS.forEach((def) => {
    const dogs = [0, 1].map((i) => {
      const sex = i === 0 ? "M" : "F";
      const d = generateAiDog(def.focusBreed);
      d.sex = sex; d.name = randomName(sex); d.ageDays = randInt(350, 900);
      return d;
    });
    out[def.id] = { id: def.id, name: def.name, focusBreed: def.focusBreed, dogs };
  });
  return out;
}
function simulateAiWorld(aiKennels, days, currentDay) {
  const kennels = {};
  const newListings = [];
  const newCatches = [];
  Object.values(aiKennels).forEach((k) => {
    let dogs = k.dogs.map((d) => ({ ...d }));
    for (let step = 0; step < days; step++) {
      const simDay = currentDay + step + 1;
      dogs = dogs.map((d) => ({ ...d, ageDays: d.ageDays + 1 }));
      if (Math.random() < 0.22) {
        const eligible = dogs.filter(canHunt);
        if (eligible.length) {
          const dog = eligible[randInt(0, eligible.length - 1)];
          const huntKey = pickWeighted({ hog: 0.55, coon: 0.2, trail: 0.1, squirrel: 0.15 });
          const result = resolveHunt(dog, huntKey, simDay);
          if (result.tier !== "Poor") {
            const weightLbs = catchWeight(huntKey, result.tier);
            const payout = huntKey === "hog" && weightLbs ? hogPayout(weightLbs) : result.payout;
            newCatches.push({ id: genId(), day: simDay, kennelName: k.name, dogName: dog.name, breed: dog.breed, huntType: HUNTS[huntKey].label, tier: result.tier, weightLbs, payout });
          }
        }
      }
      if (dogs.length < 7 && Math.random() < 0.05) {
        const males = dogs.filter((x) => x.sex === "M" && canBreed(x));
        const females = dogs.filter((x) => x.sex === "F" && canBreed(x));
        if (males.length && females.length) {
          const sire = males[randInt(0, males.length - 1)];
          const dam = females[randInt(0, females.length - 1)];
          const { pups } = breedPuppies(sire, dam, simDay);
          dogs = dogs.concat(pups.map((p) => ({ ...p, health: 100 })));
        }
      }
      if (dogs.length > 5 && Math.random() < 0.2) {
        const sellable = dogs.filter((x) => x.ageDays >= 90);
        if (sellable.length) {
          const dog = sellable[randInt(0, sellable.length - 1)];
          dogs = dogs.filter((x) => x.id !== dog.id);
          newListings.push({ ...dog, price: Math.round(computeValue(dog) * rand(1.0, 1.3)), listedDay: simDay, sellerName: k.name });
        }
      }
      while (dogs.length > 7) {
        dogs = dogs.slice().sort((a, b) => overallRating(a.stats) - overallRating(b.stats));
        const weakest = dogs.shift();
        newListings.push({ ...weakest, price: Math.round(computeValue(weakest) * rand(0.9, 1.1)), listedDay: simDay, sellerName: k.name });
      }
    }
    kennels[k.id] = { ...k, dogs };
  });
  return { kennels, newListings, newCatches };
}

const OFFER_BUYER_FLAVOR = ["A traveling breeder passing through", "A hunt club rep from three counties over", "A collector from out of state", "An old-timer looking to restock", "A weekend hobbyist with cash to spend"];
/* Random social events — other kennels inviting you along on a hunt,
   someone offering above market for a dog they've heard about, or a fellow
   breeder asking to pair one of their dogs with one of yours. Rolled per
   simulated day so they show up naturally as time passes. */
function rollNewOffers(dogs, day, existingCount) {
  const offers = [];
  if (existingCount >= 6) return offers;
  if (dogs.some(canHunt) && Math.random() < 0.10) {
    const kennel = AI_KENNEL_DEFS[randInt(0, AI_KENNEL_DEFS.length - 1)];
    offers.push({ id: genId(), type: "hunt", kennelName: kennel.name, day, expiresDay: day + 3 });
  }
  if (dogs.length > 0 && Math.random() < 0.08) {
    const target = dogs[randInt(0, dogs.length - 1)];
    const buyerPool = [...AI_KENNEL_DEFS.map((k) => k.name), ...OFFER_BUYER_FLAVOR];
    const buyerName = buyerPool[randInt(0, buyerPool.length - 1)];
    const price = Math.round(computeValue(target) * rand(1.2, 1.85));
    offers.push({ id: genId(), type: "purchase", buyerName, dogId: target.id, dogName: target.name, price, day, expiresDay: day + 3 });
  }
  const breedable = dogs.filter(canBreed);
  if (breedable.length > 0 && Math.random() < 0.07) {
    const target = breedable[randInt(0, breedable.length - 1)];
    const requesterSex = target.sex === "M" ? "F" : "M";
    const requesterBreed = BREED_NAMES[randInt(0, BREED_NAMES.length - 1)];
    const requesterDog = generateAiDog(requesterBreed);
    requesterDog.sex = requesterSex;
    requesterDog.name = randomName(requesterSex);
    requesterDog.ageDays = randInt(380, 900);
    const kennel = AI_KENNEL_DEFS[randInt(0, AI_KENNEL_DEFS.length - 1)];
    const fee = Math.round(computeValue(target) * rand(0.25, 0.45));
    offers.push({ id: genId(), type: "breeding_request", kennelName: kennel.name, requesterDog, targetDogId: target.id, targetDogName: target.name, fee, day, expiresDay: day + 3 });
  }
  return offers;
}
/* Fame drives how much the county's talking about you — higher fame means
   more frequent mentions in the social feed. */
function rollSocialPosts(kennelName, dogs, fame, existingCount) {
  const posts = [];
  if (existingCount >= 10) return posts;
  const chance = 0.05 + Math.min(fame / 400, 0.25);
  if (Math.random() < chance) {
    const dog = dogs.length ? dogs[randInt(0, dogs.length - 1)] : null;
    const { handle, text } = socialPostText(kennelName, dog);
    posts.push({ id: genId(), handle, text });
  }
  return posts;
}
function collectStuds(aiKennels) {
  const studs = [];
  Object.values(aiKennels).forEach((k) => {
    k.dogs.filter((d) => d.sex === "M" && canBreed(d)).forEach((d) => studs.push({ ...d, kennelName: k.name }));
  });
  return studs;
}
function studFee(dog) { return Math.round(computeValue(dog) * 0.35); }
function registrationFee(dog) { return Math.max(40, Math.round(computeValue(dog) * 0.08)); }

function collectCompetitors(aiKennels) {
  const list = [];
  Object.values(aiKennels).forEach((k) => {
    k.dogs.filter(canHunt).forEach((d) => list.push({ ...d, kennelName: k.name }));
  });
  return list;
}
function resolveTrial(myDog, oppDog, trialKey) {
  const t = TRIALS[trialKey];
  const scoreMe = statScore(myDog.stats, t.weights) + rand(-12, 12);
  const scoreOpp = statScore(oppDog.stats, t.weights) + rand(-12, 12);
  const won = scoreMe >= scoreOpp;
  const margin = Math.abs(scoreMe - scoreOpp);
  const healthLoss = randInt(2, 8);
  return { won, margin: Math.round(margin), healthLoss };
}
function trialPurse(myDog, oppDog) { return Math.round(30 + (computeValue(myDog) + computeValue(oppDog)) * 0.02); }

function kennelNetWorth(state) {
  return Math.round(state.cash + state.dogs.reduce((s, d) => s + computeValue(d), 0));
}
/* Fame builds from show wins, trial wins, and big catches — media attention
   is mostly a show-ring thing in real dog sports, so conformation wins pay
   out the most fame here. */
const FAME_TIERS = [
  { min: 0, label: "Unknown" },
  { min: 15, label: "Locally Known" },
  { min: 40, label: "Regional Name" },
  { min: 80, label: "County Famous" },
  { min: 150, label: "State Renowned" },
  { min: 260, label: "Living Legend" },
];
function fameTier(fame) {
  let t = FAME_TIERS[0];
  for (const f of FAME_TIERS) { if (fame >= f.min) t = f; }
  return t;
}
const FAN_HANDLES = ["HogHunter_Dale", "CountyKennelWatch", "SouthernCurClub", "BullyBloodlinesTV", "TreeDogNation", "RuralWorkingDogs", "BackwoodsBreeder22", "GameDogGazette"];
function socialPostText(kennelName, dog) {
  const templates = [
    () => `@${kennelName} congrats on the new litter — that's a good-looking bunch of pups.`,
    () => dog ? `@${kennelName} that ${dog.name} y'all got is looking real good this season.` : `@${kennelName} y'all's kennel is looking sharp lately.`,
    () => `@${kennelName} heard talk about a rare pup out of your place, that true?`,
    () => `@${kennelName} killing it at the shows lately, respect.`,
    () => dog ? `@${kennelName} how much for a pup outta your ${dog.name}?` : `@${kennelName} taking any inquiries on pups right now?`,
    () => `@${kennelName} solid hunting stock, been hearing good things.`,
  ];
  const pick = templates[randInt(0, templates.length - 1)]();
  const handle = FAN_HANDLES[randInt(0, FAN_HANDLES.length - 1)];
  return { handle, text: pick };
}
/* Horses and cattle share one engine — same market/breeding/show/trade/
   rivals/stud-board mechanics as dogs, just pointed at different data.
   This config is what makes that reuse possible instead of writing (and
   maintaining) three near-identical copies of everything. */
const LIVESTOCK_CONFIG = {
  horse: {
    label: "Horse", labelPlural: "Horses", arrayKey: "horses", marketKey: "horseMarket",
    breeds: HORSE_BREEDS, breedNames: HORSE_BREED_NAMES, statKeys: HORSE_STAT_KEYS, statLabels: HORSE_STAT_LABELS,
    rating: horseRating, generate: generateRandomHorse, breed: breedFoal, canBreed: canBreedHorse,
    value: horseValue, events: HORSE_SHOWS, colorLabel: (a) => horseColorLabel(a.colorGenes),
    breedCooldownSire: 20, breedCooldownDam: 60, breedHealthCost: 18,
    sizeLabel: (a) => `${a.hands}hh`,
  },
  cattle: {
    label: "Cow", labelPlural: "Cattle", arrayKey: "cattle", marketKey: "cattleMarket",
    breeds: CATTLE_BREEDS, breedNames: CATTLE_BREED_NAMES, statKeys: CATTLE_STAT_KEYS, statLabels: CATTLE_STAT_LABELS,
    rating: cattleRating, generate: generateRandomCow, breed: breedCalf, canBreed: canBreedCow,
    value: cattlePrivateValue, auctionValue: cattleAuctionValue, events: CATTLE_SHOWS, colorLabel: (a) => cattleColorLabel(a.breed, a.colorGenes),
    breedCooldownSire: 15, breedCooldownDam: 55, breedHealthCost: 16,
    sizeLabel: (a) => `${a.weightLb}lb`,
  },
};
const LIVESTOCK_SELLERS = AI_KENNEL_DEFS.map((k) => k.name);
function generateAnimalMarket(kind, n, day) {
  const cfg = LIVESTOCK_CONFIG[kind];
  return Array.from({ length: n }, () => {
    const breedName = cfg.breedNames[randInt(0, cfg.breedNames.length - 1)];
    const a = cfg.generate(breedName, day);
    const price = Math.round(cfg.value(a) * rand(0.85, 1.35));
    return { ...a, price, listedDay: day, sellerName: LIVESTOCK_SELLERS[randInt(0, LIVESTOCK_SELLERS.length - 1)] };
  });
}

/* Sexes used to be rolled independently, so a run of six could come up all one
   sex and leave a new player unable to breed at all — with nothing telling them
   why. Three of each, shuffled, guarantees a workable pair is always on offer. */
function generateStarterCandidates() {
  const shuffled = BREED_NAMES.slice().sort(() => Math.random() - 0.5).slice(0, 6);
  const sexes = ["M", "M", "M", "F", "F", "F"].sort(() => Math.random() - 0.5);
  return shuffled.map((breed, i) => {
    const sex = sexes[i];
    const dog = generateRandomDog(breed);
    dog.sex = sex;
    dog.name = randomName(sex);
    dog.ageDays = randInt(380, 600);
    return dog;
  });
}
function initKennel(kennelName, starterDogs) {
  const day = 1;
  const starters = (starterDogs && starterDogs.length === 2) ? starterDogs : [
    { ...generateRandomDog("American Pit Bull Terrier"), name: "Diesel", sex: "M", ageDays: 420 },
    { ...generateRandomDog("Catahoula Leopard Dog"), name: "Ruby", sex: "F", ageDays: 380 },
  ];
  const name = (kennelName && kennelName.trim()) || "Sundown Kennels";
  const base = {
    kennelName: name, day, cash: 2500, dogs: starters,
    property: STARTER_PROPERTY,
    market: generateMarket(4, day),
    aiKennels: initAiKennels(),
    catches: [],
    nextRegNumber: 1,
    netWorthHistory: [],
    offers: [],
    fame: 0,
    xp: 0,
    entries: [],
    professions: {},
    socialFeed: [],
    inventory: { kibble: 2, woundSalve: 1 },
    upgrades: {},
    rescue: generateRescuePool(3, day),
    rescueRefreshedDay: day,
    horses: [], horseMarket: generateAnimalMarket("horse", 4, day),
    cattle: [], cattleMarket: generateAnimalMarket("cattle", 4, day),
    truck: "none", trailer: "none",
    log: [{ day, type: "info", text: `${name} established. Stud book opened.` }],
  };
  base.netWorthHistory = [{ day, netWorth: kennelNetWorth(base) }];
  return base;
}
/* ------------------------- levels and professions -------------------------- */

/* XP rides on the log rather than being sprinkled through every action. Every
   notable thing the game does already funnels through addLog, so hooking it
   here means nothing can award XP and forget to, and nothing can be added
   later that silently awards none. */
const XP_BY_LOG = { hunt: 14, catch: 14, breed: 18, money: 5, injury: 3, info: 1 };

/* Each level costs a little more than the last. Deliberately shallow: this
   paces the profession points, it is not meant to be a grind of its own. */
function xpForLevel(level) { return 40 + 25 * (level - 1); }

function levelFromXp(xp) {
  let level = 1, spent = 0, need = xpForLevel(1);
  while (xp >= spent + need && level < 99) {
    spent += need;
    level += 1;
    need = xpForLevel(level);
  }
  return { level, into: Math.max(0, xp - spent), need, pct: Math.min(100, Math.round(((xp - spent) / need) * 100)) };
}

/* One point every other level, capped at the fifteen it takes to max all five
   tracks — so a long-running kennel eventually has every option open, but
   spends a long time choosing. */
function professionPointsTotal(level) { return Math.min(15, Math.floor(level / 2)); }
function professionPointsSpent(professions) {
  return PROFESSION_KEYS.reduce((sum, k) => sum + ((professions || {})[k] || 0), 0);
}
function professionPointsLeft(state) {
  const { level } = levelFromXp((state && state.xp) || 0);
  return professionPointsTotal(level) - professionPointsSpent(state && state.professions);
}

/* The multiplier a track contributes, as a plain number to multiply by: a
   Houndsman on 2 points returns 1.10. Everything that reads this treats a
   missing professions object as zero points, so old saves just get 1. */
function professionBonus(state, key) {
  const points = ((state && state.professions) || {})[key] || 0;
  const def = PROFESSIONS[key];
  return def ? 1 + points * def.per : 1;
}

/* A flat daily wage that scales with level, so a mature kennel has a floor
   under it and a bad hunting week is a setback rather than a spiral. */
function dailySalary(state) {
  const { level } = levelFromXp((state && state.xp) || 0);
  return 12 + level * 6;
}

function addLog(state, type, text) {
  return {
    ...state,
    xp: ((state.xp || 0) + (XP_BY_LOG[type] || 1)),
    log: [{ day: state.day, type, text }, ...state.log].slice(0, 60),
  };
}

/* Older saves predate the store, rescue pen, and upgrades. Rather than bump the
   storage key and wipe everyone's kennel, fill in whatever's missing on load. */
function migrateState(s) {
  if (!s || typeof s !== "object") return s;
  const out = { ...s };
  if (!out.inventory || typeof out.inventory !== "object") out.inventory = { kibble: 2, woundSalve: 1 };
  if (!out.upgrades || typeof out.upgrades !== "object") out.upgrades = {};
  if (!Array.isArray(out.rescue)) out.rescue = generateRescuePool(3, out.day || 1);
  if (typeof out.rescueRefreshedDay !== "number") out.rescueRefreshedDay = out.day || 1;
  if (typeof out.fame !== "number") out.fame = 0;
  if (typeof out.xp !== "number") out.xp = 0;
  if (!Array.isArray(out.entries)) out.entries = [];
  if (!out.professions || typeof out.professions !== "object") out.professions = {};
  if (!Array.isArray(out.socialFeed)) out.socialFeed = [];
  if (!out.property || typeof out.property !== "object") out.property = STARTER_PROPERTY;
  else if (!out.property.pastureKey) out.property = { ...out.property, pastureKey: "none" };
  if (!Array.isArray(out.horses)) out.horses = [];
  if (!Array.isArray(out.horseMarket)) out.horseMarket = generateAnimalMarket("horse", 4, out.day || 1);
  if (!Array.isArray(out.cattle)) out.cattle = [];
  if (!Array.isArray(out.cattleMarket)) out.cattleMarket = generateAnimalMarket("cattle", 4, out.day || 1);
  if (!out.truck) out.truck = "none";
  if (!out.trailer) out.trailer = "none";
  if (!Array.isArray(out.goalsDone)) out.goalsDone = [];

  // Dogs predating temperament, titles, injuries and gestation. Existing dogs
  // get a temperament rolled once so old saves aren't full of blank dogs.
  if (Array.isArray(out.dogs)) {
    out.dogs = out.dogs.map((d) => ({
      ...d,
      temperament: d.temperament === undefined ? rollTemperament() : d.temperament,
      titles: Array.isArray(d.titles) ? d.titles : [],
      injury: d.injury === undefined ? null : d.injury,
      pregnantDaysLeft: typeof d.pregnantDaysLeft === "number" ? d.pregnantDaysLeft : 0,
    }));
  }
  return out;
}

const STORAGE_KEY = "kennel-save-v7";
const THEME_KEY = "kennel-theme";
