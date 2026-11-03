// Loads courses.json and topic JSON files (same site only), and works out where each
// year group is.

let courses;
const topics = new Map();

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

export function loadCourses() {
  courses ||= fetchJSON("content/courses.json");
  return courses;
}

// Edit mode hands back the courses.json it has just saved, so the page can redraw at once.
export function setCourses(c) {
  courses = Promise.resolve(c);
}

// Finds a topic by id in either level. Returns { level, course, entry } or null.
export async function findTopic(id) {
  if (!/^[a-z0-9-]+$/.test(id || "")) return null;
  const c = await loadCourses();
  for (const [level, course] of Object.entries(c.levels)) {
    const entry = course.topics.find((t) => t.id === id) || (course.reference || []).find((t) => t.id === id);
    if (entry) return { level, course, entry };
  }
  return null;
}

export function loadTopic(level, id) {
  const key = `${level}/${id}`;
  if (!topics.has(key)) topics.set(key, fetchJSON(`content/topics/${key}.json`));
  return topics.get(key);
}

// Loads several built topics; one that fails to load is left out. Returns Map id → topic.
export async function loadTopics(level, ids) {
  const out = new Map();
  await Promise.all(ids.map(async (id) => {
    try { out.set(id, await loadTopic(level, id)); } catch { /* left out */ }
  }));
  return out;
}

/* ---------- Year groups ---------- */

export const YEAR_IDS = ["y10", "y11", "y12", "y13"];
export const yearShort = (y) => y.toUpperCase();

// "taught", "taught-soon" (taught, page not built yet), "coming" or "not".
export function statusFor(year, entry) {
  if (year.taught.includes(entry.id)) return entry.built ? "taught" : "taught-soon";
  if (year.comingUp?.topic === entry.id) return "coming";
  return "not";
}

export const STATUS_TEXT = {
  taught: "Taught",
  "taught-soon": "Taught · page coming soon",
  coming: "Coming up",
  not: "Not yet"
};

// "2026-11-04" → "Wednesday 4 Nov"
export function formatDay(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
}

// Link to a topic page, carrying the year the pupil came from.
export function topicHref(id, y, hash = "") {
  return `topic.html?id=${encodeURIComponent(id)}` + (y ? `&y=${y}` : "") + hash;
}

// "6:12" from whole seconds.
export const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
