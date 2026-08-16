/* The simulation: hunts and catch weights, trials, the rival-kennel world
   that advances on its own, buyer offers, the social feed, fame tiers,
   net worth, kennel capacity, new-kennel setup, and save migration. */

function resolveHunt(dog, huntKey) {
  const hunt = HUNTS[huntKey];
  const raw = statScore(dog.stats, hunt.weights);
  const roll = raw + rand(-15, 15);
  let tier, payMult, injMult;
  if (roll >= 85) { tier = "Excellent"; payMult = 1.6; injMult = 0.5; }
  else if (roll >= 65) { tier = "Good"; payMult = 1.1; injMult = 0.8; }
  else if (roll >= 45) { tier = "Fair"; payMult = 0.62; injMult = 1.1; }
  else { tier = "Poor"; payMult = 0.28; injMult = 1.8; }
  const payout = Math.round(hunt.basePay * payMult * (0.85 + Math.random() * 0.3));
  const injured = Math.random() < hunt.injuryRisk * injMult;
  const healthLoss = injured ? randInt(18, 40) : randInt(3, 9);
  return { tier, payout, injured, healthLoss };
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
function canHunt(dog) { return dog.ageDays >= 90 && dog.health >= 35; }
function canBreed(dog) { return dog.ageDays >= 300 && dog.health >= 50 && dog.breedCooldown <= 0; }
function statusOf(dog) {
  if (dog.health < 35) return { label: "Injured", tone: "rust" };
  if (dog.ageDays < 90) return { label: "Pup", tone: "denim" };
  if (dog.breedCooldown > 0) return { label: "Resting", tone: "tan" };
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
          const result = resolveHunt(dog, huntKey);
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
function generateStarterCandidates() {
  const shuffled = BREED_NAMES.slice().sort(() => Math.random() - 0.5).slice(0, 6);
  return shuffled.map((breed) => {
    const sex = Math.random() < 0.5 ? "M" : "F";
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
    socialFeed: [],
    inventory: { kibble: 2, woundSalve: 1 },
    upgrades: {},
    rescue: generateRescuePool(3, day),
    rescueRefreshedDay: day,
    log: [{ day, type: "info", text: `${name} established. Stud book opened.` }],
  };
  base.netWorthHistory = [{ day, netWorth: kennelNetWorth(base) }];
  return base;
}
function addLog(state, type, text) { return { ...state, log: [{ day: state.day, type, text }, ...state.log].slice(0, 60) }; }

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
  if (!Array.isArray(out.socialFeed)) out.socialFeed = [];
  return out;
}

const STORAGE_KEY = "kennel-save-v7";
const THEME_KEY = "kennel-theme";
