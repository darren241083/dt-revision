// Recall: match pairs (5 random key words a set) and put in order.

import { h, fill, icon, hint, shuffle } from "../dom.js";

const SET = 5;

export function matchPairs(keywords) {
  let set, defs, sel = null, wrong = null;
  const matched = new Set();
  const root = h("section", { class: "card match", "aria-labelledby": "match-title" });
  const live = h("p", { class: "sr-only", "aria-live": "polite" });

  function newSet() {
    set = shuffle(keywords).slice(0, SET);
    defs = shuffle(set);
    matched.clear();
    sel = wrong = null;
    draw();
  }

  function pick(side, kw) {
    if (matched.has(kw)) return;
    if (!sel || sel.side === side) { sel = { side, kw }; wrong = null; draw(side, kw); return; }
    const other = sel;
    sel = null;
    if (other.kw === kw) {
      matched.add(kw);
      live.textContent = `Match: ${kw.term}.`;
      wrong = null;
    } else {
      wrong = [other, { side, kw }];
      live.textContent = "Not a match. Try again.";
    }
    draw(side, kw);
  }

  function cell(side, kw) {
    const isSel = sel && sel.side === side && sel.kw === kw;
    const isWrong = wrong && wrong.some((w) => w.side === side && w.kw === kw);
    const done = matched.has(kw);
    return h("button", {
      type: "button", "data-key": `${side}${keywords.indexOf(kw)}`,
      class: "opt match-cell " + side + (done ? " good" : isWrong ? " bad shake" : isSel ? " sel" : ""),
      "aria-pressed": String(!!isSel), disabled: done || null,
      onclick: () => pick(side, kw)
    }, side === "term" ? kw.term : kw.def, done && h("span", { class: "sr-only" }, " (matched)"));
  }

  function draw(side, kw) {
    fill(root, 
      h("div", { class: "comp-head" },
        h("h2", { id: "match-title" }, "Match the key words"),
        h("span", { class: "comp-score" }, `${matched.size} / ${set.length}`)),
      hint("tap", "Tap a word, then its meaning"),
      h("div", { class: "match-grid" }, set.map((k, i) => [cell("term", k), cell("def", defs[i])])),
      live,
      h("div", { class: "btn-row" },
        h("button", { type: "button", class: "btn-line", onclick: newSet }, matched.size === set.length ? "New set of words" : "New set")));
    if (side) root.querySelector(`[data-key="${side}${keywords.indexOf(kw)}"]`)?.focus({ preventScroll: true });
  }

  newSet();
  return root;
}

export function putInOrder(order) {
  const n = order.steps.length;
  let items, checked = false;
  const root = h("section", { class: "card order", "aria-labelledby": "order-title" });
  const live = h("p", { class: "sr-only", "aria-live": "polite" });

  function reset() {
    do { items = shuffle(order.steps); } while (n > 1 && items.every((s, i) => s === order.steps[i]));
    checked = false;
    draw();
  }

  function move(i, d, key) {
    const j = i + d;
    [items[i], items[j]] = [items[j], items[i]];
    checked = false;
    live.textContent = `Moved to position ${j + 1}.`;
    draw(`${key}${j}`);
  }

  function draw(focus) {
    const right = items.filter((s, i) => s === order.steps[i]).length;
    fill(root, 
      h("h2", { id: "order-title" }, order.q),
      hint("steps", "Move with the arrows, then check"),
      h("ol", { class: "order-list" }, items.map((s, i) => {
        const ok = s === order.steps[i];
        return h("li", { class: "order-row" + (checked ? (ok ? " good" : " bad") : "") },
          h("span", { class: "order-n", "aria-hidden": "true" }, String(i + 1)),
          h("span", { class: "order-t" }, s,
            checked && h("span", { class: "sr-only" }, ok ? " (right place)" : " (wrong place)")),
          checked && icon(ok ? "check" : "cross", "order-mark"),
          h("span", { class: "order-btns" },
            h("button", { type: "button", class: "icon-btn", "data-f": `u${i}`, "aria-label": `Move "${s}" up`, disabled: i === 0 || null, onclick: () => move(i, -1, "u") }, "↑"),
            h("button", { type: "button", class: "icon-btn", "data-f": `d${i}`, "aria-label": `Move "${s}" down`, disabled: i === n - 1 || null, onclick: () => move(i, 1, "d") }, "↓")));
      })),
      live,
      h("div", { class: "btn-row" },
        h("button", { type: "button", class: "btn-dark", onclick: () => { checked = true; live.textContent = `${right} of ${n} in place.`; draw(); } }, "Check"),
        checked && h("span", { class: "comp-score " + (right === n ? "good" : "") }, `${right} / ${n} in place`),
        checked && right === n && h("button", { type: "button", class: "btn-line", onclick: reset }, "Shuffle again")));
    if (focus) {
      const b = root.querySelector(`[data-f="${focus}"]`);
      (b && !b.disabled ? b : root.querySelector(`[data-f="${focus[0] === "u" ? "d" : "u"}${focus.slice(1)}"]`))?.focus({ preventScroll: true });
    }
  }

  reset();
  return root;
}
