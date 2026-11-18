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
  print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  // Big picture lenses ("What we'll look at").
  box: '<path d="M3 7.5l9-4.5 9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5l9 4.5 9-4.5M12 12v9"/>',
  plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  minus: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  cog: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  flow: '<rect x="3" y="4" width="7" height="6" rx="1.5"/><rect x="14" y="14" width="7" height="6" rx="1.5"/><path d="M10 7h4.5a2 2 0 0 1 2 2v5"/>',
  shield: '<path d="M12 3l8 3v6c0 4.6-3.4 7.8-8 9-4.6-1.2-8-4.4-8-9V6z"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 8.6A2.5 2.5 0 0 0 10 10v6.5M8.5 13h4.5M8.5 16.5h7"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 5 4.8"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4 4 0 0 1 12 7.4a4 4 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z"/>',
  chart: '<path d="M4 4v16h16"/><path d="M7.5 15l3.5-4.5 3 3L19 7"/>',
  refresh: '<path d="M19.5 10A8 8 0 0 0 5.2 7.2L4 8.5"/><path d="M4 4.5v4h4"/><path d="M4.5 14a8 8 0 0 0 14.3 2.8l1.2-1.3"/><path d="M20 19.5v-4h-4"/>',
  idea: '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>',
  tool: '<path d="M14.7 6.3a4.5 4.5 0 0 0-5.6 5.6L3.5 17.5l3 3 5.6-5.6a4.5 4.5 0 0 0 5.6-5.6l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  force: '<path d="M2.5 12H8M5.5 9.5L8 12l-2.5 2.5M21.5 12H16M18.5 9.5L16 12l2.5 2.5"/><rect x="10" y="6" width="4" height="12" rx="1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  bolt: '<path d="M13 2.5L4.5 13.5H11L10 21.5l8.5-11H12z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  scale: '<path d="M12 4v16M7 20h10M5 7h14"/><path d="M5 7l-2.5 6a2.5 2.5 0 0 0 5 0zM19 7l-2.5 6a2.5 2.5 0 0 0 5 0z"/>',
  home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
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
