// Small DOM helpers shared by every page.

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

// Line icons, 24×24, drawn with currentColor.
const ICONS = {
  tap: '<path d="M9 11V5a1.5 1.5 0 0 1 3 0v5"/><path d="M12 10V8.5a1.5 1.5 0 0 1 3 0V11"/><path d="M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.5a6 6 0 0 1-4.7-2.3L4.5 15.8a1.6 1.6 0 0 1 2.4-2.1L9 15.5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2z"/><path d="M4 20a2 2 0 0 0 2 2h13v-4"/>',
  brain: '<path d="M12 5a3 3 0 0 0-5.8 1A3 3 0 0 0 4 11a3 3 0 0 0 2 5 3 3 0 0 0 6 1V5z"/><path d="M12 5a3 3 0 0 1 5.8 1A3 3 0 0 1 20 11a3 3 0 0 1-2 5 3 3 0 0 1-6 1"/>',
  steps: '<path d="M5 6h14M5 12h14M5 18h9"/>',
  board: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  cross: '<path d="M6 6l12 12M18 6L6 18"/>',
  clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  map: '<circle cx="12" cy="12" r="3"/><circle cx="4.5" cy="5.5" r="2"/><circle cx="19.5" cy="5.5" r="2"/><circle cx="4.5" cy="18.5" r="2"/><circle cx="19.5" cy="18.5" r="2"/><path d="M6 7l4 3M18 7l-4 3M6 17l4-3M18 17l-4-3"/>'
};

export function icon(name, cls) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("aria-hidden", "true");
  s.setAttribute("focusable", "false");
  s.setAttribute("class", cls ? "ico " + cls : "ico");
  s.innerHTML = ICONS[name] || "";
  return s;
}

// Hint chip: an icon plus two or three words showing how to use a section.
export const hint = (name, text) => h("span", { class: "hint" }, icon(name), text);

// Material tag for an item: Timber, Polymer, or Both (GCSE only; none when untagged).
const MATERIAL = { timber: "Timber", polymer: "Polymer" };
export function materialTag(tags) {
  if (!tags || !tags.length) return null;
  if (tags.length > 1) return h("span", { class: "tag both" }, "Both");
  return h("span", { class: `tag ${tags[0]}` }, MATERIAL[tags[0]]);
}

// Small coloured dots for mind-map nodes, with the materials as text for screen readers.
export function materialDots(tags) {
  if (!tags || !tags.length) return null;
  return h("span", { class: "mdots" },
    tags.map((t) => h("i", { class: t, "aria-hidden": "true" })),
    h("span", { class: "sr-only" }, ` (${tags.map((t) => MATERIAL[t]).join(" and ")})`));
}

export function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// replaceChildren that skips empty parts (false / null / undefined from conditional pieces).
export const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
