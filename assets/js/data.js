// Loads courses.json and topic JSON files (same site only).

let courses;

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

export function loadCourses() {
  courses ||= fetchJSON("content/courses.json");
  return courses;
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
  return fetchJSON(`content/topics/${level}/${id}.json`);
}
