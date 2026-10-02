// Generates the studio site's key art as SVG: studio/assets/art/*.svg.
//
// The art is procedural (seeded, so every run produces identical files) and
// deliberately abstract — it's illustration, not gameplay, and the site labels
// it that way. Re-run after tweaking:  npm run studio:art
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "studio", "assets", "art");
fs.mkdirSync(OUT, { recursive: true });

// Small deterministic PRNG so the art is stable between runs.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n) => Math.round(n * 10) / 10;

const W = 1600;
const H = 1000;

// ─── Hogs & Dogs ────────────────────────────────────────────────────────────
function hogsAndDogs() {
  const r = rng(7);
  const HZ = 690; // horizon

  // Stars
  let stars = "";
  for (let i = 0; i < 70; i++) {
    const x = r() * W, y = r() * 360, rad = r() * 1.4 + 0.3;
    stars += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rad)}" opacity="${f(0.2 + r() * 0.6)}"/>`;
  }

  // Sun scanline cuts: bars that thicken toward the horizon
  let cuts = "";
  for (let i = 0; i < 7; i++) {
    const y = 560 + i * 20;
    const h = 2 + i * 1.6;
    cuts += `<rect x="0" y="${y}" width="${W}" height="${f(h)}"/>`;
  }

  // Treeline: pines of varying height packed along the horizon
  function treeline(seedOffset, base, minH, maxH, density, fill, opacity) {
    const t = rng(seedOffset);
    let d = `M0 ${base + 40} L0 ${base}`;
    let x = -20;
    while (x < W + 20) {
      const h = minH + t() * (maxH - minH);
      const w = 14 + t() * 22;
      d += ` L${f(x)} ${base} L${f(x + w * 0.5)} ${f(base - h)} L${f(x + w)} ${base}`;
      x += w * density;
    }
    d += ` L${W} ${base} L${W} ${base + 40} Z`;
    return `<path d="${d}" fill="${fill}" opacity="${opacity}"/>`;
  }

  // Topographic contours: noisy concentric loops
  function contour(cx, cy, rx, ry, seed) {
    const t = rng(seed);
    const k = [t() * 6, t() * 6, t() * 6];
    let d = "";
    const N = 64;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const n = 1 + 0.08 * Math.sin(a * 3 + k[0]) + 0.05 * Math.sin(a * 5 + k[1]) + 0.04 * Math.sin(a * 7 + k[2]);
      const x = cx + Math.cos(a) * rx * n;
      const y = cy + Math.sin(a) * ry * n;
      d += (i === 0 ? "M" : "L") + f(x) + " " + f(y) + " ";
    }
    return d + "Z";
  }
  let contours = "";
  for (let i = 1; i <= 9; i++) contours += `<path d="${contour(560, 880, 90 * i, 30 * i, 100 + i)}"/>`;
  for (let i = 1; i <= 6; i++) contours += `<path d="${contour(1340, 900, 70 * i, 22 * i, 200 + i)}"/>`;

  // Grass blades along the horizon and foreground
  let grass = "";
  for (let i = 0; i < 520; i++) {
    const x = r() * W;
    const y = HZ + 6 + Math.pow(r(), 1.6) * 300;
    const h = 6 + (y - HZ) * 0.09 + r() * 10;
    const lean = (r() - 0.5) * h * 0.8;
    grass += `M${f(x)} ${f(y)} q${f(lean * 0.3)} ${f(-h * 0.6)} ${f(lean)} ${f(-h)} `;
  }

  // Fence with simple perspective: posts get taller as they come forward
  let fence = "";
  const fp = [];
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const x = 40 + t * 700;
    const yb = 812 - t * 92; // ground line
    const h = 108 - t * 66;
    fp.push([x, yb, h]);
    fence += `<rect x="${f(x - (6 - t * 3) / 2)}" y="${f(yb - h)}" width="${f(6 - t * 3)}" height="${f(h)}"/>`;
  }
  for (const k of [0.25, 0.55, 0.85]) {
    let d = "";
    fp.forEach(([x, yb, h], i) => (d += (i ? "L" : "M") + f(x) + " " + f(yb - h * k) + " "));
    fence += `<path d="${d}" fill="none" stroke="#0a070b" stroke-width="${2.4}"/>`;
  }

  // Windmill
  const wx = 300, wy = 452;
  let blades = "";
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const a1 = a - 0.07, a2 = a + 0.07;
    blades += `<path d="M${f(wx + Math.cos(a) * 14)} ${f(wy + Math.sin(a) * 14)} L${f(wx + Math.cos(a1) * 78)} ${f(wy + Math.sin(a1) * 78)} L${f(wx + Math.cos(a2) * 78)} ${f(wy + Math.sin(a2) * 78)} Z"/>`;
  }
  const windmill = `
    <g fill="#08060a" stroke="#08060a">
      <path d="M266 ${HZ + 50} L292 ${wy + 18} M334 ${HZ + 50} L308 ${wy + 18}" stroke-width="5" fill="none"/>
      <path d="M272 ${HZ - 10} L328 ${HZ - 10} M278 600 L322 600 M284 520 L316 520 M272 ${HZ - 10} L322 600 M328 ${HZ - 10} L278 600 M278 600 L316 520 M322 600 L284 520" stroke-width="2.4" fill="none"/>
      ${blades}
      <circle cx="${wx}" cy="${wy}" r="15"/>
      <path d="M${wx + 10} ${wy - 2} L${wx + 82} ${wy - 6}" stroke-width="4" fill="none"/>
      <path d="M${wx + 76} ${wy - 26} L${wx + 112} ${wy - 34} L${wx + 112} ${wy + 18} L${wx + 76} ${wy + 10} Z"/>
    </g>`;

  // Hunter's stand in the far field
  const stand = `
    <g fill="#120a12" stroke="#120a12" opacity="0.9">
      <rect x="1288" y="604" width="44" height="30"/>
      <path d="M1282 606 L1310 590 L1338 606 Z"/>
      <path d="M1292 634 L1284 ${HZ + 4} M1328 634 L1336 ${HZ + 4} M1290 650 L1330 670 M1330 650 L1290 670" stroke-width="3" fill="none"/>
    </g>`;

  // Tracking path, waypoints, prints
  const pathD = "M180 990 C 380 930, 420 860, 620 850 S 900 800, 1040 770 S 1230 738, 1300 716";
  const paw = (x, y, a, s, op) => `
    <g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)}) scale(${f(s)})" opacity="${f(op)}">
      <ellipse cx="0" cy="4" rx="7" ry="6"/>
      <ellipse cx="-8" cy="-5" rx="2.6" ry="3.4"/><ellipse cx="-3" cy="-9" rx="2.6" ry="3.4"/>
      <ellipse cx="3" cy="-9" rx="2.6" ry="3.4"/><ellipse cx="8" cy="-5" rx="2.6" ry="3.4"/>
    </g>`;
  const hoof = (x, y, a, s, op) => `
    <g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)}) scale(${f(s)})" opacity="${f(op)}">
      <path d="M-2 8 C-9 6 -9 -6 -3 -11 C-1 -4 -1 3 -2 8 Z"/>
      <path d="M2 8 C9 6 9 -6 3 -11 C1 -4 1 3 2 8 Z"/>
    </g>`;
  // Hand-placed points along the curve, scaled for perspective
  const pawPts = [[230, 968, 62, 2.3], [300, 940, 58, 2.1], [372, 910, 62, 1.95], [440, 884, 70, 1.8], [510, 864, 78, 1.6], [582, 852, 82, 1.45], [652, 844, 78, 1.3]];
  const hoofPts = [[760, 826, 76, 1.15], [826, 812, 74, 1.05], [892, 798, 76, 0.95], [958, 786, 76, 0.86], [1022, 774, 78, 0.78]];
  let prints = "";
  pawPts.forEach(([x, y, a, s], i) => (prints += paw(x + (i % 2 ? 10 : -10), y + (i % 2 ? 6 : -6), a, s, 0.55 + i * 0.03)));
  hoofPts.forEach(([x, y, a, s], i) => (prints += hoof(x + (i % 2 ? 7 : -7), y + (i % 2 ? 4 : -4), a, s, 0.7)));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Hogs and Dogs key art illustration">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#07060f"/>
    <stop offset="0.32" stop-color="#1f0f2e"/>
    <stop offset="0.52" stop-color="#5a1f3c"/>
    <stop offset="0.64" stop-color="#b8462f"/>
    <stop offset="0.69" stop-color="#f08a3a"/>
  </linearGradient>
  <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffe3a0"/>
    <stop offset="0.6" stop-color="#ff9a45"/>
    <stop offset="1" stop-color="#ff5a3c"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#ff9d4d" stop-opacity="0.55"/>
    <stop offset="1" stop-color="#ff9d4d" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="field" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#1a0e14"/>
    <stop offset="0.35" stop-color="#0e0a0f"/>
    <stop offset="1" stop-color="#060508"/>
  </linearGradient>
  <linearGradient id="trk" x1="0" y1="1" x2="1" y2="0">
    <stop offset="0" stop-color="#3dffa8" stop-opacity="0.15"/>
    <stop offset="0.6" stop-color="#3dffa8" stop-opacity="0.9"/>
    <stop offset="1" stop-color="#2de2ff"/>
  </linearGradient>
  <radialGradient id="vig" cx="0.5" cy="0.45" r="0.75">
    <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
    <stop offset="1" stop-color="#000" stop-opacity="0.75"/>
  </radialGradient>
  <mask id="sunCut"><rect width="${W}" height="${H}" fill="#fff"/><g fill="#000">${cuts}</g></mask>
  <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" opacity="0.18"/></pattern>
  <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<g fill="#fff">${stars}</g>
<ellipse cx="1060" cy="${HZ - 20}" rx="520" ry="300" fill="url(#glow)"/>
<circle cx="1060" cy="${HZ}" r="215" fill="url(#sun)" mask="url(#sunCut)"/>
<path d="M0 ${HZ - 40} C 220 ${HZ - 90}, 420 ${HZ - 60}, 640 ${HZ - 80} S 1100 ${HZ - 50}, 1300 ${HZ - 95} S 1520 ${HZ - 70}, ${W} ${HZ - 60} L${W} ${HZ + 20} L0 ${HZ + 20} Z" fill="#3a1630" opacity="0.85"/>
${treeline(11, HZ - 2, 30, 90, 0.62, "#1c0c1c", 1)}
${treeline(12, HZ + 8, 14, 46, 0.7, "#110812", 1)}
${stand}
<rect y="${HZ}" width="${W}" height="${H - HZ}" fill="url(#field)"/>
<path d="M0 ${HZ + 2} H${W}" stroke="#ff9d4d" stroke-opacity="0.35" stroke-width="2"/>
<g fill="none" stroke="#3dffa8" stroke-opacity="0.12" stroke-width="1.4">${contours}</g>
<path d="${grass}" fill="none" stroke="#1f1219" stroke-width="1.6" stroke-linecap="round"/>
${windmill}
<g fill="#0a070b">${fence}</g>
<path d="${pathD}" fill="none" stroke="#3dffa8" stroke-opacity="0.35" stroke-width="10" filter="url(#soft)"/>
<path d="${pathD}" fill="none" stroke="url(#trk)" stroke-width="2.6" stroke-dasharray="2 10" stroke-linecap="round"/>
<g fill="#c9ffe6">${prints}</g>
<g font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="15" letter-spacing="2">
  <g transform="translate(620 850)">
    <circle r="22" fill="none" stroke="#3dffa8" stroke-opacity="0.5"/>
    <circle r="6" fill="#3dffa8"/>
    <path d="M30 -30 L64 -64 H190" fill="none" stroke="#3dffa8" stroke-opacity="0.7"/>
    <text x="70" y="-74" fill="#3dffa8">TRACK 01 · K9</text>
  </g>
  <g transform="translate(1300 716)">
    <circle r="16" fill="none" stroke="#ffb15c" stroke-opacity="0.75"/>
    <circle r="34" fill="none" stroke="#ffb15c" stroke-opacity="0.3" stroke-dasharray="4 6"/>
    <circle r="4.5" fill="#ffb15c"/>
    <path d="M-28 -28 L-60 -60 H-190" fill="none" stroke="#ffb15c" stroke-opacity="0.7"/>
    <text x="-190" y="-70" fill="#ffb15c">QUARRY</text>
  </g>
</g>
<rect width="${W}" height="${H}" fill="url(#vig)"/>
<rect width="${W}" height="${H}" fill="url(#scan)"/>
</svg>
`;
}

// ─── Roll For Glory ─────────────────────────────────────────────────────────
function rollForGlory() {
  const r = rng(42);
  const HZ = 540;
  const VX = 800; // vanishing point

  let stars = "";
  for (let i = 0; i < 60; i++) {
    stars += `<circle cx="${f(r() * W)}" cy="${f(r() * 300)}" r="${f(r() * 1.2 + 0.3)}" opacity="${f(0.15 + r() * 0.5)}"/>`;
  }

  // Skyline: two layers of buildings with lit windows
  function skyline(seed, minH, maxH, fill, winOpacity) {
    const t = rng(seed);
    let rects = "", wins = "";
    let x = -10;
    while (x < W) {
      const w = 34 + t() * 70;
      // Taller towers cluster toward the centre, behind the road.
      const centre = 1 - Math.min(1, Math.abs(x + w / 2 - VX) / 760);
      const h = minH + t() * (maxH - minH) * (0.45 + centre * 0.75);
      rects += `<rect x="${f(x)}" y="${f(HZ - h)}" width="${f(w)}" height="${f(h + 2)}"/>`;
      if (t() < 0.18) rects += `<rect x="${f(x + w / 2 - 1.5)}" y="${f(HZ - h - 30)}" width="3" height="30"/>`;
      for (let wy = HZ - h + 8; wy < HZ - 6; wy += 9) {
        for (let wx = x + 5; wx < x + w - 5; wx += 8) {
          if (t() < 0.16) {
            const c = t() < 0.7 ? "#ffcf7a" : t() < 0.5 ? "#2de2ff" : "#d58bff";
            wins += `<rect x="${f(wx)}" y="${f(wy)}" width="3" height="4" fill="${c}" opacity="${f(winOpacity * (0.4 + t() * 0.6))}"/>`;
          }
        }
      }
      x += w + 2 + t() * 6;
    }
    return `<g fill="${fill}">${rects}</g>${wins}`;
  }

  // Road dashes in perspective
  let dashes = "";
  for (let i = 0; i < 16; i++) {
    const z0 = Math.pow(i / 16, 2.2), z1 = Math.pow((i + 0.45) / 16, 2.2);
    const y0 = HZ + z0 * (H - HZ), y1 = HZ + z1 * (H - HZ);
    const w0 = 1 + z0 * 18, w1 = 1 + z1 * 18;
    dashes += `<path d="M${f(VX - w0 / 2)} ${f(y0)} L${f(VX + w0 / 2)} ${f(y0)} L${f(VX + w1 / 2)} ${f(y1)} L${f(VX - w1 / 2)} ${f(y1)} Z"/>`;
  }

  // Light trails sweeping in from the edges toward the vanishing point
  const trails = [
    ["#2de2ff", -220, H + 40, 0.9, 7],
    ["#2de2ff", -60, H + 60, 0.6, 4],
    ["#b18cff", 1820, H + 40, 0.9, 7],
    ["#ff4fd8", 1700, H + 70, 0.6, 4],
    ["#ffffff", 120, H + 80, 0.35, 2.5],
    ["#ff3b5c", 1480, H + 90, 0.45, 3],
  ];
  let trailSvg = "";
  trails.forEach(([c, x0, y0, op, sw], i) => {
    const cx = (x0 + VX) / 2 + (x0 < VX ? 60 : -60);
    const cy = HZ + 60 + i * 6;
    const d = `M${x0} ${y0} Q ${f(cx)} ${f(cy + 120)} ${VX + (x0 < VX ? -6 : 6)} ${HZ + 4}`;
    trailSvg += `<path d="${d}" stroke="${c}" stroke-opacity="${op * 0.5}" stroke-width="${sw * 4}" filter="url(#glow)"/>`;
    trailSvg += `<path d="${d}" stroke="url(#fade${i})" stroke-width="${sw}"/>`;
  });
  const trailGrads = trails
    .map(([c, x0], i) => `<linearGradient id="fade${i}" gradientUnits="userSpaceOnUse" x1="${x0}" y1="${H}" x2="${VX}" y2="${HZ}"><stop offset="0" stop-color="${c}" stop-opacity="0"/><stop offset="0.35" stop-color="${c}" stop-opacity="0.95"/><stop offset="1" stop-color="${c}" stop-opacity="0.1"/></linearGradient>`)
    .join("");

  // Speed lines radiating from the vanishing point
  let speed = "";
  for (let i = 0; i < 90; i++) {
    const a = r() * Math.PI * 2;
    const r0 = 380 + r() * 260, r1 = r0 + 120 + r() * 260;
    const y0 = HZ + Math.sin(a) * r0 * 0.7, y1 = HZ + Math.sin(a) * r1 * 0.7;
    if (y0 < HZ + 40) continue; // keep the sky clean; streaks only skim the ground
    speed += `<path d="M${f(VX + Math.cos(a) * r0)} ${f(y0)} L${f(VX + Math.cos(a) * r1)} ${f(y1)}" stroke-opacity="${f(0.05 + r() * 0.12)}"/>`;
  }

  // Ground grid in perspective, either side of the road
  let grid = "";
  for (let i = 1; i < 14; i++) {
    const y = HZ + Math.pow(i / 14, 2.4) * (H - HZ);
    grid += `M0 ${f(y)} H${W} `;
  }
  for (let i = -12; i <= 12; i++) {
    grid += `M${VX} ${HZ} L${VX + i * 260} ${H} `;
  }

  // Speedo HUD ticks
  let ticks = "";
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI * (0.8 + (i / 24) * 1.4);
    const inner = i % 4 === 0 ? 70 : 78;
    ticks += `<path d="M${f(Math.cos(a) * inner)} ${f(Math.sin(a) * inner)} L${f(Math.cos(a) * 86)} ${f(Math.sin(a) * 86)}" stroke="${i > 19 ? "#ff3b5c" : "#2de2ff"}" stroke-opacity="${i > 19 ? 0.9 : 0.6}"/>`;
  }
  const needleA = Math.PI * (0.8 + 0.86 * 1.4);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Roll For Glory key art illustration">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#04030a"/>
    <stop offset="0.4" stop-color="#120a26"/>
    <stop offset="0.54" stop-color="#3b1460"/>
  </linearGradient>
  <radialGradient id="hglow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#c04bff" stop-opacity="0.55"/>
    <stop offset="0.5" stop-color="#5a2bd6" stop-opacity="0.18"/>
    <stop offset="1" stop-color="#5a2bd6" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#1b0d33"/>
    <stop offset="0.4" stop-color="#0b0718"/>
    <stop offset="1" stop-color="#040308"/>
  </linearGradient>
  <linearGradient id="road" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#1a1230"/>
    <stop offset="1" stop-color="#07060c"/>
  </linearGradient>
  <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#1b1728"/>
    <stop offset="1" stop-color="#07060b"/>
  </linearGradient>
  <linearGradient id="tail" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#ff2a4d"/>
    <stop offset="0.5" stop-color="#ff6a7f"/>
    <stop offset="1" stop-color="#ff2a4d"/>
  </linearGradient>
  <radialGradient id="red" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ff2a4d" stop-opacity="0.9"/><stop offset="1" stop-color="#ff2a4d" stop-opacity="0"/></radialGradient>
  <radialGradient id="blue" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#2d7bff" stop-opacity="0.95"/><stop offset="1" stop-color="#2d7bff" stop-opacity="0"/></radialGradient>
  <radialGradient id="vig" cx="0.5" cy="0.5" r="0.75">
    <stop offset="0.5" stop-color="#000" stop-opacity="0"/>
    <stop offset="1" stop-color="#000" stop-opacity="0.8"/>
  </radialGradient>
  <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" opacity="0.2"/></pattern>
  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="8"/></filter>
  <filter id="bloom" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="14"/></filter>
  ${trailGrads}
</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<g fill="#fff">${stars}</g>
<ellipse cx="${VX}" cy="${HZ}" rx="900" ry="300" fill="url(#hglow)"/>
${skyline(5, 60, 230, "#170d2c", 0.5)}
${skyline(9, 30, 150, "#0b0718", 0.9)}
<rect y="${HZ}" width="${W}" height="${H - HZ}" fill="url(#ground)"/>
<path d="${grid}" fill="none" stroke="#8a5cff" stroke-opacity="0.16" stroke-width="1.2"/>
<path d="M0 ${HZ} H${W}" stroke="#d58bff" stroke-opacity="0.7" stroke-width="2"/>
<ellipse cx="${VX}" cy="${HZ}" rx="700" ry="26" fill="#c04bff" opacity="0.28" filter="url(#glow)"/>
<path d="M${VX - 4} ${HZ} L${VX + 4} ${HZ} L1900 ${H} L-300 ${H} Z" fill="url(#road)"/>
<path d="M${VX - 4} ${HZ} L-300 ${H}" stroke="#2de2ff" stroke-width="3" stroke-opacity="0.85"/>
<path d="M${VX + 4} ${HZ} L1900 ${H}" stroke="#b18cff" stroke-width="3" stroke-opacity="0.85"/>
<path d="M${VX - 4} ${HZ} L-300 ${H} M${VX + 4} ${HZ} L1900 ${H}" stroke="#7a5cff" stroke-width="18" stroke-opacity="0.25" filter="url(#glow)"/>
<g fill="#e9e4ff" opacity="0.55">${dashes}</g>
<g fill="none" stroke="#fff" stroke-width="1.5">${speed}</g>
<g fill="none" stroke-linecap="round">${trailSvg}</g>
<ellipse cx="${VX - 26}" cy="${HZ + 8}" rx="60" ry="22" fill="url(#red)"/>
<ellipse cx="${VX + 26}" cy="${HZ + 8}" rx="60" ry="22" fill="url(#blue)"/>
<g>
  <ellipse cx="760" cy="960" rx="330" ry="34" fill="#000" opacity="0.7"/>
  <rect x="480" y="880" width="96" height="80" rx="12" fill="#050409"/>
  <rect x="944" y="880" width="96" height="80" rx="12" fill="#050409"/>
  <path d="M560 728 C 590 690, 630 676, 760 674 C 890 676, 930 690, 960 728 L 990 790 L 530 790 Z" fill="url(#body)"/>
  <path d="M588 726 C 612 700, 650 690, 760 689 C 870 690, 908 700, 932 726 Z" fill="#2a2140"/>
  <path d="M588 726 C 612 700, 650 690, 760 689 C 870 690, 908 700, 932 726" fill="none" stroke="#2de2ff" stroke-opacity="0.45" stroke-width="2"/>
  <path d="M470 800 C 470 780, 500 770, 530 770 L 990 770 C 1020 770, 1050 780, 1050 800 L 1060 880 C 1060 902, 1040 912, 1016 912 L 504 912 C 480 912, 460 902, 460 880 Z" fill="url(#body)"/>
  <path d="M470 800 C 470 780, 500 770, 530 770 L 990 770 C 1020 770, 1050 780, 1050 800" fill="none" stroke="#b18cff" stroke-opacity="0.55" stroke-width="2.5"/>
  <rect x="490" y="806" width="540" height="20" rx="8" fill="#ff2a4d" opacity="0.7" filter="url(#bloom)"/>
  <rect x="490" y="808" width="540" height="14" rx="7" fill="url(#tail)"/>
  <rect x="700" y="842" width="120" height="34" rx="4" fill="#0f0d18" stroke="#2a2440"/>
  <rect x="530" y="884" width="460" height="16" rx="6" fill="#0c0a14"/>
  <circle cx="585" cy="892" r="9" fill="#14111e" stroke="#3a3350" stroke-width="2"/>
  <circle cx="935" cy="892" r="9" fill="#14111e" stroke="#3a3350" stroke-width="2"/>
</g>
<g transform="translate(1410 860)" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" stroke-width="2.5">
  <circle r="96" fill="#05040b" fill-opacity="0.55" stroke="#2de2ff" stroke-opacity="0.25"/>
  ${ticks}
  <path d="M0 0 L${f(Math.cos(needleA) * 74)} ${f(Math.sin(needleA) * 74)}" stroke="#ff3b5c" stroke-width="3.5" stroke-linecap="round"/>
  <circle r="6" fill="#ff3b5c"/>
  <text y="44" text-anchor="middle" font-size="26" fill="#e9e4ff">4</text>
  <text y="66" text-anchor="middle" font-size="11" letter-spacing="3" fill="#2de2ff" fill-opacity="0.8">GEAR</text>
</g>
<rect width="${W}" height="${H}" fill="url(#vig)"/>
<rect width="${W}" height="${H}" fill="url(#scan)"/>
</svg>
`;
}

fs.writeFileSync(path.join(OUT, "hogs-and-dogs.svg"), hogsAndDogs());
fs.writeFileSync(path.join(OUT, "roll-for-glory.svg"), rollForGlory());
for (const name of ["hogs-and-dogs.svg", "roll-for-glory.svg"]) {
  const kb = (fs.statSync(path.join(OUT, name)).size / 1024).toFixed(1);
  console.log(`wrote studio/assets/art/${name} (${kb} KB)`);
}
