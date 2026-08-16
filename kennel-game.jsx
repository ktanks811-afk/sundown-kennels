import { useState, useEffect, useCallback } from "react";
import { PawPrint, Heart, DollarSign, RefreshCw, Pencil, Info, Check, X, AlertTriangle, Users, Trophy, Tag } from "lucide-react";

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
};
const BREED_NAMES = Object.keys(BREEDS);

const COLOR_NAMES = ["black", "blue", "red", "fawn", "chocolate", "white", "buckskin", "yellow", "tricolor"];
const BREED_COLOR_PROFILE = {
  "American Pit Bull Terrier": { bases: ["black", "blue", "red", "fawn", "chocolate", "white"], patterns: { solid: 0.45, brindle: 0.35, piebald: 0.2 }, merleCapable: false },
  "Catahoula Leopard Dog": { bases: ["black", "red", "blue"], patterns: { solid: 0.25, merle: 0.55, brindle: 0.2 }, merleCapable: true },
  "Black Mouth Cur": { bases: ["red", "fawn", "yellow", "black"], patterns: { solid: 0.7, brindle: 0.3 }, merleCapable: false },
  "Blue Lacy": { bases: ["blue", "red", "tricolor"], patterns: { solid: 1 }, merleCapable: false },
  "Plott Hound": { bases: ["buckskin", "black"], patterns: { brindle: 0.6, saddle: 0.3, solid: 0.1 }, merleCapable: false },
  "Mountain Cur": { bases: ["yellow", "black", "blue"], patterns: { brindle: 0.45, solid: 0.5, merle: 0.05 }, merleCapable: true },
  "American Bulldog": { bases: ["white", "red", "black"], patterns: { piebald: 0.6, brindle: 0.25, solid: 0.15 }, merleCapable: false },
};

const HUNTS = {
  hog: { label: "Hog Hunt", desc: "Bay and catch. Rewards grit and grip.", weights: { gameness: 0.35, grip: 0.35, stamina: 0.2, nose: 0.1 }, basePay: 240, injuryRisk: 0.32 },
  coon: { label: "Coon Hunt", desc: "Trail and tree. Rewards nose and wind.", weights: { nose: 0.4, stamina: 0.3, gameness: 0.2, speed: 0.1 }, basePay: 95, injuryRisk: 0.07 },
  trail: { label: "Blood Trailing", desc: "Track wounded game. Rewards nose and nerve.", weights: { nose: 0.5, gameness: 0.3, stamina: 0.2 }, basePay: 75, injuryRisk: 0.04 },
  squirrel: { label: "Squirrel Hunt", desc: "Light work for young dogs.", weights: { nose: 0.4, speed: 0.4, stamina: 0.2 }, basePay: 40, injuryRisk: 0.015 },
};

const NAMES_M = ["Diesel", "Cutter", "Duke", "Bo", "Ranger", "Scout", "Bull", "Tank", "Gunner", "Trapper", "Colt", "Reb", "Zeke", "Bandit", "Ridge", "Sarge", "Rowdy", "Ox", "Copperhead", "Dozer"];
const NAMES_F = ["Ruby", "Bella", "Trix", "Dixie", "Roxy", "Sadie", "Belle", "Piper", "Blaze", "Honey", "Willow", "Delta", "Sage", "Marlow", "Cricket", "Josie", "Rowan", "Huckleberry", "Fern", "Scrappy"];

const TABS = [
  { id: "kennel", label: "Kennel" },
  { id: "hunt", label: "Hunt" },
  { id: "breed", label: "Breed" },
  { id: "market", label: "Market" },
  { id: "trade", label: "Trade" },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "log", label: "Ledger" },
];

/* --------------------------------- helpers --------------------------------- */

const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const genId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const fmtMoney = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const ageLabel = (days) => (days < 30 ? `${days}d` : `${Math.floor(days / 30)}mo`);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const randomName = (sex) => (sex === "M" ? NAMES_M : NAMES_F)[randInt(0, (sex === "M" ? NAMES_M : NAMES_F).length - 1)];
const overallRating = (stats) => Math.round(STAT_KEYS.reduce((a, k) => a + stats[k], 0) / STAT_KEYS.length);
const statScore = (stats, weights) => Object.entries(weights).reduce((s, [k, w]) => s + stats[k] * w, 0);

function breedShort(breedName) { return BREEDS[breedName] ? BREEDS[breedName].short : breedName; }
function pickWeighted(weightsObj) {
  const entries = Object.entries(weightsObj);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) { if (r < w) return k; r -= w; }
  return entries[0][0];
}
function colorLabel(colorGenes) {
  if (colorGenes.pattern === "solid") return cap(colorGenes.base);
  return `${cap(colorGenes.base)} ${cap(colorGenes.pattern)}`;
}
function randomColorGenes(breedName) {
  const profile = BREED_COLOR_PROFILE[breedName] || BREED_COLOR_PROFILE["American Pit Bull Terrier"];
  const base = profile.bases[randInt(0, profile.bases.length - 1)];
  const pattern = pickWeighted(profile.patterns);
  return { base, pattern, merleAlleles: pattern === "merle" ? 1 : 0 };
}
function inheritColorGenes(sire, dam) {
  const sM = sire.colorGenes.merleAlleles, dM = dam.colorGenes.merleAlleles;
  let merleAlleles;
  if (sM >= 1 && dM >= 1) { const r = Math.random(); merleAlleles = r < 0.25 ? 2 : r < 0.75 ? 1 : 0; }
  else if (sM >= 1 || dM >= 1) merleAlleles = Math.random() < 0.5 ? 1 : 0;
  else merleAlleles = 0;
  let pattern;
  if (merleAlleles >= 1) pattern = "merle";
  else {
    const parentPatterns = [sire.colorGenes.pattern, dam.colorGenes.pattern].filter((p) => p !== "merle");
    pattern = parentPatterns[randInt(0, parentPatterns.length - 1)] || "solid";
    if (Math.random() < 0.12) pattern = ["solid", "brindle", "piebald", "saddle"][randInt(0, 3)];
  }
  let base = Math.random() < 0.5 ? sire.colorGenes.base : dam.colorGenes.base;
  if (Math.random() < 0.15) base = COLOR_NAMES[randInt(0, COLOR_NAMES.length - 1)];
  return { base, pattern, merleAlleles };
}
function computeRarity(dog) {
  let score = 0;
  score += { solid: 0, brindle: 1, saddle: 2, piebald: 2, merle: 4 }[dog.colorGenes.pattern] || 0;
  if (dog.breed.includes("Cross")) score += 2;
  if (dog.generation > 1) score += Math.min(dog.generation - 1, 3) * 0.5;
  const profile = BREED_COLOR_PROFILE[dog.breed];
  if (profile && !profile.bases.includes(dog.colorGenes.base)) score += 2;
  if (profile && !(dog.colorGenes.pattern in profile.patterns)) score += 2;
  if (score >= 7) return { tier: "Legendary", mult: 1.6, tone: "gold" };
  if (score >= 4.5) return { tier: "Rare", mult: 1.35, tone: "rust" };
  if (score >= 2) return { tier: "Uncommon", mult: 1.15, tone: "denim" };
  return { tier: "Common", mult: 1, tone: "tan" };
}
function generateRandomDog(breedName) {
  const breed = breedName || BREED_NAMES[randInt(0, BREED_NAMES.length - 1)];
  const base = BREEDS[breed].base;
  const stats = {};
  STAT_KEYS.forEach((k) => (stats[k] = clamp(Math.round(base[k] + rand(-14, 14)))));
  const sex = Math.random() < 0.5 ? "M" : "F";
  return {
    id: genId(), name: randomName(sex), breed, sex, stats,
    colorGenes: randomColorGenes(breed), crossBred: false, impaired: false,
    health: randInt(80, 100), ageDays: randInt(220, 950),
    sire: null, dam: null, generation: 1, breedCooldown: 0, bornDay: null,
  };
}
function computeValue(dog) {
  const rating = overallRating(dog.stats);
  const genBonus = Math.min(dog.generation - 1, 4) * 30;
  const rarity = computeRarity(dog);
  return Math.round(rating * 16 * rarity.mult + dog.health * 2 + genBonus);
}
function isInbred(sire, dam) {
  return !!((sire.sire && (sire.sire === dam.name || sire.dam === dam.name)) || (dam.sire && (dam.sire === sire.name || dam.dam === sire.name)));
}
function breedPuppies(sire, dam, day) {
  const inbred = isInbred(sire, dam);
  const crossBred = sire.breed !== dam.breed;
  const label = crossBred ? `${breedShort(sire.breed)} / ${breedShort(dam.breed)} Cross` : sire.breed;
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
    if (crossBred) {
      const boosted = new Set();
      while (boosted.size < 2) boosted.add(STAT_KEYS[randInt(0, STAT_KEYS.length - 1)]);
      boosted.forEach((k) => (stats[k] = clamp(stats[k] + randInt(2, 5))));
    }
    const colorGenes = inheritColorGenes(sire, dam);
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
    pups.push({
      id: genId(), name: randomName(sex), breed: label, sex, stats, colorGenes, crossBred, impaired,
      health, ageDays: 0, sire: sire.name, dam: dam.name,
      generation: Math.max(sire.generation, dam.generation) + 1, breedCooldown: 0, bornDay: day,
    });
  }
  return { pups, inbred, doubleMerleWarned };
}
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
function initKennel() {
  const day = 1;
  const starters = [
    { ...generateRandomDog("American Pit Bull Terrier"), name: "Diesel", sex: "M", ageDays: 420 },
    { ...generateRandomDog("Catahoula Leopard Dog"), name: "Ruby", sex: "F", ageDays: 380 },
    { ...generateRandomDog("Black Mouth Cur"), name: "Dixie", sex: "F", ageDays: 500 },
  ];
  return {
    kennelName: "Sundown Kennels", day, cash: 2500, dogs: starters,
    market: generateMarket(4, day),
    log: [{ day, type: "info", text: "Kennel established at Sundown. Stud book opened." }],
  };
}
function addLog(state, type, text) { return { ...state, log: [{ day: state.day, type, text }, ...state.log].slice(0, 60) }; }

const STORAGE_KEY = "kennel-save-v1";
const PLAYER_ID_KEY = "kennel-player-id";
const TRADE_PREFIX = "trade-listing:";
const LEADERBOARD_PREFIX = "leaderboard:";

/* --------------------------------- pieces --------------------------------- */

function StatBar({ label, value }) {
  const pct = clamp(value);
  const tone = pct >= 75 ? "var(--olive)" : pct >= 45 ? "var(--denim)" : "var(--rust)";
  return (
    <div className="kg-statrow">
      <span className="kg-statlabel">{label}</span>
      <div className="kg-statbar"><div className="kg-statfill" style={{ width: pct + "%", background: tone }} /></div>
      <span className="kg-statval">{pct}</span>
    </div>
  );
}
function Badge({ tone, children }) { return <span className={`kg-badge kg-badge--${tone}`}>{children}</span>; }

function DogCard({ dog, price, sellerName, footer, onRename, onList }) {
  const st = statusOf(dog);
  const rarity = computeRarity(dog);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(dog.name);
  const [listPrice, setListPrice] = useState(computeValue(dog));
  return (
    <div className="kg-card">
      <div className="kg-card__stamp">{breedShort(dog.breed)}</div>
      <div className="kg-card__top">
        {editing ? (
          <div className="kg-rename">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={18} />
            <button className="kg-iconbtn" onClick={() => { onRename && onRename(draft.trim() || dog.name); setEditing(false); }} aria-label="Save name"><Check size={13} /></button>
            <button className="kg-iconbtn" onClick={() => { setDraft(dog.name); setEditing(false); }} aria-label="Cancel"><X size={13} /></button>
          </div>
        ) : (
          <h3 className="kg-card__name">
            {dog.sex === "M" ? "♂" : "♀"} {dog.name}
            {onRename && <button className="kg-iconbtn kg-iconbtn--ghost" onClick={() => setEditing(true)} aria-label="Rename"><Pencil size={12} /></button>}
          </h3>
        )}
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <p className="kg-card__breed">{dog.breed} · {colorLabel(dog.colorGenes)}</p>
      <p className="kg-card__meta">
        {ageLabel(dog.ageDays)} old · Gen {dog.generation}{dog.sire ? ` · out of ${dog.sire} × ${dog.dam}` : ""}{sellerName ? ` · from ${sellerName}'s kennel` : ""}
      </p>
      <div className="kg-card__tags">
        <Badge tone={rarity.tone}>{rarity.tier}</Badge>
        {dog.crossBred && <Badge tone="denim">Hybrid Vigor</Badge>}
        {dog.impaired && <Badge tone="rust"><AlertTriangle size={10} style={{ verticalAlign: "-1px", marginRight: 3 }} />Double Merle</Badge>}
      </div>
      <div className="kg-card__stats">{STAT_KEYS.map((k) => <StatBar key={k} label={STAT_LABELS[k]} value={dog.stats[k]} />)}</div>
      <div className="kg-card__health">
        <Heart size={13} />
        <div className="kg-statbar kg-statbar--health"><div className="kg-statfill" style={{ width: clamp(dog.health) + "%", background: dog.health >= 60 ? "var(--olive)" : dog.health >= 35 ? "var(--tan-ink)" : "var(--rust)" }} /></div>
        <span className="kg-statval">{Math.round(dog.health)}</span>
      </div>
      {price != null && <p className="kg-card__price"><DollarSign size={13} />{price.toLocaleString("en-US")}</p>}
      {footer && <div className="kg-card__footer">{footer}</div>}
      {onList && (
        <div className="kg-card__listrow">
          <input type="number" min="1" value={listPrice} onChange={(e) => setListPrice(e.target.value)} />
          <button className="kg-btn kg-btn--sm kg-btn--ghost" onClick={() => onList(dog, Number(listPrice))}><Tag size={12} /> List</button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- app ---------------------------------- */

export default function KennelGame() {
  const [state, setState] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("kennel");
  const [saveError, setSaveError] = useState(false);
  const [tradeListings, setTradeListings] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [huntPick, setHuntPick] = useState({ dogId: null, hunt: "hog" });
  const [breedPick, setBreedPick] = useState({ sireId: null, damId: null });
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    (async () => {
      let pid = null;
      try {
        const pidRes = await window.storage.get(PLAYER_ID_KEY, false);
        pid = pidRes && pidRes.value ? pidRes.value : null;
      } catch { /* not set yet */ }
      if (!pid) {
        pid = genId();
        try { await window.storage.set(PLAYER_ID_KEY, pid, false); } catch { /* best effort */ }
      }
      setPlayerId(pid);
      try {
        const result = await window.storage.get(STORAGE_KEY, false);
        setState(result && result.value ? JSON.parse(result.value) : initKennel());
      } catch { setState(initKennel()); }
      setLoading(false);
    })();
  }, []);

  const writeLeaderboard = useCallback(async (next, pid) => {
    if (!pid) return;
    const netWorth = Math.round(next.cash + next.dogs.reduce((s, d) => s + computeValue(d), 0));
    try {
      await window.storage.set(LEADERBOARD_PREFIX + pid, JSON.stringify({
        playerId: pid, playerName: next.kennelName, netWorth, dogCount: next.dogs.length, day: next.day, updatedAt: Date.now(),
      }), true);
    } catch { /* best effort, not user-facing */ }
  }, []);

  const persist = useCallback(async (next) => {
    try {
      const ok = await window.storage.set(STORAGE_KEY, JSON.stringify(next), false);
      setSaveError(!ok);
    } catch { setSaveError(true); }
    writeLeaderboard(next, playerId);
  }, [playerId, writeLeaderboard]);

  const update = useCallback((fn) => {
    setState((prev) => { const next = fn(prev); persist(next); return next; });
  }, [persist]);

  const fetchTradeMarket = useCallback(async () => {
    try {
      const listed = await window.storage.list(TRADE_PREFIX, true);
      if (!listed || !listed.keys) { setTradeListings([]); return; }
      const items = [];
      for (const entry of listed.keys) {
        const key = typeof entry === "string" ? entry : entry.key;
        try { const r = await window.storage.get(key, true); if (r && r.value) items.push(JSON.parse(r.value)); } catch { /* skip */ }
      }
      setTradeListings(items);
    } catch { setTradeListings([]); }
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const listed = await window.storage.list(LEADERBOARD_PREFIX, true);
      if (!listed || !listed.keys) { setLeaderboard([]); return; }
      const items = [];
      for (const entry of listed.keys) {
        const key = typeof entry === "string" ? entry : entry.key;
        try { const r = await window.storage.get(key, true); if (r && r.value) items.push(JSON.parse(r.value)); } catch { /* skip */ }
      }
      items.sort((a, b) => b.netWorth - a.netWorth);
      setLeaderboard(items);
    } catch { setLeaderboard([]); }
  }, []);

  useEffect(() => {
    if (tab === "trade") fetchTradeMarket();
    if (tab === "leaderboard") fetchLeaderboard();
  }, [tab, fetchTradeMarket, fetchLeaderboard]);

  if (loading || !state) {
    return <div className="kg-app kg-loading"><style>{CSS}</style><PawPrint size={26} /><p>Opening the stud book…</p></div>;
  }

  function tick(prev, days, overrides = {}) {
    let next = { ...prev, day: prev.day + days };
    const upkeep = prev.dogs.length * 4 * days;
    next.cash = Math.round((prev.cash - upkeep) * 100) / 100;
    next.dogs = prev.dogs.map((d) => {
      const ov = overrides[d.id];
      let health = d.health + 4.5 * days;
      let cooldown = Math.max(0, d.breedCooldown - days);
      if (ov && typeof ov.healthDelta === "number") health = d.health + ov.healthDelta;
      if (ov && typeof ov.cooldownSet === "number") cooldown = ov.cooldownSet;
      return { ...d, ageDays: d.ageDays + days, health: clamp(health), breedCooldown: cooldown };
    });
    return next;
  }

  function doHunt() {
    const dog = state.dogs.find((d) => d.id === huntPick.dogId);
    if (!dog) return;
    const hunt = HUNTS[huntPick.hunt];
    const result = resolveHunt(dog, huntPick.hunt);
    update((prev) => {
      let next = tick(prev, 1, { [dog.id]: { healthDelta: -result.healthLoss } });
      next.cash = Math.round(next.cash + result.payout);
      const msg = result.injured
        ? `${dog.name} came back hurt from the ${hunt.label.toLowerCase()} — ${result.tier.toLowerCase()} run, earned ${fmtMoney(result.payout)}, but took a beating.`
        : `${dog.name} put in a ${result.tier.toLowerCase()} run at the ${hunt.label.toLowerCase()}, earned ${fmtMoney(result.payout)}.`;
      return addLog(next, result.injured ? "injury" : "hunt", msg);
    });
  }

  function doBreed() {
    const sire = state.dogs.find((d) => d.id === breedPick.sireId);
    const dam = state.dogs.find((d) => d.id === breedPick.damId);
    if (!sire || !dam) return;
    update((prev) => {
      const { pups, inbred, doubleMerleWarned } = breedPuppies(sire, dam, prev.day + 1);
      let next = tick(prev, 1, { [sire.id]: { cooldownSet: 10, healthDelta: 0 }, [dam.id]: { cooldownSet: 45, healthDelta: -14 } });
      next.dogs = [...next.dogs, ...pups];
      const names = pups.map((p) => p.name).join(", ");
      let note = "";
      if (inbred) note += " Close breeding — litter came in below par.";
      if (doubleMerleWarned) note += " At least one double-merle pup — those carry real risk of deafness or vision problems.";
      return addLog(next, "breed", `${sire.name} × ${dam.name} whelped ${pups.length}: ${names}.${note}`);
    });
    setBreedPick({ sireId: null, damId: null });
  }

  function doSell(dog) {
    const value = computeValue(dog);
    update((prev) => addLog({ ...prev, cash: Math.round(prev.cash + value), dogs: prev.dogs.filter((d) => d.id !== dog.id) }, "money", `Sold ${dog.name} to a trader for ${fmtMoney(value)}.`));
  }

  function doBuy(marketDog) {
    if (state.cash < marketDog.price) return;
    update((prev) => {
      const { price, listedDay, ...dog } = marketDog;
      let next = { ...prev, cash: Math.round((prev.cash - price) * 100) / 100, dogs: [...prev.dogs, dog], market: prev.market.filter((m) => m.id !== marketDog.id) };
      return addLog(next, "money", `Bought ${dog.name} (${dog.breed}) for ${fmtMoney(price)}.`);
    });
  }

  function scoutMarket() { update((prev) => addLog({ ...prev, market: generateMarket(4, prev.day) }, "info", "Scouted new dogs at the market.")); }
  function restWeek() { update((prev) => addLog(tick(prev, 7), "info", "Rested the kennel a week. Dogs recovered condition.")); }
  function renameDog(dogId, name) { update((prev) => ({ ...prev, dogs: prev.dogs.map((d) => (d.id === dogId ? { ...d, name } : d)) })); }
  function renameKennel() { const name = nameDraft.trim(); if (name) update((prev) => ({ ...prev, kennelName: name })); setEditingName(false); }

  async function doListDog(dog, price) {
    if (!price || price <= 0 || !playerId) return;
    const listing = { ...dog, price: Math.round(price), sellerId: playerId, sellerName: state.kennelName, listedDay: state.day };
    try {
      await window.storage.set(TRADE_PREFIX + dog.id, JSON.stringify(listing), true);
      update((prev) => addLog({ ...prev, dogs: prev.dogs.filter((d) => d.id !== dog.id) }, "money", `Listed ${dog.name} on the trade block for ${fmtMoney(price)}.`));
      fetchTradeMarket();
    } catch { setSaveError(true); }
  }
  async function doCancelListing(listing) {
    try {
      await window.storage.delete(TRADE_PREFIX + listing.id, true);
      const { price, sellerId, sellerName, listedDay, ...dog } = listing;
      update((prev) => addLog({ ...prev, dogs: [...prev.dogs, dog] }, "info", `Pulled ${dog.name} off the trade block.`));
      fetchTradeMarket();
    } catch { setSaveError(true); }
  }
  async function doBuyFromPlayer(listing) {
    if (listing.sellerId === playerId || state.cash < listing.price) return;
    try {
      await window.storage.delete(TRADE_PREFIX + listing.id, true);
      const { price, sellerId, sellerName, listedDay, ...dog } = listing;
      update((prev) => addLog({ ...prev, cash: Math.round((prev.cash - price) * 100) / 100, dogs: [...prev.dogs, dog] }, "money", `Bought ${dog.name} from ${sellerName}'s kennel for ${fmtMoney(price)}.`));
      fetchTradeMarket();
    } catch { setSaveError(true); }
  }

  const huntableDogs = state.dogs.filter(canHunt);
  const breedableM = state.dogs.filter((d) => d.sex === "M" && canBreed(d));
  const breedableF = state.dogs.filter((d) => d.sex === "F" && canBreed(d));
  const sire = state.dogs.find((d) => d.id === breedPick.sireId);
  const dam = state.dogs.find((d) => d.id === breedPick.damId);
  const bothMerleCarriers = sire && dam && sire.colorGenes.merleAlleles >= 1 && dam.colorGenes.merleAlleles >= 1;
  const myListings = tradeListings.filter((l) => l.sellerId === playerId);
  const otherListings = tradeListings.filter((l) => l.sellerId !== playerId);

  return (
    <div className="kg-app">
      <style>{CSS}</style>
      <header className="kg-header">
        <div className="kg-header__title">
          <PawPrint size={20} />
          {editingName ? (
            <div className="kg-rename">
              <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={28} onKeyDown={(e) => e.key === "Enter" && renameKennel()} />
              <button className="kg-iconbtn" onClick={renameKennel} aria-label="Save"><Check size={13} /></button>
            </div>
          ) : (
            <h1 onClick={() => { setNameDraft(state.kennelName); setEditingName(true); }}>{state.kennelName}<Pencil size={12} /></h1>
          )}
        </div>
        <div className="kg-header__stats">
          <span className="kg-hstat">Day {state.day}</span>
          <span className="kg-hstat kg-hstat--cash"><DollarSign size={14} />{state.cash.toLocaleString("en-US")}</span>
          <span className="kg-hstat">{state.dogs.length} dog{state.dogs.length === 1 ? "" : "s"}</span>
          <button className="kg-btn kg-btn--ghost" onClick={restWeek}>Rest a Week</button>
        </div>
      </header>

      {saveError && <div className="kg-savewarn">Couldn't save just now — keep playing, it'll retry.</div>}
      <div className="kg-notice"><Users size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />Share this artifact's link with a friend and you'll both trade on the same board — hit Refresh on Trade/Leaderboard to see their moves, it's not live-updating.</div>

      <nav className="kg-tabs">
        {TABS.map((t) => <button key={t.id} className={`kg-tab ${tab === t.id ? "kg-tab--active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </nav>

      <main className="kg-main">
        {tab === "kennel" && (
          <section>
            <p className="kg-hint"><Info size={13} /> Coat is genetic — pattern and color are inherited from sire and dam, same as working ability.</p>
            {state.dogs.length === 0 ? <p className="kg-empty">The kennel is empty. Visit the Market to bring in stock.</p> : (
              <div className="kg-grid">
                {state.dogs.map((dog) => (
                  <DogCard key={dog.id} dog={dog} onRename={(n) => renameDog(dog.id, n)} onList={doListDog}
                    footer={<button className="kg-btn kg-btn--sm kg-btn--danger" onClick={() => doSell(dog)}>Sell to trader — {fmtMoney(computeValue(dog))}</button>} />
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "hunt" && (
          <section>
            <div className="kg-hunttypes">
              {Object.entries(HUNTS).map(([key, h]) => (
                <button key={key} className={`kg-huntcard ${huntPick.hunt === key ? "kg-huntcard--active" : ""}`} onClick={() => setHuntPick((p) => ({ ...p, hunt: key }))}>
                  <strong>{h.label}</strong><span>{h.desc}</span>
                  <span className="kg-huntcard__meta">Base pay {fmtMoney(h.basePay)} · risk {Math.round(h.injuryRisk * 100)}%</span>
                </button>
              ))}
            </div>
            <h2 className="kg-subhead">Send a dog</h2>
            {huntableDogs.length === 0 ? <p className="kg-empty">No dog is fit to hunt right now — too young or too banged up. Let one heal or rest the kennel.</p> : (
              <div className="kg-grid">
                {huntableDogs.map((dog) => (
                  <DogCard key={dog.id} dog={dog}
                    footer={<button className="kg-btn kg-btn--sm" onClick={() => { setHuntPick((p) => ({ ...p, dogId: dog.id })); doHunt(); }}>Run the {HUNTS[huntPick.hunt].label}</button>} />
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "breed" && (
          <section>
            <h2 className="kg-subhead">Pick a pair</h2>
            {(breedableM.length === 0 || breedableF.length === 0) ? (
              <p className="kg-empty">Need at least one male and one female of breeding age (10mo+), healthy, and off cooldown.</p>
            ) : (
              <>
                <div className="kg-pairpick">
                  <select value={breedPick.sireId || ""} onChange={(e) => setBreedPick((p) => ({ ...p, sireId: e.target.value }))}>
                    <option value="">Choose sire (♂)</option>
                    {breedableM.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.breed}, {colorLabel(d.colorGenes)} ({overallRating(d.stats)})</option>)}
                  </select>
                  <select value={breedPick.damId || ""} onChange={(e) => setBreedPick((p) => ({ ...p, damId: e.target.value }))}>
                    <option value="">Choose dam (♀)</option>
                    {breedableF.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.breed}, {colorLabel(d.colorGenes)} ({overallRating(d.stats)})</option>)}
                  </select>
                </div>
                {sire && dam && (
                  <div className="kg-preview">
                    <h3>Expected litter</h3>
                    <p className="kg-card__breed">{sire.breed === dam.breed ? sire.breed : `${breedShort(sire.breed)} / ${breedShort(dam.breed)} Cross`}</p>
                    {isInbred(sire, dam) && <p className="kg-warn">These two share a parent — expect inbreeding depression in the litter.</p>}
                    {bothMerleCarriers && <p className="kg-warn"><AlertTriangle size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Both carry the merle gene — about 1 in 4 pups will be double merle, risking deafness or vision loss.</p>}
                    {sire.breed !== dam.breed && <p className="kg-note">Different breeds — pups get a hybrid-vigor bonus on a couple of stats.</p>}
                    <div className="kg-card__stats">
                      {STAT_KEYS.map((k) => <StatBar key={k} label={`${STAT_LABELS[k]} (avg, will vary)`} value={Math.round((sire.stats[k] + dam.stats[k]) / 2)} />)}
                    </div>
                    <button className="kg-btn" onClick={doBreed}>Breed {sire.name} × {dam.name}</button>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {tab === "market" && (
          <section>
            <div className="kg-marketbar">
              <h2 className="kg-subhead">Dogs for sale (traders)</h2>
              <button className="kg-btn kg-btn--ghost kg-btn--sm" onClick={scoutMarket}><RefreshCw size={13} /> Scout New Dogs</button>
            </div>
            {state.market.length === 0 ? <p className="kg-empty">Nothing on offer. Scout for new dogs.</p> : (
              <div className="kg-grid">
                {state.market.map((dog) => (
                  <DogCard key={dog.id} dog={dog} price={dog.price}
                    footer={<button className="kg-btn kg-btn--sm" disabled={state.cash < dog.price} onClick={() => doBuy(dog)}>{state.cash < dog.price ? "Can't afford" : "Buy"}</button>} />
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "trade" && (
          <section>
            <div className="kg-marketbar">
              <h2 className="kg-subhead"><Users size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />Trade block — real players</h2>
              <button className="kg-btn kg-btn--ghost kg-btn--sm" onClick={fetchTradeMarket}><RefreshCw size={13} /> Refresh</button>
            </div>
            <p className="kg-hint"><Info size={13} /> List a dog from the Kennel tab to put it here for anyone sharing this game to buy.</p>

            {myListings.length > 0 && (
              <>
                <h3 className="kg-subhead" style={{ fontSize: 13 }}>Your listings</h3>
                <div className="kg-grid" style={{ marginBottom: 20 }}>
                  {myListings.map((l) => (
                    <DogCard key={l.id} dog={l} price={l.price}
                      footer={<button className="kg-btn kg-btn--sm kg-btn--ghost" onClick={() => doCancelListing(l)}>Pull off the block</button>} />
                  ))}
                </div>
              </>
            )}

            <h3 className="kg-subhead" style={{ fontSize: 13 }}>From other kennels</h3>
            {otherListings.length === 0 ? <p className="kg-empty">No listings from other players yet. Hit refresh once a friend lists something.</p> : (
              <div className="kg-grid">
                {otherListings.map((l) => (
                  <DogCard key={l.id} dog={l} price={l.price} sellerName={l.sellerName}
                    footer={<button className="kg-btn kg-btn--sm" disabled={state.cash < l.price} onClick={() => doBuyFromPlayer(l)}>{state.cash < l.price ? "Can't afford" : `Buy from ${l.sellerName}`}</button>} />
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "leaderboard" && (
          <section>
            <div className="kg-marketbar">
              <h2 className="kg-subhead"><Trophy size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />Leaderboard</h2>
              <button className="kg-btn kg-btn--ghost kg-btn--sm" onClick={fetchLeaderboard}><RefreshCw size={13} /> Refresh</button>
            </div>
            {leaderboard.length === 0 ? <p className="kg-empty">No kennels ranked yet — hit refresh.</p> : (
              <ul className="kg-log">
                {leaderboard.map((entry, i) => (
                  <li key={entry.playerId} className={`kg-logrow ${entry.playerId === playerId ? "kg-logrow--money" : ""}`}>
                    <span className="kg-logday">#{i + 1}</span>
                    <span>{entry.playerName}{entry.playerId === playerId ? " (you)" : ""} — {fmtMoney(entry.netWorth)} net worth, {entry.dogCount} dogs, day {entry.day}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === "log" && (
          <section>
            <h2 className="kg-subhead">Ledger</h2>
            {state.log.length === 0 ? <p className="kg-empty">Nothing recorded yet.</p> : (
              <ul className="kg-log">
                {state.log.map((entry, i) => (
                  <li key={i} className={`kg-logrow kg-logrow--${entry.type}`}><span className="kg-logday">Day {entry.day}</span><span>{entry.text}</span></li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

/* ---------------------------------- css ---------------------------------- */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Special+Elite&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');

.kg-app {
  --paper: #ece2c6; --paper-dark: #e1d3a8; --ink: #2b2419; --ink-soft: #5c5240;
  --rust: #9c3e28; --olive: #55603f; --denim: #34495a; --tan-ink: #8a6a2a; --gold: #9c7a1a; --border: #a2895c;
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  color: var(--ink);
  background: repeating-linear-gradient(0deg, rgba(0,0,0,0.015) 0px, rgba(0,0,0,0.015) 1px, transparent 1px, transparent 3px), var(--paper);
  min-height: 100vh; padding: 20px 16px 48px; box-sizing: border-box;
}
.kg-app * { box-sizing: border-box; }
.kg-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; color: var(--ink-soft); }

.kg-header { max-width: 1080px; margin: 0 auto 4px; display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between; border-bottom: 2px solid var(--border); padding-bottom: 12px; }
.kg-header__title { display:flex; align-items:center; gap:8px; }
.kg-header__title h1 { font-family:'Special Elite', monospace; font-size: 22px; letter-spacing:0.5px; margin:0; cursor:pointer; display:flex; align-items:center; gap:8px; }
.kg-header__title h1 svg { opacity:0.45; }
.kg-header__stats { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
.kg-hstat { font-size: 13px; color: var(--ink-soft); font-weight:600; }
.kg-hstat--cash { display:flex; align-items:center; color: var(--olive); }

.kg-savewarn, .kg-notice { max-width:1080px; margin: 8px auto 0; font-size:12px; padding:6px 10px; border:1px solid; }
.kg-savewarn { background: #f4ddd3; border-color: var(--rust); color: var(--rust); }
.kg-notice { background: #dfe7ec; border-color: var(--denim); color: var(--denim); display:flex; align-items:center; }

.kg-tabs { max-width: 1080px; margin: 14px auto 0; display:flex; gap:4px; flex-wrap:wrap; }
.kg-tab { font-family:'Special Elite', monospace; background: var(--paper-dark); border: 1px solid var(--border); border-bottom:none; padding: 8px 16px; font-size: 13px; color: var(--ink-soft); cursor:pointer; }
.kg-tab--active { background: var(--paper); color: var(--ink); position:relative; top:1px; }

.kg-main { max-width: 1080px; margin: 0 auto; background: var(--paper); border:1px solid var(--border); padding: 20px; }

.kg-hint { display:flex; gap:6px; align-items:center; font-size:12px; color: var(--ink-soft); margin: 0 0 16px; }
.kg-subhead { font-family:'Special Elite', monospace; font-size:16px; margin: 4px 0 14px; display:flex; align-items:center; }
.kg-empty { color: var(--ink-soft); font-size:13px; padding: 24px 0; text-align:center; }
.kg-note { font-size:12px; color: var(--denim); margin: 6px 0; }

.kg-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap:14px; }

.kg-card { position:relative; background: var(--paper-dark); border:1px dashed var(--border); padding: 14px 14px 12px; }
.kg-card__stamp { position:absolute; top:8px; right:10px; font-family:'Special Elite', monospace; font-size:10px; letter-spacing:1px; color: var(--denim); border:1.5px solid var(--denim); padding:2px 5px; transform: rotate(6deg); opacity:0.75; text-transform:uppercase; }
.kg-card__top { display:flex; align-items:center; justify-content:space-between; gap:6px; padding-right:52px; padding-top:6px; }
.kg-card__name { font-family:'Special Elite', monospace; font-size:15px; margin:0; display:flex; align-items:center; gap:5px; }
.kg-card__breed { font-size:12px; color: var(--ink-soft); margin:3px 0 0; font-style:italic; }
.kg-card__meta { font-size:11px; color: var(--ink-soft); margin: 2px 0 8px; }
.kg-card__tags { display:flex; gap:5px; flex-wrap:wrap; margin-bottom:8px; }
.kg-card__stats { display:flex; flex-direction:column; gap:4px; margin-bottom:8px; }
.kg-card__health { display:flex; align-items:center; gap:6px; color: var(--rust); margin-bottom: 8px; }
.kg-card__price { display:flex; align-items:center; font-weight:700; color: var(--olive); margin: 0 0 8px; }
.kg-card__footer { margin-top: 6px; }
.kg-card__listrow { display:flex; gap:6px; margin-top:8px; }
.kg-card__listrow input { width:80px; font-family:'IBM Plex Mono', monospace; font-size:12px; border:1px solid var(--border); background: var(--paper); padding:5px 6px; }

.kg-statrow { display:grid; grid-template-columns: 84px 1fr 24px; align-items:center; gap:6px; }
.kg-statlabel { font-size:10px; color: var(--ink-soft); }
.kg-statbar { height:6px; background: rgba(0,0,0,0.12); }
.kg-statbar--health { flex:1; height:6px; }
.kg-statfill { height:100%; }
.kg-statval { font-size:10px; text-align:right; color: var(--ink-soft); }

.kg-badge { font-size:10px; text-transform:uppercase; letter-spacing:0.5px; padding: 2px 6px; border:1px solid; white-space:nowrap; }
.kg-badge--olive { color: var(--olive); border-color: var(--olive); }
.kg-badge--rust { color: var(--rust); border-color: var(--rust); }
.kg-badge--denim { color: var(--denim); border-color: var(--denim); }
.kg-badge--tan { color: var(--tan-ink); border-color: var(--tan-ink); }
.kg-badge--gold { color: var(--gold); border-color: var(--gold); background: rgba(156,122,26,0.12); }

.kg-btn { font-family:'IBM Plex Mono', monospace; font-weight:600; font-size:13px; background: var(--ink); color: var(--paper); border:none; padding: 9px 14px; cursor:pointer; }
.kg-btn:hover { background: #40382a; }
.kg-btn:disabled { opacity:0.4; cursor:not-allowed; }
.kg-btn--sm { padding: 6px 10px; font-size:12px; width:100%; display:flex; align-items:center; justify-content:center; gap:4px; }
.kg-btn--ghost { background:transparent; border:1px solid var(--ink); color: var(--ink); }
.kg-btn--ghost:hover { background: rgba(0,0,0,0.06); }
.kg-btn--danger { background: var(--rust); color: #fdf3ee; }
.kg-btn--danger:hover { background: #833423; }

.kg-iconbtn { border:none; background:transparent; cursor:pointer; color: var(--ink-soft); padding:2px; display:inline-flex; }
.kg-iconbtn--ghost { opacity:0.4; }
.kg-iconbtn:hover { color: var(--ink); }
.kg-rename { display:flex; align-items:center; gap:4px; }
.kg-rename input { font-family:'IBM Plex Mono', monospace; font-size:13px; border:1px solid var(--border); background: var(--paper); padding:3px 6px; width:120px; }

.kg-hunttypes { display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:10px; margin-bottom: 22px; }
.kg-huntcard { text-align:left; background: var(--paper-dark); border:1px solid var(--border); padding:12px; cursor:pointer; display:flex; flex-direction:column; gap:4px; }
.kg-huntcard strong { font-family:'Special Elite', monospace; font-size:13px; }
.kg-huntcard span { font-size:11px; color: var(--ink-soft); }
.kg-huntcard__meta { color: var(--denim) !important; }
.kg-huntcard--active { outline: 2px solid var(--ink); background: var(--paper); }

.kg-pairpick { display:flex; gap:10px; flex-wrap:wrap; margin-bottom: 18px; }
.kg-pairpick select { font-family:'IBM Plex Mono', monospace; font-size:13px; padding:8px; border:1px solid var(--border); background: var(--paper-dark); min-width: 220px; flex:1; }
.kg-preview { background: var(--paper-dark); border:1px solid var(--border); padding: 16px; max-width:440px; }
.kg-preview h3 { font-family:'Special Elite', monospace; font-size:14px; margin: 0 0 4px; }
.kg-warn { color: var(--rust); font-size:12px; margin: 6px 0; }

.kg-marketbar { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; flex-wrap:wrap; gap:8px; }

.kg-log { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
.kg-logrow { display:flex; gap:10px; font-size:12px; padding: 8px 10px; border-left: 3px solid var(--border); background: var(--paper-dark); }
.kg-logrow--money { border-color: var(--olive); }
.kg-logrow--injury { border-color: var(--rust); }
.kg-logrow--breed { border-color: var(--denim); }
.kg-logrow--hunt { border-color: var(--tan-ink); }
.kg-logday { color: var(--ink-soft); white-space:nowrap; font-weight:600; }

@media (max-width: 560px) {
  .kg-statrow { grid-template-columns: 70px 1fr 22px; }
  .kg-header { flex-direction:column; align-items:flex-start; }
}
`;
