// "Coming up" card for one year group (home page and year page): topic, lesson day,
// and Read (book pages) / Listen (audio) for before the lesson.

import { h, icon } from "../dom.js";
import { formatDay, topicHref, mmss, yearShort } from "../data.js";

// y: year id. year: courses.years[y]. course: courses.levels[year.level].
// topic: the loaded topic JSON when the page is built, else null.
export function comingUpCard({ y, year, course, topic, headingLevel = "h2" }) {
  const entry = year.comingUp && course.topics.find((t) => t.id === year.comingUp.topic);
  const day = formatDay(year.comingUp?.day);
  const head = h("div", { class: "coming-head" },
    h("span", { class: "label coming-kicker" }, `Coming up · ${yearShort(y)}`),
    day && h("span", { class: "day" }, day));

  if (!entry) {
    return h("section", { class: `card coming-card ${year.level}` }, head,
      h(headingLevel, { class: "coming-title none" }, "Not set yet"));
  }

  const href = entry.built ? topicHref(entry.id, y) : null;
  const readInner = [icon("book"), h("span", { class: "tile-text" },
    h("b", {}, "Read ", h("span", { class: "nowrap" }, `p${entry.pages}`)), h("span", {}, course.book))];
  const read = href ? h("a", { class: "tile read", href }, readInner) : h("div", { class: "tile read" }, readInner);
  const audio = topic?.audio;
  const listen = audio && h("a", { class: "tile listen", href: topicHref(entry.id, y, "#listen") },
    h("span", { class: "tile-play", "aria-hidden": "true" }, icon("play")),
    h("span", { class: "tile-text" }, h("b", {}, "Listen"), audio.length ? h("span", {}, mmss(audio.length)) : null));

  return h("section", { class: `card coming-card ${year.level}` },
    head,
    h(headingLevel, { class: "coming-title" }, href ? h("a", { href }, entry.title) : entry.title),
    h("span", { class: "coming-spec" }, `${entry.code} · ${entry.spec.join(" · ")}`),
    h("div", { class: "coming-pre" },
      h("span", { class: "label" }, listen ? "Before the lesson · pick one" : "Before the lesson"),
      h("div", { class: "tiles" + (listen ? " two" : "") }, read, listen)));
}
