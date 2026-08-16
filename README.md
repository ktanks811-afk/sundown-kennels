# Sundown Kennels

A browser-based hunting-dog breeding and management sim. Breed real working
breeds (APBT, Catahoula, Plott Hound, and 27 more), track coat genetics, hunt
hogs, compete in trials and shows, buy land, run a supply store and rescue
pen, and build a bloodline over time. Signed-in players can trade dogs,
challenge each other head to head, and climb a public leaderboard.

Play it: https://ktanks811-afk.github.io/sundown-kennels/

## Running it locally

There's still no build step and nothing to install — but the source is split
across several files that Babel compiles in the browser, so it has to be
served over `http://`. **Opening `index.html` off disk will not work** (the
browser blocks the file reads).

Any static server does it:

```bash
python -m http.server 8000
```

Then visit http://localhost:8000.

Progress saves to local storage automatically. Sign in with Cloud Save to
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
| `supabase-schema.sql` | Tables, RLS policies, grants, and the RPCs behind cloud save and multiplayer |

The files share one global scope and load in dependency order — there are no
imports. If you add a new file, add a `<script>` tag for it in `index.html`
after whatever it depends on.

`.nojekyll` disables GitHub Pages' Jekyll build. Without it, the `{{` in JSX
inline styles is at risk of being treated as template syntax.

## Tech

React 18 and Babel from a CDN, Supabase for auth, cloud saves, and
multiplayer. No bundler, no package.json.
