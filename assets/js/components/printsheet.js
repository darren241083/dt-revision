// Printable A4 sheet (two sides) for a topic, in three versions:
//   pupil    the organiser to revise from, with blank boxes to fill in
//   cover    the same with every definition, item and step left blank
//   teacher  everything filled in: the answer key
// The self-test questions and the exam question are drawn from the topic's banks using a
// version number, so a teacher copy printed with the same number matches the pupil sheets.

import { h } from "../dom.js";
import { answerOf, stepItems, plainItems } from "./organiser.js";
import { concrete } from "../questions.js";

const SELF = 6;
const MARGIN = 12; // mm, the same as @page in print.css
export const VARIANTS = { pupil: "Pupil sheet", cover: "Cover version", teacher: "Teacher copy" };
export const newVersion = () => 1000 + Math.floor(Math.random() * 9000);

// Small seeded random number generator (mulberry32), so a version always draws the same set.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function draw(list, n, rnd) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// Writing lines. `max` marks lines that fitSheet may add to, up to that many.
const lines = (n, max) => h("span", { class: "ps-lines", "aria-hidden": "true", "data-max": max || null },
  Array.from({ length: n }, () => h("i")));
const MATERIAL = { timber: "T", polymer: "P" };

// Page breaks are simulated box by box: a box that doesn't fit moves to the next page, except
// the items box, which may split (about 20mm is lost to that break). 4mm a page is kept spare.
// Returns the number of pages and the space left on the last one.
function simulate(sheet, mm) {
  const page = (297 - 2 * MARGIN - 4) * mm;
  const side2 = sheet.querySelector(".ps-side2");
  let pages = 1, used = 0;
  for (const b of sheet.querySelectorAll(".ps-side > *")) {
    let top = parseFloat(getComputedStyle(b).marginTop);
    if (b === side2.firstElementChild) {
      if (side2.classList.contains("new-page")) { if (used) pages++; used = 0; }
      else top += parseFloat(getComputedStyle(side2).marginTop);
    }
    if (!used) top = 0;
    let rest = b.getBoundingClientRect().height + top;
    if (b.classList.contains("ps-items")) {
      while (used + rest > page) { rest -= page - used - 20 * mm; pages++; used = 0; }
    } else if (used + rest > page) { pages++; used = 0; rest -= top; }
    used += rest;
  }
  return { pages, free: page - used };
}

// Fits the sheet on two sides, measured off-screen at A4 width:
// 1. side 2 starts on a fresh page when side 1 fits on one; a tighter layout only if needed;
// 2. writing lines are added a line at a time (exam question, topic-map branches, self-test
//    answers in turn) up to their targets while it still fits;
// 3. any space left on the last page is shared evenly between the side 2 boxes.
export function fitSheet(sheet) {
  const probe = h("div", { style: "position:absolute;visibility:hidden;height:100mm" });
  document.body.append(probe);
  const mm = probe.offsetHeight / 100;
  probe.remove();
  sheet.classList.add("measure");
  const side1 = sheet.querySelector(".ps-side"), side2 = sheet.querySelector(".ps-side2");
  const fits = () => simulate(sheet, mm).pages <= 2;
  for (const level of [null, "tight", "tighter"]) {
    if (level) sheet.classList.add(level);
    side2.classList.toggle("new-page", side1.getBoundingClientRect().height <= (297 - 2 * MARGIN - 4) * mm);
    if (fits()) break;
    side2.classList.remove("new-page");
    if (fits()) break;
  }

  const groups = [".ps-exam .ps-lines", ".ps-branch .ps-lines", ".ps-selflist .ps-lines"]
    .map((sel) => [...sheet.querySelectorAll(`${sel}[data-max]`)]).filter((g) => g.length);
  let active = groups;
  while (active.length) {
    active = active.filter((g) => {
      const open = g.filter((l) => l.children.length < +l.dataset.max);
      if (!open.length) return false;
      open.forEach((l) => l.append(h("i")));
      if (fits()) return true;
      open.forEach((l) => l.lastElementChild.remove());
      return false;
    });
  }

  const { free } = simulate(sheet, mm);
  const boxes = [...side2.children].slice(side2.classList.contains("new-page") ? 1 : 0);
  if (free > mm && boxes.length) {
    const extra = (free - mm) / boxes.length;
    boxes.forEach((b) => { b.style.marginTop = `${parseFloat(getComputedStyle(b).marginTop) + extra}px`; });
    if (!fits()) boxes.forEach((b) => { b.style.marginTop = ""; });
  }
  sheet.classList.remove("measure");
}

export function printSheet(T, course, { variant, version }) {
  const teacher = variant === "teacher", cover = variant === "cover";
  const rnd = seeded(version);
  const drawn = draw(T.quiz, SELF, rnd);
  const exam = draw(T.written || [], 1, rnd)[0];
  // Calc numbers come from the same version, so the teacher copy matches.
  const self = drawn.map((q) => concrete(q, rnd));
  const tagged = T.chunks.some((c) => c.items.some((it) => it.tags?.length));
  const fact = (text, n = 1) => (cover ? lines(n) : h("span", {}, text));

  let n = 0;
  const sec = (cls, title, ...body) => h("section", { class: `ps-sec ${cls}` }, h("h2", {}, `${++n} · ${title}`), body);

  // Items grouped by chunk, in book order.
  const items = plainItems(T);
  const groups = T.chunks.map((c) => ({ c, list: items.filter((it) => it.chunk === c) })).filter((g) => g.list.length);

  const side1 = h("div", { class: "ps-side" },
    h("header", { class: "ps-head" },
      h("div", { class: "ps-titles" },
        h("span", { class: "ps-kicker" },
          `Knowledge organiser · ${course.short} · ${course.board} ${course.spec} · ${T.spec.join(" · ")} · ${T.book.title} p${T.book.pages}`),
        h("h1", {}, T.title)),
      h("div", { class: "ps-version" }, h("b", {}, VARIANTS[variant]), h("span", {}, `Version ${version}`))),
    teacher
      ? h("p", { class: "ps-key" }, "Answer key")
      : h("div", { class: "ps-who" }, ["Name", "Class", "Date"].map((f) => h("span", {}, h("b", {}, f), h("i")))),
    sec("ps-needs", "What you need to know · rate yourself",
      h("ul", {}, T.needs.map((x) => h("li", {}, h("span", {}, x),
        h("span", { class: "ps-rag" }, ["R", "A", "G"].map((l) => h("i", {}, l))))))),
    sec("ps-kw", "Key words",
      h("dl", { class: "ps-pairs" }, T.keywords.map((k) => h("div", {}, h("dt", {}, k.term), h("dd", {}, fact(k.def)))))),
    sec("ps-items", "In this topic" + (tagged ? " · T timber, P polymer" : ""),
      h("div", { class: "ps-groups" }, groups.map((g) => h("div", { class: "ps-group" },
        h("h3", {}, g.c.label, h("span", {}, ` p${g.c.pages}`)),
        h("dl", { class: "ps-pairs one" }, g.list.map((it) => h("div", {},
          h("dt", {}, it.term, it.tags?.length ? h("span", { class: "ps-tags" }, ` ${it.tags.map((t) => MATERIAL[t]).join(" ")}`) : null),
          h("dd", {}, fact(it.text, it.text.length > 70 ? 2 : 1))))))))));

  const steps = stepItems(T);
  const side2 = h("div", { class: "ps-side ps-side2" },
    steps.length > 0 && sec("ps-steps", steps.length === 1 ? steps[0].term : "Processes",
      steps.map((it) => [steps.length > 1 && h("h3", {}, it.term),
        h("ol", {}, it.steps.map((s) => h("li", {}, fact(s))))])),
    sec("ps-map", "Topic map · add what's in each branch",
      h("div", { class: "ps-mapgrid" },
        h("div", { class: "ps-centre", style: `grid-row: 1 / span ${Math.ceil(T.chunks.length / 2)}` }, T.short || T.title),
        T.chunks.map((c, i) => h("div", { class: `ps-branch ${i % 2 ? "right" : "left"}` },
          h("b", {}, c.label),
          teacher ? h("span", {}, c.items.map((it) => it.term).join(" · ")) : lines(2, 4))))),
    sec("ps-self", "Self-test",
      h("ol", { class: "ps-selflist" }, self.map((q) => h("li", {},
        h("span", { class: "ps-q" }, q.tf != null ? `True or false: ${q.q}` : q.q),
        q.tf != null
          ? h("span", { class: "ps-tf" }, [true, false].map((v) => h("span", {}, h("i", {}, teacher && v === q.tf ? "✓" : ""), v ? "True" : "False")))
          : teacher ? h("b", { class: "ps-ans" }, answerOf(q)) : lines(1, 2))))),
    exam && sec("ps-exam", "Exam question",
      h("div", { class: "ps-examq" }, h("p", {}, exam.q), h("span", { class: "ps-marks" }, `${exam.marks} marks`)),
      teacher
        ? h("div", { class: "ps-scheme" },
          h("ul", {}, exam.points.map((p) => h("li", {}, p))),
          exam.note && h("p", { class: "ps-note" }, exam.note),
          h("p", {}, h("b", {}, "Model answer: "), exam.model),
          exam.levels?.length > 0 && h("ul", { class: "ps-levels" },
            exam.levels.map((l) => h("li", {}, h("b", {}, `Level ${l.level} (${l.marks}) `), l.text))))
        : [lines(4, Math.max(4, 2 * exam.marks)),
          h("div", { class: "ps-marking" }, h("b", {}, "Marks"),
            h("span", { class: "ps-markbox" }, h("i"), `/ ${exam.marks}`))]));

  return h("div", { class: `print-sheet ${variant}`, "aria-hidden": "true" }, side1, side2);
}
