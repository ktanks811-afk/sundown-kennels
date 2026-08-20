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
// About | Animals | Owner | History | Stats | Manage | Settings
const RANCH_TAB_COUNT = 7;
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

  // A failed fetch logs as "Failed to load resource: ... 404 ()" with no URL,
  // which is useless when the build goes red. Record what actually failed, and
  // whether it was ours or one of the CDNs, so the log names the culprit.
  const badRequests = [];
  page.on("response", (res) => {
    if (res.status() >= 400) badRequests.push(`${res.status()} ${res.url()}`);
  });
  page.on("requestfailed", (req) => {
    badRequests.push(`no response (${(req.failure() || {}).errorText || "unknown"}) ${req.url()}`);
  });

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

  // There are two layouts and either can be the default, so walk both. Counting
  // only one layout's selectors is how this test can pass while visiting
  // nothing at all — assert we actually clicked something.
  let visited = 0;

  /* Every nav destination must put a real route in the address bar. A screen id
     in NAV or MENUS with no matching entry in the router's table silently falls
     back to the overview, which looks like a working click and is invisible
     without this check. Record what the URL was after each one. */
  const seenPaths = new Set();
  const deadEnds = [];
  async function recordRoute(label) {
    const hash = await page.evaluate(() => window.location.hash);
    const path = hash.replace(/^#/, "");
    if (!path || path === "/") deadEnds.push(`${label} -> ${hash || "(no hash)"}`);
    else seenPaths.add(path);
  }

  async function walkClassic() {
    const tabs = await page.locator(".kg-tab").count();
    for (let i = 0; i < tabs; i++) {
      const tabLabel = (await page.locator(".kg-tab").nth(i).innerText()).trim();
      await page.locator(".kg-tab").nth(i).click();
      await page.waitForTimeout(250);
      visited++;
      await recordRoute(`sidebar/${tabLabel}`);
      // Re-count each step: navigating can change how many sub-tabs exist, so
      // a cached count goes stale and waits forever on an index that's gone.
      for (let j = 0; j < (await page.locator(".kg-subtab").count()); j++) {
        const sub = page.locator(".kg-subtab").nth(j);
        if (!(await sub.count())) break;
        const subLabel = (await sub.innerText()).trim();
        await sub.click();
        await page.waitForTimeout(200);
        visited++;
        await recordRoute(`sidebar/${tabLabel} > ${subLabel}`);
      }
    }
    return tabs;
  }

  async function walkFrame() {
    const menus = await page.locator(".kg-menu__btn").count();
    for (let i = 0; i < menus; i++) {
      const menuLabel = (await page.locator(".kg-menu__btn").nth(i).innerText()).trim();
      await page.locator(".kg-menu__btn").nth(i).click();
      // Step the pointer off the menu bar, or the hover-opened dropdown sits
      // over the sidebar and swallows the next click.
      await page.mouse.move(5, 600);
      await page.waitForTimeout(250);
      visited++;
      await recordRoute(`frame/${menuLabel}`);
      for (let j = 0; j < (await page.locator(".kg-side__link").count()); j++) {
        const link = page.locator(".kg-side__link").nth(j);
        if (!(await link.count())) break;
        const linkLabel = (await link.innerText()).trim();
        await link.click();
        await page.waitForTimeout(200);
        visited++;
        await recordRoute(`frame/${menuLabel} > ${linkLabel}`);
      }
    }
    return menus;
  }

  /* Homestead is the default layout, so leaving it out would mean the layout
     almost everyone sees is the one nothing tests. Walks the primary nav and
     every link in the Atlas dropdown. */
  async function walkHomestead() {
    const nav = await page.locator(".kg-hs__navbtn").count();
    for (let i = 0; i < nav; i++) {
      const label = (await page.locator(".kg-hs__navbtn").nth(i).innerText()).trim();
      await page.locator(".kg-hs__navbtn").nth(i).click();
      await page.mouse.move(5, 700);
      await page.waitForTimeout(250);
      visited++;
      await recordRoute(`homestead/${label}`);
    }
    // The Atlas menu only renders on hover, so open it before reading its links.
    await page.locator(".kg-hs__navitem", { has: page.locator(".kg-hs__mega") }).first().hover();
    await page.waitForTimeout(200);
    const links = await page.locator(".kg-hs__megalink").count();
    for (let j = 0; j < links; j++) {
      await page.locator(".kg-hs__navitem", { has: page.locator(".kg-hs__mega") }).first().hover();
      await page.waitForTimeout(120);
      const link = page.locator(".kg-hs__megalink").nth(j);
      const label = (await link.innerText()).trim();
      await link.click();
      await page.mouse.move(5, 700);
      await page.waitForTimeout(220);
      visited++;
      await recordRoute(`homestead/Atlas > ${label}`);
    }
    // The rail's Quick Links use the shared LinkStack.
    const quick = await page.locator(".kg-hs__rail .kg-ui-links__link").count();
    for (let k = 0; k < Math.min(quick, 6); k++) {
      const l = page.locator(".kg-hs__rail .kg-ui-links__link").nth(0);
      if (!(await l.count())) break;
      await l.click();
      await page.waitForTimeout(200);
      visited++;
    }
    return nav + links;
  }

  async function setLayout(which) {
    await page.evaluate((v) => window.localStorage.setItem("kennel-layout", v), which);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(900);
  }

  /* The whole point of phase 5 is that entering a trial is a commitment that
     pays out later, not a die roll that pays out now. That is a claim about
     behaviour over time, so it needs a test that actually spans a day:
     enter, confirm money and energy left, turn the day, confirm a result
     arrived and the entry cleared. */
  async function checkTrialEntries() {
    const problems = [];
    const readState = () => page.evaluate(() => {
      const raw = window.localStorage.getItem("kennel-save-v7");
      if (!raw) return null;
      const s = JSON.parse(raw);
      return {
        cash: s.cash,
        day: s.day,
        entries: (s.entries || []).length,
        energies: (s.dogs || []).map((d) => (typeof d.energy === "number" ? d.energy : 100)),
        results: (s.log || []).filter((l) => /won the |placed behind /.test(l.text)).length,
      };
    });

    await page.evaluate(() => { window.location.hash = "#/trials"; });
    await page.waitForTimeout(500);

    const picker = page.locator(".kg-pairpick select").first();
    if (!(await picker.count())) { problems.push("no entrant picker on the trials screen"); return problems; }
    const values = await picker.locator("option").evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
    if (!values.length) { problems.push("no dog eligible to enter"); return problems; }
    await picker.selectOption(values[0]);
    await page.waitForTimeout(300);

    const before = await readState();
    const enterBtn = page.getByRole("button", { name: /^Enter the / });
    if (!(await enterBtn.count())) { problems.push("no enter button after picking a dog"); return problems; }
    await enterBtn.first().click();
    await page.waitForTimeout(500);

    const entered = await readState();
    if (entered.entries !== before.entries + 1) problems.push(`entering did not queue an entry (${before.entries} -> ${entered.entries})`);
    if (!(entered.cash < before.cash)) problems.push("entering did not charge an entry fee");
    if (entered.day !== before.day) problems.push(`entering advanced the day (${before.day} -> ${entered.day}) — it should not`);
    if (Math.min(...entered.energies) >= 100) problems.push("entering did not spend any energy");
    if (entered.results !== before.results) problems.push("a result posted immediately instead of next day");
    visited++;

    // Turn the day. Rest is the one control that moves time without needing a
    // fit dog, which matters because the entered dog just spent its energy.
    await page.evaluate(() => { window.location.hash = "#/overview"; });
    await page.waitForTimeout(400);
    const rest = page.getByRole("button", { name: /rest a week/i });
    if (!(await rest.count())) { problems.push("no rest control to turn the day with"); return problems; }
    await rest.first().click();
    await page.waitForTimeout(700);

    const after = await readState();
    if (after.day <= entered.day) problems.push("resting did not advance the day");
    if (after.entries !== 0) problems.push(`entry did not resolve on the day tick (${after.entries} left)`);
    if (after.results <= before.results) problems.push("no trial result posted after the day turned");
    if (Math.min(...after.energies) < 100) problems.push("energy did not refill on the day tick");

    return problems;
  }

  /* The toy and mood rules are pure logic and live in scripts/test-care.mjs.
     This one has to be here, because it is about the screen: a lapsed
     vaccination must refuse the entry AND say where to fix it, and only a real
     page can show whether the fix link is actually there. */
  async function checkVaccinationGate() {
    const problems = [];
    await page.evaluate(() => {
      const s = JSON.parse(window.localStorage.getItem("kennel-save-v7"));
      s.entries = [];
      s.dogs = s.dogs.map((d) => ({ ...d, vaccinatedUntilDay: 0, energy: 100 }));
      window.localStorage.setItem("kennel-save-v7", JSON.stringify(s));
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(900);

    await page.evaluate(() => { window.location.hash = "#/trials"; });
    await page.waitForTimeout(500);
    const picker = page.locator(".kg-pairpick select").first();
    if (!(await picker.count())) { problems.push("no entrant picker"); return problems; }
    const values = await picker.locator("option").evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
    if (!values.length) { problems.push("no dog available for the vaccination check"); return problems; }
    await picker.selectOption(values[0]);
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /^Enter the / }).first().click();
    await page.waitForTimeout(500);

    const queued = await page.evaluate(() =>
      (JSON.parse(window.localStorage.getItem("kennel-save-v7")).entries || []).length);
    if (queued !== 0) problems.push("an unvaccinated dog was accepted into a trial");

    const refusal = page.locator(".kg-ui-notice--error").first();
    if (!(await refusal.count())) {
      problems.push("no refusal shown for an unvaccinated entry");
    } else {
      const text = await refusal.innerText();
      if (!/vaccinat/i.test(text)) problems.push(`refusal did not mention vaccination: ${text.slice(0, 70)}`);
      if (!(await refusal.locator(".kg-ui-notice__fix").count())) problems.push("refusal offered no link to the fix");
    }

    // Put the kennel back so the entry test after this one has a fair start.
    await page.evaluate(() => {
      const s = JSON.parse(window.localStorage.getItem("kennel-save-v7"));
      s.dogs = s.dogs.map((d) => ({ ...d, vaccinatedUntilDay: s.day + 365, energy: 100 }));
      window.localStorage.setItem("kennel-save-v7", JSON.stringify(s));
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    visited++;
    return problems;
  }

  /* The ranch tab strip is the only way into About, History and Stats, so
     without walking it those three screens and their routes go untested. */
  async function walkRanchTabs() {
    await page.evaluate(() => { window.location.hash = "#/kennel"; });
    await page.waitForTimeout(400);
    const count = await page.locator(".kg-ranch__head .kg-ui-tabs__tab").count();
    if (!count) return 0;
    for (let i = 0; i < count; i++) {
      const t = page.locator(".kg-ranch__head .kg-ui-tabs__tab").nth(i);
      if (!(await t.count())) break;
      const label = (await t.innerText()).trim();
      await t.click();
      await page.waitForTimeout(300);
      visited++;
      await recordRoute(`ranch/${label}`);
    }
    return count;
  }

  /* The animal profile is the one page with a parameterised route, so it is
     also the only one that can break by resolving the wrong animal or none at
     all. Open one from the yard, walk its four tabs, and check a made-up id
     gets an explanation rather than an empty page. */
  async function checkAnimalProfile() {
    const problems = [];
    await page.evaluate(() => { window.location.hash = "#/kennel"; });
    await page.waitForTimeout(400);

    const name = page.locator(".kg-card__namebtn").first();
    if (!(await name.count())) { problems.push("no dog in the yard to open"); return problems; }
    await name.click();
    await page.waitForTimeout(500);

    const hash = await page.evaluate(() => window.location.hash);
    if (!/^#\/animal\/dog\/.+/.test(hash)) problems.push(`opening a dog gave ${hash}`);
    if (!(await page.locator(".kg-ap__name").count())) problems.push("profile page did not render");

    for (const t of ["Items", "Career", "History", "About"]) {
      const tabBtn = page.locator(".kg-ap__main .kg-ui-tabs__tab", { hasText: t }).first();
      if (!(await tabBtn.count())) { problems.push(`no ${t} tab`); continue; }
      await tabBtn.click();
      await page.waitForTimeout(250);
      visited++;
      if (!(await page.locator(".kg-ui-panel").count())) problems.push(`${t} tab rendered nothing`);
    }

    // An id that was never real — a sold dog, or a shared link gone stale.
    await page.evaluate(() => { window.location.hash = "#/animal/dog/not-a-real-id"; });
    await page.waitForTimeout(400);
    const gone = await page.locator(".kg-ui-notice--error").count();
    if (!gone) problems.push("a missing animal did not explain itself");

    return problems;
  }

  /* Routing is only worth having if the browser's own controls work with it:
     a deep link has to open its screen cold, back has to undo a navigation,
     and a junk URL has to land somewhere real instead of a blank page. */
  async function checkBrowserNavigation() {
    const problems = [];
    const heading = () => page.locator(".kg-subhead, h1, h2").first().innerText().catch(() => "");

    await page.evaluate(() => { window.location.hash = "#/records/ledger"; });
    await page.waitForTimeout(400);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    const cold = await page.evaluate(() => window.location.hash);
    if (cold !== "#/records/ledger") problems.push(`deep link did not survive a reload: ${cold}`);
    const ledgerText = await heading();

    await page.evaluate(() => { window.location.hash = "#/kennel"; });
    await page.waitForTimeout(400);
    await page.goBack();
    await page.waitForTimeout(500);
    const back = await page.evaluate(() => window.location.hash);
    if (back !== "#/records/ledger") problems.push(`back button landed on ${back}, expected #/records/ledger`);
    const afterBack = await heading();
    if (ledgerText && afterBack !== ledgerText) {
      problems.push(`back changed the URL but not the screen (${afterBack} vs ${ledgerText})`);
    }

    await page.evaluate(() => { window.location.hash = "#/not-a-real-page"; });
    await page.waitForTimeout(500);
    const fallback = await page.evaluate(() => window.location.hash);
    if (fallback !== "#/overview") problems.push(`unknown route did not fall back to the overview: ${fallback}`);

    return problems;
  }

  await setLayout("home");
  const homeStops = await walkHomestead();
  console.log(`Homestead layout: ${homeStops} nav entries and Atlas links walked.`);

  await setLayout("frame");
  const menus = await walkFrame();
  console.log(`Frame layout: ${menus} menus walked.`);

  // Classic last, so the group-hunt walkthrough below — which drives .kg-tab —
  // runs with the sidebar layout on screen.
  await setLayout("classic");
  const tabs = await walkClassic();
  console.log(`Sidebar layout: ${tabs} nav entries walked.`);

  const vaxProblems = await checkVaccinationGate();
  console.log("Vaccination: a lapsed dog is refused, and told where to fix it.");

  const entryProblems = await checkTrialEntries();
  console.log("Trials: entered, day turned, result posted, energy refilled.");

  const ranchTabs = await walkRanchTabs();
  console.log(`Ranch: ${ranchTabs} tabs walked.`);

  const profileProblems = await checkAnimalProfile();
  console.log("Animal profile: opened from the yard, four tabs walked, stale id handled.");

  const navProblems = await checkBrowserNavigation();
  console.log(`Routing: ${seenPaths.size} distinct URLs reached, deep link + back + fallback checked.`);

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
    if (badRequests.length) {
      console.error(`\nFailed requests (${badRequests.length}) — likely the source of the above:`);
      for (const r of badRequests) console.error(" - " + r);
    }
    process.exit(1);
  }
  // A pass with nothing clicked is not a pass.
  if (ranchTabs < RANCH_TAB_COUNT) {
    console.error(`
Ranch tab strip showed ${ranchTabs} tabs, expected ${RANCH_TAB_COUNT}.`);
    process.exit(1);
  }
  if (homeStops === 0 || menus === 0 || tabs === 0 || visited < 20) {
    console.error(`\nSmoke test reached almost nothing: ${homeStops} homestead stops, ` +
      `${menus} menus, ${tabs} nav entries, ${visited} screens visited.`);
    console.error("Either a layout stopped rendering or its selectors changed.");
    process.exit(1);
  }
  if (deadEnds.length) {
    console.error(`\n${deadEnds.length} nav destination(s) with no route of their own:`);
    for (const d of deadEnds) console.error(" - " + d);
    console.error("Add the screen id to ROUTES in js/router.jsx.");
    process.exit(1);
  }
  if (vaxProblems.length) {
    console.error("\nThe vaccination gate is broken:");
    for (const p of vaxProblems) console.error(" - " + p);
    process.exit(1);
  }
  if (entryProblems.length) {
    console.error("\nThe trial entry loop is broken:");
    for (const p of entryProblems) console.error(" - " + p);
    process.exit(1);
  }
  if (profileProblems.length) {
    console.error("\nThe animal profile page is broken:");
    for (const p of profileProblems) console.error(" - " + p);
    process.exit(1);
  }
  if (navProblems.length) {
    console.error("\nBrowser navigation is broken:");
    for (const p of navProblems) console.error(" - " + p);
    process.exit(1);
  }
  console.log(`\nSmoke test passed: onboarding + ${visited} screen visits across all three layouts, ` +
    `${seenPaths.size} routes, zero console errors.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
