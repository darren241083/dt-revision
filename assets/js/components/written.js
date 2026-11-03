// Written exam questions: answer box, "Mark it" shows tick-box mark points, a live mark out
// of the total and a model answer. Nothing typed here is saved or sent.

import { h, hint } from "../dom.js";

export function writtenQuestion(w, i) {
  const id = `w${i}`;
  const ticks = new Set();
  const mark = h("p", { class: "w-mark", "aria-live": "polite" });
  const model = h("div", { class: "w-model", hidden: true },
    h("h4", { class: "label" }, "Model answer"),
    h("p", {}, w.model));
  const showModel = h("button", { type: "button", class: "btn-line", "aria-expanded": "false",
    onclick: () => {
      const on = model.hidden;
      model.hidden = !on;
      showModel.setAttribute("aria-expanded", String(on));
      showModel.textContent = on ? "Hide model answer" : "Show model answer";
    } }, "Show model answer");

  function update() {
    const got = Math.min(ticks.size, w.marks);
    mark.textContent = `Your mark: ${got} / ${w.marks}`;
    mark.classList.toggle("full", got === w.marks);
  }

  const scheme = h("div", { class: "w-scheme", hidden: true },
    h("h4", { class: "label" }, "Tick each point you made"),
    h("ul", { class: "w-points" }, w.points.map((p, j) => {
      const box = h("input", { type: "checkbox", id: `${id}-p${j}`, onchange: (e) => { e.target.checked ? ticks.add(j) : ticks.delete(j); update(); } });
      return h("li", {}, h("label", { class: "w-point", for: `${id}-p${j}` }, box, h("span", { class: "box", "aria-hidden": "true" }), h("span", {}, p)));
    })),
    mark,
    w.note && h("p", { class: "w-note" }, w.note),
    w.model && showModel, w.model && model);

  const markBtn = h("button", { type: "button", class: "btn-dark", onclick: () => {
    scheme.hidden = false;
    markBtn.hidden = true;
    update();
    scheme.querySelector("input")?.focus();
  } }, "Mark it");

  return h("section", { class: "card written", "aria-labelledby": `${id}-q` },
    h("div", { class: "w-head" },
      h("h2", { id: `${id}-q` }, w.q),
      h("span", { class: "w-marks" }, `${w.marks} mark${w.marks === 1 ? "" : "s"}`)),
    h("label", { class: "sr-only", for: `${id}-a` }, "Your answer"),
    h("textarea", { id: `${id}-a`, class: "w-answer", rows: "4", spellcheck: "true" }),
    h("div", { class: "btn-row" }, markBtn, hint("pen", "Write, then mark it")),
    scheme);
}
