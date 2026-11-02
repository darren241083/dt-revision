// Topic page engine (topic.html?id=<topic-id>). Renders any topic from its JSON file.
//
// Views, kept in the URL hash so Back works and a stage can be linked to:
//   (no hash)               topic overview
//   #lesson/<stage>         a Lesson-mode stage
//   #lesson/learn/<chunk>   one Learn chunk
//   #revise/<stage>         a Revise-mode stage
// Which stages have been visited lives in memory only and clears when the page is left.

import { h, icon, hint } from "./dom.js";
import * as store from "./store.js";
import { findTopic, loadTopic } from "./data.js";

const MATERIAL = { timber: "Timber", polymer: "Polymer" };

const RECALL = {
  id: "recall", label: "Recall", eyebrow: "Recall · no looking back", title: "From memory",
  hints: [["brain", "Books closed"]], tip: "Books closed. Pairs fill the map from memory, then check."
};
const TEST = {
  id: "test", label: "Test", sub: "Quiz and exam questions", eyebrow: "Test", title: "Prove it",
  hints: [["tap", "Answer, then say how sure"]], tip: "Sure, Unsure or Guess shows who is guessing."
};

const MODES = {
  lesson: {
    label: "Lesson",
    stages: [
      { id: "do-now", label: "Do now", sub: "Starter", eyebrow: "Do now · answer first, then reveal", title: "Do now",
        hints: [["tap", "Tap a card to reveal"]], tip: "Answers on whiteboards first. Reveal one card at a time." },
      { id: "big-picture", label: "Big picture", sub: "Topic map", eyebrow: (t) => `Big picture · ${t.chunks.length} chunks`,
        title: "The whole topic", hints: [["tap", "Tap a branch, then an item"]],
        tip: "Open each branch. Ask what pupils already know before reading it." },
      { id: "learn", label: "Learn", sub: (t) => `${t.chunks.length} short chunks`,
        tip: "One chunk at a time. Use the check before moving on." },
      { id: "apply", label: "Apply", sub: "Which tool, and why?", eyebrow: "Apply", title: "Which tool, and why?",
        hints: [["tap", "Pick a tool, then a reason"]], tip: "Pupils say the reason aloud before you show the answer." },
      { ...RECALL, sub: "From memory" },
      TEST
    ]
  },
  revise: {
    label: "Revise",
    stages: [
      { ...RECALL, sub: "Map and key words" },
      TEST,
      { id: "fix", label: "Fix", sub: "Re-read only what you missed", eyebrow: "Fix · what you missed", title: "Fix these first",
        hints: [["book", "Re-read, then retest"]], tip: "Re-teach the chunk most pupils missed." },
      { id: "whole", label: "Whole topic", sub: "Cover and test", eyebrow: "Whole topic · cover and test", title: "Everything on one page",
        hints: [["eye", "Cover, then check"]], tip: "Cover the answers and cold-call." }
    ]
  }
};

const S = {
  topic: null, level: null, course: null, entry: null, section: null,
  view: "overview",
  mode: store.get("mode", "revise") === "lesson" ? "lesson" : "revise",
  stage: 0,
  chunk: 0,
  visited: { lesson: new Set(), revise: new Set() }
};

const topbarEl = document.getElementById("topbar");
const app = document.getElementById("app");
const val = (v) => (typeof v === "function" ? v(S.topic) : v);
const isLearn = (mode, stage) => MODES[mode].stages[stage].id === "learn";

/* ---------- Teaching mode ---------- */

let teach = !!store.get("teach", false);
function applyTeach() {
  document.documentElement.classList.toggle("teach", teach);
}
function toggleTeach() {
  teach = !teach;
  store.set("teach", teach);
  applyTeach();
  topbar();
}
applyTeach();

/* ---------- Routing ---------- */

function hashFor(mode, stage, chunk = 0) {
  const st = MODES[mode].stages[stage];
  return `#${mode}/${st.id}` + (st.id === "learn" ? `/${S.topic.chunks[chunk].id}` : "");
}

function parseHash() {
  const [mode, stageId, chunkId] = decodeURIComponent(location.hash.slice(1)).split("/");
  if (!MODES[mode]) return { view: "overview" };
  const stages = MODES[mode].stages;
  const stage = Math.max(0, stages.findIndex((s) => s.id === stageId));
  const chunk = stages[stage].id === "learn" ? Math.max(0, S.topic.chunks.findIndex((c) => c.id === chunkId)) : 0;
  return { view: "stage", mode, stage, chunk };
}

// Every place Back/Next can land in a mode, in order. Learn is one place per chunk.
function sequence(mode) {
  return MODES[mode].stages.flatMap((st, stage) =>
    st.id === "learn" ? S.topic.chunks.map((_, chunk) => ({ stage, chunk })) : [{ stage, chunk: 0 }]);
}
function neighbours() {
  const seq = sequence(S.mode);
  const i = seq.findIndex((p) => p.stage === S.stage && p.chunk === S.chunk);
  return { prev: seq[i - 1] || null, next: seq[i + 1] || null };
}
const placeLabel = (p) => isLearn(S.mode, p.stage) ? S.topic.chunks[p.chunk].label : MODES[S.mode].stages[p.stage].label;
const go = (p) => { location.hash = p ? hashFor(S.mode, p.stage, p.chunk) : ""; };

function switchMode(mode) {
  if (S.view === "stage" && mode === S.mode) return;
  // Keep the same stage when the other mode has it (Recall, Test).
  const same = S.view === "stage" ? MODES[mode].stages.findIndex((s) => s.id === MODES[S.mode].stages[S.stage].id) : -1;
  location.hash = hashFor(mode, Math.max(0, same));
}

/* ---------- Visited (memory only) ---------- */

const visitKey = (mode, stage, chunk) => isLearn(mode, stage) ? `learn:${S.topic.chunks[chunk].id}` : MODES[mode].stages[stage].id;
function isDone(stage) {
  const v = S.visited[S.mode];
  if (isLearn(S.mode, stage)) return S.topic.chunks.every((c) => v.has(`learn:${c.id}`));
  return v.has(MODES[S.mode].stages[stage].id);
}

/* ---------- Top bar ---------- */

function topbar() {
  const kids = [h("a", { class: "brand", href: "index.html" }, "D&T Revision")];
  if (S.topic) {
    const current = S.view === "stage"
      ? h("a", { href: "#", title: "Topic overview" }, S.topic.title)
      : h("span", { "aria-current": "page" }, S.topic.title);
    kids.push(
      h("nav", { class: "crumbs", "aria-label": "Breadcrumb" },
        h("ol", {},
          h("li", {}, h("a", { href: "index.html" }, "Home")),
          h("li", {}, S.course.short),
          S.section && h("li", { class: "crumb-section" }, S.section.name),
          h("li", { class: "crumb-topic" }, current))),
      h("div", { class: "modes", role: "group", "aria-label": "Mode" },
        Object.entries(MODES).map(([m, def]) =>
          h("button", { type: "button", "aria-pressed": String(S.mode === m), onclick: () => switchMode(m) }, def.label))),
      h("button", { type: "button", class: "teach-btn", "aria-pressed": String(teach), onclick: toggleTeach },
        icon("board"), h("span", { class: "teach-label" }, teach ? "Teaching mode on" : "Teaching mode")));
  }
  topbarEl.replaceChildren(h("div", { class: "topbar-in" }, kids));
}

/* ---------- Overview ---------- */

function overview() {
  const T = S.topic;
  return h("main", { id: "main", class: "overview" },
    h("section", { class: "ov-main" },
      h("div", { class: "tags" },
        h("span", { class: `tag ${S.level}` }, S.course.short),
        h("span", { class: "tag" }, `${S.course.board} ${S.course.spec}`),
        h("span", { class: "tag" }, T.spec.join(" · ")),
        T.materials.map((m) => h("span", { class: `tag ${m}` }, MATERIAL[m]))),
      h("h1", { id: "page-title", tabindex: "-1" }, T.title),
      h("div", { class: "card needs" },
        h("h2", { class: "label" }, "What you need to know"),
        h("ul", {}, T.needs.map((n) => h("li", {}, n)))),
      h("div", { class: "starts" },
        h("a", { class: "start lesson", href: hashFor("lesson", 0) },
          h("span", { class: "start-title" }, "Start the lesson →"),
          h("span", { class: "start-sub" }, "Do now, big picture, learn, apply, recall, test")),
        h("a", { class: "start revise", href: hashFor("revise", 0) },
          h("span", { class: "start-title" }, "Revise →"),
          h("span", { class: "start-sub" }, "Recall, test, fix, whole topic")))),
    preRead());
}

function preRead() {
  const T = S.topic;
  const pages = `p${T.book.pages}`;
  const tabs = [
    { id: "read", label: "Read", panel: () => h("div", { class: "book" }, icon("book"),
        h("span", {}, h("b", {}, `Book ${pages}`), h("span", {}, T.book.title))) },
    { id: "listen", label: "Listen", panel: player }
  ];
  let current = "read";
  const panel = h("div", { class: "tabpanel", role: "tabpanel", id: "pre-panel", tabindex: "0" });
  const tablist = h("div", { class: "tabs", role: "tablist", "aria-label": "Before the lesson" });
  function show(id, focus) {
    current = id;
    tablist.querySelectorAll("[role=tab]").forEach((b) => {
      const on = b.dataset.tab === id;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    panel.setAttribute("aria-labelledby", `tab-${id}`);
    panel.replaceChildren(tabs.find((t) => t.id === id).panel());
  }
  tabs.forEach((t) => tablist.append(h("button", {
    type: "button", role: "tab", id: `tab-${t.id}`, "data-tab": t.id, "aria-controls": "pre-panel",
    onclick: () => show(t.id),
    onkeydown: (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      show(current === "read" ? "listen" : "read", true);
    }
  }, t.label)));
  show(current);

  const key = `read.${T.id}`;
  const box = h("input", { type: "checkbox", id: "read-tick", onchange: (e) => store.set(key, e.target.checked) });
  box.checked = !!store.get(key, false);

  return h("section", { class: "preread", "aria-labelledby": "preread-title" },
    h("div", { class: "preread-head" },
      h("h2", { id: "preread-title" }, "Before the lesson"),
      h("span", { class: "pick" }, "Pick one")),
    tablist, panel,
    h("label", { class: "tick", for: "read-tick" }, box,
      h("span", { class: "box", "aria-hidden": "true" }, icon("check")), "I've read or listened"));
}

// Audio player placeholder. The working player comes in a later step.
const WAVE = [14, 22, 30, 18, 36, 40, 26, 20, 32, 44, 28, 16, 24, 38, 34, 22, 18, 30, 42, 36, 20, 14, 26, 34, 40, 30, 22, 16, 28, 38, 44, 32, 20, 24, 36, 30, 18, 22, 34, 40];
function player() {
  return h("div", { class: "player" },
    h("div", { class: "player-top" },
      h("button", { type: "button", class: "play", disabled: true, "aria-label": "Play" }, icon("play")),
      h("span", { class: "player-title" }, h("b", {}, "Audio overview"), h("span", {}, "Coming soon"))),
    h("div", { class: "wave", "aria-hidden": "true" }, WAVE.map((x) => h("span", { style: `height:${x}px` }))),
    h("div", { class: "player-foot" },
      h("span", {}, "0:00 / –:––"),
      h("span", { class: "player-btns" }, ["−15s", "+15s", "1×"].map((t) => h("button", { type: "button", disabled: true }, t)))));
}

/* ---------- Stage view ---------- */

function stageView() {
  const st = MODES[S.mode].stages[S.stage];
  return h("div", { class: "path-layout" },
    rail(),
    h("main", { id: "main", class: "stage" },
      st.id === "learn" && chunkList("chunk-strip"),
      stageHead(st),
      h("div", { class: "card placeholder" }, "Coming soon"),
      stageFoot()));
}

function rail() {
  const stages = MODES[S.mode].stages;
  return h("nav", { class: "rail", "aria-label": "Path through this topic" },
    h("span", { class: "rail-label" }, "Your path through this topic"),
    h("ol", { class: "steps" }, stages.map((st, i) => {
      const state = i === S.stage ? "now" : isDone(i) ? "done" : "next";
      return h("li", { class: `step ${state}` },
        h("a", { class: "step-link", href: hashFor(S.mode, i), "aria-current": state === "now" ? "step" : null },
          h("span", { class: "dot", "aria-hidden": "true" }, state === "done" ? icon("check") : String(i + 1)),
          h("span", { class: "step-text" },
            h("span", { class: "step-label" }, st.label, state === "done" && h("span", { class: "sr-only" }, " (done)")),
            h("span", { class: "step-sub" }, val(st.sub)))),
        st.id === "learn" && state === "now" && chunkList("chunks"));
    })),
    S.mode === "lesson" && h("div", { class: "readbox" },
      h("span", { class: "label" }, "Read before the lesson"),
      h("b", {}, `p${S.topic.book.pages}`),
      h("span", {}, S.topic.book.title)));
}

function chunkList(cls) {
  const learn = MODES[S.mode].stages.findIndex((s) => s.id === "learn");
  return h("ol", { class: cls, "aria-label": "Learn chunks" }, S.topic.chunks.map((c, i) => {
    const now = learn === S.stage && i === S.chunk;
    const done = S.visited[S.mode].has(`learn:${c.id}`);
    return h("li", {}, h("a", { href: hashFor(S.mode, learn, i), class: done && !now ? "done" : null, "aria-current": now ? "step" : null },
      h("span", { class: "cdot", "aria-hidden": "true" }), c.label));
  }));
}

function stageHead(st) {
  const T = S.topic;
  let eyebrow = val(st.eyebrow), title = st.title, lead = null;
  if (st.id === "learn") {
    const c = T.chunks[S.chunk];
    eyebrow = `Learn · ${S.chunk + 1} of ${T.chunks.length} · Book p${c.pages}`;
    title = c.label;
    lead = c.summary;
  }
  return h("header", { class: "stage-head" },
    h("div", { class: "stage-titles" },
      h("span", { class: "eyebrow" }, eyebrow),
      h("h1", { id: "page-title", tabindex: "-1" }, title),
      lead && h("p", { class: "lead" }, lead)),
    st.hints && h("div", { class: "hints" }, st.hints.map(([i, t]) => hint(i, t))),
    h("p", { class: "teach-tip" }, h("b", {}, "Teaching tip"), st.tip));
}

function stageFoot() {
  const { prev, next } = neighbours();
  return h("nav", { class: "stage-foot", "aria-label": "Back and next" },
    h("a", { class: "back", href: prev ? hashFor(S.mode, prev.stage, prev.chunk) : "#" }, "← ", prev ? placeLabel(prev) : "Topic overview"),
    next
      ? h("a", { class: "next", href: hashFor(S.mode, next.stage, next.chunk) }, `Next: ${placeLabel(next)} →`)
      : h("a", { class: "next", href: "#" }, "Back to the topic →"));
}

/* ---------- Presenter controls (teaching mode) ---------- */

const present = h("div", { class: "present", role: "group", "aria-label": "Presenter controls" },
  h("button", { type: "button", onclick: () => go(neighbours().prev) }, "‹ Back"),
  h("button", { type: "button", onclick: () => go(neighbours().next) }, "Next ›"));

// Presentation clickers send Page Up / Page Down.
document.addEventListener("keydown", (e) => {
  if (!teach || S.view !== "stage" || e.altKey || e.ctrlKey || e.metaKey) return;
  const t = e.target;
  if (t.closest && t.closest("input, textarea, select, [contenteditable], [role=tablist]")) return;
  if (e.key === "PageDown") { e.preventDefault(); go(neighbours().next); }
  if (e.key === "PageUp") { e.preventDefault(); go(neighbours().prev); }
});

/* ---------- Render ---------- */

function render(moved) {
  const r = parseHash();
  S.view = r.view;
  if (r.view === "stage") {
    Object.assign(S, { mode: r.mode, stage: r.stage, chunk: r.chunk });
    store.set("mode", S.mode);
    S.visited[S.mode].add(visitKey(S.mode, S.stage, S.chunk));
  }
  document.documentElement.classList.toggle("in-stage", S.view === "stage");
  topbar();
  app.replaceChildren(S.view === "overview" ? overview() : stageView());

  const { prev, next } = S.view === "stage" ? neighbours() : {};
  present.children[0].disabled = !prev;
  present.children[1].disabled = !next;

  const st = S.view === "stage" ? MODES[S.mode].stages[S.stage] : null;
  const where = st ? (st.id === "learn" ? S.topic.chunks[S.chunk].label : st.label) + " · " : "";
  document.title = `${where}${S.topic.title} · D&T Revision`;

  // Keep the current step visible in the phone strip.
  app.querySelectorAll(".steps [aria-current], .chunk-strip [aria-current]").forEach((el) => {
    const strip = el.closest("ol");
    if (strip.scrollWidth > strip.clientWidth) strip.scrollLeft = el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2;
  });

  if (moved) {
    window.scrollTo(0, 0);
    document.getElementById("page-title")?.focus({ preventScroll: true });
  }
}

function message(title, text, extra) {
  topbar();
  app.replaceChildren(h("main", { id: "main", class: "message" },
    h("h1", { id: "page-title", tabindex: "-1" }, title),
    h("p", {}, text), extra,
    h("p", {}, h("a", { href: "index.html" }, "Go to the home page"))));
  document.title = `${title} · D&T Revision`;
}

async function init() {
  topbar();
  const id = new URLSearchParams(location.search).get("id");
  let found;
  try {
    found = await findTopic(id);
    if (!found) return message("Topic not found", "Check the link, or pick a topic from the home page.");
    if (!found.entry.built) {
      return message(found.entry.title, "This page is coming soon.",
        h("p", { class: "book" }, icon("book"), h("span", {}, h("b", {}, `Book p${found.entry.pages}`), h("span", {}, found.course.book))));
    }
    S.topic = await loadTopic(found.level, found.entry.id);
  } catch {
    return message("This page didn't load", "Check your connection and try again.");
  }
  Object.assign(S, {
    level: found.level, course: found.course, entry: found.entry,
    section: found.course.sections.find((s) => s.ref === found.entry.section) || null
  });
  document.body.append(present);
  window.addEventListener("hashchange", () => render(true));
  render(false);
}

init();
