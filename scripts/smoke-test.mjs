// Loads the actual game in a real headless browser, plays through onboarding,
// and clicks every tab — the same manual check that's caught every real bug
// so far this project (merge conflicts and cross-file signature mismatches
// don't show up as syntax errors, only as runtime console errors on a real
// page load). Fails the build on any console error or uncaught exception.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = process.cwd();
const PORT = 8123;
const MIME = { ".html": "text/html", ".jsx": "text/babel", ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json" };

function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
    const file = path.join(ROOT, decodeURIComponent(urlPath));
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push("uncaught exception: " + err.message));

  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);

  // Title screen, if present.
  const startBtn = page.getByRole("button", { name: /start a kennel/i });
  if (await startBtn.count()) { await startBtn.first().click(); await page.waitForTimeout(300); }

  // Onboarding step 1: name the kennel.
  const nameInput = page.locator("input").first();
  if (await nameInput.count()) {
    await nameInput.fill("CI Smoke Test");
    const continueBtn = page.getByRole("button", { name: /continue/i });
    if (await continueBtn.count()) { await continueBtn.first().click(); await page.waitForTimeout(300); }
  }

  // Onboarding step 2: pick two starter dogs, then found the kennel.
  const cards = page.locator(".kg-card");
  if (await cards.count() >= 2) {
    await cards.nth(0).click();
    await cards.nth(1).click();
    await page.waitForTimeout(300);
  }
  const foundBtn = page.getByRole("button", { name: /^Found /i });
  if (await foundBtn.count()) { await foundBtn.first().click(); await page.waitForTimeout(600); }

  // Click every top-level nav entry, and every sub-tab it reveals.
  const tabButtons = await page.locator(".kg-tab").all();
  console.log(`Found ${tabButtons.length} top-level nav entries.`);
  for (let i = 0; i < tabButtons.length; i++) {
    await page.locator(".kg-tab").nth(i).click();
    await page.waitForTimeout(250);
    const subtabs = await page.locator(".kg-subtab").all();
    for (let j = 0; j < subtabs.length; j++) {
      await page.locator(".kg-subtab").nth(j).click();
      await page.waitForTimeout(200);
    }
  }

  // Group hunt: pick a bay dog and a catch dog, start the hunt, wait for the
  // bay (search ticks are randomized but forced to resolve inside
  // MAX_SEARCH_TICKS * SEARCH_TICK_MS ~= 30s — see grouphunt.jsx), then call
  // off rather than trying to script the timing-based catch mini-game.
  await page.locator(".kg-tab", { hasText: /hunt/i }).first().click();
  await page.waitForTimeout(300);
  const bayButtons = page.getByRole("button", { name: /add as bay dog/i });
  const catchButtons = page.getByRole("button", { name: /add as catch dog/i });
  if (await bayButtons.count() && await catchButtons.count()) {
    await bayButtons.first().click();
    await catchButtons.first().click();
    await page.waitForTimeout(200);
    const headOutBtn = page.getByRole("button", { name: /head out/i });
    if (await headOutBtn.count()) {
      await headOutBtn.first().click();
      const bayedHeading = page.getByRole("heading", { name: /HOG BAYED/i });
      await bayedHeading.waitFor({ timeout: 35000 });
      const callOffBtn = page.getByRole("button", { name: /call off/i });
      await callOffBtn.first().click();
      await page.waitForTimeout(300);
      const backBtn = page.getByRole("button", { name: /back to the kennel/i });
      if (await backBtn.count()) { await backBtn.first().click(); await page.waitForTimeout(200); }
      console.log("Group hunt: setup -> search -> bayed -> call off -> results completed.");
    } else {
      console.log("Group hunt: not enough eligible dogs to head out — skipping the rest of this pass.");
    }
  } else {
    console.log("Group hunt: no eligible dogs for a fresh kennel — skipping this pass.");
  }

  await browser.close();
  server.close();

  if (errors.length) {
    console.error(`\n${errors.length} console error(s) during the smoke test:`);
    for (const e of errors) console.error(" - " + e);
    process.exit(1);
  }
  console.log("\nSmoke test passed: onboarding + every tab loaded with zero console errors.");
}

main().catch((err) => { console.error(err); process.exit(1); });
