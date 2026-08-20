/* Static game data: breeds and their size/color profiles, hunts, trials,
   rival AI kennels, name pools, the tab list, the supply store catalog,
   kennel upgrades, land/property, rescue intake, and ranking scoring.

   Loaded first — everything else depends on these tables. */

const { useState, useEffect, useCallback, useRef } = React;

/* ---------------------------------- data ---------------------------------- */

const STAT_KEYS = ["gameness", "grip", "nose", "stamina", "speed", "conformation"];
const STAT_LABELS = { gameness: "Gameness", grip: "Grip", nose: "Nose", stamina: "Stamina", speed: "Speed", conformation: "Conformation" };

const BREEDS = {
  "American Pit Bull Terrier": { group: "terrier", short: "APBT", base: { gameness: 85, grip: 82, nose: 45, stamina: 75, speed: 65, conformation: 68 } },
  "Catahoula Leopard Dog": { group: "cur", short: "Catahoula", base: { gameness: 62, grip: 55, nose: 80, stamina: 82, speed: 62, conformation: 65 } },
  "Black Mouth Cur": { group: "cur", short: "BM Cur", base: { gameness: 70, grip: 62, nose: 72, stamina: 78, speed: 58, conformation: 64 } },
  "Blue Lacy": { group: "cur", short: "Lacy", base: { gameness: 58, grip: 42, nose: 74, stamina: 70, speed: 87, conformation: 58 } },
  "Plott Hound": { group: "hound", short: "Plott", base: { gameness: 68, grip: 48, nose: 92, stamina: 80, speed: 58, conformation: 63 } },
  "Mountain Cur": { group: "cur", short: "Mtn Cur", base: { gameness: 63, grip: 54, nose: 76, stamina: 68, speed: 63, conformation: 60 } },
  "American Bulldog": { group: "bulldog", short: "Am Bulldog", base: { gameness: 74, grip: 88, nose: 40, stamina: 62, speed: 50, conformation: 72 } },
  "American Leopard Hound": { group: "cur", short: "Am Leopard Hound", base: { gameness: 65, grip: 50, nose: 85, stamina: 78, speed: 65, conformation: 62 } },
  "Treeing Walker Coonhound": { group: "hound", short: "Walker", base: { gameness: 60, grip: 35, nose: 88, stamina: 80, speed: 78, conformation: 62 } },
  "Redbone Coonhound": { group: "hound", short: "Redbone", base: { gameness: 62, grip: 38, nose: 85, stamina: 75, speed: 70, conformation: 63 } },
  "Bluetick Coonhound": { group: "hound", short: "Bluetick", base: { gameness: 63, grip: 45, nose: 87, stamina: 76, speed: 68, conformation: 66 } },
  "Dogo Argentino": { group: "bulldog", short: "Dogo", base: { gameness: 82, grip: 85, nose: 55, stamina: 78, speed: 68, conformation: 78 } },
  "Cane Corso": { group: "bulldog", short: "Corso", base: { gameness: 70, grip: 80, nose: 45, stamina: 60, speed: 50, conformation: 82 } },
  "Airedale Terrier": { group: "terrier", short: "Airedale", base: { gameness: 68, grip: 62, nose: 68, stamina: 68, speed: 60, conformation: 66 } },
  "American Staffordshire Terrier": { group: "terrier", short: "AmStaff", base: { gameness: 78, grip: 78, nose: 42, stamina: 68, speed: 62, conformation: 80 } },
  "Staffordshire Bull Terrier": { group: "terrier", short: "Staffy", base: { gameness: 80, grip: 76, nose: 40, stamina: 64, speed: 60, conformation: 74 } },
  "American Bully": { group: "terrier", short: "Am Bully", base: { gameness: 60, grip: 70, nose: 38, stamina: 52, speed: 44, conformation: 86 } },
  "Patterdale Terrier": { group: "terrier", short: "Patterdale", base: { gameness: 88, grip: 68, nose: 70, stamina: 72, speed: 62, conformation: 55 } },
  "Jagdterrier": { group: "terrier", short: "Jagd", base: { gameness: 90, grip: 66, nose: 78, stamina: 74, speed: 64, conformation: 56 } },
  "Mountain Feist": { group: "cur", short: "Feist", base: { gameness: 62, grip: 34, nose: 82, stamina: 66, speed: 80, conformation: 55 } },
  "Black and Tan Coonhound": { group: "hound", short: "B&T", base: { gameness: 58, grip: 36, nose: 90, stamina: 78, speed: 62, conformation: 68 } },
  "English Coonhound": { group: "hound", short: "English", base: { gameness: 60, grip: 38, nose: 86, stamina: 82, speed: 76, conformation: 64 } },
  "Majestic Tree Hound": { group: "hound", short: "Majestic", base: { gameness: 62, grip: 44, nose: 91, stamina: 74, speed: 48, conformation: 70 } },
  "Presa Canario": { group: "bulldog", short: "Presa", base: { gameness: 76, grip: 86, nose: 44, stamina: 62, speed: 52, conformation: 80 } },
  "Boerboel": { group: "bulldog", short: "Boerboel", base: { gameness: 72, grip: 87, nose: 42, stamina: 60, speed: 46, conformation: 83 } },
  "Dogue de Bordeaux": { group: "bulldog", short: "Bordeaux", base: { gameness: 66, grip: 84, nose: 40, stamina: 50, speed: 40, conformation: 81 } },
  "Rhodesian Ridgeback": { group: "gundog", short: "Ridgeback", base: { gameness: 74, grip: 60, nose: 72, stamina: 84, speed: 76, conformation: 76 } },
  "Carolina Dog": { group: "cur", short: "Carolina", base: { gameness: 64, grip: 44, nose: 80, stamina: 80, speed: 74, conformation: 62 } },
  "German Shorthaired Pointer": { group: "gundog", short: "GSP", base: { gameness: 58, grip: 36, nose: 88, stamina: 86, speed: 80, conformation: 72 } },
  "Beagle": { group: "hound", short: "Beagle", base: { gameness: 54, grip: 30, nose: 89, stamina: 70, speed: 58, conformation: 64 } },
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
const STARTER_PROPERTY = { landKey: "rented", houseKey: "none", pastureKey: "none", location: "Sundown Hollow" };
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

/* --------------------------------- pasture --------------------------------- */
/* Horses and cattle need grazing land, not just a house lot — a shared
   capacity pool between the two, gated by how much land you actually own
   (no horse pasture on a rented lot). */
const PASTURE_TIERS = [
  { key: "none", label: "No Pasture", capacity: 0, price: 0, minAcres: 0 },
  { key: "paddock", label: "Small Paddock", capacity: 3, price: 4000, minAcres: 1 },
  { key: "horsepasture", label: "Horse Pasture", capacity: 7, price: 9500, minAcres: 2 },
  { key: "cattlepasture", label: "Cattle Pasture", capacity: 12, price: 17000, minAcres: 5 },
  { key: "mixedrange", label: "Mixed Livestock Range", capacity: 20, price: 31000, minAcres: 10 },
  { key: "grandranch", label: "Grand Ranch Pasture", capacity: 35, price: 62000, minAcres: 20 },
  { key: "vastrange", label: "Vast Grazing Range", capacity: 60, price: 115000, minAcres: 40 },
];
function pastureCapacity(property) {
  const tier = PASTURE_TIERS.find((p) => p.key === (property || {}).pastureKey) || PASTURE_TIERS[0];
  return tier.capacity;
}
function livestockCapacity(state) { return pastureCapacity(state.property); }
function livestockCount(state) { return (state.horses || []).length + (state.cattle || []).length; }

/* --------------------------------- hauling --------------------------------- */
/* Getting an animal to a show or auction means loading it up — you need a
   truck with enough tow capacity for whatever trailer you're pulling.
   Pickups handle a couple of head; an actual 18-wheeler can move a
   trailer load at once. */
const TRUCKS = [
  { key: "none", label: "No Truck", brand: null, tow: 0, price: 0 },
  { key: "f250", label: "Ford F-250 Super Duty", brand: "Ford", tow: 12000, price: 42000 },
  { key: "f350dually", label: "Ford F-350 Dually", brand: "Ford", tow: 21000, price: 58000 },
  { key: "silverado2500", label: "Chevrolet Silverado 2500HD", brand: "Chevrolet", tow: 14500, price: 45000 },
  { key: "silverado3500", label: "Chevrolet Silverado 3500HD", brand: "Chevrolet", tow: 20000, price: 60000 },
  { key: "ram2500", label: "RAM 2500", brand: "RAM", tow: 13500, price: 44000 },
  { key: "ram3500dually", label: "RAM 3500 Dually", brand: "RAM", tow: 21000, price: 61000 },
  { key: "sierra3500", label: "GMC Sierra 3500HD Denali", brand: "GMC", tow: 20000, price: 68000 },
  { key: "kenworthT370", label: "Kenworth T370", brand: "Kenworth", tow: 52000, price: 145000 },
  { key: "peterbilt337", label: "Peterbilt 337", brand: "Peterbilt", tow: 54000, price: 152000 },
  { key: "freightlinerM2", label: "Freightliner M2 106", brand: "Freightliner", tow: 50000, price: 138000 },
  { key: "internationalMV", label: "International MV Series", brand: "International", tow: 51000, price: 141000 },
];
const TRAILERS = [
  { key: "none", label: "No Trailer", price: 0, capacity: 0, weightReq: 0 },
  { key: "bumper2horse", label: "2-Horse Bumper Pull Trailer", capacity: 2, weightReq: 6000, price: 6500 },
  { key: "stock3", label: "3-Head Stock Trailer", capacity: 3, weightReq: 9000, price: 9000 },
  { key: "gooseneck4horse", label: "4-Horse Gooseneck Trailer", capacity: 4, weightReq: 11000, price: 14000 },
  { key: "stock6", label: "6-Head Stock Trailer", capacity: 6, weightReq: 14000, price: 17000 },
  { key: "gooseneckstock10", label: "10-Head Gooseneck Stock Trailer", capacity: 10, weightReq: 18000, price: 26000 },
  { key: "semilivestock", label: "53' Semi Livestock Pot Trailer", capacity: 24, weightReq: 45000, price: 62000 },
];
function currentTruck(state) { return TRUCKS.find((t) => t.key === state.truck) || TRUCKS[0]; }
function currentTrailer(state) { return TRAILERS.find((t) => t.key === state.trailer) || TRAILERS[0]; }
function canHaul(state) {
  const truck = currentTruck(state), trailer = currentTrailer(state);
  return truck.key !== "none" && trailer.key !== "none" && truck.tow >= trailer.weightReq;
}
function haulCapacity(state) { return canHaul(state) ? currentTrailer(state).capacity : 0; }

/* --------------------------------- horses --------------------------------- */
const HORSE_STAT_KEYS = ["speed", "stamina", "agility", "conformation", "temperament", "strength"];
const HORSE_STAT_LABELS = { speed: "Speed", stamina: "Stamina", agility: "Agility", conformation: "Conformation", temperament: "Temperament", strength: "Strength" };

/* Real working/show breeds with realistic relative strengths — a Quarter
   Horse isn't going to out-endure an Arabian, a Clydesdale isn't winning
   a barrel race. */
const HORSE_BREEDS = {
  "Quarter Horse": { short: "Quarter Horse", hands: [14.3, 16], base: { speed: 78, stamina: 68, agility: 78, conformation: 74, temperament: 80, strength: 68 } },
  "Thoroughbred": { short: "Thoroughbred", hands: [15.2, 17], base: { speed: 95, stamina: 78, agility: 72, conformation: 78, temperament: 58, strength: 55 } },
  "Arabian": { short: "Arabian", hands: [14.1, 15.1], base: { speed: 72, stamina: 96, agility: 76, conformation: 82, temperament: 68, strength: 45 } },
  "Appaloosa": { short: "Appaloosa", hands: [14.2, 15.2], base: { speed: 68, stamina: 74, agility: 72, conformation: 68, temperament: 78, strength: 62 } },
  "Paint Horse": { short: "Paint", hands: [14.2, 16], base: { speed: 74, stamina: 66, agility: 76, conformation: 72, temperament: 80, strength: 64 } },
  "Mustang": { short: "Mustang", hands: [13.2, 15], base: { speed: 66, stamina: 88, agility: 70, conformation: 55, temperament: 52, strength: 60 } },
  "Andalusian": { short: "Andalusian", hands: [15, 16.2], base: { speed: 62, stamina: 65, agility: 82, conformation: 92, temperament: 76, strength: 58 } },
  "Friesian": { short: "Friesian", hands: [15.3, 17], base: { speed: 58, stamina: 62, agility: 66, conformation: 95, temperament: 82, strength: 74 } },
  "Tennessee Walking Horse": { short: "TN Walker", hands: [14.3, 17], base: { speed: 58, stamina: 72, agility: 60, conformation: 74, temperament: 88, strength: 55 } },
  "Morgan": { short: "Morgan", hands: [14.1, 15.2], base: { speed: 64, stamina: 74, agility: 70, conformation: 76, temperament: 82, strength: 62 } },
  "Standardbred": { short: "Standardbred", hands: [15, 16.2], base: { speed: 84, stamina: 82, agility: 58, conformation: 66, temperament: 72, strength: 58 } },
  "Clydesdale": { short: "Clydesdale", hands: [16.2, 18], base: { speed: 38, stamina: 62, agility: 35, conformation: 80, temperament: 78, strength: 98 } },
  "Percheron": { short: "Percheron", hands: [16, 18], base: { speed: 36, stamina: 66, agility: 32, conformation: 78, temperament: 74, strength: 100 } },
  "Belgian Draft": { short: "Belgian", hands: [16.2, 18], base: { speed: 34, stamina: 64, agility: 30, conformation: 76, temperament: 80, strength: 99 } },
  "Miniature Horse": { short: "Mini", hands: [7, 8.2], base: { speed: 40, stamina: 50, agility: 60, conformation: 60, temperament: 90, strength: 15 } },
};
const HORSE_BREED_NAMES = Object.keys(HORSE_BREEDS);

/* Real equine competitions, each rewarding a different mix of stats. */
const HORSE_SHOWS = {
  barrelracing: { label: "Barrel Racing", desc: "Cloverleaf pattern against the clock. Rewards speed and agility.", weights: { speed: 0.45, agility: 0.35, temperament: 0.2 },
    timed: { par: 17.4, spread: 4.6, floor: 12.8, unit: "s", blurb: "Cloverleaf, three barrels. A good run is under 15 seconds." } },
  reining: { label: "Reining", desc: "Spins, sliding stops, precise patterns. Rewards agility and temperament.", weights: { agility: 0.4, temperament: 0.35, conformation: 0.25 } },
  racing: { label: "Flat Racing", desc: "Straight-up speed over a quarter mile. Rewards speed and stamina.", weights: { speed: 0.55, stamina: 0.45 },
    timed: { par: 24.2, spread: 5.2, floor: 20.1, unit: "s", blurb: "440 yards from a standing start. Anything under 21 is track-record pace." } },
  halter: { label: "Halter / Conformation", desc: "Judged standing, structure and breed type only.", weights: { conformation: 1.0 } },
  jumping: { label: "Show Jumping", desc: "Clear a course of fences. Rewards agility and conformation.", weights: { agility: 0.45, conformation: 0.3, temperament: 0.25 } },
  pulling: { label: "Pulling Competition", desc: "Draft strength event — drag a weighted sled.", weights: { strength: 0.6, stamina: 0.4 } },
};

/* --------------------------------- cattle --------------------------------- */
const CATTLE_STAT_KEYS = ["weight", "muscle", "conformation", "temperament", "hardiness"];
const CATTLE_STAT_LABELS = { weight: "Weight", muscle: "Muscle", conformation: "Conformation", temperament: "Temperament", hardiness: "Hardiness" };

/* Real beef (and a couple of iconic dairy/novelty) breeds. Coat colour on
   cattle is mostly fixed by breed rather than freely segregating like
   dogs or horses — Herefords are always red with a white face, Charolais
   are always white — so genetics here is mostly "pick the breed's look,"
   with a roan option on the breeds that are actually roan-capable. */
const CATTLE_BREEDS = {
  "Angus": { color: "Black", pattern: "solid", base: { weight: 78, muscle: 82, conformation: 76, temperament: 74, hardiness: 74 } },
  "Red Angus": { color: "Red", pattern: "solid", base: { weight: 76, muscle: 80, conformation: 76, temperament: 76, hardiness: 76 } },
  "Hereford": { color: "Red", pattern: "whiteface", base: { weight: 80, muscle: 74, conformation: 78, temperament: 78, hardiness: 78 } },
  "Charolais": { color: "White", pattern: "solid", base: { weight: 92, muscle: 88, conformation: 74, temperament: 62, hardiness: 66 } },
  "Simmental": { color: "Red & White", pattern: "pied", base: { weight: 88, muscle: 84, conformation: 76, temperament: 68, hardiness: 70 } },
  "Limousin": { color: "Golden Red", pattern: "solid", base: { weight: 84, muscle: 90, conformation: 78, temperament: 58, hardiness: 68 } },
  "Brahman": { color: "Light Grey", pattern: "solid", base: { weight: 82, muscle: 72, conformation: 68, temperament: 60, hardiness: 96 } },
  "Texas Longhorn": { color: "Varies", pattern: "varies", base: { weight: 66, muscle: 60, conformation: 72, temperament: 66, hardiness: 92 } },
  "Highland": { color: "Red", pattern: "shaggy", base: { weight: 60, muscle: 56, conformation: 66, temperament: 70, hardiness: 98 } },
  "Galloway": { color: "Black", pattern: "shaggy", base: { weight: 64, muscle: 62, conformation: 68, temperament: 72, hardiness: 90 } },
  "Belted Galloway": { color: "Black w/ White Belt", pattern: "belted", base: { weight: 62, muscle: 60, conformation: 70, temperament: 74, hardiness: 88 } },
  "Wagyu": { color: "Black", pattern: "solid", base: { weight: 68, muscle: 66, conformation: 88, temperament: 76, hardiness: 62 } },
  "Shorthorn": { color: "Roan", pattern: "roanCapable", base: { weight: 78, muscle: 76, conformation: 80, temperament: 78, hardiness: 74 } },
  "Holstein": { color: "Black & White", pattern: "pied", base: { weight: 74, muscle: 58, conformation: 70, temperament: 72, hardiness: 68 } },
};
const CATTLE_BREED_NAMES = Object.keys(CATTLE_BREEDS);

/* Cattle events: a halter/conformation show (judged, fame + a purse) and
   an auction (sell for real money — better than a private sale, but you
   have to haul the animal there). */
const CATTLE_SHOWS = {
  halter: { label: "Halter / Conformation Show", desc: "Judged on structure and breed type.", weights: { conformation: 0.6, muscle: 0.25, temperament: 0.15 } },
  showmanship: { label: "Showmanship", desc: "Judged on the animal's manners and presentation.", weights: { temperament: 0.55, conformation: 0.25, muscle: 0.2 } },
};

const NAMES_M = ["Diesel", "Cutter", "Duke", "Bo", "Ranger", "Scout", "Bull", "Tank", "Gunner", "Trapper", "Colt", "Reb", "Zeke", "Bandit", "Ridge", "Sarge", "Rowdy", "Ox", "Copperhead", "Dozer"];
const NAMES_F = ["Ruby", "Bella", "Trix", "Dixie", "Roxy", "Sadie", "Belle", "Piper", "Blaze", "Honey", "Willow", "Delta", "Sage", "Marlow", "Cricket", "Josie", "Rowan", "Huckleberry", "Fern", "Scrappy"];

const TABS = [
  { id: "overview", label: "Overview", icon: "◆", group: "Kennel" },
  { id: "kennel", label: "Kennel", icon: "⌂", group: "Kennel" },
  { id: "property", label: "Property", icon: "⬒", group: "Kennel" },
  { id: "hunt", label: "Hunt", icon: "✦", group: "Kennel" },
  { id: "breed", label: "Breed", icon: "❖", group: "Kennel" },
  { id: "trials", label: "Trials", icon: "▲", group: "Kennel" },
  { id: "horses", label: "Horses", icon: "♞", group: "Livestock" },
  { id: "cattle", label: "Cattle", icon: "◈", group: "Livestock" },
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

/* Seventeen destinations hid 1,610px of tabs off-screen in the mobile strip —
   Rescue, Trade and Rivals were effectively undiscoverable. The screens are
   unchanged; several now sit behind one nav entry with sub-tabs. */
const NAV = [
  { id: "overview", label: "Overview", icon: "◆", group: "Kennel" },
  { id: "kennel",   label: "Kennel",   icon: "⌂", group: "Kennel",
    children: [{ id: "kennel", label: "The yard" }, { id: "care", label: "Today" }, { id: "ranchabout", label: "About" }, { id: "ranchhistory", label: "History" }, { id: "ranchstats", label: "Stats" }] },
  { id: "property", label: "Property", icon: "⬒", group: "Kennel" },
  { id: "hunt",     label: "Hunt",     icon: "✦", group: "Work" },
  { id: "breed",    label: "Breed",    icon: "❖", group: "Work" },
  { id: "trials",   label: "Trials",   icon: "▲", group: "Work" },
  { id: "horses",   label: "Horses",   icon: "♞", group: "Livestock" },
  { id: "cattle",   label: "Cattle",   icon: "◈", group: "Livestock" },
  { id: "market",   label: "Market",   icon: "$", group: "Trade" },
  { id: "store",    label: "Store",    icon: "▤", group: "Trade",
    children: [{ id: "shop", label: "Buy supplies" }, { id: "inventory", label: "What you own" }, { id: "clinic", label: "Clinics" }, { id: "bank", label: "Bank" }, { id: "arcade", label: "Games" }] },
  { id: "rescue",   label: "Rescue",   icon: "♥", group: "Trade" },
  { id: "online",   label: "Online",   icon: "⇄", group: "Trade",
    children: [{ id: "trade", label: "Dog market" }, { id: "rivals", label: "Challenges" }, { id: "leaderboard", label: "Leaderboard" }, { id: "search", label: "Search" }] },
  { id: "records",  label: "Records",  icon: "§", group: "Records",
    children: [{ id: "registry", label: "Stud book" }, { id: "registries", label: "Breed registries" }, { id: "rankings", label: "County ranks" }, { id: "hof", label: "Hall of Fame" }, { id: "racerecords", label: "Race records" }, { id: "achievements", label: "Achievements" }, { id: "log", label: "Ledger" }] },
  { id: "account",  label: "Account",  icon: "☺", group: "You",
    children: [{ id: "profile", label: "Profile" }, { id: "settings", label: "Settings" }, { id: "danger", label: "Account" }] },
];

/* The admin screen is spliced into the Account tab's sub-tabs only once
   unlocked, so it leaves no trace in the nav for anyone who hasn't got the code. */
function navChildrenFor(navEntry, adminUnlocked) {
  if (!navEntry || !navEntry.children) return null;
  if (navEntry.id === "account" && adminUnlocked) {
    return [...navEntry.children, { id: "admin", label: "Admin" }];
  }
  return navEntry.children;
}
/* ------------------------------ frame layout ------------------------------- */

/* An alternate chrome modelled on the classic browser-game shell: a menu bar
   of dropdowns across the top, a bordered content frame, a contextual sidebar
   and a right-hand info rail. Same screens throughout — only the furniture
   changes — and it's switchable from Settings so nothing is lost either way. */
const LAYOUT_KEY = "kennel-layout";
// Marks that the one-time move onto the homestead layout has happened.
const LAYOUT_MIGRATED_KEY = "kennel-layout-moved";
const LAYOUTS = [
  { id: "home",    label: "Homestead", blurb: "The new look — tiled ground, one centred page, Atlas menu and an info rail." },
  { id: "frame",   label: "Game frame", blurb: "Menu bar across the top, bordered page, info rail on the right." },
  { id: "classic", label: "Sidebar", blurb: "The older look — one plain column of links down the left." },
];

/* The market sidebar. Two labelled groups, the same shape the spec uses, so
   every shop and listing type has one obvious home. */
const MARKET_NAV = [
  { heading: "Main Shops", items: [
    { id: "shop", label: "Supply Store" },
    { id: "clinic", label: "Clinics" },
    { id: "bank", label: "Bank" },
  ] },
  { heading: "Animals", items: [
    { id: "market", label: "Buy Dogs" },
    { id: "trade", label: "Player Market" },
    { id: "rescue", label: "Adoption Center" },
    { id: "arcade", label: "Games" },
  ] },
  { heading: "Yours", items: [
    { id: "inventory", label: "Inventory" },
  ] },
];
const MARKET_TAB_IDS = MARKET_NAV.reduce((all, g) => all.concat(g.items.map((i) => i.id)), []);

/* ----------------------------- homestead layout ---------------------------- */

/* Primary nav across the top of the page card. Six entries, because a nav you
   can read at a glance is the whole point of this shell — everything else
   hangs off Atlas. `menu` marks the one that opens the mega-dropdown. */
const HOME_NAV = [
  { id: "kennel",  label: "Ranch",  icon: "⌂", tab: "kennel" },
  { id: "atlas",   label: "Atlas",  icon: "✦", menu: true },
  { id: "market",  label: "Market", icon: "$", tab: "market" },
  { id: "work",    label: "Work",   icon: "◆", tab: "hunt" },
  { id: "search",  label: "Search", icon: "⌕", tab: "search" },
  { id: "records", label: "Records", icon: "§", tab: "registry" },
];

/* The Atlas dropdown. Three labelled columns plus a leader-board block, all
   plain text links. Destinations that do not exist yet are absent rather than
   dead — a link that goes nowhere is worse than no link. */
const ATLAS_MENU = [
  { heading: "Explore", items: [
    { id: "rescue", label: "Adoption Center" },
    { id: "hunt",   label: "Hunting" },
    { id: "trials", label: "Trials & Shows" },
    { id: "horses", label: "Horses" },
    { id: "cattle", label: "Cattle" },
  ] },
  { heading: "Information", items: [
    { id: "registry", label: "Stud Book" },
    { id: "registries", label: "Breed Registries" },
    { id: "property", label: "Your Property" },
    { id: "breed",    label: "Breeding" },
    { id: "log",      label: "Ledger" },
  ] },
  { heading: "Social", items: [
    { id: "trade",  label: "Player Market" },
    { id: "rivals", label: "Challenges" },
  ] },
  { heading: "Yours", items: [
    { id: "care", label: "Today" },
    { id: "achievements", label: "Achievements" },
    { id: "search", label: "Search" },
    { id: "danger", label: "Manage Account" },
  ] },
  { heading: "Leader Boards", items: [
    { id: "leaderboard", label: "Top Players" },
    { id: "rankings",    label: "County Ranks" },
    { id: "hof",         label: "Hall of Fame" },
    { id: "racerecords", label: "Race Records" },
  ] },
];

/* The rail's Quick Links. The current page renders muted and inert rather than
   disappearing, so the list never changes shape underneath you. */
const HOME_QUICK_LINKS = [
  { id: "overview",  label: "Overview" },
  { id: "care",      label: "Today" },
  { id: "kennel",    label: "The Yard" },
  { id: "inventory", label: "Inventory" },
  { id: "shop",      label: "Supply Store" },
  { id: "log",       label: "Activity" },
  { id: "profile",   label: "Your Account" },
];

/* Which top-level nav entry owns a screen, so the right one lights up. */
const HOME_NAV_OWNER = {
  overview: "kennel", kennel: "kennel", property: "kennel", breed: "kennel",
  hunt: "work", trials: "work", horses: "work", cattle: "work",
  market: "market", shop: "market", inventory: "market", rescue: "market",
  trade: "market", clinic: "market", bank: "market",
  registry: "records", rankings: "records", hof: "records",
  racerecords: "records", log: "records", leaderboard: "records", rivals: "records",
  // Owner, Settings and account management are ranch tabs now, so they light
  // up Ranch rather than a "You" entry that no longer exists.
  profile: "kennel", settings: "kennel", danger: "kennel", admin: "kennel",
  // An animal's page belongs to the ranch it lives on.
  animalprofile: "kennel",
  ranchabout: "kennel", ranchhistory: "kennel", ranchstats: "kennel",
  care: "kennel", achievements: "records", search: "search",
  arcade: "market", registries: "records",
};

/* The ranch tab strip. Four of these are older screens that already had a
   home; the other three are new. Kept in one place so the strip and the
   router cannot drift apart. */
const RANCH_TABS = [
  { id: "ranchabout",   label: "About" },
  { id: "kennel",       label: "Animals" },
  { id: "profile",      label: "Owner" },
  { id: "ranchhistory", label: "History" },
  { id: "ranchstats",   label: "Stats" },
  { id: "property",     label: "Manage" },
  { id: "settings",     label: "Settings" },
];
const RANCH_TAB_IDS = RANCH_TABS.map((t) => t.id);

/* Each menu is a dropdown; columns group its links the way a stud book would. */
const MENUS = [
  { id: "kennel", label: "Kennel", icon: "⌂", columns: [
    { heading: "Your dogs", items: [
      { id: "overview", label: "Overview" }, { id: "kennel", label: "The Yard" },
      { id: "care", label: "Today" }, { id: "breed", label: "Breeding" },
    ] },
    { heading: "Your place", items: [
      { id: "property", label: "Property" }, { id: "shop", label: "Supply Store" }, { id: "inventory", label: "Inventory" },
    ] },
    { heading: "The ranch", items: [
      { id: "ranchabout", label: "About" }, { id: "ranchhistory", label: "History" }, { id: "ranchstats", label: "Stats" },
    ] },
  ] },
  { id: "work", label: "Work", icon: "✦", columns: [
    { heading: "In the field", items: [
      { id: "hunt", label: "Hunting" }, { id: "trials", label: "Trials & Shows" },
    ] },
    { heading: "Livestock", items: [
      { id: "horses", label: "Horses" }, { id: "cattle", label: "Cattle" },
    ] },
  ] },
  { id: "market", label: "Market", icon: "$", columns: [
    { heading: "Buy & sell", items: [
      { id: "market", label: "Dog Market" }, { id: "rescue", label: "Adoption Center" },
      { id: "clinic", label: "Clinics" }, { id: "bank", label: "Bank" },
    ] },
    { heading: "Other players", items: [
      { id: "trade", label: "Player Market" }, { id: "rivals", label: "Challenges" },
      { id: "search", label: "Search" }, { id: "arcade", label: "Games" },
    ] },
  ] },
  { id: "records", label: "Records", icon: "§", columns: [
    { heading: "Your records", items: [
      { id: "registry", label: "Stud Book" }, { id: "log", label: "Ledger" },
    ] },
    { heading: "Leader boards", items: [
      { id: "leaderboard", label: "Leaderboard" }, { id: "rankings", label: "County Ranks" },
      { id: "hof", label: "Hall of Fame" }, { id: "racerecords", label: "Race Records" },
    ] },
    { heading: "The book", items: [
      { id: "registries", label: "Breed Registries" }, { id: "achievements", label: "Achievements" },
    ] },
  ] },
  { id: "account", label: "Account", icon: "☺", columns: [
    { heading: "Your account", items: [
      { id: "profile", label: "Profile" }, { id: "settings", label: "Settings" }, { id: "danger", label: "Manage" },
    ] },
  ] },
];

/* Which menu owns a screen, so the right one can be highlighted. */
function menuFor(tabId) {
  return MENUS.find((m) => m.columns.some((c) => c.items.some((i) => i.id === tabId)));
}
/* The sidebar inside the frame shows the siblings of whatever you're looking
   at — the same trick the old browser games used to keep context. */
function siblingsFor(tabId, adminUnlocked) {
  const menu = menuFor(tabId);
  if (!menu) return [];
  const out = [];
  menu.columns.forEach((c) => out.push({ heading: c.heading, items: c.items }));
  if (menu.id === "account" && adminUnlocked) {
    out.push({ heading: "Tools", items: [{ id: "admin", label: "Admin" }] });
  }
  return out;
}

function navEntryFor(tabId) {
  return NAV.find((n) => n.id === tabId || (n.children || []).some((c) => c.id === tabId));
}
function firstTabOf(navEntry) {
  return navEntry.children ? navEntry.children[0].id : navEntry.id;
}

/* --------------------------------- admin ---------------------------------- */

/* Typed into Settings to reveal the admin panel. This is a convenience for
   testing, not a security boundary — anyone can read it in the source or edit
   their own save. What it must not do is quietly corrupt the shared
   leaderboard, so any save it touches gets flagged (see ADMIN_FLAG). */
const ADMIN_CODE = "ktanks";
const ADMIN_UNLOCK_KEY = "kennel-admin";
const ADMIN_FLAG = "adminUsed";

const ADMIN_CASH_STEPS = [1000, 10000, 100000, 1000000];
const ADMIN_DAY_STEPS = [7, 30, 90, 365];

/* ------------------------------ starter goals ------------------------------ */

/* After founding a kennel the game stated no goal at all — you landed on the
   overview facing eleven tabs with nothing telling you what to do first.
   These are the five things that teach the loop, checked off as you do them. */
const GOALS = [
  { id: "hunt",     label: "Send a dog on a hunt",        hint: "Hunting is where the money comes from.", tab: "hunt",
    done: (s) => s.log.some((l) => l.type === "hunt" || l.type === "injury") },
  { id: "register", label: "Put papers on a dog",         hint: "Registered dogs are worth more and can found a bloodline.", tab: "kennel",
    done: (s) => s.dogs.some((d) => d.registered) },
  { id: "breed",    label: "Breed your first litter",     hint: "Two dogs over ten months, one of each sex.", tab: "breed",
    done: (s) => s.dogs.some((d) => d.generation > 1) || s.log.some((l) => /whelped/.test(l.text)) },
  { id: "trial",    label: "Win a trial",                 hint: "Trials build fame, and fame moves you up the county ranks.", tab: "trials",
    done: (s) => s.dogs.some((d) => (d.trialWins || 0) > 0) },
  { id: "bloodline",label: "Found a named bloodline",     hint: "Breed two registered dogs and name the line.", tab: "breed",
    done: (s) => s.dogs.some((d) => d.bloodline) },
];

/* -------------------------------- seasons --------------------------------- */

/* A 240-day year, 60 days a season, so the cycle turns at a playable pace.
   Each season bends the hunt maths a different way — the same four hunts
   should not feel identical in July and January. */
const SEASON_LENGTH = 60;
const SEASONS = [
  { key: "spring", label: "Spring", blurb: "Whelping season. Litters run bigger and the woods are easy on a dog.",
    scent: 1.0, stamina: 1.0, injury: 0.9, pay: 0.95, litterBonus: 1 },
  { key: "summer", label: "Summer", blurb: "Heat and snakes. Dogs tire fast and get hurt more — hunt early or rest.",
    scent: 0.85, stamina: 0.85, injury: 1.35, pay: 1.0, litterBonus: 0 },
  { key: "fall",   label: "Fall",   blurb: "Prime season. Cool ground, good scenting, and buyers paying top dollar.",
    scent: 1.15, stamina: 1.1, injury: 1.0, pay: 1.2, litterBonus: 0 },
  { key: "winter", label: "Winter", blurb: "Cold scenting conditions favour a good nose, but the days are hard.",
    scent: 1.25, stamina: 0.95, injury: 1.1, pay: 1.05, litterBonus: 0 },
];
function seasonIndex(day) { return Math.floor((((day - 1) % (SEASON_LENGTH * 4)) + SEASON_LENGTH * 4) % (SEASON_LENGTH * 4) / SEASON_LENGTH); }
function seasonFor(day) { return SEASONS[seasonIndex(day)]; }
function seasonLabel(day) { return seasonFor(day).label; }
function yearOf(day) { return 1 + Math.floor((day - 1) / (SEASON_LENGTH * 4)); }
function dayOfSeason(day) { return ((day - 1) % SEASON_LENGTH) + 1; }

/* ------------------------------ supply store ------------------------------ */

const ITEM_CATEGORIES = [
  { id: "feed", label: "Feed & Nutrition", blurb: "Condition comes off the feed pan first. Better feed means faster recovery and slow, permanent gains." },
  { id: "med", label: "Veterinary", blurb: "Patch up a torn-up catch dog. Salve handles scrapes; a real vet kit puts a dog back to sound." },
  { id: "toy", label: "Toys & Enrichment", blurb: "A settled dog works better. Match the toy to the personality - the wrong one still helps, at half." },
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

  ropeTug:      { name: "Braided Tug Rope",   cat: "toy", price: 26, forPersonality: "bold",     mood: 34, desc: "Two ends and a fight in the middle." },
  knottedBall:  { name: "Knotted Rope Ball",  cat: "toy", price: 24, forPersonality: "steady",   mood: 34, desc: "Heavy enough to carry all afternoon." },
  puzzleBox:    { name: "Feed Puzzle Box",    cat: "toy", price: 38, forPersonality: "busy",     mood: 36, desc: "Kibble comes out once the trick is worked out." },
  scentDummy:   { name: "Canvas Scent Dummy", cat: "toy", price: 30, forPersonality: "wary",     mood: 34, desc: "Something to find, which is easier than something to face." },
  softFleece:   { name: "Fleece Snuggle Toy", cat: "toy", price: 22, forPersonality: "sweet",    mood: 32, desc: "Not for chewing. For keeping." },
  rubberBone:   { name: "Hard Rubber Bone",   cat: "toy", price: 28, forPersonality: "stubborn", mood: 34, desc: "Outlasts most arguments." },

  vaccine:      { name: "Annual Vaccination", cat: "med", price: 120, vaccinates: 365, desc: "Papers the trial secretary will actually accept." },

  collarBrass:  { name: "Brass-Buckle Collar", cat: "cosmetic", price: 35, desc: "Heavy leather, brass hardware.",   collar: "#b08d3f" },
  collarRed:    { name: "Red Working Collar",  cat: "cosmetic", price: 28, desc: "Easy to spot in thick cover.",     collar: "#c2422d" },
  collarOrange: { name: "Blaze Orange Collar", cat: "cosmetic", price: 32, desc: "Safety orange. Hunt season legal.", collar: "#e0742a" },
  collarBlack:  { name: "Black Latigo Collar", cat: "cosmetic", price: 30, desc: "Plain, dark, and tough.",          collar: "#2e2e33" },
  collarTeal:   { name: "Turquoise Collar",    cat: "cosmetic", price: 34, desc: "Show ring flash.",                 collar: "#2f9c95" },
  collarCamo:   { name: "Camo Collar",         cat: "cosmetic", price: 38, desc: "Timber pattern.",                  collar: "#5c6a4a" },
  bandanaRed:   { name: "Red Bandana",         cat: "cosmetic", price: 22, desc: "Tied at the throat. Classic.",     collar: "#a8342a" },
  collarSilver: { name: "Silver Trial Collar", cat: "cosmetic", price: 90, desc: "Awarded look, bought price.",      collar: "#9fa6ad" },
};

/* Clinics.

   Vaccination deliberately does not have one fixed price. The action routes
   into a choice of clinic, each with its own price and its own trade-off, so
   the question is "who do I take this dog to" rather than "click the button".

   These are county practices for now. Player-run clinics need a table and a
   migration of their own; when that lands they join this same list and the
   picker does not change. `bonusDays` is what the money is actually buying:
   the good ones certify for longer than the cheap ones. */
const CLINICS = [
  {
    id: "county",
    name: "County Animal Clinic",
    blurb: "Two vets and a waiting room full of farm dogs. Cheap, brisk, fine.",
    price: 95, bonusDays: 0, travel: 0,
  },
  {
    id: "riverbend",
    name: "Riverbend Veterinary",
    blurb: "Small-animal practice in town. Slower, gentler, and they keep proper records.",
    price: 145, bonusDays: 120, travel: 0,
  },
  {
    id: "haggerty",
    name: "Haggerty Large Animal",
    blurb: "Mostly cattle work. They will do a dog, and they do it properly.",
    price: 180, bonusDays: 240, travel: 0,
  },
  {
    id: "mobile",
    name: "Mobile Round",
    blurb: "The truck comes to you on its circuit. Costs more, saves the haul.",
    price: 210, bonusDays: 60, travel: 0,
  },
];

/* The bank.

   Not a second wallet for its own sake: the daily feed bill is only ever taken
   from cash, never from savings. Money put away is money that cannot be eaten
   by a bad week, and also money that cannot cover one. That is the whole
   decision, and the interest is small enough not to make it automatic. */
const BANK_INTEREST_PER_DAY = 0.0015;

/* Breed registries.

   One per breed group. Registering a dog here is separate from the papers it
   already carries: papers say what a dog is, a registry entry says the line is
   being kept, and the value of that lands on the pups rather than the dog.

   The bonus is deliberately on offspring only. A registry that made the dog in
   front of you worth more would just be a button you press on everything; one
   that pays out a generation later is a reason to plan. */
const REGISTRIES = {
  terrier: {
    name: "Southern Bull & Terrier Registry",
    blurb: "Keeps the bull-and-terrier lines honest, and has done since before anyone here was born.",
    fee: 240, offspringBonus: 0.18,
  },
  cur: {
    name: "Cur & Feist Breeders Association",
    blurb: "Working stock only. They will ask what the dog has actually done.",
    fee: 200, offspringBonus: 0.16,
  },
  hound: {
    name: "National Treeing Hound Registry",
    blurb: "Nose, voice and tree sense, recorded properly for once.",
    fee: 220, offspringBonus: 0.17,
  },
  bulldog: {
    name: "Working Bulldog Stud Book",
    blurb: "Catch weight, structure and temperament, all on the record.",
    fee: 300, offspringBonus: 0.2,
  },
  gundog: {
    name: "Field & Gundog Register",
    blurb: "Birds and blood trails. Smaller book, longer memory.",
    fee: 260, offspringBonus: 0.18,
  },
};
const REGISTRY_KEYS = Object.keys(REGISTRIES);
const BREED_GROUP_LABELS = {
  terrier: "Bull & Terrier", cur: "Curs & Feists", hound: "Treeing Hounds",
  bulldog: "Working Bulldogs", gundog: "Gundogs",
};

function breedGroup(breedName) {
  const b = BREEDS[breedName];
  if (b && b.group) return b.group;
  // Bandogs and crosses carry a made-up name, so fall back to whichever group
  // the name reads as rather than leaving them with no registry at all.
  const n = String(breedName || "");
  if (/Bandog|Bully|Terrier|Staff/i.test(n)) return "terrier";
  if (/Hound|Coon/i.test(n)) return "hound";
  if (/Cur|Feist|Lacy|Catahoula/i.test(n)) return "cur";
  if (/Bulldog|Corso|Presa|Boerboel|Bordeaux|Dogo/i.test(n)) return "bulldog";
  return "cur";
}

/* Personality.

   Every dog gets one at birth. It is not a stat and never scales anything on
   its own - its whole job is deciding which toy actually settles this
   particular dog. Six types, so a kennel of eight nearly always needs more
   than one kind of toy in the box.

   The wrong toy still works, at half value, with flavour text saying so. A
   mismatch that simply did nothing would read as a bug. */
const PERSONALITIES = {
  bold:     { name: "Bold",     blurb: "First out of the box and last to quit." },
  steady:   { name: "Steady",   blurb: "Hard to rattle, harder to hurry." },
  busy:     { name: "Busy",     blurb: "Needs a job or invents one." },
  wary:     { name: "Wary",     blurb: "Watches a while before committing." },
  sweet:    { name: "Sweet",    blurb: "Would rather be beside you than anywhere." },
  stubborn: { name: "Stubborn", blurb: "Has opinions, and keeps them." },
};
const PERSONALITY_KEYS = Object.keys(PERSONALITIES);

/* Mood.

   Falls a little every day and is put back by play. It bends how a dog works
   rather than gating anything: a settled dog runs a touch better, a miserable
   one noticeably worse, and nothing is ever hard-blocked by it. */
const MOOD_MAX = 100;
const MOOD_DECAY_PER_DAY = 6;
function moodOf(animal) {
  return typeof animal.mood === "number" ? animal.mood : MOOD_MAX;
}
/* 0.92 at rock bottom through 1.04 at content - deliberately narrow. Mood is
   meant to be worth tending, not to dwarf the stats a dog was bred for. */
function moodMultiplier(animal) {
  return 0.92 + (moodOf(animal) / MOOD_MAX) * 0.12;
}

/* Energy.

   A day's worth of work in one animal. Entering a trial and working the
   conditioning gear both draw on it, so a dog cannot be trained six times and
   entered in four shows on the same day — the cap is what makes a roster of
   dogs worth more than one very good one.

   Refills in full on the day tick rather than trickling, so the decision is
   "what does this dog do today", not "how long do I wait". */
const ENERGY_MAX = 100;
const ENERGY_COST = {
  hunt: 35,
  trial: 25,
  training: 30,
  grouphunt: 45,
};
function energyOf(animal) {
  return typeof animal.energy === "number" ? animal.energy : ENERGY_MAX;
}
function hasEnergy(animal, kind) {
  return energyOf(animal) >= (ENERGY_COST[kind] || 0);
}

/* Profession tracks.

   Five tracks, three points each, so fifteen points is a fully specialised
   kennel and nobody ever gets all of everything. Points arrive with levels and
   can be reset, because a build you cannot change is a build you resent.

   Every bonus here is applied somewhere in the simulation — none of these are
   decorative. `per` is the multiplier added per point. */
const PROFESSIONS = {
  houndsman: {
    name: "Houndsman", max: 3, per: 0.05,
    blurb: "Reads sign, works the wind, brings them home sound.",
    effect: "+5% hunt payout per point",
  },
  breeder: {
    name: "Breeder", max: 3, per: 0.04,
    blurb: "An eye for a pairing, and the patience to wait for it.",
    effect: "+4% pup quality per point",
  },
  trainer: {
    name: "Trainer", max: 3, per: 0.35,
    blurb: "Gets more out of a session than the session should give.",
    effect: "+35% conditioning gains per point",
  },
  trader: {
    name: "Trader", max: 3, per: 0.06,
    blurb: "Knows what a dog is worth, and who will pay it.",
    effect: "+6% on everything you sell, per point",
  },
  stockman: {
    name: "Stockman", max: 3, per: 0.07,
    blurb: "Horses and cattle, kept right and shown well.",
    effect: "+7% show and race purses per point",
  },
};
const PROFESSION_KEYS = Object.keys(PROFESSIONS);

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
function applyItem(dog, itemId, upgrades, trainerBonus, today) {
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

  /* A toy meant for a different sort of dog still gets played with, at half the
     good it does. Saying so in the message is the point - a mismatch that
     silently did nothing would read as the game being broken. */
  if (item.mood) {
    const type = personalityOf(dog);
    const matched = item.forPersonality === type;
    const gain = Math.round(item.mood * (matched ? 1 : 0.5));
    next.mood = Math.min(MOOD_MAX, moodOf(dog) + gain);
    const label = ((PERSONALITIES[type] || {}).name || "This").toLowerCase();
    return {
      dog: next, ok: true,
      msg: matched
        ? `${dog.name} settled right into the ${item.name.toLowerCase()} - plus ${gain} mood.`
        : `${dog.name} had a go at the ${item.name.toLowerCase()}, but a ${label} dog wants something else - plus ${gain} mood, half what it could be.`,
    };
  }

  /* Dated rather than a flag, so it lapses on its own and the trial secretary
     has a real date to check rather than a boolean nobody ever clears. */
  if (item.vaccinates) {
    next.vaccinatedUntilDay = (today || 0) + item.vaccinates;
    return { dog: next, ok: true, msg: `${dog.name} is vaccinated and papered for the season.` };
  }

  const gains = [];
  if (item.stat) {
    // The Training Yard adds a flat point; the Trainer profession scales the
    // whole gain on top of it, so the two stack rather than one hiding the other.
    const bonus = up.trainingYard && item.cat === "training" ? 1 : 0;
    const scale = item.cat === "training" ? (trainerBonus || 1) : 1;
    Object.entries(item.stat).forEach(([k, amt]) => {
      const before = next.stats[k];
      next.stats[k] = clamp(before + Math.round((amt + bonus) * scale));
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

