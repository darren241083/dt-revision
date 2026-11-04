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

// A saved image with its credit line underneath.
export function figure(img, fallbackAlt) {
  if (!img) return null;
  return h("figure", { class: "img-slot" },
    h("img", { src: img.file, alt: img.alt || fallbackAlt || "", loading: "lazy" }),
    img.credit && h("figcaption", {}, img.credit));
}
