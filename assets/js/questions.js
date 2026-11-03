// Questions made at runtime, on top of each topic's written banks:
//   itemQuestions   multiple choice built from a topic's chunk items (wrong options come from
//                   other items in the same chunk)
//   calcInstance    a "calc" question from its template: new numbers each time, with the
//                   worked method
//   doNowTopUp      extra Do now cards from the quiz banks of earlier topics
// Nothing here is saved.

import { shuffle } from "./dom.js";

const pick = (list, rnd = Math.random) => list[Math.floor(rnd() * list.length)];

/* ---------- From chunk items ---------- */

const MATERIAL = { timber: "timber", polymer: "polymers" };

// Words of a term long enough to give it away if they appear in the text.
const giveaway = (it) => it.term.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4)
  .some((w) => it.text.toLowerCase().includes(w));

function mc(q, right, wrong, why, chunk, item) {
  const options = [right, ...shuffle(wrong).slice(0, 3)];
  return { q, options, answer: 0, why, chunk, item: `${chunk}/${item}` };
}

// Every question the items allow, each with fresh wrong options. Items with steps and items
// marked "autoQuiz": false are left out; a question needs at least 2 wrong options.
export function itemQuestions(T) {
  const out = [];
  for (const c of T.chunks || []) {
    const items = c.items.filter((it) => !it.steps?.length && it.autoQuiz !== false);
    if (items.length < 3) continue;
    for (const it of items) {
      const others = items.filter((o) => o !== it);
      out.push(mc(`${c.label}: which describes “${it.term}”${it.term.endsWith("?") ? "" : "?"}`, it.text, others.map((o) => o.text), null, c.id, it.term));
      if (!giveaway(it)) out.push(mc(`${c.label}: which one is this? ${it.text}`, it.term, others.map((o) => o.term), null, c.id, it.term));
    }
    // Material questions (GCSE): the right item has the tag, the wrong ones don't.
    for (const [tag, name] of Object.entries(MATERIAL)) {
      const yes = items.filter((it) => it.tags?.includes(tag));
      const no = items.filter((it) => it.tags?.length && !it.tags.includes(tag));
      if (!yes.length || no.length < 2) continue;
      const it = pick(yes);
      const q = mc(`${c.label}: which of these is used on ${name}?`, it.term, no.map((o) => o.term), "", c.id, it.term);
      const wrong = q.options.slice(1);
      q.why = `${it.term} is used on ${name}; ${wrong.join(", ")} ${wrong.length > 1 ? "are" : "is"} not.`;
      out.push(q);
    }
  }
  return out;
}

// A quiz draw: about a third made from the items, the rest from the written bank.
export function drawQuiz(bank, extra, n) {
  const fromExtra = Math.min(extra.length, Math.max(Math.round(n * 0.3), n - bank.length));
  const fromBank = Math.min(bank.length, n - fromExtra);
  // Never two made-up questions about the same item.
  const seen = new Set(), made = [];
  for (const q of shuffle(extra)) {
    if (made.length >= fromExtra || seen.has(q.item)) continue;
    seen.add(q.item); made.push(q);
  }
  return shuffle([...shuffle(bank).slice(0, fromBank), ...made]);
}

/* ---------- Calc questions ---------- */

// Arithmetic over numbers and named values: + - * / ^ %, brackets, comparisons, && ||, ! and
// the functions below. No other code is run.
const FN = {
  round: (x, dp = 0) => Math.round(x * 10 ** dp) / 10 ** dp,
  floor: Math.floor, ceil: Math.ceil, abs: Math.abs, sqrt: Math.sqrt, min: Math.min, max: Math.max
};
const BIN = {
  "||": [1, (a, b) => (a || b)], "&&": [2, (a, b) => (a && b)],
  "==": [3, (a, b) => +(Math.abs(a - b) < 1e-9)], "!=": [3, (a, b) => +(Math.abs(a - b) >= 1e-9)],
  "<": [4, (a, b) => +(a < b)], ">": [4, (a, b) => +(a > b)], "<=": [4, (a, b) => +(a <= b)], ">=": [4, (a, b) => +(a >= b)],
  "+": [5, (a, b) => a + b], "-": [5, (a, b) => a - b],
  "*": [6, (a, b) => a * b], "/": [6, (a, b) => a / b], "%": [6, (a, b) => a % b],
  "^": [8, (a, b) => a ** b]
};

export function evaluate(expr, vars) {
  const toks = String(expr).match(/\d*\.?\d+(?:e[+-]?\d+)?|[A-Za-z_]\w*|\|\||&&|[<>=!]=|[-+*/^%(),<>!]/g) || [];
  if (toks.join("") !== String(expr).replace(/\s+/g, "")) throw new Error(`Can't read "${expr}"`);
  let i = 0;
  const peek = () => toks[i], take = () => toks[i++];
  function unary() {
    const t = take();
    if (t === "-") return -parse(7);
    if (t === "+") return parse(7);
    if (t === "!") return +!parse(7);
    if (t === "(") { const v = parse(0); if (take() !== ")") throw new Error("Missing )"); return v; }
    if (/^[\d.]/.test(t)) return parseFloat(t);
    if (/^[A-Za-z_]/.test(t || "")) {
      if (peek() === "(") {
        take();
        const args = [];
        if (peek() !== ")") do args.push(parse(0)); while (peek() === "," && take());
        if (take() !== ")" || !FN[t]) throw new Error(`Unknown function ${t}`);
        return FN[t](...args);
      }
      if (!(t in vars)) throw new Error(`Unknown value ${t}`);
      return vars[t];
    }
    throw new Error(`Unexpected ${t}`);
  }
  function parse(min) {
    let left = unary();
    while (BIN[peek()] && BIN[peek()][0] >= min) {
      const [p, f] = BIN[take()];
      left = f(left, parse(p === 8 ? p : p + 1)); // ^ binds right to left
    }
    return left;
  }
  const v = parse(0);
  if (i < toks.length) throw new Error(`Unexpected ${toks[i]}`);
  return v;
}

const decimals = (x) => (String(x).split(".")[1] || "").length;
// Rounded to dp places; trailing zeros dropped unless `fixed`.
export function fmt(x, dp = 2, fixed = false) {
  const r = Number(Number(x).toFixed(dp));
  return fixed ? r.toFixed(dp) : String(r);
}
const withUnit = (text, unit) => (!unit ? text : /^[:%°]/.test(unit) ? text + unit : `${text} ${unit}`);

// "{a}", "{a:2}" (2 places, fixed), "{=b/a}", "{=b/a:1}", "{answer}".
function fillIn(text, vals, dps) {
  return text.replace(/\{(=?)([^{}:]+)(?::(\d))?\}/g, (_, isExpr, body, dp) => {
    const key = body.trim();
    const v = isExpr ? evaluate(key, vals) : vals[key];
    if (v === undefined) throw new Error(`Unknown value ${key}`);
    return dp != null ? fmt(v, +dp, true) : fmt(v, isExpr ? 2 : dps[key] ?? 2);
  });
}

// One concrete question from a calc template:
// { q, calc: { value, text, prefix, unit, dp, method[] }, why?, chunk? }. Numbers are drawn from each
// variable's range (min, max, step) or list (pick) until `when` holds.
export function calcInstance(t, rnd = Math.random) {
  const dp = t.dp ?? 2;
  for (let tries = 0; tries < 200; tries++) {
    const vals = {}, dps = { answer: dp };
    for (const [k, v] of Object.entries(t.vars || {})) {
      if (Array.isArray(v.pick)) { vals[k] = pick(v.pick, rnd); dps[k] = Math.max(...v.pick.map(decimals)); continue; }
      const step = v.step ?? 1, n = Math.floor((v.max - v.min) / step + 1e-9) + 1;
      dps[k] = Math.max(decimals(step), decimals(v.min));
      vals[k] = Number((v.min + step * Math.floor(rnd() * n)).toFixed(dps[k]));
    }
    for (const [k, e] of Object.entries(t.let || {})) { vals[k] = evaluate(e, vals); dps[k] = dp; }
    if (t.when && !evaluate(t.when, vals)) continue;
    const value = Number(evaluate(t.answer, vals).toFixed(dp));
    if (!Number.isFinite(value)) continue;
    vals.answer = value;
    const text = (t.prefix || "") + withUnit(fmt(value, dp, !!t.fixed), t.unit);
    return {
      ...t, q: fillIn(t.q, vals, dps),
      calc: { value, prefix: t.prefix || "", unit: t.unit || "", dp, text, method: (t.method || []).map((m) => fillIn(m, vals, dps)) }
    };
  }
  throw new Error(`No numbers fit "${t.when}"`);
}

// A typed answer counts if it rounds to the answer (or is within `tolerance`).
export function calcRight(q, typed) {
  const m = String(typed ?? "").replace(/[\s,]/g, "").match(/-?\d*\.?\d+/);
  if (!m) return false;
  const tol = q.tolerance ?? 0.5 * 10 ** -q.calc.dp;
  return Math.abs(parseFloat(m[0]) - q.calc.value) <= tol + 1e-9;
}

// Bank questions ready to show: calc templates get their numbers, the rest are unchanged.
export const concrete = (q, rnd) => (q.type === "calc" ? calcInstance(q, rnd) : q);

/* ---------- Do now top-up ---------- */

const earlier = (d) => !/^pre-read/i.test(d.from || "");
// A question that only makes sense with its options on screen can't be a Do now card.
const needsOptions = (q) => /\b(of these|the following|which one|which (is|are) (a|an|not))\b/i.test(q.q);

// The topic's Do now, plus questions from earlier topics' quiz banks until at least 2 cards
// come from earlier topics. `earlierTopics` is [{ entry, topic }] for earlier built topics.
export function doNowTopUp(doNow, earlierTopics) {
  const need = 2 - doNow.filter(earlier).length;
  if (need <= 0) return doNow;
  const pool = earlierTopics.flatMap(({ entry, topic }) => (topic.quiz || [])
    .filter((q) => q.type !== "calc" && !needsOptions(q))
    .map((q) => ({
      q: q.tf != null ? `True or false: ${q.q}` : q.q,
      a: q.tf != null ? `${q.tf ? "True" : "False"}. ${q.why || ""}`.trim() : q.options[q.answer],
      from: entry.spec?.[0] || entry.code
    })));
  return [...doNow, ...shuffle(pool).slice(0, need)];
}
