/* The animal profile page.

   Replaces the scrolling modal for animals the player owns: a left rail of
   collapsible action cards, the animal itself in the middle, and its record
   under four tabs. Market and rival dogs still open in the modal — they live in
   transient lists with no stable id, so a URL for one would break on refresh.

   The tabs are pure display of data the game already tracks. The rail is where
   the actions live, and each one that cannot run says why and links to the fix
   rather than sitting there disabled with no explanation. */

/* The two stats a breed is actually known for, taken from its own base line
   rather than a hand-maintained list — the highest two in BREEDS/HORSE_BREEDS/
   CATTLE_BREEDS are by definition what that breed was built for. */
function majorStatsFor(kind, breedName) {
  const table = kind === "horse" ? HORSE_BREEDS : kind === "cattle" ? CATTLE_BREEDS : BREEDS;
  const entry = table[breedName];
  if (!entry || !entry.base) return [];
  return Object.entries(entry.base)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k]) => k);
}

function statKeysFor(kind) {
  return kind === "horse" ? HORSE_STAT_KEYS : kind === "cattle" ? CATTLE_STAT_KEYS : STAT_KEYS;
}
function statLabelsFor(kind) {
  return kind === "horse" ? HORSE_STAT_LABELS : kind === "cattle" ? CATTLE_STAT_LABELS : STAT_LABELS;
}

const SPECIES_LABEL = { dog: "Dog", horse: "Horse", cattle: "Cattle" };

function AnimalProfileScreen({ game }) {
  const {
    state, tab, params, setTab,
    doRegister, doSell, doUseItem, doCleanAnimal,
    listDogForSale, postStudOffer, cancelStudOffer, studOffers, pvpListings, session,
    enterTrial, withdrawEntry,
  } = game;

  const [subtab, setSubtab] = useState("about");
  const [msg, setMsg] = useState(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [feeDraft, setFeeDraft] = useState("");

  if (tab !== "animalprofile") return null;

  const kind = params.species === "horse" || params.species === "cattle" ? params.species : "dog";
  const list = kind === "dog" ? state.dogs : kind === "horse" ? (state.horses || []) : (state.cattle || []);
  const animal = list.find((a) => String(a.id) === String(params.id));

  /* A stale bookmark, or an animal that has since been sold or died. Say which,
     rather than rendering an empty page. */
  if (!animal) {
    return (
      <section>
        <h2 className="kg-subhead">Not in your kennel</h2>
        <Notice tone="error" fix={{ label: "Back to the yard", onClick: () => setTab("kennel") }}>
          No {SPECIES_LABEL[kind].toLowerCase()} with that id is in your kennel any more — it may have been
          sold, retired or lost.
        </Notice>
      </section>
    );
  }

  const keys = statKeysFor(kind);
  const labels = statLabelsFor(kind);
  const majors = majorStatsFor(kind, animal.breed);
  const isDog = kind === "dog";
  const rating = isDog ? overallRating(animal.stats)
    : Math.round(keys.reduce((sum, k) => sum + (animal.stats[k] || 0), 0) / keys.length);
  /* Two functions, because dogs age on their own curve: agePrime works in days
     against the dog constants, animalPrime in years against LIFESPANS, which
     has no dog entry at all. Both return { mult, injury, stage } rather than a
     number — reading one as a number is where this first rendered NaN. */
  const prime = isDog ? agePrime(animal) : animalPrime(kind, animal);
  const retired = isDog ? isRetired(animal) : isAnimalRetired(kind, animal);

  const coatText = isDog
    ? colorLabel(animal.colorGenes)
    : (animal.colorGenes && animal.colorGenes.base ? cap(animal.colorGenes.base) : "Unrecorded");
  const kids = list.filter((a) => (a.sire && a.sire.id === animal.id) || (a.dam && a.dam.id === animal.id));

  const inv = state.inventory || {};
  const feedOnHand = ITEM_IDS.filter((id) => ITEMS[id].cat === "feed" && inv[id] > 0);
  const medOnHand = ITEM_IDS.filter((id) => ITEMS[id].cat === "med" && inv[id] > 0);
  const trainOnHand = ITEM_IDS.filter((id) => ITEMS[id].cat === "training" && inv[id] > 0);
  const toysOnHand = ITEM_IDS.filter((id) => ITEMS[id].cat === "toy" && inv[id] > 0);
  const personality = personalityOf(animal);
  // The toy this one actually wants, if it is in the box. Falls back to
  // whatever is there, because half a benefit beats none.
  const bestToy = toysOnHand.find((id) => ITEMS[id].forPersonality === personality) || toysOnHand[0];
  const vaccinated = isVaccinated(animal, state.day);

  const entry = (state.entries || []).find((e) => e.dogId === animal.id);
  const listedForSale = (pvpListings || []).find((l) => l.dog && l.dog.id === animal.id);
  const offeredAtStud = (studOffers || []).find((o) => o.dog && o.dog.id === animal.id);

  function useBest(ids, label) {
    if (!ids.length) return;
    // Best of what's on the shelf, by what it restores.
    const best = ids.slice().sort((a, b) => (ITEMS[b].health || 0) - (ITEMS[a].health || 0))[0];
    doUseItem(best, animal.id);
    setMsg({ tone: "success", text: `${animal.name} — used ${ITEMS[best].name}. ${label}` });
  }

  /* -------------------------------- actions -------------------------------- */
  const actions = [
    {
      id: "feed", label: "Feed", icon: "🍖",
      ready: feedOnHand.length > 0 && isDog,
      run: () => useBest(feedOnHand, "Condition restored."),
      blocked: !isDog
        ? "Feeding livestock comes with the care update."
        : "Nothing in the feed bin.",
      fix: { label: "Supply Store", onClick: () => setTab("shop") },
    },
    {
      id: "clean", label: "Clean", icon: "🧽",
      ready: true,
      run: () => {
        const gained = doCleanAnimal(kind, animal.id);
        setMsg(gained > 0
          ? { tone: "success", text: `Cleaned ${animal.name}'s run. +${gained} condition.` }
          : { tone: "info", text: `${animal.name}'s run is already clean today.` });
      },
    },
    {
      id: "play", label: "Play", icon: "🧸",
      ready: !!bestToy && isDog,
      run: () => {
        doUseItem(bestToy, animal.id);
        const matched = ITEMS[bestToy].forPersonality === personality;
        setMsg({
          tone: matched ? "success" : "info",
          text: matched
            ? `${animal.name} settled right into the ${ITEMS[bestToy].name.toLowerCase()}.`
            : `${animal.name} played along, but a ${(PERSONALITIES[personality] || {}).name.toLowerCase()} dog wants something else — half the good.`,
        });
      },
      blocked: !isDog ? "Livestock enrichment comes with the care update." : "Nothing in the toy box.",
      fix: { label: "Toys & Enrichment", onClick: () => setTab("shop") },
    },
    {
      id: "vet", label: "Vet Care", icon: "✚",
      ready: medOnHand.length > 0 && isDog,
      run: () => useBest(medOnHand, "Patched up."),
      blocked: !isDog ? "Livestock vet care comes with the care update." : "No medicine on hand.",
      fix: { label: "Supply Store", onClick: () => setTab("shop") },
    },
    {
      id: "train", label: "Train", icon: "💡",
      ready: trainOnHand.length > 0 && isDog,
      run: () => {
        const pick = trainOnHand[0];
        doUseItem(pick, animal.id);
        setMsg({ tone: "success", text: `${animal.name} worked the ${ITEMS[pick].name}.` });
      },
      blocked: !isDog ? "Livestock conditioning comes with the care update." : "No conditioning gear in the barn.",
      fix: { label: "Supply Store", onClick: () => setTab("shop") },
    },
    {
      id: "compete", label: "Compete", icon: "🏆",
      ready: !retired && !entry && (!isDog || (hasEnergy(animal, "trial") && vaccinated)),
      run: () => setTab(isDog ? "trials" : kind === "horse" ? "horses" : "cattle"),
      blocked: retired ? `${animal.name} is retired from competition.`
        : entry ? `${animal.name} is already entered — results come in tomorrow.`
        : isDog && !vaccinated ? `${animal.name} is not vaccinated — no secretary will take the entry.`
        : `${animal.name} has not the energy to be entered today.`,
      fix: entry ? null
        : isDog && !vaccinated ? { label: "Buy a vaccination", onClick: () => setTab("shop") }
        : { label: "Rest the kennel", onClick: () => setTab("overview") },
    },
    {
      id: "hunt", label: "Hunt", icon: "✦",
      ready: isDog && !retired && animal.health >= 40 && hasEnergy(animal, "hunt"),
      run: () => setTab("hunt"),
      blocked: !isDog ? "Only dogs hunt."
        : retired ? `${animal.name} is retired.`
        : !hasEnergy(animal, "hunt") ? `${animal.name} is worn out for today.`
        : `${animal.name} is too beat up to work.`,
      fix: !isDog || retired ? null : { label: "Rest the kennel", onClick: () => setTab("overview") },
    },
  ];

  /* --------------------------------- render -------------------------------- */
  return (
    <section className="kg-ap">
      <header className="kg-ap__head">
        <div>
          <h2 className="kg-ap__name">
            <span aria-hidden="true">{animal.sex === "M" ? "♂" : "♀"}</span>{" "}
            {isDog ? titledName(animal) : animal.name}
          </h2>
          <p className="kg-ap__sub">
            {animal.sex === "M" ? "Male" : "Female"} {animal.breed} · owned by{" "}
            <button className="kg-ap__owner" onClick={() => setTab("profile")}>{state.kennelName}</button>
          </p>
        </div>
        <div className="kg-ap__statrow">
          {keys.map((k) => (
            <div key={k} className={"kg-ap__stat " + (majors.includes(k) ? "kg-ap__stat--major" : "")}>
              <span className="kg-ap__statlabel">
                {majors.includes(k) && <span className="kg-ap__star" aria-label="breed strength">★</span>}
                {labels[k]}
              </span>
              <b>{animal.stats[k]}</b>
            </div>
          ))}
        </div>
      </header>

      {msg && <Notice tone={msg.tone} onDismiss={() => setMsg(null)}>{msg.text}</Notice>}

      <div className="kg-ap__cols">
        <aside className="kg-ap__rail">
          <Panel title="Interact">
            <div className="kg-ap__acts">
              {actions.map((a) => (
                <button key={a.id} type="button"
                  className={"kg-ap__act " + (a.ready ? "" : "kg-ap__act--off")}
                  onClick={() => (a.ready ? a.run() : setMsg({ tone: "error", text: a.blocked, fix: a.fix }))}>
                  <span className="kg-ap__acticon" aria-hidden="true">{a.icon}</span>
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
            {msg && msg.tone === "error" && msg.fix && (
              <p className="kg-ap__fix">
                <button className="kg-ui-links__link" onClick={msg.fix.onClick}>{msg.fix.label} →</button>
              </p>
            )}
          </Panel>

          <Panel title="Status">
            <Meter label="Energy" value={energyOf(animal)} tone="energy"
              hint={"Spent by hunting (" + ENERGY_COST.hunt + "), entering a trial (" + ENERGY_COST.trial +
                    ") and conditioning gear (" + ENERGY_COST.training + "). Back to full each morning."} />
            <Meter label="Mood" value={moodOf(animal)}
              tone={moodOf(animal) < 40 ? "bad" : moodOf(animal) < 70 ? "warn" : "good"}
              hint={"Falls a little each day and comes back with play. A settled dog places better. " +
                    ((PERSONALITIES[personality] || {}).name || "") + " dogs want the " +
                    (Object.keys(ITEMS).filter((k) => ITEMS[k].forPersonality === personality)
                      .map((k) => ITEMS[k].name.toLowerCase())[0] || "right toy") + "."} />
            <Meter label="Condition" value={animal.health} tone={animal.health < 40 ? "bad" : animal.health < 70 ? "warn" : "good"}
              hint="Condition falls with work and age, and comes back with feed, medicine and rest." />
            <Meter label={"Prime — " + prime.stage} value={Math.round(prime.mult * 100)}
              tone={prime.mult >= 0.99 ? "good" : prime.mult >= 0.9 ? "warn" : "bad"}
              hint="How close this one is to its physical peak. Everything it does is scaled by this." />
            {isDog && !vaccinated && (
              <p style={{ margin: "8px 0 0" }}>
                <Notice tone="warn" fix={{ label: "Buy one", onClick: () => setTab("shop") }}>
                  Vaccination has lapsed — no trial will take an entry.
                </Notice>
              </p>
            )}
            {isDog && vaccinated && (
              <p className="kg-hint" style={{ margin: "8px 0 0" }}>
                Vaccinated through day {animal.vaccinatedUntilDay}.
              </p>
            )}
            {animal.injury && <p className="kg-warn" style={{ margin: "8px 0 0" }}>Injured: {animal.injury}</p>}
            {retired && <p className="kg-hint" style={{ margin: "8px 0 0" }}>Retired from work — kept on as a pensioner.</p>}
          </Panel>

          {isDog && (
            <Panel title="Breeding" collapsible defaultOpen={false}>
              {!session ? (
                <Notice tone="info">Sign in to offer this dog at stud to other players.</Notice>
              ) : offeredAtStud ? (
                <>
                  <p style={{ margin: "0 0 8px" }}>Standing at stud for {fmtMoney(offeredAtStud.fee)}.</p>
                  <button className="kg-btn kg-btn--sm" onClick={() => cancelStudOffer(offeredAtStud.id)}>Withdraw from stud</button>
                </>
              ) : animal.sex !== "M" ? (
                <p className="kg-hint" style={{ margin: 0 }}>Only males stand at stud. Females take stud requests from the Breeding screen.</p>
              ) : (
                <>
                  <label className="kg-ap__field">
                    <span>Stud fee</span>
                    <input type="number" min="0" value={feeDraft} onChange={(e) => setFeeDraft(e.target.value)} placeholder="250" />
                  </label>
                  <button className="kg-btn kg-btn--sm" disabled={!Number(feeDraft)}
                    onClick={() => { postStudOffer(animal, Number(feeDraft)); setMsg({ tone: "success", text: `${animal.name} is standing at stud.` }); }}>
                    Offer at stud
                  </button>
                </>
              )}
            </Panel>
          )}

          {isDog && (
            <Panel title="Sell" collapsible defaultOpen={false}>
              {listedForSale ? (
                <p style={{ margin: 0 }}>Listed on the player market for {fmtMoney(listedForSale.price)}.</p>
              ) : (
                <>
                  <p className="kg-hint" style={{ margin: "0 0 8px" }}>
                    Quick sale to the county fetches {fmtMoney(computeValue(animal))}.
                  </p>
                  <button className="kg-btn kg-btn--sm" onClick={() => { doSell(animal); setTab("kennel"); }}>
                    Sell — {fmtMoney(computeValue(animal))}
                  </button>
                  {session && (
                    <>
                      <label className="kg-ap__field" style={{ marginTop: 10 }}>
                        <span>Or list to players</span>
                        <input type="number" min="1" value={priceDraft} onChange={(e) => setPriceDraft(e.target.value)} placeholder="1200" />
                      </label>
                      <button className="kg-btn kg-btn--sm" disabled={!Number(priceDraft)}
                        onClick={() => { listDogForSale(animal, Number(priceDraft)); setMsg({ tone: "success", text: `${animal.name} listed for ${fmtMoney(Number(priceDraft))}.` }); }}>
                        List for sale
                      </button>
                    </>
                  )}
                </>
              )}
            </Panel>
          )}

          <Panel title="Options" collapsible defaultOpen={false}>
            {isDog && !animal.registered && (
              <button className="kg-btn kg-btn--sm" style={{ marginBottom: 8 }}
                onClick={() => { doRegister(animal); setMsg({ tone: "success", text: `${animal.name} has papers now.` }); }}>
                Register — {fmtMoney(registrationFee(animal))}
              </button>
            )}
            {isDog && animal.registered && <p style={{ margin: "0 0 8px" }}>Papered: <strong>{animal.regNumber}</strong></p>}
            <LinkStack
              links={[
                { id: "kennel", label: "Back to the yard" },
                { id: "breed", label: "Breeding pen" },
                { id: "registry", label: "Stud book" },
              ]}
              current={null} onPick={setTab}
            />
          </Panel>
        </aside>

        <div className="kg-ap__main">
          {/* CoatSwatch reads the dog colour tables, so livestock get a plain
              swatch until the species artwork lands. */}
          <div className="kg-ap__portrait">
            {/* Falls back to the generated swatch until real art lands in
                assets/ - see AnimalPortrait. */}
            <AnimalPortrait kind={kind} animal={animal} width={280} />
            <p className="kg-ap__portraitnote">{coatText}</p>
          </div>

          <TabStrip
            tabs={[
              { id: "about", label: "About" },
              { id: "items", label: "Items" },
              { id: "career", label: "Career" },
              { id: "history", label: "History" },
            ]}
            active={subtab} onPick={setSubtab} ariaLabel="Animal record"
          />

          {subtab === "about" && (
            <Panel title="Record">
              <div className="kg-ap__facts">
                <div><span>Name</span><b>{animal.name}</b></div>
                <div><span>Species</span><b>{SPECIES_LABEL[kind]}</b></div>
                <div><span>Breed</span><b>{animal.breed}</b></div>
                <div><span>Sex</span><b>{animal.sex === "M" ? "Male" : "Female"}</b></div>
                <div><span>Age</span><b>{ageLabel(animal.ageDays)} ({animal.ageDays} days)</b></div>
                <div><span>Born</span><b>{animal.bornDay == null ? "Before your time" : "Day " + animal.bornDay}</b></div>
                <div><span>Generation</span><b>{animal.generation}</b></div>
                {isDog && <div><span>Personality</span><b>{(PERSONALITIES[personality] || {}).name}</b></div>}
                <div><span>Colour</span><b>{coatText}</b></div>
                {isDog && <div><span>Height</span><b>{animal.heightIn} in</b></div>}
                {isDog && <div><span>Weight</span><b>{animal.weightLb} lb</b></div>}
                {kind === "horse" && animal.hands != null && <div><span>Height</span><b>{animal.hands} hands</b></div>}
                <div><span>Papers</span><b>{animal.registered ? animal.regNumber : "Unregistered"}</b></div>
                {animal.bloodline && <div><span>Bloodline</span><b>{animal.bloodline}</b></div>}
                <div><span>Owner</span><b>{state.kennelName}</b></div>
              </div>

              {isDog && (
                <>
                  <h4 className="kg-ap__h4">Genetics</h4>
                  <div className="kg-ap__facts">
                    <div><span>Base colour</span><b>{cap(animal.colorGenes.base)}</b></div>
                    <div><span>Pattern</span><b>{cap(animal.colorGenes.pattern)}</b></div>
                    <div><span>Merle alleles</span><b>{animal.colorGenes.merleAlleles}</b></div>
                    <div><span>Hidden colour</span><b>{animal.hiddenColor ? cap(animal.hiddenColor) : "None known"}</b></div>
                    <div><span>Hidden pattern</span><b>{animal.hiddenPattern ? cap(animal.hiddenPattern) : "None known"}</b></div>
                  </div>
                  {(animal.hiddenTraits || []).length > 0 && (
                    <Note title="Carries, but does not show">
                      {animal.hiddenTraits.map((k) => TRAIT_DEFS[k].name).join(", ")} — not expressed in this
                      dog, but it can surface in its pups.
                    </Note>
                  )}
                </>
              )}
            </Panel>
          )}

          {subtab === "items" && (
            <Panel title="Equipped">
              {animal.collar ? (
                <p style={{ margin: 0 }}>
                  <span className="kg-collardot" style={{ background: animal.collar }} /> Wearing a collar.
                </p>
              ) : (
                <Notice tone="info" fix={{ label: "Collars & Tack", onClick: () => setTab("shop") }}>
                  Nothing equipped. Collars are bought from the supply store and used from your inventory.
                </Notice>
              )}
              <Note title="Coming with the care update">
                Food and water bowls, beds, toys matched to personality, and assigned rations all arrive with
                the care system. This tab is where they will live.
              </Note>
            </Panel>
          )}

          {subtab === "career" && (
            <Panel title="Working record">
              <div className="kg-ap__facts">
                <div><span>Overall rating</span><b>{rating} / 100</b></div>
                <div><span>Hunts</span><b>{animal.hunts || 0}</b></div>
                <div><span>Trials won</span><b>{animal.trialWins || 0}</b></div>
                <div><span>Titles</span><b>{(animal.titles || []).length ? animal.titles.join(", ") : "None yet"}</b></div>
                <div><span>Offspring here</span><b>{kids.length}</b></div>
              </div>

              <h4 className="kg-ap__h4">Current entries</h4>
              {entry ? (
                <div className="kg-ap__entry">
                  <span>
                    Entered in the <strong>{(TRIALS[entry.trial] || {}).label}</strong> — judged on day {entry.resolvesDay}.
                  </span>
                  <button className="kg-btn kg-btn--sm" onClick={() => withdrawEntry(entry.id)}>Withdraw</button>
                </div>
              ) : (
                <p className="kg-hint" style={{ margin: "0 0 4px" }}>Not entered in anything right now.</p>
              )}

              <h4 className="kg-ap__h4">Stats</h4>
              {keys.map((k) => (
                <Meter key={k} label={labels[k] + (majors.includes(k) ? " ★" : "")} value={animal.stats[k]}
                  tone={majors.includes(k) ? "energy" : "good"}
                  hint={majors.includes(k) ? `${animal.breed} is bred for this one.` : undefined} />
              ))}
            </Panel>
          )}

          {subtab === "history" && (
            <>
              <Panel title="Pedigree">
                <FamilyTree dog={animal} />
              </Panel>
              <Panel title="Offspring">
                {(() => {
                  if (!kids.length) return <p className="kg-ui-empty" style={{ border: 0, background: "none" }}>None in your kennel.</p>;
                  return (
                    <DataTable
                      columns={[
                        { key: "name", label: "Name", render: (r) => (
                          <button className="kg-ui-links__link" onClick={() => game.setViewDog(r)}>{r.name}</button>
                        ) },
                        { key: "sex", label: "Sex", render: (r) => (r.sex === "M" ? "Male" : "Female") },
                        { key: "age", label: "Age", render: (r) => ageLabel(r.ageDays) },
                        { key: "rating", label: "Rating", align: "right",
                          render: (r) => (isDog ? overallRating(r.stats) : Math.round(keys.reduce((s, k) => s + (r.stats[k] || 0), 0) / keys.length)) },
                      ]}
                      rows={kids} rowKey={(r) => r.id}
                    />
                  );
                })()}
              </Panel>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
