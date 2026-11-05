// Learn: one chunk at a time. Hotspot diagram (if any), item rows with material tags,
// a step-through for each process item, then a "Before you move on" check.

import { h, fill, icon, hint, materialTag, shuffle } from "../dom.js";
import { revealCard } from "./reveal.js";
import { imageSlot, figure as imgFigure } from "../editslot.js";

export function learnChunk(chunk) {
  const plain = chunk.items.filter((it) => !it.steps);
  const processes = chunk.items.filter((it) => it.steps);
  return [
    chunk.diagram && hotspot(chunk.diagram, chunk),
    plain.length > 0 && h("div", { class: "card items" }, plain.map((it) => itemRow(it, chunk))),
    processes.map((it) => stepThrough(it, chunk)),
    chunk.check?.length > 0 && h("section", { class: "check", "aria-labelledby": `check-${chunk.id}` },
      h("h2", { class: "label", id: `check-${chunk.id}` }, "Before you move on"),
      chunk.check.map((c) => revealCard(c, { size: "on-teal" })))
  ];
}

function itemRow(it, chunk) {
  const slot = imageSlot({ kind: "item", chunk: chunk.id, term: it.term }, !!it.image);
  return h("div", { class: "item" },
    h("span", { class: "item-term" }, it.term),
    h("span", { class: "item-text" }, it.text),
    h("span", { class: "item-tag" }, materialTag(it.tags)),
    // The caption is a sibling of the figure here, so wide cards can put it under the description.
    (it.image || slot) && h("div", { class: "item-img" }, imgFigure(it.image, it.term),
      it.image && it.caption && h("p", { class: "img-caption" }, it.caption), slot));
}

/* ---------- Step-through (processes) ---------- */

function stepThrough(it, chunk) {
  let i = 0;
  const n = it.steps.length;
  const pips = h("span", { class: "pips", "aria-hidden": "true" });
  const num = h("span", { class: "step-num", "aria-hidden": "true" });
  const text = h("p", { class: "step-text-big" });
  const status = h("span", { class: "sr-only", "aria-live": "polite" });
  const back = h("button", { type: "button", class: "btn-line", onclick: () => { i--; draw(); } }, "Back");
  const next = h("button", { type: "button", class: "btn-dark", onclick: () => { i = i < n - 1 ? i + 1 : 0; draw(); } });

  function draw() {
    fill(pips, ...it.steps.map((_, j) => h("span", { class: j <= i ? "on" : "" })));
    num.textContent = String(i + 1);
    text.textContent = it.steps[i];
    status.textContent = `Step ${i + 1} of ${n}: ${it.steps[i]}`;
    back.disabled = i === 0;
    next.textContent = i < n - 1 ? "Next step" : "Start again";
  }
  draw();

  return h("section", { class: "card steps-card", "aria-label": `${it.term}: steps` },
    h("div", { class: "steps-head" },
      h("h2", {}, it.term, materialTag(it.tags)),
      pips),
    it.text && h("p", { class: "steps-intro" }, it.text),
    imgFigure(it.image, it.term, it.caption),
    imageSlot({ kind: "item", chunk: chunk.id, term: it.term }, !!it.image),
    h("div", { class: "step-body" }, num, text),
    status,
    h("div", { class: "btn-row" }, back, next, hint("steps", "Step through in order")));
}

/* ---------- Hotspot diagram ---------- */

function hotspot(d, chunk) {
  const parts = d.parts;
  let mode = "explore", cur = 0;
  const seen = new Set([0]);
  const named = new Map(); // part index -> named correctly?
  let choices = [];

  // The drawing is either an image file ({ image, alt }) or inline SVG ({ svg }).
  const figure = h("div", { class: "hs-figure" + (d.image ? " is-image" : "") });
  if (d.image) figure.append(h("img", { src: d.image, alt: d.alt || d.title || "", width: d.width, height: d.height }));
  else figure.innerHTML = d.svg;
  // A part with a marker position (lx, ly) gets a small dot on the part and its number
  // out in clear space, joined by a thin line; otherwise the number sits on the part.
  const leaders = parts.some((p) => p.lx != null);
  if (leaders) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "hs-leaders");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = parts.filter((p) => p.lx != null).map((p) =>
      `<line x1="${p.x}" y1="${p.y}" x2="${p.lx}" y2="${p.ly}" vector-effect="non-scaling-stroke"/>`).join("");
    figure.append(svg);
    parts.filter((p) => p.lx != null).forEach((p) => {
      const pt = h("span", { class: "hs-point", "aria-hidden": "true" });
      pt.style.left = `${p.x}%`;
      pt.style.top = `${p.y}%`;
      figure.append(pt);
    });
  }
  const dots = parts.map((p, i) => {
    const b = h("button", { type: "button", class: "hs-dot", onclick: () => { cur = i; seen.add(i); draw(); } }, String(i + 1));
    b.style.left = `${p.lx ?? p.x}%`;
    b.style.top = `${p.ly ?? p.y}%`;
    figure.append(b);
    return b;
  });
  const panel = h("div", { class: "hs-panel", "aria-live": "polite" });
  const modeBtns = [["explore", "Explore"], ["name", "Name the parts"]].map(([m, label]) =>
    h("button", { type: "button", onclick: () => setMode(m) }, label));

  function setMode(m) {
    mode = m;
    cur = 0;
    named.clear();
    choices = shuffle(parts.map((p) => p.name));
    draw();
  }

  function answer(name) {
    named.set(cur, name === parts[cur].name);
    draw();
  }

  function nextUnnamed() {
    const order = parts.map((_, i) => (cur + 1 + i) % parts.length);
    const j = order.find((i) => !named.has(i));
    if (j !== undefined) { cur = j; draw(); }
  }

  function draw() {
    modeBtns.forEach((b, i) => b.setAttribute("aria-pressed", String((i === 0) === (mode === "explore"))));
    dots.forEach((b, i) => {
      let state = "", label = `Part ${i + 1}`;
      if (mode === "explore") {
        state = i === cur ? "cur" : seen.has(i) ? "seen" : "";
        label += `: ${parts[i].name}`;
      } else {
        if (named.has(i)) { state = named.get(i) ? "good" : "bad"; label += named.get(i) ? " (named)" : " (missed)"; }
        if (i === cur) state += " cur";
      }
      b.className = "hs-dot " + state;
      b.setAttribute("aria-label", label);
      b.setAttribute("aria-pressed", String(i === cur));
    });

    const p = parts[cur];
    const pips = h("span", { class: "pips", "aria-hidden": "true" }, parts.map((_, i) =>
      h("span", { class: mode === "explore" ? (seen.has(i) ? "on" : "") : named.has(i) ? (named.get(i) ? "good" : "bad") : "" })));
    const where = h("span", { class: "label" }, `Part ${cur + 1} of ${parts.length}`);

    if (mode === "explore") {
      fill(panel, where, h("h3", {}, p.name), h("p", {}, p.text), pips);
      return;
    }
    const answered = named.has(cur);
    const right = named.get(cur);
    const score = [...named.values()].filter(Boolean).length;
    fill(panel, where,
      answered
        ? h("p", { class: "feedback " + (right ? "good" : "bad") }, icon(right ? "check" : "cross"), right ? "Correct." : `It's the ${p.name.toLowerCase()}.`)
        : h("h3", {}, "Which part is this?"),
      answered && h("p", {}, h("b", {}, p.name), ` · ${p.text}`),
      !answered && h("div", { class: "hs-choices" }, choices.map((c) => h("button", { type: "button", class: "opt", onclick: () => answer(c) }, c))),
      pips,
      h("span", { class: "hs-score" }, `${score} of ${parts.length} named`),
      answered && named.size < parts.length && h("button", { type: "button", class: "btn-dark", onclick: nextUnnamed }, "Next part"),
      named.size === parts.length && h("button", { type: "button", class: "btn-line", onclick: () => setMode("name") }, "Try again"));
  }
  draw();

  return h("section", { class: "card hotspot", "aria-label": `${d.title || "Diagram"}: parts` },
    h("div", { class: "hs-head" },
      h("h2", {}, d.title || "Diagram"),
      h("div", { class: "hs-tools" },
        hint("tap", "Tap a number"),
        h("div", { class: "seg", role: "group", "aria-label": "Diagram mode" }, modeBtns),
        imageSlot({ kind: "diagram", chunk: chunk.id }, !!d.image))),
    h("div", { class: "hs-body" }, figure, panel),
    d.credit && h("p", { class: "img-credit" }, d.credit));
}
