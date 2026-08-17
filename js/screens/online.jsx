/* Player market, challenges and the leaderboard.

   Split out of game.jsx, which carried every screen inline in one
   3,200-line component. The JSX is unchanged — only its home moved.

   Everything a screen needs arrives on one `game` object rather than
   through a long prop list: these are sections of a single stateful
   component, not reusable pieces with an interface worth designing. The
   destructure below is the honest record of what this file depends on. */
function OnlineScreens({ game }) {
  const { acceptChallengeAction, acceptPick, buyListing, cancelChallenge, cancelListing,
    challengePick, createChallenge, huntableDogs, kennelFull, leaderboardRows, listDogForSale,
    myChallenges, openChallenges, pvpListings, pvpMsg, rivalsMsg, sellPick, session,
    setAcceptPick, setChallengePick, setSellPick, setViewDog, state, tab } = game;
  return (
    <>
        {tab === "trade" && (
          <section>
            <p className="kg-hint">ℹ Buy and sell dogs with other real kennels — not the AI. Listings and purchases sync live for everyone signed in.</p>
            {!session && <p className="kg-notice">Sign in (top right) to list or buy dogs here.</p>}
            {pvpMsg && <p className="kg-note">{pvpMsg}</p>}
            {session && (
              <React.Fragment>
                <h2 className="kg-subhead">List one of your dogs</h2>
                {state.dogs.length === 0 ? <p className="kg-empty">You don't have any dogs to list.</p> : (
                  <div className="kg-pairpick">
                    <select value={sellPick.dogId || ""} onChange={(e) => setSellPick((p) => ({ ...p, dogId: e.target.value }))}>
                      <option value="">Choose a dog</option>
                      {state.dogs.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.breed} ({overallRating(d.stats)})</option>)}
                    </select>
                    <input type="number" min="1" placeholder="Price" style={{ maxWidth: 120 }}
                      value={sellPick.price} onChange={(e) => setSellPick((p) => ({ ...p, price: e.target.value }))} />
                    <button className="kg-btn kg-btn--sm" disabled={!sellPick.dogId || !sellPick.price} onClick={() => listDogForSale(sellPick.dogId, sellPick.price)}>List for Sale</button>
                  </div>
                )}
                {pvpListings.some((l) => l.seller_id === session.user.id) && (
                  <React.Fragment>
                    <h2 className="kg-subhead">Your listings</h2>
                    <ul className="kg-log" style={{ marginBottom: 20 }}>
                      {pvpListings.filter((l) => l.seller_id === session.user.id).map((l) => (
                        <li key={l.id} className="kg-logrow">
                          <span>{l.dog.name} — {fmtMoney(l.price)}</span>
                          <button className="kg-btn kg-btn--ghost kg-btn--sm" style={{ width: "auto" }} onClick={() => cancelListing(l)}>Cancel</button>
                        </li>
                      ))}
                    </ul>
                  </React.Fragment>
                )}
              </React.Fragment>
            )}
            <h2 className="kg-subhead">On the market from other kennels</h2>
            {pvpListings.filter((l) => l.seller_id !== session?.user?.id).length === 0 ? (
              <p className="kg-empty">Nobody's listed a dog yet — be the first.</p>
            ) : (
              <div className="kg-grid">
                {pvpListings.filter((l) => l.seller_id !== session?.user?.id).map((l) => (
                  <DogCard key={l.id} dog={l.dog} onView={setViewDog} price={l.price} sellerName={"from " + l.seller_name}
                    footer={<button className="kg-btn kg-btn--sm" disabled={!session || state.cash < l.price || kennelFull} onClick={() => buyListing(l)}>
                      {!session ? "Sign in to buy" : kennelFull ? "Kennel full" : state.cash < l.price ? "Can't afford" : "Buy"}
                    </button>} />
                ))}
              </div>
            )}
          </section>
        )}
        {tab === "rivals" && (
          <section>
            <p className="kg-hint">ℹ Post a dog against a trial type and wait for a real opponent, or answer someone else's challenge — results resolve instantly for both of you.</p>
            {!session && <p className="kg-notice">Sign in (top right) to challenge or be challenged.</p>}
            {rivalsMsg && <p className="kg-note">{rivalsMsg}</p>}
            {session && (
              <React.Fragment>
                <h2 className="kg-subhead">Post a challenge</h2>
                <div className="kg-hunttypes">
                  {Object.entries(TRIALS).map(([key, t]) => (
                    <button key={key} className={"kg-trialcard " + (challengePick.trial === key ? "kg-trialcard--active" : "")} onClick={() => setChallengePick((p) => ({ ...p, trial: key }))}>
                      <strong>{t.label}</strong><span>{t.desc}</span>
                    </button>
                  ))}
                </div>
                {huntableDogs.length === 0 ? <p className="kg-empty">No dog is fit to compete right now.</p> : (
                  <div className="kg-pairpick">
                    <select value={challengePick.dogId || ""} onChange={(e) => setChallengePick((p) => ({ ...p, dogId: e.target.value }))}>
                      <option value="">Choose your dog</option>
                      {huntableDogs.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.breed} ({overallRating(d.stats)})</option>)}
                    </select>
                    <button className="kg-btn kg-btn--sm" disabled={!challengePick.dogId} onClick={() => createChallenge(challengePick.dogId, challengePick.trial)}>Post Challenge</button>
                  </div>
                )}
                {openChallenges.some((c) => c.creator_id === session.user.id) && (
                  <React.Fragment>
                    <h2 className="kg-subhead">Your open challenges</h2>
                    <ul className="kg-log" style={{ marginBottom: 20 }}>
                      {openChallenges.filter((c) => c.creator_id === session.user.id).map((c) => (
                        <li key={c.id} className="kg-logrow">
                          <span>{TRIALS[c.trial].label} — {c.dog.name} — waiting for an opponent</span>
                          <button className="kg-btn kg-btn--ghost kg-btn--sm" style={{ width: "auto" }} onClick={() => cancelChallenge(c)}>Cancel</button>
                        </li>
                      ))}
                    </ul>
                  </React.Fragment>
                )}
              </React.Fragment>
            )}
            <h2 className="kg-subhead">Open challenges from other kennels</h2>
            {openChallenges.filter((c) => c.creator_id !== session?.user?.id).length === 0 ? (
              <p className="kg-empty">No open challenges right now — post one above.</p>
            ) : (
              <ul className="kg-log" style={{ marginBottom: 20 }}>
                {openChallenges.filter((c) => c.creator_id !== session?.user?.id).map((c) => (
                  <li key={c.id} className="kg-logrow">
                    <span>{c.creator_name} — {TRIALS[c.trial].label} — {c.dog.name} ({overallRating(c.dog.stats)} overall)</span>
                    {session && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <select value={acceptPick[c.id] || ""} onChange={(e) => setAcceptPick((p) => ({ ...p, [c.id]: e.target.value }))}>
                          <option value="">Your dog</option>
                          {huntableDogs.map((d) => <option key={d.id} value={d.id}>{d.name} ({overallRating(d.stats)})</option>)}
                        </select>
                        <button className="kg-btn kg-btn--sm" disabled={!acceptPick[c.id]} onClick={() => acceptChallengeAction(c, acceptPick[c.id])}>Accept</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {myChallenges.length > 0 && (
              <React.Fragment>
                <h2 className="kg-subhead">Recent results</h2>
                <ul className="kg-log">
                  {myChallenges.map((c) => {
                    const won = c.winner_id === session?.user?.id;
                    return (
                      <li key={c.id} className={"kg-logrow kg-logrow--" + (won ? "money" : "injury")}>
                        <span>{TRIALS[c.trial].label}: {c.creator_name} ({c.dog.name}) vs {c.opponent_name} ({c.opponent_dog.name}) — {won ? "you won" : "you lost"} by {Math.round(c.margin)}</span>
                      </li>
                    );
                  })}
                </ul>
              </React.Fragment>
            )}
          </section>
        )}
        {tab === "leaderboard" && (
          <section>
            <p className="kg-hint">ℹ Every signed-in kennel, ranked by net worth. Public — visible whether you're signed in or not.</p>
            {leaderboardRows.length === 0 ? <p className="kg-empty">No cloud kennels yet — sign in to be the first on the board.</p> : (
              <ul className="kg-log">
                {leaderboardRows.map((row, i) => (
                  <li key={row.kennel_name + i} className={"kg-logrow " + (row.kennel_name === state.kennelName ? "kg-logrow--money" : "")}>
                    <span className="kg-logrank">#{i + 1}</span>
                    <span><strong>{row.kennel_name}</strong>{row.kennel_name === state.kennelName ? " (you)" : ""} — {fmtMoney(row.net_worth)} · {fameTier(row.fame || 0).label}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
    </>
  );
}
