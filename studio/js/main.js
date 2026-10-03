// Glitch Gaming Studios site. Plain ES modules, no build step.
// Content lives in js/data/; this file only turns it into markup and wires up
// the interactions.
import { games, STATUS } from "./data/games.js";
import { updates } from "./data/updates.js";
import { site } from "./data/site.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const canHover = matchMedia("(hover: hover) and (pointer: fine)");

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Only http(s) URLs are ever turned into links.
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");

const art = (path, w) => path.replace(/\.svg$/, `-${w}.jpg`);

// ─── Rendering ───────────────────────────────────────────────────────────────

function gameButtons(g, { inModal = false } = {}) {
  const url = safeUrl(g.url);
  const playable = g.status === STATUS.PLAYABLE && url;
  const primary = playable
    ? `<a class="btn btn--primary" href="${esc(url)}" target="_blank" rel="noopener">Play game<span class="sr-only"> (opens in a new tab)</span></a>`
    : `<span class="btn btn--status" aria-disabled="true">${esc(g.status)}</span>`;
  const secondary = inModal
    ? ""
    : `<a class="btn btn--ghost" href="#game-${esc(g.id)}" data-open-game="${esc(g.id)}">${playable ? "View game" : "Learn more"}</a>`;
  return primary + secondary;
}

function renderGames() {
  const host = $("[data-games]");
  host.innerHTML = games
    .map(
      (g, i) => `
    <article class="game reveal" style="--accent:${esc(g.accent)}" data-tilt id="card-${esc(g.id)}">
      <div class="game__media">
        <picture>
          <source media="(max-width: 700px)" srcset="${esc(art(g.image, 800))}" />
          <img src="${esc(art(g.image, 1600))}" alt="${esc(g.imageAlt)}" width="1600" height="1000"
               ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />
        </picture>
        <span class="game__credit">${esc(g.artCredit)}</span>
        <span class="game__status game__status--${g.status === STATUS.PLAYABLE ? "live" : "soon"}">${esc(g.status)}</span>
      </div>
      <div class="game__body">
        <p class="game__cat">${g.category.map(esc).join(" • ")}</p>
        <h3 class="game__title">${esc(g.title)}</h3>
        <p class="game__desc">${esc(g.description)}</p>
        <ul class="game__features">${g.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
        <div class="game__actions">${gameButtons(g)}</div>
      </div>
    </article>`
    )
    .join("");
}

function renderTicker() {
  $("[data-ticker]").innerHTML = games
    .map(
      (g) => `<li style="--accent:${esc(g.accent)}"><span class="ticker__dot"></span>${esc(g.title)}<em>${esc(g.status)}</em></li>`
    )
    .join("");
}

// Every number here is counted from the data, never typed in.
function renderStats() {
  const stats = [
    { value: "01", label: "Studio" },
    { value: String(games.length).padStart(2, "0"), label: games.length === 1 ? "Project" : "Projects" },
    { value: String(games.filter((g) => g.status === STATUS.PLAYABLE).length).padStart(2, "0"), label: "Playable now" },
    { value: "∞", label: "Ideas" },
  ];
  $("[data-stats]").innerHTML = stats
    .map((s) => `<div class="stat reveal"><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`)
    .join("");
}

function renderTeam() {
  $("[data-team]").innerHTML = site.team
    .map((m) => {
      const photo = m.photo
        ? `<img class="member__photo" src="${esc(m.photo)}" alt="${esc(m.name)}" width="120" height="120" loading="lazy" />`
        : `<div class="member__photo member__photo--empty" aria-hidden="true"><span>${esc(
            m.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("")
          )}</span></div>`;
      return `
    <article class="panel member reveal">
      ${photo}
      <div class="member__info">
        <p class="member__role">${esc(m.role)}</p>
        <h3 class="member__name">${esc(m.name)}</h3>
        ${m.bio ? `<p class="member__bio">${esc(m.bio)}</p>` : ""}
      </div>
    </article>`;
    })
    .join("");
}

const fmtDate = (iso) =>
  iso
    ? new Date(iso + "T12:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : "Date TBA";

function renderLog() {
  $("[data-log]").innerHTML = updates
    .map(
      (u) => `
    <article class="post panel reveal">
      <header class="post__meta">
        <time ${u.date ? `datetime="${esc(u.date)}"` : ""}>${esc(fmtDate(u.date))}</time>
        <span class="post__cat">${esc(u.category)}</span>
        ${u.placeholder ? `<span class="post__ph">Placeholder</span>` : ""}
      </header>
      <h3 class="post__title">${esc(u.title)}</h3>
      <p>${esc(u.summary)}</p>
      <a class="post__more" href="#log-${esc(u.id)}" data-open-post="${esc(u.id)}">Read more <span aria-hidden="true">→</span></a>
    </article>`
    )
    .join("");
}

function renderSocial() {
  $("[data-social]").innerHTML = site.socials
    .map((s) => {
      const url = safeUrl(s.url);
      return url
        ? `<li><a href="${esc(url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`
        : `<li><span class="social__soon">${esc(s.label)} <em>Soon</em></span></li>`;
    })
    .join("");
}

// ─── Modal (game detail + dev log posts), deep-linkable by hash ─────────────

const modal = $("[data-modal]");
const modalBody = $("[data-modal-body]");
let lastFocus = null;

function gameDetail(g) {
  return `
    <div class="detail" style="--accent:${esc(g.accent)}">
      <div class="detail__media">
        <img src="${esc(art(g.image, 1600))}" alt="${esc(g.imageAlt)}" width="1600" height="1000" />
        <span class="game__credit">${esc(g.artCredit)}</span>
      </div>
      <div class="detail__body">
        <p class="game__cat">${g.category.map(esc).join(" • ")}</p>
        <h2 id="modal-title" class="detail__title">${esc(g.title)}</h2>
        <p class="detail__status"><span class="game__status game__status--${g.status === STATUS.PLAYABLE ? "live" : "soon"}">${esc(g.status)}</span> <span>${esc(g.platform)}</span></p>
        <p>${esc(g.description)}</p>
        ${
          g.status === STATUS.PLAYABLE
            ? ""
            : `<p class="detail__note">${esc(g.title)} is in development and isn't playable yet. There's no release date; follow the dev log for news.</p>`
        }
        <h3>Features</h3>
        <ul class="game__features game__features--full">${g.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
        <div class="game__actions">${gameButtons(g, { inModal: true })}</div>
      </div>
    </div>`;
}

function postDetail(u) {
  return `
    <article class="detail detail--post">
      <div class="detail__body">
        <p class="post__meta"><time>${esc(fmtDate(u.date))}</time><span class="post__cat">${esc(u.category)}</span>${
          u.placeholder ? `<span class="post__ph">Placeholder</span>` : ""
        }</p>
        <h2 id="modal-title" class="detail__title">${esc(u.title)}</h2>
        ${u.body.map((p) => `<p>${esc(p)}</p>`).join("")}
      </div>
    </article>`;
}

function openFromHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  let html = "";
  if (h.startsWith("game-")) {
    const g = games.find((x) => x.id === h.slice(5));
    if (g) html = gameDetail(g);
  } else if (h.startsWith("log-")) {
    const u = updates.find((x) => x.id === h.slice(4));
    if (u) html = postDetail(u);
  }
  if (!html) {
    if (modal.open) modal.close();
    return;
  }
  modalBody.innerHTML = html;
  if (!modal.open) {
    lastFocus = document.activeElement;
    modal.showModal();
    document.documentElement.classList.add("modal-open");
  }
  modalBody.scrollTop = 0;
}

function closeModal() {
  if (location.hash.match(/^#(game|log)-/)) {
    history.pushState("", document.title, location.pathname + location.search);
  }
  if (modal.open) modal.close();
}

modal.addEventListener("close", () => {
  document.documentElement.classList.remove("modal-open");
  if (location.hash.match(/^#(game|log)-/)) history.replaceState("", document.title, location.pathname + location.search);
  lastFocus?.focus?.();
});
modal.addEventListener("click", (e) => {
  if (e.target === modal || e.target.closest("[data-modal-close]")) closeModal();
});
addEventListener("hashchange", openFromHash);

// ─── Navigation ──────────────────────────────────────────────────────────────

function initNav() {
  const nav = $("[data-nav]");
  const burger = $(".burger");
  const menu = $("#site-menu");

  const setOpen = (open) => {
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    nav.classList.toggle("is-open", open);
    document.documentElement.classList.toggle("menu-open", open);
  };
  burger.addEventListener("click", () => setOpen(burger.getAttribute("aria-expanded") !== "true"));
  menu.addEventListener("click", (e) => e.target.closest("a") && setOpen(false));
  addEventListener("keydown", (e) => e.key === "Escape" && setOpen(false));
  matchMedia("(min-width: 960px)").addEventListener("change", (e) => e.matches && setOpen(false));

  const onScroll = () => nav.classList.toggle("is-scrolled", scrollY > 12);
  onScroll();
  addEventListener("scroll", onScroll, { passive: true });

  // Highlight the section in view.
  const links = $$("[data-link]");
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        links.forEach((a) => {
          const on = a.dataset.link === en.target.id;
          a.classList.toggle("is-active", on);
          on ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current");
        });
      }
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  ["home", "games", "about", "updates", "contact"].forEach((id) => io.observe(document.getElementById(id)));
}

// ─── Scroll reveal ───────────────────────────────────────────────────────────

function initReveal() {
  const els = $$(".reveal");
  if (reduceMotion.matches || !("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          en.target.classList.add("is-in");
          io.unobserve(en.target);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );
  els.forEach((el, i) => {
    // Stagger siblings that enter together.
    el.style.setProperty("--d", `${(i % 4) * 70}ms`);
    io.observe(el);
  });
}

// ─── Card tilt + parallax (fine pointers only) ──────────────────────────────

function initTilt() {
  if (!canHover.matches || reduceMotion.matches) return;
  for (const card of $$("[data-tilt]")) {
    let raf = 0;
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        card.style.setProperty("--rx", `${(-y * 4).toFixed(2)}deg`);
        card.style.setProperty("--ry", `${(x * 5).toFixed(2)}deg`);
        card.style.setProperty("--px", `${(-x * 18).toFixed(1)}px`);
        card.style.setProperty("--py", `${(-y * 12).toFixed(1)}px`);
        card.style.setProperty("--mx", `${((x + 0.5) * 100).toFixed(1)}%`);
        card.style.setProperty("--my", `${((y + 0.5) * 100).toFixed(1)}%`);
      });
    });
    card.addEventListener("pointerleave", () => {
      cancelAnimationFrame(raf);
      ["--rx", "--ry", "--px", "--py"].forEach((p) => card.style.removeProperty(p));
    });
  }
}

// ─── Background particles ────────────────────────────────────────────────────

function initParticles() {
  const canvas = $(".bg__particles");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const colors = ["61,255,168", "45,226,255", "139,92,255"];
  let w, h, dpr, pts = [], raf = 0, running = false;

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.width = innerWidth * dpr;
    h = canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
    const n = Math.round(Math.min(70, (innerWidth * innerHeight) / 22000));
    pts = Array.from({ length: n }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: (Math.random() * 1.4 + 0.4) * dpr,
      vy: -(Math.random() * 0.25 + 0.05) * dpr,
      vx: (Math.random() - 0.5) * 0.12 * dpr,
      a: Math.random() * 0.5 + 0.15,
      c: colors[(Math.random() * colors.length) | 0],
    }));
  };

  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    for (const p of pts) {
      if (running) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.c},${p.a})`;
      ctx.fill();
    }
    if (running) raf = requestAnimationFrame(draw);
  };

  const start = () => {
    running = !reduceMotion.matches && !document.hidden;
    cancelAnimationFrame(raf);
    draw();
  };

  resize();
  start();
  let t;
  addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => { resize(); start(); }, 150); });
  document.addEventListener("visibilitychange", start);
  reduceMotion.addEventListener("change", start);
}

// ─── Contact form ────────────────────────────────────────────────────────────
// Never claims a message was sent unless an endpoint returned success.

function initContact() {
  const form = $("[data-contact]");
  const status = $(".form__status", form);
  const btn = $("button[type=submit]", form);
  const endpoint = safeUrl(site.contactEndpoint);

  const say = (msg, kind) => {
    status.textContent = msg;
    status.dataset.kind = kind || "";
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (data.website) return; // honeypot

    let firstBad = null;
    for (const el of $$("input[required], textarea[required]", form)) {
      const ok = el.value.trim() && el.checkValidity();
      el.toggleAttribute("aria-invalid", !ok);
      if (!ok && !firstBad) firstBad = el;
    }
    if (firstBad) {
      say("Please fill in your name, a valid email and a message.", "error");
      firstBad.focus();
      return;
    }

    if (!endpoint) {
      say("The contact form isn't connected yet, so your message was not sent. Please check back soon.", "info");
      return;
    }

    btn.disabled = true;
    say("Sending…");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name: data.name.trim(), email: data.email.trim(), message: data.message.trim() }),
      });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      say("Thanks, your message was sent.", "ok");
    } catch {
      say("Something went wrong and your message wasn't sent. Please try again.", "error");
    } finally {
      btn.disabled = false;
    }
  });
}

// ─── Boot ────────────────────────────────────────────────────────────────────

renderTicker();
renderGames();
renderStats();
renderTeam();
renderLog();
renderSocial();

document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-open-game], [data-open-post]");
  if (!g) return;
  // Let the hash change drive the modal so back/forward and shared links work.
  e.preventDefault();
  const hash = g.getAttribute("href");
  if (location.hash === hash) openFromHash();
  else location.hash = hash;
});

initNav();
initReveal();
initTilt();
initParticles();
initContact();
openFromHash();

const ready = () => document.body.classList.remove("is-loading");
if (reduceMotion.matches) ready();
else if (document.readyState === "complete") setTimeout(ready, 300);
else addEventListener("load", () => setTimeout(ready, 300));
setTimeout(ready, 2500); // never hold the page hostage to a slow asset
