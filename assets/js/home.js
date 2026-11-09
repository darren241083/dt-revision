// Home page (index.html): one card per year group (Y10, Y11, Y12, Y13), each with a topic
// dropdown that opens on that year's lesson topic. Every built topic file is loaded so
// the cards know which topics have audio and how long it is.

import { h, fill } from "./dom.js";
import * as store from "./store.js";
import { loadCourses, loadTopics, setCourses, YEAR_IDS } from "./data.js";
import { siteBar } from "./nav.js";
import { editEntry } from "./editentry.js";
import { yearCard } from "./components/yearcard.js";

const topbarEl = document.getElementById("topbar");
const main = document.getElementById("main");

let C = null, loaded = new Map();
const mine = () => (YEAR_IDS.includes(store.get("year")) ? store.get("year") : null);

function render() {
  siteBar(topbarEl, { current: "home", y: mine(), years: C.years, extra: edit.button() });
  fill(main,
    h("h1", { class: "sr-only", id: "page-title" }, "D&T Revision"),
    h("div", { class: "ycard-grid" }, YEAR_IDS.map((y) => {
      const year = C.years[y];
      return yearCard({ y, year, course: C.levels[year.level], topics: loaded });
    })));
}

async function load() {
  C = await loadCourses();
  const maps = await Promise.all(Object.entries(C.levels).map(([level, course]) =>
    loadTopics(level, course.topics.filter((t) => t.built).map((t) => t.id))));
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
  edit.auto();
}

/* ---------- Teacher edit mode (Year groups only here) ---------- */

const edit = editEntry(() => ({
  topic: null, level: null,
  rerender: () => { if (C) render(); },
  savedCourses: async (fresh) => { setCourses(fresh); await load(); render(); }
}), () => !!C);

init();
