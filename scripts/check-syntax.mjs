// Parses every js/*.jsx file with Babel to catch syntax errors before they
// ever reach a player's browser. This is what the game's own script tags do
// at runtime (type="text/babel") — we just do it ahead of time, in CI.
import { transformSync } from "@babel/core";
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "js");

// Recurses, because the screens live in js/screens/. A flat readdir silently
// stopped covering them the moment that directory appeared, which is exactly
// the kind of gap a syntax check is supposed to not have.
function jsxFilesIn(root) {
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...jsxFilesIn(full));
    else if (entry.name.endsWith(".jsx")) out.push(full);
  }
  return out.sort();
}

const files = jsxFilesIn(dir);

if (files.length === 0) {
  console.error("No .jsx files found in js/ — did the project layout change?");
  process.exit(1);
}

// index.html must load every one of them, or a file can parse cleanly in CI
// and still never reach the browser.
const html = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");
const unloaded = files
  .map((f) => path.relative(process.cwd(), f).split(path.sep).join("/"))
  .filter((rel) => !html.includes(`src="${rel}"`));
if (unloaded.length) {
  console.error("These .jsx files are never loaded by index.html:");
  for (const f of unloaded) console.error(`      ${f}`);
  process.exit(1);
}

let failed = false;
for (const file of files) {
  const label = path.relative(dir, file).split(path.sep).join("/");
  const code = fs.readFileSync(file, "utf8");
  try {
    transformSync(code, { presets: ["@babel/preset-react"], filename: file });
    console.log(`OK    ${label}`);
  } catch (e) {
    failed = true;
    console.error(`FAIL  ${label}`);
    console.error(`      ${e.message.split("\n")[0]}`);
  }
}

process.exit(failed ? 1 : 0);
