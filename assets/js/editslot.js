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

// Text that says something: a placeholder with no letters or numbers (such as "--" typed into a
// required box) counts as empty and is never shown.
export const realText = (t) => (typeof t === "string" && /[\p{L}\p{N}]/u.test(t) ? t : "");

// A saved image with the item's caption (if any) and the credit line underneath. The caption
// only ever shows here, under an image that exists. Nothing shows under it without real text.
export function figure(img, fallbackAlt, caption) {
  if (!img) return null;
  const cap = realText(caption), credit = realText(img.credit);
  return h("figure", { class: "img-slot" },
    h("img", { src: img.file, alt: img.alt || fallbackAlt || "", loading: "lazy" }),
    (cap || credit) && h("figcaption", {},
      cap && h("span", { class: "img-caption" }, cap),
      credit && h("span", { class: "img-credit-line" }, credit)));
}
