// Lesson notes sheet, in two versions with the same layout:
//   blank   pupils fill it in during the lesson
//   filled  the same sheet written in (absent pupils, self-checking, teacher copy)
// Sections in lesson order: Do now, Big picture, process steps, Apply, Test (side 1, with the
// mind map filling what is left), then Notes and the lesson pair of exam questions (side 2).
// It aims for one A4 sheet (2 sides) and continues onto sides 3–4 when it needs to: it never
// goes below about one ruled line per item and 2 lines per exam mark to fit. A section that
// doesn't fit starts the next side whole, under a small header (topic title · side 3).
// Within about 20mm of fitting 2 sides, tighter spacing keeps it on one sheet. When it does
// continue, side 2 is the Notes alone and side 3 holds both exam questions.
// fitSheet() sets the layout on the blank sheet and the filled sheet copies it (plan), so the
// two match line for line.

import { h } from "../dom.js";

const PAGE = 272; // mm of writing height a side: A4 297 less 12mm margins, 1mm spare
const NEAR = 20; // mm: a sheet this close to fitting 2 sides is tightened to fit
const QUIZ = 10;
export const SHEETS = { blank: "Lesson notes sheet", filled: "Lesson notes sheet · filled in" };

const WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const stepItems = (T) => T.chunks.flatMap((c) => c.items.filter((it) => it.steps?.length));
const plain = (c) => c.items.filter((it) => !it.steps?.length);

// Ruled lines, 8mm apart. A filled line carries its text.
const line = (text, cls = "") => h("span", { class: `ln-line ${cls}`.trim() }, text ? h("span", { class: "ln-ink" }, text) : null);
const lines = (n) => Array.from({ length: n }, () => line());

// Item text as a short note line: "Tenon saw – shallow, accurate cuts in small pieces of wood".
// The candidates run longest first: the first sentence, then cut back at safe points only (a
// colon or semicolon, or before ", such as", ", e.g.", ", often", ", usually", ", plus",
// ", which"), so a list is never cut in the middle.
const CUT = /[;:](?= )|,(?= (such as|e\.g\.|often|usually|plus|which)\b)/g;
function noteCandidates(it) {
  let s = it.text.split(/(?<=\.)\s/)[0].replace(/[.:]\s*$/, "").trim();
  if (/^[A-Z](?![A-Z])/.test(s)) s = s[0].toLowerCase() + s.slice(1); // not "CNC …"
  const cuts = [...s.matchAll(CUT)].map((m) => m.index).reverse();
  return [s, ...cuts.map((i) => s.slice(0, i))].map((x) => `${it.term} – ${x}`);
}

const sentence = (s) => s.replace(/\.$/, "");
const minExam = (w) => Math.max(4, 2 * w.marks);

// plan (from fitSheet on the blank sheet): { sides: side index per section, lines: notes lines
// per chunk, exam: lines per exam question, split: chunks in the left column, tight }.
export function printSheet(T, course, { filled = false, doNow = T.doNow, plan = null } = {}) {
  let n = 0;
  const num = () => h("b", { class: "ln-num" }, String(++n));
  const head = (title, extra) => h("h2", {}, num(), title, extra && h("span", { class: "ln-sub" }, extra));
  const sections = [];
  const add = (el) => { if (el) sections.push(el); return el; };

  const header = h("header", { class: "ln-head" },
    h("div", { class: "ln-titlerow" },
      h("h1", {}, T.title),
      h("span", { class: "ln-name" }, h("b", {}, "Name"), h("i"))),
    h("p", { class: "ln-meta" }, [
      filled ? "Lesson notes · filled in" : "Lesson notes",
      course.short, `${course.board} ${course.spec}`, ...T.spec, T.book.title, `p${T.book.pages}`].join(" · ")));

  add(h("section", { class: "ln-sec ln-donow" }, head("Do now"),
    h("ol", {}, doNow.map((d) => h("li", {},
      h("span", { class: "ln-from" }, d.from || ""),
      h("span", { class: "ln-q" }, d.q),
      line(filled ? sentence(d.a) : "", "ln-ans"))))));

  const half = Math.ceil(T.chunks.length / 2);
  const pill = (c, i) => h("div", { class: `ln-branch ${i < half ? "left" : "right"}`, style: `grid-row: ${(i % half) + 1}` },
    h("span", { class: "ln-pill" }, h("b", {}, String(i + 1)), c.label),
    h("span", { class: "ln-area" }, filled ? c.items.map((it) => it.term).join(" · ") : null));
  add(h("section", { class: "ln-sec ln-map" }, head("Big picture", "add what's in each branch"),
    h("div", { class: "ln-mapgrid", style: `grid-template-rows: repeat(${half}, minmax(0, 1fr))` },
      h("div", { class: "ln-centre", style: `grid-row: 1 / span ${half}` }, h("span", {}, T.short || T.title)),
      T.chunks.map(pill))));

  const steps = stepItems(T);
  const stepNum = new Map();
  for (const it of steps) {
    add(h("section", { class: "ln-sec ln-steps" },
      head(it.term, `the ${WORDS[it.steps.length] || it.steps.length} steps, in order`),
      h("ol", {}, it.steps.map((s, i) => h("li", {}, h("b", {}, `${i + 1}`), line(filled ? s : ""))))));
    stepNum.set(it, n);
  }

  if (T.apply?.length) {
    add(h("section", { class: "ln-sec ln-apply" }, head("Apply", "choose, and give a reason"),
      h("ol", {}, T.apply.map((a, i) => h("li", { class: "ln-choice" },
        h("p", { class: "ln-q" }, h("b", {}, `${String.fromCharCode(97 + i)} `), a.q),
        h("span", { class: "ln-label" }, "Choice"), line(filled ? a.tools[a.tool] : ""),
        h("span", { class: "ln-label" }, "Because"), line(filled ? a.reasons[a.reason] : ""))))));
  }

  add(h("section", { class: "ln-sec ln-test" }, head("Test"),
    h("div", { class: "ln-testrow" },
      h("span", { class: "ln-score" }, h("span", { class: "ln-label" }, "Quiz score"), h("i"), `/ ${QUIZ}`),
      h("span", { class: "ln-fix" }, h("span", { class: "ln-label" }, "Fix these first"), line()))));

  // Notes: a process item points to its own section.
  const where = (it) => stepNum.has(it) ? `${it.term} (see ${stepNum.get(it)})` : it.term;
  const chunkBox = (c, i) => {
    const items = plain(c);
    const want = plan?.lines[i] ?? Math.max(2, items.length);
    const note = (it) => {
      const cands = noteCandidates(it);
      return h("span", { class: "ln-line", "data-cands": JSON.stringify(cands) }, h("span", { class: "ln-ink" }, cands[0]));
    };
    return h("div", { class: "ln-chunk", "data-i": i },
      h("h3", {}, h("b", {}, String(i + 1)), c.label, h("span", { class: "ln-pages" }, `p${c.pages}`)),
      h("p", { class: "ln-prompts" }, c.items.map(where).join(" · ")),
      h("div", { class: "ln-ruled" }, filled
        ? Array.from({ length: want }, (_, k) => (items[k] ? note(items[k]) : line()))
        : lines(want)));
  };
  const boxes = T.chunks.map(chunkBox);
  const split = plan?.split ?? half;
  add(h("section", { class: "ln-sec ln-notes" }, head("Notes"),
    h("div", { class: "ln-cols" },
      h("div", { class: "ln-col" }, boxes.slice(0, split)),
      h("div", { class: "ln-col" }, boxes.slice(split)))));

  (T.written || []).slice(0, 2).forEach((w, i) => {
    const rows = plan?.exam[i] ?? minExam(w);
    const type = w.type ? w.type[0].toUpperCase() + w.type.slice(1) : "";
    add(h("section", { class: "ln-sec ln-exam", "data-marks": w.marks },
      h("div", { class: "ln-examhead" },
        h("h2", {}, num(), `Exam question ${i + 1}`, h("span", { class: "ln-sub" }, [type, `${w.marks} marks`].filter(Boolean).join(" · "))),
        h("span", { class: "ln-mark" }, h("span", { class: "ln-label" }, "Mark"), h("i"), `/ ${w.marks}`)),
      h("p", { class: "ln-examq" }, w.q),
      filled
        ? h("div", { class: "ln-answer", style: `height: ${rows * 8}mm` },
          h("p", { class: "ln-model" }, w.model),
          h("ul", { class: "ln-points" }, w.points.map((p) => h("li", {}, p))))
        : h("div", { class: "ln-ruled" }, lines(rows))));
  });

  const sheet = h("div", { class: `print-sheet ${filled ? "filled" : "blank"}${plan?.tight ? " tight" : ""}`, "aria-hidden": "true" });
  sheet._parts = { header, sections, title: T.title };
  // Default placement: everything up to Notes on side 1, Notes onwards on side 2.
  const notesAt = sections.findIndex((s) => s.classList.contains("ln-notes"));
  place(sheet, plan?.sides ?? sections.map((_, i) => (i < notesAt ? 0 : 1)));
  return sheet;
}

const newSide = (sheet, i) => {
  const side = h("div", { class: `ln-page${i === 0 ? " ln-side1" : ""}` });
  if (i === 0) side.append(sheet._parts.header);
  else if (i >= 2) side.append(h("p", { class: "ln-cont" }, h("b", {}, sheet._parts.title), ` · side ${i + 1}`));
  sheet.append(side);
  return side;
};

// Puts each section on its side (sides[i] for section i).
function place(sheet, sides) {
  sheet.replaceChildren();
  const pages = [];
  sheet._parts.sections.forEach((s, i) => {
    while (pages.length <= sides[i]) pages.push(newSide(sheet, pages.length));
    pages[sides[i]].append(s);
  });
  sheet._sides = sides.slice();
}

/* ---------- Fitting (measured off-screen at A4 width) ---------- */

function mmPx() {
  const probe = h("div", { style: "position:absolute;visibility:hidden;height:100mm" });
  document.body.append(probe);
  const mm = probe.offsetHeight / 100;
  probe.remove();
  return mm;
}

// Natural height of a side: its content stacked with the minimum gaps (the map at its least).
function natural(side) {
  side.classList.add("natural");
  const v = side.getBoundingClientRect().height;
  side.classList.remove("natural");
  return v;
}

// 1. Flows the sections onto sides in order: Do now to Test on side 1, Notes starting side 2,
//    and any section that doesn't fit where it falls starting the next side, whole.
// 2. Splits the notes between two columns (whole chunks, in order) so the columns balance.
// 3. Fills sides 2 onwards: more notes lines, spread across the chunks and kept balanced; on
//    the exam side, lines shared in proportion to marks. Side 1's map takes what is left.
// Returns the plan the filled sheet copies, and the number of sides.
export function fitSheet(sheet) {
  const mm = mmPx(), cap = PAGE * mm;
  sheet.classList.add("measure");
  const { sections } = sheet._parts;
  const notes = sections.find((s) => s.classList.contains("ln-notes"));
  const [colL, colR] = notes.querySelectorAll(".ln-col");
  const chunks = [...notes.querySelectorAll(".ln-chunk")];
  const ruled = (el) => el.querySelector(".ln-ruled");
  const heightOf = (els) => els.reduce((s, e) => s + e.getBoundingClientRect().height, 0);
  const base = chunks.map((c) => ruled(c).children.length);
  const counts = base.slice();
  let split = 1;
  const sync = (r, want) => {
    while (r.children.length > want) r.lastElementChild.remove();
    while (r.children.length < want) r.append(line());
  };
  function balance() {
    chunks.forEach((c, i) => sync(ruled(c), counts[i]));
    colL.replaceChildren(...chunks);
    let diff = Infinity;
    for (let k = 1; k < chunks.length; k++) {
      const d = Math.abs(heightOf(chunks.slice(0, k)) - heightOf(chunks.slice(k)));
      if (d < diff) { diff = d; split = k; }
    }
    colL.replaceChildren(...chunks.slice(0, split));
    colR.replaceChildren(...chunks.slice(split));
  }
  balance();

  const exams = sections.filter((s) => s.classList.contains("ln-exam"));
  const notesAt = sections.indexOf(notes);

  // 1. Flow. The exam questions stay together: if one has to move on from the Notes side,
  //    both start the next side and the Notes keep their side to themselves.
  function flow() {
    const sides = [];
    let side = 0;
    sheet.replaceChildren();
    let page = newSide(sheet, 0);
    sections.forEach((s, i) => {
      if (s === notes && side === 0) page = newSide(sheet, ++side);
      page.append(s);
      if (natural(page) > cap && page.querySelectorAll(".ln-sec").length > 1) {
        s.remove();
        page = newSide(sheet, ++side);
        page.append(s);
      }
      sides[i] = side;
    });
    const ex = exams.map((s) => sections.indexOf(s));
    if (ex.some((i) => sides[i] > sides[notesAt])) {
      ex.forEach((i) => { sides[i] = sides[notesAt] + 1; });
      place(sheet, sides);
    }
    return sides;
  }
  // How far the fullest side would run over with everything on 2 sides.
  function overOnTwo() {
    place(sheet, sections.map((_, i) => (i < notesAt ? 0 : 1)));
    return Math.max(...[...sheet.querySelectorAll(".ln-page")].map((p) => natural(p) - cap));
  }

  let sides = flow();
  let tight = false;
  // Within about 20mm of fitting on 2 sides: tighter spacing keeps it on one sheet.
  if (Math.max(...sides) > 1) {
    const over = overOnTwo();
    if (over <= NEAR * mm) {
      sheet.classList.add("tight");
      sides = flow();
      tight = Math.max(...sides) <= 1;
      if (!tight) sheet.classList.remove("tight");
    }
    if (!tight) sides = flow();
  }

  // 3. Fill every side after the first: notes lines spread across the chunks with the columns
  //    kept balanced; on the exam side, lines shared between the questions in proportion to
  //    their marks.
  const pages = [...sheet.querySelectorAll(".ln-page")];
  for (const p of pages.slice(1)) {
    if (p.contains(notes)) {
      for (let open = chunks.map((_, i) => i); open.length;) {
        open.sort((a, b) => (counts[a] - base[a]) - (counts[b] - base[b]) || a - b);
        const i = open[0];
        counts[i]++;
        balance();
        if (natural(p) > cap) { counts[i]--; balance(); open.shift(); }
      }
    } else {
      const qs = [...p.querySelectorAll(".ln-exam")];
      for (let open = qs.slice(); open.length;) {
        const per = (q) => ruled(q).children.length / +q.dataset.marks;
        open.sort((a, b) => per(a) - per(b));
        const r = ruled(open[0]);
        r.append(line());
        if (natural(p) > cap) { r.lastElementChild.remove(); open.shift(); }
      }
    }
  }

  const plan = { sides, split, tight, lines: counts.slice(), exam: exams.map((s) => ruled(s).children.length) };
  const report = { plan, sides: pages.length, fits: pages.every((p) => natural(p) <= cap + 0.5) };
  drawMap(sheet);
  sheet.classList.remove("measure");
  return report;
}

// The filled sheet: each note line gets the longest wording that fits on it; answer boxes shrink their text until it fits.
export function fitFilled(sheet) {
  sheet.classList.add("measure");
  for (const l of sheet.querySelectorAll(".ln-line[data-cands]")) {
    const ink = l.firstElementChild;
    const cands = JSON.parse(l.dataset.cands);
    const fits = () => l.scrollWidth <= l.clientWidth + 0.5;
    // Each wording at normal then smaller size before cutting further; a cut never leaves
    // fewer than 4 words after the dash. Last resort: the full wording on two small lines.
    const words = (c) => c.split(" – ").slice(1).join(" – ").split(" ").length;
    let ok = false;
    for (const c of cands.filter((c, k) => k === 0 || words(c) >= 4)) {
      ink.textContent = c;
      for (const small of [false, true]) {
        l.classList.toggle("small", small);
        if (fits()) { ok = true; break; }
      }
      if (ok) break;
    }
    if (!ok) { ink.textContent = cands[0]; l.classList.remove("small"); }
    if (!ok) l.classList.add("wrap");
  }
  for (const el of sheet.querySelectorAll(".ln-ans, .ln-choice .ln-line, .ln-steps .ln-line")) {
    const ink = el.firstElementChild;
    if (ink && el.scrollWidth > el.clientWidth + 0.5) el.classList.add("wrap");
  }
  for (const box of sheet.querySelectorAll(".ln-answer")) {
    for (const size of ["", "small", "smaller"]) {
      if (size) box.classList.add(size);
      if (box.scrollHeight <= box.clientHeight + 0.5) break;
    }
  }
  const mm = mmPx(), cap = PAGE * mm;
  const ok = [...sheet.querySelectorAll(".ln-page")].every((s) => natural(s) <= cap);
  drawMap(sheet);
  sheet.classList.remove("measure");
  return ok;
}

// Lines from the centre box to each branch pill, measured from the laid-out map.
function drawMap(sheet) {
  const grid = sheet.querySelector(".ln-mapgrid");
  if (!grid) return;
  grid.querySelector("svg")?.remove();
  const g = grid.getBoundingClientRect();
  const c = grid.querySelector(".ln-centre").getBoundingClientRect();
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${g.width} ${g.height}`);
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("ln-links");
  for (const p of grid.querySelectorAll(".ln-pill")) {
    const r = p.getBoundingClientRect();
    const left = p.parentElement.classList.contains("left");
    const l = document.createElementNS(ns, "line");
    const x1 = (left ? c.left : c.right) - g.left, y1 = c.top + c.height / 2 - g.top;
    const x2 = (left ? r.right : r.left) - g.left, y2 = r.top + r.height / 2 - g.top;
    Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => l.setAttribute(k, v.toFixed(1)));
    svg.append(l);
  }
  grid.prepend(svg);
}
