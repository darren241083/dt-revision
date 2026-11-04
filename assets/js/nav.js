// Top bar for the home and year pages: D&T Revision · Home · Y10 · Y11 · Y12 · Y13 · search.
// Search runs in the browser over built topics only (titles, chunk labels, key words);
// the topic files are fetched the first time the search box is used.

import { h, icon, fill } from "./dom.js";
import { loadCourses, loadTopics, topicHref, YEAR_IDS, yearShort } from "./data.js";

const MAX_RESULTS = 8;

// current: "home" or a year id. y: the year to carry into topic links (or null).
// extra: an optional button at the end (the teacher's Edit button on the home page).
export function siteBar(el, { current, y = null, years, extra = null }) {
  const links = [["home", "index.html", "Home"], ...YEAR_IDS.map((id) => [id, `year.html?y=${id}`, yearShort(id)])];
  const nav = h("nav", { class: "site-nav", "aria-label": "Main" },
    h("ul", {}, links.map(([id, href, label]) =>
      h("li", {}, h("a", {
        href, class: id === "home" ? "home" : years[id]?.level, "aria-current": id === current ? "page" : null
      }, label)))));

  const search = searchBox(y);
  const toggle = h("button", {
    type: "button", class: "search-toggle", "aria-label": "Search", "aria-expanded": "false", "aria-controls": "site-search"
  }, icon("search"));
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    search.classList.toggle("open", open);
    if (open) search.querySelector("input").focus();
  });

  el.classList.add("site");
  fill(el, h("div", { class: "topbar-in sitebar" },
    h("a", { class: "brand", href: "index.html" }, "D&T Revision"), nav, search, toggle, extra));
}

/* ---------- Search ---------- */

let index = null;

async function buildIndex(y) {
  const c = await loadCourses();
  const rows = [];
  for (const [level, course] of Object.entries(c.levels)) {
    const built = course.topics.filter((t) => t.built);
    const loaded = await loadTopics(level, built.map((t) => t.id));
    for (const entry of built) {
      const T = loaded.get(entry.id);
      const yy = y && c.years[y]?.level === level ? y : null;
      const where = `${entry.code} · ${entry.title}`;
      rows.push({ text: entry.title, sub: `${course.short} · ${entry.code}`, href: topicHref(entry.id, yy), rank: 0 });
      if (!T) continue;
      const seen = new Set();
      for (const ch of T.chunks || []) {
        const chunkHref = topicHref(entry.id, yy, `#lesson/learn/${ch.id}`);
        rows.push({ text: ch.label, sub: where, href: chunkHref, rank: 1 });
        for (const it of ch.items || []) {
          const k = it.term.toLowerCase();
          if (seen.has(k)) continue;
          seen.add(k);
          rows.push({ text: it.term, sub: `${where} · ${ch.label}`, href: chunkHref, rank: 2 });
        }
      }
      for (const kw of T.keywords || []) {
        if (seen.has(kw.term.toLowerCase())) continue;
        seen.add(kw.term.toLowerCase());
        rows.push({ text: kw.term, sub: where, href: topicHref(entry.id, yy), rank: 2 });
      }
    }
  }
  return rows;
}

const norm = (s) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function find(rows, query) {
  const words = norm(query).split(" ").filter(Boolean);
  if (!words.length) return [];
  return rows
    .map((r) => ({ r, t: norm(r.text) }))
    .filter(({ t }) => words.every((w) => t.split(" ").some((part) => part.startsWith(w)) || t.includes(w)))
    .sort((a, b) => (b.t.startsWith(words[0]) - a.t.startsWith(words[0])) || a.r.rank - b.r.rank || a.t.localeCompare(b.t))
    .slice(0, MAX_RESULTS)
    .map(({ r }) => r);
}

function searchBox(y) {
  const input = h("input", {
    type: "search", id: "site-search-input", autocomplete: "off", spellcheck: "false",
    placeholder: "Find a topic or key word", "aria-describedby": "site-search-status"
  });
  const status = h("p", { class: "sr-only", id: "site-search-status", "aria-live": "polite" });
  const list = h("ul", { class: "search-results", id: "site-search-results", hidden: true });
  const box = h("div", { class: "search", id: "site-search", role: "search" },
    h("label", { class: "search-field" }, icon("search"),
      h("span", { class: "sr-only" }, "Find a topic or key word"), input),
    list, status);

  let timer = 0;
  const load = () => (index ||= buildIndex(y).catch(() => { index = null; return []; }));

  async function run() {
    const q = input.value.trim();
    if (!q) { list.hidden = true; status.textContent = ""; return; }
    const rows = await load();
    if (input.value.trim() !== q) return;
    const hits = find(rows, q);
    fill(list, hits.length
      ? hits.map((r) => h("li", {}, h("a", { href: r.href }, h("b", {}, r.text), h("span", {}, r.sub))))
      : h("li", { class: "none" }, "No matches in the topic pages yet"));
    list.hidden = false;
    status.textContent = hits.length ? `${hits.length} result${hits.length > 1 ? "s" : ""}` : "No matches";
  }

  const links = () => [...list.querySelectorAll("a")];
  input.addEventListener("focus", load, { once: true });
  input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(run, 120); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" && links().length) { e.preventDefault(); links()[0].focus(); }
    if (e.key === "Escape") { input.value = ""; run(); }
  });
  list.addEventListener("keydown", (e) => {
    const all = links(), i = all.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); all[Math.min(i + 1, all.length - 1)]?.focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); (i > 0 ? all[i - 1] : input).focus(); }
    if (e.key === "Escape") { list.hidden = true; input.focus(); }
  });
  document.addEventListener("click", (e) => { if (!box.contains(e.target)) list.hidden = true; });
  input.addEventListener("focus", () => { if (input.value.trim()) run(); });
  return box;
}
