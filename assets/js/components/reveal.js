// Reveal cards: the whole card is the button; a dashed "Tap to reveal" area turns into the answer.

import { h } from "../dom.js";

function setOpen(card, open) {
  card.setAttribute("aria-expanded", String(open));
  card.querySelector(".reveal-ph").hidden = open;
  card.querySelector(".reveal-answer").hidden = !open;
}

export function revealCard({ q, a, from }, { size } = {}) {
  const card = h("button", { type: "button", class: "reveal" + (size ? ` ${size}` : ""), "aria-expanded": "false" },
    from && h("span", { class: "reveal-from" }, from),
    h("span", { class: "reveal-q" }, q),
    h("span", { class: "reveal-ph" }, "Tap to reveal"),
    h("span", { class: "reveal-answer", hidden: true, "aria-live": "polite" }, a));
  card.addEventListener("click", () => setOpen(card, card.getAttribute("aria-expanded") !== "true"));
  return card;
}

// A grid of cards with a "Reveal all" / "Hide all" button.
export function revealGroup(list, opts = {}) {
  const cards = list.map((x) => revealCard(x, opts));
  const all = h("button", { type: "button", class: "btn-line reveal-all" }, "Reveal all");
  all.addEventListener("click", () => {
    const open = cards.some((c) => c.getAttribute("aria-expanded") !== "true");
    cards.forEach((c) => setOpen(c, open));
    all.textContent = open ? "Hide all" : "Reveal all";
  });
  return h("div", { class: "reveal-group" }, h("div", { class: "reveals" + (opts.cols === 1 ? " one" : "") }, cards), all);
}
