// scripts/generate-art.mjs
//
// Generates the art in docs/art-prompts.md against the OpenAI images API,
// under a hard spending cap.
//
//   node scripts/generate-art.mjs --dry-run           show the bill, spend nothing
//   node scripts/generate-art.mjs --budget 15         generate, stop at $15
//   node scripts/generate-art.mjs --only dogs         just one folder
//
// The key is read from OPENAI_API_KEY and never printed, never written to a
// file, and never passed on a command line where it would land in shell history.
//
// READ THIS: the cap below is a courtesy, not a guarantee. It is arithmetic in
// a script that could be wrong, interrupted, or run twice. The only limit that
// actually holds is the one set on the OpenAI account itself, under Settings ->
// Limits -> Budgets. Set that too.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ASSETS = path.join(ROOT, "assets");

/* Per-image cost, derived from OpenAI's published token counts for a 1024x1024
   gpt-image-1 image and the $40/1M output-token rate. Kept here rather than
   hardcoded as dollars so it stays checkable against their docs. */
const OUT_RATE = 40.00 / 1_000_000;
const IN_RATE = 5.00 / 1_000_000;
const TOKENS = { low: 272, medium: 1056, high: 4160 };
const PROMPT_TOKENS = 120;
const costPer = (q) => TOKENS[q] * OUT_RATE + PROMPT_TOKENS * IN_RATE;

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf("--" + name);
  return i === -1 ? fallback : (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true);
};
const DRY = args.includes("--dry-run");
const BUDGET = Number(flag("budget", 15));
const QUALITY = String(flag("quality", "medium"));
const ONLY = flag("only", null);

if (!TOKENS[QUALITY]) {
  console.error(`quality must be one of: ${Object.keys(TOKENS).join(", ")}`);
  process.exit(1);
}

/* ------------------------------------------------------------ the work list -- */
/* Parsed out of the brief rather than duplicated here, so the two can never
   disagree about what needs drawing. Each sheet block lists its cells as
   "N. `folder/file.png` — description", and the prompt text follows in a
   fenced block; for the API each cell is generated on its own, so the sheet
   grouping is ignored and only the per-cell prompt matters. */
function readWorkList() {
  const md = fs.readFileSync(path.join(ROOT, "docs", "art-prompts.md"), "utf8");
  // Split on CRLF as well as LF. A trailing \r survives a plain split("\n") and
  // then breaks every `(.*)$` below, because `.` does not match a carriage
  // return — which presents as the brief appearing to be empty.
  const lines = md.split(/\r?\n/);
  const jobs = [];
  let style = null;

  // The style preamble is the first line of the first fenced block.
  const firstFence = lines.findIndex((l) => l.trim() === "```");
  if (firstFence !== -1) style = lines[firstFence + 1];

  let cells = [];
  let inFence = false;
  let fenceLines = [];
  for (const line of lines) {
    const cell = line.match(/^(\d+)\.\s+`([^`]+)`\s+—\s+(.*)$/);
    if (cell && !inFence) { cells.push({ n: Number(cell[1]), file: cell[2] }); continue; }

    if (line.trim() === "```") {
      if (!inFence) { inFence = true; fenceLines = []; continue; }
      inFence = false;
      // Numbered lines inside the fence are the real prompts, in cell order.
      const prompts = fenceLines
        .map((l) => l.match(/^(\d+)\.\s+(.*)$/))
        .filter(Boolean)
        .map((m) => ({ n: Number(m[1]), text: m[2] }));
      for (const p of prompts) {
        const c = cells.find((x) => x.n === p.n);
        if (c) jobs.push({ file: c.file, prompt: `${style} ${p.text}` });
      }
      cells = [];
      continue;
    }
    if (inFence) fenceLines.push(line);
  }
  return jobs;
}

let jobs = readWorkList();
if (ONLY && ONLY !== true) jobs = jobs.filter((j) => j.file.startsWith(ONLY));

/* Anything already on disk is skipped. This is what makes an interrupted run
   safe to restart: it picks up where it stopped instead of paying twice. */
const todo = jobs.filter((j) => !fs.existsSync(path.join(ASSETS, j.file)));
const skipped = jobs.length - todo.length;

const per = costPer(QUALITY);
const estimate = per * todo.length;

console.log(`brief lists      ${jobs.length} images`);
console.log(`already on disk  ${skipped}`);
console.log(`to generate      ${todo.length}`);
console.log(`quality          ${QUALITY} ($${per.toFixed(4)} each)`);
console.log(`estimated cost   $${estimate.toFixed(2)}`);
console.log(`budget cap       $${BUDGET.toFixed(2)}`);
console.log();

if (estimate > BUDGET) {
  const affordable = Math.floor(BUDGET / per);
  console.log(`That is over the cap. Will stop after ${affordable} images ($${(affordable * per).toFixed(2)}).`);
  console.log(`Re-run to continue, or use --quality low ($${(costPer("low") * todo.length).toFixed(2)} for all of them).`);
  console.log();
}

if (DRY) {
  console.log("--dry-run: nothing generated, nothing spent.");
  todo.slice(0, 10).forEach((j) => console.log("  would draw " + j.file));
  if (todo.length > 10) console.log(`  ... and ${todo.length - 10} more`);
  process.exit(0);
}

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) {
  console.error("OPENAI_API_KEY is not set in the environment.");
  console.error("Set it and re-run. Do not pass it as an argument - it would end up in shell history.");
  process.exit(1);
}

/* ---------------------------------------------------------------- generate -- */
let spent = 0, made = 0, failed = 0;

for (const job of todo) {
  // Checked before every single call, not once at the start, so a miscount
  // early on cannot run away.
  if (spent + per > BUDGET) {
    console.log(`\nStopping: the next image would put spend at $${(spent + per).toFixed(2)}, over the $${BUDGET.toFixed(2)} cap.`);
    break;
  }

  const dest = path.join(ASSETS, job.file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  process.stdout.write(`${String(made + 1).padStart(3)}/${todo.length}  ${job.file.padEnd(38)} `);
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: job.prompt,
        size: "1024x1024",
        quality: QUALITY,
        n: 1,
        background: "transparent",
      }),
      signal: AbortSignal.timeout(180000),
    });

    if (!res.ok) {
      const body = await res.text();
      // Never echo the key back, even if the API includes it in an error.
      console.log(`FAILED ${res.status} ${body.slice(0, 120).replace(KEY, "[key]")}`);
      failed++;
      // A 401 or 429 will not fix itself by trying 159 more times.
      if (res.status === 401 || res.status === 403) { console.log("Auth rejected - stopping."); break; }
      continue;
    }

    const data = await res.json();
    const b64 = data && data.data && data.data[0] && data.data[0].b64_json;
    if (!b64) { console.log("FAILED no image in response"); failed++; continue; }

    fs.writeFileSync(dest, Buffer.from(b64, "base64"));
    spent += per; made++;
    console.log(`ok   $${spent.toFixed(2)} spent`);
  } catch (e) {
    console.log("FAILED " + String(e.message).slice(0, 100));
    failed++;
  }
}

console.log();
console.log(`made ${made}, failed ${failed}, spent about $${spent.toFixed(2)} of $${BUDGET.toFixed(2)}`);
if (made) console.log("Run `npm run art:manifest` so the game knows the new files exist.");
