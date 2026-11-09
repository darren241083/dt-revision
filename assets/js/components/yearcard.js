// Home page card for one year group: a topic dropdown that opens on the year's lesson
// topic, and the shown topic's status, title and actions (Revise / Read / Listen).
// The dropdown choice is never remembered: every visit opens on the lesson topic.

import { h, icon, fill } from "../dom.js";
import { statusFor, topicHref, mmss, yearShort } from "../data.js";

const STATUS = {
  coming: ["lesson", "This lesson"],
  taught: ["taught", "Taught"],
  "taught-soon": ["taught", "Taught"],
  not: ["not", "Not taught yet"]
};
const OPTION_NOTE = { coming: " · this lesson", taught: " · taught", "taught-soon": " · taught" };

// y: year id. year: courses.years[y]. course: courses.levels[year.level].
// topics: Map id → loaded topic JSON (built topics only).
export function yearCard({ y, year, course, topics }) {
  const list = course.topics;
  const lessonId = list.some((t) => t.id === year.comingUp?.topic) ? year.comingUp.topic : null;
  const start = lessonId || (list.find((t) => !year.taught.includes(t.id)) || list[0])?.id;

  const selId = `yc-${y}-topic`;
  const status = h("span", { class: "ycard-status", "aria-live": "polite" });
  const select = h("select", { id: selId, class: "ycard-select" },
    course.sections.map((sec) => {
      const inSec = list.filter((t) => t.section === sec.ref);
      return inSec.length && h("optgroup", { label: `${sec.ref} · ${sec.name}` },
        inSec.map((t) => h("option", { value: t.id }, `${t.code} ${t.title}${OPTION_NOTE[statusFor(year, t)] || ""}`)));
    }));
  const title = h("h3", { class: "ycard-title" });
  const spec = h("span", { class: "ycard-spec" });
  const acts = h("div", { class: "ycard-acts" });

  function show(id) {
    const t = list.find((x) => x.id === id);
    if (!t) return;
    select.value = t.id;
    const st = statusFor(year, t);
    const [cls, text] = STATUS[st];
    status.className = `ycard-status ${cls}`;
    status.textContent = text;
    title.textContent = t.title;
    spec.textContent = [t.code, ...t.spec].join(" · ");

    const T = t.built ? topics.get(t.id) : null;
    const audio = T?.audio;
    const back = lessonId && t.id !== lessonId && h("button", {
      type: "button", class: "ycard-back",
      onclick: () => { show(lessonId); select.focus(); }
    }, "Back to this lesson");
    fill(acts,
      t.built
        ? [st === "taught" && h("a", { class: "ycard-btn revise", href: topicHref(t.id, y, "#revise/recall") }, "Revise"),
          h("a", { class: "ycard-btn read", href: topicHref(t.id, y) }, icon("book"), "Read ", h("span", { class: "nowrap" }, `p${t.pages}`)),
          audio && h("a", { class: "ycard-btn listen", href: topicHref(t.id, y, "#listen") },
            icon("play", "ico-fill"), audio.length ? `Listen ${mmss(audio.length)}` : "Listen")]
        : h("p", { class: "ycard-soon" }, `Page coming soon · read p${t.pages} in the book`),
      back);
  }

  select.addEventListener("change", () => show(select.value));
  if (start) show(start);

  return h("section", { class: `card ycard ${year.level}`, "aria-labelledby": `yc-${y}` },
    h("div", { class: "ycard-head" },
      h("h2", { id: `yc-${y}`, class: "ycard-year" }, h("span", { "aria-hidden": "true" }, yearShort(y)),
        h("span", { class: "sr-only" }, year.name)),
      status),
    h("div", { class: "ycard-pick" },
      h("label", { for: selId }, "Choose topic…"),
      select),
    h("div", { class: "ycard-topic" }, title, spec),
    acts);
}
