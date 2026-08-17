/* Profile, settings, account management and the admin panel.

   Split out of game.jsx, which carried every screen inline in one
   3,200-line component. The JSX is unchanged — only its home moved.

   Everything a screen needs arrives on one `game` object rather than
   through a long prop list: these are sections of a single stateful
   component, not reusable pieces with an interface worth designing. The
   destructure below is the honest record of what this file depends on. */
function AccountScreens({ game }) {
  const { accountBusy, accountMsg, adminAddCash, adminAdvance, adminApply, adminClearFlag,
    adminCodeDraft, adminHealAll, adminLock, adminMaxStats, adminRegisterAll, adminSetFame,
    adminSpawnDog, adminSpawnStock, adminTarget, adminUnlock, adminUnlockAll, adminUnlocked,
    avatarInputRef, bioDraft, changePassword, cloudStatus, deleteAccount, deleteConfirm,
    exportSave, handleAvatarFile, handleSignOut, importInputRef, importSave, layout, loading,
    netWorth, newPassword, profile, resetConfirm, resetKennel, saveProfile, saveUsername,
    session, setAdminCodeDraft, setAdminTarget, setBioDraft, setCloudPanelOpen,
    setDeleteConfirm, setLayout, setNewPassword, setResetConfirm, setTheme, setUsernameDraft,
    signOutEverywhere, state, tab, theme, tick, usernameDraft } = game;
  return (
    <>
        {tab === "admin" && adminUnlocked && (
          <section>
            <h2 className="kg-subhead">Admin</h2>
            <p className="kg-hint">
              Testing tools. Everything here writes straight into your save.
            </p>

            {state[ADMIN_FLAG] && (
              <p className="kg-notice kg-notice--bad" style={{ margin: "0 0 20px" }}>
                This kennel has been edited with admin tools, so it's kept off the public
                leaderboard — otherwise handing yourself a million dollars would push real
                kennels down it. Clear the flag below once you're done testing.
              </p>
            )}
            {accountMsg && (
              <p className={"kg-notice " + (accountMsg.tone === "rust" ? "kg-notice--bad" : "kg-notice--good")}
                role="status" style={{ margin: "0 0 18px" }}>{accountMsg.text}</p>
            )}

            <h3 className="kg-subhead">Money</h3>
            <div className="kg-admin__row">
              {ADMIN_CASH_STEPS.map((n) => (
                <button key={n} className="kg-btn kg-btn--sm2" onClick={() => adminAddCash(n)}>+{fmtMoney(n)}</button>
              ))}
              <button className="kg-btn kg-btn--sm2 kg-btn--ghost" onClick={() => adminApply("Cash reset to $2,500.", (s) => ({ ...s, cash: 2500 }))}>Reset to $2,500</button>
            </div>

            <h3 className="kg-subhead">Time</h3>
            <div className="kg-admin__row">
              {ADMIN_DAY_STEPS.map((d) => (
                <button key={d} className="kg-btn kg-btn--sm2" onClick={() => adminAdvance(d)}>Skip {d} days</button>
              ))}
            </div>
            <p className="kg-acct__hint">Skipping runs the real day tick, so ageing, healing, deaths, seasons and the rival kennels all move with it.</p>

            <h3 className="kg-subhead">Animals</h3>
            <div className="kg-admin__row">
              <button className="kg-btn kg-btn--sm2" onClick={() => adminSpawnDog(false)}>Spawn a dog</button>
              <button className="kg-btn kg-btn--sm2 kg-btn--gold" onClick={() => adminSpawnDog(true)}>Spawn an elite dog</button>
              <button className="kg-btn kg-btn--sm2" onClick={() => adminSpawnStock("horse")}>Spawn a horse</button>
              <button className="kg-btn kg-btn--sm2" onClick={() => adminSpawnStock("cattle")}>Spawn cattle</button>
            </div>
            <div className="kg-admin__row" style={{ marginTop: 10 }}>
              <button className="kg-btn kg-btn--sm2" onClick={adminHealAll}>Heal everything</button>
              <button className="kg-btn kg-btn--sm2" onClick={adminRegisterAll}>Register every dog</button>
            </div>

            <div className="kg-acct__row" style={{ marginTop: 14 }}>
              <select className="kg-acct__input" value={adminTarget} onChange={(e) => setAdminTarget(e.target.value)}>
                <option value="">Pick a dog to max out…</option>
                {state.dogs.map((d) => <option key={d.id} value={d.id}>{d.name} — {breedShort(d.breed)} ({overallRating(d.stats)})</option>)}
              </select>
              <button className="kg-btn kg-btn--sm2" disabled={!adminTarget} onClick={() => adminMaxStats(adminTarget)}>Max stats</button>
            </div>

            <h3 className="kg-subhead">Progress</h3>
            <div className="kg-admin__row">
              <button className="kg-btn kg-btn--sm2" onClick={adminUnlockAll}>Unlock all kennel upgrades</button>
              <button className="kg-btn kg-btn--sm2" onClick={() => adminSetFame(300)}>Max fame</button>
              <button className="kg-btn kg-btn--sm2 kg-btn--ghost" onClick={() => adminSetFame(0)}>Reset fame</button>
            </div>

            <hr className="kg-divider" />

            <div className="kg-admin__row">
              {state[ADMIN_FLAG] && <button className="kg-btn kg-btn--sm2 kg-btn--ghost" onClick={adminClearFlag}>Clear the admin flag</button>}
              <button className="kg-btn kg-btn--sm2 kg-btn--danger" onClick={adminLock}>Lock admin and hide this tab</button>
            </div>
          </section>
        )}
        {(tab === "profile" || tab === "settings" || tab === "danger") && (
          <section>
            {!session ? (
              <>
                <h2 className="kg-subhead">Your account</h2>
                <p className="kg-hint">You're playing signed out, so this kennel lives only in this browser. Sign in and it follows you anywhere — and you get a name and face other players can see.</p>
                <button className="kg-btn kg-btn--gold" onClick={() => setCloudPanelOpen(true)}>Sign in or create an account</button>

                {accountMsg && (
                  <p className={"kg-notice " + (accountMsg.tone === "rust" ? "kg-notice--bad" : "kg-notice--good")}
                    role="status" style={{ margin: "18px 0 0" }}>{accountMsg.text}</p>
                )}

                <hr className="kg-divider" />

                <h3 className="kg-subhead">Your save file</h3>
                <p className="kg-acct__hint" style={{ marginBottom: 12 }}>
                  Without an account this kennel exists only in this browser's storage — clearing
                  your history takes it with it. Download a copy and you can load it back any time,
                  here or on another machine.
                </p>
                <div className="kg-acct__row">
                  <button className="kg-btn kg-btn--sm2" onClick={exportSave}>Download my save</button>
                  <input ref={importInputRef} type="file" accept="application/json,.json" hidden
                    onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) importSave(f); }} />
                  <button className="kg-btn kg-btn--sm2 kg-btn--ghost" onClick={() => importInputRef.current && importInputRef.current.click()}>Load a save file</button>
                </div>

                <hr className="kg-divider" />
                <h3 className="kg-subhead">Layout</h3>
                <p className="kg-acct__hint" style={{ marginBottom: 10 }}>
                  {(LAYOUTS.find((l) => l.id === layout) || {}).blurb} This is a preference on this
                  device — it doesn't touch your kennel, and you can flip back any time.
                </p>
                <div className="kg-acct__seg" style={{ display: "inline-flex" }}>
                  {LAYOUTS.map((l) => (
                    <button key={l.id} className={"kg-seg__btn " + (layout === l.id ? "kg-seg__btn--active" : "")}
                      onClick={() => setLayout(l.id)}>{l.label}</button>
                  ))}
                </div>

                <hr className="kg-divider" />
                <h3 className="kg-subhead">Access code</h3>
                {adminUnlocked ? (
                  <p className="kg-acct__hint">Admin tools are unlocked — the tab is up with Profile and Settings.</p>
                ) : (
                  <div className="kg-acct__row">
                    <input className="kg-acct__input" type="password" placeholder="Enter a code"
                      value={adminCodeDraft} onChange={(e) => setAdminCodeDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && adminUnlock()} />
                    <button className="kg-btn kg-btn--sm2" disabled={!adminCodeDraft.trim()} onClick={adminUnlock}>Unlock</button>
                  </div>
                )}
              </>
            ) : (
              <>
                {accountMsg && (
                  <p className={"kg-notice " + (accountMsg.tone === "rust" ? "kg-notice--bad" : "kg-notice--good")}
                    role="status" style={{ margin: "0 0 18px" }}>{accountMsg.text}</p>
                )}

                {tab === "profile" && (
                  <>
                    <h2 className="kg-subhead">Profile</h2>
                    <p className="kg-hint">This is what other players see next to your listings, challenges and leaderboard place. Your kennel name is separate — that's the in-game one, up in the header.</p>

                    <div className="kg-acct__identity">
                      <div className="kg-avatar kg-avatar--lg">
                        {profile && profile.avatar
                          ? <img src={profile.avatar} alt="Your profile picture" />
                          : <span>{initialsFor((profile && profile.username) || session.user.email)}</span>}
                      </div>
                      <div className="kg-acct__identityText">
                        <strong>{(profile && profile.username) || "No username yet"}</strong>
                        <span>{session.user.email}</span>
                        <div className="kg-acct__avatarBtns">
                          <input ref={avatarInputRef} type="file" accept="image/*" hidden
                            onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) handleAvatarFile(f); }} />
                          <button className="kg-btn kg-btn--sm2" disabled={accountBusy} onClick={() => avatarInputRef.current && avatarInputRef.current.click()}>
                            {profile && profile.avatar ? "Change picture" : "Upload a picture"}
                          </button>
                          {profile && profile.avatar && (
                            <button className="kg-btn kg-btn--sm2 kg-btn--ghost" disabled={accountBusy} onClick={() => saveProfile({ avatar: null })}>Remove</button>
                          )}
                        </div>
                        <p className="kg-acct__hint">Any image works — it gets cropped square and shrunk to 256px before it's saved.</p>
                      </div>
                    </div>

                    <hr className="kg-divider" />

                    <label className="kg-auth__label" htmlFor="kg-username">Username</label>
                    <div className="kg-acct__row">
                      <input id="kg-username" className="kg-acct__input" type="text" maxLength={24} placeholder="e.g. SundownRiley"
                        value={usernameDraft} onChange={(e) => setUsernameDraft(e.target.value)} />
                      <button className="kg-btn kg-btn--sm2" disabled={accountBusy || !usernameDraft.trim()} onClick={saveUsername}>Save</button>
                    </div>
                    <p className="kg-acct__hint">3–24 characters. Letters, numbers, spaces, dots, dashes and underscores.</p>

                    <label className="kg-auth__label" htmlFor="kg-bio" style={{ marginTop: 18 }}>About your kennel</label>
                    <textarea id="kg-bio" className="kg-acct__input kg-acct__textarea" rows={3} maxLength={280}
                      placeholder="What you breed for, where you run, how long you've been at it…"
                      value={bioDraft} onChange={(e) => setBioDraft(e.target.value)} />
                    <div className="kg-acct__row" style={{ marginTop: 8 }}>
                      <span className="kg-acct__hint" style={{ margin: 0 }}>{bioDraft.length} / 280</span>
                      <button className="kg-btn kg-btn--sm2" disabled={accountBusy} onClick={() => saveProfile({ bio: bioDraft.trim() || null })}>Save</button>
                    </div>

                    <hr className="kg-divider" />

                    <h3 className="kg-subhead">Your kennel at a glance</h3>
                    <div className="kg-ovstats">
                      <div className="kg-ovstat"><div className="kg-ovstat__label">Kennel</div><div className="kg-ovstat__value" style={{ fontSize: 16 }}>{state.kennelName}</div></div>
                      <div className="kg-ovstat"><div className="kg-ovstat__label">Day</div><div className="kg-ovstat__value">{state.day}</div></div>
                      <div className="kg-ovstat"><div className="kg-ovstat__label">Dogs</div><div className="kg-ovstat__value">{state.dogs.length}</div></div>
                      <div className="kg-ovstat"><div className="kg-ovstat__label">Net worth</div><div className="kg-ovstat__value" style={{ fontSize: 20 }}>{fmtMoney(netWorth)}</div></div>
                      <div className="kg-ovstat"><div className="kg-ovstat__label">Fame</div><div className="kg-ovstat__value" style={{ fontSize: 15 }}>{fameTier(state.fame || 0).label}</div></div>
                    </div>
                  </>
                )}

                {tab === "settings" && (
                  <>
                    <h2 className="kg-subhead">Settings</h2>
                    <p className="kg-hint">Preferences are remembered on this device.</p>

                    <div className="kg-acct__setting">
                      <div>
                        <strong>Appearance</strong>
                        <p className="kg-acct__hint">Night suits the sundown palette; day is easier in bright light.</p>
                      </div>
                      <div className="kg-acct__seg">
                        <button className={"kg-seg__btn " + (theme === "dark" ? "kg-seg__btn--active" : "")} onClick={() => setTheme("dark")}>Night</button>
                        <button className={"kg-seg__btn " + (theme === "light" ? "kg-seg__btn--active" : "")} onClick={() => setTheme("light")}>Day</button>
                      </div>
                    </div>

                    <div className="kg-acct__setting">
                      <div>
                        <strong>Layout</strong>
                        <p className="kg-acct__hint">
                          {(LAYOUTS.find((l) => l.id === layout) || {}).blurb} Switching is instant and
                          changes nothing about your kennel — flip back any time.
                        </p>
                      </div>
                      <div className="kg-acct__seg">
                        {LAYOUTS.map((l) => (
                          <button key={l.id} className={"kg-seg__btn " + (layout === l.id ? "kg-seg__btn--active" : "")}
                            onClick={() => setLayout(l.id)}>{l.label}</button>
                        ))}
                      </div>
                    </div>

                    <div className="kg-acct__setting">
                      <div>
                        <strong>Email</strong>
                        <p className="kg-acct__hint">{session.user.email}</p>
                      </div>
                      <span className="kg-badge kg-badge--olive">Signed in</span>
                    </div>

                    <div className="kg-acct__setting">
                      <div>
                        <strong>Cloud sync</strong>
                        <p className="kg-acct__hint">Your kennel saves automatically. Status: {cloudStatus}.</p>
                      </div>
                    </div>

                    <div className="kg-acct__setting">
                      <div>
                        <strong>Show me on the leaderboard</strong>
                        <p className="kg-acct__hint">Turn this off and your kennel stops appearing in the public rankings. You can still trade and take challenges.</p>
                      </div>
                      <div className="kg-acct__seg">
                        <button className={"kg-seg__btn " + ((!profile || profile.show_on_leaderboard !== false) ? "kg-seg__btn--active" : "")}
                          disabled={accountBusy} onClick={() => saveProfile({ show_on_leaderboard: true })}>Public</button>
                        <button className={"kg-seg__btn " + ((profile && profile.show_on_leaderboard === false) ? "kg-seg__btn--active" : "")}
                          disabled={accountBusy} onClick={() => saveProfile({ show_on_leaderboard: false })}>Hidden</button>
                      </div>
                    </div>

                    <hr className="kg-divider" />

                    <h3 className="kg-subhead">Change password</h3>
                    <div className="kg-acct__row">
                      <input className="kg-acct__input" type="password" autoComplete="new-password" placeholder="New password (6+ characters)"
                        value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                      <button className="kg-btn kg-btn--sm2" disabled={accountBusy || !newPassword} onClick={changePassword}>Update</button>
                    </div>

                    <hr className="kg-divider" />

                    <h3 className="kg-subhead">Your save file</h3>
                    <p className="kg-acct__hint" style={{ marginBottom: 12 }}>
                      A save is a plain text file. Download one before you reset or delete anything —
                      loading it back is the only way to undo either.
                    </p>
                    <div className="kg-acct__row">
                      <button className="kg-btn kg-btn--sm2" onClick={exportSave}>Download my save</button>
                      <input ref={importInputRef} type="file" accept="application/json,.json" hidden
                        onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) importSave(f); }} />
                      <button className="kg-btn kg-btn--sm2 kg-btn--ghost" onClick={() => importInputRef.current && importInputRef.current.click()}>Load a save file</button>
                    </div>

                    <hr className="kg-divider" />

                    <div className="kg-acct__row">
                      <button className="kg-btn kg-btn--ghost" onClick={handleSignOut}>Sign out</button>
                      <button className="kg-btn kg-btn--ghost" disabled={accountBusy} onClick={signOutEverywhere}>Sign out everywhere</button>
                    </div>
                    <p className="kg-acct__hint">Signing out everywhere ends your session on every device — worth doing if you've played on a shared or lost one.</p>

                    <hr className="kg-divider" />
                    <h3 className="kg-subhead">Access code</h3>
                    {adminUnlocked ? (
                      <p className="kg-acct__hint">Admin tools are unlocked — the tab is up with Profile and Settings.</p>
                    ) : (
                      <>
                        <div className="kg-acct__row">
                          <input className="kg-acct__input" type="password" placeholder="Enter a code"
                            value={adminCodeDraft} onChange={(e) => setAdminCodeDraft(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && adminUnlock()} />
                          <button className="kg-btn kg-btn--sm2" disabled={!adminCodeDraft.trim()} onClick={adminUnlock}>Unlock</button>
                        </div>
                        <p className="kg-acct__hint">If you've been given a code, this is where it goes.</p>
                      </>
                    )}
                  </>
                )}

                {tab === "danger" && (
                  <>
                    <h2 className="kg-subhead">Account</h2>
                    <p className="kg-hint">Signed in as {session.user.email}. Download a save first — neither of these can be undone without one.</p>

                    <div className="kg-danger kg-danger--warn">
                      <h3>Start a new kennel</h3>
                      <p>
                        Wipes this kennel and drops you back at the beginning with a fresh pair of
                        dogs. Your account, username and profile picture all stay — it's only the
                        kennel that goes.
                      </p>
                      <label className="kg-auth__label" htmlFor="kg-reset">Type <b>RESET</b> to confirm</label>
                      <input id="kg-reset" className="kg-acct__input" type="text" placeholder="RESET"
                        value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} />
                      <button className="kg-btn kg-btn--sm2" style={{ marginTop: 12 }}
                        disabled={resetConfirm !== "RESET"} onClick={resetKennel}>
                        Start over with a new kennel
                      </button>
                    </div>

                    <div className="kg-danger">
                      <h3>Delete your account</h3>
                      <p>
                        This removes your account, your kennel, every dog and bloodline in it, your
                        profile, and anything you've listed or posted to other players. It cannot be
                        undone and there's no backup.
                      </p>
                      <label className="kg-auth__label" htmlFor="kg-del">Type <b>DELETE</b> to confirm</label>
                      <input id="kg-del" className="kg-acct__input" type="text" placeholder="DELETE"
                        value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} />
                      <button className="kg-btn kg-btn--danger" style={{ marginTop: 12 }}
                        disabled={accountBusy || deleteConfirm !== "DELETE"} onClick={deleteAccount}>
                        {accountBusy ? "Deleting…" : "Delete my account permanently"}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        )}
    </>
  );
}
