// Mind map: centre node, one branch per chunk, one branch open at a time showing its items.
// Nodes are positioned HTML buttons; the joining lines are thin rotated spans drawn from the
// nodes' real centres, so they stay right at any size. Narrow containers get an accordion list
// instead (CSS container query).
//
// Layout (any topic, up to 7 branches): every node is measured, then placed in pixels so that
// nothing overlaps and nothing leaves the card; the card grows taller when it needs room.
// - Closed: branches evenly round the centre on an ellipse, then pushed apart if they touch.
// - Open: the open branch moves to its own side of the centre, its items fan out beyond it
//   (away from the centre), and the other branches move to the far side.
//
// Recall mode (blank map): items show "?" until tapped; "Reveal branch" and "Reset".

import { h, fill, hint, materialDots, materialTag } from "../dom.js";
import { editState, imageSlot, figure as imgFigure } from "../editslot.js";

const px = (n) => `${Math.round(n)}px`;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const GAP = 14;                        // smallest space between two nodes

// Boxes are { x, y, w, h } with x, y the centre.
const overlap = (a, b, g = GAP) => [(a.w + b.w) / 2 + g - Math.abs(a.x - b.x), (a.h + b.h) / 2 + g - Math.abs(a.y - b.y)];
const hits = (a, b) => { const [ox, oy] = overlap(a, b, GAP - 1); return ox > 0 && oy > 0; };

// True when a node's visible text (or its material dots) runs past its content box: a long word
// into the padding or beyond. Screen-reader-only text is left out.
function spills(el) {
  let left = Infinity, right = -Infinity;
  const add = (r) => { if (r.width) { left = Math.min(left, r.left); right = Math.max(right, r.right); } };
  const range = document.createRange();
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (!n.textContent.trim() || n.parentElement.closest(".sr-only")) continue;
    range.selectNodeContents(n);
    [...range.getClientRects()].forEach(add);
  }
  el.querySelectorAll(".mdots i").forEach((i) => add(i.getBoundingClientRect()));
  if (left === Infinity) return false;
  const b = el.getBoundingClientRect(), cs = getComputedStyle(el);
  const inL = parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
  const inR = parseFloat(cs.paddingRight) + parseFloat(cs.borderRightWidth);
  return left < b.left + inL - .5 || right > b.right - inR + .5;
}

// Centres for a stack of heights, kept compact (gaps up to `most`) and centred on `mid`.
function stack(heights, mid, room, most, least = GAP) {
  const sum = heights.reduce((s, v) => s + v, 0);
  const n = heights.length;
  const gap = n > 1 ? clamp((room - sum) / (n - 1), least, most) : 0;
  let y = mid - (sum + gap * (n - 1)) / 2;
  return heights.map((hh) => { const c = y + hh / 2; y += hh + gap; return c; });
}

// Each branch keeps its own colour (components.css: [data-br]); up to 7 branches, then repeats.
const BR = (i) => String(i % 7);

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

  /* ---------- Layout ---------- */

  let laidW = 0;
  const angle = (i) => (-90 + (i * 360) / chunks.length) * Math.PI / 180;

  // Sets the size caps, measures every node and fixes its width so it can't re-wrap when moved.
  // sl, sb: how far to shrink the item column and the branches when an open map is tight.
  function measure(W, sl = 1, sb = 1) {
    map.style.setProperty("--mm-cw", px(clamp(W * .19, 120, 230)));
    map.style.setProperty("--mm-bw", px(clamp(W * .21 * sb, 112, 250)));
    map.style.setProperty("--mm-lw", px(clamp(W * .25 * sl, 120, 320)));
    const els = [...canvas.children];
    els.forEach((el) => { el.style.width = el.style.maxWidth = el.style.fontSize = ""; el.style.left = "0px"; el.style.top = "0px"; });
    return new Map(els.map((el) => {
      let w = Math.ceil(el.getBoundingClientRect().width) + 1;
      el.style.width = px(w);
      // Words never break and are never cut: a node whose longest word doesn't fit gets wider.
      // A branch label longer than two lines, or a centre longer than three, also gets wider (up
      // to a third of the map). If the centre still doesn't fit, its text gets smaller.
      const isCentre = el.classList.contains("mm-centre");
      const text = el.querySelector(".mm-label") || (isCentre ? el : null);
      const most = isCentre ? 3 : 2;
      const lines = () => {
        const lh = parseFloat(getComputedStyle(text).lineHeight) || 20;
        return (text.getBoundingClientRect().height - (text === el ? 28 : 0)) / lh;
      };
      const tooLong = () => (text && lines() > most + .5) || spills(el);
      const widen = () => {
        while (tooLong() && w < W / 3) { w += 8; el.style.maxWidth = "none"; el.style.width = px(w); }
      };
      widen();
      if (isCentre && tooLong()) {
        const full = parseFloat(getComputedStyle(el).fontSize);
        for (let f = full * .94; tooLong() && f >= Math.max(13, full * .6); f *= .94) {
          el.style.fontSize = px(f);
          widen();
        }
      }
      return [el, { el, x: 0, y: 0, w, h: Math.ceil(el.getBoundingClientRect().height) }];
    }));
  }

  // Closed: branches on an ellipse round the centre, pushed apart where they touch, kept inside.
  function ring(W, H, pad, centre, bs) {
    centre.x = W / 2; centre.y = H / 2;
    const mw = Math.max(...bs.map((b) => b.w)), mh = Math.max(...bs.map((b) => b.h));
    const rx = Math.max(0, W / 2 - pad - mw / 2), ry = Math.max(0, H / 2 - pad - mh / 2);
    bs.forEach((b, i) => { b.x = centre.x + rx * Math.cos(angle(i)); b.y = centre.y + ry * Math.sin(angle(i)); });
    const inside = (b) => { b.x = clamp(b.x, pad + b.w / 2, W - pad - b.w / 2); b.y = clamp(b.y, pad + b.h / 2, H - pad - b.h / 2); };
    bs.forEach(inside);
    const all = [centre, ...bs];
    for (let it = 0; it < 240; it++) {
      let moved = false;
      for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) {
        const A = all[a], B = all[b];
        const [ox, oy] = overlap(A, B);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        const alongX = it < 120 && ox < oy;          // later passes only push up and down
        const d = (alongX ? ox : oy) / (A === centre ? 1 : 2);
        const sx = Math.sign(B.x - A.x) || (b % 2 ? 1 : -1), sy = Math.sign(B.y - A.y) || (b % 2 ? 1 : -1);
        if (alongX) { B.x += sx * d; if (A !== centre) A.x -= sx * d; }
        else { B.y += sy * d; if (A !== centre) A.y -= sy * d; }
      }
      bs.forEach(inside);
      if (!moved) break;
    }
    return all.every((A, a) => all.every((B, b) => b <= a || !hits(A, B)));
  }

  // Open: [items] [open branch] [centre] [other branches], mirrored when the branch is on the
  // right. Compact (tight maps): the centre sits above the open branch instead of beside it.
  // Rows (last resort, compact === 2): as compact, with the other branches in rows under the
  // centre and open branch (clear of the items, so no line crosses them).
  // Returns { H, ok }: the height it needs, and whether it fits the width.
  function fan(W, H, pad, centre, bs, ls, compact, g = GAP) {
    const ob = bs[open], others = bs.filter((_, i) => i !== open);
    const lw = Math.max(...ls.map((l) => l.w), 0), ow = Math.max(...others.map((b) => b.w), 0);
    const gapL = Math.max(36, W * .045), gapC = Math.max(28, W * .035);
    const tall = (list) => list.reduce((s, b) => s + b.h, 0) + g * Math.max(0, list.length - 1) + 2 * pad;
    H = Math.max(H, tall(ls), tall(others), (compact ? centre.h + GAP * 2 + ob.h : Math.max(centre.h, ob.h)) + 2 * pad);
    const mid = H / 2;
    ls.forEach((l) => { l.x = pad + lw - l.w / 2; });          // right-aligned, so the fan lines are even
    stack(ls.map((l) => l.h), mid, H - 2 * pad, 22, g).forEach((y, j) => { ls[j].y = y; });
    if (compact) {
      const col = Math.max(ob.w, centre.w);
      ob.x = centre.x = pad + lw + gapL + col / 2;
      centre.y = pad + centre.h / 2;
      ob.y = Math.max(mid, centre.y + centre.h / 2 + GAP * 2 + ob.h / 2);
    } else {
      ob.x = pad + lw + gapL + ob.w / 2; ob.y = mid;
      centre.x = ob.x + ob.w / 2 + gapC + centre.w / 2; centre.y = mid;
    }
    others.forEach((b) => { b.x = W - pad - b.w / 2; });
    stack(others.map((b) => b.h), mid, H - 2 * pad, 40, g).forEach((y, k) => { others[k].y = y; });
    const right = Math.max(centre.x + centre.w / 2, ob.x + ob.w / 2);
    let ok = others.every((b) => b.x - b.w / 2 >= right + gapC) && right <= W - pad;
    if (compact === 2) {
      const x0 = pad + lw + gapL;                       // the column beside the items
      ob.y = centre.y + centre.h / 2 + GAP * 2 + ob.h / 2;
      let x = x0, y = ob.y + ob.h / 2 + GAP * 3, rowH = 0;
      others.forEach((b) => {
        if (x > x0 && x + b.w > W - pad) { x = x0; y += rowH + g; rowH = 0; }
        b.x = x + b.w / 2; b.y = y + b.h / 2; x += b.w + GAP; rowH = Math.max(rowH, b.h);
      });
      H = Math.max(H, tall(ls), y + rowH + pad);
      stack(ls.map((l) => l.h), H / 2, H - 2 * pad, 22, g).forEach((yy, j) => { ls[j].y = yy; });
      ok = right <= W - pad && others.every((b) => b.x + b.w / 2 <= W - pad);
    }
    if (Math.cos(angle(open)) > 1e-6) [...ls, ...bs, centre].forEach((b) => { b.x = W - b.x; });
    return { H, ok };
  }

  function layout() {
    const W = canvas.clientWidth;
    if (!W || getComputedStyle(map).display === "none") return;
    laidW = W;
    const pad = Math.max(12, W * .02);
    // Beside the panel (wide screens), the map keeps to the window's height below its top, so the
    // stage title, map and panel are seen together without scrolling; stacks may close up to 8px.
    const beside = map.offsetWidth < root.clientWidth - 40;
    const room = window.innerHeight - (map.getBoundingClientRect().top + window.scrollY) - 16;
    const g = beside ? 8 : GAP;
    const base = beside && room >= 320 ? Math.min(Math.max(360, W * 520 / 864), room) : Math.max(360, W * 520 / 864);
    let boxes, H = base;
    if (open === null) {
      boxes = measure(W);
      const centre = boxes.get(canvas.querySelector(".mm-centre"));
      const bs = [...canvas.querySelectorAll(".mm-branch")].map((el) => boxes.get(el));
      for (H = Math.max(base, centre.h + 2 * pad); H < base * 3; H *= 1.08) if (ring(W, H, pad, centre, bs)) break;
    } else {
      // Open: try item-column widths (sl), branch widths (sb), side by side or compact, and keep
      // the shortest layout that fits the width. Branch labels are only narrowed as a last resort.
      const tries = [[1.3, 1], [1, 1], [.85, 1], [.72, 1], [.6, 1],
        [1.3, 1, 1], [1, 1, 1], [.85, 1, 1], [.6, 1, 1], [.6, .88, 1], [.6, .76, 1],
        [1, 1, 2], [.72, 1, 2], [.6, .88, 2]];
      let best = null;
      for (const [sl, sb, compact] of tries) {
        const bx = measure(W, sl, sb);
        const centre = bx.get(canvas.querySelector(".mm-centre"));
        const bs = [...canvas.querySelectorAll(".mm-branch")].map((el) => bx.get(el));
        const ls = [...canvas.querySelectorAll(".mm-leaf")].map((el) => bx.get(el));
        const f = fan(W, base, pad, centre, bs, ls, compact, g);
        const plan = { ok: f.ok, H: f.H, sl, sb, compact, pos: [...bx.values()].map((b) => [b.el, b.x, b.y, b.w]) };
        if (!best || (plan.ok && (!best.ok || plan.H < best.H - 1))) best = plan;
        if (plan.ok && plan.H <= base) break;            // fits the room already: no need to look further
      }
      // Re-measure at the chosen sizes so every node has the width it was planned with.
      boxes = measure(W, best.sl, best.sb);
      best.pos.forEach(([el, x, y, w]) => { const b = boxes.get(el); b.x = x; b.y = y; el.style.width = px(w); el.style.maxWidth = "none"; });
      H = best.H;
    }
    map.style.height = px(H);
    boxes.forEach((b) => { b.el.style.left = px(b.x); b.el.style.top = px(b.y); });
    drawLines();
  }

  const countText = (i) => recall ? `${found(i)} of ${chunks[i].items.length} found` : `${chunks[i].items.length} items`;

  function leafButton(i, j, cls, onReveal) {
    const it = chunks[i].items[j];
    const hid = recall && !shown.has(key(i, j));
    return h("button", {
      type: "button", class: cls + (hid ? " hid" : "") + (!hid && sel === j && open === i ? " sel" : ""),
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
    // The centre always shows the full topic title.
    canvas.append(h("span", { class: "mm-node mm-centre", "data-line": "c" }, topic.title));

    chunks.forEach((c, i) => {
      const isOpen = open === i;
      canvas.append(h("button", {
        type: "button", class: "mm-node mm-branch" + (isOpen ? " open" : ""), "data-key": `b${i}`, "data-line": `b${i}`, "data-br": BR(i),
        "aria-expanded": String(isOpen),
        onclick: () => { open = isOpen ? null : i; sel = null; draw(); }
      }, h("span", { class: "mm-label" }, c.label), h("span", { class: "mm-count" }, countText(i))));

      if (!isOpen) return;
      c.items.forEach((_, j) => {
        const leaf = leafButton(i, j, "mm-node mm-leaf", () => {
          // Recall: the first tap reveals the item, and the panel shows it.
          if (recall && !shown.has(key(i, j))) { shown.add(key(i, j)); sel = j; }
          else sel = sel === j ? null : j;
          draw();
        });
        leaf.dataset.line = `l${j}`;
        leaf.dataset.br = BR(i);
        canvas.append(leaf);
      });
    });

    if (recall) {
      status.textContent = open === null ? "" : `${chunks[open].label} · ${found(open)} of ${chunks[open].items.length} found`;
      revealBtn.disabled = open === null || found(open) === chunks[open].items.length;
    }
    showDetail();
    drawList();
    layout();
    if (focused) root.querySelector(`[data-key="${focused}"]`)?.focus();
  }

  function drawLines() {
    const box = canvas.getBoundingClientRect();
    if (!box.width) return;
    const mid = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top]; };
    const node = (k) => canvas.querySelector(`[data-line="${k}"]`);
    const seg = ([x1, y1], [x2, y2], cls, i) => {
      const s = h("span", { class: cls, "data-br": BR(i) });
      s.style.left = `${x1}px`;
      s.style.top = `${y1}px`;
      s.style.width = `${Math.hypot(x2 - x1, y2 - y1)}px`;
      s.style.transform = `rotate(${Math.atan2(y2 - y1, x2 - x1)}rad)`;
      return s;
    };
    const c = mid(node("c"));
    const out = chunks.map((_, i) => seg(c, mid(node(`b${i}`)), "mm-line", i));
    if (open !== null) {
      // Item lines end at the item's near edge, so they never run behind other items.
      const b = mid(node(`b${open}`));
      const edge = (el) => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2 - box.left < b[0] ? r.right - box.left - 2 : r.left - box.left + 2;
        return [x, r.top + r.height / 2 - box.top];
      };
      chunks[open].items.forEach((_, j) => out.push(seg(b, edge(node(`l${j}`)), "mm-line kid", open)));
    }
    fill(lines, ...out);
  }

  function itemDetail(it, c) {
    return [
      h("div", { class: "mm-detail-text" },
        h("h3", {}, it.term),
        materialTag(it.tags) && h("div", { class: "mm-detail-tags" }, materialTag(it.tags)),
        h("p", {}, it.text),
        it.steps && h("ol", { class: "mm-steps" }, it.steps.map((s) => h("li", {}, s))),
        h("a", { class: "mm-read", href: chunkHref(c) }, "Read this chunk ↓")),
      (it.image || editState.on) && h("div", { class: "mm-detail-img" },
        imgFigure(it.image, it.term, !recall && it.caption),
        imageSlot({ kind: "item", chunk: c.id, term: it.term }, !!it.image))
    ];
  }

  // The description panel: beside the map on wide screens, under it on narrower ones (the
  // empty state and the recall panel only show beside the map; see components.css).
  function showDetail() {
    const c = open === null ? null : chunks[open];
    const it = c && sel !== null ? c.items[sel] : null;
    detail.className = "mm-detail card" + (it ? " is-item" : c ? " is-branch" : " is-empty");
    if (!c) return fill(detail, h("div", { class: "mm-detail-text" },
      hint("tap", recall ? "Open a branch, then tap ?" : "Tap a branch, then an item")));
    if (!it) return fill(detail, h("div", { class: "mm-detail-text" },
      h("h3", {}, c.label),
      !recall && h("p", {}, c.summary),
      hint(recall ? "brain" : "tap", recall ? "Say it, then tap ?" : "Tap an item"),
      !recall && h("a", { class: "mm-read", href: chunkHref(c) }, "Read this chunk ↓")));
    fill(detail, ...itemDetail(it, c).filter(Boolean));
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
      return h("div", { class: "mm-acc", "data-br": BR(i) }, head, panel);
    }));
  }

  // Recall tools sit above the map on narrow screens, and at the top of the panel column beside it.
  const root = h("div", { class: "mm" + (recall ? " recall" : "") },
    h("div", { class: "mm-body" },
      recall && h("div", { class: "mm-tools" },
        h("div", { class: "comp-head" }, h("h2", {}, "Rebuild the map"), hint("brain", "Say it, then tap ?")),
        h("div", { class: "btn-row" }, status, h("span", { class: "mm-map-only" }, revealBtn), resetBtn)),
      map, h("div", { class: "mm-side" }, detail)),
    list);
  // Lay out again only when the width changes (the height is ours to set).
  new ResizeObserver(() => { if (canvas.clientWidth !== laidW) layout(); else drawLines(); }).observe(canvas);

  // Lay out again when the text size can change: web fonts arriving (a weight can load after the
  // first layout) and teaching mode. Both watchers stop once this map has left the page.
  let attached = false;
  const gone = () => { if (root.isConnected) attached = true; return attached && !root.isConnected; };
  const relayout = () => { laidW = 0; layout(); };
  const onFonts = () => { if (gone()) document.fonts.removeEventListener("loadingdone", onFonts); else relayout(); };
  const teachWatch = new MutationObserver(() => { if (gone()) teachWatch.disconnect(); else relayout(); });
  const onResize = () => { if (gone()) window.removeEventListener("resize", onResize); else relayout(); };
  window.addEventListener("resize", onResize);           // the window's height sets the map's room
  document.fonts?.ready.then(relayout);
  document.fonts?.addEventListener("loadingdone", onFonts);
  teachWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  draw();
  return root;
}
