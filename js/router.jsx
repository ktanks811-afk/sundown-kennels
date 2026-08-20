/* Hash routing and the route table.

   Why the hash and not real paths: this deploys as static files to both GitHub
   Pages and Vercel. A pushState route like /records/ledger would 404 on refresh
   or on a shared link, because neither host knows to serve index.html for a path
   that has no file behind it — fixing that means a 404.html trick on Pages and a
   rewrite rule in vercel.json, two separate configs to keep in step. A hash is
   invisible to both servers, so deep links, refresh and the back button all work
   the same everywhere with nothing to configure.

   The screen ids here are the same ones NAV and MENUS use in data.jsx. Every id
   reachable from either of those must appear in this table — the smoke test
   walks the whole nav and fails if a destination doesn't change the URL. */

const ROUTES = [
  { path: "/overview",           screen: "overview" },
  { path: "/kennel",             screen: "kennel" },
  { path: "/property",           screen: "property" },

  /* Ranch tabs that have no older screen behind them. Animals, Owner, Manage
     and Settings map onto kennel/profile/property/settings above. */
  { path: "/ranch/about",        screen: "ranchabout" },
  { path: "/ranch/history",      screen: "ranchhistory" },
  { path: "/ranch/stats",        screen: "ranchstats" },

  { path: "/hunt",               screen: "hunt" },
  { path: "/breed",              screen: "breed" },
  { path: "/trials",             screen: "trials" },

  { path: "/horses",             screen: "horses" },
  { path: "/cattle",             screen: "cattle" },

  { path: "/market",             screen: "market" },
  { path: "/store/supplies",     screen: "shop" },
  { path: "/store/inventory",    screen: "inventory" },
  { path: "/rescue",             screen: "rescue" },
  { path: "/market/clinics",     screen: "clinic" },
  { path: "/market/bank",        screen: "bank" },

  { path: "/online/market",      screen: "trade" },
  { path: "/online/challenges",  screen: "rivals" },
  { path: "/online/leaderboard", screen: "leaderboard" },

  { path: "/search",             screen: "search" },
  { path: "/arcade",             screen: "arcade" },
  { path: "/registries",         screen: "registries" },
  { path: "/achievements",       screen: "achievements" },
  { path: "/today",              screen: "care" },

  { path: "/records/studbook",   screen: "registry" },
  { path: "/records/ranks",      screen: "rankings" },
  { path: "/records/hof",        screen: "hof" },
  { path: "/records/races",      screen: "racerecords" },
  { path: "/records/ledger",     screen: "log" },

  { path: "/account/profile",    screen: "profile" },
  { path: "/account/settings",   screen: "settings" },
  { path: "/account/manage",     screen: "danger" },
  /* Only reachable once the code has been entered; anyone landing here
     without it gets sent to the overview rather than a blank screen. */
  { path: "/account/admin",      screen: "admin", requiresAdmin: true },

  /* One animal, by species and the id it carries inside the save. Only animals
     the player owns resolve here — market, rival and stud dogs live in
     transient lists with no stable identity, so those keep opening in the
     modal rather than getting a URL that would break on the next refresh. */
  { path: "/animal/:species/:id", screen: "animalprofile" },

  /* Alias, so a bare "#/" and a link with no hash both land somewhere real. */
  { path: "/",                   screen: "overview", alias: true },
];

const HOME_PATH = "/overview";

/* Segment matcher. Patterns may carry :params — none do yet, but the animal
   profile in a later phase needs /animal/:kind/:id, and writing the matcher
   once now is cheaper than retrofitting it around a plain lookup table. */
function matchRoute(path) {
  const segs = String(path || "").split("/").filter(Boolean);
  for (const route of ROUTES) {
    const pattern = route.path.split("/").filter(Boolean);
    if (pattern.length !== segs.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i].charAt(0) === ":") params[pattern[i].slice(1)] = decodeURIComponent(segs[i]);
      else if (pattern[i] !== segs[i]) { ok = false; break; }
    }
    if (ok) return { ...route, params };
  }
  return null;
}

/* Screen id -> canonical path. Aliases are skipped so "overview" always
   resolves to /overview rather than the bare "/" that also points at it. */
function pathForScreen(screen) {
  const route = ROUTES.find((r) => r.screen === screen && !r.alias && r.path.indexOf(":") === -1);
  return route ? route.path : HOME_PATH;
}

function currentPath() {
  const raw = window.location.hash || "";
  return raw.charAt(0) === "#" ? raw.slice(1) || "/" : "/";
}

/* replace: true swaps the current entry instead of adding one, so redirects
   (an unknown path, or admin while locked) don't put a dead stop in the
   history that the back button would bounce off. */
function navigate(path, replace) {
  const target = "#" + path;
  if (window.location.hash === target) return;
  if (replace) window.location.replace(window.location.pathname + window.location.search + target);
  else window.location.hash = target;
}

/* Current path, kept in step with the address bar and the back button. */
function useHashPath() {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener("hashchange", onChange);
    // The hash can already have moved between first render and this effect.
    onChange();
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return path;
}

/* Resolves the address bar to a screen, sending anything unrecognised — a stale
   bookmark, a typo, /account/admin without the code — back to the overview.
   Returns { screen, params, path } plus a navigate helper bound to screen ids. */
function useRoute(adminUnlocked) {
  const path = useHashPath();
  const match = matchRoute(path);
  const blocked = !!(match && match.requiresAdmin && !adminUnlocked);
  const route = !match || blocked ? matchRoute(HOME_PATH) : match;

  /* Reads the address bar rather than `path` on purpose. Assigning
     location.hash takes effect immediately but the hashchange event that
     updates `path` does not, so during that gap `path` still holds the old
     route. Locking the admin panel hits exactly that gap: it navigates to
     settings and clears the flag in one go, and a guard trusting the stale
     `path` would see "admin, now blocked" and redirect over the top of it. */
  useEffect(() => {
    const live = currentPath();
    const liveMatch = matchRoute(live);
    if (!liveMatch) { navigate(HOME_PATH, true); return; }
    if (liveMatch.alias) { navigate(pathForScreen(liveMatch.screen), true); return; }
    if (liveMatch.requiresAdmin && !adminUnlocked) navigate(HOME_PATH, true);
  }, [path, adminUnlocked]);

  const goToScreen = useCallback((screen) => navigate(pathForScreen(screen)), []);

  return { screen: route.screen, params: route.params || {}, path, goToScreen };
}
