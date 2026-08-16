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
function HuntMap({ zones, dogZones, dogsById, bayDogIds, catchDogIds, hogZoneKey }) {
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
              <span className="kg-huntmap__statustag"> · {isBay ? "Searching" : "Standing by"}</span>
            </li>
          );
        })}
      </ul>
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
function CoatSwatch({ dog, width = 200, height = 26 }) {
  const rng = mulberry32(hashStr(dog.id));
  const baseHex = COLOR_HEX[dog.colorGenes.base] || COLOR_HEX.fawn;
  const darker = shade(baseHex, -30);
  const lighter = shade(baseHex, 26);
  const pattern = dog.colorGenes.pattern;
  const shapes = [];
  if (pattern === "brindle") {
    for (let i = 0; i < 14; i++) {
      const x = rng() * width;
      shapes.push(<rect key={i} x={x} y={-4} width={2.5 + rng() * 3} height={height + 8} fill={darker} opacity="0.6" transform={`rotate(22 ${x} ${height / 2})`} />);
    }
  } else if (pattern === "merle") {
    const patchFill = dog.colorGenes.merleAlleles === 2 ? "#ece4d3" : darker;
    const count = dog.colorGenes.merleAlleles === 2 ? 11 : 7;
    for (let i = 0; i < count; i++) {
      const cx = rng() * width, cy = rng() * height, r = 5 + rng() * 9;
      shapes.push(<ellipse key={i} cx={cx} cy={cy} rx={r} ry={r * 0.7} fill={patchFill} opacity={dog.colorGenes.merleAlleles === 2 ? 0.6 : 0.5} />);
    }
  } else if (pattern === "piebald") {
    for (let i = 0; i < 5; i++) {
      const cx = rng() * width, cy = rng() * height, r = 9 + rng() * 14;
      shapes.push(<ellipse key={i} cx={cx} cy={cy} rx={r} ry={r * 0.75} fill={COLOR_HEX.white} opacity="0.92" />);
    }
  } else if (pattern === "saddle") {
    shapes.push(<rect key="s" x={width * 0.32} y={0} width={width * 0.36} height={height} fill={darker} opacity="0.88" />);
  } else if (pattern === "tricolor") {
    shapes.push(<rect key="w" x={0} y={0} width={width} height={height} fill={COLOR_HEX.white} />);
    shapes.push(<rect key="a" x={0} y={0} width={width * 0.4} height={height} fill={baseHex} />);
    shapes.push(<rect key="b" x={width * 0.6} y={0} width={width * 0.4} height={height} fill={shade(baseHex, 20)} />);
  } else if (pattern === "ticked") {
    shapes.push(<rect key="w" x={0} y={0} width={width} height={height} fill={COLOR_HEX.white} />);
    for (let i = 0; i < 70; i++) {
      const cx = rng() * width, cy = rng() * height;
      shapes.push(<circle key={i} cx={cx} cy={cy} r={1.1 + rng()} fill={baseHex} opacity="0.75" />);
    }
  }
  return (
    <svg className="kg-card__swatch" width="100%" viewBox={`0 0 ${width} ${height}`} height={height} preserveAspectRatio="none">
      <rect x="0" y="0" width={width} height={height} fill={pattern === "tricolor" || pattern === "ticked" ? "none" : baseHex} />
      {shapes}
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

function DogProfileModal({ dog, onClose }) {
  const closeRef = useRef(null);

  // Escape to close, and park focus inside the dialog so keyboard users aren't
  // left tabbing through the page behind it.
  useEffect(() => {
    if (!dog) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    const previouslyFocused = document.activeElement;
    document.addEventListener("keydown", onKey);
    if (closeRef.current) closeRef.current.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    };
  }, [dog, onClose]);

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
          <h2>{dog.sex === "M" ? "♂" : "♀"} {dog.name}</h2>
          <p className="kg-card__breed">{dog.breed} · {colorLabel(dog.colorGenes)}</p>
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

/* Cloud save widget: sign in / sign up / sign out, shared between the
   setup screen (so a returning player can pull their cloud kennel before
   founding a new local one) and the main game header. */
function CloudAuthPanel(props) {
  const {
    session, cloudStatus, open, onToggle,
    authMode, setAuthMode, authEmail, setAuthEmail, authPassword, setAuthPassword,
    authMsg, onSubmit, onSignOut,
  } = props;

  return (
    <div className="kg-cloud">
      <button className="kg-btn kg-btn--ghost kg-btn--sm" style={{ width: "auto" }} onClick={onToggle}>
        {session ? `☁ ${cloudStatus === "syncing" ? "Syncing…" : "Synced"}` : "☁ Cloud Save"}
      </button>
      {open && (
        <div className="kg-cloud__panel">
          {session ? (
            <React.Fragment>
              <h3>Cloud Save</h3>
              <p>Signed in as {session.user.email}. Your kennel autosaves here.</p>
              <div className="kg-cloud__status">Status: {cloudStatus}</div>
              <button className="kg-btn kg-btn--danger kg-btn--sm" style={{ marginTop: 10 }} onClick={onSignOut}>Sign Out</button>
            </React.Fragment>
          ) : (
            <form onSubmit={onSubmit}>
              <h3>{authMode === "signin" ? "Sign In" : "Sign Up"}</h3>
              <p>{authMode === "signin" ? "Load your kennel from the cloud." : "Save your kennel to the cloud, playable from any browser."}</p>
              <input type="email" placeholder="Email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
              <input type="password" placeholder="Password" required minLength={6} value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
              <div className="kg-cloud__row">
                <button type="submit" className="kg-btn kg-btn--gold kg-btn--sm">{authMode === "signin" ? "Sign In" : "Sign Up"}</button>
              </div>
              {authMsg && <div className="kg-cloud__msg">{authMsg}</div>}
              <button type="button" className="kg-cloud__switch" onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}>
                {authMode === "signin" ? "Need an account? Sign up" : "Already have one? Sign in"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

/* One card component for both horses and cattle — much simpler than
   DogCard (no traits/rarity/bully-class), just breed, sex, age, colour,
   and whichever stat set the kind uses. */
function AnimalCard({ kind, animal, price, sellerName, footer }) {
  const cfg = LIVESTOCK_CONFIG[kind];
  const rating = cfg.rating(animal.stats);
  return (
    <div className="kg-card">
      <div className="kg-card__stamp">{cfg.label}</div>
      <div className="kg-card__top">
        <h3 className="kg-card__name">{animal.sex === "M" ? "♂" : "♀"} {animal.name}</h3>
        <RatingSeal rating={rating} />
      </div>
      <p className="kg-card__breed">{animal.breed} · {cfg.colorLabel(animal)}</p>
      <p className="kg-card__meta">
        {ageLabel(animal.ageDays)} old · {cfg.sizeLabel(animal)} · Gen {animal.generation}{animal.sire ? " · out of " + animal.sire + " × " + animal.dam : ""}{sellerName ? " · " + sellerName : ""}
      </p>
      <div className="kg-card__tags">
        {animal.registered && <Badge tone="gold">Registered</Badge>}
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

/* One panel handles horses and cattle both — herd, breeding, AI market,
   shows, and the full multiplayer suite (trade/rivals/stud board), all
   driven by LIVESTOCK_CONFIG[kind] rather than being written twice. */
function LivestockPanel({ kind, state, session, pvp, patch, cloudAuthEl,
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
            <AnimalCard key={a.id} kind={kind} animal={a} footer={
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
            <AnimalCard key={a.id} kind={kind} animal={a} price={a.price} sellerName={"from " + a.sellerName}
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
      {!session && <p className="kg-notice">Sign in with Cloud Save (top right) to trade with other players.</p>}
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
