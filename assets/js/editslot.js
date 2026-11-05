// Image slots for teacher edit mode. They render nothing unless edit mode has been switched on
// (edit.js sets `editState.on` and `editState.open`), so pupils never see them.

import { h, icon } from "./dom.js";

export const editState = { on: false, open: null };

// ref: { kind: "item", chunk: <chunk id>, term } or { kind: "diagram", chunk: <chunk id> }
export function imageSlot(ref, hasImage) {
  if (!editState.on) return null;
  return h("button", { type: "button", class: "img-edit", onclick: () => editState.open(ref) },
    icon("image"), hasImage ? "Edit image" : "Add image");
}

// A saved image with the item's caption (if any) and the credit line underneath. The caption
// only ever shows here, under an image that exists.
export function figure(img, fallbackAlt, caption) {
  if (!img) return null;
  return h("figure", { class: "img-slot" },
    h("img", { src: img.file, alt: img.alt || fallbackAlt || "", loading: "lazy" }),
    (caption || img.credit) && h("figcaption", {},
      caption && h("span", { class: "img-caption" }, caption),
      img.credit && h("span", { class: "img-credit-line" }, img.credit)));
}
