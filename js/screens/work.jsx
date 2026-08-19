/* Hunting, breeding, trials and the group hunt.

   Split out of game.jsx, which carried every screen inline in one
   3,200-line component. The JSX is unchanged — only its home moved.

   Everything a screen needs arrives on one `game` object rather than
   through a long prop list: these are sections of a single stateful
   component, not reusable pieces with an interface worth designing. The
   destructure below is the honest record of what this file depends on. */
function WorkScreens({ game }) {
  const [enterMsg, setEnterMsg] = useState(null);
  const { acceptStudRequestAction, bothMerleCarriers, breedPick, breedableF, breedableM,
    canFoundBloodline, cancelStudOffer, competitors, dam, declineStudRequest, doBreed,
    doCallOffGroupHunt, doEndGroupHuntSession, doHunt, doMiniGameTap, doReleaseCatchDogs,
    doStartGroupHunt, doStudService, doTrial, dogCapacity, groupHunt, groupSetup, huntPick,
    huntableDogs, incomingStudRequests, inheritedBloodline, kennelFull, myStudRequests,
    newBloodline, postStudOffer, requestDamPick, requestStud, session, setBreedPick,
    setGroupHunt, setHuntPick, setNewBloodline, setRequestDamPick, setStudDamId, setStudPick,
    setTrialPick, setViewDog, sire, state, studDam, studDamId, studMsg, studOffers, studPick,
    studs, tab, tick, toggleBayPick, toggleCatchPick, trialPick,
    enterTrial, withdrawEntry } = game;
  return (
    <>
        {tab === "hunt" && (
          <section>
            <div className="kg-hunttypes">
              {Object.entries(HUNTS).map(([key, h]) => (
                <button key={key} className={"kg-huntcard " + (huntPick.hunt === key ? "kg-huntcard--active" : "")} onClick={() => setHuntPick((p) => ({ ...p, hunt: key }))}>
                  <strong>{h.label}</strong><span>{h.desc}</span>
                  <span className="kg-huntcard__meta">Base pay {fmtMoney(h.basePay)} · risk {Math.round(h.injuryRisk * 100)}%</span>
                </button>
              ))}
            </div>
            <h2 className="kg-subhead">Send a dog</h2>
            {huntableDogs.length === 0 ? <p className="kg-empty">No dog is fit to hunt right now — too young or too banged up. Let one heal or rest the kennel.</p> : (
              <div className="kg-grid">
                {huntableDogs.map((dog) => (
                  <DogCard key={dog.id} dog={dog} onView={setViewDog}
                    footer={<button className="kg-btn kg-btn--sm" onClick={() => { setHuntPick((p) => ({ ...p, dogId: dog.id })); doHunt(dog.id, huntPick.hunt); }}>Run the {HUNTS[huntPick.hunt].label}</button>} />
                ))}
              </div>
            )}

            <hr className="kg-divider" />
            <h2 className="kg-subhead">Group Hunt</h2>
            {!groupHunt && (
              <>
                <p className="kg-hint">ℹ Build a hunting party: bay dogs find and hold the hog, catch dogs bring it down. Your kennel's fame sets how big a group you can field.</p>
                <p className="kg-note">{fameTier(state.fame || 0).label} — up to {groupHuntLimit(state.fame || 0).bay} bay dogs, {groupHuntLimit(state.fame || 0).catch} catch dogs.</p>
                {huntableDogs.length < 2 ? <p className="kg-empty">Need at least 2 dogs fit to hunt to build a group.</p> : (
                  <>
                    <h3 className="kg-subhead" style={{ fontSize: 15 }}>Bay dogs ({groupSetup.bayIds.length}/{groupHuntLimit(state.fame || 0).bay})</h3>
                    <div className="kg-grid" style={{ marginBottom: 18 }}>
                      {huntableDogs.map((dog) => {
                        const picked = groupSetup.bayIds.includes(dog.id);
                        const takenByCatch = groupSetup.catchIds.includes(dog.id);
                        const disabled = !picked && (takenByCatch || groupSetup.bayIds.length >= groupHuntLimit(state.fame || 0).bay);
                        return (
                          <DogCard key={dog.id} dog={dog} onView={setViewDog}
                            footer={<>
                              <RoleBadge label="Bay" value={baySuitability(dog)} />
                              <button className={"kg-btn kg-btn--sm " + (picked ? "" : "kg-btn--ghost")} disabled={disabled}
                                onClick={() => toggleBayPick(dog.id)}>{picked ? "✓ Bay dog" : takenByCatch ? "Already a catch dog" : "Add as bay dog"}</button>
                            </>} />
                        );
                      })}
                    </div>
                    <h3 className="kg-subhead" style={{ fontSize: 15 }}>Catch dogs ({groupSetup.catchIds.length}/{groupHuntLimit(state.fame || 0).catch})</h3>
                    <div className="kg-grid" style={{ marginBottom: 18 }}>
                      {huntableDogs.map((dog) => {
                        const picked = groupSetup.catchIds.includes(dog.id);
                        const takenByBay = groupSetup.bayIds.includes(dog.id);
                        const disabled = !picked && (takenByBay || groupSetup.catchIds.length >= groupHuntLimit(state.fame || 0).catch);
                        return (
                          <DogCard key={dog.id} dog={dog} onView={setViewDog}
                            footer={<>
                              <RoleBadge label="Catch" value={catchSuitability(dog)} />
                              <button className={"kg-btn kg-btn--sm " + (picked ? "" : "kg-btn--ghost")} disabled={disabled}
                                onClick={() => toggleCatchPick(dog.id)}>{picked ? "✓ Catch dog" : takenByBay ? "Already a bay dog" : "Add as catch dog"}</button>
                            </>} />
                        );
                      })}
                    </div>
                    <button className="kg-btn kg-btn--gold" disabled={groupSetup.bayIds.length < 1 || groupSetup.catchIds.length < 1} onClick={doStartGroupHunt}>
                      {groupSetup.bayIds.length < 1 ? "Pick at least 1 bay dog" : groupSetup.catchIds.length < 1 ? "Pick at least 1 catch dog" : "Head out"}
                    </button>
                  </>
                )}
              </>
            )}
            {groupHunt && groupHunt.phase === "searching" && (
              <div className="kg-huntsession">
                <p className="kg-note">🔎 Your bay dogs are working the ground — the hog's exact location is still unknown.</p>
                <HuntMap zones={HUNT_ZONES} dogZones={groupHunt.dogZones} dogsById={groupHunt.dogsById}
                  bayDogIds={groupHunt.bayDogIds} catchDogIds={groupHunt.catchDogIds} hogZoneKey={null} phase={groupHunt.phase} />
              </div>
            )}
            {groupHunt && groupHunt.phase === "bayed" && (
              <BayedEventModal hog={groupHunt.hog} bayDogs={groupHunt.bayDogIds.map((id) => groupHunt.dogsById[id])}
                zoneLabel={(HUNT_ZONES.find((z) => z.key === groupHunt.hog.zoneKey) || {}).label}
                onRelease={doReleaseCatchDogs} onCallOff={doCallOffGroupHunt} />
            )}
            {groupHunt && groupHunt.phase === "traveling" && (
              <div className="kg-huntsession">
                <p className="kg-note">🐾 Catch dogs are closing in on the bayed hog.</p>
                <HuntMap zones={HUNT_ZONES} dogZones={groupHunt.dogZones} dogsById={groupHunt.dogsById}
                  bayDogIds={groupHunt.bayDogIds} catchDogIds={groupHunt.catchDogIds} hogZoneKey={groupHunt.hog.zoneKey} phase={groupHunt.phase} />
                {/* Skipping just pushes travelTicks to the cap and lets the
                    next tick's stepTravel do the transition, so the button
                    reflects that queued state instead of looking dead for a
                    tick. */}
                <button className="kg-btn kg-btn--ghost kg-btn--sm" disabled={groupHunt.travelTicks >= TRAVEL_TICKS}
                  onClick={() => setGroupHunt((p) => (p ? { ...p, travelTicks: TRAVEL_TICKS } : p))}>
                  {groupHunt.travelTicks >= TRAVEL_TICKS ? "Closing in…" : "Skip ahead"}
                </button>
              </div>
            )}
            {groupHunt && groupHunt.phase === "catching" && (
              <CatchMiniGame miniGame={groupHunt.miniGame} onTap={doMiniGameTap} />
            )}
            {groupHunt && groupHunt.phase === "results" && (
              <div className="kg-huntresult">
                {groupHunt.result && groupHunt.result.calledOff ? (
                  <p>Called the pack off — no risk taken, and {fmtMoney(groupHunt.result.payout)} for finding and holding the hog.</p>
                ) : groupHunt.result && groupHunt.result.caught ? (
                  <>
                    <h2 className="kg-subhead">🐗 HOG CAUGHT!</h2>
                    <p>Hog: {groupHunt.result.hog.weightLbs}lb ({groupHunt.result.hog.tier})</p>
                    <p className="kg-note">Bay dogs: {groupHunt.result.bayDogs.map((d) => d.name).join(", ")}</p>
                    <p className="kg-note">Catch dogs: {groupHunt.result.catchDogs.map((d) => d.name).join(", ")}</p>
                    <p>Hunt Performance: {groupHunt.result.performancePct}%</p>
                    <p>Reward: {fmtMoney(groupHunt.result.payout)}</p>
                  </>
                ) : (
                  <>
                    <h2 className="kg-subhead">HOG GOT AWAY!</h2>
                    <p>The hog fought free before the catch dogs could finish it.</p>
                  </>
                )}
                <button className="kg-btn" onClick={doEndGroupHuntSession}>Back to the kennel</button>
              </div>
            )}
          </section>
        )}
        {tab === "breed" && (
          <section>
            <h2 className="kg-subhead">Pick a pair</h2>
            {(breedableM.length === 0 || breedableF.length === 0) ? (
              <p className="kg-empty">Need at least one male and one female of breeding age (10mo+), healthy, and off cooldown.</p>
            ) : (
              <>
                <div className="kg-pairpick">
                  <select value={breedPick.sireId || ""} onChange={(e) => setBreedPick((p) => ({ ...p, sireId: e.target.value }))}>
                    <option value="">Choose sire (♂)</option>
                    {breedableM.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.breed}, {colorLabel(d.colorGenes)} ({overallRating(d.stats)}){d.registered ? " · papers" : ""}</option>)}
                  </select>
                  <select value={breedPick.damId || ""} onChange={(e) => setBreedPick((p) => ({ ...p, damId: e.target.value }))}>
                    <option value="">Choose dam (♀)</option>
                    {breedableF.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.breed}, {colorLabel(d.colorGenes)} ({overallRating(d.stats)}){d.registered ? " · papers" : ""}</option>)}
                  </select>
                </div>
                {sire && dam && (
                  <div className="kg-preview">
                    <h3>Expected litter</h3>
                    <p className="kg-card__breed">{sire.breed === dam.breed ? sire.breed : (isBandogPair(sire.breed, dam.breed) || isBandogBreed(sire.breed) || isBandogBreed(dam.breed)) ? generateBandogName(sire, dam) : generateMixName(sire.breed, dam.breed)}</p>
                    <p className="kg-note">Expected size: ~{Math.round((sire.heightIn + dam.heightIn) / 2)}in, ~{Math.round((sire.weightLb + dam.weightLb) / 2)}lb.</p>
                    {isInbred(sire, dam) && <p className="kg-warn">These two share a parent — expect inbreeding depression in the litter.</p>}
                    {bothMerleCarriers && <p className="kg-warn">⚠ Both carry the merle gene — about 1 in 4 pups will be double merle, risking deafness or vision loss.</p>}
                    {sire && dam && (isBandogPair(sire.breed, dam.breed) || isBandogBreed(sire.breed) || isBandogBreed(dam.breed)) ? (
                      <p className="kg-warn" style={{ color: "var(--gold)" }}>⭐ This pairing makes a {generateBandogName(sire, dam)} — bigger, stronger, and faster than either parent, with a real size and power bonus.</p>
                    ) : sire.breed !== dam.breed && <p className="kg-note">Different breeds — pups get a hybrid-vigor bonus on a couple of stats.</p>}
                    {inheritedBloodline && <p className="kg-note">Pups will carry the {sire.bloodline || dam.bloodline} bloodline.</p>}
                    {canFoundBloodline && (
                      <div style={{ margin: "10px 0" }}>
                        <label className="kg-hint" style={{ display: "block", marginBottom: 4 }}>Both parents are papered and unbred into a line yet — found a new bloodline (optional):</label>
                        <input type="text" placeholder="e.g. Sundown Red Line" value={newBloodline} maxLength={24} onChange={(e) => setNewBloodline(e.target.value)} style={{ width: "100%", fontSize: 13.5, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--paper-dark)", color: "var(--ink)" }} />
                      </div>
                    )}
                    <div className="kg-card__stats">
                      {STAT_KEYS.map((k) => <StatBar key={k} label={STAT_LABELS[k] + " (avg, will vary)"} value={Math.round((sire.stats[k] + dam.stats[k]) / 2)} />)}
                    </div>
                    {kennelFull && <p className="kg-notice">Kennel's full ({state.dogs.length}/{dogCapacity}) — any pups would go straight to pet homes at half value. Buy more land in the Property tab first.</p>}
                    <button className="kg-btn" disabled={kennelFull} onClick={doBreed}>Breed {sire.name} × {dam.name}</button>
                  </div>
                )}
              </>
            )}

            <hr className="kg-divider" />
            <h2 className="kg-subhead">Stud service — other kennels' dogs</h2>
            <p className="kg-hint">ℹ Pay a one-time fee to breed one of your dams to a stud from another kennel. Pups keep your dam's bloodline if she has one.</p>
            {breedableF.length === 0 ? <p className="kg-empty">You need a healthy dam of breeding age to use a stud.</p> : (
              <div className="kg-pairpick">
                <select value={studDamId || ""} onChange={(e) => setStudDamId(e.target.value)}>
                  <option value="">Choose your dam (♀)</option>
                  {breedableF.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.breed}, {colorLabel(d.colorGenes)} ({overallRating(d.stats)})</option>)}
                </select>
              </div>
            )}
            {studs.length === 0 ? <p className="kg-empty">No studs available right now — check back after a day passes.</p> : (
              <div className="kg-rows">
                {studs.map((stud) => (
                  <DogRow key={stud.id} dog={stud} onView={setViewDog} sellerName={"out of " + stud.kennelName}
                    right={<button className="kg-btn kg-btn--sm" disabled={!studDam || state.cash < studFee(stud) || kennelFull} onClick={() => doStudService(studDam, stud)}>
                      {kennelFull ? "Kennel full" : !studDam ? "Pick a dam first" : state.cash < studFee(stud) ? "Can't afford" : `Book — ${fmtMoney(studFee(stud))}`}
                    </button>} />
                ))}
              </div>
            )}

            <hr className="kg-divider" />
            <h2 className="kg-subhead">Player stud board — real kennels, split litters</h2>
            <p className="kg-hint">ℹ Offer one of your males for stud, or request a breeding against another kennel's. The litter is split between both kennels — whichever parent rates higher gets the better half of the pups.</p>
            {!session && <p className="kg-notice">Sign in (top right) to use the stud board.</p>}
            {studMsg && <p className="kg-note">{studMsg}</p>}
            {session && (
              <React.Fragment>
                <h3 className="kg-subhead" style={{ fontSize: 14 }}>Offer a stud</h3>
                {breedableM.length === 0 ? <p className="kg-empty">No male fit for stud right now.</p> : (
                  <div className="kg-pairpick">
                    <select value={studPick.dogId || ""} onChange={(e) => setStudPick((p) => ({ ...p, dogId: e.target.value }))}>
                      <option value="">Choose your male</option>
                      {breedableM.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.breed} ({overallRating(d.stats)})</option>)}
                    </select>
                    <input type="number" min="0" placeholder="Stud fee (optional)" style={{ maxWidth: 160 }}
                      value={studPick.fee} onChange={(e) => setStudPick((p) => ({ ...p, fee: e.target.value }))} />
                    <button className="kg-btn kg-btn--sm" disabled={!studPick.dogId} onClick={() => postStudOffer(studPick.dogId, studPick.fee)}>List for Stud</button>
                  </div>
                )}
                {studOffers.some((o) => o.owner_id === session.user.id) && (
                  <ul className="kg-log" style={{ marginBottom: 16 }}>
                    {studOffers.filter((o) => o.owner_id === session.user.id).map((o) => (
                      <li key={o.id} className="kg-logrow">
                        <span>{o.dog.name} — stud fee {fmtMoney(o.fee)}</span>
                        <button className="kg-btn kg-btn--ghost kg-btn--sm" style={{ width: "auto" }} onClick={() => cancelStudOffer(o)}>Cancel</button>
                      </li>
                    ))}
                  </ul>
                )}

                {incomingStudRequests.length > 0 && (
                  <React.Fragment>
                    <h3 className="kg-subhead" style={{ fontSize: 14 }}>Incoming requests on your studs</h3>
                    <ul className="kg-log" style={{ marginBottom: 16 }}>
                      {incomingStudRequests.map((r) => (
                        <li key={r.id} className="kg-logrow">
                          <span>{r.requester_name} wants {r.stud.name} × their {r.dam.name} ({overallRating(r.dam.stats)} overall)</span>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="kg-btn kg-btn--sm" onClick={() => acceptStudRequestAction(r)}>Accept &amp; Whelp</button>
                            <button className="kg-btn kg-btn--ghost kg-btn--sm" style={{ width: "auto" }} onClick={() => declineStudRequest(r)}>Decline</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </React.Fragment>
                )}

                <h3 className="kg-subhead" style={{ fontSize: 14 }}>Studs from other kennels</h3>
                {studOffers.filter((o) => o.owner_id !== session.user.id).length === 0 ? (
                  <p className="kg-empty">No player studs listed right now.</p>
                ) : (
                  <div className="kg-grid">
                    {studOffers.filter((o) => o.owner_id !== session.user.id).map((o) => (
                      <DogCard key={o.id} dog={o.dog} onView={setViewDog} price={o.fee} sellerName={"out of " + o.owner_name}
                        footer={breedableF.length === 0 ? <span className="kg-empty">Need a breedable dam</span> : (
                          <div style={{ display: "flex", gap: 6 }}>
                            <select value={requestDamPick[o.id] || ""} onChange={(e) => setRequestDamPick((p) => ({ ...p, [o.id]: e.target.value }))}>
                              <option value="">Your dam</option>
                              {breedableF.map((d) => <option key={d.id} value={d.id}>{d.name} ({overallRating(d.stats)})</option>)}
                            </select>
                            <button className="kg-btn kg-btn--sm" disabled={!requestDamPick[o.id] || state.cash < o.fee} onClick={() => requestStud(o, requestDamPick[o.id])}>Request</button>
                          </div>
                        )} />
                    ))}
                  </div>
                )}

                {myStudRequests.length > 0 && (
                  <React.Fragment>
                    <h3 className="kg-subhead" style={{ fontSize: 14 }}>Your requests</h3>
                    <ul className="kg-log">
                      {myStudRequests.map((r) => (
                        <li key={r.id} className="kg-logrow">
                          <span>
                            {r.dam.name} × {r.stud.name} out of {r.owner_name} —{" "}
                            {r.status === "pending" ? "waiting on owner" : r.status === "declined" ? "declined" :
                              `done — you kept ${r.litter_summary?.requesterKept ?? "?"} of ${r.litter_summary?.total ?? "?"}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </React.Fragment>
                )}
              </React.Fragment>
            )}
          </section>
        )}
        {tab === "trials" && (
          <section>
            <p className="kg-hint">ℹ These are real, legal dog sports — weight pulling, catch-dog course work, and treeing trials. Dogs are scored side by side, never set against each other.</p>
            <div className="kg-hunttypes">
              {Object.entries(TRIALS).map(([key, t]) => (
                <button key={key} className={"kg-trialcard " + (trialPick.trial === key ? "kg-trialcard--active" : "")} onClick={() => setTrialPick((p) => ({ ...p, trial: key }))}>
                  <strong>{t.label}</strong><span>{t.desc}</span>
                </button>
              ))}
            </div>
            <h2 className="kg-subhead">Your entrant</h2>
            {huntableDogs.length === 0 ? <p className="kg-empty">No dog is fit to compete right now.</p> : (
              <div className="kg-pairpick">
                <select value={trialPick.dogId || ""} onChange={(e) => setTrialPick((p) => ({ ...p, dogId: e.target.value }))}>
                  <option value="">Choose your dog</option>
                  {huntableDogs.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.breed} ({overallRating(d.stats)})</option>)}
                </select>
              </div>
            )}
            {(() => {
              const myDog = state.dogs.find((d) => d.id === trialPick.dogId);
              const fee = myDog ? Math.round(trialPurse(myDog, myDog) * 0.3) : 0;
              const standing = state.entries || [];
              return (
                <>
                  {myDog && (
                    <div className="kg-enterbar">
                      <div>
                        <strong>{myDog.name}</strong>
                        <span className="kg-enterbar__meta">
                          Entry {fmtMoney(fee)} · costs {ENERGY_COST.trial} energy · {energyOf(myDog)} left today
                        </span>
                      </div>
                      <button className="kg-btn kg-btn--gold"
                        onClick={() => {
                          const res = enterTrial(myDog, trialPick.trial);
                          setEnterMsg(res.ok
                            ? { tone: "success", text: `${myDog.name} is entered. Results tomorrow.` }
                            : { tone: "error", text: res.why });
                        }}>
                        Enter the {(TRIALS[trialPick.trial] || {}).label}
                      </button>
                    </div>
                  )}

                  {enterMsg && (
                    <Notice tone={enterMsg.tone} onDismiss={() => setEnterMsg(null)}>{enterMsg.text}</Notice>
                  )}

                  <h2 className="kg-subhead">Standing entries</h2>
                  {standing.length === 0 ? (
                    <p className="kg-empty">
                      Nothing entered. Trials are judged the day after you enter — put a dog in, then go
                      hunt or rest, and the results are waiting when the day turns.
                    </p>
                  ) : (
                    <div className="kg-rows">
                      {standing.map((e) => (
                        <div key={e.id} className="kg-enterrow">
                          <span>
                            <strong>{e.dogName}</strong> — {(TRIALS[e.trial] || {}).label}
                            <span className="kg-enterbar__meta">judged on day {e.resolvesDay}</span>
                          </span>
                          <button className="kg-btn kg-btn--sm" onClick={() => withdrawEntry(e.id)}>Withdraw</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <h2 className="kg-subhead">Who else is running</h2>
                  <p className="kg-hint">
                    The field this week. You are judged against one of them, drawn when the results are read.
                  </p>
                  {competitors.length === 0 ? (
                    <p className="kg-empty">No competitors available right now — check back after a day passes.</p>
                  ) : (
                    <div className="kg-rows">
                      {competitors.slice(0, 8).map((opp) => (
                        <DogRow key={opp.id} dog={opp} onView={setViewDog} sellerName={"out of " + opp.kennelName} />
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </section>
        )}
    </>
  );
}
