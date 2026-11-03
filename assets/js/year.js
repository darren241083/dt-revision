// Year page (year.html?y=y10|y11|y12|y13): where one year group is in its course.
// Views, kept in the URL hash so Back works:
//   (no hash)  the year's topics, grouped by section, with status and actions
//   #mixed     "Revise all taught topics": a quiz drawn from every taught, built topic
// Quiz results live in memory for this visit only.

import { h, icon, fill } from "./dom.js";
import * as store from "./store.js";
import { loadCourses, loadTopics, statusFor, STATUS_TEXT, formatDay, topicHref, YEAR_IDS, yearShort } from "./data.js";
import { siteBar } from "./nav.js";
import { comingUpCard } from "./components/comingup.js";
import { quiz } from "./components/quiz.js";

const FILTERS = [["all", "All"], ["taught", "Taught"], ["coming", "Coming up"]];

const topbarEl = document.getElementById("topbar");
const main = document.getElementById("main");
const session = { quiz: null };
let C, y, year, course, loaded = new Map(), filter = "all", view = null;
const viewFor = () => (location.hash === "#mixed" ? "mixed" : "list");

/* ---------- Topic list ---------- */

function actions(t, status) {
  const T = loaded.get(t.id);
  if (status === "taught") {
    return [h("a", { class: "act dark", href: topicHref(t.id, y, "#revise/recall") }, "Revise"),
      T?.audio && h("a", { class: "act line", href: topicHref(t.id, y, "#listen") }, "Listen"),
      h("a", { class: "act line", href: topicHref(t.id, y, "#revise/whole") }, "Print")];
  }
  if (status === "coming" && t.built) {
    return [h("a", { class: "act soft", href: topicHref(t.id, y) }, "Read"),
      T?.audio && h("a", { class: "act soft", href: topicHref(t.id, y, "#listen") }, "Listen")];
  }
  return [];
}

function statusLine(status) {
  if (status !== "coming") return STATUS_TEXT[status];
  const day = formatDay(year.comingUp?.day);
  return day ? `Coming up · ${day}` : STATUS_TEXT.coming;
}

function row(t) {
  const status = statusFor(year, t);
  const open = t.built && status !== "not";
  return h("li", { class: `trow ${status}`, "data-status": status },
    h("span", { class: "strip", "aria-hidden": "true" }),
    h("span", { class: "code" }, t.code),
    h("span", { class: "ttl" },
      open ? h("a", { href: topicHref(t.id, y) }, t.title) : h("b", {}, t.title),
      h("span", { class: "status" }, statusLine(status))),
    h("span", { class: "spec" }, t.spec.join(" · ")),
    h("span", { class: "pages" }, `p${t.pages}`),
    h("span", { class: "acts" }, actions(t, status)));
}

function sectionList(sec) {
  const list = course.topics.filter((t) => t.section === sec.ref);
  return h("section", { class: "tsection", id: `sec-${sec.ref}`, "aria-labelledby": `sec-${sec.ref}-h` },
    h("h2", { id: `sec-${sec.ref}-h` }, `${sec.ref} · ${sec.name}`,
      sec.materials && h("span", { class: "sec-mat" }, sec.materials.map((m) => m === "timber" ? "Timbers" : "Polymers").join(" and "))),
    h("ul", { class: "card trows" }, list.map(row)));
}

function sectionIndex() {
  return h("nav", { class: "sec-index", "aria-label": "Sections" },
    h("span", { class: "label" }, "Sections"),
    h("ul", {}, course.sections.map((sec) => {
      const list = course.topics.filter((t) => t.section === sec.ref);
      const taught = list.filter((t) => year.taught.includes(t.id)).length;
      const coming = list.some((t) => t.id === year.comingUp?.topic);
      return h("li", {}, h("a", { href: `#sec-${sec.ref}`, class: coming ? "has-coming" : null },
        h("span", { class: "ref" }, sec.ref),
        h("span", { class: "name" }, sec.name),
        h("span", { class: "count" }, `${list.length} topics · ${taught} taught`)));
    })),
    h("div", { class: "key" },
      h("span", { class: "label" }, "Key"),
      [["taught", "Taught: revise any time"], ["coming", "Coming up: read or listen first"], ["not", "Not yet"]]
        .map(([k, t]) => h("span", { class: "key-row" }, h("i", { class: k, "aria-hidden": "true" }), t))));
}

function applyFilter() {
  main.querySelectorAll(".trow").forEach((r) => {
    const s = r.dataset.status;
    r.hidden = filter === "taught" ? !s.startsWith("taught") : filter === "coming" ? s !== "coming" : false;
  });
  main.querySelectorAll(".tsection").forEach((sec) => { sec.hidden = !sec.querySelector(".trow:not([hidden])"); });
  main.querySelectorAll(".filter button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.f === filter)));
  const shown = main.querySelectorAll(".trow:not([hidden])").length;
  main.querySelector(".filter-status").textContent = `${shown} topic${shown === 1 ? "" : "s"} shown`;
}

/* ---------- Mixed quiz ---------- */

// Every taught, built topic for this year, with its questions tagged by topic.
function mixedBank() {
  const topics = course.topics.filter((t) => t.built && year.taught.includes(t.id) && loaded.get(t.id)?.quiz?.length);
  const questions = topics.flatMap((t) => loaded.get(t.id).quiz.map((q) => ({ ...q, chunk: `${t.id}/${q.chunk || ""}` })));
  return { topics, questions };
}

function mixedLink(key) {
  const [id, chunkId] = key.split("/");
  const t = course.topics.find((x) => x.id === id), T = loaded.get(id);
  const ch = T?.chunks?.find((c) => c.id === chunkId);
  if (!ch) return { href: topicHref(id, y), label: `${t.code} p${t.pages}` };
  return { href: topicHref(id, y, `#lesson/learn/${ch.id}`), label: `${t.code} ${ch.label} p${ch.pages}` };
}

function mixedCard() {
  const { topics, questions } = mixedBank();
  return h("section", { class: "card mixed", "aria-labelledby": "mixed-title" },
    h("span", { class: "label" }, "Mixed quiz"),
    h("h2", { id: "mixed-title" }, "Revise all taught topics"),
    h("span", { class: "meta" }, topics.length
      ? `${topics.length} topic${topics.length > 1 ? "s" : ""} · ${questions.length} questions`
      : "No taught topic pages yet"),
    h("div", { class: "btn-row" }, topics.length
      ? h("a", { class: "btn-dark", href: "#mixed" }, "Start the mixed quiz →")
      : h("button", { type: "button", class: "btn-line", disabled: true }, "Start the mixed quiz →")));
}

function mixedView() {
  const { topics, questions } = mixedBank();
  if (!topics.length) { location.replace("#"); return listView(); }
  return h("div", { class: "year-quiz" },
    h("header", { class: "stage-head" },
      h("div", { class: "stage-titles" },
        h("span", { class: "eyebrow" }, `${yearShort(y)} · ${topics.length} taught topic${topics.length > 1 ? "s" : ""}`),
        h("h1", { id: "page-title", tabindex: "-1" }, "Revise all taught topics"))),
    quiz({ quiz: questions }, session, { chunkLink: mixedLink }),
    h("nav", { class: "stage-foot", "aria-label": "Back" },
      h("a", { class: "back", href: "#" }, `← ${year.name}`)));
}

/* ---------- Views ---------- */

function listView() {
  const coming = year.comingUp && loaded.get(year.comingUp.topic);
  return h("div", { class: "year-layout" },
    sectionIndex(),
    h("div", { class: "year-main" },
      h("header", { class: "year-head" },
        h("div", { class: "year-titles" },
          h("span", { class: "eyebrow" }, `${course.board} ${course.spec} · ${course.name}`),
          h("h1", { id: "page-title", tabindex: "-1" }, year.name),
          h("span", { class: "year-book" }, icon("book"), course.book)),
        h("div", { class: "filter-wrap" },
          h("div", { class: "seg filter", role: "group", "aria-label": "Show" },
            FILTERS.map(([f, label]) => h("button", {
              type: "button", "data-f": f, "aria-pressed": String(filter === f), onclick: () => { filter = f; applyFilter(); }
            }, label))),
          h("p", { class: "sr-only filter-status", "aria-live": "polite" }))),
      h("div", { class: "year-top" },
        comingUpCard({ y, year, course, topic: coming || null }),
        mixedCard()),
      course.sections.map(sectionList)));
}

function render(moved) {
  view = viewFor();
  document.title = `${view === "mixed" ? "Revise all taught topics · " : ""}${year.name} · D&T Revision`;
  fill(main, view === "mixed" ? mixedView() : listView());
  if (view === "list") applyFilter();
  if (moved) {
    window.scrollTo(0, 0);
    main.querySelector("#page-title")?.focus({ preventScroll: true });
  }
}

function chooser() {
  siteBar(topbarEl, { current: null, years: C.years });
  fill(main, h("div", { class: "message" },
    h("h1", { id: "page-title" }, "Pick your year"),
    h("div", { class: "btn-row" }, YEAR_IDS.map((id) => h("a", { class: "btn-line", href: `year.html?y=${id}` }, C.years[id].name)))));
}

async function init() {
  try {
    C = await loadCourses();
  } catch {
    fill(main, h("div", { class: "message" }, h("h1", { id: "page-title" }, "This page didn't load"),
      h("p", {}, "Check your connection and try again.")));
    return;
  }
  const asked = new URLSearchParams(location.search).get("y");
  y = YEAR_IDS.includes(asked) ? asked : YEAR_IDS.includes(store.get("year")) ? store.get("year") : null;
  if (!y) return chooser();
  if (!store.get("year")) store.set("year", y);
  year = C.years[y];
  course = C.levels[year.level];
  document.documentElement.dataset.level = year.level;
  siteBar(topbarEl, { current: y, y, years: C.years });

  const ids = course.topics.filter((t) => t.built && (year.taught.includes(t.id) || year.comingUp?.topic === t.id)).map((t) => t.id);
  loaded = await loadTopics(year.level, ids);
  // Section links (#sec-A) only scroll; the page is redrawn only when the view changes.
  window.addEventListener("hashchange", () => { if (viewFor() !== view) render(true); });
  render(false);
}

init();
