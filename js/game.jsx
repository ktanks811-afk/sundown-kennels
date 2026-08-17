/* The main game component: all state, the day tick, every player action
   (hunting, breeding, trials, market, store, rescue, property), the
   Supabase multiplayer layer (trade, rivals, leaderboard), and every
   tab screen. */

function KennelGame() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [shopCat, setShopCat] = useState("feed");
  const [propShowAll, setPropShowAll] = useState(false);
  const [logFilter, setLogFilter] = useState("all");
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
  const [viewAnimal, setViewAnimal] = useState(null);
  const [trialPick, setTrialPick] = useState({ dogId: null, trial: "weightpull" });
  const [breedPick, setBreedPick] = useState({ sireId: null, damId: null });
  const [pendingLitter, setPendingLitter] = useState(null);
  const [raceGame, setRaceGame] = useState(null); // { kind, animal, eventKey, ev, opp, purse } while the timing mini-game is up
  const [selectedPupIds, setSelectedPupIds] = useState([]);
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

  // Account screen
  const [profile, setProfile] = useState(null);          // { username, avatar }
  const [usernameDraft, setUsernameDraft] = useState("");
  const [accountMsg, setAccountMsg] = useState(null);    // { tone, text }
  const [accountBusy, setAccountBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [bioDraft, setBioDraft] = useState("");
  const avatarInputRef = useRef(null);
  const importInputRef = useRef(null);
  const [adminCodeDraft, setAdminCodeDraft] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(() => {
    try { return window.localStorage.getItem(ADMIN_UNLOCK_KEY) === "1"; } catch { return false; }
  });
  const [adminTarget, setAdminTarget] = useState("");
  const [layout, setLayout] = useState(() => {
    // Frame is the default now. An explicit "classic" choice is still honoured,
    // so anyone who already picked the old one keeps it.
    try { return window.localStorage.getItem(LAYOUT_KEY) === "classic" ? "classic" : "frame"; } catch { return "frame"; }
  });
  useEffect(() => {
    try { window.localStorage.setItem(LAYOUT_KEY, layout); } catch {}
    document.documentElement.setAttribute("data-layout", layout);
  }, [layout]);

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

  const handleSignOut = useCallback(() => { sb.auth.signOut(); setCloudPanelOpen(false); setProfile(null); }, []);

  // Stable identity: an inline arrow here gets a new one on every render, which
  // is what let the dialog's focus effect re-fire while you were typing.
  const toggleCloudPanel = useCallback(() => setCloudPanelOpen((v) => !v), []);

  /* signInWithOAuth navigates immediately, so if the provider isn't enabled the
     player lands on a raw JSON error page and any message we'd set never gets
     shown. Ask the endpoint first, and only hand off if it's actually wired up. */
  const handleGoogleSignIn = useCallback(async () => {
    setAuthMsg("");
    try {
      const probe = await fetch(`${SUPABASE_URL}/auth/v1/authorize?provider=google`, { redirect: "manual" });
      if (probe.type !== "opaqueredirect" && probe.status >= 400) {
        setAuthMsg("Google sign-in isn't switched on for this site yet — use an email and password for now.");
        return;
      }
    } catch {
      /* Network or CORS hiccup: fall through and let the real redirect decide. */
    }
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) setAuthMsg(error.message);
  }, []);

  /* ------------------------------ profile ------------------------------ */

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    let cancelled = false;
    sb.from("profiles").select("username, avatar, bio, show_on_leaderboard").eq("user_id", session.user.id).maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error) return;
        const p = data || { username: null, avatar: null, bio: null, show_on_leaderboard: true };
        setProfile(p);
        setUsernameDraft(p.username || "");
        setBioDraft(p.bio || "");
      });
    return () => { cancelled = true; };
  }, [session]);

  const saveProfile = useCallback(async (patch) => {
    if (!session) return;
    setAccountBusy(true); setAccountMsg(null);
    const row = { user_id: session.user.id, ...profile, ...patch };
    delete row.created_at; delete row.updated_at;
    const { error } = await sb.from("profiles").upsert(row, { onConflict: "user_id" });
    setAccountBusy(false);
    if (error) {
      // PostgREST's "schema cache" wording means nothing to a player. The only
      // way to hit it is the profiles migration not having been applied yet.
      const missingTable = /schema cache|does not exist/i.test(error.message) || error.code === "PGRST205";
      setAccountMsg({ tone: "rust", text:
        missingTable ? "Profiles aren't set up on the server yet, so there's nowhere to save this. The database migration (migrations/001_profiles.sql) still needs running."
        : /duplicate|unique/i.test(error.message) ? "That username is already taken — try another."
        : /violates check constraint/i.test(error.message) ? "That doesn't fit the allowed length — shorten it and try again."
        : error.message });
      return false;
    }
    setProfile((prev) => ({ ...(prev || {}), ...patch }));
    setAccountMsg({ tone: "olive", text: "Saved." });
    return true;
  }, [session, profile]);

  const saveUsername = useCallback(async () => {
    const err = usernameError(usernameDraft);
    if (err) { setAccountMsg({ tone: "rust", text: err }); return; }
    await saveProfile({ username: usernameDraft.trim() });
  }, [usernameDraft, saveProfile]);

  const handleAvatarFile = useCallback(async (file) => {
    setAccountMsg(null);
    try {
      const img = await readImageFile(file);
      const dataUrl = imageToAvatarDataUrl(img);
      await saveProfile({ avatar: dataUrl });
    } catch (err) {
      setAccountMsg({ tone: "rust", text: err.message });
    }
  }, [saveProfile]);

  const changePassword = useCallback(async () => {
    if (newPassword.length < 6) { setAccountMsg({ tone: "rust", text: "Password needs to be at least 6 characters." }); return; }
    setAccountBusy(true); setAccountMsg(null);
    const { error } = await sb.auth.updateUser({ password: newPassword });
    setAccountBusy(false);
    setNewPassword("");
    setAccountMsg(error ? { tone: "rust", text: error.message } : { tone: "olive", text: "Password changed." });
  }, [newPassword]);

  /* Signing out everywhere matters if you've played on a shared or lost device —
     the local sign-out button only clears this browser. */
  const signOutEverywhere = useCallback(async () => {
    setAccountBusy(true); setAccountMsg(null);
    const { error } = await sb.auth.signOut({ scope: "global" });
    setAccountBusy(false);
    if (error) { setAccountMsg({ tone: "rust", text: error.message }); return; }
    setProfile(null);
    window.location.reload();
  }, []);

  /* A save is a plain JSON blob, so a backup is just a download. Worth having
     before anyone touches the reset or delete buttons below it. */
  const exportSave = useCallback(() => {
    try {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `${(state.kennelName || "kennel").replace(/[^\w-]+/g, "-").toLowerCase()}-day${state.day}-${stamp}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setAccountMsg({ tone: "olive", text: "Save downloaded." });
    } catch (err) {
      setAccountMsg({ tone: "rust", text: "Couldn't build the download: " + err.message });
    }
  }, [state]);

  const importSave = useCallback(async (file) => {
    setAccountMsg(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      // Cheap sanity check — better a clear refusal than a half-loaded kennel.
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.dogs) || typeof parsed.day !== "number") {
        throw new Error("That doesn't look like a Sundown Kennels save.");
      }
      const migrated = migrateState(parsed);
      setState(migrated);
      persist(migrated);
      setAccountMsg({ tone: "olive", text: `Loaded ${migrated.kennelName || "kennel"} — day ${migrated.day}, ${migrated.dogs.length} dogs.` });
    } catch (err) {
      setAccountMsg({ tone: "rust", text: err.message });
    }
  }, [persist]);

  /* Starting over used to mean deleting your whole account, which is a very
     large hammer for "I want a fresh kennel". */
  const resetKennel = useCallback(() => {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
    setState(null);
    if (session) sb.from("kennels").delete().eq("user_id", session.user.id);
    window.location.reload();
  }, [session]);

  /* ------------------------------- admin -------------------------------- */

  /* Every admin action routes through here so the flag can't be forgotten on
     one of them. A flagged save is excluded from the public leaderboard —
     handing yourself a million dollars shouldn't push a real kennel down it. */
  const adminApply = useCallback((label, fn) => {
    update((prev) => {
      const next = fn({ ...prev });
      next[ADMIN_FLAG] = true;
      return addLog(next, "info", `⚙ Admin: ${label}`);
    });
    setAccountMsg({ tone: "olive", text: label });
  }, []);

  const adminUnlock = useCallback(() => {
    if (adminCodeDraft.trim().toLowerCase() !== ADMIN_CODE) {
      setAccountMsg({ tone: "rust", text: "That code isn't right." });
      return;
    }
    try { window.localStorage.setItem(ADMIN_UNLOCK_KEY, "1"); } catch {}
    setAdminUnlocked(true);
    setAdminCodeDraft("");
    setAccountMsg({ tone: "olive", text: "Admin unlocked. It's in the sub-tabs above." });
  }, [adminCodeDraft]);

  const adminLock = useCallback(() => {
    try { window.localStorage.removeItem(ADMIN_UNLOCK_KEY); } catch {}
    setAdminUnlocked(false);
    setTab("settings");
  }, []);

  const adminAddCash = (amount) => adminApply(`Added ${fmtMoney(amount)}.`, (s) => ({ ...s, cash: Math.round(s.cash + amount) }));
  const adminSetFame = (fame) => adminApply(`Fame set to ${fame}.`, (s) => ({ ...s, fame }));
  const adminAdvance = (days) => adminApply(`Skipped ${days} days.`, (s) => tick(s, days));

  const adminHealAll = () => adminApply("Healed every animal.", (s) => ({
    ...s,
    dogs: (s.dogs || []).map((d) => ({ ...d, health: 100, injury: null })),
    horses: (s.horses || []).map((h) => ({ ...h, health: 100, injury: null })),
    cattle: (s.cattle || []).map((c) => ({ ...c, health: 100, injury: null })),
  }));

  const adminMaxStats = (dogId) => adminApply("Maxed that dog's stats.", (s) => ({
    ...s,
    dogs: s.dogs.map((d) => d.id !== dogId ? d : {
      ...d, health: 100, injury: null,
      stats: STAT_KEYS.reduce((acc, k) => ({ ...acc, [k]: 100 }), {}),
    }),
  }));

  const adminSpawnDog = (elite) => adminApply(elite ? "Spawned an elite dog." : "Spawned a random dog.", (s) => {
    const dog = generateRandomDog();
    if (elite) {
      STAT_KEYS.forEach((k) => { dog.stats[k] = randInt(88, 100); });
      dog.health = 100;
      dog.ageDays = randInt(730, 1100);   // straight into its prime
    }
    return { ...s, dogs: [...s.dogs, dog] };
  });

  const adminSpawnStock = (kind) => adminApply(`Spawned a ${kind === "horse" ? "horse" : "cow"}.`, (s) => {
    const cfg = LIVESTOCK_CONFIG[kind];
    if (!cfg || typeof cfg.generate !== "function") return s;
    // The generators require a real breed name — they index straight into the
    // breed table, so passing undefined throws rather than picking at random.
    const names = kind === "horse" ? HORSE_BREED_NAMES : CATTLE_BREED_NAMES;
    const breed = names[randInt(0, names.length - 1)];
    const animal = cfg.generate(breed, s.day);
    if (!animal) return s;
    return { ...s, [cfg.arrayKey]: [...(s[cfg.arrayKey] || []), animal] };
  });

  const adminUnlockAll = () => adminApply("Unlocked every kennel upgrade.", (s) => ({
    ...s,
    upgrades: Object.keys(UPGRADES).reduce((acc, k) => ({ ...acc, [k]: true }), { ...(s.upgrades || {}) }),
  }));

  const adminRegisterAll = () => adminApply("Registered every dog.", (s) => {
    let n = s.nextRegNumber || 1;
    const dogs = s.dogs.map((d) => d.registered ? d : { ...d, registered: true, regNumber: "REG-" + String(n++).padStart(4, "0") });
    return { ...s, dogs, nextRegNumber: n };
  });

  const adminClearFlag = () => update((prev) => {
    const next = { ...prev };
    delete next[ADMIN_FLAG];
    return addLog(next, "info", "⚙ Admin: cleared the admin flag — this kennel counts on the leaderboard again.");
  });

  const deleteAccount = useCallback(async () => {
    setAccountBusy(true); setAccountMsg(null);
    const { error } = await sb.rpc("delete_my_account");
    setAccountBusy(false);
    if (error) { setAccountMsg({ tone: "rust", text: error.message }); return; }
    try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
    await sb.auth.signOut();
    window.location.reload();
  }, []);

  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [pvpListings, setPvpListings] = useState([]);
  const [sellPick, setSellPick] = useState({ dogId: null, price: "" });
  const [pvpMsg, setPvpMsg] = useState("");
  const [openChallenges, setOpenChallenges] = useState([]);
  const [myChallenges, setMyChallenges] = useState([]);
  const [challengePick, setChallengePick] = useState({ dogId: null, trial: "weightpull" });
  const [acceptPick, setAcceptPick] = useState({});
  const [rivalsMsg, setRivalsMsg] = useState("");
  const [studOffers, setStudOffers] = useState([]);
  const [myStudRequests, setMyStudRequests] = useState([]);
  const [incomingStudRequests, setIncomingStudRequests] = useState([]);
  const [studPick, setStudPick] = useState({ dogId: null, fee: "" });
  const [requestDamPick, setRequestDamPick] = useState({});
  const [studMsg, setStudMsg] = useState("");

  // Horses & cattle share one multiplayer UI state shape, keyed by kind —
  // avoids six more useState hooks duplicated per species.
  const [pvp2, setPvp2] = useState({
    horse: { listings: [], openChallenges: [], myChallenges: [], studOffers: [], myStudRequests: [], incomingStudRequests: [],
      sellPick: { animalId: null, price: "" }, challengePick: { animalId: null, event: Object.keys(HORSE_SHOWS)[0] },
      studPick: { animalId: null, fee: "" }, acceptPick: {}, requestPick: {}, breedPick: { sireId: null, damId: null }, showPick: { animalId: null, event: Object.keys(HORSE_SHOWS)[0] }, msg: "" },
    cattle: { listings: [], openChallenges: [], myChallenges: [], studOffers: [], myStudRequests: [], incomingStudRequests: [],
      sellPick: { animalId: null, price: "" }, challengePick: { animalId: null, event: Object.keys(CATTLE_SHOWS)[0] },
      studPick: { animalId: null, fee: "" }, acceptPick: {}, requestPick: {}, breedPick: { sireId: null, damId: null }, showPick: { animalId: null, event: Object.keys(CATTLE_SHOWS)[0] }, msg: "" },
  });
  const patchPvp2 = useCallback((kind, patch) => setPvp2((prev) => ({ ...prev, [kind]: { ...prev[kind], ...patch } })), []);

  // Pull our own kennel row fresh from Supabase after a cross-player action
  // (buy, sell, challenge) changes it server-side, and keep localStorage's
  // cache in sync too — without re-triggering another push back to cloud.
  const refreshFromCloud = useCallback(() => {
    if (!session) return;
    sb.from("kennels").select("state").eq("user_id", session.user.id).maybeSingle().then(({ data }) => {
      if (data && data.state) {
        const migrated = migrateState(data.state);
        setState(migrated);
        try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch {}
      }
    });
  }, [session]);

  const loadLeaderboard = useCallback(() => {
    sb.from("leaderboard").select("*").order("net_worth", { ascending: false }).limit(50)
      .then(({ data }) => setLeaderboardRows(data || []));
  }, []);
  const [raceLeaders, setRaceLeaders] = useState([]);
  const loadRaceLeaders = useCallback(() => {
    sb.from("race_leaders").select("*")
      .then(({ data }) => setRaceLeaders(data || []));
  }, []);

  const loadListings = useCallback(() => {
    sb.from("market_listings").select("*").eq("status", "active").eq("kind", "dog").order("created_at", { ascending: false }).limit(60)
      .then(({ data }) => setPvpListings(data || []));
  }, []);
  const loadChallenges = useCallback(() => {
    sb.from("challenges").select("*").eq("status", "open").eq("kind", "dog").order("created_at", { ascending: false }).limit(60)
      .then(({ data }) => setOpenChallenges(data || []));
    if (session) {
      sb.from("challenges").select("*")
        .eq("status", "completed").eq("kind", "dog")
        .or(`creator_id.eq.${session.user.id},opponent_id.eq.${session.user.id}`)
        .order("resolved_at", { ascending: false }).limit(20)
        .then(({ data }) => setMyChallenges(data || []));
    }
  }, [session]);

  const loadStudBoard = useCallback(() => {
    sb.from("stud_offers").select("*").eq("status", "open").eq("kind", "dog").order("created_at", { ascending: false }).limit(60)
      .then(({ data }) => setStudOffers(data || []));
    if (session) {
      sb.from("stud_requests").select("*").eq("requester_id", session.user.id).eq("kind", "dog")
        .order("created_at", { ascending: false }).limit(20)
        .then(({ data }) => setMyStudRequests(data || []));
      sb.from("stud_requests").select("*").eq("owner_id", session.user.id).eq("status", "pending").eq("kind", "dog")
        .order("created_at", { ascending: false }).limit(20)
        .then(({ data }) => setIncomingStudRequests(data || []));
    }
  }, [session]);

  const loadKindBoard = useCallback((kind) => {
    sb.from("market_listings").select("*").eq("status", "active").eq("kind", kind).order("created_at", { ascending: false }).limit(60)
      .then(({ data }) => patchPvp2(kind, { listings: data || [] }));
    sb.from("challenges").select("*").eq("status", "open").eq("kind", kind).order("created_at", { ascending: false }).limit(60)
      .then(({ data }) => patchPvp2(kind, { openChallenges: data || [] }));
    sb.from("stud_offers").select("*").eq("status", "open").eq("kind", kind).order("created_at", { ascending: false }).limit(60)
      .then(({ data }) => patchPvp2(kind, { studOffers: data || [] }));
    if (session) {
      sb.from("challenges").select("*").eq("status", "completed").eq("kind", kind)
        .or(`creator_id.eq.${session.user.id},opponent_id.eq.${session.user.id}`)
        .order("resolved_at", { ascending: false }).limit(20)
        .then(({ data }) => patchPvp2(kind, { myChallenges: data || [] }));
      sb.from("stud_requests").select("*").eq("requester_id", session.user.id).eq("kind", kind)
        .order("created_at", { ascending: false }).limit(20)
        .then(({ data }) => patchPvp2(kind, { myStudRequests: data || [] }));
      sb.from("stud_requests").select("*").eq("owner_id", session.user.id).eq("status", "pending").eq("kind", kind)
        .order("created_at", { ascending: false }).limit(20)
        .then(({ data }) => patchPvp2(kind, { incomingStudRequests: data || [] }));
    }
  }, [session, patchPvp2]);

  useEffect(() => {
    loadLeaderboard(); loadListings(); loadChallenges(); loadStudBoard();
    loadKindBoard("horse"); loadKindBoard("cattle");
  }, [loadLeaderboard, loadListings, loadChallenges, loadStudBoard, loadKindBoard]);

  // Realtime: live-refresh the marketplace and challenge boards for every
  // connected player whenever anyone lists/buys/challenges/accepts — dogs,
  // horses, and cattle all ride the same four tables.
  useEffect(() => {
    const channel = sb.channel("kennel-pvp")
      .on("postgres_changes", { event: "*", schema: "public", table: "market_listings" }, () => { loadListings(); loadKindBoard("horse"); loadKindBoard("cattle"); refreshFromCloud(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "challenges" }, () => { loadChallenges(); loadKindBoard("horse"); loadKindBoard("cattle"); refreshFromCloud(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "stud_offers" }, () => { loadStudBoard(); loadKindBoard("horse"); loadKindBoard("cattle"); })
      .on("postgres_changes", { event: "*", schema: "public", table: "stud_requests" }, () => { loadStudBoard(); loadKindBoard("horse"); loadKindBoard("cattle"); refreshFromCloud(); })
      .subscribe();
    return () => sb.removeChannel(channel);
  }, [loadListings, loadChallenges, loadStudBoard, loadKindBoard, refreshFromCloud]);

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
    if (state.dogs.length >= kennelCapacity(state)) { setPvpMsg("Your kennel is full — buy more land in the Property tab."); return; }
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

  const postStudOffer = useCallback((dogId, fee) => {
    if (!session) { setStudMsg("Sign in to offer a stud."); return; }
    const dog = state.dogs.find((d) => d.id === dogId);
    if (!dog) return;
    sb.from("stud_offers").insert({ owner_id: session.user.id, owner_name: state.kennelName, dog, fee: Math.max(0, Math.round(Number(fee) || 0)) })
      .then(({ error }) => {
        if (error) setStudMsg(error.message);
        else { setStudMsg(`${dog.name} listed for stud.`); setStudPick({ dogId: null, fee: "" }); loadStudBoard(); }
      });
  }, [session, state, loadStudBoard]);

  const cancelStudOffer = useCallback((offer) => {
    sb.from("stud_offers").update({ status: "cancelled" }).eq("id", offer.id).eq("owner_id", session?.user?.id)
      .then(({ error }) => { if (!error) loadStudBoard(); else setStudMsg(error.message); });
  }, [session, loadStudBoard]);

  const requestStud = useCallback((offer, damId) => {
    if (!session) { setStudMsg("Sign in to request a breeding."); return; }
    const dam = state.dogs.find((d) => d.id === damId);
    if (!dam) return;
    sb.from("stud_requests").insert({
      offer_id: offer.id, owner_id: offer.owner_id, owner_name: offer.owner_name,
      requester_id: session.user.id, requester_name: state.kennelName,
      stud: offer.dog, dam, fee: offer.fee,
    }).then(({ error }) => {
      if (error) setStudMsg(error.message);
      else { setStudMsg(`Sent a breeding request to ${offer.owner_name}.`); loadStudBoard(); }
    });
  }, [session, state, loadStudBoard]);

  const declineStudRequest = useCallback((request) => {
    sb.from("stud_requests").update({ status: "declined" }).eq("id", request.id).eq("owner_id", session?.user?.id)
      .then(({ error }) => { if (!error) loadStudBoard(); else setStudMsg(error.message); });
  }, [session, loadStudBoard]);

  const acceptStudRequestAction = useCallback((request) => {
    if (!session) return;
    const bloodline = request.dam.bloodline || null;
    const litter = breedPuppies(request.stud, request.dam, state.day + 1, bloodline);
    setStudMsg("Whelping and splitting the litter…");
    sb.rpc("accept_stud_request", { p_request_id: request.id, p_pups: litter.pups }).then(({ data, error }) => {
      if (error) { setStudMsg(error.message); return; }
      const s = data.litter_summary;
      setStudMsg(`Litter of ${s.total} split: you kept ${s.ownerKept}, ${request.requester_name} kept ${s.requesterKept}.`);
      refreshFromCloud(); loadStudBoard();
    });
  }, [session, state, refreshFromCloud, loadStudBoard]);

  /* ---- Horses & cattle: generic multiplayer actions (trade/rivals/stud) ---- */
  const listAnimalForSale = useCallback((kind, animalId, price) => {
    const cfg = LIVESTOCK_CONFIG[kind];
    if (!session) { patchPvp2(kind, { msg: "Sign in to list." }); return; }
    const animal = state[cfg.arrayKey].find((a) => a.id === animalId);
    if (!animal) return;
    const p = Math.round(Number(price));
    if (!p || p <= 0) { patchPvp2(kind, { msg: "Enter a valid price." }); return; }
    update((prev) => ({ ...prev, [cfg.arrayKey]: prev[cfg.arrayKey].filter((a) => a.id !== animalId) }));
    sb.from("market_listings").insert({ seller_id: session.user.id, seller_name: state.kennelName, dog: animal, price: p, kind })
      .then(({ error }) => {
        if (error) { patchPvp2(kind, { msg: error.message }); update((prev) => ({ ...prev, [cfg.arrayKey]: [...prev[cfg.arrayKey], animal] })); }
        else { patchPvp2(kind, { msg: `Listed ${animal.name} for ${fmtMoney(p)}.`, sellPick: { animalId: null, price: "" } }); loadKindBoard(kind); }
      });
  }, [session, state, update, loadKindBoard, patchPvp2]);

  const cancelAnimalListing = useCallback((kind, listing) => {
    sb.from("market_listings").update({ status: "cancelled" }).eq("id", listing.id).eq("seller_id", session?.user?.id)
      .then(({ error }) => {
        if (!error) { const cfg = LIVESTOCK_CONFIG[kind]; update((prev) => ({ ...prev, [cfg.arrayKey]: [...prev[cfg.arrayKey], listing.dog] })); loadKindBoard(kind); }
        else patchPvp2(kind, { msg: error.message });
      });
  }, [session, update, loadKindBoard, patchPvp2]);

  const buyAnimalListing = useCallback((kind, listing) => {
    if (!session) { patchPvp2(kind, { msg: "Sign in to buy." }); return; }
    if (livestockCount(state) >= livestockCapacity(state)) { patchPvp2(kind, { msg: "Not enough pasture room." }); return; }
    patchPvp2(kind, { msg: "Buying…" });
    sb.rpc("purchase_listing", { p_listing_id: listing.id, p_kind: kind }).then(({ error }) => {
      if (error) patchPvp2(kind, { msg: error.message });
      else { patchPvp2(kind, { msg: `Bought ${listing.dog.name}!` }); refreshFromCloud(); loadKindBoard(kind); }
    });
  }, [session, state, refreshFromCloud, loadKindBoard, patchPvp2]);

  const createAnimalChallenge = useCallback((kind, animalId, eventKey) => {
    const cfg = LIVESTOCK_CONFIG[kind];
    if (!session) { patchPvp2(kind, { msg: "Sign in to post a challenge." }); return; }
    const animal = state[cfg.arrayKey].find((a) => a.id === animalId);
    if (!animal) return;
    sb.from("challenges").insert({ creator_id: session.user.id, creator_name: state.kennelName, trial: eventKey, dog: animal, kind })
      .then(({ error }) => {
        if (error) patchPvp2(kind, { msg: error.message });
        else { patchPvp2(kind, { msg: "Challenge posted.", challengePick: { animalId: null, event: eventKey } }); loadKindBoard(kind); }
      });
  }, [session, state, loadKindBoard, patchPvp2]);

  const cancelAnimalChallenge = useCallback((kind, challenge) => {
    sb.from("challenges").update({ status: "cancelled" }).eq("id", challenge.id).eq("creator_id", session?.user?.id)
      .then(({ error }) => { if (!error) loadKindBoard(kind); else patchPvp2(kind, { msg: error.message }); });
  }, [session, loadKindBoard, patchPvp2]);

  const acceptAnimalChallenge = useCallback((kind, challenge, animalId) => {
    const cfg = LIVESTOCK_CONFIG[kind];
    if (!session) { patchPvp2(kind, { msg: "Sign in to accept a challenge." }); return; }
    const animal = state[cfg.arrayKey].find((a) => a.id === animalId);
    if (!animal) return;
    patchPvp2(kind, { msg: "Resolving…" });
    sb.rpc("accept_challenge", { p_challenge_id: challenge.id, p_dog: animal, p_opponent_name: state.kennelName, p_kind: kind }).then(({ data, error }) => {
      if (error) { patchPvp2(kind, { msg: error.message }); return; }
      const won = data && data.winner_id === session.user.id;
      patchPvp2(kind, { msg: won ? `You won by ${Math.round(data.margin)}!` : `You lost this one — margin ${Math.round(data.margin)}.` });
      refreshFromCloud(); loadKindBoard(kind);
    });
  }, [session, state, refreshFromCloud, loadKindBoard, patchPvp2]);

  const postAnimalStud = useCallback((kind, animalId, fee) => {
    const cfg = LIVESTOCK_CONFIG[kind];
    if (!session) { patchPvp2(kind, { msg: "Sign in to offer a stud." }); return; }
    const animal = state[cfg.arrayKey].find((a) => a.id === animalId);
    if (!animal) return;
    sb.from("stud_offers").insert({ owner_id: session.user.id, owner_name: state.kennelName, dog: animal, fee: Math.max(0, Math.round(Number(fee) || 0)), kind })
      .then(({ error }) => {
        if (error) patchPvp2(kind, { msg: error.message });
        else { patchPvp2(kind, { msg: `${animal.name} listed for stud.`, studPick: { animalId: null, fee: "" } }); loadKindBoard(kind); }
      });
  }, [session, state, loadKindBoard, patchPvp2]);

  const cancelAnimalStudOffer = useCallback((kind, offer) => {
    sb.from("stud_offers").update({ status: "cancelled" }).eq("id", offer.id).eq("owner_id", session?.user?.id)
      .then(({ error }) => { if (!error) loadKindBoard(kind); else patchPvp2(kind, { msg: error.message }); });
  }, [session, loadKindBoard, patchPvp2]);

  const requestAnimalStud = useCallback((kind, offer, damId) => {
    const cfg = LIVESTOCK_CONFIG[kind];
    if (!session) { patchPvp2(kind, { msg: "Sign in to request a breeding." }); return; }
    const dam = state[cfg.arrayKey].find((a) => a.id === damId);
    if (!dam) return;
    sb.from("stud_requests").insert({
      offer_id: offer.id, owner_id: offer.owner_id, owner_name: offer.owner_name,
      requester_id: session.user.id, requester_name: state.kennelName,
      stud: offer.dog, dam, fee: offer.fee, kind,
    }).then(({ error }) => {
      if (error) patchPvp2(kind, { msg: error.message });
      else { patchPvp2(kind, { msg: `Sent a breeding request to ${offer.owner_name}.` }); loadKindBoard(kind); }
    });
  }, [session, state, loadKindBoard, patchPvp2]);

  const declineAnimalStudRequest = useCallback((kind, request) => {
    sb.from("stud_requests").update({ status: "declined" }).eq("id", request.id).eq("owner_id", session?.user?.id)
      .then(({ error }) => { if (!error) loadKindBoard(kind); else patchPvp2(kind, { msg: error.message }); });
  }, [session, loadKindBoard, patchPvp2]);

  const acceptAnimalStudRequestAction = useCallback((kind, request) => {
    const cfg = LIVESTOCK_CONFIG[kind];
    if (!session) return;
    const offspring = cfg.breed(request.stud, request.dam, state.day + 1, null);
    patchPvp2(kind, { msg: "Resolving the breeding…" });
    sb.rpc("accept_stud_request", { p_request_id: request.id, p_pups: [offspring], p_kind: kind }).then(({ data, error }) => {
      if (error) { patchPvp2(kind, { msg: error.message }); return; }
      const gotIt = data.litter_summary.ownerKept > 0;
      patchPvp2(kind, { msg: gotIt ? "Your side had the better-rated parent — you kept the offspring." : `${request.requester_name}'s side rated higher — they kept the offspring.` });
      refreshFromCloud(); loadKindBoard(kind);
    });
  }, [session, state, refreshFromCloud, loadKindBoard, patchPvp2]);

  const cloudAuthEl = (
    <CloudAuthPanel
      session={session} cloudStatus={cloudStatus} open={cloudPanelOpen} onToggle={toggleCloudPanel}
      authMode={authMode} setAuthMode={setAuthMode} authEmail={authEmail} setAuthEmail={setAuthEmail}
      authPassword={authPassword} setAuthPassword={setAuthPassword} authMsg={authMsg}
      onSubmit={handleAuthSubmit} onSignOut={handleSignOut} onGoogle={handleGoogleSignIn}
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
    const recovery = up.vetShed ? 7 : 4.5;
    const healSpeed = up.vetShed ? 1.6 : 1;
    // Feed scales with the dog — a 200lb Boerboel does not eat like a Feist.
    const upkeep = Math.round(prev.dogs.reduce((sum, d) => sum + feedCostPerDay(d, up), 0) * days);
    next.cash = Math.round((prev.cash - upkeep) * 100) / 100;

    const deaths = [];
    const whelped = [];
    const healed = [];
    next.dogs = prev.dogs.map((d) => {
      const ov = overrides[d.id];
      let health = d.health + recovery * days;
      let cooldown = Math.max(0, d.breedCooldown - days);
      if (ov && typeof ov.healthDelta === "number") health = d.health + ov.healthDelta;
      if (ov && typeof ov.cooldownSet === "number") cooldown = ov.cooldownSet;

      // Injuries tick down on their own clock and block work until healed.
      let injury = ov && ov.injury !== undefined ? ov.injury : d.injury;
      if (injury && injury.daysLeft > 0) {
        const left = injury.daysLeft - days * healSpeed;
        if (left <= 0) { healed.push({ name: d.name, key: injury.key }); injury = null; }
        else injury = { ...injury, daysLeft: left };
      }

      // Gestation.
      let pregnant = d.pregnantDaysLeft;
      if (typeof pregnant === "number" && pregnant > 0) {
        pregnant = pregnant - days;
        if (pregnant <= 0) { whelped.push(d.id); pregnant = 0; }
      }

      const aged = { ...d, ageDays: d.ageDays + days, health: clamp(health), breedCooldown: cooldown, injury, pregnantDaysLeft: pregnant };

      // Old age. Rolled per day so a long rest doesn't dodge the odds.
      for (let i = 0; i < days; i++) {
        if (Math.random() < deathChancePerDay(aged)) { deaths.push(aged); return null; }
      }
      return aged;
    }).filter(Boolean);

    next.pendingWhelps = whelped;

    // Livestock ages on the same clock as the dogs.
    const horseAged = ageLivestock(prev.horses, "horse", days, recovery);
    const cattleAged = ageLivestock(prev.cattle, "cattle", days, recovery);
    next.horses = horseAged.survivors;
    next.cattle = cattleAged.survivors;
    const stockDeaths = [
      ...horseAged.deaths.map((a) => ({ ...a, kind: "horse" })),
      ...cattleAged.deaths.map((a) => ({ ...a, kind: "cattle" })),
    ];
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

    // Anything that happened on its own while time passed gets its own line.
    healed.forEach((h) => {
      next = addLog(next, "info", `${h.name} is sound again — the ${(INJURIES[h.key] || {}).label || "injury"} has healed up.`);
    });
    deaths.forEach((d) => {
      const yrs = Math.floor(d.ageDays / 365);
      next = addLog(next, "injury", `${d.name} passed away at ${yrs}. ${d.sex === "M" ? "He" : "She"} left ${d.bloodline ? "the " + d.bloodline + " line" : "a mark on this yard"}.`);
    });
    stockDeaths.forEach((a) => {
      const yrs = Math.floor((a.ageDays || 0) / 365);
      next = addLog(next, "injury", `${a.name} — the ${a.breed} ${a.kind === "horse" ? "horse" : "cow"} — died of old age at ${yrs}.`);
    });

    // Season turnover is worth calling out — it changes how everything hunts.
    if (seasonIndex(next.day) !== seasonIndex(prev.day)) {
      const s = seasonFor(next.day);
      next = addLog(next, "info", `${s.label} has come to the county. ${s.blurb}`);
    }

    // You can't feed dogs on money you don't have. Rather than let the balance
    // run arbitrarily negative, the weakest dogs go to pet homes until the
    // books balance — the last dog always stays.
    while (next.cash < 0 && next.dogs.length > 1) {
      const sorted = next.dogs.slice().sort((a, b) => computeValue(a) - computeValue(b));
      const going = sorted[0];
      const raised = Math.round(computeValue(going) * 0.5);
      next.cash = Math.round(next.cash + raised);
      next.dogs = next.dogs.filter((d) => d.id !== going.id);
      next = addLog(next, "money", `Couldn't cover the feed bill — ${going.name} went to a pet home for ${fmtMoney(raised)}.`);
    }
    if (next.cash < 0) {
      next.cash = 0;
      next = addLog(next, "money", "The feed store carried you this week. You're broke — go hunt something.");
    }
    return next;
  }

  // Takes the dog explicitly. It used to read huntPick.dogId, which a caller
  // set via setState in the same tick — so the first click ran nothing and
  // every click after it ran the *previous* dog.
  function doHunt(dogId, huntKey) {
    const id = dogId || huntPick.dogId;
    const key = huntKey || huntPick.hunt;
    const dog = state.dogs.find((d) => d.id === id);
    if (!dog) return;
    const hunt = HUNTS[key];
    const result = resolveHunt(dog, key, state.day);
    const weightLbs = catchWeight(key, result.tier);
    const payout = key === "hog" && weightLbs ? hogPayout(weightLbs) : result.payout;
    update((prev) => {
      let next = tick(prev, 1, { [dog.id]: { healthDelta: -result.healthLoss, injury: result.injury || dog.injury || null } });
      next.cash = Math.round(next.cash + payout);
      if (result.tier !== "Poor") {
        next.catches = [...next.catches, { id: genId(), day: prev.day + 1, kennelName: prev.kennelName, dogName: dog.name, breed: dog.breed, huntType: hunt.label, tier: result.tier, weightLbs, payout }]
          .sort((a, b) => (b.weightLbs || b.payout) - (a.weightLbs || a.payout)).slice(0, 25);
      }
      return addLog(next, result.injured ? "injury" : "hunt", huntReport(dog, hunt, result, payout, weightLbs, prev.day));
    });
  }

  function doGroupHunt(dogIds) {
    const dogs = state.dogs.filter((d) => dogIds.includes(d.id));
    if (dogs.length < 2) return;
    const avgStats = {};
    STAT_KEYS.forEach((k) => (avgStats[k] = dogs.reduce((s, d) => s + d.stats[k], 0) / dogs.length));
    const result = resolveHunt({ stats: avgStats, ageDays: AGE_PRIME_START + 1 }, "hog", state.day);
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
    const result = resolveHunt(dog, "hog", state.day);
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
      const winsBefore = myDog.trialWins || 0;
      const winsAfter = winsBefore + (result.won ? 1 : 0);
      next.dogs = next.dogs.map((d) => d.id === myDog.id
        ? { ...d, trialWins: winsAfter, stats: { ...d.stats, grip: clamp(d.stats.grip + gain), conformation: clamp(d.stats.conformation + gain) } }
        : d);
      const prevTier = fameTier(prev.fame || 0);
      next.fame = (prev.fame || 0) + fameGain;
      const newTier = fameTier(next.fame);
      const msg = result.won
        ? `${myDog.name} beat ${oppDog.name} (${oppDog.kennelName}) at the ${trial.label.toLowerCase()} by ${result.margin} points — won ${fmtMoney(purse)}. Training's paying off — ${myDog.name} put on some muscle.`
        : `${myDog.name} lost to ${oppDog.name} (${oppDog.kennelName}) at the ${trial.label.toLowerCase()} by ${result.margin} points — entry fee cost ${fmtMoney(Math.round(purse * 0.3))}.`;
      next = addLog(next, result.won ? "money" : "injury", msg);
      // A title is permanent and shows on the dog's name from here on.
      const earnedBefore = titleFor(winsBefore), earnedAfter = titleFor(winsAfter);
      if (earnedAfter && (!earnedBefore || earnedBefore.key !== earnedAfter.key)) {
        next = addLog(next, "catch", `🏆 ${myDog.name} has earned the title of ${earnedAfter.label} — ${winsAfter} wins on the board. Known as ${earnedAfter.key} ${myDog.name} from here on.`);
      }
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
    const litter = breedPuppies(sire, dam, state.day + 1, bloodline);
    const room = Math.max(0, dogCapacity - state.dogs.length);
    update((prev) => {
      let next = tick(prev, 1, { [sire.id]: { cooldownSet: 10, healthDelta: 0 }, [dam.id]: { cooldownSet: 45, healthDelta: -14 } });
      if (foundedName) {
        next.dogs = next.dogs.map((d) => (d.id === sire.id || d.id === dam.id) ? { ...d, bloodline: foundedName } : d);
      }
      return next;
    });
    let note = "";
    if (foundedName) note += ` Founded the ${foundedName} bloodline.`;
    if (litter.inbred) note += " Close breeding — litter came in below par.";
    if (litter.doubleMerleWarned) note += " At least one double-merle pup — those carry real risk of deafness or vision problems.";
    if (litter.doubleMuscledCount) note += ` ${litter.doubleMuscledCount} double-muscled (MSTN/MSTN) pup${litter.doubleMuscledCount > 1 ? "s" : ""} — dramatic power, less endurance.`;
    if (litter.culledCount) note += ` ${litter.culledCount} pup${litter.culledCount > 1 ? "s" : ""} came out below standard — not every one in a litter makes the grade.`;
    if (litter.grewBiggerCount) note += ` ${litter.grewBiggerCount} pup${litter.grewBiggerCount > 1 ? "s" : ""} threw a growth mutation — noticeably bigger than expected.`;
    setPendingLitter({ pups: litter.pups, room, note, label: `${sire.name} × ${dam.name}` });
    setSelectedPupIds(litter.pups.slice(0, room).map((p) => p.id));
    setBreedPick({ sireId: null, damId: null });
    setNewBloodline("");
  }

  function doStudService(dam, stud) {
    const fee = studFee(stud);
    if (state.cash < fee) return;
    const bloodline = dam.bloodline || null;
    const litter = breedPuppies(stud, dam, state.day + 1, bloodline);
    const room = Math.max(0, dogCapacity - state.dogs.length);
    update((prev) => {
      let next = tick(prev, 1, { [dam.id]: { cooldownSet: 45, healthDelta: -14 } });
      next.cash = Math.round((next.cash - fee) * 100) / 100;
      return next;
    });
    let note = litter.doubleMerleWarned ? " At least one double-merle pup — risk of deafness or vision problems." : "";
    if (litter.doubleMuscledCount) note += ` ${litter.doubleMuscledCount} double-muscled (MSTN/MSTN) pup${litter.doubleMuscledCount > 1 ? "s" : ""} — dramatic power, less endurance.`;
    if (litter.culledCount) note += ` ${litter.culledCount} pup${litter.culledCount > 1 ? "s" : ""} came out below standard — not every one in a litter makes the grade.`;
    if (litter.grewBiggerCount) note += ` ${litter.grewBiggerCount} pup${litter.grewBiggerCount > 1 ? "s" : ""} threw a growth mutation — noticeably bigger than expected.`;
    setPendingLitter({ pups: litter.pups, room, note, label: `${dam.name} × ${stud.name} out of ${stud.kennelName} (stud fee ${fmtMoney(fee)})` });
    setSelectedPupIds(litter.pups.slice(0, room).map((p) => p.id));
    setStudDamId(null);
  }

  function confirmLitter() {
    if (!pendingLitter) return;
    const { pups, room, note, label } = pendingLitter;
    const keepIds = selectedPupIds.slice(0, room);
    update((prev) => {
      const kept = pups.filter((p) => keepIds.includes(p.id));
      const overflow = pups.filter((p) => !keepIds.includes(p.id));
      const overflowValue = overflow.reduce((s, p) => s + Math.round(computeValue(p) * 0.5), 0);
      let next = { ...prev, dogs: [...prev.dogs, ...kept], cash: Math.round((prev.cash + overflowValue) * 100) / 100 };
      const names = pups.map((p) => p.name).join(", ");
      let fullNote = note;
      if (overflow.length) fullNote += ` ${overflow.length} pup${overflow.length > 1 ? "s" : ""} not kept — placed in pet homes for ${fmtMoney(overflowValue)}.`;
      return addLog(next, "breed", `${label} whelped ${pups.length}: ${names}.${fullNote}`);
    });
    setPendingLitter(null);
    setSelectedPupIds([]);
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
  function buyProperty(landKey, houseKey, location) {
    const land = LAND_SIZES.find((l) => l.key === landKey);
    const house = HOUSE_TYPES.find((h) => h.key === houseKey);
    if (!land || !house) return;
    const price = land.price + house.price;
    if (state.cash < price) return;
    const property = { landKey, houseKey, location, pastureKey: state.property.pastureKey || "none" };
    if (propertyCapacity(property) <= dogCapacity) return;
    update((prev) => {
      const next = { ...prev, cash: Math.round((prev.cash - price) * 100) / 100, property };
      return addLog(next, "money", `Moved to ${propertyLabel(property)} — kennel capacity is now ${propertyCapacity(property)} dogs (paid ${fmtMoney(price)}).`);
    });
  }
  function buyPasture(pastureKey) {
    const tier = PASTURE_TIERS.find((p) => p.key === pastureKey);
    const land = LAND_SIZES.find((l) => l.key === state.property.landKey);
    if (!tier || !land || land.acres < tier.minAcres || state.cash < tier.price || tier.capacity <= livestockCapacity(state)) return;
    update((prev) => {
      const property = { ...prev.property, pastureKey };
      return addLog({ ...prev, cash: Math.round((prev.cash - tier.price) * 100) / 100, property }, "money", `Built out ${tier.label} — room for ${tier.capacity} head (paid ${fmtMoney(tier.price)}).`);
    });
  }
  function buyTruck(truckKey) {
    const truck = TRUCKS.find((t) => t.key === truckKey);
    if (!truck || state.cash < truck.price) return;
    update((prev) => addLog({ ...prev, cash: Math.round((prev.cash - truck.price) * 100) / 100, truck: truckKey }, "money", `Bought a ${truck.label} for ${fmtMoney(truck.price)}.`));
  }
  function buyTrailer(trailerKey) {
    const trailer = TRAILERS.find((t) => t.key === trailerKey);
    if (!trailer || state.cash < trailer.price) return;
    update((prev) => addLog({ ...prev, cash: Math.round((prev.cash - trailer.price) * 100) / 100, trailer: trailerKey }, "money", `Bought a ${trailer.label} for ${fmtMoney(trailer.price)}.`));
  }
  function doBuyAnimal(kind, marketAnimal) {
    const cfg = LIVESTOCK_CONFIG[kind];
    if (state.cash < marketAnimal.price) return;
    if (livestockCount(state) >= livestockCapacity(state)) return;
    update((prev) => {
      const { price, listedDay, sellerName, ...animal } = marketAnimal;
      let next = {
        ...prev, cash: Math.round((prev.cash - price) * 100) / 100,
        [cfg.arrayKey]: [...prev[cfg.arrayKey], animal],
        [cfg.marketKey]: prev[cfg.marketKey].filter((m) => m.id !== marketAnimal.id),
      };
      return addLog(next, "money", `Bought ${animal.name} (${animal.breed})${sellerName ? " from " + sellerName : ""} for ${fmtMoney(price)}.`);
    });
  }
  function scoutAnimalMarket(kind) {
    const cfg = LIVESTOCK_CONFIG[kind];
    update((prev) => addLog({ ...prev, [cfg.marketKey]: [...prev[cfg.marketKey], ...generateAnimalMarket(kind, 3, prev.day)].slice(-24) }, "info", `Scouted new ${cfg.labelPlural.toLowerCase()} at the market.`));
  }
  function doSellAnimal(kind, animal, atAuction) {
    const cfg = LIVESTOCK_CONFIG[kind];
    if (atAuction && !canHaul(state)) return;
    const value = atAuction && cfg.auctionValue ? cfg.auctionValue(animal) : cfg.value(animal);
    update((prev) => addLog(
      { ...prev, cash: Math.round(prev.cash + value), [cfg.arrayKey]: prev[cfg.arrayKey].filter((a) => a.id !== animal.id) },
      "money", `${atAuction ? "Auctioned" : "Sold"} ${animal.name} for ${fmtMoney(value)}.`
    ));
  }
  function doBreedAnimal(kind, sireId, damId) {
    const cfg = LIVESTOCK_CONFIG[kind];
    const sire = state[cfg.arrayKey].find((a) => a.id === sireId);
    const dam = state[cfg.arrayKey].find((a) => a.id === damId);
    if (!sire || !dam) return;
    const offspring = cfg.breed(sire, dam, state.day + 1, null);
    update((prev) => {
      let next = {
        ...prev,
        [cfg.arrayKey]: prev[cfg.arrayKey].map((a) =>
          a.id === sire.id ? { ...a, breedCooldown: cfg.breedCooldownSire }
          : a.id === dam.id ? { ...a, breedCooldown: cfg.breedCooldownDam, health: Math.max(0, a.health - cfg.breedHealthCost) }
          : a),
      };
      if (livestockCount(next) >= livestockCapacity(next)) {
        const half = Math.round(cfg.value(offspring) * 0.5);
        next.cash = Math.round((next.cash + half) * 100) / 100;
        return addLog(next, "breed", `${sire.name} × ${dam.name} produced ${offspring.name} — no pasture room, placed with a buyer for ${fmtMoney(half)}.`);
      }
      next[cfg.arrayKey] = [...next[cfg.arrayKey], offspring];
      return addLog(next, "breed", `${sire.name} × ${dam.name} produced ${offspring.name}, a ${offspring.breed}.`);
    });
  }
  function doEnterShow(kind, animal, eventKey) {
    const cfg = LIVESTOCK_CONFIG[kind];
    if (!canHaul(state)) return;
    const ev = cfg.events[eventKey];
    const oppBreed = cfg.breedNames[randInt(0, cfg.breedNames.length - 1)];
    const opp = cfg.generate(oppBreed, state.day);
    const purse = Math.round(40 + cfg.value(animal) * 0.03);

    // Timed events hand control to the player via the timing mini-game
    // before the clock gets read; judged events resolve the same way they
    // always have.
    if (ev.timed) {
      setRaceGame({ kind, animal, eventKey, ev, opp, purse });
      return;
    }
    resolveShow(kind, animal, eventKey, ev, opp, purse, null);
  }
  // Shared resolution for both judged shows and timed races. `qualities` is
  // the array of 3 timing-round results ("perfect"/"good"/"ok"/"miss") from
  // the mini-game, or null for judged events / if the player skipped it.
  function resolveShow(kind, animal, eventKey, ev, opp, purse, qualities) {
    const cfg = LIVESTOCK_CONFIG[kind];
    let myTime = raceTime(kind, animal, ev);
    const oppTime = myTime !== null ? raceTime(kind, opp, ev) : null;
    if (myTime !== null && qualities && qualities.length) {
      // Average the per-round time multipliers and nudge the base sim time
      // by it — great timing shaves real seconds off, a fumble costs them.
      const avgMult = qualities.reduce((sum, q) => sum + RACE_QUALITY[q].timeMult, 0) / qualities.length;
      myTime = Math.max(ev.timed.floor, myTime * (1 + avgMult));
    }
    const won = myTime !== null
      ? myTime <= oppTime
      : statScore(animal.stats, ev.weights) + rand(-12, 12) >= statScore(opp.stats, ev.weights) + rand(-12, 12);

    const oldBest = myTime !== null ? personalBest(state, eventKey) : null;
    const isPB = myTime !== null && (!oldBest || myTime < oldBest.seconds);

    update((prev) => {
      let next = { ...prev, fame: prev.fame + (won ? 3 : 1) };
      if (won) next.cash = Math.round((next.cash + purse) * 100) / 100;

      if (myTime !== null) {
        if (isPB) {
          next = withPersonalBest(next, eventKey, {
            seconds: myTime, horseName: animal.name, breed: animal.breed, day: prev.day,
          });
        }
        next = addLog(next, won ? "money" : "info",
          `${animal.name} ran ${formatRaceTime(myTime)} at the ${ev.label.toLowerCase()} — ${won ? "beat" : "behind"} ${opp.name} on ${formatRaceTime(oppTime)}${won ? `, purse ${fmtMoney(purse)}` : ""}.`);
        if (isPB) {
          next = addLog(next, "catch", `⏱ Personal best — ${animal.name} took ${formatRaceTime(myTime)} at the ${ev.label.toLowerCase()}${oldBest ? `, off ${formatRaceTime(oldBest.seconds)}` : ""}.`);
        }
      } else {
        next = addLog(next, won ? "money" : "info",
          `${animal.name} ${won ? "won" : "placed behind"} ${opp.name} the ${opp.breed} at the ${ev.label}${won ? ` — purse ${fmtMoney(purse)}` : ""}.`);
      }
      return next;
    });

    // Only a personal best is worth the round trip to the shared board.
    if (isPB && session) {
      sb.from("race_records").insert({
        user_id: session.user.id, event: eventKey, seconds: myTime,
        horse_name: animal.name, horse_breed: animal.breed, kennel_name: state.kennelName,
      }).then(() => loadRaceLeaders());
    }
    return { myTime, oppTime, won, purse, opp, isPB };
  }
  function finishRaceGame(qualities) {
    if (!raceGame) return;
    const { kind, animal, eventKey, ev, opp, purse } = raceGame;
    const outcome = resolveShow(kind, animal, eventKey, ev, opp, purse, qualities);
    // Keep the modal up one more beat so the player sees what their timing
    // actually earned them, instead of it just vanishing into the log.
    setRaceGame((prev) => (prev ? { ...prev, outcome } : prev));
  }
  function doBuy(marketDog) {
    if (state.cash < marketDog.price) return;
    if (state.dogs.length >= kennelCapacity(state)) return;
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
    if (state.dogs.length >= kennelCapacity(state)) return;
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

  const dogCapacity = kennelCapacity(state);
  const kennelFull = state.dogs.length >= dogCapacity;
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

  /* Every screen, rendered the same in either layout. Only the chrome
     around them differs, so nothing can drift between the two. */
  const screens = (
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
                    <button key={l.id} className={"kg-subtab " + (layout === l.id ? "kg-subtab--active" : "")}
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
                        <button className={"kg-subtab " + (theme === "dark" ? "kg-subtab--active" : "")} onClick={() => setTheme("dark")}>Night</button>
                        <button className={"kg-subtab " + (theme === "light" ? "kg-subtab--active" : "")} onClick={() => setTheme("light")}>Day</button>
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
                          <button key={l.id} className={"kg-subtab " + (layout === l.id ? "kg-subtab--active" : "")}
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
                        <button className={"kg-subtab " + ((!profile || profile.show_on_leaderboard !== false) ? "kg-subtab--active" : "")}
                          disabled={accountBusy} onClick={() => saveProfile({ show_on_leaderboard: true })}>Public</button>
                        <button className={"kg-subtab " + ((profile && profile.show_on_leaderboard === false) ? "kg-subtab--active" : "")}
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
            <h2 className="kg-subhead">Pick an opponent</h2>
            {competitors.length === 0 ? <p className="kg-empty">No competitors available right now — check back after a day passes.</p> : (
              <div className="kg-rows">
                {competitors.map((opp) => {
                  const myDog = state.dogs.find((d) => d.id === trialPick.dogId);
                  return (
                    <DogRow key={opp.id} dog={opp} onView={setViewDog} sellerName={"out of " + opp.kennelName}
                      right={<button className="kg-btn kg-btn--sm" disabled={!myDog} onClick={() => doTrial(myDog, opp)}>
                        {!myDog ? "Pick your dog first" : `Enter — ${fmtMoney(trialPurse(myDog, opp))}`}
                      </button>} />
                  );
                })}
              </div>
            )}
          </section>
        )}

        {tab === "horses" && (
          <LivestockPanel kind="horse" state={state} session={session} pvp={pvp2.horse} patch={(p) => patchPvp2("horse", p)} cloudAuthEl={cloudAuthEl} setViewAnimal={setViewAnimal}
            doBuyAnimal={doBuyAnimal} scoutAnimalMarket={scoutAnimalMarket} doSellAnimal={doSellAnimal} doBreedAnimal={doBreedAnimal} doEnterShow={doEnterShow}
            listAnimalForSale={listAnimalForSale} cancelAnimalListing={cancelAnimalListing} buyAnimalListing={buyAnimalListing}
            createAnimalChallenge={createAnimalChallenge} cancelAnimalChallenge={cancelAnimalChallenge} acceptAnimalChallenge={acceptAnimalChallenge}
            postAnimalStud={postAnimalStud} cancelAnimalStudOffer={cancelAnimalStudOffer} requestAnimalStud={requestAnimalStud}
            declineAnimalStudRequest={declineAnimalStudRequest} acceptAnimalStudRequestAction={acceptAnimalStudRequestAction} />
        )}

        {tab === "cattle" && (
          <LivestockPanel kind="cattle" state={state} session={session} pvp={pvp2.cattle} patch={(p) => patchPvp2("cattle", p)} cloudAuthEl={cloudAuthEl} setViewAnimal={setViewAnimal}
            doBuyAnimal={doBuyAnimal} scoutAnimalMarket={scoutAnimalMarket} doSellAnimal={doSellAnimal} doBreedAnimal={doBreedAnimal} doEnterShow={doEnterShow}
            listAnimalForSale={listAnimalForSale} cancelAnimalListing={cancelAnimalListing} buyAnimalListing={buyAnimalListing}
            createAnimalChallenge={createAnimalChallenge} cancelAnimalChallenge={cancelAnimalChallenge} acceptAnimalChallenge={acceptAnimalChallenge}
            postAnimalStud={postAnimalStud} cancelAnimalStudOffer={cancelAnimalStudOffer} requestAnimalStud={requestAnimalStud}
            declineAnimalStudRequest={declineAnimalStudRequest} acceptAnimalStudRequestAction={acceptAnimalStudRequestAction} />
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

  if (layout === "frame") {
    const openMenu = menuFor(tab);
    const groups = siblingsFor(tab, adminUnlocked);
    return (
      <div className="kg-app kg-app--frame">
        {/* Top strip: identity on the left, account on the right. */}
        <div className="kg-topstrip">
          <div className="kg-topstrip__inner">
            <img className="kg-topstrip__logo" src="assets/logo-mark.png" alt="" width="96" height="96" />
            <span className="kg-topstrip__word">Sundown Kennels</span>
            <div className="kg-topstrip__right">
              {themeToggleEl}
              {cloudAuthEl}
            </div>
          </div>
        </div>

        {/* Menu bar of dropdowns. Hover or focus opens; clicking a link navigates. */}
        <nav className="kg-menubar" aria-label="Main">
          <div className="kg-menubar__inner">
            {MENUS.map((m) => (
              <div key={m.id} className={"kg-menu " + (openMenu && openMenu.id === m.id ? "kg-menu--current" : "")}>
                <button className="kg-menu__btn" onClick={(e) => { setTab(m.columns[0].items[0].id); e.currentTarget.blur(); }}>
                  <span aria-hidden="true">{m.icon}</span> {m.label}
                </button>
                <div className="kg-menu__panel" role="menu">
                  {m.columns.map((col) => (
                    <div key={col.heading} className="kg-menu__col">
                      <p className="kg-menu__heading">{col.heading}</p>
                      {col.items.map((it) => (
                        <button key={it.id} role="menuitem"
                          className={"kg-menu__item " + (tab === it.id ? "kg-menu__item--active" : "")}
                          onClick={(e) => { setTab(it.id); e.currentTarget.blur(); }}>{it.label}</button>
                      ))}
                    </div>
                  ))}
                  {m.id === "account" && adminUnlocked && (
                    <div className="kg-menu__col">
                      <p className="kg-menu__heading">Tools</p>
                      <button role="menuitem" className={"kg-menu__item " + (tab === "admin" ? "kg-menu__item--active" : "")} onClick={(e) => { setTab("admin"); e.currentTarget.blur(); }}>Admin</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* The bordered page. Sidebar, content, info rail. */}
        <div className="kg-page">
          <aside className="kg-side">
            {groups.map((g) => (
              <div key={g.heading} className="kg-side__group">
                <p className="kg-side__heading">{g.heading}</p>
                {g.items.map((it) => (
                  <button key={it.id} className={"kg-side__link " + (tab === it.id ? "kg-side__link--active" : "")}
                    onClick={() => setTab(it.id)}>{it.label}</button>
                ))}
              </div>
            ))}
          </aside>

          <main className="kg-page__main">
            {saveError && <div className="kg-savewarn">Couldn't save progress just now — keep playing, it'll retry.</div>}
            {storageMode === "memory" && <div className="kg-notice">This browser is blocking local storage, so progress won't be saved between visits.</div>}
            {screens}
          </main>

          <aside className="kg-rail">
            <div className="kg-rail__box">
              <p className="kg-rail__title">Game Time</p>
              <p className="kg-rail__big">{seasonLabel(state.day)}</p>
              <p className="kg-rail__sub">Day {state.day} · Year {yearOf(state.day)}</p>
            </div>
            <div className="kg-rail__box">
              <p className="kg-rail__title">{editingName ? "Rename" : "Your Kennel"}</p>
              {editingName ? (
                <div className="kg-rename">
                  <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={28} onKeyDown={(e) => e.key === "Enter" && renameKennel()} />
                  <button className="kg-iconbtn" onClick={renameKennel} aria-label="Save name">✓</button>
                </div>
              ) : (
                <button className="kg-rail__kennel" onClick={() => { setNameDraft(state.kennelName); setEditingName(true); }} title="Rename your kennel">
                  {state.kennelName}<span className="kg-header__pencil" aria-hidden="true">✎</span>
                </button>
              )}
              <ul className="kg-rail__list">
                <li><span>Cash</span><strong className="kg-rail__cash">{fmtMoney(state.cash)}</strong></li>
                <li><span>Dogs</span><strong>{state.dogs.length} / {dogCapacity}</strong></li>
                <li><span>Fame</span><strong>{fameTier(state.fame || 0).label}</strong></li>
                <li><span>Net worth</span><strong>{fmtMoney(netWorth)}</strong></li>
              </ul>
            </div>
            <div className="kg-rail__box">
              <p className="kg-rail__title">Quick</p>
              <button className="kg-btn kg-btn--sm2" style={{ width: "100%" }} onClick={restWeek}>Rest a Week</button>
              <button className="kg-btn kg-btn--sm2 kg-btn--ghost" style={{ width: "100%", marginTop: 6 }} onClick={() => setTab("hunt")}>Go hunting</button>
              <button className="kg-btn kg-btn--sm2 kg-btn--ghost" style={{ width: "100%", marginTop: 6 }} onClick={() => setTab("market")}>Visit market</button>
            </div>
          </aside>
        </div>

        <DogProfileModal dog={viewDog} onClose={() => setViewDog(null)} />
        <AnimalProfileModal target={viewAnimal} onClose={() => setViewAnimal(null)} />
        <LitterPicker litter={pendingLitter} selectedIds={selectedPupIds} onConfirm={confirmLitter}
          onToggle={(id) => setSelectedPupIds((prev) => {
            if (prev.includes(id)) return prev.filter((x) => x !== id);
            if (pendingLitter && prev.length >= pendingLitter.room) return prev;
            return [...prev, id];
          })} />
        <RaceMiniGame pending={raceGame} onComplete={finishRaceGame} onCancel={() => setRaceGame(null)} />
      </div>
    );
  }

  return (
    <div className="kg-app">
      <header className="kg-header">
        <div className="kg-dusk" aria-hidden="true">
          <svg className="kg-dusk__trees" viewBox="0 0 1200 60" preserveAspectRatio="none" focusable="false">
            <path fill="currentColor" d="M0,60 L0,44 L14,30 L22,40 L34,18 L44,36 L56,26 L64,42 L78,22 L90,38 L100,28 L112,44 L126,24 L138,40 L150,32 L162,46 L176,20 L188,38 L200,30 L212,44 L226,26 L238,40 L250,34 L262,48 L276,24 L288,38 L300,28 L312,44 L326,22 L338,40 L350,30 L362,46 L376,26 L388,38 L400,32 L412,44 L426,20 L438,36 L450,28 L462,44 L476,24 L488,40 L500,30 L512,46 L526,26 L538,38 L550,34 L562,44 L576,22 L588,40 L600,28 L612,44 L626,24 L638,38 L650,32 L662,46 L676,26 L688,40 L700,30 L712,44 L726,20 L738,36 L750,30 L762,46 L776,24 L788,40 L800,28 L812,42 L826,26 L838,38 L850,34 L862,46 L876,22 L888,38 L900,30 L912,44 L926,24 L938,40 L950,28 L962,44 L976,26 L988,38 L1000,32 L1012,46 L1026,22 L1038,40 L1050,30 L1062,44 L1076,26 L1088,38 L1100,28 L1112,44 L1126,24 L1138,40 L1150,32 L1162,46 L1176,26 L1188,38 L1200,30 L1200,60 Z" />
          </svg>
        </div>
        <div className="kg-header__controls">
          {themeToggleEl}
          {cloudAuthEl}
        </div>

        <img className="kg-header__logo" src="assets/logo.png" alt="Sundown Kennels" width="400" height="400" />

        {editingName ? (
          <div className="kg-rename">
            <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={28} onKeyDown={(e) => e.key === "Enter" && renameKennel()} />
            <button className="kg-iconbtn" onClick={renameKennel} aria-label="Save name">✓</button>
          </div>
        ) : (
          <h1 className="kg-header__name">
            <button type="button" className="kg-header__namebtn" onClick={() => { setNameDraft(state.kennelName); setEditingName(true); }} title="Rename your kennel">
              {state.kennelName}<span className="kg-header__pencil" aria-hidden="true">✎</span>
            </button>
          </h1>
        )}

        <div className="kg-header__stats">
          <span className="kg-hstat">{seasonLabel(state.day)} · Day {state.day}</span>
          <span className="kg-hstat kg-hstat--cash">${state.cash.toLocaleString("en-US")}</span>
          <span className="kg-hstat">{state.dogs.length} / {dogCapacity} dogs</span>
          <button className="kg-btn kg-btn--ghost kg-btn--sm2" onClick={restWeek}>Rest a Week</button>
        </div>
      </header>

      {saveError && <div className="kg-savewarn">Couldn't save progress just now — keep playing, it'll retry.</div>}
      {storageMode === "memory" && <div className="kg-notice">This browser is blocking local storage, so progress won't be saved between visits.</div>}
      <div className="kg-notice">Eight other kennels around the county breed, hunt, and sell dogs on their own — their world moves forward whenever you hunt, breed, or rest a week.</div>

      <div className="kg-layout">
      <nav className="kg-tabs">
        {NAV.map((n, i) => {
          const active = n.id === tab || (n.children || []).some((c) => c.id === tab);
          return (
            <React.Fragment key={n.id}>
              {n.group && n.group !== (NAV[i - 1] || {}).group && <p className="kg-tabgroup">{n.group}</p>}
              <button className={"kg-tab " + (active ? "kg-tab--active" : "")} onClick={() => setTab(firstTabOf(n))}>
                <span className="kg-tab__icon" aria-hidden="true">{n.icon}</span>
                <span className="kg-tab__label">{n.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      <main className="kg-main">
        {(() => {
          const entry = navEntryFor(tab);
          const children = navChildrenFor(entry, adminUnlocked);
          if (!children) return null;
          return (
            <div className="kg-subtabs">
              {children.map((c) => (
                <button key={c.id} className={"kg-subtab " + (tab === c.id ? "kg-subtab--active" : "") + (c.id === "admin" ? " kg-subtab--admin" : "")} onClick={() => setTab(c.id)}>{c.label}</button>
              ))}
            </div>
          );
        })()}
        {screens}
      </main>
      </div>
      <DogProfileModal dog={viewDog} onClose={() => setViewDog(null)} />
      <AnimalProfileModal target={viewAnimal} onClose={() => setViewAnimal(null)} />
      <LitterPicker litter={pendingLitter} selectedIds={selectedPupIds} onConfirm={confirmLitter}
        onToggle={(id) => setSelectedPupIds((prev) => {
          if (prev.includes(id)) return prev.filter((x) => x !== id);
          if (pendingLitter && prev.length >= pendingLitter.room) return prev;
          return [...prev, id];
        })} />
      <RaceMiniGame pending={raceGame} onComplete={finishRaceGame} onCancel={() => setRaceGame(null)} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<KennelGame />);
