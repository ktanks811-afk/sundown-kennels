/* Original item artwork, drawn as inline SVG.

   Vector rather than PNG on purpose: every icon is a few hundred bytes, stays
   sharp at any size, needs no build step or asset pipeline, and can be tinted
   from data (the collars all share one drawing, coloured by ITEMS[id].collar).

   All art here is drawn for this game. If real raster art turns up later, an
   `art` field on an item can point at a file and ItemIcon will prefer it —
   see the top of ItemIcon. Nothing else has to change. */

/* Palette. Deliberately literal rather than themed: a salve tin should read as
   the same object in light and dark mode. Only the plate behind the art shifts
   with the theme, which styles.css handles. */
const ART = {
  ink:     "#2f2018",
  leather: "#8a5a33",
  hide:    "#6b4326",
  tan:     "#d8b483",
  cream:   "#f2e6d4",
  steel:   "#a8afb6",
  steelD:  "#727980",
  meat:    "#c2422d",
  meatD:   "#98301f",
  olive:   "#6f7a45",
  oliveL:  "#93a05e",
  gold:    "#f5b942",
  rust:    "#f05a00",
  denim:   "#4a6b8a",
  denimL:  "#6d90b0",
  bone:    "#ece1cb",
  wood:    "#a9743f",
  woodD:   "#7c5227",
  glass:   "#cfe0e6",
};

/* Shared stroke treatment. Chunky outline so the art still reads at 44px. */
const S = { stroke: ART.ink, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" };

/* Each entry draws inside a 64x64 box. */
const ICON_ART = {
  /* ---- Feed ------------------------------------------------------------ */
  kibble: () => (
    <>
      <path d="M21 22h22l4 30q-15 6-30 0z" fill={ART.tan} {...S} />
      <path d="M24 12h16l2 10H22z" fill={ART.leather} {...S} />
      <path d="M25 34h14M25 41h10" stroke={ART.leather} strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="48" cy="55" r="3" fill={ART.woodD} {...S} />
      <circle cx="41" cy="58" r="2.5" fill={ART.woodD} {...S} />
    </>
  ),
  highProtein: () => (
    <>
      <path d="M14 18h36v38H14z" fill={ART.cream} {...S} />
      <path d="M14 18l6-6h24l6 6" fill={ART.tan} {...S} />
      <path d="M14 30h36v11H14z" fill={ART.rust} {...S} />
      <path d="M24 35.5h16" stroke={ART.cream} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </>
  ),
  rawDiet: () => (
    <>
      <path d="M9 26q8-14 25-12t21 14q4 14-14 20T12 44z" fill={ART.meat} {...S} />
      <path d="M18 24q12-7 26-1" stroke={ART.meatD} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Bone laid across the cut: a bar with paired knuckles at each end. */}
      <path d="M18 44h28" stroke={ART.bone} strokeWidth="9" strokeLinecap="butt" />
      <circle cx="18" cy="40" r="5" fill={ART.bone} {...S} />
      <circle cx="18" cy="48" r="5" fill={ART.bone} {...S} />
      <circle cx="46" cy="40" r="5" fill={ART.bone} {...S} />
      <circle cx="46" cy="48" r="5" fill={ART.bone} {...S} />
      <path d="M18 44h28" stroke={ART.bone} strokeWidth="9" strokeLinecap="butt" />
      <path d="M18 39.5h28M18 48.5h28" stroke={ART.ink} strokeWidth="2" strokeLinecap="butt" />
    </>
  ),
  perfBlend: () => (
    <>
      <path d="M14 18h36v38H14z" fill={ART.denim} {...S} />
      <path d="M14 18l6-6h24l6 6" fill={ART.denimL} {...S} />
      <path d="M32 28l3.4 6.9 7.6 1.1-5.5 5.4 1.3 7.6-6.8-3.6-6.8 3.6 1.3-7.6-5.5-5.4 7.6-1.1z" fill={ART.gold} {...S} />
    </>
  ),
  electrolytes: () => (
    <>
      <path d="M26 10h12v8h-12z" fill={ART.steelD} {...S} />
      <path d="M22 18h20l3 12v22a4 4 0 01-4 4H23a4 4 0 01-4-4V30z" fill={ART.glass} {...S} />
      <path d="M20 36h24v18a4 4 0 01-4 4H24a4 4 0 01-4-4z" fill={ART.gold} {...S} />
    </>
  ),

  /* ---- Medicine -------------------------------------------------------- */
  woundSalve: () => (
    <>
      <ellipse cx="32" cy="24" rx="18" ry="6" fill={ART.steel} {...S} />
      <path d="M14 24v18q0 6 18 6t18-6V24" fill={ART.steel} {...S} />
      <path d="M32 30v14M25 37h14" stroke={ART.meat} strokeWidth="4.5" strokeLinecap="round" fill="none" />
    </>
  ),
  antibiotics: () => (
    <>
      <path d="M24 10h16v8H24z" fill={ART.steelD} {...S} />
      <path d="M20 18h24v32a4 4 0 01-4 4H24a4 4 0 01-4-4z" fill={ART.cream} {...S} />
      <path d="M20 30h24v10H20z" fill={ART.olive} {...S} />
      <circle cx="27" cy="47" r="3" fill={ART.rust} {...S} />
      <circle cx="37" cy="47" r="3" fill={ART.rust} {...S} />
    </>
  ),
  jointSupp: () => (
    <>
      <path d="M25 10h14v8H25z" fill={ART.steelD} {...S} />
      <path d="M19 18h26v32a4 4 0 01-4 4H23a4 4 0 01-4-4z" fill={ART.denimL} {...S} />
      <path d="M25 28h14v18H25z" fill={ART.cream} {...S} />
      <path d="M32 31v12M27 37h10" stroke={ART.denim} strokeWidth="3" strokeLinecap="round" fill="none" />
    </>
  ),
  vetKit: () => (
    <>
      <path d="M25 14h14v8H25z" fill={ART.hide} {...S} />
      <path d="M10 22h44v28a4 4 0 01-4 4H14a4 4 0 01-4-4z" fill={ART.leather} {...S} />
      <path d="M10 34h44" stroke={ART.ink} strokeWidth="2" fill="none" />
      <path d="M32 26v20M22 36h20" stroke={ART.cream} strokeWidth="5" strokeLinecap="round" fill="none" />
    </>
  ),

  /* ---- Training -------------------------------------------------------- */
  scentDrag: () => (
    <>
      <path d="M8 20q12 10 24 6t20 4" stroke={ART.tan} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M8 20q12 10 24 6t20 4" {...S} strokeWidth="1.5" fill="none" />
      <path d="M40 30l14 6-8 14-14-6z" fill={ART.hide} {...S} />
      <path d="M36 38l14 6" stroke={ART.ink} strokeWidth="1.5" fill="none" />
    </>
  ),
  flirtPole: () => (
    <>
      <path d="M10 54L34 14" stroke={ART.wood} strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M10 54L34 14" {...S} strokeWidth="1.5" fill="none" />
      <path d="M34 14q14 6 12 20" stroke={ART.ink} strokeWidth="1.5" fill="none" />
      <path d="M42 34q10 0 8 9t-11 6q-6-3-3-9z" fill={ART.oliveL} {...S} />
    </>
  ),
  springPole: () => (
    <>
      <path d="M12 10h40" stroke={ART.woodD} strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M32 14q-7 3 0 6t0 6-0 6" stroke={ART.steelD} strokeWidth="3.5" fill="none" />
      <path d="M24 34h16v10q0 8-8 12t-8-12z" fill={ART.hide} {...S} />
      <path d="M28 40h8" stroke={ART.ink} strokeWidth="1.5" fill="none" />
    </>
  ),
  weightVest: () => (
    <>
      <path d="M20 14l12 6 12-6 8 8-6 8v24H18V30l-6-8z" fill={ART.olive} {...S} />
      <path d="M32 20v34" stroke={ART.ink} strokeWidth="1.5" fill="none" />
      <rect x="21" y="32" width="9" height="9" rx="1.5" fill={ART.steelD} {...S} />
      <rect x="34" y="32" width="9" height="9" rx="1.5" fill={ART.steelD} {...S} />
    </>
  ),
  showLead: () => (
    <>
      <path d="M32 12a16 16 0 100 32 16 16 0 100-32z" fill="none" stroke={ART.leather} strokeWidth="5" />
      <path d="M32 12a16 16 0 100 32 16 16 0 100-32z" fill="none" {...S} strokeWidth="1.5" />
      <path d="M32 44v10" stroke={ART.leather} strokeWidth="5" strokeLinecap="round" fill="none" />
      <rect x="26" y="38" width="12" height="8" rx="2" fill={ART.gold} {...S} />
    </>
  ),
  bayPen: () => (
    <>
      <path d="M10 18h44v32H10z" fill="none" {...S} />
      <path d="M20 18v32M32 18v32M44 18v32" stroke={ART.steelD} strokeWidth="3" fill="none" />
      <path d="M10 28h44M10 40h44" stroke={ART.steelD} strokeWidth="3" fill="none" />
      <path d="M10 18h44v32H10z" fill="none" {...S} />
      <path d="M6 50h52" stroke={ART.woodD} strokeWidth="4" strokeLinecap="round" fill="none" />
    </>
  ),
  treadmill: () => (
    <>
      <path d="M10 42l8-22h32l6 22z" fill={ART.wood} {...S} />
      <path d="M18 20h32" stroke={ART.woodD} strokeWidth="2" fill="none" />
      <path d="M14 32h38" stroke={ART.woodD} strokeWidth="2" fill="none" />
      <circle cx="16" cy="48" r="6" fill={ART.steelD} {...S} />
      <circle cx="48" cy="48" r="6" fill={ART.steelD} {...S} />
    </>
  ),

  /* ---- Cosmetic -------------------------------------------------------- */
  /* One drawing for every collar; the buckle stays brass and the strap takes
     the item's own colour, so a new collar needs no new art. */
  collar: (item) => (
    <>
      <path d="M32 14a20 20 0 100 40 20 20 0 100-40z" fill="none" stroke={item && item.collar ? item.collar : ART.leather} strokeWidth="7" />
      <path d="M32 14a20 20 0 100 40 20 20 0 100-40z" fill="none" {...S} strokeWidth="1.5" />
      <rect x="25" y="9" width="14" height="10" rx="2" fill={ART.gold} {...S} />
      <path d="M32 9v10" stroke={ART.ink} strokeWidth="1.5" fill="none" />
      <circle cx="32" cy="52" r="5" fill={ART.gold} {...S} />
    </>
  ),
  bandanaRed: (item) => (
    <>
      <path d="M10 18h44L32 54z" fill={item && item.collar ? item.collar : ART.meat} {...S} />
      <path d="M18 24h28M23 32h18" stroke={ART.cream} strokeWidth="2" strokeLinecap="round" fill="none" />
    </>
  ),

  /* ---- Kennel upgrades ------------------------------------------------- */
  feedSilo: () => (
    <>
      <path d="M20 22q12-14 24 0v32H20z" fill={ART.steel} {...S} />
      <path d="M27 22v32M37 22v32" stroke={ART.steelD} strokeWidth="2" fill="none" />
      <path d="M16 54h32" stroke={ART.ink} strokeWidth="3" strokeLinecap="round" fill="none" />
    </>
  ),
  vetShed: () => (
    <>
      <path d="M10 30L32 14l22 16v24H10z" fill={ART.cream} {...S} />
      <path d="M32 26v18M23 35h18" stroke={ART.meat} strokeWidth="5" strokeLinecap="round" fill="none" />
    </>
  ),
  whelpingBox: () => (
    <>
      <path d="M10 28L32 12l22 16v26H10z" fill={ART.meat} {...S} />
      <path d="M24 54V38h16v16z" fill={ART.cream} {...S} />
      <path d="M32 38v16" stroke={ART.ink} strokeWidth="1.5" fill="none" />
    </>
  ),
  trainingYard: () => (
    <>
      <path d="M8 26v28M22 26v28M36 26v28M50 26v28" stroke={ART.wood} strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M6 34h48M6 46h48" stroke={ART.woodD} strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M8 26l7-8 7 8M36 26l7-8 7 8" fill="none" {...S} />
    </>
  ),
  scentKennel: () => (
    <>
      <path d="M12 32L32 14l20 18v22H12z" fill={ART.wood} {...S} />
      <path d="M24 54V38a8 8 0 0116 0v16z" fill={ART.ink} {...S} />
      <circle cx="32" cy="26" r="3" fill={ART.gold} {...S} />
    </>
  ),

  /* ---- Category fallbacks --------------------------------------------- */
  "cat:feed":     () => ICON_ART.kibble(),
  "cat:med":      () => ICON_ART.woundSalve(),
  "cat:training": () => ICON_ART.scentDrag(),
  "cat:cosmetic": (item) => ICON_ART.collar(item),
  fallback: () => (
    <>
      <path d="M14 22l18-10 18 10v22L32 54 14 44z" fill={ART.tan} {...S} />
      <path d="M14 22l18 10 18-10M32 32v22" stroke={ART.ink} strokeWidth="1.5" fill="none" />
    </>
  ),
};

/* Every collar shares one drawing, keyed off the id prefix. */
function artFor(id, item) {
  if (ICON_ART[id]) return ICON_ART[id];
  if (id && id.indexOf("collar") === 0) return ICON_ART.collar;
  if (item && ICON_ART["cat:" + item.cat]) return ICON_ART["cat:" + item.cat];
  return ICON_ART.fallback;
}

/* Art for a shop or inventory item. Falls back by category, then to a generic
   crate, so an item added without art still renders something sensible. */
function ItemIcon({ id, item, size = 74, className = "" }) {
  const it = item || (typeof ITEMS !== "undefined" ? ITEMS[id] : null);

  // If an item ever carries a real image file, prefer it over the drawing.
  if (it && it.art) {
    return <img className={"kg-itemart " + className} src={it.art} alt="" width={size} height={size} loading="lazy" />;
  }

  const draw = artFor(id, it);
  return (
    <svg className={"kg-itemart " + className} viewBox="0 0 64 64" width={size} height={size}
      role="img" aria-hidden="true" focusable="false">
      {draw(it)}
    </svg>
  );
}

/* Same treatment for the one-time kennel upgrades. */
function UpgradeIcon({ id, size = 74, className = "" }) {
  const draw = ICON_ART[id] || ICON_ART.fallback;
  return (
    <svg className={"kg-itemart " + className} viewBox="0 0 64 64" width={size} height={size}
      role="img" aria-hidden="true" focusable="false">
      {draw()}
    </svg>
  );
}
