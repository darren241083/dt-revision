// Image slots for teacher edit mode. They render nothing unless edit mode has been switched on
// (edit.js sets `editState.on` and `editState.open`), so pupils never see them.

import { h, icon } from "./dom.js";

export const editState = { on: false, open: null, check: null };

// ref: { kind: "item", chunk: <chunk id>, term } or { kind: "diagram", chunk: <chunk id> }
// img: the slot's image ({ file, alt, credit, unchecked? }) or a true/false "has an image".
// An image filled in automatically is `unchecked` until the teacher has looked at it: edit mode
// shows an Unchecked badge with Looks good (clears it) and Change (opens the image panel).
export function imageSlot(ref, img) {
  if (!editState.on) return null;
  const what = ref.term ? `: ${ref.term}` : "";
  if (img?.unchecked && editState.check) {
    return h("span", { class: "img-check" },
      h("span", { class: "img-unchecked" }, "Unchecked"),
      h("button", { type: "button", class: "img-edit img-ok", "aria-label": `Image looks good${what}`, onclick: () => editState.check(ref) },
        icon("check"), "Looks good"),
      h("button", { type: "button", class: "img-edit", "aria-label": `Change image${what}`, onclick: () => editState.open(ref) },
        icon("image"), "Change"));
  }
  return h("button", { type: "button", class: "img-edit", onclick: () => editState.open(ref) },
    icon("image"), img ? "Edit image" : "Add image");
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
