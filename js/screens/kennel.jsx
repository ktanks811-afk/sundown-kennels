/* Overview, the yard and the property.

   Split out of game.jsx, which carried every screen inline in one
   3,200-line component. The JSX is unchanged — only its home moved.

   Everything a screen needs arrives on one `game` object rather than
   through a long prop list: these are sections of a single stateful
   component, not reusable pieces with an interface worth designing. The
   destructure below is the honest record of what this file depends on. */
function KennelScreens({ game }) {
  const { bloodlineGroups, buyPasture, buyProperty, buyTrailer, buyTruck,
    doAcceptBreedingRequest, doAcceptHuntOffer, doAcceptPurchaseOffer, doDeclineOffer,
    doRegister, doSell, dogCapacity, kennelSearch, netWorth, netWorthDelta, propShowAll,
    registeredDogs, restWeek, setKennelSearch, setPropShowAll, setTab, setViewDog, state, tab,
    topCatch, topDog } = game;
  return (
    <>
        {tab === "overview" && (
          <section>
            <p className="kg-hint">ℹ The front page of the stud book — a running record of {state.kennelName}'s worth, and what's happening around the county.</p>

            {(() => {
              const done = GOALS.map((g) => ({ ...g, complete: g.done(state) }));
              const left = done.filter((g) => !g.complete);
              if (!left.length) return null;   // stops nagging once you know the game
              const next = left[0];
              return (
                <div className="kg-goals">
                  <div className="kg-goals__head">
                    <h3>Getting started</h3>
                    <span className="kg-goals__count">{done.length - left.length} of {done.length}</span>
                  </div>
                  <ul className="kg-goals__list">
                    {done.map((g) => (
                      <li key={g.id} className={"kg-goal " + (g.complete ? "kg-goal--done" : "")}>
                        <span className="kg-goal__tick" aria-hidden="true">{g.complete ? "✓" : ""}</span>
                        <span className="kg-goal__label">{g.label}</span>
                        {g.id === next.id && <span className="kg-goal__hint">{g.hint}</span>}
                        {g.id === next.id && <button className="kg-btn kg-btn--sm2" onClick={() => setTab(g.tab)}>Take me there</button>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            <div className="kg-ovstats">
              <div className="kg-ovstat"><div className="kg-ovstat__label">Net worth</div><div className="kg-ovstat__value">{fmtMoney(netWorth)}</div></div>
              <div className="kg-ovstat"><div className="kg-ovstat__label">Cash on hand</div><div className="kg-ovstat__value">{fmtMoney(state.cash)}</div></div>
              <div className="kg-ovstat"><div className="kg-ovstat__label">Dogs</div><div className="kg-ovstat__value">{state.dogs.length}</div></div>
              <div className="kg-ovstat"><div className="kg-ovstat__label">Registered</div><div className="kg-ovstat__value">{registeredDogs.length}</div></div>
              <div className="kg-ovstat"><div className="kg-ovstat__label">Bloodlines</div><div className="kg-ovstat__value">{Object.keys(bloodlineGroups).length}</div></div>
              <div className="kg-ovstat"><div className="kg-ovstat__label">Fame</div><div className="kg-ovstat__value" style={{ fontSize: 15 }}>{fameTier(state.fame || 0).label}</div></div>
              <div className="kg-ovstat"><div className="kg-ovstat__label">Day</div><div className="kg-ovstat__value">{state.day}</div></div>
            </div>

            <div className="kg-ovpanel">
              <h2 className="kg-subhead">Net worth over time</h2>
              <Sparkline points={state.netWorthHistory} />
              <p className="kg-note" style={{ margin: "8px 0 0" }}>
                {netWorthDelta >= 0 ? "▲" : "▼"} {fmtMoney(Math.abs(netWorthDelta))} since the last day recorded.
              </p>
            </div>

            {state.offers.length > 0 && (
              <div className="kg-ovpanel">
                <h2 className="kg-subhead">Word around the county</h2>
                <p className="kg-hint">ℹ Offers expire after a few days if you don't act on them.</p>
                <div className="kg-offers">
                  {state.offers.map((o) => (
                    <div key={o.id} className="kg-offer" style={o.type === "breeding_request" ? { flexDirection: "column", alignItems: "stretch" } : null}>
                      {o.type === "hunt" && <p>🐗 <strong>{o.kennelName}</strong> invites you along on a hog hunt — invited hunts pay a 30% premium.</p>}
                      {o.type === "purchase" && <p>💵 <strong>{o.buyerName}</strong> offers <strong>{fmtMoney(o.price)}</strong> for {o.dogName}.</p>}
                      {o.type === "breeding_request" && (
                        <div>
                          <p style={{ marginBottom: 10 }}>💌 <strong>{o.kennelName}</strong> asks to breed their dog with your <strong>{o.targetDogName}</strong> — offering <strong>{fmtMoney(o.fee)}</strong>. Here's their dog:</p>
                          <div className="kg-grid" style={{ marginBottom: 10 }}>
                            <DogCard dog={o.requesterDog} />
                          </div>
                        </div>
                      )}
                      <div className="kg-offer__actions">
                        <button className="kg-btn kg-btn--sm kg-btn--gold" onClick={() => o.type === "hunt" ? doAcceptHuntOffer(o) : o.type === "purchase" ? doAcceptPurchaseOffer(o) : doAcceptBreedingRequest(o)}>Accept</button>
                        <button className="kg-btn kg-btn--sm kg-btn--ghost" onClick={() => doDeclineOffer(o.id)}>Decline</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {state.socialFeed && state.socialFeed.length > 0 && (
              <div className="kg-ovpanel">
                <h2 className="kg-subhead">📰 Media &amp; chatter — {fameTier(state.fame || 0).label}</h2>
                <p className="kg-hint">ℹ Fame from show wins and trial wins gets you talked about more often.</p>
                <ul className="kg-log">
                  {state.socialFeed.slice().reverse().map((p) => (
                    <li key={p.id} className="kg-logrow kg-logrow--catch"><span className="kg-logday">@{p.handle}</span><span>{p.text}</span></li>
                  ))}
                </ul>
              </div>
            )}

            <div className="kg-ovgrid">
              <div className="kg-ovpanel">
                <h2 className="kg-subhead">Top dog</h2>
                {topDog ? (
                  <DogCard dog={topDog} onView={setViewDog} />
                ) : <p className="kg-empty">No dogs in the kennel yet.</p>}
                {topCatch && <p className="kg-note">🐗 Best catch on record: {topCatch.dogName} the {topCatch.breed}, {topCatch.weightLbs ? topCatch.weightLbs + " lb hog" : fmtMoney(topCatch.payout)} on Day {topCatch.day}.</p>}
              </div>
              <div className="kg-ovpanel">
                <h2 className="kg-subhead">Recent activity</h2>
                {state.log.length === 0 ? <p className="kg-empty">Nothing recorded yet.</p> : (
                  <ul className="kg-log">
                    {state.log.slice(0, 6).map((entry, i) => (
                      <li key={i} className={"kg-logrow kg-logrow--" + entry.type}><span className="kg-logday">Day {entry.day}</span><span>{entry.text}</span></li>
                    ))}
                  </ul>
                )}
                <div className="kg-quickactions">
                  <button className="kg-btn kg-btn--sm" onClick={() => setTab("hunt")}>Go hunting</button>
                  <button className="kg-btn kg-btn--sm kg-btn--ghost" onClick={() => setTab("breed")}>Breed a litter</button>
                  <button className="kg-btn kg-btn--sm kg-btn--ghost" onClick={() => setTab("market")}>Visit market</button>
                  <button className="kg-btn kg-btn--sm kg-btn--ghost" onClick={restWeek}>Rest a week</button>
                </div>
              </div>
            </div>
          </section>
        )}
        {tab === "kennel" && (
          <section>
            <p className="kg-hint">ℹ Coat, height, and weight are all genetic. Register a dog to put papers on it — registered parents can found their own bloodline.</p>
            {state.dogs.length === 0 ? <p className="kg-empty">The kennel is empty. Visit the Market to bring in stock.</p> : (
              <>
                <input className="kg-search" type="text" placeholder="Search your dogs by name or breed…" value={kennelSearch} onChange={(e) => setKennelSearch(e.target.value)} />
                {(() => {
                  const q = kennelSearch.trim().toLowerCase();
                  const shown = q ? state.dogs.filter((d) => d.name.toLowerCase().includes(q) || d.breed.toLowerCase().includes(q)) : state.dogs;
                  return shown.length === 0 ? <p className="kg-empty">No dogs match "{kennelSearch}".</p> : (
                    <div className="kg-grid">
                      {shown.map((dog) => (
                        <DogCard key={dog.id} dog={dog} onView={setViewDog}
                          footer={<>
                            {!dog.registered && <button className="kg-btn kg-btn--sm kg-btn--gold" disabled={state.cash < registrationFee(dog)} onClick={() => doRegister(dog)}>Register — {fmtMoney(registrationFee(dog))}</button>}
                            <button className="kg-btn kg-btn--sm kg-btn--danger" onClick={() => doSell(dog)}>Sell — {fmtMoney(computeValue(dog))}</button>
                          </>} />
                      ))}
                    </div>
                  );
                })()}
              </>
            )}
          </section>
        )}
        {tab === "property" && (
          <section>
            <p className="kg-hint">ℹ Your kennel has room for {dogCapacity} dogs — {state.dogs.length} right now. Buy land and a house to grow; a litter that outgrows your space places the extra pups in pet homes for half value instead of losing them outright.</p>
            <div className="kg-ovstat" style={{ maxWidth: 340, marginBottom: 24 }}>
              <div className="kg-ovstat__label">Current property</div>
              <div className="kg-ovstat__value" style={{ fontSize: 17 }}>{propertyLabel(state.property)}</div>
              <p className="kg-note" style={{ margin: "4px 0 0" }}>{state.dogs.length} / {dogCapacity} dogs</p>
            </div>
            <h2 className="kg-subhead">Land &amp; houses for sale</h2>
            {(() => {
              // Twelve land sizes x nine houses x sixteen locations produced 107
              // listings on day one across 25 screens of scrolling. Nobody read
              // that. Same catalogue, picked down to the choices that matter.
              const all = LAND_SIZES.flatMap((land, li) => HOUSE_TYPES.map((house, hi) => {
                const capacity = land.capacity + house.capacity;
                if (capacity <= dogCapacity) return null;
                const price = land.price + house.price;
                const location = LAND_LOCATIONS[(li * HOUSE_TYPES.length + hi) % LAND_LOCATIONS.length];
                const label = house.key === "none" ? `${land.label} in ${location}` : `${house.label} on a ${land.label.toLowerCase()} in ${location}`;
                return { land, house, capacity, price, location, label, gain: capacity - dogCapacity, perDog: price / (capacity - dogCapacity) };
              })).filter(Boolean);

              if (!all.length) return <p className="kg-empty">You've got the biggest place in the county. Nothing left to buy.</p>;

              const affordable = all.filter((o) => o.price <= state.cash);
              const byValue = affordable.slice().sort((a, b) => a.perDog - b.perDog)[0];
              const cheapest = all.slice().sort((a, b) => a.price - b.price)[0];
              const biggest = affordable.slice().sort((a, b) => b.capacity - a.capacity)[0];
              const dream = all.slice().sort((a, b) => b.capacity - a.capacity)[0];

              const picks = [];
              const seen = new Set();
              const add = (o, tag, tone) => { if (o && !seen.has(o.label)) { seen.add(o.label); picks.push({ ...o, tag, tone }); } };
              add(cheapest, "Next step up", "denim");
              add(byValue, "Best value", "olive");
              add(biggest, "Most room you can afford", "gold");
              add(dream, "Something to work toward", "tan");

              return (
                <>
                  <p className="kg-hint" style={{ marginBottom: 16 }}>
                    ℹ {all.length} places are on the market that would give you more room. These are the ones worth looking at{propShowAll ? "" : " — open the full list if you want to browse"}.
                  </p>
                  <div className="kg-rows">
                    {picks.map((o) => (
                      <div key={o.label} className="kg-row kg-row--prop">
                        <div className="kg-row__main">
                          <span className="kg-row__name">{o.label}</span>
                          <span className="kg-row__meta">{o.land.acres} acres{o.house.key !== "none" ? " · " + o.house.label : ""} · room for {o.capacity} dogs</span>
                        </div>
                        <Badge tone={o.tone}>{o.tag}</Badge>
                        <span className="kg-badge kg-badge--gold">+{o.gain}</span>
                        <div className="kg-row__right">
                          <button className="kg-btn kg-btn--sm" disabled={state.cash < o.price} onClick={() => buyProperty(o.land.key, o.house.key, o.location)}>
                            {state.cash < o.price ? fmtMoney(o.price) : `Buy — ${fmtMoney(o.price)}`}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button className="kg-btn kg-btn--ghost kg-btn--sm2" style={{ marginTop: 16 }} onClick={() => setPropShowAll((v) => !v)}>
                    {propShowAll ? "Hide the full market" : `Browse all ${all.length} listings`}
                  </button>

                  {propShowAll && (
                    <div className="kg-tablewrap">
                      <table className="kg-table">
                        <thead><tr><th>Property</th><th>Acres</th><th>Room</th><th>Price</th><th></th></tr></thead>
                        <tbody>
                          {all.slice().sort((a, b) => a.price - b.price).map((o) => (
                            <tr key={o.label}>
                              <td>{o.label}</td>
                              <td className="kg-num">{o.land.acres}</td>
                              <td className="kg-num">{o.capacity}</td>
                              <td className="kg-num">{fmtMoney(o.price)}</td>
                              <td>
                                <button className="kg-btn kg-btn--sm2" disabled={state.cash < o.price} onClick={() => buyProperty(o.land.key, o.house.key, o.location)}>Buy</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              );
            })()}

            <hr className="kg-divider" />
            <h2 className="kg-subhead">Pasture — for horses &amp; cattle</h2>
            <p className="kg-hint" style={{ marginBottom: 16 }}>ℹ Horses and cattle graze the same pasture, so they share one capacity pool: {livestockCount(state)} / {livestockCapacity(state)} head right now. Bigger pastures need enough land underneath them first.</p>
            <div className="kg-ovstat" style={{ maxWidth: 340, marginBottom: 16 }}>
              <div className="kg-ovstat__label">Current pasture</div>
              <div className="kg-ovstat__value" style={{ fontSize: 17 }}>{(PASTURE_TIERS.find((p) => p.key === (state.property.pastureKey || "none")) || PASTURE_TIERS[0]).label}</div>
              <p className="kg-note" style={{ margin: "4px 0 0" }}>{livestockCount(state)} / {livestockCapacity(state)} head</p>
            </div>
            <div className="kg-grid">
              {PASTURE_TIERS.filter((t) => t.capacity > livestockCapacity(state)).map((t) => {
                const land = LAND_SIZES.find((l) => l.key === state.property.landKey);
                const lockedByLand = land.acres < t.minAcres;
                return (
                  <div key={t.key} className="kg-card">
                    <div className="kg-card__top"><h3 className="kg-card__name">{t.label}</h3></div>
                    <p className="kg-card__meta">Needs {t.minAcres}+ acres of land</p>
                    <div className="kg-card__tags"><Badge tone="denim">Capacity {t.capacity}</Badge><Badge tone="gold">+{t.capacity - livestockCapacity(state)} room</Badge></div>
                    <button className="kg-btn kg-btn--sm" style={{ marginTop: 10 }} disabled={lockedByLand || state.cash < t.price}
                      onClick={() => buyPasture(t.key)}>
                      {lockedByLand ? `Need ${t.minAcres}+ acres` : state.cash < t.price ? "Can't afford" : `Buy — ${fmtMoney(t.price)}`}
                    </button>
                  </div>
                );
              })}
            </div>

            <hr className="kg-divider" />
            <h2 className="kg-subhead">Truck — to haul to shows &amp; auctions</h2>
            <p className="kg-hint" style={{ marginBottom: 16 }}>ℹ You need a truck with enough tow capacity for your trailer. Pickups handle a small trailer; an actual 18-wheeler can pull a full stock trailer at once.</p>
            <p className="kg-note" style={{ marginBottom: 12 }}>Current: {currentTruck(state).label}</p>
            <div className="kg-grid">
              {TRUCKS.filter((t) => t.key !== "none" && t.key !== state.truck).map((t) => (
                <div key={t.key} className="kg-card">
                  <div className="kg-card__top"><h3 className="kg-card__name">{t.label}</h3></div>
                  <p className="kg-card__meta">{t.brand} · tow rating {t.tow.toLocaleString("en-US")} lb</p>
                  <button className="kg-btn kg-btn--sm" style={{ marginTop: 10 }} disabled={state.cash < t.price} onClick={() => buyTruck(t.key)}>
                    {state.cash < t.price ? "Can't afford" : `Buy — ${fmtMoney(t.price)}`}
                  </button>
                </div>
              ))}
            </div>

            <hr className="kg-divider" />
            <h2 className="kg-subhead">Trailer</h2>
            <p className="kg-note" style={{ marginBottom: 12 }}>Current: {currentTrailer(state).label}{canHaul(state) ? "" : " — you need a truck that can tow it before this trailer is usable."}</p>
            <div className="kg-grid">
              {TRAILERS.filter((t) => t.key !== "none" && t.key !== state.trailer).map((t) => (
                <div key={t.key} className="kg-card">
                  <div className="kg-card__top"><h3 className="kg-card__name">{t.label}</h3></div>
                  <p className="kg-card__meta">Holds {t.capacity} head · needs {t.weightReq.toLocaleString("en-US")} lb tow capacity</p>
                  <button className="kg-btn kg-btn--sm" style={{ marginTop: 10 }} disabled={state.cash < t.price} onClick={() => buyTrailer(t.key)}>
                    {state.cash < t.price ? "Can't afford" : `Buy — ${fmtMoney(t.price)}`}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
    </>
  );
}
