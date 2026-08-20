/* The main game component: all state, the day tick, every player action
   (hunting, breeding, trials, market, store, rescue, property), the
   Supabase multiplayer layer (trade, rivals, leaderboard), and every
   tab screen. */

function KennelGame() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  /* Which screen is showing comes from the address bar, not component state,
     so every screen has a shareable URL and the back button works. Declared
     below the admin flag it depends on — see the useRoute call. */
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
  const [groupSetup, setGroupSetup] = useState({ bayIds: [], catchIds: [] });
  const [groupHunt, setGroupHunt] = useState(null);
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
  // Which item the purchase modal is open on, if any.
  const [buyItemId, setBuyItemId] = useState(null);

  /* The route needs adminUnlocked to know whether /account/admin is allowed,
     which is why this sits here rather than at the top with the other state. */
  const route = useRoute(adminUnlocked);
  const tab = route.screen;
  const setTab = route.goToScreen;

  const [layout, setLayout] = useState(() => {
    // Homestead is the default now. Any layout already chosen is still
    // honoured, so nobody gets moved off the one they picked.
    try {
      const saved = window.localStorage.getItem(LAYOUT_KEY);
      return LAYOUTS.some((l) => l.id === saved) ? saved : "home";
    } catch { return "home"; }
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

  useEffect(() => {
    if (!groupHunt) return;
    if (groupHunt.phase !== "searching" && groupHunt.phase !== "traveling") return;
    const step = groupHunt.phase === "searching" ? stepSearch : stepTravel;
    // Scoped to this effect run, not a shared ref — the cleanup below can
    // only ever clear the interval this same run created.
    const intervalId = setInterval(() => {
      setGroupHunt((p) => (p && p.phase === groupHunt.phase ? step(p) : p));
    }, SEARCH_TICK_MS);
    return () => clearInterval(intervalId);
  }, [groupHunt && groupHunt.phase]);

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

  /* Owned animals get a real page at a real URL; anything from the market, a
     rival or a stud listing keeps the modal, because those live in transient
     lists and their ids do not survive a refresh.

     These sit up here with the other hooks rather than down beside the actions
     they belong with: KennelGame returns early while the save is loading, and a
     useCallback below that point runs on some renders and not others, which is
     a hook-order violation React fails outright on. */
  const openDogProfile = useCallback((dog) => {
    if (dog && state && (state.dogs || []).some((d) => d.id === dog.id)) {
      navigate("/animal/dog/" + encodeURIComponent(dog.id));
    } else setViewDog(dog);
  }, [state]);

  const openAnimalProfile = useCallback((target) => {
    const owned = target && target.animal &&
      ((state && state[target.kind === "horse" ? "horses" : "cattle"] || []).some((a) => a.id === target.animal.id));
    if (owned) navigate("/animal/" + target.kind + "/" + encodeURIComponent(target.animal.id));
    else setViewAnimal(target);
  }, [state]);

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
    // A flat wage scaling with level, so a mature kennel has a floor under it
    // and a bad hunting week is a setback rather than the start of a spiral.
    const wages = dailySalary(prev) * days;
    next.cash = Math.round((prev.cash - upkeep + wages) * 100) / 100;
    /* Savings sit apart from all of that. The upkeep above never touches them,
       which is the only reason the bank is worth using. */
    const savings = prev.savings || 0;
    next.savings = savings > 0
      ? Math.round(savings * Math.pow(1 + BANK_INTEREST_PER_DAY, days) * 100) / 100
      : savings;

    const deaths = [];
    const whelped = [];
    const healed = [];
    const results = [];
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

      // A full night's rest, not a trickle: the question each day is what this
      // dog does, never how long you wait for the bar to creep up.
      // Mood drifts down on its own; energy comes back in full. One is a thing
      // you keep on top of, the other a thing the night takes care of.
      const mood = Math.max(0, moodOf(d) - MOOD_DECAY_PER_DAY * days);
      const aged = { ...d, ageDays: d.ageDays + days, health: clamp(health), breedCooldown: cooldown, injury, pregnantDaysLeft: pregnant, energy: ENERGY_MAX, mood };

      // Old age. Rolled per day so a long rest doesn't dodge the odds.
      for (let i = 0; i < days; i++) {
        if (Math.random() < deathChancePerDay(aged)) { deaths.push(aged); return null; }
      }
      return aged;
    }).filter(Boolean);

    next.pendingWhelps = whelped;

    /* Anything entered on an earlier day is judged now.

       Deliberately after the dogs have been aged and rested above, so a result
       lands on the dog as it is today rather than as it was when it was
       entered. An entry whose dog has since died or been sold is dropped
       rather than paid out — next.dogs is the authority on who still exists. */
    {
      const due = (prev.entries || []).filter((e) => e.resolvesDay <= next.day);
      const held = (prev.entries || []).filter((e) => e.resolvesDay > next.day);
      let dogsAfter = next.dogs;
      let cashDelta = 0;
      let fameDelta = 0;

      for (const entry of due) {
        const myDog = dogsAfter.find((d) => d.id === entry.dogId);
        if (!myDog) continue;
        const trial = TRIALS[entry.trial];
        if (!trial) continue;

        const field = collectCompetitors(prev.aiKennels);
        const oppDog = field.length ? field[randInt(0, field.length - 1)] : myDog;
        // Mood is applied here rather than inside resolveTrial so the pure
        // scoring function stays a function of stats alone and remains testable.
        const result = resolveTrial(
          { ...myDog, stats: scaleStats(myDog.stats, moodMultiplier(myDog)) }, oppDog, entry.trial);
        const purse = trialPurse(myDog, oppDog);

        if (result.won) {
          cashDelta += purse;
          fameDelta += entry.trial === "show" ? 5 : 2;
        }

        const gain = result.won ? randInt(2, 4) : randInt(1, 2);
        const winsBefore = myDog.trialWins || 0;
        const winsAfter = winsBefore + (result.won ? 1 : 0);
        dogsAfter = dogsAfter.map((d) => d.id !== myDog.id ? d : {
          ...d,
          trialWins: winsAfter,
          health: clamp(d.health - result.healthLoss),
          stats: { ...d.stats, grip: clamp(d.stats.grip + gain), conformation: clamp(d.stats.conformation + gain) },
        });

        results.push({
          won: result.won,
          text: result.won
            ? `${myDog.name} won the ${trial.label.toLowerCase()} against ${oppDog.name} (${oppDog.kennelName}) by ${result.margin} — ${fmtMoney(purse)}.`
            : `${myDog.name} placed behind ${oppDog.name} (${oppDog.kennelName}) at the ${trial.label.toLowerCase()} by ${result.margin}.`,
        });

        const earnedBefore = titleFor(winsBefore), earnedAfter = titleFor(winsAfter);
        if (earnedAfter && (!earnedBefore || earnedBefore.key !== earnedAfter.key)) {
          results.push({
            won: true,
            text: `🏆 ${myDog.name} has earned the title of ${earnedAfter.label} — ${winsAfter} wins on the board.`,
          });
        }
      }

      next.dogs = dogsAfter;
      next.entries = held;
      if (cashDelta) next.cash = Math.round((next.cash + cashDelta) * 100) / 100;
      if (fameDelta) next.fame = (next.fame || prev.fame || 0) + fameDelta;
    }

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
    // Results first — they are what the player came back to read.
    results.forEach((r) => {
      next = addLog(next, r.won ? "money" : "info", r.text);
    });
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
    if (!hasEnergy(dog, "hunt")) return { ok: false, why: `${dog.name} is worn out for today.` };
    const hunt = HUNTS[key];
    const result = resolveHunt(dog, key, state.day);
    const weightLbs = catchWeight(key, result.tier);
    const basePayout = key === "hog" && weightLbs ? hogPayout(weightLbs) : result.payout;
    const payout = Math.round(basePayout * professionBonus(state, "houndsman"));
    update((prev) => {
      let next = tick(prev, 1, { [dog.id]: { healthDelta: -result.healthLoss, injury: result.injury || dog.injury || null } });
      next.cash = Math.round(next.cash + payout);
      // The tick refills every dog to full, so the cost of the hunt is taken
      // after it — otherwise a day's work would always come back free.
      next.dogs = next.dogs.map((d) => d.id === dog.id
        ? { ...d, energy: Math.max(0, ENERGY_MAX - ENERGY_COST.hunt) } : d);
      if (result.tier !== "Poor") {
        next.catches = [...next.catches, { id: genId(), day: prev.day + 1, kennelName: prev.kennelName, dogName: dog.name, breed: dog.breed, huntType: hunt.label, tier: result.tier, weightLbs, payout }]
          .sort((a, b) => (b.weightLbs || b.payout) - (a.weightLbs || a.payout)).slice(0, 25);
      }
      return addLog(next, result.injured ? "injury" : "hunt", huntReport(dog, hunt, result, payout, weightLbs, prev.day));
    });
  }

  function toggleBayPick(dogId) {
    setGroupSetup((p) => {
      if (p.bayIds.includes(dogId)) return { ...p, bayIds: p.bayIds.filter((id) => id !== dogId) };
      const limit = groupHuntLimit(state.fame || 0);
      if (p.bayIds.length >= limit.bay) return p;
      return { ...p, bayIds: [...p.bayIds, dogId], catchIds: p.catchIds.filter((id) => id !== dogId) };
    });
  }
  function toggleCatchPick(dogId) {
    setGroupSetup((p) => {
      if (p.catchIds.includes(dogId)) return { ...p, catchIds: p.catchIds.filter((id) => id !== dogId) };
      const limit = groupHuntLimit(state.fame || 0);
      if (p.catchIds.length >= limit.catch) return p;
      return { ...p, catchIds: [...p.catchIds, dogId], bayIds: p.bayIds.filter((id) => id !== dogId) };
    });
  }
  function doStartGroupHunt() {
    const bayDogs = state.dogs.filter((d) => groupSetup.bayIds.includes(d.id));
    const catchDogs = state.dogs.filter((d) => groupSetup.catchIds.includes(d.id));
    if (bayDogs.length < 1 || catchDogs.length < 1) return;
    const dogsById = {};
    [...bayDogs, ...catchDogs].forEach((d) => { dogsById[d.id] = d; });
    const dogZones = {};
    [...bayDogs, ...catchDogs].forEach((d) => { dogZones[d.id] = CAMP_ZONE; });
    setGroupHunt({
      phase: "searching",
      bayDogIds: bayDogs.map((d) => d.id),
      catchDogIds: catchDogs.map((d) => d.id),
      dogsById,
      dogZones,
      ticksElapsed: 0,
      travelTicks: 0,
      hog: rollHog(bayDogs, catchDogs),
      miniGame: null,
    });
  }

  // Applies a finished group hunt's outcome to the real, persisted kennel
  // state — same tick()/update()/addLog() mechanism every other hunt in the
  // game uses, just with per-role dog overrides and a shared catch-log line.
  function finishGroupHunt(outcome) {
    const { caught, calledOff, bayDogs, catchDogs, hog, hogHits } = outcome;
    // hogPayout() rolls a random $/lb, so it must be called exactly once per
    // hunt — every branch below reads this one value rather than re-rolling.
    const fullPayout = hogPayout(hog.weightLbs);
    const payout = caught ? fullPayout : calledOff ? Math.round(fullPayout * CALL_OFF_PAYOUT_PCT) : 0;
    const fameGain = caught ? 4 : calledOff ? 0 : 1;
    // Injury risk comes from how many hits the hog actually landed during
    // the mini-game, not from whether it was ultimately caught — a clean
    // fight sends every dog home sound either way.
    const injuryChance = calledOff ? 0 : hogHitInjuryChance(hogHits);
    update((prev) => {
      const overrides = {};
      bayDogs.forEach((d) => { overrides[d.id] = { healthDelta: -randInt(2, 8) }; });
      catchDogs.forEach((d) => {
        const hurt = Math.random() < injuryChance;
        overrides[d.id] = { healthDelta: hurt ? -randInt(15, 35) : -randInt(5, 15), injury: hurt ? rollInjury("hog") : undefined };
      });
      let next = tick(prev, 1, overrides);
      next.cash = Math.round(next.cash + payout);
      next.fame = (prev.fame || 0) + fameGain;
      if (caught) {
        const bayGain = randInt(1, 3), catchGain = randInt(1, 3);
        next.dogs = next.dogs.map((d) => {
          if (bayDogs.some((b) => b.id === d.id)) return { ...d, stats: { ...d.stats, nose: clamp(d.stats.nose + bayGain), speed: clamp(d.stats.speed + bayGain) } };
          if (catchDogs.some((c) => c.id === d.id)) return { ...d, stats: { ...d.stats, grip: clamp(d.stats.grip + catchGain), gameness: clamp(d.stats.gameness + catchGain) } };
          return d;
        });
      }
      const names = [...bayDogs, ...catchDogs].map((d) => d.name).join(", ");
      if (caught) {
        next.catches = [...next.catches, { id: genId(), day: prev.day + 1, kennelName: prev.kennelName, dogName: `${names} (group hunt)`, breed: "Group Hunt", huntType: "Hog Hunt", tier: hog.tier, weightLbs: hog.weightLbs, payout }]
          .sort((a, b) => (b.weightLbs || b.payout) - (a.weightLbs || a.payout)).slice(0, 25);
      }
      const msg = calledOff
        ? `Called the pack (${names}) off a bayed hog rather than risk it — banked ${fmtMoney(payout)} for the find.`
        : caught
        ? `The pack (${names}) bayed and caught a ${hog.weightLbs}lb hog — earned ${fmtMoney(payout)}.`
        : `The pack (${names}) had a hog bayed but it fought free before the catch dogs could finish it.`;
      return addLog(next, caught ? "hunt" : calledOff ? "info" : "injury", msg);
    });
    setGroupSetup({ bayIds: [], catchIds: [] });
    return payout;
  }

  function doCallOffGroupHunt() {
    const bayDogs = groupHunt.bayDogIds.map((id) => groupHunt.dogsById[id]);
    const payout = finishGroupHunt({ caught: false, calledOff: true, bayDogs, catchDogs: [], hog: groupHunt.hog, hogHits: 0 });
    setGroupHunt((p) => (p ? { ...p, phase: "results", result: { calledOff: true, payout } } : p));
  }

  function doReleaseCatchDogs() {
    setGroupHunt((p) => (p ? { ...p, phase: "traveling", travelTicks: 0 } : p));
  }

  function doMiniGameTap(markerPct) {
    if (!groupHunt || groupHunt.phase !== "catching") return;
    const { outcome, next } = resolveMiniGameTap(groupHunt.miniGame, markerPct);
    if (!outcome) { setGroupHunt((p) => (p ? { ...p, miniGame: next } : p)); return; }
    const bayDogs = groupHunt.bayDogIds.map((id) => groupHunt.dogsById[id]);
    const catchDogs = groupHunt.catchDogIds.map((id) => groupHunt.dogsById[id]);
    const hog = groupHunt.hog;
    // next.hogHits is the running total the hog landed across every round of
    // this mini-game — it's what drives the catch dogs' injury rolls.
    const hogHits = next.hogHits || 0;
    const payout = finishGroupHunt({ caught: outcome === "caught", calledOff: false, bayDogs, catchDogs, hog, hogHits });
    const performancePct = huntPerformancePct(next.meter, groupHunt.ticksElapsed);
    setGroupHunt((p) => (p ? { ...p, miniGame: next, phase: "results", result: { calledOff: false, caught: outcome === "caught", hog, bayDogs, catchDogs, meter: next.meter, ticksElapsed: groupHunt.ticksElapsed, hogHits, performancePct, payout } } : p));
  }

  function doEndGroupHuntSession() {
    setGroupHunt(null);
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

  /* Entering a trial no longer resolves it.

     The old doTrial paid out on the spot and ticked a day itself, so a trial
     was a slot machine: pull, see the result, pull again. Entries now cost
     money and the dog's energy today and post their result on the next day
     tick, which is what turns the game into something you come back to.

     Nothing here advances the day. The day moves when you hunt, rest or work
     the stock, and whatever you entered is waiting when it does. */
  function enterTrial(dog, trialKey) {
    const trial = TRIALS[trialKey];
    if (!dog || !trial) return { ok: false, why: "That trial is not running." };
    if (state.entries.some((e) => e.dogId === dog.id)) {
      return { ok: false, why: `${dog.name} is already entered in something.` };
    }
    if (isRetired(dog)) return { ok: false, why: `${dog.name} is retired from competition.` };
    if (dog.injury) return { ok: false, why: `${dog.name} is hurt and cannot be entered.` };
    if (!hasEnergy(dog, "trial")) {
      return { ok: false, why: `${dog.name} has not got the energy left today.` };
    }
    if (!isVaccinated(dog, state.day)) {
      return { ok: false, why: `${dog.name} is not vaccinated - no secretary will take the entry.`,
               fix: { label: "Buy a vaccination", tab: "shop" } };
    }
    const fee = Math.round(trialPurse(dog, dog) * 0.3);
    if (state.cash < fee) return { ok: false, why: `The entry fee is ${fmtMoney(fee)} and you are short.` };

    update((prev) => {
      const entry = {
        id: genId(),
        dogId: dog.id,
        dogName: dog.name,
        trial: trialKey,
        fee,
        enteredDay: prev.day,
        resolvesDay: prev.day + 1,
      };
      const next = {
        ...prev,
        cash: Math.round((prev.cash - fee) * 100) / 100,
        entries: [...prev.entries, entry],
        dogs: prev.dogs.map((d) => d.id === dog.id
          ? { ...d, energy: Math.max(0, energyOf(d) - ENERGY_COST.trial) } : d),
      };
      return addLog(next, "info",
        `${dog.name} is entered in the ${trial.label.toLowerCase()} — ${fmtMoney(fee)}. Results come in tomorrow.`);
    });
    return { ok: true };
  }

  function withdrawEntry(entryId) {
    update((prev) => {
      const entry = prev.entries.find((e) => e.id === entryId);
      if (!entry) return prev;
      // Half the fee back — pulling out late costs the organisers a slot.
      const refund = Math.round(entry.fee * 0.5);
      return addLog({
        ...prev,
        cash: Math.round((prev.cash + refund) * 100) / 100,
        entries: prev.entries.filter((e) => e.id !== entryId),
      }, "money", `Pulled ${entry.dogName} out — ${fmtMoney(refund)} of the fee back.`);
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

  /* Cleaning out a run. Always available — the spec's one action that never
     needs an item — but capped to once per animal per day, or it would be a
     free healing button you could hold down. */
  function doCleanAnimal(kind, id) {
    const listKey = kind === "horse" ? "horses" : kind === "cattle" ? "cattle" : "dogs";
    const animal = (state[listKey] || []).find((a) => a.id === id);
    if (!animal || animal.cleanedDay === state.day) return 0;
    const gained = Math.min(4, 100 - animal.health);
    if (gained <= 0) return 0;
    update((prev) => addLog({
      ...prev,
      [listKey]: (prev[listKey] || []).map((a) =>
        a.id === id ? { ...a, health: Math.min(100, a.health + gained), cleanedDay: prev.day } : a),
    }, "info", `Cleaned out ${animal.name}'s run.`));
    return gained;
  }

  /* Profession points. Spending is guarded against both caps — the track max
     and the points actually earned — because the button is not the only way in:
     an older save with a hand-edited professions object should not be able to
     hand itself fifteen points. */
  function spendProfessionPoint(key) {
    const def = PROFESSIONS[key];
    if (!def) return;
    if (professionPointsLeft(state) <= 0) return;
    if (((state.professions || {})[key] || 0) >= def.max) return;
    update((prev) => addLog({
      ...prev,
      professions: { ...(prev.professions || {}), [key]: ((prev.professions || {})[key] || 0) + 1 },
    }, "info", `Put a point into ${def.name}.`));
  }

  function resetProfessions() {
    update((prev) => addLog({ ...prev, professions: {} }, "info", "Profession points reset."));
  }

  function saveRanchBio(text) {
    const trimmed = String(text || "").slice(0, 1200);
    update((prev) => ({ ...prev, ranchBio: trimmed }));
  }

  /* Cash and savings are two pools on purpose - see BANK_INTEREST_PER_DAY.
     Both directions are clamped against the pool they draw from, because the
     input is a number field and a number field will happily hand you 1e9. */
  function bankMove(direction, amount) {
    const value = Math.max(0, Math.round(Number(amount) || 0));
    if (!value) return;
    update((prev) => {
      const savings = prev.savings || 0;
      if (direction === "deposit") {
        const moved = Math.min(value, Math.floor(prev.cash));
        if (moved <= 0) return prev;
        return addLog({ ...prev, cash: Math.round((prev.cash - moved) * 100) / 100, savings: savings + moved },
          "money", `Banked ${fmtMoney(moved)}.`);
      }
      const moved = Math.min(value, Math.floor(savings));
      if (moved <= 0) return prev;
      return addLog({ ...prev, cash: Math.round((prev.cash + moved) * 100) / 100, savings: savings - moved },
        "money", `Drew ${fmtMoney(moved)} out of the bank.`);
    });
  }

  /* Vaccination through a clinic rather than off the shelf. The clinic sets
     both the price and how long the certificate runs, which is the whole
     reason this is a choice rather than a button. */
  function vaccinateAt(clinicId, dogId) {
    const clinic = CLINICS.find((c) => c.id === clinicId);
    const dog = state.dogs.find((d) => d.id === dogId);
    if (!clinic || !dog || state.cash < clinic.price) return;
    update((prev) => addLog({
      ...prev,
      cash: Math.round((prev.cash - clinic.price) * 100) / 100,
      dogs: prev.dogs.map((d) => d.id !== dogId ? d
        : { ...d, vaccinatedUntilDay: prev.day + 365 + clinic.bonusDays }),
    }, "money", `${dog.name} vaccinated at ${clinic.name} for ${fmtMoney(clinic.price)}.`));
  }

  function doSell(dog) {
    const value = Math.round(computeValue(dog) * professionBonus(state, "trader"));
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
  // Attaches (or clears, with dataUrl === null) a player-supplied photo on
  // one dog/horse/cow. Purely cosmetic — no log entry, no cash — so it's a
  // plain array-map update rather than going through addLog.
  function setAnimalPhoto(kind, animalId, dataUrl) {
    update((prev) => {
      if (kind === "dog") {
        return { ...prev, dogs: prev.dogs.map((d) => (d.id === animalId ? { ...d, photo: dataUrl } : d)) };
      }
      const cfg = LIVESTOCK_CONFIG[kind];
      return { ...prev, [cfg.arrayKey]: prev[cfg.arrayKey].map((a) => (a.id === animalId ? { ...a, photo: dataUrl } : a)) };
    });
  }
  function doSellAnimal(kind, animal, atAuction) {
    const cfg = LIVESTOCK_CONFIG[kind];
    if (atAuction && !canHaul(state)) return;
    const value = Math.round(
      (atAuction && cfg.auctionValue ? cfg.auctionValue(animal) : cfg.value(animal)) *
      professionBonus(state, "trader"));
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
    const purse = Math.round((40 + cfg.value(animal) * 0.03) * professionBonus(state, "stockman"));

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
    // Only conditioning costs energy. Feed and medicine are things done to a
    // dog rather than work asked of it.
    if (item.cat === "training" && !hasEnergy(target, "training")) return;
    if (!(state.inventory && state.inventory[itemId] > 0)) return;
    update((prev) => {
      const inv = { ...(prev.inventory || {}) };
      inv[itemId] = Math.max(0, (inv[itemId] || 0) - 1);
      if (inv[itemId] === 0) delete inv[itemId];
      let msg = "";
      const dogs = prev.dogs.map((d) => {
        if (d.id !== dogId) return d;
        const res = applyItem(d, itemId, prev.upgrades, professionBonus(prev, "trainer"), prev.day);
        msg = res.msg;
        return item.cat === "training"
          ? { ...res.dog, energy: Math.max(0, energyOf(d) - ENERGY_COST.training) }
          : res.dog;
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

  /* Everything the screen files need, gathered in one place. They are sections
     of a single stateful component rather than reusable pieces, so one object
     beats seven long prop lists — and this list is the honest record of what
     the screens actually reach for. */
  const game = {
    acceptAnimalChallenge, acceptAnimalStudRequestAction, acceptChallengeAction, acceptPick,
    acceptStudRequestAction, accountBusy, accountMsg, adminAddCash, adminAdvance,
    adminApply, adminClearFlag, adminCodeDraft, adminHealAll, adminLock, adminMaxStats,
    adminRegisterAll, adminSetFame, adminSpawnDog, adminSpawnStock, adminTarget,
    adminUnlock, adminUnlockAll, adminUnlocked, avatarInputRef, bioDraft, bloodlineGroups,
    bothMerleCarriers, breedPick, breedableF, breedableM, buyAnimalListing, buyListing,
    buyPasture, buyProperty, buyTrailer, buyTruck, canFoundBloodline, cancelAnimalChallenge,
    cancelAnimalListing, cancelAnimalStudOffer, cancelChallenge, cancelListing,
    cancelStudOffer, challengePick, changePassword, cloudAuthEl, cloudStatus, competitors,
    createAnimalChallenge, createChallenge, dam, declineAnimalStudRequest,
    declineStudRequest, deleteAccount, deleteConfirm, doAcceptBreedingRequest,
    doAcceptHuntOffer, doAcceptPurchaseOffer, doAdopt, doBreed, doBreedAnimal, doBuy,
    doBuyAnimal, doBuyItem, doBuyUpgrade, doCallOffGroupHunt, doDeclineOffer,
    doEndGroupHuntSession, doEnterShow, doHunt, doMiniGameTap, doRegister,
    doReleaseCatchDogs, doSell, doSellAnimal, doStartGroupHunt, doStudService, doTrial,
    doUseItem, dogCapacity, exportSave, filters, groupHunt, groupSetup, handleAvatarFile,
    handleSignOut, huntPick, huntableDogs, importInputRef, importSave, incomingStudRequests,
    inheritedBloodline, itemTargets, kennelFull, kennelSearch, layout, leaderboardRows,
    listAnimalForSale, listDogForSale, loadRaceLeaders, loading, logFilter, myChallenges,
    myStudRequests, netWorth, netWorthDelta, newBloodline, newPassword, openChallenges,
    patchPvp2, postAnimalStud, postStudOffer, profile, propShowAll, pvp2, pvpListings,
    pvpMsg, raceLeaders, refreshRescue, registeredDogs, requestAnimalStud, requestDamPick,
    requestStud, resetConfirm, resetKennel, restWeek, rivalsMsg, saveProfile, saveUsername,
    scoutAnimalMarket, scoutMarket, sellPick, session, setAcceptPick, setAdminCodeDraft,
    setAdminTarget, setBioDraft, setBreedPick, setChallengePick, setCloudPanelOpen,
    setDeleteConfirm, setFilters, setGroupHunt, setHuntPick, setItemTargets,
    setKennelSearch, setLayout, setLogFilter, setNewBloodline, setNewPassword,
    setPropShowAll, setRequestDamPick, setResetConfirm, setSellPick, setShopCat,
    setStudDamId, setStudPick, setTab, setTheme, setTrialPick, setUsernameDraft,
    setViewAnimal, setViewDog, shopCat, shownMarket, signOutEverywhere, sire, state,
    studDam, studDamId, studMsg, studOffers, studPick, studs, tab, theme, tick,
    toggleBayPick, toggleCatchPick, topCatch, topDog, trialPick, usernameDraft,

    // These four come last on purpose. The generated list above still
    // carries `setViewDog` and `setViewAnimal` as plain shorthand, and in an
    // object literal the later key wins — putting these first would have
    // them silently overwritten by the raw setters.
    params: route.params,
    doCleanAnimal,
    setViewDog: openDogProfile,
    setViewAnimal: openAnimalProfile,
    spendProfessionPoint,
    resetProfessions,
    saveRanchBio,
    enterTrial,
    withdrawEntry,
    bankMove,
    vaccinateAt,
    buyItemId, setBuyItemId,
  };

  /* Every screen, rendered the same in either layout. Only the chrome around
     them differs, so nothing can drift between the two. */
  const screens = (
    <>
      <RanchTabs game={game} />
      <MarketSidebar game={game} />
      <KennelScreens game={game} />
      <WorkScreens game={game} />
      <LivestockScreens game={game} />
      <MarketScreens game={game} />
      <OnlineScreens game={game} />
      <RecordsScreens game={game} />
      <AccountScreens game={game} />
      <AnimalProfileScreen game={game} />
      <RanchPanels game={game} />
      <MarketPanels game={game} />
      <SearchScreen game={game} />
      <AchievementsScreen game={game} />
      <CareChecklist game={game} />
      {buyItemId && <PurchaseModal game={game} itemId={buyItemId} onClose={() => setBuyItemId(null)} />}
    </>
  );

  /* Homestead: the shell phase 3 built. A tiled ground, one centred page card,
     a utility bar above it and an info rail down the right. The screens inside
     are the same ones the other two layouts render — only the chrome differs,
     which is what keeps all three honest as sections get rebuilt. */
  if (layout === "home") {
    const owner = HOME_NAV_OWNER[tab] || "kennel";
    const seasonNow = seasonLabel(state.day);
    return (
      <div className="kg-app kg-app--home">
        <div className="kg-hs">
          {/* Utility bar: social on the left, what you're worth on the right. */}
          <div className="kg-hs__utility">
            <div className="kg-hs__ulinks">
              <button className="kg-hs__ulink" onClick={() => setTab("trade")}>Player Market</button>
              <button className="kg-hs__ulink" onClick={() => setTab("rivals")}>Challenges</button>
              <button className="kg-hs__ulink" onClick={() => setTab("leaderboard")}>Leaderboard</button>
            </div>
            <div className="kg-hs__purse">
              <span>Fame <b className="kg-hs__fame">{fameTier(state.fame || 0).label}</b></span>
              <span>Cash <b className="kg-hs__cash">{fmtMoney(state.cash)}</b></span>
              {themeToggleEl}
              {cloudAuthEl}
            </div>
          </div>

          <div className="kg-hs__card">
            <div className="kg-hs__head">
              <button className="kg-hs__brand" onClick={() => setTab("overview")} title="Overview">
                <img src="assets/logo-mark.png" alt="" width="42" height="42" />
                <span>
                  <span className="kg-hs__wordmark">Sundown Kennels</span>
                  <span className="kg-hs__sim">Simulator</span>
                </span>
              </button>

              <nav className="kg-hs__nav" aria-label="Main">
                {HOME_NAV.map((n) => (
                  <div key={n.id} className={"kg-hs__navitem " + (owner === n.id ? "kg-hs__navitem--on" : "")}>
                    <button className="kg-hs__navbtn"
                      onClick={(e) => { setTab(n.menu ? "rescue" : n.tab); e.currentTarget.blur(); }}>
                      <span className="kg-hs__navicon" aria-hidden="true">{n.icon}</span>{n.label}
                    </button>
                    {n.menu && (
                      <div className="kg-hs__mega" role="menu">
                        {ATLAS_MENU.map((col) => (
                          <div key={col.heading} className="kg-hs__megacol">
                            <p className="kg-hs__megahead">{col.heading}</p>
                            {col.items.map((it) => (
                              <button key={it.id} role="menuitem" className="kg-hs__megalink"
                                onClick={(e) => { setTab(it.id); e.currentTarget.blur(); }}>{it.label}</button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </nav>
            </div>

            <div className="kg-hs__body">
              <main className="kg-hs__main">
                {saveError && <Notice tone="error">Couldn't save progress just now — keep playing, it'll retry.</Notice>}
                {storageMode === "memory" && (
                  <Notice tone="warn">This browser is blocking local storage, so progress won't be saved between visits.</Notice>
                )}
                {!session && (
                  <Notice tone="info" fix={{ label: "Sign in", onClick: () => setCloudPanelOpen(true) }}>
                    You're playing locally. Sign in to save your kennel to the cloud and join the boards.
                  </Notice>
                )}
                {screens}
              </main>

              <aside className="kg-hs__rail">
                <SideBox title="Game Time">
                  <p style={{ margin: 0, fontWeight: 700, color: "var(--hs-ink)" }}>{seasonNow}</p>
                  <p style={{ margin: "2px 0 0", color: "var(--hs-ink-mute)" }}>
                    Day {state.day} · Year {yearOf(state.day)}
                  </p>
                </SideBox>

                <SideBox title="Logged In As">
                  <p style={{ margin: 0, fontWeight: 700, color: "var(--hs-ink)" }}>
                    {(profile && profile.username) || state.kennelName}
                  </p>
                  <p style={{ margin: "2px 0 6px", color: "var(--hs-ink-mute)" }}>
                    {session ? "Signed in" : "Local play"}
                  </p>
                  <Meter label="Fame" value={Math.min(100, state.fame || 0)} hint="Fame comes from wins, titles and papered dogs. It gates buyers and events." />
                  {/* Its own class rather than the link-stack one: this is an
                      action, not navigation, and sharing the class made the
                      smoke test's Quick Links walk open the auth dialog. */}
                  <p style={{ margin: "6px 0 0" }}>
                    {session
                      ? <button className="kg-hs__sessionbtn" onClick={handleSignOut}>(Log out)</button>
                      : <button className="kg-hs__sessionbtn" onClick={() => setCloudPanelOpen(true)}>(Sign in)</button>}
                  </p>
                </SideBox>

                <SideBox title="Your Kennel">
                  <ul className="kg-rail__list" style={{ margin: 0 }}>
                    <li><span>Dogs</span><strong>{state.dogs.length} / {dogCapacity}</strong></li>
                    <li><span>Horses</span><strong>{(state.horses || []).length}</strong></li>
                    <li><span>Cattle</span><strong>{(state.cattle || []).length}</strong></li>
                    <li><span>Net worth</span><strong>{fmtMoney(netWorth)}</strong></li>
                  </ul>
                </SideBox>

                <SideBox title="Quick Links">
                  <LinkStack links={HOME_QUICK_LINKS} current={tab} onPick={setTab} />
                </SideBox>

                {/* Deliberately an empty labelled slot rather than a real ad. */}
                <div className="kg-ui-sidebox kg-ui-sidebox--slot">
                  <p className="kg-ui-sidebox__title">Notices</p>
                  <div className="kg-ui-sidebox__body">Nothing pinned right now.</div>
                </div>
              </aside>
            </div>
          </div>
        </div>

        <DogProfileModal dog={viewDog} onClose={() => setViewDog(null)}
          onSetPhoto={(dataUrl) => {
            if (!viewDog) return;
            setAnimalPhoto("dog", viewDog.id, dataUrl);
            setViewDog((prev) => (prev ? { ...prev, photo: dataUrl } : prev));
          }} />
        <AnimalProfileModal target={viewAnimal} onClose={() => setViewAnimal(null)}
          onSetPhoto={(dataUrl) => {
            if (!viewAnimal) return;
            setAnimalPhoto(viewAnimal.kind, viewAnimal.animal.id, dataUrl);
            setViewAnimal((prev) => (prev ? { ...prev, animal: { ...prev.animal, photo: dataUrl } } : prev));
          }} />
      </div>
    );
  }

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
            <span className="kg-topstrip__sim">Simulator</span>
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

        <DogProfileModal dog={viewDog} onClose={() => setViewDog(null)}
          onSetPhoto={(dataUrl) => {
            if (!viewDog) return;
            setAnimalPhoto("dog", viewDog.id, dataUrl);
            setViewDog((prev) => (prev ? { ...prev, photo: dataUrl } : prev));
          }} />
        <AnimalProfileModal target={viewAnimal} onClose={() => setViewAnimal(null)}
          onSetPhoto={(dataUrl) => {
            if (!viewAnimal) return;
            setAnimalPhoto(viewAnimal.kind, viewAnimal.animal.id, dataUrl);
            setViewAnimal((prev) => (prev ? { ...prev, animal: { ...prev.animal, photo: dataUrl } } : prev));
          }} />
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
      <DogProfileModal dog={viewDog} onClose={() => setViewDog(null)}
        onSetPhoto={(dataUrl) => {
          if (!viewDog) return;
          setAnimalPhoto("dog", viewDog.id, dataUrl);
          setViewDog((prev) => (prev ? { ...prev, photo: dataUrl } : prev));
        }} />
      <AnimalProfileModal target={viewAnimal} onClose={() => setViewAnimal(null)}
        onSetPhoto={(dataUrl) => {
          if (!viewAnimal) return;
          setAnimalPhoto(viewAnimal.kind, viewAnimal.animal.id, dataUrl);
          setViewAnimal((prev) => (prev ? { ...prev, animal: { ...prev.animal, photo: dataUrl } } : prev));
        }} />
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
