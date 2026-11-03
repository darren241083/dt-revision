// Removes embedded metadata from MP3 and M4A audio before it is published (teacher edit mode).
// MP3: ID3v2 tags at the start, APEv2 and ID3v1 / Enhanced tags at the end.
// M4A: every udta, meta and uuid box is turned into a zero-filled "free" box of the same size,
//      so the sound data and its offsets are untouched but no tag text is left.
// Returns { bytes: Uint8Array, kind: "mp3" | "m4a", removed: [descriptions] }.

const ascii = (b, i, n) => String.fromCharCode(...b.subarray(i, i + n));
const u32 = (b, i) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];

export function detectKind(bytes) {
  if (bytes.length > 12 && ascii(bytes, 4, 4) === "ftyp") return "m4a";
  if (ascii(bytes, 0, 3) === "ID3") return "mp3";
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "mp3";
  return null;
}

export function stripAudio(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const kind = detectKind(bytes);
  if (kind === "mp3") return { kind, ...stripMp3(bytes) };
  if (kind === "m4a") return { kind, ...stripM4a(bytes) };
  throw new Error("This doesn't look like an MP3 or M4A file.");
}

function stripMp3(b) {
  const removed = [];
  let start = 0, end = b.length;
  // ID3v2 (there can be more than one in a row)
  while (end - start > 10 && ascii(b, start, 3) === "ID3") {
    const size = ((b[start + 6] & 0x7f) << 21) | ((b[start + 7] & 0x7f) << 14) | ((b[start + 8] & 0x7f) << 7) | (b[start + 9] & 0x7f);
    const footer = b[start + 5] & 0x10 ? 10 : 0;
    start += 10 + size + footer;
    removed.push("ID3v2 tag");
  }
  // Tags at the end, in any order: ID3v1 ("TAG", 128 bytes), Enhanced ("TAG+", 227 bytes), APEv2.
  for (let again = true; again;) {
    again = false;
    if (end - start >= 128 && ascii(b, end - 128, 3) === "TAG") {
      end -= 128; removed.push("ID3v1 tag"); again = true;
      if (end - start >= 227 && ascii(b, end - 227, 4) === "TAG+") { end -= 227; removed.push("Enhanced tag"); }
    }
    if (end - start >= 32 && ascii(b, end - 32, 8) === "APETAGEX") {
      const size = b[end - 20] | (b[end - 19] << 8) | (b[end - 18] << 16) | (b[end - 17] << 24);
      const header = b[end - 9] & 0x80 ? 32 : 0;   // flags byte 3, bit 31: tag has a header
      end -= size + header; removed.push("APE tag"); again = true;
    }
  }
  return { bytes: b.slice(start, end), removed };
}

const BLANK = new Set(["udta", "meta", "uuid"]);
const PARENTS = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts", "dinf", "moof", "traf", "mvex"]);

function stripM4a(input) {
  const b = input.slice();
  const removed = [];
  const blank = (at, size, type) => {
    b.set([0, 0, 0, 0].map((_, k) => (size >>> (24 - 8 * k)) & 0xff), at);
    b.set([0x66, 0x72, 0x65, 0x65], at + 4); // "free"
    b.fill(0, at + 8, at + size);
    removed.push(`${type} box`);
  };
  function walk(from, to) {
    let i = from;
    while (i + 8 <= to) {
      let size = u32(b, i);
      const type = ascii(b, i + 4, 4);
      let head = 8;
      if (size === 1) { size = Number((BigInt(u32(b, i + 8)) << 32n) + BigInt(u32(b, i + 12))); head = 16; }
      else if (size === 0) size = to - i;
      if (size < head || i + size > to) break;
      if (BLANK.has(type) && size <= 0xffffffff) blank(i, size, type);
      else if (PARENTS.has(type)) walk(i + head, i + size);
      i += size;
    }
  }
  walk(0, b.length);
  return { bytes: b, removed };
}

// WebP: keep only the image data chunks (VP8 / VP8L, plus ALPH / ANIM / ANMF if present); drop
// ICCP, EXIF and XMP. A plain single-chunk image is written back in the simple format.
export function cleanWebp(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") throw new Error("Not a WebP image.");
  const keep = [];
  let vp8x = null;
  for (let i = 12; i + 8 <= b.length;) {
    const id = ascii(b, i, 4);
    const size = b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24);
    const chunk = b.subarray(i, i + 8 + size + (size & 1));
    if (id === "VP8X") vp8x = chunk.slice();
    else if (["VP8 ", "VP8L", "ALPH", "ANIM", "ANMF"].includes(id)) keep.push(chunk);
    i += 8 + size + (size & 1);
  }
  const simple = keep.length === 1 && ["VP8 ", "VP8L"].includes(ascii(keep[0], 0, 4));
  if (!simple && vp8x) vp8x[8] &= ~(0x20 | 0x08 | 0x04);   // clear ICC, EXIF and XMP flags
  const parts = simple || !vp8x ? keep : [vp8x, ...keep];
  const body = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(12 + body);
  out.set([0x52, 0x49, 0x46, 0x46], 0);
  const riff = 4 + body;
  out.set([riff & 255, (riff >> 8) & 255, (riff >> 16) & 255, (riff >>> 24) & 255], 4);
  out.set([0x57, 0x45, 0x42, 0x50], 8);
  let at = 12;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
