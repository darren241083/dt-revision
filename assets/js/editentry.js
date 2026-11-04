// The way into teacher edit mode. The Edit button only shows in a browser that already holds an
// edit-mode token (typed in once through ?edit or Ctrl+Shift+E), so pupils' devices never show
// it. Once switched on, edit mode stays on from page to page until Exit or the tab is closed.

import { h, icon } from "./dom.js";
import * as store from "./store.js";

const ON = "dtr.editOn";
const hasToken = () => !!store.get("editToken", "");
const remembered = () => { try { return sessionStorage.getItem(ON) === "1"; } catch { return false; } };
const remember = (on) => {
  try { if (on) sessionStorage.setItem(ON, "1"); else sessionStorage.removeItem(ON); } catch { /* not remembered */ }
};

// context(): what edit.js start() needs ({ topic, level, rerender, … }). It is asked for each time
// edit mode starts, so it can read the page's current state. ready(): false until the page has loaded.
export function editEntry(context, ready = () => true) {
  let mod = null;
  const isOn = () => !!mod?.isOn();

  async function toggle() {
    if (!ready()) return;
    mod ||= await import("./edit.js");
    if (mod.isOn()) return mod.stop();
    const c = context();
    // start() and stop() (also Exit in the edit bar) both redraw the page through rerender,
    // which is when the on/off state is remembered and the button updates.
    mod.start({ ...c, rerender: () => { remember(mod.isOn()); c.rerender(); } });
  }

  // The top-bar button, or nothing on a device without a token.
  function button() {
    if (!hasToken() && !isOn()) return null;
    const on = isOn();
    return h("button", { type: "button", class: "teach-btn edit-btn", "aria-pressed": String(on), onclick: toggle },
      icon("pen"), h("span", { class: "teach-label" }, on ? "Editing" : "Edit"));
  }

  // On page load: ?edit, or edit mode was on in this tab before.
  function auto() {
    if (new URLSearchParams(location.search).has("edit") || remembered()) toggle();
  }

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === "E" || e.key === "e")) { e.preventDefault(); toggle(); }
  });

  return { button, auto, toggle };
}
