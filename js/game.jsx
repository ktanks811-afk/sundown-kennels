/* The main game component: all state, the day tick, every player action
   (hunting, breeding, trials, market, store, rescue), the Supabase
   multiplayer layer (trade, rivals, leaderboard), and the tab screens. */

function KennelGame() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [shopCat, setShopCat] = useState("feed");
  const [itemTargets, setItemTargets] = useState({});
  const [theme, setTheme] = useState(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
    return (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark";
  });

  // Theme lives on <html> so the loading screen and onboarding pick it up too.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { window.localStorage.setItem(THEME_KEY, theme); } catch {}
  }, [theme]);
  const [saveError, setSaveError] = useState(false);
  const [storageMode, setStorageMode] = useState("local");
  const [huntPick, setHuntPick] = useState({ dogId: null, hunt: "hog" });
  const [groupHuntPicks, setGroupHuntPicks] = useState([]);
  const [viewDog, setViewDog] = useState(null);
  const [trialPick, setTrialPick] = useState({ dogId: null, trial: "weightpull" });
  const [breedPick, setBreedPick] = useState({ sireId: null, damId: null });
  const [newBloodline, setNewBloodline] = useState("");
  const [studDamId, setStudDamId] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [filters, setFilters] = useState({ breed: "all", sex: "all", maxPrice: "", minStars: "0", sort: "priceAsc" });
  const [kennelSearch, setKennelSearch] = useState("");

  const [session, setSession] = useState(null);
  const [cloudStatus, setCloudStatus] = useState("idle"); // idle | loading | syncing | synced | error
  const [cloudPanelOpen, setCloudPanelOpen] = useState(false);
  const [authMode, setAuthMode] = useState("signin"); // signin | signup
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMsg, setAuthMsg] = useState("");
  const cloudTimer = useRef(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      setState(raw ? migrateState(JSON.parse(raw)) : null);
      setStorageMode("local");
    } catch { setState(null); setStorageMode("memory"); }
    setLoading(false);
  }, []);

  // Cloud auth: track the Supabase session so we know whose kennel to sync.
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: listener } = sb.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => listener?.subscription?.unsubscribe();
  }, []);

  // On sign-in, pull the player's cloud kennel if one exists; otherwise
  // push whatever's currently loaded (local save, or nothing) up as the
  // first cloud copy.
  useEffect(() => {
    if (!session) { setCloudStatus("idle"); return; }
    let cancelled = false;
    setCloudStatus("loading");
    sb.from("kennels").select("state").eq("user_id", session.user.id).maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setCloudStatus("error"); return; }
        if (data && data.state) {
          const migrated = migrateState(data.state);
          setState(migrated);
          try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch {}
          setCloudStatus("synced");
        } else if (state) {
          pushToCloud(state);
        } else {
          setCloudStatus("synced");
        }
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [session]);

  const pushToCloud = useCallback((next) => {
    if (!session) return;
    setCloudStatus("syncing");
    sb.from("kennels").upsert({ user_id: session.user.id, state: next }, { onConflict: "user_id" })
      .then(({ error }) => setCloudStatus(error ? "error" : "synced"));
  }, [session]);

  const persist = useCallback((next) => {
    if (storageMode === "local") {
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setSaveError(false); }
      catch { setSaveError(true); }
    }
    if (session) {
      clearTimeout(cloudTimer.current);
      cloudTimer.current = setTimeout(() => pushToCloud(next), 800);
    }
  }, [storageMode, session, pushToCloud]);

  const handleAuthSubmit = useCallback(async (e) => {
    e.preventDefault();
    setAuthMsg("");
    const creds = { email: authEmail, password: authPassword };
    const { error } = authMode === "signin" ? await sb.auth.signInWithPassword(creds) : await sb.auth.signUp(creds);
    if (error) setAuthMsg(error.message);
    else if (authMode === "signup") setAuthMsg("Check your email to confirm your account, then sign in.");
    else { setAuthMsg(""); setCloudPanelOpen(false); setAuthPassword(""); }
  }, [authMode, authEmail, authPassword]);

  const handleSignOut = useCallback(() => { sb.auth.signOut(); setCloudPanelOpen(false); }, []);

  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [pvpListings, setPvpListings] = useState([]);
  const [sellPick, setSellPick] = useState({ dogId: null, price: "" });
  const [pvpMsg, setPvpMsg] = useState("");
  const [openChallenges, setOpenChallenges] = useState([]);
  const [myChallenges, setMyChallenges] = useState([]);
  const [challengePick, setChallengePick] = useState({ dogId: null, trial: "weightpull" });
  const [acceptPick, setAcceptPick] = useState({});
  const [rivalsMsg, setRivalsMsg] = useState("");

  // Pull our own kennel row fresh from Supabase after a cross-player action
  // (buy, sell, challenge) changes it server-side, and keep localStorage's
  // cache in sync too — without re-triggering another push back to cloud.
  const refreshFromCloud = useCallback(() => {
    if (!session) return;
    sb.from("kennels").select("state").eq("user_id", session.user.id).maybeSingle().then(({ data }) => {
      if (data && data.state) {
        setState(data.state);
        try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data.state)); } catch {}
      }
    });
  }, [session]);

  const loadLeaderboard = useCallback(() => {
    sb.from("leaderboard").select("*").order("net_worth", { ascending: false }).limit(50)
      .then(({ data }) => setLeaderboardRows(data || []));
  }, []);
  const loadListings = useCallback(() => {
    sb.from("market_listings").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(60)
      .then(({ data }) => setPvpListings(data || []));
  }, []);
  const loadChallenges = useCallback(() => {
    sb.from("challenges").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(60)
      .then(({ data }) => setOpenChallenges(data || []));
    if (session) {
      sb.from("challenges").select("*")
        .eq("status", "completed")
        .or(`creator_id.eq.${session.user.id},opponent_id.eq.${session.user.id}`)
        .order("resolved_at", { ascending: false }).limit(20)
        .then(({ data }) => setMyChallenges(data || []));
    }
  }, [session]);

  useEffect(() => { loadLeaderboard(); loadListings(); loadChallenges(); }, [loadLeaderboard, loadListings, loadChallenges]);

  // Realtime: live-refresh the marketplace and challenge boards for every
  // connected player whenever anyone lists/buys/challenges/accepts.
  useEffect(() => {
    const channel = sb.channel("kennel-pvp")
      .on("postgres_changes", { event: "*", schema: "public", table: "market_listings" }, () => { loadListings(); refreshFromCloud(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "challenges" }, () => { loadChallenges(); refreshFromCloud(); })
      .subscribe();
    return () => sb.removeChannel(channel);
  }, [loadListings, loadChallenges, refreshFromCloud]);

  const update = useCallback((fn) => {
    setState((prev) => {
      let next = fn(prev);
      const nw = kennelNetWorth(next);
      const hist = next.netWorthHistory || [];
      const last = hist[hist.length - 1];
      if (!last || last.day !== next.day) next = { ...next, netWorthHistory: [...hist, { day: next.day, netWorth: nw }].slice(-60) };
      else next = { ...next, netWorthHistory: [...hist.slice(0, -1), { day: next.day, netWorth: nw }] };
      persist(next);
      return next;
    });
  }, [persist]);

  const listDogForSale = useCallback((dogId, price) => {
    if (!session) { setPvpMsg("Sign in to list a dog."); return; }
    const dog = state.dogs.find((d) => d.id === dogId);
    if (!dog) return;
    const p = Math.round(Number(price));
    if (!p || p <= 0) { setPvpMsg("Enter a valid price."); return; }
    update((prev) => ({ ...prev, dogs: prev.dogs.filter((d) => d.id !== dogId) }));
    sb.from("market_listings").insert({ seller_id: session.user.id, seller_name: state.kennelName, dog, price: p })
      .then(({ error }) => {
        if (error) { setPvpMsg(error.message); update((prev) => ({ ...prev, dogs: [...prev.dogs, dog] })); }
        else { setPvpMsg(`Listed ${dog.name} for ${fmtMoney(p)}.`); setSellPick({ dogId: null, price: "" }); loadListings(); }
      });
  }, [session, state, update, loadListings]);

  const cancelListing = useCallback((listing) => {
    sb.from("market_listings").update({ status: "cancelled" }).eq("id", listing.id).eq("seller_id", session?.user?.id)
      .then(({ error }) => {
        if (!error) { update((prev) => ({ ...prev, dogs: [...prev.dogs, listing.dog] })); loadListings(); }
        else setPvpMsg(error.message);
      });
  }, [session, update, loadListings]);

  const buyListing = useCallback((listing) => {
    if (!session) { setPvpMsg("Sign in to buy."); return; }
    setPvpMsg("Buying…");
    sb.rpc("purchase_listing", { p_listing_id: listing.id }).then(({ error }) => {
      if (error) setPvpMsg(error.message);
      else { setPvpMsg(`Bought ${listing.dog.name}!`); refreshFromCloud(); loadListings(); }
    });
  }, [session, refreshFromCloud, loadListings]);

  const createChallenge = useCallback((dogId, trial) => {
    if (!session) { setRivalsMsg("Sign in to post a challenge."); return; }
    const dog = state.dogs.find((d) => d.id === dogId);
    if (!dog) return;
    sb.from("challenges").insert({ creator_id: session.user.id, creator_name: state.kennelName, trial, dog })
      .then(({ error }) => {
        if (error) setRivalsMsg(error.message);
        else { setRivalsMsg("Challenge posted."); setChallengePick({ dogId: null, trial }); loadChallenges(); }
      });
  }, [session, state, loadChallenges]);

  const cancelChallenge = useCallback((challenge) => {
    sb.from("challenges").update({ status: "cancelled" }).eq("id", challenge.id).eq("creator_id", session?.user?.id)
      .then(({ error }) => { if (!error) loadChallenges(); else setRivalsMsg(error.message); });
  }, [session, loadChallenges]);

  const acceptChallengeAction = useCallback((challenge, dogId) => {
    if (!session) { setRivalsMsg("Sign in to accept a challenge."); return; }
    const dog = state.dogs.find((d) => d.id === dogId);
    if (!dog) return;
    setRivalsMsg("Resolving…");
    sb.rpc("accept_challenge", { p_challenge_id: challenge.id, p_dog: dog, p_opponent_name: state.kennelName }).then(({ data, error }) => {
      if (error) { setRivalsMsg(error.message); return; }
      const won = data && data.winner_id === session.user.id;
      setRivalsMsg(won ? `You won by ${Math.round(data.margin)}!` : `You lost this one — margin ${Math.round(data.margin)}.`);
      refreshFromCloud(); loadChallenges();
    });
  }, [session, state, refreshFromCloud, loadChallenges]);

  const cloudAuthEl = (
    <CloudAuthPanel
      session={session} cloudStatus={cloudStatus} open={cloudPanelOpen} onToggle={() => setCloudPanelOpen((v) => !v)}
      authMode={authMode} setAuthMode={setAuthMode} authEmail={authEmail} setAuthEmail={setAuthEmail}
      authPassword={authPassword} setAuthPassword={setAuthPassword} authMsg={authMsg}
      onSubmit={handleAuthSubmit} onSignOut={handleSignOut}
    />
  );

  const themeToggleEl = (
    <button
      className="kg-themetoggle"
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      title={theme === "dark" ? "Switch to daylight" : "Switch to night"}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
    >
      <span className="kg-themetoggle__icon">{theme === "dark" ? "☾" : "☀"}</span>
      <span className="kg-themetoggle__label">{theme === "dark" ? "Night" : "Day"}</span>
    </button>
  );

  if (loading) return <div className="kg-app kg-loading"><p>Opening the stud book…</p></div>;
  if (!state) {
    return <KennelSetup cloudAuth={cloudAuthEl} themeToggle={themeToggleEl} onComplete={(name, dogs) => {
      const fresh = initKennel(name, dogs);
      setState(fresh);
      persist(fresh);
    }} />;
  }

  function tick(prev, days, overrides = {}) {
    let next = { ...prev, day: prev.day + days };
    const up = prev.upgrades || {};
    const upkeepRate = up.feedSilo ? 3 : 4;
    const recovery = up.vetShed ? 7 : 4.5;
    const upkeep = prev.dogs.length * upkeepRate * days;
    next.cash = Math.round((prev.cash - upkeep) * 100) / 100;
    next.dogs = prev.dogs.map((d) => {
      const ov = overrides[d.id];
      let health = d.health + recovery * days;
      let cooldown = Math.max(0, d.breedCooldown - days);
      if (ov && typeof ov.healthDelta === "number") health = d.health + ov.healthDelta;
      if (ov && typeof ov.cooldownSet === "number") cooldown = ov.cooldownSet;
      return { ...d, ageDays: d.ageDays + days, health: clamp(health), breedCooldown: cooldown };
    });
    const { kennels, newListings, newCatches } = simulateAiWorld(prev.aiKennels, days, prev.day);
    next.aiKennels = kennels;
    next.market = [...prev.market, ...newListings].slice(-30);
    next.catches = [...prev.catches, ...newCatches].sort((a, b) => (b.weightLbs || b.payout) - (a.weightLbs || a.payout)).slice(0, 25);

    let offers = (prev.offers || []).filter((o) => o.expiresDay >= next.day);
    let social = prev.socialFeed || [];
    for (let step = 0; step < days; step++) {
      offers = offers.concat(rollNewOffers(next.dogs, prev.day + step + 1, offers.length));
      social = social.concat(rollSocialPosts(prev.kennelName, next.dogs, prev.fame || 0, social.length));
    }
    next.offers = offers.slice(-6);
    next.socialFeed = social.slice(-10);

    // The shelter turns over roughly every ten days.
    if (next.day - (prev.rescueRefreshedDay || 0) >= 10) {
      next.rescue = generateRescuePool(randInt(2, 4), next.day);
      next.rescueRefreshedDay = next.day;
    }
    return next;
  }

  function doHunt() {
    const dog = state.dogs.find((d) => d.id === huntPick.dogId);
    if (!dog) return;
    const hunt = HUNTS[huntPick.hunt];
    const result = resolveHunt(dog, huntPick.hunt);
    const weightLbs = catchWeight(huntPick.hunt, result.tier);
    const payout = huntPick.hunt === "hog" && weightLbs ? hogPayout(weightLbs) : result.payout;
    update((prev) => {
      let next = tick(prev, 1, { [dog.id]: { healthDelta: -result.healthLoss } });
      next.cash = Math.round(next.cash + payout);
      if (result.tier !== "Poor") {
        next.catches = [...next.catches, { id: genId(), day: prev.day + 1, kennelName: prev.kennelName, dogName: dog.name, breed: dog.breed, huntType: hunt.label, tier: result.tier, weightLbs, payout }]
          .sort((a, b) => (b.weightLbs || b.payout) - (a.weightLbs || a.payout)).slice(0, 25);
      }
      const msg = result.injured
        ? `${dog.name} came back hurt from the ${hunt.label.toLowerCase()} — ${result.tier.toLowerCase()} run, earned ${fmtMoney(payout)}, but took a beating.`
        : `${dog.name} put in a ${result.tier.toLowerCase()} run at the ${hunt.label.toLowerCase()}, earned ${fmtMoney(payout)}.`;
      return addLog(next, result.injured ? "injury" : "hunt", msg);
    });
  }

  function doGroupHunt(dogIds) {
    const dogs = state.dogs.filter((d) => dogIds.includes(d.id));
    if (dogs.length < 2) return;
    const avgStats = {};
    STAT_KEYS.forEach((k) => (avgStats[k] = dogs.reduce((s, d) => s + d.stats[k], 0) / dogs.length));
    const result = resolveHunt({ stats: avgStats }, "hog");
    const weightLbs = catchWeight("hog", result.tier, dogs.length);
    const payout = hogPayout(weightLbs);
    update((prev) => {
      const overrides = {};
      dogs.forEach((d) => (overrides[d.id] = { healthDelta: -result.healthLoss }));
      let next = tick(prev, 1, overrides);
      next.cash = Math.round(next.cash + payout);
      const names = dogs.map((d) => d.name).join(", ");
      if (result.tier !== "Poor") {
        next.catches = [...next.catches, { id: genId(), day: prev.day + 1, kennelName: prev.kennelName, dogName: `${names} (pack of ${dogs.length})`, breed: "Group Hunt", huntType: "Hog Hunt", tier: result.tier, weightLbs, payout }]
          .sort((a, b) => (b.weightLbs || b.payout) - (a.weightLbs || a.payout)).slice(0, 25);
      }
      const monster = weightLbs >= 700 ? " — a genuine monster hog!" : "";
      const msg = result.injured
        ? `The pack (${names}) ran down a ${weightLbs} lb hog — ${result.tier.toLowerCase()} run, earned ${fmtMoney(payout)}, but some of them took a beating.${monster}`
        : `The pack (${names}) ran down a ${weightLbs} lb hog — ${result.tier.toLowerCase()} run, earned ${fmtMoney(payout)}.${monster}`;
      return addLog(next, result.injured ? "injury" : "hunt", msg);
    });
    setGroupHuntPicks([]);
  }

  function doDeclineOffer(offerId) {
    update((prev) => ({ ...prev, offers: prev.offers.filter((o) => o.id !== offerId) }));
  }

  function doAcceptHuntOffer(offer) {
    const eligible = state.dogs.filter(canHunt);
    if (eligible.length === 0) return;
    const dog = eligible.slice().sort((a, b) => overallRating(b.stats) - overallRating(a.stats))[0];
    const result = resolveHunt(dog, "hog");
    const weightLbs = catchWeight("hog", result.tier);
    const payout = weightLbs ? Math.round(hogPayout(weightLbs) * 1.3) : Math.round(result.payout * 1.3);
    update((prev) => {
      let next = tick(prev, 1, { [dog.id]: { healthDelta: -result.healthLoss } });
      next.cash = Math.round(next.cash + payout);
      next.offers = next.offers.filter((o) => o.id !== offer.id);
      if (result.tier !== "Poor") {
        next.catches = [...next.catches, { id: genId(), day: prev.day + 1, kennelName: prev.kennelName, dogName: dog.name, breed: dog.breed, huntType: "Hog Hunt", tier: result.tier, weightLbs, payout }]
          .sort((a, b) => (b.weightLbs || b.payout) - (a.weightLbs || a.payout)).slice(0, 25);
      }
      const msg = result.injured
        ? `Hunted with ${offer.kennelName} — ${dog.name} came back hurt, ${result.tier.toLowerCase()} run, earned ${fmtMoney(payout)}.`
        : `Hunted with ${offer.kennelName} — ${dog.name} put in a ${result.tier.toLowerCase()} run, earned ${fmtMoney(payout)} (invited hunts pay a premium).`;
      return addLog(next, result.injured ? "injury" : "hunt", msg);
    });
  }

  function doAcceptPurchaseOffer(offer) {
    const dog = state.dogs.find((d) => d.id === offer.dogId);
    if (!dog) { doDeclineOffer(offer.id); return; }
    update((prev) => {
      const next = { ...prev, cash: Math.round(prev.cash + offer.price), dogs: prev.dogs.filter((d) => d.id !== offer.dogId), offers: prev.offers.filter((o) => o.id !== offer.id) };
      return addLog(next, "money", `${offer.buyerName} bought ${offer.dogName} for ${fmtMoney(offer.price)}.`);
    });
  }

  function doAcceptBreedingRequest(offer) {
    const target = state.dogs.find((d) => d.id === offer.targetDogId);
    if (!target) { doDeclineOffer(offer.id); return; }
    const sire = target.sex === "M" ? target : offer.requesterDog;
    const dam = target.sex === "F" ? target : offer.requesterDog;
    update((prev) => {
      const { pups, doubleMerleWarned, grewBiggerCount } = breedPuppies(sire, dam, prev.day + 1, target.bloodline || null);
      let next = tick(prev, 1, { [target.id]: { cooldownSet: 45, healthDelta: -14 } });
      next.cash = Math.round(next.cash + offer.fee);
      next.dogs = [...next.dogs, ...pups];
      next.offers = next.offers.filter((o) => o.id !== offer.id);
      const names = pups.map((p) => p.name).join(", ");
      let note = ` Paid a breeding fee of ${fmtMoney(offer.fee)}.`;
      if (doubleMerleWarned) note += " At least one double-merle pup — risk of deafness or vision problems.";
      if (grewBiggerCount) note += ` ${grewBiggerCount} pup${grewBiggerCount > 1 ? "s" : ""} threw a growth mutation.`;
      return addLog(next, "breed", `${offer.kennelName} bred their ${offer.requesterDog.name} with your ${target.name} — whelped ${pups.length}: ${names}.${note}`);
    });
  }

  function doTrial(myDog, oppDog) {
    const trial = TRIALS[trialPick.trial];
    const result = resolveTrial(myDog, oppDog, trialPick.trial);
    const purse = trialPurse(myDog, oppDog);
    const fameGain = result.won ? (trialPick.trial === "show" ? 5 : 2) : 0;
    update((prev) => {
      let next = tick(prev, 1, { [myDog.id]: { healthDelta: -result.healthLoss } });
      next.cash = Math.round(next.cash + (result.won ? purse : -Math.round(purse * 0.3)));
      /* Competing builds real muscle over time — a small, permanent grip
         and conformation gain each time out, bigger on a win. */
      const gain = result.won ? randInt(2, 4) : randInt(1, 2);
      next.dogs = next.dogs.map((d) => d.id === myDog.id ? { ...d, stats: { ...d.stats, grip: clamp(d.stats.grip + gain), conformation: clamp(d.stats.conformation + gain) } } : d);
      const prevTier = fameTier(prev.fame || 0);
      next.fame = (prev.fame || 0) + fameGain;
      const newTier = fameTier(next.fame);
      const msg = result.won
        ? `${myDog.name} beat ${oppDog.name} (${oppDog.kennelName}) at the ${trial.label.toLowerCase()} by ${result.margin} points — won ${fmtMoney(purse)}. Training's paying off — ${myDog.name} put on some muscle.`
        : `${myDog.name} lost to ${oppDog.name} (${oppDog.kennelName}) at the ${trial.label.toLowerCase()} by ${result.margin} points — entry fee cost ${fmtMoney(Math.round(purse * 0.3))}.`;
      next = addLog(next, result.won ? "money" : "injury", msg);
      if (newTier.label !== prevTier.label) {
        next = addLog(next, "info", `📰 Word's spreading — ${next.kennelName} is now "${newTier.label}" around the working-dog circuit.`);
      }
      return next;
    });
  }

  function doBreed() {
    const sire = state.dogs.find((d) => d.id === breedPick.sireId);
    const dam = state.dogs.find((d) => d.id === breedPick.damId);
    if (!sire || !dam) return;
    const foundedName = newBloodline.trim();
    const bloodline = foundedName || sire.bloodline || dam.bloodline || null;
    update((prev) => {
      const { pups, inbred, doubleMerleWarned, doubleMuscledCount, culledCount, grewBiggerCount } = breedPuppies(sire, dam, prev.day + 1, bloodline);
      let next = tick(prev, 1, { [sire.id]: { cooldownSet: 10, healthDelta: 0 }, [dam.id]: { cooldownSet: 45, healthDelta: -14 } });
      if (foundedName) {
        next.dogs = next.dogs.map((d) => (d.id === sire.id || d.id === dam.id) ? { ...d, bloodline: foundedName } : d);
      }
      next.dogs = [...next.dogs, ...pups];
      const names = pups.map((p) => p.name).join(", ");
      let note = "";
      if (foundedName) note += ` Founded the ${foundedName} bloodline.`;
      if (inbred) note += " Close breeding — litter came in below par.";
      if (doubleMerleWarned) note += " At least one double-merle pup — those carry real risk of deafness or vision problems.";
      if (doubleMuscledCount) note += ` ${doubleMuscledCount} double-muscled (MSTN/MSTN) pup${doubleMuscledCount > 1 ? "s" : ""} — dramatic power, less endurance.`;
      if (culledCount) note += ` ${culledCount} pup${culledCount > 1 ? "s" : ""} came out below standard — not every one in a litter makes the grade.`;
      if (grewBiggerCount) note += ` ${grewBiggerCount} pup${grewBiggerCount > 1 ? "s" : ""} threw a growth mutation — noticeably bigger than expected.`;
      return addLog(next, "breed", `${sire.name} × ${dam.name} whelped ${pups.length}: ${names}.${note}`);
    });
    setBreedPick({ sireId: null, damId: null });
    setNewBloodline("");
  }

  function doStudService(dam, stud) {
    const fee = studFee(stud);
    if (state.cash < fee) return;
    const bloodline = dam.bloodline || null;
    update((prev) => {
      const { pups, doubleMerleWarned, doubleMuscledCount, culledCount, grewBiggerCount } = breedPuppies(stud, dam, prev.day + 1, bloodline);
      let next = tick(prev, 1, { [dam.id]: { cooldownSet: 45, healthDelta: -14 } });
      next.cash = Math.round((next.cash - fee) * 100) / 100;
      next.dogs = [...next.dogs, ...pups];
      const names = pups.map((p) => p.name).join(", ");
      let note = doubleMerleWarned ? " At least one double-merle pup — risk of deafness or vision problems." : "";
      if (doubleMuscledCount) note += ` ${doubleMuscledCount} double-muscled (MSTN/MSTN) pup${doubleMuscledCount > 1 ? "s" : ""} — dramatic power, less endurance.`;
      if (culledCount) note += ` ${culledCount} pup${culledCount > 1 ? "s" : ""} came out below standard — not every one in a litter makes the grade.`;
      if (grewBiggerCount) note += ` ${grewBiggerCount} pup${grewBiggerCount > 1 ? "s" : ""} threw a growth mutation — noticeably bigger than expected.`;
      return addLog(next, "breed", `${dam.name} bred to ${stud.name} out of ${stud.kennelName} (stud fee ${fmtMoney(fee)}) — whelped ${pups.length}: ${names}.${note}`);
    });
    setStudDamId(null);
  }

  function doRegister(dog) {
    const fee = registrationFee(dog);
    if (state.cash < fee) return;
    update((prev) => {
      const regNumber = "REG-" + String(prev.nextRegNumber).padStart(4, "0");
      const next = {
        ...prev, cash: Math.round((prev.cash - fee) * 100) / 100, nextRegNumber: prev.nextRegNumber + 1,
        dogs: prev.dogs.map((d) => (d.id === dog.id ? { ...d, registered: true, regNumber } : d)),
      };
      return addLog(next, "money", `Papers issued for ${dog.name} — ${regNumber} (fee ${fmtMoney(fee)}).`);
    });
  }

  function doSell(dog) {
    const value = computeValue(dog);
    update((prev) => addLog({ ...prev, cash: Math.round(prev.cash + value), dogs: prev.dogs.filter((d) => d.id !== dog.id) }, "money", `Sold ${dog.name} to a trader for ${fmtMoney(value)}.`));
  }
  function doBuy(marketDog) {
    if (state.cash < marketDog.price) return;
    update((prev) => {
      const { price, listedDay, sellerName, ...dog } = marketDog;
      let next = { ...prev, cash: Math.round((prev.cash - price) * 100) / 100, dogs: [...prev.dogs, dog], market: prev.market.filter((m) => m.id !== marketDog.id) };
      return addLog(next, "money", `Bought ${dog.name} (${dog.breed})${sellerName ? " from " + sellerName : ""} for ${fmtMoney(price)}.`);
    });
  }
  function doBuyItem(itemId, qty = 1) {
    const item = ITEMS[itemId];
    if (!item) return;
    const cost = item.price * qty;
    if (state.cash < cost) return;
    update((prev) => {
      const inv = { ...(prev.inventory || {}) };
      inv[itemId] = (inv[itemId] || 0) + qty;
      return addLog({ ...prev, cash: Math.round((prev.cash - cost) * 100) / 100, inventory: inv }, "money",
        `Bought ${qty > 1 ? qty + "× " : ""}${item.name} for ${fmtMoney(cost)}.`);
    });
  }

  function doUseItem(itemId, dogId) {
    const item = ITEMS[itemId];
    const target = state.dogs.find((d) => d.id === dogId);
    if (!item || !target) return;
    if (!(state.inventory && state.inventory[itemId] > 0)) return;
    update((prev) => {
      const inv = { ...(prev.inventory || {}) };
      inv[itemId] = Math.max(0, (inv[itemId] || 0) - 1);
      if (inv[itemId] === 0) delete inv[itemId];
      let msg = "";
      const dogs = prev.dogs.map((d) => {
        if (d.id !== dogId) return d;
        const res = applyItem(d, itemId, prev.upgrades);
        msg = res.msg;
        return res.dog;
      });
      const type = item.cat === "med" ? "injury" : item.cat === "training" ? "hunt" : "info";
      return addLog({ ...prev, inventory: inv, dogs }, type, msg || `Used ${item.name}.`);
    });
  }

  function doBuyUpgrade(key) {
    const up = UPGRADES[key];
    if (!up || (state.upgrades && state.upgrades[key])) return;
    if (state.cash < up.price) return;
    update((prev) => addLog({
      ...prev,
      cash: Math.round((prev.cash - up.price) * 100) / 100,
      upgrades: { ...(prev.upgrades || {}), [key]: true },
    }, "money", `Built the ${up.name} for ${fmtMoney(up.price)}.`));
  }

  function doAdopt(entry) {
    if (state.cash < entry.fee) return;
    update((prev) => {
      const next = {
        ...prev,
        cash: Math.round((prev.cash - entry.fee) * 100) / 100,
        dogs: [...prev.dogs, entry.dog],
        rescue: (prev.rescue || []).filter((r) => r.id !== entry.id),
      };
      return addLog(next, "info", `Adopted ${entry.dog.name} (${entry.dog.breed}) out of the shelter for ${fmtMoney(entry.fee)}.`);
    });
  }

  function refreshRescue() {
    update((prev) => addLog({ ...prev, rescue: generateRescuePool(randInt(2, 4), prev.day), rescueRefreshedDay: prev.day }, "info", "Checked the shelter for new intakes."));
  }

  function scoutMarket() { update((prev) => addLog({ ...prev, market: [...prev.market, ...generateMarket(4, prev.day)].slice(-30) }, "info", "Scouted new dogs at the market.")); }
  function restWeek() { update((prev) => addLog(tick(prev, 7), "info", "Rested the kennel a week. Dogs recovered condition.")); }
  function renameKennel() { const name = nameDraft.trim(); if (name) update((prev) => ({ ...prev, kennelName: name })); setEditingName(false); }

  const huntableDogs = state.dogs.filter(canHunt);
  const breedableM = state.dogs.filter((d) => d.sex === "M" && canBreed(d));
  const breedableF = state.dogs.filter((d) => d.sex === "F" && canBreed(d));
  const sire = state.dogs.find((d) => d.id === breedPick.sireId);
  const dam = state.dogs.find((d) => d.id === breedPick.damId);
  const bothMerleCarriers = sire && dam && sire.colorGenes.merleAlleles >= 1 && dam.colorGenes.merleAlleles >= 1;
  const canFoundBloodline = sire && dam && sire.registered && dam.registered && !sire.bloodline && !dam.bloodline;
  const inheritedBloodline = sire && dam && (sire.bloodline || dam.bloodline);
  const studs = collectStuds(state.aiKennels);
  const competitors = collectCompetitors(state.aiKennels);
  const studDam = state.dogs.find((d) => d.id === studDamId);

  let shownMarket = state.market.filter((d) => {
    if (filters.breed !== "all") { if (filters.breed === "Cross") { if (!d.breed.includes("Cross")) return false; } else if (d.breed !== filters.breed) return false; }
    if (filters.sex !== "all" && d.sex !== filters.sex) return false;
    if (filters.maxPrice && d.price > Number(filters.maxPrice)) return false;
    if (filters.minStars !== "0" && starTrait(d).stars < Number(filters.minStars)) return false;
    return true;
  });
  shownMarket = shownMarket.slice().sort((a, b) => {
    if (filters.sort === "priceAsc") return a.price - b.price;
    if (filters.sort === "priceDesc") return b.price - a.price;
    if (filters.sort === "ratingDesc") return overallRating(b.stats) - overallRating(a.stats);
    if (filters.sort === "rarityDesc") return computeRarity(b).mult - computeRarity(a).mult;
    return 0;
  });

  const registeredDogs = state.dogs.filter((d) => d.registered);
  const bloodlineGroups = {};
  state.dogs.forEach((d) => { if (d.bloodline) { (bloodlineGroups[d.bloodline] = bloodlineGroups[d.bloodline] || []).push(d); } });
  const netWorth = kennelNetWorth(state);
  const topDog = state.dogs.length ? state.dogs.slice().sort((a, b) => overallRating(b.stats) - overallRating(a.stats))[0] : null;
  const topCatch = state.catches.find((c) => c.kennelName === state.kennelName);
  const prevNetWorth = state.netWorthHistory && state.netWorthHistory.length > 1 ? state.netWorthHistory[state.netWorthHistory.length - 2].netWorth : netWorth;
  const netWorthDelta = netWorth - prevNetWorth;

  return (
    <div className="kg-app">
      <header className="kg-header">
        <div className="kg-header__title">
          <span className="kg-header__logo">🐾</span>
          {editingName ? (
            <div className="kg-rename">
              <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={28} onKeyDown={(e) => e.key === "Enter" && renameKennel()} />
              <button className="kg-iconbtn" onClick={renameKennel} aria-label="Save">✓</button>
            </div>
          ) : (
            <h1 onClick={() => { setNameDraft(state.kennelName); setEditingName(true); }}>{state.kennelName} <span className="kg-iconbtn kg-iconbtn--ghost">✎</span></h1>
          )}
        </div>
        <div className="kg-header__stats">
          <span className="kg-hstat">Day {state.day}</span>
          <span className="kg-hstat kg-hstat--cash">${state.cash.toLocaleString("en-US")}</span>
          <span className="kg-hstat">{state.dogs.length} dog{state.dogs.length === 1 ? "" : "s"}</span>
          <button className="kg-btn kg-btn--ghost" onClick={restWeek}>Rest a Week</button>
          {themeToggleEl}
          {cloudAuthEl}
        </div>
      </header>

      {saveError && <div className="kg-savewarn">Couldn't save progress just now — keep playing, it'll retry.</div>}
      {storageMode === "memory" && <div className="kg-notice">This browser is blocking local storage, so progress won't be saved between visits.</div>}
      <div className="kg-notice">Eight other kennels around the county breed, hunt, and sell dogs on their own — their world moves forward whenever you hunt, breed, or rest a week.</div>

      <div className="kg-layout">
      <nav className="kg-tabs">
        {TABS.map((t, i) => (
          <React.Fragment key={t.id}>
            {t.group && t.group !== (TABS[i - 1] || {}).group && <p className="kg-tabgroup">{t.group}</p>}
            <button className={"kg-tab " + (tab === t.id ? "kg-tab--active" : "")} onClick={() => setTab(t.id)}>
              <span className="kg-tab__icon" aria-hidden="true">{t.icon}</span>
              <span className="kg-tab__label">{t.label}</span>
            </button>
          </React.Fragment>
        ))}
      </nav>

      <main className="kg-main">
        {tab === "overview" && (
          <section>
            <p className="kg-hint">ℹ The front page of the stud book — a running record of {state.kennelName}'s worth, and what's happening around the county.</p>
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
                    footer={<button className="kg-btn kg-btn--sm" onClick={() => { setHuntPick((p) => ({ ...p, dogId: dog.id })); doHunt(); }}>Run the {HUNTS[huntPick.hunt].label}</button>} />
                ))}
              </div>
            )}

            <hr className="kg-divider" />
            <h2 className="kg-subhead">Group hog hunt</h2>
            <p className="kg-hint">ℹ Send a pack after the same hog. More dogs means a real shot at something huge — solo hunts top out around 480 lb, but a pack of 3+ can occasionally run into 500–1,200 lb monster hogs. Every dog in the pack shares the risk.</p>
            {huntableDogs.length < 2 ? <p className="kg-empty">Need at least 2 dogs fit to hunt for a group run.</p> : (
              <>
                <div className="kg-grid" style={{ marginBottom: 14 }}>
                  {huntableDogs.map((dog) => {
                    const picked = groupHuntPicks.includes(dog.id);
                    return (
                      <DogCard key={dog.id} dog={dog} onView={setViewDog}
                        footer={<button className={"kg-btn kg-btn--sm " + (picked ? "" : "kg-btn--ghost")}
                          onClick={() => setGroupHuntPicks((p) => picked ? p.filter((id) => id !== dog.id) : [...p, dog.id])}>
                          {picked ? "✓ In the pack" : "Add to pack"}
                        </button>} />
                    );
                  })}
                </div>
                <button className="kg-btn kg-btn--gold" disabled={groupHuntPicks.length < 2} onClick={() => doGroupHunt(groupHuntPicks)}>
                  {groupHuntPicks.length < 2 ? "Pick at least 2 dogs" : `Send the pack (${groupHuntPicks.length} dogs) after a hog`}
                </button>
              </>
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
                    <button className="kg-btn" onClick={doBreed}>Breed {sire.name} × {dam.name}</button>
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
              <div className="kg-grid">
                {studs.map((stud) => (
                  <DogCard key={stud.id} dog={stud} onView={setViewDog} price={studFee(stud)} sellerName={"out of " + stud.kennelName}
                    footer={<button className="kg-btn kg-btn--sm" disabled={!studDam || state.cash < studFee(stud)} onClick={() => doStudService(studDam, stud)}>
                      {!studDam ? "Pick a dam first" : state.cash < studFee(stud) ? "Can't afford" : `Book stud — ${fmtMoney(studFee(stud))}`}
                    </button>} />
                ))}
              </div>
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
            <h2 className="kg-subhead">Pick an opponent</h2>
            {competitors.length === 0 ? <p className="kg-empty">No competitors available right now — check back after a day passes.</p> : (
              <div className="kg-grid">
                {competitors.map((opp) => {
                  const myDog = state.dogs.find((d) => d.id === trialPick.dogId);
                  return (
                    <DogCard key={opp.id} dog={opp} onView={setViewDog} sellerName={"out of " + opp.kennelName}
                      footer={<button className="kg-btn kg-btn--sm" disabled={!myDog} onClick={() => doTrial(myDog, opp)}>
                        {!myDog ? "Pick your dog first" : `Enter ${TRIALS[trialPick.trial].label} — purse ${fmtMoney(trialPurse(myDog, opp))}`}
                      </button>} />
                  );
                })}
              </div>
            )}
          </section>
        )}

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
                    footer={<button className="kg-btn kg-btn--sm" disabled={state.cash < dog.price} onClick={() => doBuy(dog)}>{state.cash < dog.price ? "Can't afford" : "Buy"}</button>} />
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
                        <button className="kg-btn kg-btn--sm" disabled={state.cash < item.price} onClick={() => doBuyItem(id)}>
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
                        <button className="kg-btn kg-btn--sm" disabled={state.cash < entry.fee} onClick={() => doAdopt(entry)}>
                          {state.cash < entry.fee ? "Can't afford" : "Adopt"}
                        </button>
                      </>
                    }
                  />
                </div>
              ))}
            </div>
          </>
        )}

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

        {tab === "trade" && (
          <section>
            <p className="kg-hint">ℹ Buy and sell dogs with other real kennels — not the AI. Listings and purchases sync live for everyone signed in.</p>
            {!session && <p className="kg-notice">Sign in with Cloud Save (top right) to list or buy dogs here.</p>}
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
                    footer={<button className="kg-btn kg-btn--sm" disabled={!session || state.cash < l.price} onClick={() => buyListing(l)}>
                      {!session ? "Sign in to buy" : state.cash < l.price ? "Can't afford" : "Buy"}
                    </button>} />
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "rivals" && (
          <section>
            <p className="kg-hint">ℹ Post a dog against a trial type and wait for a real opponent, or answer someone else's challenge — results resolve instantly for both of you.</p>
            {!session && <p className="kg-notice">Sign in with Cloud Save (top right) to challenge or be challenged.</p>}
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
            {leaderboardRows.length === 0 ? <p className="kg-empty">No cloud kennels yet — sign in with Cloud Save to be the first on the board.</p> : (
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
            <p className="kg-note">🐗 Group hog hunts — send a pack of dogs together — can bring in monster hogs up to 1,000+ lb. It's veryyyyy rare, but that's where the record-book catches come from.</p>
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

        {tab === "log" && (
          <section>
            <h2 className="kg-subhead">Ledger</h2>
            {state.log.length === 0 ? <p className="kg-empty">Nothing recorded yet.</p> : (
              <ul className="kg-log">
                {state.log.map((entry, i) => (
                  <li key={i} className={"kg-logrow kg-logrow--" + entry.type}><span className="kg-logday">Day {entry.day}</span><span>{entry.text}</span></li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
      </div>
      <DogProfileModal dog={viewDog} onClose={() => setViewDog(null)} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<KennelGame />);
