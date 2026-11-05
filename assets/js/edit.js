// Teacher edit mode. Only loaded when the teacher opens it (the Edit button, ?edit or Ctrl+Shift+E).
// Saves go to the teacher's repository through the GitHub API, into site/, and the publish
// workflow then copies site/ to the public site. The repository, the image-notes path and the
// token are typed in once and kept only in this browser; none of them is in this code.

import { h, icon, fill } from "./dom.js";
import * as store from "./store.js";
import { editState } from "./editslot.js";
import { stripAudio, cleanWebp } from "./audiostrip.js";

const BRANCH = "main";
const API = "https://api.github.com";
const KEYS = { token: "editToken", repo: "editRepo", notes: "editNotes" };

let ctx = null, bar = null, phrases = null;
const token = () => store.get(KEYS.token, "");
const repo = () => store.get(KEYS.repo, "");
// Image search phrases: a path template in the repository with {id} for the topic id.
const notesPath = (id) => (store.get(KEYS.notes, "") || "").replace(/\{id\}/g, id);

/* ---------- GitHub ---------- */

// `detail` is GitHub's own explanation, when it gives one.
class GhError extends Error {
  constructor(status, detail) { super(`GitHub ${status}`); this.status = status; this.detail = detail || ""; }
}

async function gh(path, { method = "GET", body, raw } = {}) {
  let res;
  try {
    res = await fetch(`${API}/repos/${repo()}${path}`, {
      method,
      headers: {
        Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
        Authorization: `Bearer ${token()}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    });
  } catch {
    throw new Error("The save didn't reach GitHub: the connection dropped or was blocked. Try again on a faster or unfiltered connection.");
  }
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).message || ""; } catch { /* no explanation */ }
    throw new GhError(res.status, detail);
  }
  return raw ? res.text() : res.json();
}

const readText = (path) => gh(`/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${BRANCH}`, { raw: true });

// One commit for several files: [{ path, text } | { path, base64 } | { path, remove: true }]
async function commit(files, message) {
  const ref = await gh(`/git/ref/heads/${BRANCH}`);
  const parent = ref.object.sha;
  const base = await gh(`/git/commits/${parent}`);
  const tree = [];
  for (const f of files) {
    if (f.remove) { tree.push({ path: f.path, mode: "100644", type: "blob", sha: null }); continue; }
    const blob = await gh("/git/blobs", { method: "POST",
      body: f.text != null ? { content: f.text, encoding: "utf-8" } : { content: f.base64, encoding: "base64" } });
    tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  const newTree = await gh("/git/trees", { method: "POST", body: { base_tree: base.tree.sha, tree } });
  const c = await gh("/git/commits", { method: "POST", body: { message, tree: newTree.sha, parents: [parent] } });
  await gh(`/git/refs/heads/${BRANCH}`, { method: "PATCH", body: { sha: c.sha } });
}

function problem(err) {
  const s = err && err.status;
  const said = err?.detail ? ` GitHub said: "${err.detail}" (${s}).` : "";
  if (s === 401) return "GitHub refused the token. Check it, or make a new one." + said;
  if (s === 403) return "This token can't write here. It needs Contents: Read and write on the repository." + said;
  if (s === 404) return "This token can't see that repository. Check the name and the token's repository access." + said;
  if (s === 409 || (s === 422 && /fast.forward|reference/i.test(err.detail))) return "Something else was saved at the same moment. Try again.";
  if (err instanceof GhError) return (said ? said.trim() : `GitHub said no (${s}).`) + " Try again in a minute.";
  return err?.message || "Something went wrong. Check your connection and try again.";
}

function toBase64(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const topicPath = () => `site/content/topics/${ctx.level}/${ctx.topic().id}.json`;
const stringifyTopic = (t) => JSON.stringify(t, null, 2) + "\n";

// Same layout as the file in the repository: one line per topic.
export function formatCourses(c) {
  let s = JSON.stringify(c, null, 2);
  s = s.replace(/\{\n\s+"id": "[^"]+",[\s\S]*?\n\s+\}(?=,?\n)/g, (blk) =>
    blk.includes('"code"') || blk.includes('"pages"') ? blk.replace(/\n\s+/g, " ") : blk);
  s = s.replace(/\[\n\s+("[^"\n]+",?\n\s+)*"[^"\n]+"\n\s+\]/g, (blk) => blk.replace(/\n\s+/g, " "));
  s = s.replace(/\{\n\s+"ref": [^}]+\}/g, (blk) => blk.replace(/\n\s+/g, " "));
  s = s.replace(/"comingUp": \{\n\s+([^}]+)\n\s+\}/g, (_, x) => `"comingUp": { ${x.replace(/\n\s+/g, " ")} }`);
  return s.replace(/\[ "/g, '["').replace(/" \]/g, '"]') + "\n";
}

/* ---------- Dialogs ---------- */

function dialog(title, ...body) {
  const close = h("button", { type: "button", class: "dlg-close", "aria-label": "Close" }, icon("cross"));
  const dlg = h("dialog", { class: "edit-dlg", "aria-labelledby": "dlg-title" },
    h("div", { class: "dlg-head" }, h("h2", { id: "dlg-title" }, title), close),
    h("div", { class: "dlg-body" }, body));
  close.addEventListener("click", () => dlg.close());
  dlg.addEventListener("close", () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}

const status = () => h("p", { class: "dlg-status", "aria-live": "polite" });
function say(el, text, tone) {
  el.textContent = text;
  el.className = "dlg-status" + (tone ? ` ${tone}` : "");
}
const field = (label, input, note) => h("label", { class: "dlg-field" }, h("span", {}, label), input, note && h("small", {}, note));

function needToken() {
  if (token() && repo()) return false;
  tokenDialog();
  return true;
}

/* ---------- Token ---------- */

function tokenDialog() {
  const repoIn = h("input", { type: "text", autocomplete: "off", spellcheck: "false", placeholder: "owner/repository", value: repo() });
  const notesIn = h("input", { type: "text", autocomplete: "off", spellcheck: "false", placeholder: "folder/{id}/file.md", value: store.get(KEYS.notes, "") });
  const tokenIn = h("input", { type: "password", autocomplete: "off", spellcheck: "false", placeholder: "github_pat_…" });
  const msg = status();
  const save = h("button", { type: "button", class: "btn-dark" }, "Save");
  const dlg = dialog("Edit mode settings",
    field("Repository", repoIn, "The repository edit mode saves to, as owner/name."),
    field("Image notes path (optional)", notesIn, "Where each topic's image search phrases are, with {id} for the topic id."),
    field("GitHub fine-grained token", tokenIn, "Access to that repository only, with Contents: Read and write."),
    h("p", { class: "dlg-note" }, "All three are kept in this browser only. Forget token clears them."),
    h("div", { class: "btn-row" }, save), msg);
  save.addEventListener("click", async () => {
    const r = repoIn.value.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$|\/$/g, "");
    const n = notesIn.value.trim();
    const t = tokenIn.value.trim() || token();
    if (!/^[\w.-]+\/[\w.-]+$/.test(r)) return say(msg, "Type the repository as owner/name.", "bad");
    if (n && !n.includes("{id}")) return say(msg, "Put {id} in the notes path where the topic id goes.", "bad");
    if (!t) return say(msg, "Paste the token.", "bad");
    const old = { token: token(), repo: repo(), notes: store.get(KEYS.notes, "") };
    store.set(KEYS.repo, r);
    store.set(KEYS.notes, n);
    store.set(KEYS.token, t);
    say(msg, "Checking…");
    try {
      await gh("");
      say(msg, "Connected.", "good");
      phrases = null;
      drawBar();
      setTimeout(() => dlg.close(), 700);
    } catch (e) {
      Object.entries(old).forEach(([k, v]) => (v ? store.set(KEYS[k], v) : store.remove(KEYS[k])));
      say(msg, problem(e), "bad");
    }
  });
  (repo() ? tokenIn : repoIn).focus();
}

function forgetToken() {
  Object.values(KEYS).forEach((k) => store.remove(k));
  phrases = null;
  drawBar();
}

/* ---------- Image search phrases ---------- */

// Notes lines: "- Term: search phrase" or "| Term | search phrase |"
export function parsePhrases(md) {
  const out = new Map();
  for (const line of md.split(/\r?\n/)) {
    const m = line.match(/^\s*[-*]\s+(.+?):\s+(.+)$/) || line.match(/^\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
    if (m && !/^-+$/.test(m[1]) && m[1].toLowerCase() !== "item") out.set(m[1].trim().toLowerCase(), m[2].trim());
  }
  return out;
}

async function phraseFor(name, fallback) {
  if (phrases === null) {
    const path = notesPath(ctx.topic().id);
    try { phrases = path ? parsePhrases(await readText(path)) : new Map(); } catch { phrases = new Map(); }
  }
  return phrases.get(name.toLowerCase()) || fallback;
}

const SEARCHES = [
  ["Openverse", (q) => `https://openverse.org/search/image?q=${encodeURIComponent(q)}`],
  ["Wikimedia Commons", (q) => `https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(q)}&title=Special:MediaSearch&type=image`],
  ["Unsplash", (q) => `https://unsplash.com/s/photos/${encodeURIComponent(q.trim().replace(/\s+/g, "-"))}`],
  ["Pexels", (q) => `https://www.pexels.com/search/${encodeURIComponent(q)}/`]
];

export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* ---------- Images ---------- */

const MAX = 1200;

async function toWebp(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), hgt = Math.round(bmp.height * scale);
  const canvas = Object.assign(document.createElement("canvas"), { width: w, height: hgt });
  canvas.getContext("2d").drawImage(bmp, 0, 0, w, hgt);
  bmp.close?.();
  // Drawing to a canvas and re-encoding keeps the pixels only: no camera data, no metadata.
  const raw = await new Promise((r) => canvas.toBlob(r, "image/webp", 0.85));
  if (!raw || raw.type !== "image/webp") throw new Error("This browser can't make WebP images. Use Chrome or Edge.");
  // Browsers add a colour profile; keep the image data only.
  const blob = new Blob([cleanWebp(await raw.arrayBuffer())], { type: "image/webp" });
  return { blob, width: w, height: hgt };
}

function findTarget(t, ref) {
  const chunk = t.chunks.find((c) => c.id === ref.chunk);
  if (!chunk) return null;
  if (ref.kind === "diagram") return chunk.diagram ? { chunk, obj: chunk.diagram, name: chunk.diagram.title || chunk.label } : null;
  const item = chunk.items.find((it) => it.term === ref.term);
  return item ? { chunk, obj: item, name: item.term } : null;
}

// What an item or diagram shows on the site now: { file, alt, credit }, or null.
function currentImage(obj, isDiagram) {
  if (isDiagram) return obj.image ? { file: obj.image, alt: obj.alt, credit: obj.credit } : null;
  return obj.image || null;
}

// A remove button that has to be pressed twice, so one slip can't delete anything.
function removeButton(label, run) {
  const b = h("button", { type: "button", class: "btn-line danger" }, label);
  let armed = null;
  b.addEventListener("click", () => {
    if (!armed) {
      b.textContent = "Press again to remove";
      armed = setTimeout(() => { armed = null; b.textContent = label; }, 4000);
      return;
    }
    clearTimeout(armed);
    armed = null;
    b.textContent = label;
    run();
  });
  return b;
}

const nowShowing = (...body) => h("div", { class: "dlg-preview dlg-current" },
  h("span", { class: "dlg-current-label" }, "On the site now"), body);

// Reads the saved topic file, lets `change` edit it (it may return extra files, such as a
// removal), and commits that with `files` as one save. Returns true when saved.
async function saveTopic(msg, change, files, message, note = "Saving…") {
  say(msg, note);
  try {
    const t = JSON.parse(await readText(topicPath()));
    const extra = change(t) || [];
    await commit([...files, ...extra, { path: topicPath(), text: stringifyTopic(t) }], message);
    say(msg, "Saved. Live in about a minute.", "good");
    return true;
  } catch (e) {
    say(msg, problem(e), "bad");
    return false;
  }
}

const gone = (what) => new Error(`There's no saved ${what} here any more. Reload the page.`);

async function imageDialog(ref) {
  if (needToken()) return;
  const target = findTarget(ctx.topic(), ref);
  if (!target) return;
  const isDiagram = ref.kind === "diagram";
  const name = target.name;
  const { id } = ctx.topic();
  const now = currentImage(target.obj, isDiagram);
  const phraseInput = h("input", { type: "text", value: isDiagram ? `${name} line drawing white background` : `${name} on a white background` });
  phraseFor(name, phraseInput.value).then((p) => { phraseInput.value = p; drawLinks(); });
  const links = h("p", { class: "dlg-links" });
  const drawLinks = () => fill(links, SEARCHES.map(([label, url], i) => [i ? " · " : "",
    h("a", { href: url(phraseInput.value), target: "_blank", rel: "noopener noreferrer" }, label)]));
  phraseInput.addEventListener("input", drawLinks);
  drawLinks();
  const copy = h("button", { type: "button", class: "btn-line" }, "Copy");
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(phraseInput.value); copy.textContent = "Copied"; } catch { phraseInput.select(); }
  });

  const fileInput = h("input", { type: "file", accept: "image/*", class: "sr-only", id: "img-file" });
  const drop = h("div", { class: "dropzone", tabindex: "0" },
    icon("image"), h("span", {}, now ? "Drop or paste a new image here" : "Drop or paste an image here"),
    h("label", { class: "btn-line", for: "img-file" }, "Choose file"), fileInput);
  const preview = h("div", { class: "dlg-preview" });
  const alt = h("input", { type: "text", value: now?.alt || target.obj.alt || name });
  const credit = h("input", { type: "text", value: now?.credit || "", placeholder: "e.g. Jane Smith · CC BY 4.0" });
  // Items only: a short teacher-written caption shown under the image (never used for questions,
  // prints or audio). Saved with the image; an empty box removes it.
  const caption = !isDiagram && h("textarea", { rows: 3 }, target.obj.caption || "");
  const msg = status();
  let ready = null;
  const save = h("button", { type: "button", class: "btn-dark", disabled: true }, now ? "Save new image" : "Save image");
  const saveDetails = now && h("button", { type: "button", class: "btn-line" }, "Save details");
  const remove = now && !isDiagram && removeButton("Remove image", removeImage);
  const buttons = [save, saveDetails, remove].filter(Boolean);
  const busy = (on) => buttons.forEach((b) => { b.disabled = on || (b === save && !ready); });

  async function take(file) {
    if (!file || !file.type.startsWith("image/")) return say(msg, "That isn't an image file.", "bad");
    say(msg, "Preparing…");
    try {
      ready = await toWebp(file);
      fill(preview, h("img", { src: URL.createObjectURL(ready.blob), alt: "" }),
        h("small", {}, `${ready.width} × ${ready.height} · ${Math.round(ready.blob.size / 1024)} KB · WebP`));
      save.disabled = false;
      say(msg, "");
    } catch (e) { ready = null; say(msg, problem(e), "bad"); }
  }
  fileInput.addEventListener("change", () => take(fileInput.files[0]));
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); take(e.dataTransfer.files[0]); });
  const onPaste = (e) => {
    const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith("image/"));
    if (f) { e.preventDefault(); take(f); }
  };

  const dlg = dialog(isDiagram ? `Diagram: ${name}` : `Image: ${name}`,
    now && nowShowing(h("img", { src: now.file, alt: "" }), h("small", {}, now.credit || "No credit")),
    field("Search phrase", h("span", { class: "dlg-inline" }, phraseInput, copy)),
    links, drop, preview,
    field("Alt text", alt),
    field("Credit (author · licence)", credit),
    caption && field("Caption (optional)", caption),
    isDiagram && h("p", { class: "dlg-note" }, "The part positions stay as they are, so check them after a new drawing."
      + (now ? " A diagram needs a drawing, so it can be replaced but not removed." : "")),
    h("div", { class: "btn-row" }, buttons), msg);
  document.addEventListener("paste", onPaste);
  dlg.addEventListener("close", () => document.removeEventListener("paste", onPaste));

  // Saves a change to this item or diagram, then shows it on this page and closes.
  async function run(edit, files, message, local) {
    busy(true);
    const ok = await saveTopic(msg, (t) => {
      const tgt = findTarget(t, ref);
      if (!tgt) throw new Error("That item isn't in the saved topic file any more. Reload the page.");
      return edit(tgt.obj, t);
    }, files, message);
    busy(false);
    if (!ok) return;
    local(target.obj);
    ctx.rerender();
    setTimeout(() => dlg.close(), 1500);
  }

  const details = () => ({ alt: alt.value.trim(), credit: credit.value.trim() });
  const setCaption = (o) => {
    if (isDiagram) return;
    const c = caption.value.replace(/\s+/g, " ").trim();
    if (c) o.caption = c; else delete o.caption;
  };
  const needCredit = () => {
    if (credit.value.trim()) return false;
    say(msg, "Add a credit line: who made it, and the licence.", "bad");
    credit.focus();
    return true;
  };

  save.addEventListener("click", async () => {
    if (!ready || needCredit()) return;
    const file = `assets/img/${ctx.level}/${id}/${slug(name)}.webp`;
    const put = (o, f) => {
      if (isDiagram) { Object.assign(o, { image: f, ...details(), width: ready.width, height: ready.height }); delete o.svg; }
      else { o.image = { file: f, ...details() }; setCaption(o); }
    };
    const base64 = toBase64(await ready.blob.arrayBuffer());
    // This page shows the new image straight away; the public copy follows after publishing.
    const local = URL.createObjectURL(ready.blob);
    run((o) => { put(o, file); }, [{ path: `site/${file}`, base64 }], `Image: ${name} (${id})`, (o) => put(o, local));
  });

  saveDetails?.addEventListener("click", () => {
    if (needCredit()) return;
    const set = (o) => { Object.assign(isDiagram ? o : o.image, details()); setCaption(o); };
    run((o) => { if (!o.image) throw gone("image"); set(o); }, [], `Image details: ${name} (${id})`, set);
  });

  function removeImage() {
    run((o, t) => {
      const f = o.image?.file;
      if (!f) throw gone("image");
      delete o.image;
      delete o.caption;   // the caption belongs to the image
      // The file stays if another item or diagram in the topic still uses it.
      const used = t.chunks.some((c) => c.diagram?.image === f || c.items.some((it) => it.image?.file === f));
      return used ? [] : [{ path: `site/${f}`, remove: true }];
    }, [], `Remove image: ${name} (${id})`, (o) => { delete o.image; delete o.caption; });
  }
}

/* ---------- Audio ---------- */

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const mb = (n) => Math.round(n / 1024 / 102.4) / 10;
function parseLength(v) {
  const m = String(v).trim().match(/^(\d+):([0-5]?\d)$/);
  if (m) return +m[1] * 60 + +m[2];
  return /^\d+$/.test(String(v).trim()) ? +v : NaN;
}

function audioDialog() {
  if (needToken()) return;
  const t = ctx.topic();
  const now = t.audio;
  const fileInput = h("input", { type: "file", accept: ".mp3,.m4a,audio/mpeg,audio/mp4,audio/x-m4a" });
  const info = h("p", { class: "dlg-note" });
  const length = h("input", { type: "text", inputmode: "numeric", placeholder: "m:ss", value: now?.length ? mmss(now.length) : "" });
  const msg = status();
  let ready = null;
  const save = h("button", { type: "button", class: "btn-dark", disabled: true }, now ? "Save new audio" : "Save audio");
  const saveLength = now && h("button", { type: "button", class: "btn-line" }, "Save length");
  const remove = now && removeButton("Remove audio", removeAudio);
  const buttons = [save, saveLength, remove].filter(Boolean);
  const busy = (on) => buttons.forEach((b) => { b.disabled = on || (b === save && !ready); });

  // What is on the site now, with the file's size from the server.
  let current = null;
  if (now) {
    const size = h("span", {});
    const saved = !now.file.startsWith("blob:");
    current = nowShowing(h("small", {}, saved ? now.file.split("/").pop() : "Saved just now", ` · ${mmss(now.length)}`, size));
    if (saved) {
      fetch(now.file, { method: "HEAD", cache: "no-store" })
        .then((r) => { const n = +r.headers.get("content-length"); if (n) size.textContent = ` · ${mb(n)} MB`; })
        .catch(() => { /* the size is only a convenience */ });
    }
  }

  fileInput.addEventListener("change", async () => {
    const f = fileInput.files[0];
    ready = null;
    save.disabled = true;
    if (!f) return;
    try {
      const out = stripAudio(await f.arrayBuffer());
      const ext = out.kind === "mp3" ? "mp3" : "m4a";
      const blob = new Blob([out.bytes], { type: ext === "mp3" ? "audio/mpeg" : "audio/mp4" });
      const url = URL.createObjectURL(blob);
      const probe = new Audio();
      probe.preload = "metadata";
      probe.src = url;
      await new Promise((r) => { probe.onloadedmetadata = r; probe.onerror = r; setTimeout(r, 5000); });
      if (isFinite(probe.duration) && probe.duration > 0) length.value = mmss(probe.duration);
      ready = { bytes: out.bytes, ext, url };
      info.textContent = `${mb(out.bytes.length)} MB ${ext.toUpperCase()} · saved as ${t.id}.${ext} · `
        + (out.removed.length ? `removed: ${[...new Set(out.removed)].join(", ")}` : "no tags found");
      save.disabled = false;
      say(msg, "");
    } catch (e) { say(msg, problem(e), "bad"); }
  });

  const dlg = dialog("Audio overview",
    current,
    field(now ? "New MP3 or M4A file" : "MP3 or M4A file", fileInput),
    info,
    field("Length (m:ss)", length),
    h("div", { class: "btn-row" }, buttons), msg);

  // Saves a change to the topic's audio, then shows it on this page and closes.
  async function run(edit, files, message, local, note) {
    busy(true);
    const ok = await saveTopic(msg, edit, files, message, note);
    busy(false);
    if (!ok) return;
    local();
    ctx.rerender();
    setTimeout(() => dlg.close(), 1500);
  }
  const secs = () => {
    const n = parseLength(length.value);
    if (isFinite(n) && n > 0) return n;
    say(msg, "Check the length, e.g. 6:30.", "bad");
    return null;
  };

  save.addEventListener("click", () => {
    const n = secs();
    if (!ready || !n) return;
    const file = `assets/audio/${ctx.level}/${t.id}.${ready.ext}`;
    run((saved) => {
      const old = saved.audio?.file;
      saved.audio = { file, length: n };
      // A file with the other extension would be left behind.
      return old && old !== file ? [{ path: `site/${old}`, remove: true }] : [];
    }, [{ path: `site/${file}`, base64: toBase64(ready.bytes) }], `Audio: ${t.id}`,
    () => { t.audio = { file: ready.url, length: n }; }, "Saving… large files take a little while.");
  });

  saveLength?.addEventListener("click", () => {
    const n = secs();
    if (!n) return;
    run((saved) => { if (!saved.audio) throw gone("audio"); saved.audio.length = n; }, [], `Audio length: ${t.id}`,
      () => { t.audio.length = n; });
  });

  function removeAudio() {
    run((saved) => {
      const f = saved.audio?.file;
      if (!f) throw gone("audio");
      saved.audio = null;
      return [{ path: `site/${f}`, remove: true }];
    }, [], `Remove audio: ${t.id}`, () => { t.audio = null; });
  }
}

/* ---------- Year groups ---------- */

async function yearsDialog() {
  if (needToken()) return;
  const msg = status();
  const body = h("div", { class: "years" }, h("p", { class: "dlg-note" }, "Loading…"));
  const save = h("button", { type: "button", class: "btn-dark", disabled: true }, "Save year groups");
  dialog("Year groups", body, h("div", { class: "btn-row" }, save), msg);
  let courses;
  try {
    courses = JSON.parse(await readText("site/content/courses.json"));
  } catch (e) { fill(body, h("p", { class: "dlg-status bad" }, problem(e))); return; }

  const forms = Object.entries(courses.years).map(([y, yr]) => {
    const course = courses.levels[yr.level];
    const pick = h("select", {}, h("option", { value: "" }, "— none —"),
      course.topics.map((tp) => h("option", { value: tp.id }, `${tp.code} ${tp.title}`)));
    pick.value = yr.comingUp?.topic || "";
    const day = h("input", { type: "date", value: yr.comingUp?.day || "" });
    const taught = new Set(yr.taught);
    const count = h("span", {});
    const boxes = course.topics.map((tp) => {
      const cb = h("input", { type: "checkbox", value: tp.id });
      cb.checked = taught.has(tp.id);
      cb.addEventListener("change", () => { cb.checked ? taught.add(tp.id) : taught.delete(tp.id); count.textContent = `(${taught.size})`; });
      return h("label", { class: "year-topic" }, cb, h("span", {}, `${tp.code} ${tp.title}`));
    });
    count.textContent = `(${taught.size})`;
    const el = h("fieldset", { class: "year" },
      h("legend", {}, `${yr.name} · ${course.short}`),
      h("div", { class: "year-row" }, field("Coming up", pick), field("Lesson day", day)),
      h("details", {}, h("summary", {}, "Taught ", count), h("div", { class: "year-topics" }, boxes)));
    return { y, el, read: () => ({
      taught: course.topics.map((tp) => tp.id).filter((tid) => taught.has(tid)),
      comingUp: pick.value ? { topic: pick.value, day: day.value || null } : null
    }) };
  });
  fill(body, forms.map((f) => f.el));
  save.disabled = false;

  save.addEventListener("click", async () => {
    save.disabled = true;
    say(msg, "Saving…");
    try {
      const fresh = JSON.parse(await readText("site/content/courses.json"));
      forms.forEach((f) => Object.assign(fresh.years[f.y], f.read()));
      await commit([{ path: "site/content/courses.json", text: formatCourses(fresh) }], "Year groups update");
      say(msg, "Saved. Live in about a minute.", "good");
      ctx?.savedCourses?.(fresh);
    } catch (e) { say(msg, problem(e), "bad"); }
    save.disabled = false;
  });
}

/* ---------- Edit bar ---------- */

function drawBar() {
  if (!bar) return;
  const has = !!(token() && repo());
  fill(bar,
    h("span", { class: "edit-label" }, icon("pen"), "Edit mode"),
    h("span", { class: "edit-state" + (has ? " on" : "") }, has ? "Token saved in this browser" : "No token: nothing can be saved"),
    h("span", { class: "edit-btns" },
      has
        ? h("button", { type: "button", class: "btn-line", onclick: forgetToken }, "Forget token")
        : h("button", { type: "button", class: "btn-dark", onclick: tokenDialog }, "Add token"),
      ctx?.topic && h("button", { type: "button", class: "btn-line", onclick: audioDialog }, "Audio"),
      h("button", { type: "button", class: "btn-line", onclick: yearsDialog }, "Year groups"),
      h("button", { type: "button", class: "btn-line", onclick: stop }, "Exit")));
}

export function start(context) {
  ctx = context;
  if (!document.getElementById("edit-css")) {
    document.head.append(h("link", { rel: "stylesheet", href: "assets/css/edit.css", id: "edit-css" }));
  }
  editState.on = true;
  editState.open = imageDialog;
  bar = h("div", { class: "edit-bar", role: "region", "aria-label": "Edit mode" });
  document.getElementById("topbar").after(bar);
  drawBar();
  ctx.rerender();
}

export function stop() {
  editState.on = false;
  bar?.remove();
  bar = null;
  ctx?.rerender();
}

export const isOn = () => editState.on;
