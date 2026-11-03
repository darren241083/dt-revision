// Home page (index.html): a "Coming up" card per year group, a card per year with its
// progress through the course, and the pupil's recently taught topics.
// The pupil's year is remembered on this device only and puts that year first.

import { h, fill } from "./dom.js";
import * as store from "./store.js";
import { loadCourses, loadTopics, setCourses, statusFor, STATUS_TEXT, topicHref, YEAR_IDS, yearShort } from "./data.js";
import { siteBar } from "./nav.js";
import { comingUpCard } from "./components/comingup.js";

const RECENT = 3;
const topbarEl = document.getElementById("topbar");
const main = document.getElementById("main");

let C = null, loaded = new Map();
const mine = () => (YEAR_IDS.includes(store.get("year")) ? store.get("year") : null);

function pickYear(y) {
  store.set("year", y);
  render();
  main.querySelector(`.your-year [data-y="${y}"]`)?.focus();
}

/* ---------- Parts ---------- */

function yearPicker() {
  const me = mine();
  return h("div", { class: "your-year" },
    h("span", { class: "label", id: "your-year-label" }, "Your year"),
    h("div", { class: "seg years-seg", role: "group", "aria-labelledby": "your-year-label" },
      YEAR_IDS.map((y) => h("button", {
        type: "button", class: C.years[y].level, "data-y": y, "aria-pressed": String(me === y), onclick: () => pickYear(y)
      }, yearShort(y)))));
}

function yearCard(y) {
  const year = C.years[y], course = C.levels[year.level];
  return h("section", { class: `card yearcard ${year.level}`, "aria-labelledby": `yc-${y}` },
    h("div", { class: "yc-head" },
      h("div", { class: "yc-titles" },
        h("h2", { id: `yc-${y}` }, yearShort(y)),
        h("span", {}, `${year.name} · ${course.short} · ${course.board} ${course.spec}`)),
      h("a", { class: "yc-link", href: `year.html?y=${y}`, "aria-label": `All ${year.name} topics` }, "All topics →")),
    h("ul", { class: "yc-sections" }, course.sections.map((sec) => {
      const list = course.topics.filter((t) => t.section === sec.ref);
      const states = list.map((t) => statusFor(year, t));
      const taught = states.filter((s) => s.startsWith("taught")).length;
      const coming = states.includes("coming");
      return h("li", {},
        h("span", { class: "yc-ref" }, sec.ref),
        h("span", { class: "yc-name" }, sec.name),
        h("span", { class: "yc-count" }, `${taught} of ${list.length} taught` + (coming ? " · 1 coming up" : "")),
        h("span", { class: "squares", "aria-hidden": "true" }, states.map((s) => h("i", { class: s }))));
    })));
}

function recent(y) {
  const year = C.years[y], course = C.levels[year.level];
  const list = course.topics.filter((t) => t.built && year.taught.includes(t.id)).slice(-RECENT).reverse();
  if (!list.length) return null;
  return h("section", { class: "recent", "aria-labelledby": "recent-title" },
    h("h2", { id: "recent-title" }, "Recently taught"),
    h("div", { class: "recent-grid" }, list.map((t) => {
      const T = loaded.get(t.id);
      return h("article", { class: "card recent-card" },
        h("span", { class: "tags" }, h("span", { class: `tag ${year.level}` }, course.short), h("span", { class: "spec" }, t.spec.join(" · "))),
        h("h3", {}, t.title),
        h("span", { class: "sr-only" }, STATUS_TEXT[statusFor(year, t)]),
        h("div", { class: "btn-row" },
          h("a", { class: "btn-dark", href: topicHref(t.id, y, "#revise/recall") }, "Revise"),
          T?.audio && h("a", { class: "btn-line", href: topicHref(t.id, y, "#listen") }, "Listen"),
          h("a", { class: "btn-line", href: topicHref(t.id, y, "#revise/whole") }, "Print sheet")));
    })),
    h("a", { class: "more", href: `year.html?y=${y}` }, `All ${yearShort(y)} topics →`));
}

/* ---------- Render ---------- */

function render() {
  const me = mine();
  const order = me ? [me, ...YEAR_IDS.filter((y) => y !== me)] : YEAR_IDS;
  const mark = (y) => (me ? (y === me ? "mine" : "other") : "");
  siteBar(topbarEl, { current: "home", y: me, years: C.years });
  fill(main,
    h("h1", { class: "sr-only", id: "page-title" }, "D&T Revision"),
    yearPicker(),
    h("section", { class: "coming-grid", "aria-label": "Coming up" }, order.map((y) => {
      const year = C.years[y], course = C.levels[year.level];
      const card = comingUpCard({ y, year, course, topic: loaded.get(year.comingUp?.topic) || null });
      if (mark(y)) card.classList.add(mark(y));
      return card;
    })),
    h("section", { class: "year-grid", "aria-label": "Year groups" }, order.map((y) => {
      const card = yearCard(y);
      if (mark(y)) card.classList.add(mark(y));
      return card;
    })),
    me && recent(me));
}

async function load() {
  C = await loadCourses();
  // Topic files needed: each year's coming-up page and recently taught pages, when built.
  const want = { gcse: new Set(), alevel: new Set() };
  for (const y of YEAR_IDS) {
    const year = C.years[y], course = C.levels[year.level];
    for (const t of course.topics) {
      if (t.built && (t.id === year.comingUp?.topic || year.taught.includes(t.id))) want[year.level].add(t.id);
    }
  }
  const maps = await Promise.all(Object.entries(want).map(([level, ids]) => loadTopics(level, [...ids])));
  loaded = new Map(maps.flatMap((m) => [...m]));
}

async function init() {
  try {
    await load();
  } catch {
    fill(main, h("div", { class: "message" }, h("h1", { id: "page-title" }, "This page didn't load"),
      h("p", {}, "Check your connection and try again.")));
    return;
  }
  render();
  if (new URLSearchParams(location.search).has("edit")) toggleEdit();
}

/* ---------- Teacher edit mode (Year groups only here) ---------- */

let edit = null;
async function toggleEdit() {
  edit ||= await import("./edit.js");
  if (edit.isOn()) return edit.stop();
  edit.start({
    topic: null, level: null,
    rerender: () => {},
    savedCourses: async (fresh) => { setCourses(fresh); await load(); render(); }
  });
}
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && (e.key === "E" || e.key === "e")) { e.preventDefault(); toggleEdit(); }
});

init();
