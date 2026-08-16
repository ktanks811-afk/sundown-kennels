/* Static game data: breeds and their size/color profiles, hunts, trials,
   rival AI kennels, name pools, the tab list, the supply store catalog,
   kennel upgrades, land/property, rescue intake, and ranking scoring.

   Loaded first — everything else depends on these tables. */

const { useState, useEffect, useCallback, useRef } = React;

/* ---------------------------------- data ---------------------------------- */

const STAT_KEYS = ["gameness", "grip", "nose", "stamina", "speed", "conformation"];
const STAT_LABELS = { gameness: "Gameness", grip: "Grip", nose: "Nose", stamina: "Stamina", speed: "Speed", conformation: "Conformation" };

const BREEDS = {
  "American Pit Bull Terrier": { short: "APBT", base: { gameness: 85, grip: 82, nose: 45, stamina: 75, speed: 65, conformation: 68 } },
  "Catahoula Leopard Dog": { short: "Catahoula", base: { gameness: 62, grip: 55, nose: 80, stamina: 82, speed: 62, conformation: 65 } },
  "Black Mouth Cur": { short: "BM Cur", base: { gameness: 70, grip: 62, nose: 72, stamina: 78, speed: 58, conformation: 64 } },
  "Blue Lacy": { short: "Lacy", base: { gameness: 58, grip: 42, nose: 74, stamina: 70, speed: 87, conformation: 58 } },
  "Plott Hound": { short: "Plott", base: { gameness: 68, grip: 48, nose: 92, stamina: 80, speed: 58, conformation: 63 } },
  "Mountain Cur": { short: "Mtn Cur", base: { gameness: 63, grip: 54, nose: 76, stamina: 68, speed: 63, conformation: 60 } },
  "American Bulldog": { short: "Am Bulldog", base: { gameness: 74, grip: 88, nose: 40, stamina: 62, speed: 50, conformation: 72 } },
  "American Leopard Hound": { short: "Am Leopard Hound", base: { gameness: 65, grip: 50, nose: 85, stamina: 78, speed: 65, conformation: 62 } },
  "Treeing Walker Coonhound": { short: "Walker", base: { gameness: 60, grip: 35, nose: 88, stamina: 80, speed: 78, conformation: 62 } },
  "Redbone Coonhound": { short: "Redbone", base: { gameness: 62, grip: 38, nose: 85, stamina: 75, speed: 70, conformation: 63 } },
  "Bluetick Coonhound": { short: "Bluetick", base: { gameness: 63, grip: 45, nose: 87, stamina: 76, speed: 68, conformation: 66 } },
  "Dogo Argentino": { short: "Dogo", base: { gameness: 82, grip: 85, nose: 55, stamina: 78, speed: 68, conformation: 78 } },
  "Cane Corso": { short: "Corso", base: { gameness: 70, grip: 80, nose: 45, stamina: 60, speed: 50, conformation: 82 } },
  "Airedale Terrier": { short: "Airedale", base: { gameness: 68, grip: 62, nose: 68, stamina: 68, speed: 60, conformation: 66 } },
  "American Staffordshire Terrier": { short: "AmStaff", base: { gameness: 78, grip: 78, nose: 42, stamina: 68, speed: 62, conformation: 80 } },
  "Staffordshire Bull Terrier": { short: "Staffy", base: { gameness: 80, grip: 76, nose: 40, stamina: 64, speed: 60, conformation: 74 } },
  "American Bully": { short: "Am Bully", base: { gameness: 60, grip: 70, nose: 38, stamina: 52, speed: 44, conformation: 86 } },
  "Patterdale Terrier": { short: "Patterdale", base: { gameness: 88, grip: 68, nose: 70, stamina: 72, speed: 62, conformation: 55 } },
  "Jagdterrier": { short: "Jagd", base: { gameness: 90, grip: 66, nose: 78, stamina: 74, speed: 64, conformation: 56 } },
  "Mountain Feist": { short: "Feist", base: { gameness: 62, grip: 34, nose: 82, stamina: 66, speed: 80, conformation: 55 } },
  "Black and Tan Coonhound": { short: "B&T", base: { gameness: 58, grip: 36, nose: 90, stamina: 78, speed: 62, conformation: 68 } },
  "English Coonhound": { short: "English", base: { gameness: 60, grip: 38, nose: 86, stamina: 82, speed: 76, conformation: 64 } },
  "Majestic Tree Hound": { short: "Majestic", base: { gameness: 62, grip: 44, nose: 91, stamina: 74, speed: 48, conformation: 70 } },
  "Presa Canario": { short: "Presa", base: { gameness: 76, grip: 86, nose: 44, stamina: 62, speed: 52, conformation: 80 } },
  "Boerboel": { short: "Boerboel", base: { gameness: 72, grip: 87, nose: 42, stamina: 60, speed: 46, conformation: 83 } },
  "Dogue de Bordeaux": { short: "Bordeaux", base: { gameness: 66, grip: 84, nose: 40, stamina: 50, speed: 40, conformation: 81 } },
  "Rhodesian Ridgeback": { short: "Ridgeback", base: { gameness: 74, grip: 60, nose: 72, stamina: 84, speed: 76, conformation: 76 } },
  "Carolina Dog": { short: "Carolina", base: { gameness: 64, grip: 44, nose: 80, stamina: 80, speed: 74, conformation: 62 } },
  "German Shorthaired Pointer": { short: "GSP", base: { gameness: 58, grip: 36, nose: 88, stamina: 86, speed: 80, conformation: 72 } },
  "Beagle": { short: "Beagle", base: { gameness: 54, grip: 30, nose: 89, stamina: 70, speed: 58, conformation: 64 } },
};
const BREED_NAMES = Object.keys(BREEDS);

const HEIGHT_WEIGHT = {
  "American Pit Bull Terrier": { mH: [18, 21], fH: [17, 20], mW: [35, 60], fW: [30, 50] },
  "Catahoula Leopard Dog": { mH: [22, 24], fH: [22, 24], mW: [50, 95], fW: [50, 95] },
  "Black Mouth Cur": { mH: [18, 25], fH: [16, 23], mW: [50, 95], fW: [40, 80] },
  "Blue Lacy": { mH: [18, 21], fH: [18, 21], mW: [35, 55], fW: [25, 45] },
  "Plott Hound": { mH: [20, 25], fH: [20, 23], mW: [50, 60], fW: [40, 55] },
  "Mountain Cur": { mH: [18, 26], fH: [16, 24], mW: [30, 60], fW: [30, 60] },
  "American Bulldog": { mH: [22, 28], fH: [20, 26], mW: [70, 120], fW: [60, 100] },
  "American Leopard Hound": { mH: [21, 27], fH: [21, 27], mW: [35, 75], fW: [35, 75] },
  "Treeing Walker Coonhound": { mH: [22, 27], fH: [20, 25], mW: [55, 70], fW: [50, 65] },
  "Redbone Coonhound": { mH: [22, 27], fH: [21, 26], mW: [50, 70], fW: [45, 65] },
  "Bluetick Coonhound": { mH: [21, 27], fH: [21, 27], mW: [55, 80], fW: [45, 65] },
  "Dogo Argentino": { mH: [24, 26.5], fH: [24, 25.5], mW: [88, 100], fW: [80, 95] },
  "Cane Corso": { mH: [24, 27.5], fH: [23, 25.5], mW: [95, 110], fW: [85, 99] },
  "Airedale Terrier": { mH: [22, 24], fH: [22, 24], mW: [50, 70], fW: [50, 70] },
  "American Staffordshire Terrier": { mH: [18, 19], fH: [17, 18], mW: [55, 70], fW: [40, 55] },
  "Staffordshire Bull Terrier": { mH: [14, 16], fH: [14, 16], mW: [28, 38], fW: [24, 34] },
  "American Bully": { mH: [17, 20], fH: [16, 19], mW: [65, 110], fW: [55, 90] },
  "Patterdale Terrier": { mH: [12, 15], fH: [11, 14], mW: [11, 13], fW: [10, 12] },
  "Jagdterrier": { mH: [13, 16], fH: [13, 16], mW: [17, 22], fW: [16, 20] },
  "Mountain Feist": { mH: [12, 18], fH: [12, 18], mW: [12, 30], fW: [12, 30] },
  "Black and Tan Coonhound": { mH: [25, 27], fH: [23, 25], mW: [65, 110], fW: [65, 100] },
  "English Coonhound": { mH: [22, 27], fH: [21, 25], mW: [45, 65], fW: [40, 60] },
  "Majestic Tree Hound": { mH: [25, 30], fH: [24, 28], mW: [75, 110], fW: [65, 95] },
  "Presa Canario": { mH: [23, 26], fH: [22, 25], mW: [100, 130], fW: [85, 110] },
  "Boerboel": { mH: [24, 27], fH: [22, 25], mW: [150, 200], fW: [110, 154] },
  "Dogue de Bordeaux": { mH: [23, 27], fH: [23, 26], mW: [110, 145], fW: [99, 130] },
  "Rhodesian Ridgeback": { mH: [25, 27], fH: [24, 26], mW: [79, 90], fW: [64, 75] },
  "Carolina Dog": { mH: [17, 24], fH: [17, 24], mW: [30, 55], fW: [30, 50] },
  "German Shorthaired Pointer": { mH: [23, 25], fH: [21, 23], mW: [55, 70], fW: [45, 60] },
  "Beagle": { mH: [13, 15], fH: [13, 15], mW: [20, 30], fW: [20, 30] },
};

const COLOR_NAMES = ["black", "blue", "red", "fawn", "chocolate", "white", "buckskin", "yellow", "tricolor", "tan"];
const COLOR_HEX = { black: "#242019", blue: "#5c6773", red: "#a1552f", fawn: "#c9a06b", chocolate: "#5b3a2a", white: "#f1ead9", buckskin: "#b98f52", yellow: "#d6ac52", tricolor: "#453a2c", tan: "#c19a5b" };
const BREED_COLOR_PROFILE = {
  "American Pit Bull Terrier": { bases: ["black", "blue", "red", "fawn", "chocolate", "white"], patterns: { solid: 0.45, brindle: 0.35, piebald: 0.2 }, merleCapable: false },
  "Catahoula Leopard Dog": { bases: ["black", "red", "blue"], patterns: { solid: 0.25, merle: 0.55, brindle: 0.2 }, merleCapable: true },
  "Black Mouth Cur": { bases: ["red", "fawn", "yellow", "black"], patterns: { solid: 0.7, brindle: 0.3 }, merleCapable: false },
  "Blue Lacy": { bases: ["blue", "red", "tricolor"], patterns: { solid: 1 }, merleCapable: false },
  "Plott Hound": { bases: ["buckskin", "black"], patterns: { brindle: 0.6, saddle: 0.3, solid: 0.1 }, merleCapable: false },
  "Mountain Cur": { bases: ["yellow", "black", "blue"], patterns: { brindle: 0.45, solid: 0.5, merle: 0.05 }, merleCapable: true },
  "American Bulldog": { bases: ["white", "red", "black"], patterns: { piebald: 0.6, brindle: 0.25, solid: 0.15 }, merleCapable: false },
  "American Leopard Hound": { bases: ["blue", "black", "red", "yellow"], patterns: { merle: 0.5, brindle: 0.25, solid: 0.25 }, merleCapable: true },
  "Treeing Walker Coonhound": { bases: ["black", "tan"], patterns: { tricolor: 0.65, piebald: 0.35 }, merleCapable: false },
  "Redbone Coonhound": { bases: ["red"], patterns: { solid: 1 }, merleCapable: false },
  "Bluetick Coonhound": { bases: ["blue", "black"], patterns: { ticked: 0.85, solid: 0.15 }, merleCapable: false },
  "Dogo Argentino": { bases: ["white"], patterns: { solid: 1 }, merleCapable: false },
  "Cane Corso": { bases: ["black", "blue", "fawn", "red"], patterns: { solid: 0.6, brindle: 0.4 }, merleCapable: false },
  "Airedale Terrier": { bases: ["tan"], patterns: { saddle: 1 }, merleCapable: false },
  "American Staffordshire Terrier": { bases: ["blue", "black", "red", "fawn"], patterns: { solid: 0.5, brindle: 0.3, piebald: 0.2 }, merleCapable: false },
  "Staffordshire Bull Terrier": { bases: ["red", "fawn", "black", "white"], patterns: { solid: 0.45, brindle: 0.4, piebald: 0.15 }, merleCapable: false },
  "American Bully": { bases: ["blue", "black", "fawn", "chocolate", "white"], patterns: { solid: 0.5, piebald: 0.3, brindle: 0.2 }, merleCapable: true },
  "Patterdale Terrier": { bases: ["black", "chocolate", "red"], patterns: { solid: 0.9, piebald: 0.1 }, merleCapable: false },
  "Jagdterrier": { bases: ["black", "chocolate"], patterns: { saddle: 0.8, solid: 0.2 }, merleCapable: false },
  "Mountain Feist": { bases: ["white", "black", "red", "tricolor"], patterns: { piebald: 0.6, tricolor: 0.25, solid: 0.15 }, merleCapable: false },
  "Black and Tan Coonhound": { bases: ["black", "tan"], patterns: { saddle: 0.85, solid: 0.15 }, merleCapable: false },
  "English Coonhound": { bases: ["red", "white", "tricolor"], patterns: { ticked: 0.6, tricolor: 0.25, piebald: 0.15 }, merleCapable: false },
  "Majestic Tree Hound": { bases: ["black", "tan", "red"], patterns: { saddle: 0.5, tricolor: 0.3, solid: 0.2 }, merleCapable: false },
  "Presa Canario": { bases: ["fawn", "black", "buckskin"], patterns: { brindle: 0.7, solid: 0.3 }, merleCapable: false },
  "Boerboel": { bases: ["fawn", "red", "buckskin", "chocolate"], patterns: { solid: 0.7, brindle: 0.3 }, merleCapable: false },
  "Dogue de Bordeaux": { bases: ["red", "fawn"], patterns: { solid: 1 }, merleCapable: false },
  "Rhodesian Ridgeback": { bases: ["red", "fawn", "buckskin"], patterns: { solid: 1 }, merleCapable: false },
  "Carolina Dog": { bases: ["buckskin", "yellow", "red"], patterns: { solid: 0.8, saddle: 0.2 }, merleCapable: false },
  "German Shorthaired Pointer": { bases: ["chocolate", "white"], patterns: { ticked: 0.7, piebald: 0.3 }, merleCapable: false },
  "Beagle": { bases: ["tricolor", "tan", "white"], patterns: { tricolor: 0.7, piebald: 0.3 }, merleCapable: false },
};

const HUNTS = {
  hog: { label: "Hog Hunt", desc: "Bay and catch. Rewards grit and grip.", weights: { gameness: 0.35, grip: 0.35, stamina: 0.2, nose: 0.1 }, basePay: 240, injuryRisk: 0.32 },
  coon: { label: "Coon Hunt", desc: "Trail and tree. Rewards nose and wind.", weights: { nose: 0.4, stamina: 0.3, gameness: 0.2, speed: 0.1 }, basePay: 95, injuryRisk: 0.07 },
  trail: { label: "Blood Trailing", desc: "Track wounded game. Rewards nose and nerve.", weights: { nose: 0.5, gameness: 0.3, stamina: 0.2 }, basePay: 75, injuryRisk: 0.04 },
  squirrel: { label: "Squirrel Hunt", desc: "Light work for young dogs.", weights: { nose: 0.4, speed: 0.4, stamina: 0.2 }, basePay: 40, injuryRisk: 0.015 },
};

/* Real, legal competitive dog sports — not simulated animal violence. Dogs
   are judged side by side on performance, not set against each other. */
const TRIALS = {
  weightpull: { label: "Weight Pull", desc: "Drag a loaded sled the farthest. Rewards grit and grip.", weights: { gameness: 0.3, grip: 0.35, conformation: 0.35 } },
  catchcourse: { label: "Catch-Dog Course", desc: "Work a padded decoy against the clock. Rewards gameness and speed.", weights: { gameness: 0.4, speed: 0.3, grip: 0.3 } },
  treeingtrial: { label: "Treeing Trial", desc: "Find and tree the fastest. Rewards nose and stamina.", weights: { nose: 0.5, stamina: 0.5 } },
  show: { label: "Conformation Show", desc: "A bench show — judged on structure and breed type, not work ethic.", weights: { conformation: 1.0 } },
};

const AI_KENNEL_DEFS = [
  { id: "ai-redclay", name: "Redclay Kennels", focusBreed: "American Pit Bull Terrier" },
  { id: "ai-briar", name: "Briar Hollow Dogs", focusBreed: "Catahoula Leopard Dog" },
  { id: "ai-ironwood", name: "Ironwood Curs", focusBreed: "Black Mouth Cur" },
  { id: "ai-cypress", name: "Cypress Bend Kennels", focusBreed: "Plott Hound" },
  { id: "ai-stonegate", name: "Stonegate Bulldogges", focusBreed: "American Bulldog" },
  { id: "ai-lacyrun", name: "Lacy Run Ranch", focusBreed: "Blue Lacy" },
  { id: "ai-bayou", name: "Bayou Bluetick Kennels", focusBreed: "Bluetick Coonhound" },
  { id: "ai-cordoba", name: "Cordoba Dogo Ranch", focusBreed: "Dogo Argentino" },
];

/* --------------------------------- property --------------------------------- */
/* Kennel space is a real constraint: every property has a dog-capacity cap.
   Land size and house type each contribute capacity, and combine with a
   pool of location names for flavor — 12 land sizes x 9 house types x 16
   locations is 1,728 distinct listings, though the shop only surfaces the
   land x house price/capacity tiers (location is re-rolled for flavor) so
   it stays browsable. */
const LAND_SIZES = [
  { key: "rented", label: "Rented Lot", acres: 0, capacity: 8, price: 0 },
  { key: "quarter", label: "Quarter Acre Lot", acres: 0.25, capacity: 10, price: 3000 },
  { key: "half", label: "Half Acre Lot", acres: 0.5, capacity: 13, price: 6500 },
  { key: "one", label: "One Acre Lot", acres: 1, capacity: 16, price: 11000 },
  { key: "two", label: "Two Acre Lot", acres: 2, capacity: 20, price: 18000 },
  { key: "five", label: "Five Acre Homestead", acres: 5, capacity: 26, price: 32000 },
  { key: "ten", label: "Ten Acre Homestead", acres: 10, capacity: 33, price: 52000 },
  { key: "twenty", label: "Twenty Acre Spread", acres: 20, capacity: 42, price: 84000 },
  { key: "forty", label: "Forty Acre Spread", acres: 40, capacity: 53, price: 130000 },
  { key: "eighty", label: "Eighty Acre Ranch", acres: 80, capacity: 68, price: 210000 },
  { key: "onesixty", label: "160 Acre Ranch", acres: 160, capacity: 88, price: 340000 },
  { key: "section", label: "Full Section Ranch", acres: 640, capacity: 120, price: 620000 },
];
const HOUSE_TYPES = [
  { key: "none", label: "Bare Land, No House", capacity: 0, price: 0 },
  { key: "trailer", label: "Single-Wide", capacity: 1, price: 1200 },
  { key: "doublewide", label: "Double-Wide", capacity: 2, price: 3500 },
  { key: "starter", label: "Starter Farmhouse", capacity: 4, price: 9000 },
  { key: "farmhouse", label: "Farmhouse", capacity: 6, price: 18000 },
  { key: "ranch", label: "Ranch House", capacity: 9, price: 32000 },
  { key: "ranchkennel", label: "Ranch House w/ Kennel Wing", capacity: 14, price: 55000 },
  { key: "compound", label: "Custom Kennel Compound", capacity: 22, price: 95000 },
  { key: "showcompound", label: "Show Kennel Estate", capacity: 32, price: 160000 },
];
const LAND_LOCATIONS = [
  "Sundown Hollow", "Redclay Flats", "Cypress Bend", "Piney Ridge", "Copperhead Creek",
  "Briar Hollow", "Stonegate Pass", "Bayou Ridge", "Ironwood Flats", "Cordoba Draw",
  "Lacy Run", "Hog Wallow", "Blackjack Ridge", "Sawmill Bend", "Muddy Fork", "Cane Break",
];
const STARTER_PROPERTY = { landKey: "rented", houseKey: "none", location: "Sundown Hollow" };
function propertyCapacity(property) {
  const p = property || STARTER_PROPERTY;
  const land = LAND_SIZES.find((l) => l.key === p.landKey) || LAND_SIZES[0];
  const house = HOUSE_TYPES.find((h) => h.key === p.houseKey) || HOUSE_TYPES[0];
  return land.capacity + house.capacity;
}
function propertyLabel(property) {
  const p = property || STARTER_PROPERTY;
  const land = LAND_SIZES.find((l) => l.key === p.landKey) || LAND_SIZES[0];
  const house = HOUSE_TYPES.find((h) => h.key === p.houseKey) || HOUSE_TYPES[0];
  if (land.key === "rented") return "Rented lot in " + p.location;
  return house.key === "none" ? `${land.label} in ${p.location}` : `${house.label} on a ${land.label.toLowerCase()} in ${p.location}`;
}
function kennelCapacity(state) { return propertyCapacity(state.property); }

const NAMES_M = ["Diesel", "Cutter", "Duke", "Bo", "Ranger", "Scout", "Bull", "Tank", "Gunner", "Trapper", "Colt", "Reb", "Zeke", "Bandit", "Ridge", "Sarge", "Rowdy", "Ox", "Copperhead", "Dozer"];
const NAMES_F = ["Ruby", "Bella", "Trix", "Dixie", "Roxy", "Sadie", "Belle", "Piper", "Blaze", "Honey", "Willow", "Delta", "Sage", "Marlow", "Cricket", "Josie", "Rowan", "Huckleberry", "Fern", "Scrappy"];

const TABS = [
  { id: "overview", label: "Overview", icon: "◆", group: "Kennel" },
  { id: "kennel", label: "Kennel", icon: "⌂", group: "Kennel" },
  { id: "property", label: "Property", icon: "⬒", group: "Kennel" },
  { id: "hunt", label: "Hunt", icon: "✦", group: "Kennel" },
  { id: "breed", label: "Breed", icon: "❖", group: "Kennel" },
  { id: "trials", label: "Trials", icon: "▲", group: "Kennel" },
  { id: "market", label: "Market", icon: "$", group: "Economy" },
  { id: "shop", label: "Supply Store", icon: "▤", group: "Economy" },
  { id: "inventory", label: "Inventory", icon: "▣", group: "Economy" },
  { id: "rescue", label: "Rescue", icon: "♥", group: "Economy" },
  { id: "trade", label: "Trade", icon: "⇄", group: "Online" },
  { id: "rivals", label: "Rivals", icon: "⚑", group: "Online" },
  { id: "leaderboard", label: "Leaderboard", icon: "◎", group: "Online" },
  { id: "registry", label: "Registry", icon: "§", group: "Records" },
  { id: "rankings", label: "County Ranks", icon: "★", group: "Records" },
  { id: "hof", label: "Hall of Fame", icon: "♛", group: "Records" },
  { id: "log", label: "Ledger", icon: "≡", group: "Records" },
];

/* ------------------------------ supply store ------------------------------ */

const ITEM_CATEGORIES = [
  { id: "feed", label: "Feed & Nutrition", blurb: "Condition comes off the feed pan first. Better feed means faster recovery and slow, permanent gains." },
  { id: "med", label: "Veterinary", blurb: "Patch up a torn-up catch dog. Salve handles scrapes; a real vet kit puts a dog back to sound." },
  { id: "training", label: "Training Gear", blurb: "Conditioning trades health for permanent stat gains. Don't work a hurt dog." },
  { id: "cosmetic", label: "Collars & Tack", blurb: "Purely cosmetic. Colors show on the dog's card and in the stud book." },
  { id: "kennel", label: "Kennel Upgrades", blurb: "One-time buys that change how the whole yard runs. Expensive, permanent, worth it." },
];

/* stat: permanent gain. health: immediate change (negative = conditioning cost).
   Training gear is deliberately health-negative — the tradeoff is the game. */
const ITEMS = {
  kibble:       { name: "Bulk Kibble",         cat: "feed", price: 18,  desc: "Keeps weight on. Nothing fancy.",                         health: 5 },
  highProtein:  { name: "High-Protein Feed",   cat: "feed", price: 45,  desc: "Working-dog ration. Builds wind.",                        health: 10, stat: { stamina: 1 } },
  rawDiet:      { name: "Raw Diet",            cat: "feed", price: 80,  desc: "Meat, bone, organ. Hard-conditioned dogs thrive on it.",  health: 16, stat: { gameness: 1, grip: 1 } },
  perfBlend:    { name: "Performance Blend",   cat: "feed", price: 130, desc: "Competition ration. What the trial kennels feed.",        health: 22, stat: { stamina: 2, speed: 1 } },
  electrolytes: { name: "Electrolyte Mix",     cat: "feed", price: 30,  desc: "Pours back what a long hunt took out.",                   health: 13 },

  woundSalve:   { name: "Wound Salve",         cat: "med",  price: 40,  desc: "Cuts and scrapes. Field-standard.",                       health: 26 },
  antibiotics:  { name: "Antibiotics",         cat: "med",  price: 95,  desc: "For a hog cut gone hot. Clears infection.",               health: 46 },
  jointSupp:    { name: "Joint Supplement",    cat: "med",  price: 70,  desc: "Keeps an older dog sound and moving square.",             health: 14, stat: { conformation: 1 } },
  vetKit:       { name: "Full Vet Workup",     cat: "med",  price: 175, desc: "Sutures, fluids, rest. Brings a dog all the way back.",   heal: true },

  scentDrag:    { name: "Scent Drag",          cat: "training", price: 70,  desc: "Lay a line and let them work it out.",                stat: { nose: 3 },        health: -5 },
  flirtPole:    { name: "Flirt Pole",          cat: "training", price: 85,  desc: "Builds drive and foot speed.",                        stat: { speed: 3 },       health: -7 },
  springPole:   { name: "Spring Pole",         cat: "training", price: 95,  desc: "Hangs from the oak. Builds a jaw.",                    stat: { grip: 3 },        health: -8 },
  weightVest:   { name: "Weight Vest",         cat: "training", price: 110, desc: "Walk them heavy. Adds power everywhere.",              stat: { grip: 2, conformation: 1 }, health: -6 },
  showLead:     { name: "Show Lead & Table",   cat: "training", price: 60,  desc: "Stacking practice for the bench.",                     stat: { conformation: 2 }, health: -3 },
  bayPen:       { name: "Bay Pen Session",     cat: "training", price: 145, desc: "Controlled bay work. Reads a dog's nerve.",            stat: { gameness: 3 },    health: -10 },
  treadmill:    { name: "Slat Mill",           cat: "training", price: 210, desc: "The old standby. Nothing builds wind like it.",        stat: { stamina: 4 },     health: -9 },

  collarBrass:  { name: "Brass-Buckle Collar", cat: "cosmetic", price: 35, desc: "Heavy leather, brass hardware.",   collar: "#b08d3f" },
  collarRed:    { name: "Red Working Collar",  cat: "cosmetic", price: 28, desc: "Easy to spot in thick cover.",     collar: "#c2422d" },
  collarOrange: { name: "Blaze Orange Collar", cat: "cosmetic", price: 32, desc: "Safety orange. Hunt season legal.", collar: "#e0742a" },
  collarBlack:  { name: "Black Latigo Collar", cat: "cosmetic", price: 30, desc: "Plain, dark, and tough.",          collar: "#2e2e33" },
  collarTeal:   { name: "Turquoise Collar",    cat: "cosmetic", price: 34, desc: "Show ring flash.",                 collar: "#2f9c95" },
  collarCamo:   { name: "Camo Collar",         cat: "cosmetic", price: 38, desc: "Timber pattern.",                  collar: "#5c6a4a" },
  bandanaRed:   { name: "Red Bandana",         cat: "cosmetic", price: 22, desc: "Tied at the throat. Classic.",     collar: "#a8342a" },
  collarSilver: { name: "Silver Trial Collar", cat: "cosmetic", price: 90, desc: "Awarded look, bought price.",      collar: "#9fa6ad" },
};

/* One-time kennel upgrades. Each one changes a rule in the simulation. */
const UPGRADES = {
  feedSilo:     { name: "Feed Silo",        price: 1200, desc: "Buy feed in bulk. Cuts daily upkeep by a quarter." },
  vetShed:      { name: "Vet Shed",         price: 2000, desc: "On-site care. Dogs recover noticeably faster every day." },
  whelpingBox:  { name: "Whelping Barn",    price: 1500, desc: "Proper whelping quarters. Far fewer pups lost from a litter." },
  trainingYard: { name: "Training Yard",    price: 1800, desc: "Dedicated conditioning ground. Training gear gives more and costs less." },
  scentKennel:  { name: "Scent Kennel",     price: 1400, desc: "Purpose-built hound runs. Hunts pay better and injure less." },
};

const ITEM_IDS = Object.keys(ITEMS);
function itemsInCategory(cat) { return ITEM_IDS.filter((id) => ITEMS[id].cat === cat); }

/* Apply a purchased item to a dog. Returns the updated dog plus a log line.
   Training gains are capped at 100 and scale with the Training Yard upgrade. */
function applyItem(dog, itemId, upgrades) {
  const item = ITEMS[itemId];
  if (!item) return { dog, msg: null, ok: false };
  const up = upgrades || {};
  const next = { ...dog, stats: { ...dog.stats } };

  if (item.collar) {
    next.collar = item.collar;
    next.collarName = item.name;
    return { dog: next, ok: true, msg: `${dog.name} is wearing a ${item.name.toLowerCase()}.` };
  }

  if (item.heal) {
    next.health = 100;
    return { dog: next, ok: true, msg: `${dog.name} got a full workup and came back sound.` };
  }

  const gains = [];
  if (item.stat) {
    const bonus = up.trainingYard && item.cat === "training" ? 1 : 0;
    Object.entries(item.stat).forEach(([k, amt]) => {
      const before = next.stats[k];
      next.stats[k] = clamp(before + amt + bonus);
      const real = next.stats[k] - before;
      if (real > 0) gains.push(`+${real} ${STAT_LABELS[k].toLowerCase()}`);
    });
  }
  if (typeof item.health === "number") {
    let h = item.health;
    if (h < 0 && up.trainingYard) h = Math.round(h * 0.6);
    next.health = clamp(next.health + h);
  }

  const gainText = gains.length ? ` (${gains.join(", ")})` : "";
  const verb = item.cat === "training" ? "worked on the" : "got the";
  return { dog: next, ok: true, msg: `${dog.name} ${verb} ${item.name.toLowerCase()}${gainText}.` };
}

/* ------------------------------ rescue intake ------------------------------ */

const RESCUE_STORIES = [
  "Picked up as a stray off a county road. No collar, no tag.",
  "Surrendered when the owner's health went. Sound dog, hard luck.",
  "Pulled from a hoarding case. Thin, but the frame is there.",
  "Left behind when a hunting lease changed hands.",
  "Found in a drainage culvert after a storm. Tough as they come.",
  "Dropped at the shelter gate overnight. Nobody came back.",
  "Seized from a neglect case two counties over.",
  "Owner passed. Family couldn't keep the whole yard together.",
];

/* Rescues are cheap, unpapered, and beat up — but the genetics are a coin flip
   and occasionally you pull a very good dog out of the pen for $200. */
function generateRescueDog(day) {
  const dog = generateRandomDog();
  dog.health = randInt(28, 68);
  dog.registered = false;
  dog.ageDays = randInt(200, 1500);
  dog.hiddenColor = null;
  dog.hiddenPattern = null;
  dog.pedigree = null;
  dog.rescued = true;
  const value = computeValue(dog);
  return {
    id: "r" + dog.id,
    dog,
    story: RESCUE_STORIES[randInt(0, RESCUE_STORIES.length - 1)],
    fee: Math.max(75, Math.round(value * rand(0.18, 0.34))),
    listedDay: day,
  };
}
function generateRescuePool(n, day) {
  return Array.from({ length: n }, () => generateRescueDog(day));
}

/* ------------------------------- rankings -------------------------------- */

/* Kennels are scored on a blend of the things the game actually rewards:
   fame, the quality of the best dogs, and depth of the yard. */
function kennelScore({ fame, dogs }) {
  if (!dogs || !dogs.length) return Math.round(fame || 0);
  const rated = dogs.map((d) => overallRating(d.stats)).sort((a, b) => b - a);
  const best = rated[0] || 0;
  const topThree = rated.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, rated.length);
  return Math.round((fame || 0) * 1.6 + best * 2 + topThree * 1.5 + dogs.length * 4);
}

function buildRankings(state) {
  const rows = Object.values(state.aiKennels || {}).map((k) => {
    const dogs = k.dogs || [];
    // AI kennels don't track fame directly — infer it from the yard so the
    // tier labels actually spread out instead of all reading "Unknown".
    const best = dogs.length ? Math.max(...dogs.map((d) => overallRating(d.stats))) : 0;
    const inferred = Math.max(0, Math.round((best - 52) * 3.4 + dogs.length * 5));
    return { id: k.id, name: k.name, dogs, fame: typeof k.fame === "number" ? k.fame : inferred, isPlayer: false };
  });
  rows.push({ id: "player", name: state.kennelName, dogs: state.dogs, fame: state.fame || 0, isPlayer: true });
  return rows
    .map((r) => ({
      ...r,
      score: kennelScore(r),
      bestDog: (r.dogs || []).slice().sort((a, b) => overallRating(b.stats) - overallRating(a.stats))[0] || null,
    }))
    .sort((a, b) => b.score - a.score);
}

