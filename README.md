# Sundown Kennels

A browser-based hunting-dog breeding and management sim. Breed real working
breeds (APBT, Catahoula, Plott Hound, and 27 more), track coat genetics, hunt
hogs, compete in trials and shows, buy land, run a supply store and rescue
pen, and build a bloodline over time. Signed-in players can trade dogs,
challenge each other head to head, and climb a public leaderboard.

Play it: https://ktanks811-afk.github.io/sundown-kennels/

## Running it locally

**Windows:** double-click `serve.cmd`.
**Mac/Linux:** run `./serve.sh`.

Either one starts a local server and opens the game in your browser.

There's no build step and nothing to install beyond Python. The one catch:
the source is split across several files that Babel compiles in the browser,
so it has to be served over `http://` — **opening `index.html` off disk will
not work**, because the browser blocks those file reads. If you try, the page
tells you so rather than sitting on a blank "Loading…".

By hand, if you'd rather:

```bash
python -m http.server 8000
```

Then visit http://localhost:8000. Any static server works — `npx serve .` is
fine too.

Progress saves to local storage automatically. Sign in to
sync it to Supabase and unlock the multiplayer tabs.

## Layout

| File | What's in it |
| --- | --- |
| `index.html` | Shell only — loads the stylesheet and the source files in order |
| `styles.css` | The whole design system, including the night and day themes |
| `js/data.jsx` | Breeds, size and color profiles, hunts, trials, rival kennels, tabs, store catalog, upgrades, property, rescue intake |
| `js/genetics.jsx` | Coat inheritance, hidden carriers, traits, growth mutation, grading, and the breeding roll |
| `js/simulation.jsx` | Hunts, trials, the rival-kennel world, offers, fame, capacity, new-kennel setup, save migration |
| `js/components.jsx` | Stat bars, badges, sparkline, coat swatches, dog cards, pedigree tree, modals |
| `js/game.jsx` | Main component: state, day tick, player actions, multiplayer, tab screens |
| `js/setup.jsx` | First-run onboarding |
| `assets/` | Logo artwork |
| `serve.cmd` / `serve.sh` | Start a local server and open the game |
| `supabase-schema.sql` | Tables, RLS policies, grants, and the RPCs behind cloud save and multiplayer |

The files share one global scope and load in dependency order — there are no
imports. If you add a new file, add a `<script>` tag for it in `index.html`
after whatever it depends on.

`.nojekyll` disables GitHub Pages' Jekyll build. Without it, the `{{` in JSX
inline styles is at risk of being treated as template syntax.

## Tech

React 18 and Babel from a CDN, Supabase for auth, cloud saves, and
multiplayer. No bundler for the game itself — `package.json` exists only for
the CI tooling below, not a build step.

## CI

Every push and pull request runs three automated checks (`.github/workflows/ci.yml`):

1. **JSX syntax check** — parses every `js/*.jsx` file with Babel.
2. **Browser smoke test** — plays through onboarding and clicks every tab in
   a real headless browser, and fails on any console error. This is the one
   that actually catches cross-file bugs (a merge that leaves two files
   disagreeing on a function's shape won't show up as a syntax error, only
   as a runtime one).
3. **Supabase schema check** — applies `supabase-schema.sql` to a real
   throwaway Postgres instance (with `auth.users`/`auth.uid()`/the
   `anon`/`authenticated` roles stubbed in, since those are Supabase-managed
   and don't exist in plain Postgres). Catches things like a `GRANT` on a
   function signature that doesn't match its `CREATE FUNCTION`.

Run any of these locally before pushing:

```bash
npm install
npm run check:syntax
npx playwright install chromium   # first time only
npm run check:smoke
```

The schema check needs a local Postgres to run outside of CI — skip it
locally and let GitHub Actions catch schema issues, or see `.github/workflows/ci.yml`
for the exact stub if you want to run it yourself.
