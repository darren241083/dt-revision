// Home page card for one year group: a topic dropdown that opens on the year's lesson
// topic, then the shown topic's title and meta line, a pre-read panel (book pages as text and
// an in-card Listen player) and a full-width "Open topic" button (Revise too once taught).
// The dropdown choice is never remembered: every visit opens on the lesson topic.
// Only one card plays audio at a time; changing a card's topic stops its audio.

import { h, icon, fill } from "../dom.js";
import { statusFor, topicHref, mmss, yearShort } from "../data.js";

const STATUS = {
  coming: ["lesson", "This lesson"],
  taught: ["taught", "Taught"],
  "taught-soon": ["taught", "Taught"],
  not: ["not", "Not taught yet"]
};
const OPTION_NOTE = { coming: " · this lesson", taught: " · taught", "taught-soon": " · taught" };
// Built topics start with a dot; a key beside the label explains it.
const BUILT_MARK = "●";

// The card whose audio is playing (or paused mid-way), so starting another can stop it.
let playing = null;
// Stops any card audio (the home page calls this before it redraws the cards).
export function stopCardAudio() { playing?.stop(); playing = null; }

// y: year id. year: courses.years[y]. course: courses.levels[year.level].
// topics: Map id → loaded topic JSON (built topics only).
export function yearCard({ y, year, course, topics }) {
  const list = course.topics;
  const lessonId = list.some((t) => t.id === year.comingUp?.topic) ? year.comingUp.topic : null;
  const start = lessonId || (list.find((t) => !year.taught.includes(t.id)) || list[0])?.id;

  const selId = `yc-${y}-topic`, keyId = `yc-${y}-key`;
  const status = h("span", { class: "ycard-status", "aria-live": "polite" });
  const select = h("select", { id: selId, class: "ycard-select", "aria-describedby": keyId },
    course.sections.map((sec) => {
      const inSec = list.filter((t) => t.section === sec.ref);
      return inSec.length && h("optgroup", { label: `${sec.ref} · ${sec.name}` },
        inSec.map((t) => h("option", { value: t.id },
          `${t.built ? `${BUILT_MARK} ` : ""}${t.code} ${t.title}${OPTION_NOTE[statusFor(year, t)] || ""}`)));
    }));
  const title = h("h3", { class: "ycard-title" });
  const meta = h("span", { class: "ycard-spec" });
  const pre = h("div", { class: "ycard-pre" });
  const foot = h("div", { class: "ycard-foot" });
  let player = null;                     // the shown topic's player, made on first Listen

  function show(id) {
    const t = list.find((x) => x.id === id);
    if (!t) return;
    player?.stop();
    player = null;
    select.value = t.id;
    const st = statusFor(year, t);
    const [cls, text] = STATUS[st];
    status.className = `ycard-status ${cls}`;
    status.textContent = text;
    title.textContent = t.title;
    meta.textContent = [t.code, ...t.spec].join(" · ");

    const T = t.built ? topics.get(t.id) : null;
    const audio = T?.audio?.file ? T.audio : null;
    const pages = t.pages;
    pre.hidden = !audio && !pages;
    if (!pre.hidden) {
      const label = pages && audio ? "Pre-read and/or listen before the lesson"
        : pages ? "Pre-read before the lesson" : "Listen before the lesson";
      const row2 = h("div", { class: "ycard-player-slot" });
      const listen = audio && h("button", {
        type: "button", class: "ycard-listen",
        onclick: () => {
          player = cardPlayer(audio, t.title, () => { player = null; listen.hidden = false; fill(row2); });
          listen.hidden = true;
          fill(row2, player.el);
          player.play(true);
        }
      }, icon("play", "ico-fill"), "Listen", h("span", { class: "sr-only" }, ` to ${t.title} audio,`),
        audio.length ? ` ${mmss(audio.length)}` : "");
      fill(pre, h("div", { class: "ycard-pre-in" },
        h("span", { class: "ycard-pre-icon", "aria-hidden": "true" }, icon("book")),
        h("div", { class: "ycard-pre-text" },
          h("span", { class: "ycard-pre-label" }, label),
          pages && h("b", { class: "ycard-pre-pages" }, "Book pages ", h("span", { class: "nowrap" }, pages))),
        listen, row2));
    }

    const back = lessonId && t.id !== lessonId && h("button", {
      type: "button", class: "ycard-back",
      onclick: () => { show(lessonId); select.focus(); }
    }, "Back to this lesson");
    fill(foot,
      t.built
        ? h("a", { class: "ycard-open", href: topicHref(t.id, y), "aria-label": `Open topic: ${t.title}` },
          "Open topic", h("span", { "aria-hidden": "true" }, "→"))
        : h("p", { class: "ycard-soon" }, "Page coming soon"),
      (st === "taught" && t.built || back) && h("div", { class: "ycard-acts" },
        st === "taught" && t.built && h("a", { class: "ycard-btn revise", href: topicHref(t.id, y, "#revise/recall") }, "Revise"),
        back));
  }

  select.addEventListener("change", () => show(select.value));
  if (start) show(start);

  return h("section", { class: `card ycard ${year.level}`, "aria-labelledby": `yc-${y}` },
    h("div", { class: "ycard-head" },
      h("h2", { id: `yc-${y}`, class: "ycard-year" }, h("span", { "aria-hidden": "true" }, yearShort(y)),
        h("span", { class: "sr-only" }, year.name)),
      status),
    h("div", { class: "ycard-pick" },
      h("div", { class: "ycard-pick-head" },
        h("label", { for: selId }, "Choose topic…"),
        h("span", { class: "ycard-key", id: keyId }, `${BUILT_MARK} page ready`)),
      select),
    h("div", { class: "ycard-topic" }, title, meta),
    h("div", { class: "ycard-bottom" }, pre, foot));
}

// Compact in-card player: play/pause, a scrubber (arrow keys move it) and the time.
// `gone` runs when the player is stopped from outside (another card, a topic change).
function cardPlayer(a, topicTitle, gone) {
  const audio = new Audio();
  audio.preload = "none";
  audio.src = a.file;
  const total = () => (Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : a.length || 0);

  const pp = h("button", { type: "button", class: "ycard-pp" });
  const scrub = h("input", { type: "range", class: "ycard-scrub", min: "0", step: "1", value: "0",
    "aria-label": `Position in ${topicTitle} audio` });
  const time = h("span", { class: "ycard-time" });
  const me = {
    el: h("div", { class: "ycard-player", role: "group", "aria-label": `${topicTitle} audio` }, pp, scrub, time),
    play(focus) {
      if (playing && playing !== me) playing.stop();
      playing = me;
      audio.play().catch(() => draw());
      draw();
      if (focus) pp.focus();
    },
    stop() {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      if (playing === me) playing = null;
      gone();
    }
  };

  function draw() {
    const d = total(), c = Math.min(audio.currentTime || 0, d || Infinity);
    const on = !audio.paused && !audio.ended;
    fill(pp, icon(on ? "pause" : "play", "ico-fill"));
    pp.setAttribute("aria-label", on ? "Pause" : "Play");
    scrub.max = String(Math.max(1, Math.round(d)));
    if (!dragging) scrub.value = String(Math.round(c));    // never pull the handle from under a finger
    const pct = d ? (Number(scrub.value) / d) * 100 : 0;
    scrub.style.setProperty("--pct", `${pct}%`);
    scrub.setAttribute("aria-valuetext", `${mmss(Number(scrub.value))} of ${mmss(d)}`);
    time.textContent = `${mmss(Number(scrub.value))} / ${mmss(d)}`;
  }

  let dragging = false;
  pp.addEventListener("click", () => (audio.paused || audio.ended ? me.play() : audio.pause()));
  scrub.addEventListener("pointerdown", () => { dragging = true; });
  scrub.addEventListener("pointerup", () => { dragging = false; });
  scrub.addEventListener("pointercancel", () => { dragging = false; });
  // Arrow keys jump 5 seconds (Home / End and Page Up / Down keep their usual range behaviour).
  scrub.addEventListener("keydown", (e) => {
    const dir = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    scrub.value = String(Math.min(Number(scrub.max), Math.max(0, Number(scrub.value) + dir * 5)));
    scrub.dispatchEvent(new Event("input"));
  });
  scrub.addEventListener("input", () => {
    audio.currentTime = Number(scrub.value);
    draw();
  });
  ["play", "pause", "ended", "timeupdate", "loadedmetadata", "durationchange"].forEach((ev) => audio.addEventListener(ev, draw));
  draw();
  return me;
}
