// What am I?: clues one at a time (3, 2, 1 points), four options, feedback.

import { h, icon, hint, shuffle } from "../dom.js";

const PTS = [3, 2, 1];
const ptsLabel = (n) => `${n} pt${n === 1 ? "" : "s"}`;

export function whatAmI(starter) {
  let shown = 1, done = false;
  const tried = new Set();
  const options = shuffle(starter.options);

  const score = h("span", { class: "wai-score" });
  const clues = h("ol", { class: "wai-clues" });
  const opts = h("div", { class: "wai-opts" });
  const feedback = h("p", { class: "feedback", "aria-live": "polite" });
  const more = h("button", { type: "button", class: "btn-line", onclick: () => { shown++; draw(); } }, "Next clue");

  function finish(right) {
    done = true;
    feedback.className = "feedback " + (right ? "good" : "bad");
    feedback.replaceChildren(icon(right ? "check" : "cross"),
      right ? `Correct: ${starter.answer}. ${ptsLabel(PTS[shown - 1])}.` : `It was ${starter.answer}. 0 pts.`);
  }

  function pick(o) {
    if (done || tried.has(o)) return;
    tried.add(o);
    if (o === starter.answer) return finish(true), draw();
    if (shown < starter.clues.length) {
      shown++;
      feedback.className = "feedback bad";
      feedback.replaceChildren(icon("cross"), `Not ${o}. Here's another clue.`);
    } else finish(false);
    draw();
  }

  function draw() {
    score.textContent = done && !tried.has(starter.answer) ? "0 pts" : ptsLabel(PTS[shown - 1]);
    clues.replaceChildren(...starter.clues.map((c, i) => h("li", { class: i < shown ? "on" : "off" },
      h("span", { class: "wai-p" }, ptsLabel(PTS[i])),
      i < shown ? c : h("span", { class: "sr-only" }, "Hidden clue"))));
    opts.replaceChildren(...options.map((o) => {
      const state = tried.has(o) ? (o === starter.answer ? "good" : "bad") : done && o === starter.answer ? "good" : "";
      return h("button", { type: "button", class: "opt " + state, disabled: done || tried.has(o) || null, onclick: () => pick(o) },
        o, state && h("span", { class: "sr-only" }, state === "good" ? " (correct)" : " (wrong)"));
    }));
    more.hidden = done || shown >= starter.clues.length;
  }
  draw();

  return h("section", { class: "card wai", "aria-labelledby": "wai-title" },
    h("div", { class: "wai-head" },
      h("h2", { id: "wai-title" }, "What am I?"),
      hint("tap", "Fewer clues, more points"),
      score),
    clues, opts,
    h("div", { class: "wai-foot" }, more, feedback));
}
