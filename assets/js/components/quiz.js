// Quiz with confidence: ~10 questions drawn at random from the topic's bank (multiple choice
// and true/false). Pick an answer, then Sure / Unsure / Guess, then see the answer and why.
// Results: score, a 4-box grid and "Fix these first" linking to the chunk and book page.
// State lives in a per-visit object (passed in), never saved, so it clears when the page is left.

import { h, fill, icon, hint, shuffle } from "../dom.js";

const DRAW = 10;
const KEYS = ["A", "B", "C", "D", "E", "F"];
const CONF = [["sure", "Sure"], ["unsure", "Unsure"], ["guess", "Guess"]];

function newRound(topic) {
  return {
    items: shuffle(topic.quiz).slice(0, DRAW).map((q) => ({
      q,
      order: q.tf != null ? [true, false] : shuffle([...q.options.keys()])
    })),
    i: 0, pick: null, answers: [], done: false
  };
}

const isRight = (it, pick) => (it.q.tf != null ? pick === it.q.tf : pick === it.q.answer);

// Which box each answer falls in; also used for the Fix list.
function box(a) {
  if (a.right) return a.conf === "sure" ? "rs" : "rn";
  return a.conf === "sure" ? "ws" : "wn";
}
const BOXES = [
  ["rs", "Right and sure"], ["rn", "Right, not sure"], ["wn", "Wrong, not sure"], ["ws", "Wrong but sure"]
];

// Missed or guessed questions, worst first: wrong but sure, wrong not sure, right but guessed.
export function fixList(state) {
  if (!state || !state.done) return [];
  const rank = (a) => (!a.right && a.conf === "sure" ? 0 : !a.right ? 1 : 2);
  return state.answers
    .filter((a) => !a.right || a.conf === "guess")
    .sort((a, b) => rank(a) - rank(b))
    .map((a) => ({
      ...a,
      why: !a.right && a.conf === "sure" ? "Wrong but sure" : !a.right ? "Wrong, not sure" : "Right, but guessed",
      tone: !a.right && a.conf === "sure" ? "ws" : !a.right ? "wn" : "rg"
    }));
}

export function fixRows(state, chunkLink) {
  return h("ul", { class: "fix-list" }, fixList(state).map((f) => {
    const link = chunkLink(f.q.chunk);
    return h("li", { class: "fix-row" },
      h("span", { class: "fix-text" },
        h("span", { class: "fix-q" }, f.q.q),
        h("span", { class: `fix-why ${f.tone}` }, f.why)),
      h("a", { class: "fix-go", href: link.href }, `${link.label} →`));
  }));
}

export function quiz(topic, session, { chunkLink }) {
  session.quiz ||= newRound(topic);
  const root = h("div", { class: "quiz" });

  function optLabel(it, o) {
    return it.q.tf != null ? (o ? "True" : "False") : it.q.options[o];
  }

  function answer(conf) {
    const S = session.quiz, it = S.items[S.i];
    S.answers.push({ q: it.q, pick: S.pick, conf, right: isRight(it, S.pick) });
    draw("next");
  }

  function next() {
    const S = session.quiz;
    S.pick = null;
    if (S.i < S.items.length - 1) S.i++;
    else S.done = true;
    draw(S.done ? "results" : "q");
  }

  function questionCard() {
    const S = session.quiz, it = S.items[S.i], n = S.items.length;
    const a = S.answers[S.i];
    const correct = it.q.tf != null ? it.q.tf : it.q.answer;
    return h("section", { class: "card quiz-card", "aria-labelledby": "quiz-q" },
      h("div", { class: "comp-head" },
        h("span", { class: "label" }, `Question ${S.i + 1} of ${n}`),
        hint("tap", "Answer, then say how sure")),
      h("span", { class: "bar", "aria-hidden": "true" }, h("span", { style: `width:${(100 * (S.i + (a ? 1 : 0))) / n}%` })),
      h("h2", { class: "quiz-q", id: "quiz-q", tabindex: "-1" }, it.q.q),
      h("div", { class: "opt-grid two", role: "group", "aria-label": "Answers" }, it.order.map((o, k) => {
        const state = a ? (o === correct ? "good" : o === a.pick ? "bad" : "dim") : S.pick === o ? "sel" : "";
        return h("button", {
          type: "button", class: `opt keyed ${state}`, "data-key": `o${k}`, "aria-pressed": a ? null : String(S.pick === o),
          disabled: a ? true : null, onclick: () => { S.pick = o; draw("opt", `o${k}`); }
        }, h("span", { class: "key", "aria-hidden": "true" }, it.q.tf != null ? (o ? "T" : "F") : KEYS[k]), optLabel(it, o),
          a && o === correct && h("span", { class: "sr-only" }, " (correct answer)"));
      })),
      !a && h("div", { class: "conf", role: "group", "aria-label": "How sure are you?" },
        h("span", { class: "conf-label" }, "How sure are you?"),
        CONF.map(([c, label]) => h("button", { type: "button", class: "btn-line", "data-key": `c${c}`, disabled: S.pick === null || null, onclick: () => answer(c) }, label))),
      a && h("div", { class: "quiz-feedback", "aria-live": "polite" },
        h("p", { class: "feedback " + (a.right ? "good" : "bad") }, icon(a.right ? "check" : "cross"),
          a.right ? "Correct." : `The answer is ${optLabel(it, correct)}.`),
        h("p", { class: "quiz-why" }, it.q.why),
        h("div", { class: "btn-row" },
          h("button", { type: "button", class: "btn-dark", "data-key": "next", onclick: next }, S.i < n - 1 ? "Next question" : "See results"))));
  }

  function resultsCard() {
    const S = session.quiz;
    const counts = Object.fromEntries(BOXES.map(([k]) => [k, 0]));
    S.answers.forEach((a) => counts[box(a)]++);
    const right = S.answers.filter((a) => a.right).length;
    const fixes = fixList(S);
    return h("section", { class: "card results", "aria-labelledby": "results-title" },
      h("div", { class: "comp-head" },
        h("h2", { id: "results-title", tabindex: "-1" }, "Your results"),
        h("span", { class: "results-score" }, `${right} / ${S.answers.length}`)),
      h("div", { class: "cells" }, BOXES.map(([k, label]) =>
        h("div", { class: `cell ${k}` }, h("span", { class: "cell-n" }, String(counts[k])), h("span", { class: "cell-t" }, label)))),
      fixes.length
        ? [h("h3", { class: "label" }, "Fix these first"), fixRows(S, chunkLink)]
        : h("p", { class: "feedback good" }, icon("check"), "Nothing to fix: all right, and no guesses."),
      h("div", { class: "btn-row" },
        h("button", { type: "button", class: "btn-line", onclick: () => { session.quiz = newRound(topic); draw("q"); } }, "New set of questions")));
  }

  function draw(why, focusKey) {
    fill(root, session.quiz.done ? resultsCard() : questionCard());
    if (why === "opt") root.querySelector(".conf button")?.focus({ preventScroll: true });
    else if (why === "next") root.querySelector('[data-key="next"]')?.focus({ preventScroll: true });
    else if (why === "q") root.querySelector("#quiz-q")?.focus({ preventScroll: true });
    else if (why === "results") root.querySelector("#results-title")?.focus({ preventScroll: true });
    if (focusKey && why !== "opt") root.querySelector(`[data-key="${focusKey}"]`)?.focus();
  }

  draw();
  return root;
}
