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
