/* Dog market, supply store, inventory and rescue.

   Split out of game.jsx, which carried every screen inline in one
   3,200-line component. The JSX is unchanged — only its home moved.

   Everything a screen needs arrives on one `game` object rather than
   through a long prop list: these are sections of a single stateful
   component, not reusable pieces with an interface worth designing. The
   destructure below is the honest record of what this file depends on. */
function MarketScreens({ game }) {
  const { doAdopt, doBuy, doBuyItem, doBuyUpgrade, doUseItem, filters, itemTargets, kennelFull,
    refreshRescue, scoutMarket, setFilters, setItemTargets, setShopCat, setViewDog, shopCat,
    shownMarket, state, tab, setBuyItemId } = game;
  return (
    <>
        {tab === "market" && (
          <section>
            <div className="kg-marketbar">
              <h2 className="kg-subhead">Dogs for sale</h2>
              <button className="kg-btn kg-btn--ghost kg-btn--sm" onClick={scoutMarket}>⟳ Scout New Dogs</button>
            </div>
            <div className="kg-filters">
              <label>Breed
                <select value={filters.breed} onChange={(e) => setFilters((f) => ({ ...f, breed: e.target.value }))}>
                  <option value="all">All breeds</option>
                  <option value="Cross">Mixed / cross only</option>
                  {BREED_NAMES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              <label>Sex
                <select value={filters.sex} onChange={(e) => setFilters((f) => ({ ...f, sex: e.target.value }))}>
                  <option value="all">Any</option><option value="M">Male</option><option value="F">Female</option>
                </select>
              </label>
              <label>Max price
                <input type="number" min="0" placeholder="No limit" value={filters.maxPrice} onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))} />
              </label>
              <label>Min star trait
                <select value={filters.minStars} onChange={(e) => setFilters((f) => ({ ...f, minStars: e.target.value }))}>
                  <option value="0">Any</option><option value="3">★★★+</option><option value="4">★★★★+</option><option value="5">★★★★★ only</option>
                </select>
              </label>
              <label>Sort by
                <select value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}>
                  <option value="priceAsc">Price: low to high</option><option value="priceDesc">Price: high to low</option>
                  <option value="ratingDesc">Overall rating</option><option value="rarityDesc">Rarity</option>
                </select>
              </label>
            </div>
            {shownMarket.length === 0 ? <p className="kg-empty">Nothing matches those filters right now. Try widening them, scouting, or resting a week.</p> : (
              <div className="kg-grid">
                {shownMarket.map((dog) => (
                  <DogCard key={dog.id} dog={dog} onView={setViewDog} price={dog.price} sellerName={dog.sellerName ? "from " + dog.sellerName : null}
                    footer={<button className="kg-btn kg-btn--sm" disabled={state.cash < dog.price || kennelFull} onClick={() => doBuy(dog)}>{kennelFull ? "Kennel full" : state.cash < dog.price ? "Can't afford" : "Buy"}</button>} />
                ))}
              </div>
            )}
          </section>
        )}
        {tab === "shop" && (
          <>
            <h2 className="kg-subhead">Supply Store</h2>
            <p className="kg-hint">Feed, medicine, conditioning gear, and tack. Everything here is bought once and kept in your inventory until you use it on a dog.</p>

            <div className="kg-shopcats">
              {ITEM_CATEGORIES.map((c) => (
                <button key={c.id} className={"kg-shopcat " + (shopCat === c.id ? "kg-shopcat--active" : "")} onClick={() => setShopCat(c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
            <p className="kg-note">{(ITEM_CATEGORIES.find((c) => c.id === shopCat) || {}).blurb}</p>

            {shopCat === "kennel" ? (
              <div className="kg-shopgrid">
                {Object.entries(UPGRADES).map(([key, up]) => {
                  const owned = !!(state.upgrades && state.upgrades[key]);
                  return (
                    <div key={key} className={"kg-shopitem " + (owned ? "kg-shopitem--owned" : "")}>
                      <div className="kg-shopitem__art"><UpgradeIcon id={key} /></div>
                      <div className="kg-shopitem__head">
                        <strong>{up.name}</strong>
                        {owned ? <Badge tone="olive">Built</Badge> : <span className="kg-shopitem__price">{fmtMoney(up.price)}</span>}
                      </div>
                      <p className="kg-shopitem__desc">{up.desc}</p>
                      <button className="kg-btn kg-btn--sm" disabled={owned || state.cash < up.price} onClick={() => doBuyUpgrade(key)}>
                        {owned ? "Already built" : state.cash < up.price ? "Can't afford" : "Build it"}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="kg-shopgrid">
                {itemsInCategory(shopCat).map((id) => {
                  const item = ITEMS[id];
                  const owned = (state.inventory || {})[id] || 0;
                  return (
                    <div key={id} className="kg-shopitem">
                      <div className="kg-shopitem__art"><ItemIcon id={id} item={item} /></div>
                      <div className="kg-shopitem__head">
                        <strong>
                          {item.collar && <span className="kg-collardot" style={{ background: item.collar }} />}
                          {item.name}
                        </strong>
                        <span className="kg-shopitem__price">{fmtMoney(item.price)}</span>
                      </div>
                      <p className="kg-shopitem__desc">{item.desc}</p>
                      <div className="kg-shopitem__effects">
                        {item.heal && <Badge tone="olive">Full heal</Badge>}
                        {item.stat && Object.entries(item.stat).map(([k, v]) => <Badge key={k} tone="denim">+{v} {STAT_LABELS[k]}</Badge>)}
                        {typeof item.health === "number" && item.health > 0 && <Badge tone="olive">+{item.health} condition</Badge>}
                        {typeof item.health === "number" && item.health < 0 && <Badge tone="rust">{item.health} condition</Badge>}
                        {item.collar && <Badge tone="tan">Cosmetic</Badge>}
                      </div>
                      <div className="kg-shopitem__foot">
                        {owned > 0 && <span className="kg-shopitem__owned">{owned} in stock</span>}
                        {/* Opens the two-step purchase rather than buying on
                            the spot: a single click was easy to do by accident
                            and left no route from bought to used. */}
                        <button className="kg-btn kg-btn--sm" disabled={state.cash < item.price} onClick={() => setBuyItemId(id)}>
                          {state.cash < item.price ? "Can't afford" : "Buy"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        {tab === "inventory" && (() => {
          const inv = state.inventory || {};
          const owned = Object.keys(inv).filter((id) => inv[id] > 0 && ITEMS[id]);
          const builtUpgrades = Object.keys(state.upgrades || {}).filter((k) => UPGRADES[k]);
          return (
            <>
              <h2 className="kg-subhead">Inventory</h2>
              <p className="kg-hint">Pick a dog and use an item on them. Feed and medicine restore condition; conditioning gear trades condition for permanent stat gains.</p>

              {!owned.length && <p className="kg-empty">Nothing on the shelf. Head to the Supply Store.</p>}

              <div className="kg-invlist">
                {owned.map((id) => {
                  const item = ITEMS[id];
                  const targetId = itemTargets[id] || (state.dogs[0] && state.dogs[0].id) || "";
                  const targetDog = state.dogs.find((d) => d.id === targetId);
                  const hurtWarning = item.cat === "training" && targetDog && targetDog.health < 45;
                  return (
                    <div key={id} className="kg-invrow">
                      <div className="kg-invrow__art"><ItemIcon id={id} item={item} size={40} /></div>
                      <div className="kg-invrow__main">
                        <strong>
                          {item.collar && <span className="kg-collardot" style={{ background: item.collar }} />}
                          {item.name}
                        </strong>
                        <span className="kg-invrow__qty">×{inv[id]}</span>
                        <p className="kg-invrow__desc">{item.desc}</p>
                      </div>
                      <div className="kg-invrow__actions">
                        <select value={targetId} onChange={(e) => setItemTargets((p) => ({ ...p, [id]: e.target.value }))}>
                          {state.dogs.map((d) => (
                            <option key={d.id} value={d.id}>{d.name} — {breedShort(d.breed)} ({Math.round(d.health)}%)</option>
                          ))}
                        </select>
                        <button className="kg-btn kg-btn--sm" disabled={!targetId} onClick={() => doUseItem(id, targetId)}>Use</button>
                      </div>
                      {hurtWarning && <p className="kg-warn kg-invrow__warn">{targetDog.name} is already beat up — conditioning will take them lower.</p>}
                    </div>
                  );
                })}
              </div>

              {!!builtUpgrades.length && (
                <>
                  <hr className="kg-divider" />
                  <h3 className="kg-subhead">Kennel upgrades</h3>
                  <div className="kg-shopgrid">
                    {builtUpgrades.map((k) => (
                      <div key={k} className="kg-shopitem kg-shopitem--owned">
                        <div className="kg-shopitem__art"><UpgradeIcon id={k} /></div>
                        <div className="kg-shopitem__head"><strong>{UPGRADES[k].name}</strong><Badge tone="olive">Active</Badge></div>
                        <p className="kg-shopitem__desc">{UPGRADES[k].desc}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          );
        })()}
        {tab === "rescue" && (
          <>
            <h2 className="kg-subhead">County Shelter</h2>
            <p className="kg-hint">Unpapered dogs at a fraction of market price. Condition is rough and there's no pedigree behind them — but the genetics are real, and every so often something very good comes through the pen.</p>
            <div className="kg-marketbar">
              <span className="kg-note">{(state.rescue || []).length} dog{(state.rescue || []).length === 1 ? "" : "s"} in intake · turns over every 10 days</span>
              <button className="kg-btn kg-btn--ghost" onClick={refreshRescue}>Check for new intakes</button>
            </div>
            {!(state.rescue || []).length && <p className="kg-empty">The pen is empty right now. Check back in a few days.</p>}
            <div className="kg-grid">
              {(state.rescue || []).map((entry) => (
                <div key={entry.id} className="kg-rescuecard">
                  <DogCard
                    dog={entry.dog}
                    onView={setViewDog}
                    footer={
                      <>
                        <p className="kg-rescuecard__story">“{entry.story}”</p>
                        <p className="kg-card__price">Adoption fee {fmtMoney(entry.fee)}</p>
                        <button className="kg-btn kg-btn--sm" disabled={state.cash < entry.fee || kennelFull} onClick={() => doAdopt(entry)}>
                          {kennelFull ? "Kennel full" : state.cash < entry.fee ? "Can't afford" : "Adopt"}
                        </button>
                      </>
                    }
                  />
                </div>
              ))}
            </div>
          </>
        )}
    </>
  );
}
