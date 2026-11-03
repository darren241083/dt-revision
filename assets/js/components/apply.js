// Apply: "Which tool, and why?" (pick a tool, then a reason, scored /2) and "Odd one out".

import { h, fill, icon, hint, shuffle } from "../dom.js";

const order = (n) => shuffle([...Array(n).keys()]);
const lcFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

export function whichTool(list) {
  let n = 0, tool = null, reason = null, tOrder, rOrder;
  const root = h("section", { class: "card apply", "aria-labelledby": "apply-q" });

  function start(i) {
    n = i;
    tool = reason = null;
    tOrder = order(list[n].tools.length);
    rOrder = order(list[n].reasons.length);
    draw();
  }

  function optState(chosen, i, right) {
    if (chosen === null) return "";
    if (i === right) return "good";
    return i === chosen ? "bad" : "dim";
  }

  function draw() {
    const a = list[n];
    const focusKey = document.activeElement?.dataset?.key;
    const score = (tool === a.tool ? 1 : 0) + (reason === a.reason ? 1 : 0);
    const toolBtns = tOrder.map((i) => h("button", {
      type: "button", class: `opt ${optState(tool, i, a.tool)}`, "data-key": `t${i}`,
      disabled: tool !== null || null, onclick: () => { tool = i; draw(); }
    }, a.tools[i], tool !== null && i === a.tool && h("span", { class: "sr-only" }, " (right tool)")));
    const reasonBtns = rOrder.map((i) => h("button", {
      type: "button", class: `opt ${optState(reason, i, a.reason)}`, "data-key": `r${i}`,
      disabled: tool === null || reason !== null || null, onclick: () => { reason = i; draw(); }
    }, a.reasons[i], reason !== null && i === a.reason && h("span", { class: "sr-only" }, " (right reason)")));

    const done = reason !== null;
    fill(root, 
      h("div", { class: "comp-head" },
        h("span", { class: "label" }, `${n + 1} of ${list.length}`),
        hint("tap", "Pick a tool, then a reason")),
      h("p", { class: "apply-q", id: "apply-q" }, a.q),
      h("h3", { class: "label step-label" }, "Step 1 · Which tool?"),
      h("div", { class: "opt-grid four" }, toolBtns),
      h("h3", { class: "label step-label" + (tool === null ? " off" : "") }, "Step 2 · Why?"),
      h("div", { class: "opt-grid two" }, reasonBtns),
      h("div", { class: "apply-result", "aria-live": "polite" },
        done && [
          h("span", { class: "apply-score " + (score === 2 ? "good" : score ? "part" : "bad") }, `${score} / 2`),
          h("span", {}, `${a.tools[a.tool]}: ${lcFirst(a.reasons[a.reason])}.`)
        ]),
      done && h("div", { class: "btn-row" },
        n < list.length - 1
          ? h("button", { type: "button", class: "btn-dark", onclick: () => start(n + 1) }, "Next scenario")
          : h("button", { type: "button", class: "btn-line", onclick: () => start(0) }, "Start again")));
    // Keep keyboard focus moving forward: tool -> first reason -> Next.
    if (!focusKey) return;
    const next = done ? root.querySelector(".btn-row button") : root.querySelector(".opt-grid.two .opt:not(:disabled)");
    (tool !== null ? next : root.querySelector(`[data-key="${focusKey}"]`))?.focus({ preventScroll: true });
  }

  start(0);
  return root;
}

export function oddOneOut(odd) {
  let mine = null;
  const items = shuffle(odd.items);
  const root = h("section", { class: "card odd", "aria-labelledby": "odd-title" });
  const defaultQ = /^which is the odd one out\??$/i.test(odd.q.trim());

  function draw() {
    fill(root, 
      h("div", { class: "comp-head" },
        h("h2", { id: "odd-title" }, "Odd one out"),
        hint("brain", "Say why before you tap")),
      !defaultQ && h("p", { class: "apply-q" }, odd.q),
      h("div", { class: "opt-grid four" }, items.map((it) => h("button", {
        type: "button", class: "opt" + (mine === it ? " sel" : ""), "aria-pressed": String(mine === it),
        onclick: () => { mine = it; draw(); root.querySelector(".odd-why")?.focus(); }
      }, it.n))),
      mine && h("div", { class: "odd-why", tabindex: "-1", "aria-live": "polite" },
        h("p", { class: "label" }, "Each one can be right. Which reason was yours?"),
        items.map((it) => h("div", { class: "odd-row" + (it === mine ? " mine" : "") },
          h("b", {}, it.n, it === mine && h("span", { class: "sr-only" }, " (your pick)")),
          h("span", {}, it.why),
          it === mine && icon("check")))));
  }
  draw();
  return root;
}
