// Written exam questions: answer box, "Mark it" shows tick-box mark points, a live mark out
// of the total and a model answer. Nothing typed here is saved or sent.
// Each topic has a bank of about 6. Lesson mode shows the first 2 (the lesson pair); Revise
// draws 2 at random, and "New question" swaps one for a question not seen yet this visit.

import { h, hint, shuffle } from "../dom.js";

const TYPES = { describe: "Describe", explain: "Explain", compare: "Compare", evaluate: "Evaluate" };

export function writtenQuestion(w, i, { onNew } = {}) {
  const id = `w${i}`;
  const ticks = new Set();
  const mark = h("p", { class: "w-mark", "aria-live": "polite" });
  // 6-mark evaluate questions also carry AQA-style levels, shown under the model answer.
  const model = h("div", { class: "w-model", hidden: true },
    h("h4", { class: "label" }, "Model answer"),
    h("p", {}, w.model),
    w.levels?.length > 0 && h("div", { class: "w-levels" },
      h("h4", { class: "label" }, "Levels"),
      h("ul", {}, w.levels.map((l) => h("li", {}, h("b", {}, `Level ${l.level} (${l.marks})`), ` ${l.text}`)))));
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
      h("h2", { id: `${id}-q`, tabindex: "-1" }, w.q),
      h("span", { class: "w-marks" }, [TYPES[w.type], `${w.marks} mark${w.marks === 1 ? "" : "s"}`].filter(Boolean).join(" · "))),
    h("label", { class: "sr-only", for: `${id}-a` }, "Your answer"),
    h("textarea", { id: `${id}-a`, class: "w-answer", rows: "4", spellcheck: "true" }),
    h("div", { class: "btn-row" }, markBtn,
      onNew && h("button", { type: "button", class: "btn-line", onclick: onNew }, "New question"),
      hint("pen", "Write, then mark it")),
    scheme);
}

// Lesson: the first 2 in the bank, in order.
export const lessonPair = (bank) => bank.slice(0, 2).map((w, i) => writtenQuestion(w, i));

// Revise: 2 at random. The choice lives in the per-visit session, so it survives moving
// between stages; once every question has been seen, the seen list starts again.
export function revisePair(bank, session) {
  if (bank.length <= 2) return lessonPair(bank);
  const st = session.written ||= { shown: shuffle([...bank.keys()]).slice(0, 2), seen: new Set() };
  st.shown.forEach((i) => st.seen.add(i));
  const root = h("div", { class: "written-set" });
  const card = (slot) => writtenQuestion(bank[st.shown[slot]], st.shown[slot], { onNew: () => swap(slot) });

  function swap(slot) {
    const free = [...bank.keys()].filter((i) => !st.shown.includes(i));
    let pool = free.filter((i) => !st.seen.has(i));
    if (!pool.length) { st.seen = new Set(st.shown); pool = free; }
    st.shown[slot] = pool[Math.floor(Math.random() * pool.length)];
    st.seen.add(st.shown[slot]);
    // Only this card is replaced, so an answer typed in the other one stays.
    const next = card(slot);
    root.children[slot].replaceWith(next);
    next.querySelector("h2").focus();
  }

  root.append(card(0), card(1));
  return root;
}
