// Parses every js/*.jsx file with Babel to catch syntax errors before they
// ever reach a player's browser. This is what the game's own script tags do
// at runtime (type="text/babel") — we just do it ahead of time, in CI.
import { transformSync } from "@babel/core";
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "js");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsx")).sort();

if (files.length === 0) {
  console.error("No .jsx files found in js/ — did the project layout change?");
  process.exit(1);
}

let failed = false;
for (const f of files) {
  const file = path.join(dir, f);
  const code = fs.readFileSync(file, "utf8");
  try {
    transformSync(code, { presets: ["@babel/preset-react"], filename: file });
    console.log(`OK    ${f}`);
  } catch (e) {
    failed = true;
    console.error(`FAIL  ${f}`);
    console.error(`      ${e.message.split("\n")[0]}`);
  }
}

process.exit(failed ? 1 : 0);
