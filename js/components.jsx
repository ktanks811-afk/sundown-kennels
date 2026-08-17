/* Presentational React components: stat bars, badges, the net-worth
   sparkline, rating seals, the generated coat swatch, dog cards, the
   pedigree tree, the dog profile modal, and the cloud-save panel. */

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
function Badge({ tone, children }) { return <span className={"kg-badge kg-badge--" + tone}>{children}</span>; }

/* A small suitability-percent pill for the group-hunt role pickers — not
   shown on DogCard anywhere else in the game. */
function RoleBadge({ label, value }) {
  const tone = value >= 75 ? "olive" : value >= 45 ? "denim" : "rust";
  return <span className={"kg-rolebadge kg-rolebadge--" + tone}>{label} {value}%</span>;
}

/* The staged zone map — a grid of named areas with dog markers that hop
   between zones on each simulation tick (see stepSearch/stepTravel in
   grouphunt.jsx). Not a free-position map: markers snap to whichever zone
   tile they currently occupy. */
function HuntMap({ zones, dogZones, dogsById, bayDogIds, catchDogIds, hogZoneKey, phase }) {
  /* What each role is actually doing right now. During the search the bay
     dogs are working ground and the catch dogs are held back; once the hog
     is bayed those swap — the bay dogs are pinned holding it and the catch
     dogs are the ones on the move. */
  const statusFor = (isBay) =>
    phase === "traveling"
      ? (isBay ? "Holding the hog" : "Closing in")
      : (isBay ? "Searching" : "Standing by");
  return (
    <div className="kg-huntmap">
      <div className="kg-huntmap__grid">
        {zones.map((zone) => {
          const here = Object.entries(dogZones).filter(([, z]) => z === zone.key).map(([id]) => id);
          return (
            <div key={zone.key} className={"kg-zone" + (hogZoneKey === zone.key ? " kg-zone--hog" : "")}>
              <span className="kg-zone__label">{zone.label}</span>
              <div className="kg-zone__dogs">
                {here.map((id) => (
                  <span key={id} className={"kg-dogmarker " + (bayDogIds.includes(id) ? "kg-dogmarker--bay" : "kg-dogmarker--catch")} title={dogsById[id].name}>
                    {bayDogIds.includes(id) ? "🐕" : "🐾"}
                  </span>
                ))}
                {hogZoneKey === zone.key && <span className="kg-dogmarker kg-dogmarker--hog" title="Hog">🐗</span>}
              </div>
            </div>
          );
        })}
      </div>
      <ul className="kg-huntmap__status">
        {[...bayDogIds, ...catchDogIds].map((id) => {
          const dog = dogsById[id];
          const zone = zones.find((z) => z.key === dogZones[id]);
          const isBay = bayDogIds.includes(id);
          return (
            <li key={id}>
              🐕 <strong>{dog.name}</strong> — {zone ? zone.label : "Camp"}
              <span className="kg-huntmap__statustag"> · {statusFor(isBay)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* The bayed-hog interrupt — fires mid-search when stepSearch finds the hog.
   Player chooses to send the catch dogs in, which opens the travel phase,
   or call the whole pack off for a small consolation payout and no risk. */
function BayedEventModal({ hog, bayDogs, zoneLabel, onRelease, onCallOff }) {
  return (
    <div className="kg-modal-backdrop">
      <div className="kg-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="kg-modal__head"><h2>🐗 HOG BAYED!</h2></div>
        <p>Your bay dogs have a hog bayed at <strong>{zoneLabel}</strong>.</p>
        <p className="kg-note">Bay dogs: {bayDogs.map((d) => d.name).join(", ")}</p>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button className="kg-btn kg-btn--gold" onClick={onRelease}>Release Catch Dogs</button>
          <button className="kg-btn kg-btn--ghost" onClick={onCallOff}>Call Off</button>
        </div>
      </div>
    </div>
  );
}

/* A marker sweeps 0-100 on a repeating CSS animation; the player taps when
   it's inside the sweet spot. onTap receives the marker's estimated
   position at the moment of the tap. */
function CatchMiniGame({ miniGame, onTap }) {
  // useRef/useEffect are destructured from React once, at the top of
  // data.jsx (the first file loaded) — every later file, this one included,
  // uses them bare rather than as React.useRef/React.useEffect.
  const startRef = useRef(Date.now());

  useEffect(() => { startRef.current = Date.now(); }, [miniGame.round]);

  function handleTap() {
    onTap(markerPctAt(Date.now() - startRef.current, miniGame.sweepMs));
  }

  return (
    <div className="kg-minigame">
      <p className="kg-note">Round {miniGame.round + 1} of {MINIGAME_MAX_ROUNDS} — tap when the marker crosses the highlighted zone.</p>
      <div className="kg-minigame__meter"><div className="kg-minigame__meterfill" style={{ width: miniGame.meter + "%" }} /></div>
      <div className="kg-minigame__bar">
        <div className="kg-minigame__sweetspot" style={{ left: miniGame.sweetSpot.start + "%", width: (miniGame.sweetSpot.end - miniGame.sweetSpot.start) + "%" }} />
        {/* key={round} remounts the marker every round, which restarts the
            CSS sweep animation from 0 in lockstep with the startRef reset
            above. Without it the animation keeps running from the original
            mount while the hit-test clock restarts each round, and the two
            drift apart from round 2 on. */}
        <div key={miniGame.round} className="kg-minigame__marker" style={{ animationDuration: miniGame.sweepMs + "ms" }} />
      </div>
      <button className="kg-btn kg-btn--gold" onClick={handleTap}>Tap!</button>
    </div>
  );
}

/* Hand-inked ledger line — plots net worth over time from the kennel's own
   recorded history, no external chart library. */
function Sparkline({ points, width = 640, height = 140 }) {
  if (!points || points.length < 2) return <p className="kg-empty">Not enough history yet — keep playing and the line will fill in.</p>;
  const values = points.map((p) => p.netWorth);
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const coords = points.map((p, i) => [Math.round(i * stepX * 10) / 10, Math.round((height - 8 - ((p.netWorth - min) / range) * (height - 20)) * 10) / 10]);
  const line = coords.map((c) => c.join(",")).join(" ");
  const area = `0,${height} ` + line + ` ${width},${height}`;
  return (
    <svg className="kg-spark" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <polygon points={area} fill="var(--olive)" opacity="0.12" />
      <polyline points={line} fill="none" stroke="var(--olive)" strokeWidth="2" />
      {coords.length && <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r="3.5" fill="var(--gold)" />}
    </svg>
  );
}

/* The through-line signature element: a rubber-stamped rating seal, same
   device used for the breed stamp and papers, now doing double duty as an
   at-a-glance quality mark on every card. */
function RatingSeal({ rating }) {
  const tone = rating >= 80 ? "gold" : rating >= 65 ? "olive" : rating >= 45 ? "denim" : "rust";
  return <div className={"kg-seal kg-seal--" + tone}>{rating}</div>;
}

/* A procedurally generated coat swatch — not a photoreal AI image (no image
   model is available in this environment), but a genuinely generated strip
   built from the dog's actual base color + pattern genes, seeded on its id
   so it's stable every time you look at it. */
/* Shared by the flat coat-swatch bar and the click-to-reveal portrait
   below — same pattern math, just handed a different canvas size, so a
   dog's swatch and its portrait always agree on what it actually looks
   like. */
function coatPatternShapes(pattern, colorGenes, baseHex, width, height, rng) {
  const darker = shade(baseHex, -30);
  const scale = width / 200;
  const shapes = [];
  if (pattern === "brindle") {
    for (let i = 0; i < 14; i++) {
      const x = rng() * width;
      shapes.push(<rect key={i} x={x} y={-4} width={2.5 + rng() * 3} height={height + 8} fill={darker} opacity="0.6" transform={`rotate(22 ${x} ${height / 2})`} />);
    }
  } else if (pattern === "merle") {
    const patchFill = colorGenes.merleAlleles === 2 ? "#ece4d3" : darker;
    const count = colorGenes.merleAlleles === 2 ? 11 : 7;
    for (let i = 0; i < count; i++) {
      const cx = rng() * width, cy = rng() * height, r = (5 + rng() * 9) * scale;
      shapes.push(<ellipse key={i} cx={cx} cy={cy} rx={r} ry={r * 0.7} fill={patchFill} opacity={colorGenes.merleAlleles === 2 ? 0.6 : 0.5} />);
    }
  } else if (pattern === "piebald") {
    for (let i = 0; i < 5; i++) {
      const cx = rng() * width, cy = rng() * height, r = (9 + rng() * 14) * scale;
      shapes.push(<ellipse key={i} cx={cx} cy={cy} rx={r} ry={r * 0.75} fill={COLOR_HEX.white} opacity="0.92" />);
    }
  } else if (pattern === "saddle") {
    shapes.push(<rect key="s" x={width * 0.32} y={0} width={width * 0.36} height={height} fill={darker} opacity="0.88" />);
  } else if (pattern === "belt") {
    shapes.push(<rect key="b" x={width * 0.38} y={0} width={width * 0.22} height={height} fill={COLOR_HEX.white} opacity="0.95" />);
  } else if (pattern === "tricolor") {
    shapes.push(<rect key="w" x={0} y={0} width={width} height={height} fill={COLOR_HEX.white} />);
    shapes.push(<rect key="a" x={0} y={0} width={width * 0.4} height={height} fill={baseHex} />);
    shapes.push(<rect key="b" x={width * 0.6} y={0} width={width * 0.4} height={height} fill={shade(baseHex, 20)} />);
  } else if (pattern === "ticked") {
    shapes.push(<rect key="w" x={0} y={0} width={width} height={height} fill={COLOR_HEX.white} />);
    for (let i = 0; i < Math.round(70 * scale * scale); i++) {
      const cx = rng() * width, cy = rng() * height;
      shapes.push(<circle key={i} cx={cx} cy={cy} r={(1.1 + rng()) * scale} fill={baseHex} opacity="0.75" />);
    }
  }
  return shapes;
}
function CoatSwatch({ dog, width = 200, height = 26 }) {
  const rng = mulberry32(hashStr(dog.id));
  const baseHex = COLOR_HEX[dog.colorGenes.base] || COLOR_HEX.fawn;
  const pattern = dog.colorGenes.pattern;
  const shapes = coatPatternShapes(pattern, dog.colorGenes, baseHex, width, height, rng);
  return (
    <svg className="kg-card__swatch" width="100%" viewBox={`0 0 ${width} ${height}`} height={height} preserveAspectRatio="none">
      <rect x="0" y="0" width={width} height={height} fill={pattern === "tricolor" || pattern === "ticked" ? "none" : baseHex} />
      {shapes}
    </svg>
  );
}

/* Simple geometric side-profile silhouettes (not detailed art) shared by
   the click-to-reveal portrait for every species — one 220x140 box each,
   facing right. */
const SILHOUETTES = {
  dog: [
    { t: "ellipse", cx: 95, cy: 88, rx: 52, ry: 26 },
    { t: "ellipse", cx: 150, cy: 75, rx: 16, ry: 20 },
    { t: "ellipse", cx: 172, cy: 52, rx: 20, ry: 18 },
    { t: "ellipse", cx: 193, cy: 57, rx: 11, ry: 7 },
    { t: "polygon", points: "158,38 168,14 178,40" },
    { t: "rect", x: 55, y: 104, w: 9, h: 32 },
    { t: "rect", x: 75, y: 104, w: 9, h: 32 },
    { t: "rect", x: 115, y: 104, w: 9, h: 32 },
    { t: "rect", x: 138, y: 104, w: 9, h: 32 },
    { t: "polygon", points: "44,72 20,50 30,90 46,86" },
  ],
  horse: [
    { t: "ellipse", cx: 100, cy: 80, rx: 50, ry: 22 },
    { t: "ellipse", cx: 158, cy: 55, rx: 15, ry: 30, rotate: -18 },
    { t: "ellipse", cx: 184, cy: 28, rx: 14, ry: 11 },
    { t: "ellipse", cx: 200, cy: 30, rx: 8, ry: 5 },
    { t: "polygon", points: "175,18 180,6 188,18" },
    { t: "rect", x: 60, y: 98, w: 8, h: 38 },
    { t: "rect", x: 82, y: 98, w: 8, h: 38 },
    { t: "rect", x: 120, y: 98, w: 8, h: 38 },
    { t: "rect", x: 142, y: 98, w: 8, h: 38 },
    { t: "polygon", points: "50,68 24,90 34,120 52,100" },
  ],
  cattle: [
    { t: "rect", x: 40, y: 60, w: 110, h: 45, rxc: 14 },
    { t: "ellipse", cx: 165, cy: 62, rx: 20, ry: 18 },
    { t: "polygon", points: "150,45 145,25 158,42" },
    { t: "polygon", points: "178,45 186,24 172,42" },
    { t: "rect", x: 55, y: 100, w: 11, h: 30 },
    { t: "rect", x: 85, y: 100, w: 11, h: 30 },
    { t: "rect", x: 118, y: 100, w: 11, h: 30 },
    { t: "rect", x: 145, y: 100, w: 11, h: 30 },
    { t: "polygon", points: "35,70 15,95 25,118 40,105" },
  ],
};
function renderSilhouette(kind, fill) {
  return SILHOUETTES[kind].map((s, i) => {
    if (s.t === "ellipse") return <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={fill} transform={s.rotate ? `rotate(${s.rotate} ${s.cx} ${s.cy})` : undefined} />;
    if (s.t === "polygon") return <polygon key={i} points={s.points} fill={fill} />;
    return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rxc || 3} fill={fill} />;
  });
}

/* Normalizes each species' very different color-genetics shape (dogs:
   base+pattern; horses: base+dilution+pattern; cattle: mostly fixed
   per-breed color, a few breeds vary) down to the same {baseHex, pattern,
   colorGenes} shape coatPatternShapes() already knows how to draw, so one
   portrait renderer works for all three without gene-specific branches. */
const HORSE_BASE_HEX = { chestnut: "#a1552f", bay: "#5b3a2a", black: "#242019" };
const CATTLE_COLOR_HEX = {
  "Black": "#242019", "Red": "#a1552f", "White": "#f1ead9", "Golden Red": "#c9a06b",
  "Light Grey": "#9aa0a6", "Black w/ White Belt": "#242019", "Black & White": "#242019",
  "Red & White": "#a1552f", "Dark Red": "#6b3316", "Roan": "#c39a8f", "Varies": "#a1552f",
};
function cattleShadeCoat(shadeName) {
  const map = {
    "Red & White": { baseHex: CATTLE_COLOR_HEX.Red, pattern: "piebald" },
    "Black & White": { baseHex: CATTLE_COLOR_HEX.Black, pattern: "piebald" },
    "Brindle": { baseHex: "#8a6a3a", pattern: "brindle" },
    "Solid Red": { baseHex: CATTLE_COLOR_HEX.Red, pattern: "solid" },
    "Solid Black": { baseHex: CATTLE_COLOR_HEX.Black, pattern: "solid" },
    "Speckled Grey": { baseHex: CATTLE_COLOR_HEX["Light Grey"], pattern: "ticked" },
    "Dun": { baseHex: "#c19a5b", pattern: "solid" },
  };
  const m = map[shadeName] || { baseHex: CATTLE_COLOR_HEX.Red, pattern: "solid" };
  return { baseHex: m.baseHex, pattern: m.pattern, colorGenes: { merleAlleles: 0 } };
}
function speciesCoat(kind, animal) {
  if (kind === "dog") {
    const g = animal.colorGenes;
    return { baseHex: COLOR_HEX[g.base] || COLOR_HEX.fawn, pattern: g.pattern, colorGenes: g };
  }
  if (kind === "horse") {
    const g = animal.colorGenes;
    let baseHex = HORSE_BASE_HEX[g.base] || HORSE_BASE_HEX.bay;
    let pattern = "solid";
    if (g.pattern === "grey" && g.greyAlleles > 0) baseHex = "#c9cdd2";
    else {
      if (g.dilution !== "none") baseHex = shade(baseHex, 24);
      if (g.pattern === "roan" || g.pattern === "appaloosa") pattern = "ticked";
      else if (g.pattern === "tobiano" || g.pattern === "overo") pattern = "piebald";
    }
    return { baseHex, pattern, colorGenes: { merleAlleles: 0 } };
  }
  // cattle
  const b = CATTLE_BREEDS[animal.breed];
  const g = animal.colorGenes || {};
  if (!b) {
    if (g.roan) {
      const baseHex = g.roan === "solidWhite" ? CATTLE_COLOR_HEX.White : g.roan === "solidRed" ? CATTLE_COLOR_HEX["Dark Red"] : CATTLE_COLOR_HEX.Red;
      return { baseHex, pattern: g.roan === "roan" ? "ticked" : "solid", colorGenes: { merleAlleles: 0 } };
    }
    if (g.shade) return cattleShadeCoat(g.shade);
    return { baseHex: CATTLE_COLOR_HEX.Red, pattern: "solid", colorGenes: { merleAlleles: 0 } };
  }
  if (b.pattern === "roanCapable") {
    if (g.roan === "solidWhite") return { baseHex: CATTLE_COLOR_HEX.White, pattern: "solid", colorGenes: { merleAlleles: 0 } };
    if (g.roan === "solidRed") return { baseHex: CATTLE_COLOR_HEX["Dark Red"], pattern: "solid", colorGenes: { merleAlleles: 0 } };
    return { baseHex: CATTLE_COLOR_HEX.Red, pattern: "ticked", colorGenes: { merleAlleles: 0 } };
  }
  if (b.pattern === "varies") return cattleShadeCoat(g.shade);
  if (b.pattern === "pied") return { baseHex: CATTLE_COLOR_HEX[b.color] || CATTLE_COLOR_HEX.Black, pattern: "piebald", colorGenes: { merleAlleles: 0 } };
  if (b.pattern === "belted") return { baseHex: CATTLE_COLOR_HEX[b.color] || CATTLE_COLOR_HEX.Black, pattern: "belt", colorGenes: { merleAlleles: 0 } };
  return { baseHex: CATTLE_COLOR_HEX[b.color] || CATTLE_COLOR_HEX.Red, pattern: "solid", colorGenes: { merleAlleles: 0 } };
}

/* The click-to-reveal portrait itself — a species silhouette clipped
   around the same coat pattern math the swatch bar uses, seeded from the
   animal's own id so the same dog always renders the same picture.
   Deliberately a stylized generated illustration, not a photoreal or 3D
   render — there's no image-generation model wired into this game. */
function AnimalPortrait({ kind, animal, size = 160 }) {
  const rng = mulberry32(hashStr(animal.id));
  const { baseHex, pattern, colorGenes } = speciesCoat(kind, animal);
  const shapes = coatPatternShapes(pattern, colorGenes, baseHex, 220, 140, rng);
  const selfCovering = pattern === "tricolor" || pattern === "ticked";
  const clipId = "portrait-clip-" + animal.id;
  return (
    <svg className="kg-portrait" viewBox="0 0 220 140" width={size} height={Math.round(size * 140 / 220)}
      role="img" aria-label={`Generated portrait of ${animal.name}, a ${animal.breed}`}>
      <clipPath id={clipId}>{renderSilhouette(kind, "#000")}</clipPath>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="220" height="140" fill={selfCovering ? "none" : baseHex} />
        {shapes}
      </g>
      <g fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="1.5">{renderSilhouette(kind, "none")}</g>
    </svg>
  );
}

function DogCard({ dog, price, sellerName, footer, onView }) {
  const st = statusOf(dog);
  const rarity = computeRarity(dog);
  const star = starTrait(dog);
  const bc = bullyClass(dog);
  const grade = conformationGrade(dog);
  return (
    <div className="kg-card">
      <div className="kg-card__stamp">{breedShort(dog.breed)}</div>
      {dog.rescued && <div className="kg-card__rescue" title="Shelter dog">♥</div>}
      <div className="kg-card__coat">
        <CoatSwatch dog={dog} />
        {dog.collar && <span className="kg-card__collar" style={{ background: dog.collar }} title={dog.collarName || "Collar"} />}
      </div>
      <div className="kg-card__top">
        <h3 className="kg-card__name">
          {onView ? (
            <button type="button" className="kg-card__namebtn" onClick={() => onView(dog)}>
              {dog.sex === "M" ? "♂" : "♀"} {dog.name}
            </button>
          ) : (
            <span>{dog.sex === "M" ? "♂" : "♀"} {dog.name}</span>
          )}
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <RatingSeal rating={overallRating(dog.stats)} />
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
      </div>
      <p className="kg-card__breed">{dog.breed} · {colorLabel(dog.colorGenes)}</p>
      <p className="kg-card__meta">
        {ageLabel(dog.ageDays)} old · {dog.heightIn}in · {dog.weightLb}lb · Gen {dog.generation}{dog.sire ? " · out of " + dog.sire + " × " + dog.dam : ""}{sellerName ? " · " + sellerName : ""}
      </p>
      <div className="kg-card__tags">
        <Badge tone={rarity.tone}>{rarity.tier}</Badge>
        <Badge tone={grade.tone}>Grade {grade.grade}</Badge>
        {dog.culled && <Badge tone="rust">Below Standard</Badge>}
        {star.stars >= 3 && <Badge tone="gold">{starString(star.stars)} {STAT_LABELS[star.key]}</Badge>}
        {isBandogBreed(dog.breed) && <Badge tone="rust">{dog.breed === "Bandog" ? "Bandog" : dog.breed}</Badge>}
        {bc && <Badge tone={bc.key === "xxl" ? "gold" : bc.key === "xl" ? "rust" : bc.key === "pocket" ? "tan" : "denim"}>{bc.label}</Badge>}
        {dog.crossBred && dog.breed !== "Bandog" && <Badge tone="denim">Hybrid Vigor</Badge>}
        {dog.mstnAlleles === 1 && <Badge tone="rust">Muscled (MSTN)</Badge>}
        {dog.mstnAlleles === 2 && <Badge tone="rust">Double Muscled</Badge>}
        {dog.grewBigger && <Badge tone="gold">Growth Mutation</Badge>}
        {(dog.traits || []).map((k) => <Badge key={k} tone={TRAIT_DEFS[k].tone}>{TRAIT_DEFS[k].name}</Badge>)}
        {dog.impaired && <Badge tone="rust">⚠ {dog.breed === "Dogo Argentino" ? "Hearing Impaired" : "Double Merle"}</Badge>}
        {dog.registered && <Badge tone="gold">Papers {dog.regNumber}</Badge>}
        {dog.bloodline && <Badge tone="denim">{dog.bloodline} Line</Badge>}
      </div>
      {(dog.hiddenColor || dog.hiddenPattern || (dog.hiddenTraits && dog.hiddenTraits.length > 0)) && (
        <p className="kg-hint" style={{ margin: "0 0 8px" }}>
          Carries: {[dog.hiddenColor && cap(dog.hiddenColor) + " (color)", dog.hiddenPattern && cap(dog.hiddenPattern) + " (pattern)", ...(dog.hiddenTraits || []).map((k) => TRAIT_DEFS[k].name)].filter(Boolean).join(", ")} — may surface in pups
        </p>
      )}
      <div className="kg-card__stats">{STAT_KEYS.map((k) => <StatBar key={k} label={STAT_LABELS[k]} value={dog.stats[k]} />)}</div>
      <div className="kg-card__health">
        <span>♥</span>
        <div className="kg-statbar kg-statbar--health"><div className="kg-statfill" style={{ width: clamp(dog.health) + "%", background: dog.health >= 60 ? "var(--olive)" : dog.health >= 35 ? "var(--tan-ink)" : "var(--rust)" }} /></div>
        <span className="kg-statval">{Math.round(dog.health)}</span>
      </div>
      {price != null && <p className="kg-card__price">${price.toLocaleString("en-US")}</p>}
      {footer && <div className="kg-card__footer">{footer}</div>}
    </div>
  );
}

/* Renders as far back as the game actually knows — pedigree is snapshotted
   at breeding time, so it goes back exactly as many generations as you've
   bred toward, and stops honestly at "Unknown" for bought/scouted/founder
   stock rather than making anything up. */
/* A one-line dog. The full card is ~520px tall and was being used to pick an
   opponent or a stud — contexts that only need name, breed, rating and the
   stat that matters. This is that, at about a tenth the height. */
function DogRow({ dog, sellerName, meta, right, selected, onSelect, onView, disabled }) {
  const st = statusOf(dog);
  const star = starTrait(dog);
  const rating = overallRating(dog.stats);
  const tone = rating >= 80 ? "gold" : rating >= 65 ? "olive" : rating >= 45 ? "denim" : "rust";
  return (
    <div className={"kg-row " + (selected ? "kg-row--on " : "") + (disabled ? "kg-row--off " : "")}>
      {onSelect && (
        <button type="button" className="kg-row__pick" onClick={() => onSelect(dog)} disabled={disabled}
          aria-pressed={!!selected} aria-label={`Choose ${dog.name}`}>
          <span className="kg-row__tick">{selected ? "✓" : ""}</span>
        </button>
      )}
      <span className={"kg-row__rating kg-row__rating--" + tone}>{rating}</span>
      <span className="kg-row__coat" style={{ background: COLOR_HEX[dog.colorGenes.base] || "#888" }} title={colorLabel(dog.colorGenes)} />
      <div className="kg-row__main">
        <span className="kg-row__name">
          {onView
            ? <button type="button" className="kg-card__namebtn" onClick={() => onView(dog)}>{dog.sex === "M" ? "♂" : "♀"} {titledName(dog)}</button>
            : <>{dog.sex === "M" ? "♂" : "♀"} {titledName(dog)}</>}
        </span>
        <span className="kg-row__meta">
          {breedShort(dog.breed)} · {ageLabel(dog.ageDays)}
          {star ? <> · {star.stars}★ {STAT_LABELS[star.key]}</> : null}
          {sellerName ? <> · {sellerName}</> : null}
          {meta ? <> · {meta}</> : null}
        </span>
      </div>
      <span className={"kg-badge kg-badge--" + st.tone + " kg-row__status"}>{st.label}</span>
      {right ? <div className="kg-row__right">{right}</div> : null}
    </div>
  );
}

function PedigreeBranch({ role, entry, depth, maxDepth }) {
  return (
    <div className="kg-pednode">
      <div className="kg-pednode__row">
        <span className="kg-pednode__role">{role}</span>
        {entry ? (
          <span className="kg-pednode__name">{entry.name} <span className="kg-pednode__meta">— {entry.breed}, {colorLabel(entry.colorGenes)}{entry.bloodline ? ", " + entry.bloodline + " Line" : ""}{entry.regNumber ? ", " + entry.regNumber : ""}</span></span>
        ) : (
          <span className="kg-pednode__unknown">Unknown — foundation stock</span>
        )}
      </div>
      {entry && entry.pedigree && depth < maxDepth && (
        <div className="kg-pednode__children">
          <PedigreeBranch role="Sire" entry={entry.pedigree.sire} depth={depth + 1} maxDepth={maxDepth} />
          <PedigreeBranch role="Dam" entry={entry.pedigree.dam} depth={depth + 1} maxDepth={maxDepth} />
        </div>
      )}
      {entry && entry.pedigree && depth >= maxDepth && <div className="kg-pednode__unknown" style={{ marginLeft: 16 }}>…earlier generations on file, not shown here</div>}
    </div>
  );
}
function FamilyTree({ dog }) {
  if (!dog.pedigree) return <p className="kg-empty">No ancestry on record — {dog.name} is foundation stock (bought, scouted, or an original founder).</p>;
  return (
    <div className="kg-pedtree">
      <div className="kg-pedroot">{dog.sex === "M" ? "♂" : "♀"} {dog.name} — Gen {dog.generation}</div>
      <PedigreeBranch role="Sire" entry={dog.pedigree.sire} depth={1} maxDepth={4} />
      <PedigreeBranch role="Dam" entry={dog.pedigree.dam} depth={1} maxDepth={4} />
    </div>
  );
}

/* Shown right after a litter is whelped — the player picks which pups to
   keep (capped by remaining kennel space). Anything not picked goes to a
   pet home for half its value rather than vanishing outright. */
function LitterPicker({ litter, selectedIds, onToggle, onConfirm }) {
  if (!litter) return null;
  const { pups, room, note, label } = litter;
  const atLimit = selectedIds.length >= room;
  return (
    <div className="kg-modal-backdrop">
      <div className="kg-modal" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
        <div className="kg-modal__head">
          <h2>🐾 New litter — {label}</h2>
          <p className="kg-hint">
            {room === 0
              ? "Your kennel's full — every pup here will go to a pet home for half value."
              : `Pick up to ${room} pup${room === 1 ? "" : "s"} to keep (your kennel has room for ${room} more). The rest go to pet homes at half value.`}
          </p>
          {note && <p className="kg-note">{note}</p>}
        </div>
        <div className="kg-grid">
          {pups.map((p) => {
            const picked = selectedIds.includes(p.id);
            return (
              <DogCard key={p.id} dog={p}
                footer={room === 0 ? <span className="kg-empty">Pet home — {fmtMoney(Math.round(computeValue(p) * 0.5))}</span> : (
                  <button className={"kg-btn kg-btn--sm " + (picked ? "" : "kg-btn--ghost")} disabled={!picked && atLimit} onClick={() => onToggle(p.id)}>
                    {picked ? "✓ Keeping" : atLimit ? "No room left" : "Keep this pup"}
                  </button>
                )} />
            );
          })}
        </div>
        <button className="kg-btn kg-btn--gold" style={{ marginTop: 16, width: "auto" }} onClick={onConfirm}>
          {room === 0 ? "Continue" : `Confirm — keep ${selectedIds.length}`}
        </button>
      </div>
    </div>
  );
}

/* Suggests a ChatGPT prompt built from the animal's real breed and coat
   color, and lets the player attach whatever picture they generate there
   (or any photo) as its portrait — the only path to something genuinely
   photoreal, since no image-generation model is wired into this game.
   Downscaled hard to a small square JPEG on the way in so a save full of
   photos doesn't blow past localStorage/cloud-save size limits. */
function suggestedPortraitPrompt(kind, animal, colorText) {
  const species = kind === "dog" ? "dog" : kind === "horse" ? "horse" : "cow";
  // Some breed names already end in the species word (Catahoula Leopard
  // Dog) — don't stack a second "dog" on top of it.
  const needsSpecies = !animal.breed.toLowerCase().endsWith(species);
  const sex = animal.sex === "M" ? "male" : "female";
  return `A realistic photo of a ${sex} ${animal.breed}${needsSpecies ? " " + species : ""}, ${colorText.toLowerCase()} coat, standing outdoors on a ranch.`;
}
function PhotoUploader({ kind, animal, colorText, onUpload }) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);
  const prompt = suggestedPortraitPrompt(kind, animal, colorText);

  function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 280;
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        onUpload(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
  function copyPrompt() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(prompt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
    }
  }

  return (
    <div className="kg-photonudge">
      <p className="kg-hint" style={{ margin: "10px 0 6px" }}>Want a real picture instead? Generate one on ChatGPT with this prompt, then upload it here.</p>
      <p className="kg-photonudge__prompt">{prompt}</p>
      <div className="kg-photonudge__actions">
        <button type="button" className="kg-btn kg-btn--sm2 kg-btn--ghost" onClick={copyPrompt}>{copied ? "Copied!" : "Copy prompt"}</button>
        <a className="kg-btn kg-btn--sm2 kg-btn--ghost" href="https://chatgpt.com" target="_blank" rel="noopener noreferrer">Open ChatGPT ↗</a>
        <button type="button" className="kg-btn kg-btn--sm2" onClick={() => inputRef.current && inputRef.current.click()}>Upload photo</button>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
      </div>
    </div>
  );
}

function DogProfileModal({ dog, onClose, onSetPhoto }) {
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [showPortrait, setShowPortrait] = useState(false);

  // Escape to close, and park focus inside the dialog so keyboard users aren't
  // left tabbing through the page behind it. Keyed on the dog's id rather than
  // the object, and reading onClose through a ref, so a re-render can't re-run
  // this and steal focus back mid-interaction.
  const dogId = dog ? dog.id : null;
  useEffect(() => {
    if (!dogId) return;
    setShowPortrait(false);
    const onKey = (e) => { if (e.key === "Escape") onCloseRef.current(); };
    const previouslyFocused = document.activeElement;
    document.addEventListener("keydown", onKey);
    if (closeRef.current) closeRef.current.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    };
  }, [dogId]);

  if (!dog) return null;
  const rarity = computeRarity(dog);
  const star = starTrait(dog);
  const value = computeValue(dog);
  const bc = bullyClass(dog);
  const grade = conformationGrade(dog);
  return (
    <div className="kg-modal-backdrop" onClick={onClose}>
      <div className="kg-modal" role="dialog" aria-modal="true" aria-label={`${dog.name} — ${dog.breed}`} onClick={(e) => e.stopPropagation()}>
        <button className="kg-modal__close" ref={closeRef} onClick={onClose} aria-label="Close">✕</button>
        <div className="kg-modal__head">
          <CoatSwatch dog={dog} height={40} />
          <button type="button" className="kg-portrait-trigger" onClick={() => setShowPortrait((v) => !v)}
            title={showPortrait ? "Hide portrait" : "Generate a portrait"}>
            <h2>{dog.sex === "M" ? "♂" : "♀"} {dog.name} <span className="kg-portrait-hint" aria-hidden="true">▢</span></h2>
          </button>
          <p className="kg-card__breed">{dog.breed} · {colorLabel(dog.colorGenes)}</p>
          {showPortrait && (dog.photo ? (
            <>
              <img src={dog.photo} alt={`${dog.name}, a ${dog.breed}`} className="kg-portrait kg-portrait--photo" width={180} height={180} />
              <button type="button" className="kg-linklike" onClick={() => onSetPhoto(null)}>Remove photo</button>
            </>
          ) : (
            <>
              <AnimalPortrait kind="dog" animal={dog} size={180} />
              <PhotoUploader kind="dog" animal={dog} colorText={colorLabel(dog.colorGenes)} onUpload={onSetPhoto} />
            </>
          ))}
        </div>

        <div className="kg-modal__tags">
          <Badge tone={rarity.tone}>{rarity.tier}</Badge>
          <Badge tone="gold">{starString(star.stars)} {STAT_LABELS[star.key]} specialist</Badge>
          {isBandogBreed(dog.breed) && <Badge tone="rust">{dog.breed === "Bandog" ? "Bandog" : dog.breed}</Badge>}
          {dog.crossBred && dog.breed !== "Bandog" && <Badge tone="denim">Hybrid Vigor</Badge>}
          {dog.impaired && <Badge tone="rust">⚠ {dog.breed === "Dogo Argentino" ? "Hearing Impaired" : "Double Merle"}</Badge>}
          {dog.registered && <Badge tone="gold">Papers {dog.regNumber}</Badge>}
          {dog.bloodline && <Badge tone="denim">{dog.bloodline} Line</Badge>}
        </div>

        <h3 className="kg-modal__section">Working stats</h3>
        <div className="kg-card__stats">{STAT_KEYS.map((k) => <StatBar key={k} label={STAT_LABELS[k]} value={dog.stats[k]} />)}</div>
        <p className="kg-note">Overall rating: {overallRating(dog.stats)} / 100</p>

        <h3 className="kg-modal__section">Body &amp; condition</h3>
        <ul className="kg-modal__facts">
          <li>Age: {ageLabel(dog.ageDays)} ({dog.ageDays} days)</li>
          <li>Height: {dog.heightIn} in</li>
          <li>Weight: {dog.weightLb} lb</li>
          <li>Health: {Math.round(dog.health)} / 100</li>
          <li>Conformation grade: <strong>{grade.grade}</strong> — {grade.desc}</li>
          <li>Estimated value: {fmtMoney(value)}</li>
        </ul>
        {dog.culled && <p className="kg-warn">This pup came out below standard at birth — noticeably weaker across the board. It happens in real litters too; not every pup is breeding or sale quality.</p>}

        {(isBandogBreed(dog.breed) || dog.breed === "American Pit Bull Terrier") && (
          <>
            <h3 className="kg-modal__section">Bully Classification</h3>
            {bc ? (
              <>
                <p className="kg-note" style={{ margin: "0 0 6px" }}><strong>{bc.label}</strong> — {bc.desc}</p>
                <p className="kg-hint" style={{ margin: 0 }}>{dog.sex === "M" ? "Male" : "Female"} thresholds (ABKC/UKC): Pocket under {dog.sex === "M" ? 17 : 16}in · Standard/Classic {dog.sex === "M" ? "17–20" : "16–19"}in · XL {dog.sex === "M" ? "over 20–23" : "over 19–22"}in · XXL past that (unofficial). At {dog.heightIn}in this one lands in {bc.label}.</p>
              </>
            ) : (
              <p className="kg-hint">Under {dog.sex === "M" ? 14 : 13}in — too short to fall inside a recognized Bully height class.</p>
            )}
            <p className="kg-hint" style={{ marginTop: 6 }}>Worth knowing: the real American Bully is its own breed (APBT × American Staffordshire Terrier, with historical Bulldog influence) — this tag is the informal height-based label people use on big APBT-type dogs and Bandogs, not a claim that this dog is a registered American Bully.</p>
          </>
        )}

        <h3 className="kg-modal__section">Genetics</h3>
        <ul className="kg-modal__facts">
          <li>Visible coat: {colorLabel(dog.colorGenes)}</li>
          <li>Merle alleles carried: {dog.colorGenes.merleAlleles}{dog.colorGenes.merleAlleles === 2 ? " (double merle)" : dog.colorGenes.merleAlleles === 1 ? " (single copy — visible)" : " (none)"}</li>
          <li>Hidden color gene: {dog.hiddenColor ? cap(dog.hiddenColor) : "none known"}</li>
          <li>Hidden pattern gene: {dog.hiddenPattern ? cap(dog.hiddenPattern) : "none known"}</li>
        </ul>

        <h3 className="kg-modal__section">Physical Traits</h3>
        {(dog.traits && dog.traits.length) || dog.mstnAlleles ? (
          <ul className="kg-modal__facts" style={{ gap: 10 }}>
            {dog.mstnAlleles === 1 && <li><strong>{TRAIT_DEFS.myostatin1.name}</strong> — {TRAIT_DEFS.myostatin1.desc}</li>}
            {dog.mstnAlleles === 2 && <li><strong>{TRAIT_DEFS.myostatin2.name}</strong> — {TRAIT_DEFS.myostatin2.desc}</li>}
            {(dog.traits || []).map((k) => (
              <li key={k}><strong>{TRAIT_DEFS[k].name}</strong> — {TRAIT_DEFS[k].desc}{TRAIT_DEFS[k].real === false && <em style={{ color: "var(--ink-soft)" }}> (gameplay trait, not a single named gene)</em>}</li>
            ))}
          </ul>
        ) : <p className="kg-empty">No standout physical traits — an even, unremarkable specimen for the breed.</p>}
        {(dog.hiddenTraits && dog.hiddenTraits.length > 0) && (
          <p className="kg-note">Also carries hidden: {dog.hiddenTraits.map((k) => TRAIT_DEFS[k].name).join(", ")} — not expressed in this dog, but can surface in pups.</p>
        )}

        <h3 className="kg-modal__section">Family Tree</h3>
        <ul className="kg-modal__facts" style={{ marginBottom: 10 }}>
          <li>Registration: {dog.registered ? dog.regNumber : "unregistered"}</li>
          <li>Bloodline: {dog.bloodline ? dog.bloodline + " Line" : "none"}</li>
        </ul>
        <FamilyTree dog={dog} />
      </div>
    </div>
  );
}

/* ---------------------------------- app ---------------------------------- */

/* Account widget: sign in / create account / sign out, shared between the
   setup screen (so a returning player can pull their cloud kennel before
   founding a new local one) and the main game header. */
function CloudAuthPanel(props) {
  const {
    session, cloudStatus, open, onToggle,
    authMode, setAuthMode, authEmail, setAuthEmail, authPassword, setAuthPassword,
    authMsg, onSubmit, onSignOut, onGoogle,
  } = props;

  const firstFieldRef = useRef(null);
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;

  // Focus the email field once, when the dialog opens — and only then.
  // This used to also depend on onToggle, which the parent passes as an inline
  // arrow, so it got a new identity on every render: typing a character
  // re-ran the effect and yanked focus back out of the password field.
  useEffect(() => {
    if (!open) return;
    if (firstFieldRef.current) firstFieldRef.current.focus();
  }, [open]);

  // Escape closes. Reads onToggle through a ref so a changing prop identity
  // can't re-subscribe (or re-focus) mid-typing.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onToggleRef.current(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="kg-cloud">
      <button className={"kg-btn kg-btn--sm2" + (session ? " kg-btn--ghost" : "")} style={{ width: "auto" }} onClick={onToggle}>
        {session ? (cloudStatus === "syncing" ? "Saving…" : "Account") : "Sign in"}
      </button>
      {open && (
        <div className="kg-modal-backdrop" onClick={onToggle}>
          <div className="kg-modal kg-modal--auth" role="dialog" aria-modal="true"
            aria-label={session ? "Your account" : "Sign in to Sundown Kennels"}
            onClick={(e) => e.stopPropagation()}>
          <button className="kg-modal__close" onClick={onToggle} aria-label="Close">✕</button>
          {session ? (
            <React.Fragment>
              <h3 className="kg-auth__title">Your account</h3>
              <p className="kg-auth__lede">
                Signed in as <strong>{session.user.email}</strong>. Your dogs, bloodlines, cash
                and property all save to this account automatically, and follow you to any
                browser you sign in from.
              </p>
              <div className="kg-cloud__status">Sync status: {cloudStatus}</div>
              <button className="kg-btn kg-btn--danger kg-btn--sm" style={{ marginTop: 14 }} onClick={onSignOut}>Sign out</button>
            </React.Fragment>
          ) : (
            <form onSubmit={onSubmit}>
              <h3 className="kg-auth__title">{authMode === "signin" ? "Sign in" : "Create an account"}</h3>
              <p className="kg-auth__lede">
                {authMode === "signin"
                  ? "Pick up where you left off. Your kennel is tied to your account, so it's waiting on any device you sign in from."
                  : "Your kennel saves to your account — every dog, bloodline and dollar — so you can close the tab and come back to it from anywhere."}
              </p>
              {onGoogle && (
                <>
                  <button type="button" className="kg-btn kg-btn--google" onClick={onGoogle}>
                    <svg viewBox="0 0 18 18" width="17" height="17" aria-hidden="true" focusable="false">
                      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
                      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
                      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
                      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
                    </svg>
                    Continue with Google
                  </button>
                  <div className="kg-auth__or"><span>or use an email</span></div>
                </>
              )}
              <label className="kg-auth__label" htmlFor="kg-auth-email">Email</label>
              <input id="kg-auth-email" ref={firstFieldRef} type="email" autoComplete="email" placeholder="you@example.com"
                required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
              <label className="kg-auth__label" htmlFor="kg-auth-pw">Password</label>
              <input id="kg-auth-pw" type="password" autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                placeholder={authMode === "signin" ? "Your password" : "At least 6 characters"}
                required minLength={6} value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
              <div className="kg-cloud__row">
                <button type="submit" className="kg-btn kg-btn--gold">{authMode === "signin" ? "Sign in" : "Create account"}</button>
              </div>
              {authMsg && <div className="kg-cloud__msg">{authMsg}</div>}
              <button type="button" className="kg-cloud__switch" onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}>
                {authMode === "signin" ? "No account yet? Create one" : "Already have an account? Sign in"}
              </button>
              <p className="kg-auth__note">
                Without an account the game still saves, but only to this browser — clearing
                your history clears the kennel with it.
              </p>
            </form>
          )}
          </div>
        </div>
      )}
    </div>
  );
}

/* One card component for both horses and cattle — much simpler than
   DogCard (no traits/rarity/bully-class), just breed, sex, age, colour,
   and whichever stat set the kind uses. */
function AnimalCard({ kind, animal, price, sellerName, footer, onView }) {
  const cfg = LIVESTOCK_CONFIG[kind];
  const rating = cfg.rating(animal.stats);
  const stage = animalStageLabel(kind, animal);
  const retired = isAnimalRetired(kind, animal);
  return (
    <div className="kg-card">
      <div className="kg-card__stamp">{cfg.label}</div>
      <div className="kg-card__top">
        <h3 className="kg-card__name">
          {onView
            ? <button type="button" className="kg-card__namebtn" onClick={() => onView({ kind, animal })}>{animal.sex === "M" ? "♂" : "♀"} {animal.name}</button>
            : <span>{animal.sex === "M" ? "♂" : "♀"} {animal.name}</span>}
        </h3>
        <RatingSeal rating={rating} />
      </div>
      <p className="kg-card__breed">{animal.breed} · {cfg.colorLabel(animal)}</p>
      <p className="kg-card__meta">
        {ageLabel(animal.ageDays)} old · {cfg.sizeLabel(animal)} · Gen {animal.generation}{animal.sire ? " · out of " + animal.sire + " × " + animal.dam : ""}{sellerName ? " · " + sellerName : ""}
      </p>
      <div className="kg-card__tags">
        {animal.registered && <Badge tone="gold">Registered</Badge>}
        {animal.injury && <Badge tone="rust">{(INJURIES[animal.injury.key] || {}).label || "Injured"}</Badge>}
        {retired ? <Badge tone="tan">Retired</Badge> : <Badge tone={stage === "In its prime" ? "olive" : "denim"}>{stage}</Badge>}
        {animal.breedCooldown > 0 && <Badge tone="rust">Resting</Badge>}
      </div>
      <div className="kg-card__stats">
        {cfg.statKeys.map((k) => <StatBar key={k} label={cfg.statLabels[k]} value={animal.stats[k]} />)}
      </div>
      <div className="kg-statrow"><span className="kg-statlabel">Health</span><div className="kg-statbar"><div className="kg-statfill" style={{ width: clamp(animal.health) + "%", background: "var(--olive)" }} /></div><span className="kg-statval">{Math.round(animal.health)}</span></div>
      {typeof price === "number" && <p className="kg-card__price">{fmtMoney(price)}</p>}
      {footer && <div className="kg-card__footer">{footer}</div>}
    </div>
  );
}

/* The livestock equivalent of DogProfileModal — horses and cattle had cards
   but nothing to click into, so their pedigree and condition were invisible. */
function AnimalProfileModal({ target, onClose, onSetPhoto }) {
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const id = target ? target.animal.id : null;
  const [showPortrait, setShowPortrait] = useState(false);

  useEffect(() => {
    if (!id) return;
    setShowPortrait(false);
    const onKey = (e) => { if (e.key === "Escape") onCloseRef.current(); };
    const previouslyFocused = document.activeElement;
    document.addEventListener("keydown", onKey);
    if (closeRef.current) closeRef.current.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    };
  }, [id]);

  if (!target) return null;
  const { kind, animal } = target;
  const cfg = LIVESTOCK_CONFIG[kind];
  const rating = cfg.rating(animal.stats);
  const years = (animal.ageDays / 365).toFixed(1);
  const L = LIFESPANS[kind] || {};
  const injury = animal.injury && INJURIES[animal.injury.key];

  return (
    <div className="kg-modal-backdrop" onClick={onClose}>
      <div className="kg-modal" role="dialog" aria-modal="true" aria-label={`${animal.name} — ${animal.breed}`} onClick={(e) => e.stopPropagation()}>
        <button className="kg-modal__close" ref={closeRef} onClick={onClose} aria-label="Close">✕</button>
        <div className="kg-modal__head">
          <button type="button" className="kg-portrait-trigger" onClick={() => setShowPortrait((v) => !v)}
            title={showPortrait ? "Hide portrait" : "Generate a portrait"}>
            <h2>{animal.sex === "M" ? "♂" : "♀"} {animal.name} <span className="kg-portrait-hint" aria-hidden="true">▢</span></h2>
          </button>
          <p className="kg-card__breed">{animal.breed} · {cfg.colorLabel(animal)}</p>
          {showPortrait && (animal.photo ? (
            <>
              <img src={animal.photo} alt={`${animal.name}, a ${animal.breed}`} className="kg-portrait kg-portrait--photo" width={180} height={180} />
              <button type="button" className="kg-linklike" onClick={() => onSetPhoto(null)}>Remove photo</button>
            </>
          ) : (
            <>
              <AnimalPortrait kind={kind} animal={animal} size={180} />
              <PhotoUploader kind={kind} animal={animal} colorText={cfg.colorLabel(animal)} onUpload={onSetPhoto} />
            </>
          ))}
        </div>

        <div className="kg-modal__tags">
          <Badge tone="denim">{cfg.label}</Badge>
          <Badge tone={isAnimalRetired(kind, animal) ? "tan" : "olive"}>{animalStageLabel(kind, animal)}</Badge>
          {animal.registered && <Badge tone="gold">Registered</Badge>}
          {animal.injury && <Badge tone="rust">{injury ? injury.label : "Injured"}</Badge>}
        </div>

        <h3 className="kg-modal__section">Ability</h3>
        <div className="kg-card__stats">
          {cfg.statKeys.map((k) => <StatBar key={k} label={cfg.statLabels[k]} value={animal.stats[k]} />)}
        </div>
        <p className="kg-note">Overall rating: {rating} / 100</p>

        <h3 className="kg-modal__section">Condition &amp; age</h3>
        <ul className="kg-modal__facts">
          <li><strong>Age:</strong> {years} years ({ageLabel(animal.ageDays)})</li>
          <li><strong>Stage:</strong> {animalStageLabel(kind, animal)} — prime is {L.primeFrom}–{L.primeTo} years for {kind === "horse" ? "horses" : "cattle"}</li>
          <li><strong>Health:</strong> {Math.round(animal.health)} / 100</li>
          <li><strong>Size:</strong> {cfg.sizeLabel(animal)}</li>
          {animal.injury && <li><strong>Injury:</strong> {injury ? injury.desc : "Recovering"} — {Math.max(0, Math.round(animal.injury.daysLeft))} days to go</li>}
          {animal.breedCooldown > 0 && <li><strong>Resting:</strong> {Math.round(animal.breedCooldown)} days before breeding again</li>}
        </ul>

        <h3 className="kg-modal__section">Breeding</h3>
        <ul className="kg-modal__facts">
          <li><strong>Generation:</strong> {animal.generation}</li>
          <li><strong>Sire:</strong> {animal.sire || "Unknown"}</li>
          <li><strong>Dam:</strong> {animal.dam || "Unknown"}</li>
          <li><strong>Value:</strong> {fmtMoney(cfg.value(animal))}</li>
        </ul>
      </div>
    </div>
  );
}

/* One panel handles horses and cattle both — herd, breeding, AI market,
   shows, and the full multiplayer suite (trade/rivals/stud board), all
   driven by LIVESTOCK_CONFIG[kind] rather than being written twice. */
function LivestockPanel({ kind, state, session, pvp, patch, cloudAuthEl, setViewAnimal,
  doBuyAnimal, scoutAnimalMarket, doSellAnimal, doBreedAnimal, doEnterShow,
  listAnimalForSale, cancelAnimalListing, buyAnimalListing,
  createAnimalChallenge, cancelAnimalChallenge, acceptAnimalChallenge,
  postAnimalStud, cancelAnimalStudOffer, requestAnimalStud, declineAnimalStudRequest, acceptAnimalStudRequestAction,
}) {
  const cfg = LIVESTOCK_CONFIG[kind];
  const herd = state[cfg.arrayKey];
  const capacity = livestockCapacity(state);
  const count = livestockCount(state);
  const full = count >= capacity;
  const breedableM = herd.filter((a) => a.sex === "M" && cfg.canBreed(a));
  const breedableF = herd.filter((a) => a.sex === "F" && cfg.canBreed(a));
  const hauling = canHaul(state);
  const [breedPick, setBreedPick] = React.useState({ sireId: null, damId: null });
  const [showPick, setShowPick] = React.useState({ animalId: null, event: Object.keys(cfg.events)[0] });

  return (
    <section>
      <p className="kg-hint">
        ℹ {cfg.labelPlural} share one pasture: {count} / {capacity} head, {capacity - count} open.{" "}
        {!hauling && "Buy a truck and trailer in the Property tab to take one to a show or auction."}
      </p>

      <h2 className="kg-subhead">Your {cfg.labelPlural.toLowerCase()}</h2>
      {herd.length === 0 ? <p className="kg-empty">None yet — buy one from the market below, or a real player's Trade listing.</p> : (
        <div className="kg-grid">
          {herd.map((a) => (
            <AnimalCard key={a.id} kind={kind} animal={a} onView={setViewAnimal} footer={
              <React.Fragment>
                <button className="kg-btn kg-btn--sm kg-btn--danger" onClick={() => doSellAnimal(kind, a, false)}>Sell privately — {fmtMoney(cfg.value(a))}</button>
                {cfg.auctionValue && (
                  <button className="kg-btn kg-btn--sm" disabled={!hauling} onClick={() => doSellAnimal(kind, a, true)}>
                    {hauling ? `Take to auction — ${fmtMoney(cfg.auctionValue(a))}` : "Need truck + trailer"}
                  </button>
                )}
              </React.Fragment>
            } />
          ))}
        </div>
      )}

      <h2 className="kg-subhead">Breed your own</h2>
      {breedableM.length === 0 || breedableF.length === 0 ? <p className="kg-empty">Need a breeding-age male and female of your own, healthy and off cooldown.</p> : (
        <div className="kg-pairpick">
          <select value={breedPick.sireId || ""} onChange={(e) => setBreedPick((p) => ({ ...p, sireId: e.target.value }))}>
            <option value="">Choose sire (♂)</option>
            {breedableM.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.breed} ({cfg.rating(a.stats)})</option>)}
          </select>
          <select value={breedPick.damId || ""} onChange={(e) => setBreedPick((p) => ({ ...p, damId: e.target.value }))}>
            <option value="">Choose dam (♀)</option>
            {breedableF.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.breed} ({cfg.rating(a.stats)})</option>)}
          </select>
          <button className="kg-btn kg-btn--sm" disabled={!breedPick.sireId || !breedPick.damId}
            onClick={() => { doBreedAnimal(kind, breedPick.sireId, breedPick.damId); setBreedPick({ sireId: null, damId: null }); }}>
            Breed
          </button>
        </div>
      )}

      <hr className="kg-divider" />
      <div className="kg-marketbar">
        <h2 className="kg-subhead">{cfg.labelPlural} market</h2>
        <button className="kg-btn kg-btn--ghost kg-btn--sm" onClick={() => scoutAnimalMarket(kind)}>⟳ Scout New {cfg.labelPlural}</button>
      </div>
      {state[cfg.marketKey].length === 0 ? <p className="kg-empty">Nothing here right now — scout for more.</p> : (
        <div className="kg-grid">
          {state[cfg.marketKey].map((a) => (
            <AnimalCard key={a.id} kind={kind} animal={a} onView={setViewAnimal} price={a.price} sellerName={"from " + a.sellerName}
              footer={<button className="kg-btn kg-btn--sm" disabled={state.cash < a.price || full} onClick={() => doBuyAnimal(kind, a)}>
                {full ? "No room" : state.cash < a.price ? "Can't afford" : "Buy"}
              </button>} />
          ))}
        </div>
      )}

      <hr className="kg-divider" />
      <h2 className="kg-subhead">Shows</h2>
      <div className="kg-hunttypes">
        {Object.entries(cfg.events).map(([key, ev]) => (
          <button key={key} className={"kg-trialcard " + (showPick.event === key ? "kg-trialcard--active" : "")} onClick={() => setShowPick((p) => ({ ...p, event: key }))}>
            <strong>{ev.label}</strong><span>{ev.desc}</span>
          </button>
        ))}
      </div>
      {herd.length === 0 ? <p className="kg-empty">You need an animal of your own to enter.</p> : (
        <div className="kg-pairpick">
          <select value={showPick.animalId || ""} onChange={(e) => setShowPick((p) => ({ ...p, animalId: e.target.value }))}>
            <option value="">Choose your entrant</option>
            {herd.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.breed} ({cfg.rating(a.stats)})</option>)}
          </select>
          <button className="kg-btn kg-btn--sm" disabled={!showPick.animalId || !hauling}
            onClick={() => { doEnterShow(kind, herd.find((a) => a.id === showPick.animalId), showPick.event); setShowPick((p) => ({ ...p, animalId: null })); }}>
            {!hauling ? "Need truck + trailer" : "Enter"}
          </button>
        </div>
      )}

      <hr className="kg-divider" />
      <h2 className="kg-subhead">Trade — real kennels, real {cfg.labelPlural.toLowerCase()}</h2>
      {!session && <p className="kg-notice">Sign in (top right) to trade with other players.</p>}
      {pvp.msg && <p className="kg-note">{pvp.msg}</p>}
      {session && (
        <React.Fragment>
          {herd.length > 0 && (
            <div className="kg-pairpick">
              <select value={pvp.sellPick.animalId || ""} onChange={(e) => patch({ sellPick: { ...pvp.sellPick, animalId: e.target.value } })}>
                <option value="">Choose an animal to list</option>
                {herd.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.breed} ({cfg.rating(a.stats)})</option>)}
              </select>
              <input type="number" min="1" placeholder="Price" style={{ maxWidth: 120 }}
                value={pvp.sellPick.price} onChange={(e) => patch({ sellPick: { ...pvp.sellPick, price: e.target.value } })} />
              <button className="kg-btn kg-btn--sm" disabled={!pvp.sellPick.animalId || !pvp.sellPick.price}
                onClick={() => listAnimalForSale(kind, pvp.sellPick.animalId, pvp.sellPick.price)}>List for Sale</button>
            </div>
          )}
          {pvp.listings.some((l) => l.seller_id === session.user.id) && (
            <ul className="kg-log" style={{ marginBottom: 16 }}>
              {pvp.listings.filter((l) => l.seller_id === session.user.id).map((l) => (
                <li key={l.id} className="kg-logrow">
                  <span>{l.dog.name} — {fmtMoney(l.price)}</span>
                  <button className="kg-btn kg-btn--ghost kg-btn--sm" style={{ width: "auto" }} onClick={() => cancelAnimalListing(kind, l)}>Cancel</button>
                </li>
              ))}
            </ul>
          )}
        </React.Fragment>
      )}
      {pvp.listings.filter((l) => l.seller_id !== session?.user?.id).length === 0 ? (
        <p className="kg-empty">Nobody's listed a {cfg.label.toLowerCase()} yet.</p>
      ) : (
        <div className="kg-grid">
          {pvp.listings.filter((l) => l.seller_id !== session?.user?.id).map((l) => (
            <AnimalCard key={l.id} kind={kind} animal={l.dog} price={l.price} sellerName={"from " + l.seller_name}
              footer={<button className="kg-btn kg-btn--sm" disabled={!session || state.cash < l.price || full} onClick={() => buyAnimalListing(kind, l)}>
                {!session ? "Sign in to buy" : full ? "No room" : state.cash < l.price ? "Can't afford" : "Buy"}
              </button>} />
          ))}
        </div>
      )}

      <hr className="kg-divider" />
      <h2 className="kg-subhead">Rivals — challenge a real kennel</h2>
      {session && herd.length > 0 && (
        <React.Fragment>
          <div className="kg-hunttypes">
            {Object.entries(cfg.events).map(([key, ev]) => (
              <button key={key} className={"kg-trialcard " + (pvp.challengePick.event === key ? "kg-trialcard--active" : "")} onClick={() => patch({ challengePick: { ...pvp.challengePick, event: key } })}>
                <strong>{ev.label}</strong><span>{ev.desc}</span>
              </button>
            ))}
          </div>
          <div className="kg-pairpick">
            <select value={pvp.challengePick.animalId || ""} onChange={(e) => patch({ challengePick: { ...pvp.challengePick, animalId: e.target.value } })}>
              <option value="">Choose your entrant</option>
              {herd.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.breed} ({cfg.rating(a.stats)})</option>)}
            </select>
            <button className="kg-btn kg-btn--sm" disabled={!pvp.challengePick.animalId} onClick={() => createAnimalChallenge(kind, pvp.challengePick.animalId, pvp.challengePick.event)}>Post Challenge</button>
          </div>
        </React.Fragment>
      )}
      {pvp.openChallenges.some((c) => c.creator_id === session?.user?.id) && (
        <ul className="kg-log" style={{ marginBottom: 16 }}>
          {pvp.openChallenges.filter((c) => c.creator_id === session.user.id).map((c) => (
            <li key={c.id} className="kg-logrow">
              <span>{cfg.events[c.trial].label} — {c.dog.name} — waiting for an opponent</span>
              <button className="kg-btn kg-btn--ghost kg-btn--sm" style={{ width: "auto" }} onClick={() => cancelAnimalChallenge(kind, c)}>Cancel</button>
            </li>
          ))}
        </ul>
      )}
      {pvp.openChallenges.filter((c) => c.creator_id !== session?.user?.id).length === 0 ? (
        <p className="kg-empty">No open challenges right now.</p>
      ) : (
        <ul className="kg-log" style={{ marginBottom: 16 }}>
          {pvp.openChallenges.filter((c) => c.creator_id !== session?.user?.id).map((c) => (
            <li key={c.id} className="kg-logrow">
              <span>{c.creator_name} — {cfg.events[c.trial].label} — {c.dog.name} ({cfg.rating(c.dog.stats)} overall)</span>
              {session && herd.length > 0 && (
                <div style={{ display: "flex", gap: 6 }}>
                  <select value={pvp.acceptPick[c.id] || ""} onChange={(e) => patch({ acceptPick: { ...pvp.acceptPick, [c.id]: e.target.value } })}>
                    <option value="">Your entrant</option>
                    {herd.map((a) => <option key={a.id} value={a.id}>{a.name} ({cfg.rating(a.stats)})</option>)}
                  </select>
                  <button className="kg-btn kg-btn--sm" disabled={!pvp.acceptPick[c.id]} onClick={() => acceptAnimalChallenge(kind, c, pvp.acceptPick[c.id])}>Accept</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {pvp.myChallenges.length > 0 && (
        <ul className="kg-log">
          {pvp.myChallenges.map((c) => {
            const won = c.winner_id === session?.user?.id;
            return (
              <li key={c.id} className={"kg-logrow kg-logrow--" + (won ? "money" : "injury")}>
                <span>{cfg.events[c.trial].label}: {c.creator_name} ({c.dog.name}) vs {c.opponent_name} ({c.opponent_dog.name}) — {won ? "you won" : "you lost"} by {Math.round(c.margin)}</span>
              </li>
            );
          })}
        </ul>
      )}

      <hr className="kg-divider" />
      <h2 className="kg-subhead">Stud board — split offspring, better-rated parent's side keeps it</h2>
      {session && breedableM.length > 0 && (
        <div className="kg-pairpick">
          <select value={pvp.studPick.animalId || ""} onChange={(e) => patch({ studPick: { ...pvp.studPick, animalId: e.target.value } })}>
            <option value="">Choose your male</option>
            {breedableM.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.breed} ({cfg.rating(a.stats)})</option>)}
          </select>
          <input type="number" min="0" placeholder="Stud fee (optional)" style={{ maxWidth: 160 }}
            value={pvp.studPick.fee} onChange={(e) => patch({ studPick: { ...pvp.studPick, fee: e.target.value } })} />
          <button className="kg-btn kg-btn--sm" disabled={!pvp.studPick.animalId} onClick={() => postAnimalStud(kind, pvp.studPick.animalId, pvp.studPick.fee)}>List for Stud</button>
        </div>
      )}
      {pvp.studOffers.some((o) => o.owner_id === session?.user?.id) && (
        <ul className="kg-log" style={{ marginBottom: 16 }}>
          {pvp.studOffers.filter((o) => o.owner_id === session.user.id).map((o) => (
            <li key={o.id} className="kg-logrow">
              <span>{o.dog.name} — stud fee {fmtMoney(o.fee)}</span>
              <button className="kg-btn kg-btn--ghost kg-btn--sm" style={{ width: "auto" }} onClick={() => cancelAnimalStudOffer(kind, o)}>Cancel</button>
            </li>
          ))}
        </ul>
      )}
      {pvp.incomingStudRequests.length > 0 && (
        <ul className="kg-log" style={{ marginBottom: 16 }}>
          {pvp.incomingStudRequests.map((r) => (
            <li key={r.id} className="kg-logrow">
              <span>{r.requester_name} wants {r.stud.name} × their {r.dam.name} ({cfg.rating(r.dam.stats)} overall)</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="kg-btn kg-btn--sm" onClick={() => acceptAnimalStudRequestAction(kind, r)}>Accept &amp; Breed</button>
                <button className="kg-btn kg-btn--ghost kg-btn--sm" style={{ width: "auto" }} onClick={() => declineAnimalStudRequest(kind, r)}>Decline</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {pvp.studOffers.filter((o) => o.owner_id !== session?.user?.id).length === 0 ? (
        <p className="kg-empty">No player studs listed right now.</p>
      ) : (
        <div className="kg-grid">
          {pvp.studOffers.filter((o) => o.owner_id !== session?.user?.id).map((o) => (
            <AnimalCard key={o.id} kind={kind} animal={o.dog} price={o.fee} sellerName={"out of " + o.owner_name}
              footer={breedableF.length === 0 ? <span className="kg-empty">Need a breedable female</span> : (
                <div style={{ display: "flex", gap: 6 }}>
                  <select value={pvp.requestPick[o.id] || ""} onChange={(e) => patch({ requestPick: { ...pvp.requestPick, [o.id]: e.target.value } })}>
                    <option value="">Your female</option>
                    {breedableF.map((a) => <option key={a.id} value={a.id}>{a.name} ({cfg.rating(a.stats)})</option>)}
                  </select>
                  <button className="kg-btn kg-btn--sm" disabled={!pvp.requestPick[o.id] || !session} onClick={() => requestAnimalStud(kind, o, pvp.requestPick[o.id])}>Request</button>
                </div>
              )} />
          ))}
        </div>
      )}
      {pvp.myStudRequests.length > 0 && (
        <ul className="kg-log">
          {pvp.myStudRequests.map((r) => (
            <li key={r.id} className="kg-logrow">
              <span>
                {r.dam.name} × {r.stud.name} out of {r.owner_name} —{" "}
                {r.status === "pending" ? "waiting on owner" : r.status === "declined" ? "declined" :
                  r.litter_summary?.requesterKept > 0 ? "done — you kept the offspring" : "done — the owner kept the offspring"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* A moving indicator sweeps the track; click to stop it as close to the
   marked zone as you can. Speed climbs a little each round so the last
   barrel/furlong is genuinely harder to nail than the first. */
const RACE_QUALITY = {
  perfect: { label: "Perfect!", threshold: 3, timeMult: -0.4 },
  good: { label: "Good", threshold: 10, timeMult: -0.1 },
  ok: { label: "OK", threshold: 22, timeMult: 0 },
  miss: { label: "Missed it", threshold: Infinity, timeMult: 0.6 },
};
function qualityFor(dist) {
  if (dist <= RACE_QUALITY.perfect.threshold) return "perfect";
  if (dist <= RACE_QUALITY.good.threshold) return "good";
  if (dist <= RACE_QUALITY.ok.threshold) return "ok";
  return "miss";
}
function TimingBar({ speed, onPick }) {
  const [pos, setPos] = React.useState(0);
  const posRef = React.useRef(0);
  const dirRef = React.useRef(1);
  const doneRef = React.useRef(false);
  React.useEffect(() => {
    let raf, last = performance.now();
    function tick(now) {
      const dt = Math.min(now - last, 48);
      last = now;
      posRef.current += dirRef.current * dt * speed;
      if (posRef.current >= 100) { posRef.current = 100; dirRef.current = -1; }
      if (posRef.current <= 0) { posRef.current = 0; dirRef.current = 1; }
      setPos(posRef.current);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);
  function handleClick() {
    if (doneRef.current) return;
    doneRef.current = true;
    const dist = Math.abs(posRef.current - 50);
    onPick(qualityFor(dist), dist);
  }
  return (
    <div className="kg-timingbar">
      <div className="kg-timingbar__track" onClick={handleClick}>
        <div className="kg-timingbar__zone" />
        <div className="kg-timingbar__zone--perfect" />
        <div className="kg-timingbar__indicator" style={{ left: pos + "%" }} />
      </div>
      <p className="kg-timingbar__hint">Click the track to time it — dead center is a perfect hit.</p>
    </div>
  );
}
/* Three rounds of TimingBar feed a list of qualities back to the caller,
   which applies them as a modifier on top of the underlying stat/condition
   simulation (raceTime()) rather than replacing it — a great horse still
   runs a great baseline time, good timing just shaves more off it. */
function RaceMiniGame({ pending, onComplete, onCancel }) {
  const [round, setRound] = React.useState(0);
  const [results, setResults] = React.useState([]);
  const [flash, setFlash] = React.useState(null);
  React.useEffect(() => { setRound(0); setResults([]); setFlash(null); }, [pending && pending.animal && pending.animal.id]);
  if (!pending) return null;
  const { animal, ev, kind, opp, outcome } = pending;
  const roundLabels = kind === "horse" && pending.eventKey === "barrelracing"
    ? ["First barrel", "Second barrel", "Third barrel"]
    : ["The break", "The stretch", "Final furlong"];

  function handlePick(quality) {
    setFlash(quality);
    setTimeout(() => {
      const next = [...results, quality];
      setFlash(null);
      if (next.length >= 3) { setResults(next); onComplete(next); }
      else { setResults(next); setRound(round + 1); }
    }, 850);
  }

  if (outcome) {
    return (
      <div className="kg-modal-backdrop" onClick={onCancel}>
        <div className="kg-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
          <button className="kg-modal__close" onClick={onCancel} aria-label="Close">✕</button>
          <div className="kg-racegame__final">
            <h2>{outcome.won ? "Photo finish — you took it!" : "So close!"}</h2>
            <p className="kg-racegame__time">{formatRaceTime(outcome.myTime)}</p>
            <p className="kg-hint" style={{ marginBottom: 14 }}>
              {animal.name} {outcome.won ? "beat" : "finished behind"} {opp.name} on {formatRaceTime(outcome.oppTime)}
              {outcome.won ? ` — purse ${fmtMoney(outcome.purse)}.` : "."}
              {outcome.isPB ? " New personal best!" : ""}
            </p>
            <div className="kg-racegame__rounds">
              {results.map((q, i) => (
                <Badge key={i} tone={q === "miss" ? "rust" : "gold"}>{RACE_QUALITY[q].label}</Badge>
              ))}
            </div>
            <button className="kg-btn" style={{ marginTop: 16 }} onClick={onCancel}>Continue</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="kg-modal-backdrop" onClick={onCancel}>
      <div className="kg-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <button className="kg-modal__close" onClick={onCancel} aria-label="Cancel">✕</button>
        <div className="kg-racegame__head">
          <h2>{animal.name} — {ev.label}</h2>
          <p className="kg-hint" style={{ marginBottom: 0 }}>{ev.timed.blurb}</p>
        </div>
        <p className="kg-racegame__round">Round {round + 1} of 3</p>
        <p className="kg-racegame__prompt">{roundLabels[round]}</p>
        {flash ? (
          <div className="kg-racegame__result">
            <p className={"kg-racegame__quality kg-racegame__quality--" + flash}>{RACE_QUALITY[flash].label}</p>
          </div>
        ) : (
          <TimingBar key={round} speed={0.055 + round * 0.018} onPick={handlePick} />
        )}
        <div className="kg-racegame__rounds">
          {[0, 1, 2].map((i) => (
            <Badge key={i} tone={results[i] ? (results[i] === "miss" ? "rust" : "gold") : "denim"}>
              {results[i] ? RACE_QUALITY[results[i]].label : `Round ${i + 1}`}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
