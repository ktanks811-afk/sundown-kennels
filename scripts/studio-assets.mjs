// Renders the studio site's raster assets from its SVG sources:
//   favicon.svg (copy of logo-mark.svg), favicon-32.png, apple-touch-icon.png,
//   icon-192.png, icon-512.png, og-image.png, and a 1600px and 800px JPEG of
//   each piece of game art (the cards load these instead of the heavier SVGs).
//
// Run after changing the logo or the art:  npm run studio:assets
// Uses the Playwright Chromium that CI already installs. Set CHROMIUM_PATH to
// point at a different browser binary if needed.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = path.join(process.cwd(), "studio");
const A = path.join(ROOT, "assets");
const fileUrl = (p) => "file://" + path.resolve(p);

fs.copyFileSync(path.join(A, "logo-mark.svg"), path.join(A, "favicon.svg"));

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
// IGNORE_HTTPS_ERRORS=1 lets the font load behind a TLS-intercepting proxy.
const page = await browser.newPage({ ignoreHTTPSErrors: process.env.IGNORE_HTTPS_ERRORS === "1" });

async function render(html, w, h, out, type = "png") {
  await page.setViewportSize({ width: w, height: h });
  // Written to disk and opened by file:// URL, because a page set with
  // setContent is about:blank and isn't allowed to load file:// images.
  const tmp = path.join(os.tmpdir(), `studio-render-${process.pid}.html`);
  fs.writeFileSync(tmp, html);
  await page.goto(fileUrl(tmp), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, type, ...(type === "jpeg" ? { quality: 82 } : { omitBackground: true }) });
  console.log("wrote", path.relative(process.cwd(), out));
}

const logo = fileUrl(path.join(A, "logo-mark.svg"));
const icon = (size, pad = 0) =>
  `<html><body style="margin:0;background:transparent"><img src="${logo}" style="display:block;width:${size - pad * 2}px;height:${size - pad * 2}px;margin:${pad}px"></body></html>`;

await render(icon(32), 32, 32, path.join(A, "favicon-32.png"));
// Touch and app icons: iOS rounds corners itself and shows transparency as
// black, so give these a solid background and a little breathing room.
const solid = (size) =>
  `<html><body style="margin:0;background:#07080c"><img src="${logo}" style="display:block;width:${size}px;height:${size}px;transform:scale(1.12)"></body></html>`;
await render(solid(180), 180, 180, path.join(A, "apple-touch-icon.png"));
await render(solid(192), 192, 192, path.join(A, "icon-192.png"));
await render(solid(512), 512, 512, path.join(A, "icon-512.png"));

for (const name of ["hogs-and-dogs", "roll-for-glory"]) {
  const src = fileUrl(path.join(A, "art", `${name}.svg`));
  for (const w of [1600, 800]) {
    const h = Math.round((w * 1000) / 1600);
    await render(
      `<html><body style="margin:0"><img src="${src}" style="display:block;width:${w}px;height:${h}px"></body></html>`,
      w, h, path.join(A, "art", `${name}-${w}.jpg`), "jpeg"
    );
  }
}

// Social share card, 1200×630.
const hd = fileUrl(path.join(A, "art", "hogs-and-dogs.svg"));
const rfg = fileUrl(path.join(A, "art", "roll-for-glory.svg"));
await render(
  `<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&display=block"></head>
  <body style="margin:0;width:1200px;height:630px;background:#050608;position:relative;overflow:hidden;font-family:'Chakra Petch',sans-serif;color:#e9edf5">
    <div style="position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr;opacity:.55">
      <div style="background:url(${hd}) center/cover"></div><div style="background:url(${rfg}) center/cover"></div>
    </div>
    <div style="position:absolute;inset:0;background:radial-gradient(70% 90% at 50% 50%,rgba(5,6,8,.55),#050608 95%)"></div>
    <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(160,190,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(160,190,255,.08) 1px,transparent 1px);background-size:48px 48px"></div>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;text-align:center">
      <img src="${logo}" width="120" height="120">
      <div style="font-size:76px;font-weight:700;letter-spacing:.06em;line-height:1">GLITCH GAMING STUDIOS</div>
      <div style="font-size:26px;font-weight:600;letter-spacing:.5em;background:linear-gradient(110deg,#3dffa8,#2de2ff 55%,#8b5cff);-webkit-background-clip:text;color:transparent">BUILD. PLAY. GLITCH.</div>
    </div>
  </body></html>`,
  1200, 630, path.join(A, "og-image.png")
);

await browser.close();
