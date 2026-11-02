// Countdown timer (teaching mode only): ring, 1 / 3 / 5 min presets, start/pause, reset.
// One timer per page visit, so it keeps running when you move between stages.

import { h } from "../dom.js";

const PRESETS = [1, 3, 5];
const T = { total: 180, left: 180, running: false, tick: null, views: new Set() };

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function update() {
  for (const v of T.views) {
    // Drop views that were on the page and have since been removed (stage changed).
    if (v.root.isConnected) v.mounted = true;
    else if (v.mounted) { T.views.delete(v); continue; }
    const used = T.total ? (T.total - T.left) / T.total : 0;
    v.ring.style.setProperty("--used", `${Math.round(used * 1000) / 10}%`);
    v.time.textContent = T.left ? fmt(T.left) : "Time!";
    v.root.classList.toggle("done", T.left === 0);
    v.go.textContent = T.running ? "Pause" : T.left === T.total ? "Start" : T.left ? "Resume" : "Start";
    v.presets.forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.min * 60 === T.total)));
  }
}

function stop() {
  clearInterval(T.tick);
  T.tick = null;
  T.running = false;
}

function start() {
  if (T.left === 0) T.left = T.total;
  T.running = true;
  T.tick = setInterval(() => {
    T.left = Math.max(0, T.left - 1);
    if (T.left === 0) {
      stop();
      for (const v of T.views) v.live.textContent = "Time is up.";
    }
    update();
  }, 1000);
  update();
}

function setPreset(min) {
  stop();
  T.total = T.left = min * 60;
  update();
}

export function timer() {
  const v = {};
  v.time = h("span", { class: "timer-time" });
  v.ring = h("span", { class: "timer-ring", "aria-hidden": "true" }, v.time);
  v.presets = PRESETS.map((m) => h("button", { type: "button", "data-min": m, onclick: () => setPreset(m) }, `${m} min`));
  v.go = h("button", { type: "button", class: "timer-go", onclick: () => { T.running ? stop() : start(); update(); } });
  v.live = h("span", { class: "sr-only", "aria-live": "assertive" });
  v.root = h("div", { class: "timer card", role: "group", "aria-label": "Countdown timer" },
    v.ring,
    h("div", { class: "timer-controls" },
      h("div", { class: "seg", role: "group", "aria-label": "Length" }, v.presets),
      h("div", { class: "timer-btns" },
        v.go,
        h("button", { type: "button", class: "btn-line", onclick: () => setPreset(T.total / 60) }, "Reset"))),
    v.live);
  T.views.add(v);
  update();
  return v.root;
}
