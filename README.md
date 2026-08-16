# Sundown Kennels

A single-file, browser-based hunting-dog breeding and management sim.
Breed real working-dog breeds (APBT, Catahoula, Plott Hound, and more),
track coat genetics, hunt hogs, compete in trials and shows, and build
a bloodline over time.

## Running it

No build step, no dependencies to install. Just open `index.html` in
any modern browser, or serve the folder with any static file server:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Progress saves to your browser's local storage automatically.

## Tech

Single HTML file, React + Babel loaded from CDN, no build tooling.
