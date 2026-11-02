// Mind map: centre node, one branch per chunk, one branch open at a time showing its items.
// Nodes are positioned HTML buttons; the joining lines are thin rotated spans drawn from the
// nodes' real centres, so they stay right at any size. Narrow containers get an accordion list
// instead (CSS container query).

import { h, materialDots } from "../dom.js";

const pct = (n) => `${n}%`;

export function mindMap(topic, { chunkHref }) {
  let open = null, sel = null;
  const chunks = topic.chunks;

  const lines = h("div", { class: "mm-lines", "aria-hidden": "true" });
  const canvas = h("div", { class: "mm-canvas" });
  const map = h("div", { class: "mm-map card", role: "group", "aria-label": `Mind map: ${topic.title}` }, lines, canvas);
  const detail = h("div", { class: "mm-detail", "aria-live": "polite" });

  function place(el, x, y) {
    el.style.left = pct(x);
    el.style.top = pct(y);
    return el;
  }

  function branchPos(i) {
    if (open === null) {
      const a = (-90 + (i * 360) / chunks.length) * Math.PI / 180;
      return [50 + 34 * Math.cos(a), 50 + 37 * Math.sin(a)];
    }
    if (i === open) return [36, 50];
    const others = chunks.map((_, j) => j).filter((j) => j !== open);
    const k = others.indexOf(i), n = others.length;
    const a = (-62 + (n > 1 ? (160 * k) / (n - 1) : 0)) * Math.PI / 180;
    return [62 + 26 * Math.cos(a), 50 + 38 * Math.sin(a)];
  }

  function draw() {
    const focused = document.activeElement?.dataset?.key;
    canvas.replaceChildren();
    map.classList.toggle("has-open", open !== null);
    const centre = place(h("span", { class: "mm-node mm-centre", "data-line": "c" }, topic.short || topic.title),
      open === null ? 50 : 62, 50);
    canvas.append(centre);

    chunks.forEach((c, i) => {
      const isOpen = open === i;
      const [x, y] = branchPos(i);
      canvas.append(place(h("button", {
        type: "button", class: "mm-node mm-branch" + (isOpen ? " open" : ""), "data-key": `b${i}`, "data-line": `b${i}`,
        "aria-expanded": String(isOpen),
        onclick: () => { open = isOpen ? null : i; sel = null; draw(); }
      }, c.label, h("span", { class: "mm-count" }, `${c.items.length} items`)), x, y));

      if (!isOpen) return;
      const k = c.items.length;
      c.items.forEach((it, j) => {
        const leaf = h("button", {
          type: "button", class: "mm-node mm-leaf" + (sel === j ? " sel" : ""), "data-key": `l${i}-${j}`, "data-line": `l${j}`,
          "aria-pressed": String(sel === j),
          onclick: () => { sel = sel === j ? null : j; draw(); }
        }, it.term, materialDots(it.tags));
        leaf.style.top = pct(8 + (84 * (j + 0.5)) / k);
        canvas.append(leaf);
      });
    });

    showDetail();
    requestAnimationFrame(drawLines);
    if (focused) canvas.querySelector(`[data-key="${focused}"]`)?.focus();
  }

  function drawLines() {
    const box = canvas.getBoundingClientRect();
    if (!box.width) return;
    const mid = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top]; };
    const node = (key) => canvas.querySelector(`[data-line="${key}"]`);
    const seg = ([x1, y1], [x2, y2], cls) => {
      const s = h("span", { class: cls });
      s.style.left = `${x1}px`;
      s.style.top = `${y1}px`;
      s.style.width = `${Math.hypot(x2 - x1, y2 - y1)}px`;
      s.style.transform = `rotate(${Math.atan2(y2 - y1, x2 - x1)}rad)`;
      return s;
    };
    const c = mid(node("c"));
    const out = chunks.map((_, i) => seg(c, mid(node(`b${i}`)), "mm-line"));
    if (open !== null) {
      const b = mid(node(`b${open}`));
      chunks[open].items.forEach((_, j) => out.push(seg(b, mid(node(`l${j}`)), "mm-line kid")));
    }
    lines.replaceChildren(...out);
  }

  function itemDetail(it, c) {
    return [
      h("div", { class: "mm-detail-text" },
        h("h3", {}, it.term, materialDots(it.tags)),
        h("p", {}, it.text),
        it.steps && h("ol", { class: "mm-steps" }, it.steps.map((s) => h("li", {}, s))),
        h("a", { class: "mm-read", href: chunkHref(c) }, "Read this chunk ↓")),
      it.image && h("figure", { class: "img-slot" },
        h("img", { src: it.image.file, alt: it.image.alt || it.term, loading: "lazy" }),
        it.image.credit && h("figcaption", {}, it.image.credit))
    ];
  }

  function showDetail() {
    detail.hidden = open === null;
    if (open === null) return detail.replaceChildren();
    const c = chunks[open];
    detail.className = "mm-detail card" + (sel !== null ? " is-item" : "");
    detail.replaceChildren(...(sel === null
      ? [h("div", { class: "mm-detail-text" },
          h("h3", {}, c.label),
          h("p", {}, c.summary),
          h("a", { class: "mm-read", href: chunkHref(c) }, "Read this chunk ↓"))]
      : itemDetail(c.items[sel], c)).filter(Boolean));
  }

  // Narrow screens: accordion of branches, each item opens in place.
  const list = h("div", { class: "mm-list" }, chunks.map((c, i) => {
    const panel = h("div", { class: "mm-acc-panel", id: `mm-acc-${i}`, hidden: true },
      h("p", { class: "mm-acc-sum" }, c.summary),
      h("ul", {}, c.items.map((it) => {
        const body = h("div", { class: "mm-acc-body", hidden: true },
          h("p", {}, it.text),
          it.steps && h("ol", { class: "mm-steps" }, it.steps.map((s) => h("li", {}, s))));
        const btn = h("button", { type: "button", class: "mm-acc-item", "aria-expanded": "false",
          onclick: () => { const on = btn.getAttribute("aria-expanded") !== "true"; btn.setAttribute("aria-expanded", String(on)); body.hidden = !on; }
        }, h("span", {}, it.term), materialDots(it.tags));
        return h("li", {}, btn, body);
      })),
      h("a", { class: "mm-read", href: chunkHref(c) }, "Read this chunk ↓"));
    const head = h("button", { type: "button", class: "mm-acc-head", "aria-expanded": "false", "aria-controls": panel.id,
      onclick: () => { const on = head.getAttribute("aria-expanded") !== "true"; head.setAttribute("aria-expanded", String(on)); panel.hidden = !on; }
    }, h("span", { class: "mm-acc-label" }, c.label, h("span", { class: "mm-count" }, `${c.items.length} items`)));
    return h("div", { class: "mm-acc" }, head, panel);
  }));

  const root = h("div", { class: "mm" }, map, detail, list);
  new ResizeObserver(() => requestAnimationFrame(drawLines)).observe(canvas);
  draw();
  return root;
}
