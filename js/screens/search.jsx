/* Search, achievements and the daily care checklist.

   Search is the first screen to read the animals projection built in phase 2.
   The blob in kennels.state cannot be filtered or paginated across players;
   the projection can, and every query here is a real indexed one rather than
   pulling rows down and sorting them in the browser. */

const SEARCH_FACETS = [
  { id: "animals", label: "Animals", live: true },
  { id: "kennels", label: "Kennels", live: true },
  { id: "litters", label: "Litters" },
  { id: "competitions", label: "Competitions" },
  { id: "clinics", label: "Clinics" },
  { id: "items", label: "Items For Sale" },
  { id: "topics", label: "Forum Topics" },
];

const PAGE_SIZE = 25;

function SearchScreen({ game }) {
  const { tab, setTab } = game;
  const [facet, setFacet] = useState("animals");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [sort, setSort] = useState("rating");
  const [filters, setFilters] = useState({ name: "", species: "all", breed: "all", registered: "all" });

  const run = useCallback((which, f, p, s) => {
    setBusy(true);
    setErr(null);

    if (which === "kennels") {
      sb.from("leaderboard").select("*", { count: "exact" })
        .order("net_worth", { ascending: false })
        .range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1)
        .then(({ data, count, error }) => {
          setBusy(false);
          if (error) { setErr(error.message); setRows([]); return; }
          setRows(data || []); setTotal(count || 0);
        });
      return;
    }

    let q = sb.from("animal_search").select("*", { count: "exact" });
    if (f.species !== "all") q = q.eq("species", f.species);
    if (f.breed !== "all") q = q.eq("breed", f.breed);
    if (f.registered !== "all") q = q.eq("registered", f.registered === "yes");
    // ilike rather than a client-side filter: the whole point of the
    // projection is that the database does the narrowing.
    if (f.name.trim()) q = q.ilike("name", `%${f.name.trim()}%`);

    const dir = s === "age" ? true : false;
    q = q.order(s === "age" ? "age_days" : s === "name" ? "name" : "rating", { ascending: dir, nullsFirst: false })
      .range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1);

    q.then(({ data, count, error }) => {
      setBusy(false);
      if (error) { setErr(error.message); setRows([]); return; }
      setRows(data || []); setTotal(count || 0);
    });
  }, []);

  useEffect(() => {
    if (tab !== "search") return;
    run(facet, filters, page, sort);
  }, [tab, facet, page, sort, run]);

  if (tab !== "search") return null;

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const facetDef = SEARCH_FACETS.find((f) => f.id === facet);

  return (
    <section>
      <h2 className="kg-subhead">Search</h2>

      <div className="kg-mk__nav" style={{ marginBottom: 12 }}>
        <div className="kg-mk__group">
          <p className="kg-mk__heading">Look for</p>
          {SEARCH_FACETS.map((f) => (
            <button key={f.id}
              className={"kg-mk__link " + (facet === f.id ? "kg-mk__link--on" : "")}
              onClick={() => { setFacet(f.id); setPage(0); }}>
              {f.label}{!f.live && <span className="kg-hint"> · soon</span>}
            </button>
          ))}
        </div>
      </div>

      {!facetDef.live && (
        <Note title="Not yet">
          {facetDef.label} needs a table of its own before there is anything to search.
          Animals and Kennels are live now — everything else arrives with the section
          that creates the records.
        </Note>
      )}

      {facet === "animals" && (
        <Panel title="Filters">
          <div className="kg-srch__filters">
            <label className="kg-ap__field">
              <span>Name contains</span>
              <input value={filters.name} placeholder="Ruby"
                onChange={(e) => setFilters((p) => ({ ...p, name: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") { setPage(0); run(facet, filters, 0, sort); } }} />
            </label>
            <label className="kg-ap__field">
              <span>Species</span>
              <select value={filters.species}
                onChange={(e) => setFilters((p) => ({ ...p, species: e.target.value }))}>
                <option value="all">Any</option>
                <option value="dog">Dogs</option>
                <option value="horse">Horses</option>
                <option value="cattle">Cattle</option>
              </select>
            </label>
            <label className="kg-ap__field">
              <span>Papers</span>
              <select value={filters.registered}
                onChange={(e) => setFilters((p) => ({ ...p, registered: e.target.value }))}>
                <option value="all">Any</option>
                <option value="yes">Registered</option>
                <option value="no">Unregistered</option>
              </select>
            </label>
          </div>
          <button className="kg-btn kg-btn--gold" onClick={() => { setPage(0); run(facet, filters, 0, sort); }}>
            Search
          </button>
        </Panel>
      )}

      {err && (
        <Notice tone="error">
          The search index is not reachable: {err}. Animals appear here once the
          phase 2 migration has been run against the database.
        </Notice>
      )}

      {facetDef.live && !err && (
        <>
          <p className="kg-hint" style={{ margin: "12px 0 6px" }}>
            {busy ? "Searching…" : `${total} ${total === 1 ? "result" : "results"}`}
            {total > PAGE_SIZE && ` · page ${page + 1} of ${pages}`}
          </p>

          {facet === "animals" ? (
            <DataTable
              columns={[
                { key: "name", label: "Name", sortable: true },
                { key: "species", label: "Species" },
                { key: "breed", label: "Breed" },
                { key: "sex", label: "Sex", render: (r) => (r.sex === "M" ? "Male" : r.sex === "F" ? "Female" : "—") },
                { key: "age", label: "Age", sortable: true, render: (r) => (r.age_days == null ? "—" : ageLabel(r.age_days)) },
                { key: "owner_name", label: "Owner" },
                { key: "rating", label: "Rating", sortable: true, align: "right",
                  render: (r) => (r.rating == null ? "—" : Math.round(r.rating)) },
              ]}
              rows={rows}
              rowKey={(r) => r.id}
              sort={sort === "rating" ? "rating" : sort === "age" ? "age" : "name"}
              onSort={(k) => { setSort(k); setPage(0); }}
              empty={busy ? "Searching…" : "Nothing matches those filters."}
            />
          ) : (
            <DataTable
              columns={[
                { key: "kennel_name", label: "Kennel" },
                { key: "net_worth", label: "Net worth", align: "right",
                  render: (r) => fmtMoney(Math.round(r.net_worth || 0)) },
                { key: "fame", label: "Fame", align: "right", render: (r) => Math.round(r.fame || 0) },
              ]}
              rows={rows}
              rowKey={(r, i) => r.kennel_name + i}
              empty={busy ? "Searching…" : "No kennels on the board yet."}
            />
          )}

          {pages > 1 && (
            <div className="kg-srch__pager">
              <button className="kg-btn kg-btn--sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Back</button>
              <span>Page {page + 1} of {pages}</span>
              <button className="kg-btn kg-btn--sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}

      <Note title="Where these come from">
        Animals are read from the projection built in phase 2 — a real table kept
        in step with every save, indexed on species, breed, name and rating. That
        is why this can filter and page across every player rather than only your
        own kennel.
      </Note>
    </section>
  );
}

/* ------------------------------ achievements ------------------------------- */
/* Tiers compound rather than reset: tier two needs more than tier one, and
   reaching it does not clear what tier one asked for. Every target is measured
   off the save, so nothing can be awarded that did not actually happen. */
const ACHIEVEMENTS = [
  { id: "roster", name: "A Full Yard", flavour: "Somewhere to put them all.",
    unit: "dogs", tiers: [2, 5, 10, 20], measure: (s) => (s.dogs || []).length },
  { id: "papers", name: "Papered", flavour: "A dog with papers is a dog with a price.",
    unit: "registered", tiers: [1, 5, 15, 30], measure: (s) => (s.dogs || []).filter((d) => d.registered).length },
  { id: "bloodline", name: "Founding a Line", flavour: "Your name on a bloodline.",
    unit: "bloodlines", tiers: [1, 2, 4, 6],
    measure: (s) => new Set((s.dogs || []).map((d) => d.bloodline).filter(Boolean)).size },
  { id: "field", name: "Meat in the Freezer", flavour: "What the dogs are for.",
    unit: "catches", tiers: [1, 10, 40, 120], measure: (s) => (s.catches || []).length },
  { id: "deep", name: "Deep Pedigree", flavour: "Generations of your own breeding.",
    unit: "generations", tiers: [2, 3, 5, 8],
    measure: (s) => (s.dogs || []).reduce((m, d) => Math.max(m, d.generation || 1), 0) },
  { id: "stockman", name: "Mixed Farming", flavour: "Not only dogs on this place.",
    unit: "head", tiers: [1, 5, 12, 25],
    measure: (s) => (s.horses || []).length + (s.cattle || []).length },
  { id: "purse", name: "Worth Something", flavour: "The whole place, valued honestly.",
    unit: "net worth", tiers: [10000, 50000, 200000, 1000000],
    measure: (s) => Math.round(s.cash + (s.savings || 0) + (s.dogs || []).reduce((t, d) => t + computeValue(d), 0)) },
  { id: "standing", name: "Known Around Here", flavour: "Levels come from doing the work.",
    unit: "level", tiers: [5, 15, 30, 50], measure: (s) => levelFromXp(s.xp || 0).level },
];

function tierOf(track, value) {
  let earned = 0;
  track.tiers.forEach((t, i) => { if (value >= t) earned = i + 1; });
  return earned;
}

function AchievementsScreen({ game }) {
  const { tab, state } = game;
  if (tab !== "achievements") return null;

  const rows = ACHIEVEMENTS.map((a) => {
    const value = a.measure(state);
    const tier = tierOf(a, value);
    const next = a.tiers[tier];
    return { a, value, tier, next };
  });
  const totalTiers = rows.reduce((n, r) => n + r.tier, 0);
  const possible = ACHIEVEMENTS.reduce((n, a) => n + a.tiers.length, 0);

  return (
    <section>
      <h2 className="kg-subhead">Achievements</h2>
      <p className="kg-hint">
        {totalTiers} of {possible} tiers earned. Every one is measured off the kennel
        as it stands, so nothing here can be awarded for something that did not happen.
      </p>

      <div className="kg-ach">
        {rows.map(({ a, value, tier, next }) => (
          <Panel key={a.id} title={a.name} right={tier ? `Tier ${tier} of ${a.tiers.length}` : "Not started"}>
            <p className="kg-ranch__profblurb" style={{ margin: "0 0 8px" }}>{a.flavour}</p>
            <Meter
              label={next == null ? "Complete" : `${value} / ${next} ${a.unit}`}
              value={next == null ? 1 : Math.min(value, next)}
              max={next == null ? 1 : next}
              unit=""
              tone={next == null ? "good" : tier > 0 ? "energy" : "warn"}
            />
            <div className="kg-ach__pips">
              {a.tiers.map((t, i) => (
                <span key={t} className={"kg-ranch__pip " + (i < tier ? "kg-ranch__pip--on" : "")}
                  title={`Tier ${i + 1}: ${t} ${a.unit}`} />
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </section>
  );
}

/* --------------------------- the care checklist ---------------------------- */
/* The daily triage screen: every animal against every kind of care, so the
   question "what still needs doing today" has one answer rather than eight
   profile pages. Read-only on purpose — it points at the work, the animal's
   own page does it. */
function CareChecklist({ game }) {
  const { tab, state, setViewDog } = game;
  if (tab !== "care") return null;

  const dogs = state.dogs || [];
  const mark = (ok, partial) => (ok ? "done" : partial ? "part" : "todo");

  const rows = dogs.map((d) => {
    const checks = {
      condition: mark(d.health >= 80, d.health >= 50),
      energy: mark(energyOf(d) >= 60, energyOf(d) >= 25),
      mood: mark(moodOf(d) >= 70, moodOf(d) >= 40),
      clean: mark(d.cleanedDay === state.day, false),
      health: mark(isVaccinated(d, state.day), false),
    };
    const done = Object.values(checks).filter((v) => v === "done").length;
    return { dog: d, checks, done, all: done === Object.keys(checks).length };
  });

  const fully = rows.filter((r) => r.all).length;
  /* Care only. Entering a trial was a column here briefly and it was wrong:
     competing is a choice, so a red mark against it told a player they were
     failing at something they had simply decided not to do today. */
  const COLS = [
    ["condition", "Condition"], ["energy", "Energy"], ["mood", "Mood"],
    ["clean", "Cleaned"], ["health", "Vaccinated"],
  ];

  return (
    <section>
      <h2 className="kg-subhead">Today</h2>
      <p className="kg-hint">
        Everything on the place against everything it needs. {fully} of {dogs.length} fully
        squared away.
      </p>

      {dogs.length === 0 ? (
        <p className="kg-empty">No dogs yet.</p>
      ) : (
        <>
          <div className="kg-ui-tablewrap">
            <table className="kg-ui-table kg-care">
              <thead>
                <tr>
                  <th>Dog</th>
                  {COLS.map(([k, label]) => <th key={k} className="kg-care__col">{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ dog, checks, all }) => (
                  <tr key={dog.id} className={all ? "kg-care__row--done" : ""}>
                    <td>
                      <button className="kg-ui-links__link" onClick={() => setViewDog(dog)}>{titledName(dog)}</button>
                    </td>
                    {COLS.map(([k]) => (
                      <td key={k} className="kg-care__col">
                        <span className={"kg-care__mark kg-care__mark--" + checks[k]}
                          aria-label={checks[k] === "done" ? "done" : checks[k] === "part" ? "partly" : "not done"}>
                          {checks[k] === "done" ? "✓" : checks[k] === "part" ? "–" : "×"}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="kg-care__legend">
            <span><span className="kg-care__mark kg-care__mark--done">✓</span> good</span>
            <span><span className="kg-care__mark kg-care__mark--part">–</span> getting there</span>
            <span><span className="kg-care__mark kg-care__mark--todo">×</span> needs doing</span>
          </div>
        </>
      )}
    </section>
  );
}
