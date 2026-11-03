// Audio player for a topic's audio overview: play/pause, scrubber, time, −15s / +15s, speed.
// preload="none" so nothing downloads until the pupil presses play.

import { h, icon } from "../dom.js";

const WAVE = [14, 22, 30, 18, 36, 40, 26, 20, 32, 44, 28, 16, 24, 38, 34, 22, 18, 30, 42, 36, 20, 14, 26, 34, 40, 30, 22, 16, 28, 38, 44, 32, 20, 24, 36, 30, 18, 22, 34, 40];
const SPEEDS = [1, 1.25, 1.5];

const fmt = (s) => {
  if (!isFinite(s) || s < 0) return "–:––";
  s = Math.floor(s);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function audioPlayer(audio, title) {
  const el = h("audio", { preload: "none", src: audio.file });
  let length = audio.length || 0, speed = 0, seeking = false;

  const playBtn = h("button", { type: "button", class: "play", "aria-label": "Play" }, icon("play"));
  const time = h("span", { class: "player-time" });
  const bars = WAVE.map((x) => h("span", { style: `height:${x}px` }));
  const seek = h("input", { type: "range", class: "seek", min: "0", max: String(length || 100), step: "1", value: "0", "aria-label": "Position" });
  const back = h("button", { type: "button", "aria-label": "Back 15 seconds" }, "−15s");
  const fwd = h("button", { type: "button", "aria-label": "Forward 15 seconds" }, "+15s");
  const rate = h("button", { type: "button", class: "rate" });

  function paint() {
    const t = el.currentTime || 0;
    const total = isFinite(el.duration) && el.duration > 0 ? el.duration : length;
    const done = total ? t / total : 0;
    bars.forEach((b, i) => b.classList.toggle("on", i / bars.length < done));
    time.textContent = `${fmt(t)} / ${fmt(total)}`;
    if (!seeking) seek.value = String(Math.floor(t));
    seek.max = String(Math.max(1, Math.floor(total)));
    seek.setAttribute("aria-valuetext", `${fmt(t)} of ${fmt(total)}`);
    const playing = !el.paused && !el.ended;
    playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
    playBtn.replaceChildren(playing ? icon("pause") : icon("play"));
    rate.textContent = `${SPEEDS[speed]}×`;
    rate.setAttribute("aria-label", `Speed ${SPEEDS[speed]} times`);
  }

  const jump = (d) => {
    const total = isFinite(el.duration) ? el.duration : length;
    el.currentTime = Math.min(Math.max(0, (el.currentTime || 0) + d), total || Infinity);
    paint();
  };

  playBtn.addEventListener("click", () => (el.paused ? el.play() : el.pause()));
  back.addEventListener("click", () => jump(-15));
  fwd.addEventListener("click", () => jump(15));
  rate.addEventListener("click", () => {
    speed = (speed + 1) % SPEEDS.length;
    el.playbackRate = SPEEDS[speed];
    paint();
  });
  seek.addEventListener("input", () => { seeking = true; el.currentTime = +seek.value; paint(); });
  seek.addEventListener("change", () => { seeking = false; });
  ["play", "pause", "ended", "timeupdate", "loadedmetadata", "ratechange"].forEach((e) => el.addEventListener(e, paint));
  el.addEventListener("loadedmetadata", () => { if (isFinite(el.duration)) length = el.duration; });

  paint();
  return h("div", { class: "player" },
    el,
    h("div", { class: "player-top" },
      playBtn,
      h("span", { class: "player-title" }, h("b", {}, "Audio overview"), h("span", {}, title))),
    h("div", { class: "wave-wrap" }, h("div", { class: "wave", "aria-hidden": "true" }, bars), seek),
    h("div", { class: "player-foot" },
      time,
      h("span", { class: "player-btns" }, back, fwd, rate)));
}
