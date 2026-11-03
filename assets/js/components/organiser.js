// Whole topic (Revise): the whole topic as a knowledge organiser, built from the topic JSON.
// Key words, items, process steps, topic map, need to know, self-test, one exam question.
// "Cover answers" hides definitions and answers behind blocks that are tapped one at a time.
// The self-test draw and the switch live in the per-visit session; nothing is saved.

import { h, icon, hint, fill, materialDots, shuffle } from "../dom.js";
import { writtenQuestion } from "./written.js";

const SELF = 5;
export const answerOf = (q) => (q.tf != null ? (q.tf ? "True" : "False") : q.options[q.answer]);

// Items with steps are shown as processes; the rest go in the items table.
export const stepItems = (T) => T.chunks.flatMap((c) => c.items.filter((it) => it.steps?.length));
export const plainItems = (T) => T.chunks.flatMap((c) => c.items.filter((it) => !it.steps?.length).map((it) => ({ ...it, chunk: c })));
const hasTags = (T) => T.chunks.some((c) => c.items.some((it) => it.tags?.length));

export function organiser(T, session) {
  const st = session.organiser ||= { cover: true, self: shuffle(T.quiz).slice(0, SELF) };
  const count = h("span", { class: "org-count", "aria-live": "polite" });
  const root = h("div", { class: "org" + (st.cover ? " covered" : "") });

  function updateCount() {
    const done = root.querySelectorAll(".org-self .cov.shown").length;
    count.textContent = st.cover ? `${done} / ${st.self.length} checked` : "";
  }

  // A covered answer: a tappable block that reveals the text in its place.
  function cov(text, label, block = "?") {
    const wrap = h("span", { class: "cov" });
    const txt = h("span", { class: "cov-text", tabindex: "-1" }, text);
    const btn = h("button", { type: "button", class: "cov-btn", "aria-label": `Show: ${label}` }, block);
    btn.addEventListener("click", () => { wrap.classList.add("shown"); txt.focus(); updateCount(); });
    wrap.append(btn, txt);
    return wrap;
  }

  const box = (cls, title, aside, ...body) => h("section", { class: `org-box ${cls}`, "aria-label": title },
    h("div", { class: "org-head" }, h("h2", {}, title), aside), body);

  const steps = stepItems(T);
  const mode = (on) => {
    st.cover = on;
    root.classList.toggle("covered", on);
    root.querySelectorAll(".cov.shown").forEach((c) => c.classList.remove("shown"));
    root.querySelectorAll(".org-switch button").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.c === "1") === on)));
    updateCount();
  };

  let n = 0;
  const num = (t) => `${++n} · ${t}`;
  fill(root,
    h("div", { class: "org-top" },
      h("div", { class: "seg org-switch", role: "group", "aria-label": "Answers" },
        [["0", "Show all"], ["1", "Cover answers"]].map(([c, label]) => h("button", {
          type: "button", "data-c": c, "aria-pressed": String((c === "1") === st.cover), onclick: () => mode(c === "1")
        }, label)))),
    h("div", { class: "org-grid" },
      box("org-kw", num("Key words"), hint("tap", "Tap a block to check"),
        h("dl", { class: "org-rows" }, T.keywords.map((k) =>
          h("div", { class: "org-row" }, h("dt", {}, k.term), h("dd", {}, cov(k.def, `meaning of ${k.term}`)))))),
      box("org-items", num("In this topic"),
        hasTags(T) && h("span", { class: "org-legend", "aria-hidden": "true" }, h("i", { class: "timber" }), "Timber", h("i", { class: "polymer" }), "Polymer"),
        h("dl", { class: "org-rows" }, plainItems(T).map((it) =>
          h("div", { class: "org-row" },
            h("dt", {}, it.term, materialDots(it.tags)),
            h("dd", {}, cov(it.text, it.term)))))),
      steps.length > 0 && box("org-steps", num(steps.length === 1 ? steps[0].term : "Processes"), null,
        steps.map((it) => [steps.length > 1 && h("h3", {}, it.term),
          h("ol", { class: "org-steplist" }, it.steps.map((s, i) =>
            h("li", {}, h("span", { class: "org-n", "aria-hidden": "true" }, String(i + 1)), cov(s, `step ${i + 1}`))))])),
      box("org-map", num("Topic map"), null,
        h("ul", { class: "org-maplist" }, T.chunks.map((c) =>
          h("li", {}, h("b", {}, c.label), h("span", {}, `${c.items.length} · p${c.pages}`))))),
      box("org-needs", num("What you need to know"), null,
        h("ul", { class: "org-needlist" }, T.needs.map((x) => h("li", {}, x)))),
      box("org-self", num("Self-test"), count,
        h("ul", { class: "org-rows" }, st.self.map((q) =>
          h("li", { class: "org-row" }, h("span", {}, q.tf != null ? `True or false: ${q.q}` : q.q),
            cov(answerOf(q), "answer", "Tap to check"))))),
      T.written?.length > 0 && box("org-exam", num("Exam question"), null, writtenQuestion(T.written[0], 0))));
  root.classList.toggle("no-steps", !steps.length);
  updateCount();
  return root;
}
