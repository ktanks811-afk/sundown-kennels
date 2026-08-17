/* Stud book, county ranks, hall of fame, race records and the ledger.

   Split out of game.jsx, which carried every screen inline in one
   3,200-line component. The JSX is unchanged — only its home moved.

   Everything a screen needs arrives on one `game` object rather than
   through a long prop list: these are sections of a single stateful
   component, not reusable pieces with an interface worth designing. The
   destructure below is the honest record of what this file depends on. */
function RecordsScreens({ game }) {
  const { bloodlineGroups, dam, loadRaceLeaders, logFilter, raceLeaders, registeredDogs,
    session, setLogFilter, sire, state, tab } = game;
  return (
    <>
        {tab === "racerecords" && (() => {
          const timedEvents = Object.entries(HORSE_SHOWS).filter(([, ev]) => ev.timed);
          const leaderFor = (key) => raceLeaders.find((r) => r.event === key);
          return (
            <section>
              <h2 className="kg-subhead">Race records</h2>
              <p className="kg-hint">
                Timed events are run against the clock. The fastest run anyone has posted holds the
                record, with their name on it — beat it and it's yours.
              </p>
              {!session && <p className="kg-notice">Sign in (top right) to have your times counted on the board.</p>}

              {timedEvents.map(([key, ev]) => {
                const leader = leaderFor(key);
                const mine = personalBest(state, key);
                const iHoldIt = leader && mine && Math.abs(Number(leader.seconds) - mine.seconds) < 0.005;
                return (
                  <div key={key} className="kg-recordcard">
                    <div className="kg-recordcard__head">
                      <h3>{ev.label}</h3>
                      <span className="kg-recordcard__blurb">{ev.timed.blurb}</span>
                    </div>

                    <div className="kg-recordcard__body">
                      <div className="kg-recordslot">
                        <span className="kg-recordslot__label">World record</span>
                        {leader ? (
                          <>
                            <span className="kg-recordslot__time">{formatRaceTime(Number(leader.seconds))}</span>
                            <span className="kg-recordslot__who">
                              {leader.horse_name}{leader.horse_breed ? ` · ${leader.horse_breed}` : ""}
                            </span>
                            <span className="kg-recordslot__holder">held by <strong>{leader.holder}</strong></span>
                          </>
                        ) : (
                          <>
                            <span className="kg-recordslot__time kg-recordslot__time--empty">—</span>
                            <span className="kg-recordslot__who">Nobody's posted a time yet. First one takes it.</span>
                          </>
                        )}
                      </div>

                      <div className={"kg-recordslot " + (iHoldIt ? "kg-recordslot--mine" : "")}>
                        <span className="kg-recordslot__label">Your best</span>
                        {mine ? (
                          <>
                            <span className="kg-recordslot__time">{formatRaceTime(mine.seconds)}</span>
                            <span className="kg-recordslot__who">{mine.horseName} · {mine.breed}</span>
                            <span className="kg-recordslot__holder">
                              {iHoldIt ? "You hold the record." : leader ? `${(mine.seconds - Number(leader.seconds)).toFixed(2)}s off the record` : "Sign in to post it"}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="kg-recordslot__time kg-recordslot__time--empty">—</span>
                            <span className="kg-recordslot__who">Enter a horse in the {ev.label.toLowerCase()} to set one.</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              <button className="kg-btn kg-btn--ghost kg-btn--sm2" style={{ marginTop: 4 }} onClick={loadRaceLeaders}>Refresh the board</button>
            </section>
          );
        })()}
        {tab === "rankings" && (() => {
          const rows = buildRankings(state);
          const myIndex = rows.findIndex((r) => r.isPlayer);
          return (
            <>
              <h2 className="kg-subhead">County Rankings</h2>
              <p className="kg-hint">Every kennel in the county scored on fame, the quality of their best dogs, and the depth of the yard. Win trials and build a better line to climb.</p>
              <p className="kg-note">You're sitting <strong>#{myIndex + 1}</strong> of {rows.length}.</p>
              <ol className="kg-ranklist">
                {rows.map((r, i) => (
                  <li key={r.id} className={"kg-rankrow " + (r.isPlayer ? "kg-rankrow--me" : "")}>
                    <span className="kg-rankrow__pos">{i + 1}</span>
                    <div className="kg-rankrow__main">
                      <strong>{r.name}{r.isPlayer && <span className="kg-rankrow__you">you</span>}</strong>
                      <span className="kg-rankrow__meta">
                        {r.dogs.length} dog{r.dogs.length === 1 ? "" : "s"}
                        {r.bestDog && <> · best: {r.bestDog.name} ({overallRating(r.bestDog.stats)})</>}
                        {" · "}{fameTier(r.fame).label}
                      </span>
                    </div>
                    <span className="kg-rankrow__score">{r.score}</span>
                  </li>
                ))}
              </ol>
            </>
          );
        })()}
        {tab === "registry" && (
          <section>
            <h2 className="kg-subhead">Stud book — papers on file</h2>
            <p className="kg-hint">ℹ {registeredDogs.length} of {state.dogs.length} dogs registered. Registered parents can found a named bloodline when you breed them.</p>
            {registeredDogs.length === 0 ? <p className="kg-empty">No dogs registered yet — register one from the Kennel tab.</p> : (
              <ul className="kg-log" style={{ marginBottom: 28 }}>
                {registeredDogs.map((d) => (
                  <li key={d.id} className="kg-logrow">
                    <span className="kg-logday">{d.regNumber}</span>
                    <span><strong>{d.name}</strong> — {d.breed}, {colorLabel(d.colorGenes)}{d.bloodline ? " · " + d.bloodline + " Line" : ""}{d.sire ? " · out of " + d.sire + " × " + d.dam : " · foundation stock"}</span>
                  </li>
                ))}
              </ul>
            )}
            <h2 className="kg-subhead">Your bloodlines</h2>
            {Object.keys(bloodlineGroups).length === 0 ? (
              <p className="kg-empty">No named bloodlines yet. Register two unrelated dogs, breed them, and you'll get the option to found one.</p>
            ) : (
              Object.entries(bloodlineGroups).map(([name, dogs]) => {
                const avg = Math.round(dogs.reduce((s, d) => s + overallRating(d.stats), 0) / dogs.length);
                return (
                  <div key={name} className="kg-bloodline">
                    <h3>{name} Line</h3>
                    <p className="kg-note">{dogs.length} dog{dogs.length === 1 ? "" : "s"} · avg rating {avg}</p>
                    <p className="kg-hint" style={{ margin: 0 }}>{dogs.map((d) => d.name).join(", ")}</p>
                  </div>
                );
              })
            )}
          </section>
        )}
        {tab === "hof" && (
          <section>
            <h2 className="kg-subhead">Hall of Fame — biggest catches</h2>
            <p className="kg-hint">ℹ Every kennel's hunts count, yours and the other eight. Hog weights are the headline number; other hunts rank by payout.</p>
            <p className="kg-note">🐗 Group hog hunts — bay dogs to find and hold, catch dogs to finish — are where the record-book hogs come from. The more catch dogs your fame lets you field, the bigger the hog your pack can handle.</p>
            {state.catches.length === 0 ? <p className="kg-empty">No notable catches yet. Go hunting, or advance a few days.</p> : (
              <ul className="kg-log">
                {state.catches.map((c, i) => (
                  <li key={c.id} className="kg-logrow kg-logrow--catch">
                    <span className="kg-logrank">#{i + 1}</span>
                    <span><strong>{c.kennelName === state.kennelName ? c.kennelName + " (you)" : c.kennelName}</strong> — {c.dogName} the {c.breed}, {c.huntType}, {c.tier.toLowerCase()} run{c.weightLbs ? `, ${c.weightLbs} lb hog` : `, ${fmtMoney(c.payout)}`} · Day {c.day}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {tab === "log" && (() => {
          // Twenty rests in a row used to bury every real event under identical
          // "rested the kennel" lines, and the 60-entry cap pushed them out.
          const FILTERS = [
            { id: "all", label: "Everything" },
            { id: "money", label: "Money" },
            { id: "breed", label: "Breeding" },
            { id: "hunt", label: "Hunts" },
            { id: "injury", label: "Injuries & losses" },
            { id: "catch", label: "Milestones" },
          ];
          const filtered = logFilter === "all" ? state.log : state.log.filter((e) => e.type === logFilter);
          const collapsed = [];
          filtered.forEach((entry) => {
            const last = collapsed[collapsed.length - 1];
            if (last && last.text === entry.text) { last.count += 1; last.firstDay = entry.day; }
            else collapsed.push({ ...entry, count: 1, firstDay: entry.day });
          });
          return (
            <section>
              <h2 className="kg-subhead">Ledger</h2>
              <div className="kg-shopcats">
                {FILTERS.map((f) => (
                  <button key={f.id} className={"kg-shopcat " + (logFilter === f.id ? "kg-shopcat--active" : "")} onClick={() => setLogFilter(f.id)}>{f.label}</button>
                ))}
              </div>
              {collapsed.length === 0 ? <p className="kg-empty">Nothing recorded under that heading yet.</p> : (
                <ul className="kg-log">
                  {collapsed.map((entry, i) => (
                    <li key={i} className={"kg-logrow kg-logrow--" + entry.type}>
                      <span className="kg-logday">
                        {entry.count > 1 ? `Day ${entry.firstDay}–${entry.day}` : `Day ${entry.day}`}
                      </span>
                      <span>
                        {entry.text}
                        {entry.count > 1 && <span className="kg-logcount">×{entry.count}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })()}
    </>
  );
}
