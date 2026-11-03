// Mind map: centre node, one branch per chunk, one branch open at a time showing its items.
// Nodes are positioned HTML buttons; the joining lines are thin rotated spans drawn from the
// nodes' real centres, so they stay right at any size. Narrow containers get an accordion list
// instead (CSS container query).
//
// Recall mode (blank map): items show "?" until tapped; "Reveal branch" and "Reset".

import { h, fill, hint, materialDots } from "../dom.js";

const pct = (n) => `${n}%`;

export function mindMap(topic, { chunkHref, recall = false } = {}) {
  let open = null, sel = null;
  const chunks = topic.chunks;
  const shown = new Set();             // recall: "branch-item" keys revealed
  const accOpen = new Set();           // accordion: open branches
  const accItem = new Set();           // accordion (teach): open items
  const key = (i, j) => `${i}-${j}`;
  const found = (i) => chunks[i].items.filter((_, j) => shown.has(key(i, j))).length;

  const lines = h("div", { class: "mm-lines", "aria-hidden": "true" });
  const canvas = h("div", { class: "mm-canvas" });
  const map = h("div", { class: "mm-map card", role: "group", "aria-label": `${recall ? "Blank mind map" : "Mind map"}: ${topic.title}` }, lines, canvas);
  const detail = h("div", { class: "mm-detail", "aria-live": "polite" });
  const list = h("div", { class: "mm-list" });
  const status = h("span", { class: "mm-status", "aria-live": "polite" });
  const revealBtn = h("button", { type: "button", class: "btn-line", onclick: () => {
    if (open === null) return;
    chunks[open].items.forEach((_, j) => shown.add(key(open, j)));
    draw();
  } }, "Reveal branch");
  const resetBtn = h("button", { type: "button", class: "btn-line", onclick: () => { shown.clear(); sel = null; draw(); } }, "Reset");

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

  const countText = (i) => recall ? `${found(i)} of ${chunks[i].items.length} found` : `${chunks[i].items.length} items`;

  function leafButton(i, j, cls, onReveal) {
    const it = chunks[i].items[j];
    const hid = recall && !shown.has(key(i, j));
    return h("button", {
      type: "button", class: cls + (hid ? " hid" : "") + (!recall && sel === j && open === i ? " sel" : ""),
      "data-key": `l${i}-${j}`,
      "aria-pressed": recall ? null : String(sel === j && open === i),
      "aria-label": hid ? `Hidden item ${j + 1} of ${chunks[i].items.length}. Tap to reveal.` : null,
      onclick: onReveal
    }, hid ? "?" : [it.term, materialDots(it.tags)]);
  }

  function draw() {
    const focused = document.activeElement?.dataset?.key;
    fill(canvas, );
    map.classList.toggle("has-open", open !== null);
    canvas.append(place(h("span", { class: "mm-node mm-centre", "data-line": "c" }, topic.short || topic.title),
      open === null ? 50 : 62, 50));

    chunks.forEach((c, i) => {
      const isOpen = open === i;
      const [x, y] = branchPos(i);
      canvas.append(place(h("button", {
        type: "button", class: "mm-node mm-branch" + (isOpen ? " open" : ""), "data-key": `b${i}`, "data-line": `b${i}`,
        "aria-expanded": String(isOpen),
        onclick: () => { open = isOpen ? null : i; sel = null; draw(); }
      }, c.label, h("span", { class: "mm-count" }, countText(i))), x, y));

      if (!isOpen) return;
      const k = c.items.length;
      c.items.forEach((_, j) => {
        const leaf = leafButton(i, j, "mm-node mm-leaf", () => {
          if (recall) shown.add(key(i, j));
          else sel = sel === j ? null : j;
          draw();
        });
        leaf.dataset.line = `l${j}`;
        leaf.style.top = pct(8 + (84 * (j + 0.5)) / k);
        canvas.append(leaf);
      });
    });

    if (recall) {
      status.textContent = open === null ? "" : `${chunks[open].label} · ${found(open)} of ${chunks[open].items.length} found`;
      revealBtn.disabled = open === null || found(open) === chunks[open].items.length;
    } else showDetail();
    drawList();
    requestAnimationFrame(drawLines);
    if (focused) root.querySelector(`[data-key="${focused}"]`)?.focus();
  }

  function drawLines() {
    const box = canvas.getBoundingClientRect();
    if (!box.width) return;
    const mid = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top]; };
    const node = (k) => canvas.querySelector(`[data-line="${k}"]`);
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
    fill(lines, ...out);
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
    if (open === null) return fill(detail, );
    const c = chunks[open];
    detail.className = "mm-detail card" + (sel !== null ? " is-item" : "");
    fill(detail, ...(sel === null
      ? [h("div", { class: "mm-detail-text" },
          h("h3", {}, c.label),
          h("p", {}, c.summary),
          h("a", { class: "mm-read", href: chunkHref(c) }, "Read this chunk ↓"))]
      : itemDetail(c.items[sel], c)).filter(Boolean));
  }

  // Narrow screens: accordion of branches; in teach mode each item opens in place,
  // in recall mode each item is a "?" until tapped.
  function drawList() {
    fill(list, ...chunks.map((c, i) => {
      const on = accOpen.has(i);
      const head = h("button", { type: "button", class: "mm-acc-head", "data-key": `a${i}`, "aria-expanded": String(on),
        onclick: () => { on ? accOpen.delete(i) : accOpen.add(i); draw(); }
      }, h("span", { class: "mm-acc-label" }, c.label, h("span", { class: "mm-count" }, countText(i))));
      const panel = on && h("div", { class: "mm-acc-panel" },
        !recall && h("p", { class: "mm-acc-sum" }, c.summary),
        h("ul", {}, c.items.map((it, j) => {
          if (recall) return h("li", {}, leafButton(i, j, "mm-acc-item", () => { shown.add(key(i, j)); draw(); }));
          const k = key(i, j), itemOn = accItem.has(k);
          return h("li", {},
            h("button", { type: "button", class: "mm-acc-item", "data-key": `ai${k}`, "aria-expanded": String(itemOn),
              onclick: () => { itemOn ? accItem.delete(k) : accItem.add(k); draw(); }
            }, h("span", {}, it.term), materialDots(it.tags)),
            itemOn && h("div", { class: "mm-acc-body" },
              h("p", {}, it.text),
              it.steps && h("ol", { class: "mm-steps" }, it.steps.map((s) => h("li", {}, s)))));
        })),
        recall
          ? found(i) < c.items.length && h("button", { type: "button", class: "btn-line", onclick: () => { c.items.forEach((_, j) => shown.add(key(i, j))); draw(); } }, "Reveal branch")
          : h("a", { class: "mm-read", href: chunkHref(c) }, "Read this chunk ↓"));
      return h("div", { class: "mm-acc" }, head, panel);
    }));
  }

  const root = h("div", { class: "mm" + (recall ? " recall" : "") },
    recall && h("div", { class: "mm-tools" },
      h("div", { class: "comp-head" }, h("h2", {}, "Rebuild the map"), hint("brain", "Say it, then tap ?")),
      h("div", { class: "btn-row" }, status, h("span", { class: "mm-map-only" }, revealBtn), resetBtn)),
    map, !recall && detail, list);
  new ResizeObserver(() => requestAnimationFrame(drawLines)).observe(canvas);
  draw();
  return root;
}
