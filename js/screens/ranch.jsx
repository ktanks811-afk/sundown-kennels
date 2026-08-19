/* The ranch shell — About | Animals | Owner | History | Stats | Manage | Settings.

   Four of these tabs are screens that already existed and only needed a home:
   Animals is the yard, Owner is the account profile, Manage is the property,
   Settings is settings. The other three are new and live here.

   Two components rather than one, because the tab strip has to sit above
   whatever screen is showing while the career panel has to sit below it, and a
   single component cannot be in two places. RanchTabs renders first in the
   screen list, RanchPanels last. */

function inRanch(tab) { return RANCH_TAB_IDS.indexOf(tab) !== -1; }

function RanchTabs({ game }) {
  const { tab, setTab, state } = game;
  if (!inRanch(tab)) return null;
  const counts = { kennel: (state.dogs || []).length };
  return (
    <div className="kg-ranch__head">
      <h2 className="kg-subhead" style={{ margin: 0 }}>{state.kennelName}</h2>
      <TabStrip
        tabs={RANCH_TABS.map((t) => (counts[t.id] != null ? { ...t, count: counts[t.id] } : t))}
        active={tab} onPick={setTab} ariaLabel="Ranch"
      />
    </div>
  );
}

/* ------------------------------ career panel ------------------------------- */
/* Level, XP and the five profession tracks. Spending a point is immediate and
   reversible — a build you cannot change is a build you resent, so Reset is
   free and sits right there rather than behind a currency. */
function CareerPanel({ game }) {
  const { state, spendProfessionPoint, resetProfessions } = game;
  const prog = levelFromXp(state.xp || 0);
  const left = professionPointsLeft(state);
  const spent = professionPointsSpent(state.professions);

  const bonuses = PROFESSION_KEYS
    .filter((k) => (state.professions || {})[k] > 0)
    .map((k) => PROFESSIONS[k].name + " +" + Math.round(state.professions[k] * PROFESSIONS[k].per * 100) + "%");

  return (
    <Panel title="Career" right={"Level " + prog.level}>
      <Meter label={"Level " + prog.level + " — " + (prog.need - prog.into) + " XP to " + (prog.level + 1)}
        value={prog.into} max={prog.need} unit=""
        hint="XP comes from everything the kennel does: hunts, litters, sales, trials." />

      <div className="kg-ranch__wage">
        <span>Daily wage</span><strong>{fmtMoney(dailySalary(state))}</strong>
      </div>

      <h4 className="kg-ap__h4">Professions</h4>
      <p className="kg-hint" style={{ margin: "0 0 10px" }}>
        {left > 0
          ? left + " point" + (left === 1 ? "" : "s") + " to spend. One arrives every second level."
          : spent === 15
            ? "Every track is maxed — nothing left to choose."
            : "No points spare. The next one lands two levels from now."}
      </p>

      <div className="kg-ranch__profs">
        {PROFESSION_KEYS.map((k) => {
          const def = PROFESSIONS[k];
          const points = (state.professions || {})[k] || 0;
          const full = points >= def.max;
          return (
            <div key={k} className="kg-ranch__prof">
              <div className="kg-ranch__profhead">
                <strong>{def.name}</strong>
                <span className="kg-ranch__pips" aria-label={points + " of " + def.max}>
                  {Array.from({ length: def.max }, (_, i) => (
                    <span key={i} className={"kg-ranch__pip " + (i < points ? "kg-ranch__pip--on" : "")} />
                  ))}
                </span>
              </div>
              <p className="kg-ranch__profblurb">{def.blurb}</p>
              <p className="kg-ranch__profeffect">{def.effect}</p>
              <button className="kg-btn kg-btn--sm" disabled={full || left <= 0}
                onClick={() => spendProfessionPoint(k)}>
                {full ? "Maxed" : left <= 0 ? "No points spare" : "Put a point in"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="kg-ranch__bonuses">
        <strong>Bonuses</strong>{" "}
        {bonuses.length ? bonuses.join(" · ") : <span className="kg-hint">None yet — spend a point above.</span>}
      </div>

      {spent > 0 && (
        <button className="kg-btn kg-btn--sm kg-btn--ghost" style={{ marginTop: 10 }}
          onClick={resetProfessions}>Reset profession points</button>
      )}
    </Panel>
  );
}

/* -------------------------------- the tabs --------------------------------- */

function RanchPanels({ game }) {
  const { tab, state, saveRanchBio } = game;
  const [bio, setBio] = useState((state && state.ranchBio) || "");
  const [saved, setSaved] = useState(false);

  if (!inRanch(tab)) return null;
  if (tab === "profile") return <CareerPanel game={game} />;

  if (tab === "ranchabout") {
    return (
      <Panel title="About this kennel">
        <p className="kg-hint" style={{ margin: "0 0 10px" }}>
          What other players read when they land on your kennel. Yours to write.
        </p>
        <textarea className="kg-ranch__bio" rows={7} maxLength={1200} value={bio}
          placeholder="Running curs and bulldogs out of the bottomland since day one."
          onChange={(e) => { setBio(e.target.value); setSaved(false); }} />
        <div className="kg-ranch__biofoot">
          <span className="kg-hint">{bio.length} / 1200</span>
          <button className="kg-btn kg-btn--sm" onClick={() => { saveRanchBio(bio); setSaved(true); }}>Save</button>
        </div>
        {saved && <Notice tone="success" onDismiss={() => setSaved(false)}>Saved.</Notice>}
      </Panel>
    );
  }

  if (tab === "ranchhistory") return <RanchHistory game={game} />;
  if (tab === "ranchstats") return <RanchStats game={game} />;
  return null;
}

/* Retired and bred animals, as the spec's two sub-lists. Both are derived
   rather than stored — a retired dog is just an old one still on the place. */
function RanchHistory({ game }) {
  const { state, setViewDog } = game;
  const [which, setWhich] = useState("retired");

  const dogs = state.dogs || [];
  const retired = dogs.filter((d) => isRetired(d));
  const bred = dogs.filter((d) => (d.generation || 1) > 1);
  const rows = which === "retired" ? retired : bred;

  const columns = [
    { key: "name", label: "Name", render: (d) => (
      <button className="kg-ui-links__link" onClick={() => setViewDog(d)}>{titledName(d)}</button>
    ) },
    { key: "breed", label: "Breed", render: (d) => breedShort(d.breed) },
    { key: "age", label: "Age", render: (d) => ageLabel(d.ageDays) },
    { key: "gen", label: "Gen", align: "right", render: (d) => d.generation || 1 },
    { key: "rating", label: "Rating", align: "right", render: (d) => overallRating(d.stats) },
  ];

  return (
    <Panel title="History">
      <TabStrip
        tabs={[
          { id: "retired", label: "Retired", count: retired.length },
          { id: "bred", label: "Bred here", count: bred.length },
        ]}
        active={which} onPick={setWhich} ariaLabel="History"
      />
      <div style={{ marginTop: 10 }}>
        <DataTable columns={columns} rows={rows} rowKey={(d) => d.id}
          empty={which === "retired"
            ? "Nobody has aged out yet. Dogs retire past ten years."
            : "Nothing bred here yet — every dog on the place came from somewhere else."} />
      </div>
    </Panel>
  );
}

/* The lifetime checklist. Every row reads zero until it is earned, which is the
   point: a column of zeroes is a list of things worth doing. Everything is
   derived from the save rather than counted separately, so no counter can drift
   away from what actually happened. */
function RanchStats({ game }) {
  const { state } = game;
  const dogs = state.dogs || [];
  const horses = state.horses || [];
  const cattle = state.cattle || [];
  const catches = state.catches || [];
  const log = state.log || [];
  const prog = levelFromXp(state.xp || 0);

  const countLog = (type) => log.filter((l) => l.type === type).length;
  const bestHog = catches.reduce((m, c) => Math.max(m, c.weightLbs || 0), 0);
  const bloodlines = new Set(dogs.map((d) => d.bloodline).filter(Boolean));
  const breeds = new Set(dogs.map((d) => d.breed));
  const bestGen = dogs.reduce((m, d) => Math.max(m, d.generation || 1), 0);

  const groups = [
    { heading: "Standing", rows: [
      ["Level reached", prog.level],
      ["Experience earned", state.xp || 0],
      ["Fame", Math.round(state.fame || 0)],
      ["Days run", state.day || 0],
    ] },
    { heading: "The yard", rows: [
      ["Dogs on the place", dogs.length],
      ["Registered dogs", dogs.filter((d) => d.registered).length],
      ["Bloodlines founded", bloodlines.size],
      ["Breeds kept", breeds.size],
      ["Deepest generation", bestGen],
      ["Bred here", dogs.filter((d) => (d.generation || 1) > 1).length],
    ] },
    { heading: "In the field", rows: [
      ["Catches recorded", catches.length],
      ["Heaviest hog", bestHog ? bestHog + " lb" : 0],
      ["Hunts logged", countLog("hunt") + countLog("catch")],
      ["Injuries taken", countLog("injury")],
    ] },
    { heading: "Livestock", rows: [
      ["Horses", horses.length],
      ["Cattle", cattle.length],
      ["Registered stock", horses.concat(cattle).filter((a) => a.registered).length],
    ] },
  ];

  return (
    <Panel title="Lifetime record">
      <p className="kg-hint" style={{ margin: "0 0 12px" }}>
        Read off the kennel as it stands, so nothing can drift away from what
        actually happened.
      </p>
      <div className="kg-ranch__stats">
        {groups.map((g) => (
          <div key={g.heading} className="kg-ranch__statgroup">
            <h4 className="kg-ap__h4" style={{ marginTop: 0 }}>{g.heading}</h4>
            <ul>
              {g.rows.map((row) => (
                <li key={row[0]} className={row[1] ? "" : "kg-ranch__stat--zero"}>
                  <span>{row[0]}</span><b>{row[1] || 0}</b>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  );
}
