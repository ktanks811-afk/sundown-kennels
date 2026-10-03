# Glitch Gaming Studios website

The studio's site. Plain HTML, CSS and ES modules: no framework, no build step,
nothing to install to run it.

```
studio/
  index.html            page markup, SEO and social tags
  css/styles.css        the whole design system
  js/main.js            renders the data below and runs the interactions
  js/data/games.js      ← the games (add a game here)
  js/data/updates.js    ← dev log posts
  js/data/site.js       ← social links, team, contact form endpoint
  assets/               logo, favicons, share image, game art
  site.webmanifest
```

## Editing

- **Add a game:** copy an entry in `js/data/games.js`. Its card, detail
  page (`#game-<id>`), the hero ticker and the stats all update from it.
- **Post a dev log update:** add an entry at the top of `js/data/updates.js`
  with a real `date` and `placeholder: false`. The three entries there now are
  placeholders and are labelled as such on the site.
- **Socials, team:** `js/data/site.js`. Blank values show as
  "Soon" / a placeholder rather than dead links.
- **Contact form:** it validates and then says plainly that it isn't connected
  until `contactEndpoint` in `js/data/site.js` is set (a Formspree form URL
  works as-is).

## Running locally

ES modules need a web server (opening the file directly won't load them):

```
npm run studio:serve        # http://localhost:4321
```

or `python3 -m http.server 4321` from inside `studio/`.

## Regenerating art and icons

```
npm run studio:art      # game key art SVGs   (scripts/studio-art.mjs)
npm run studio:assets   # favicons, app icons, share image, art JPEGs
                        # (scripts/studio-assets.mjs, needs Playwright's Chromium)
```

## Deploying (Vercel)

1. In Vercel, **Add New → Project**, import `sundown-kennels`.
2. Set **Root Directory** to `studio`, **Framework Preset** to *Other*, and
   leave the build and output settings empty.
3. Deploy. Add your domain under the project's **Domains** tab.
4. Once the domain is live, change `og:image` / `twitter:image` in
   `index.html` to the absolute URL (e.g. `https://yourdomain.com/assets/og-image.png`)
   and add `<meta property="og:url" content="https://yourdomain.com/" />`,
   so link previews show the share image everywhere.
