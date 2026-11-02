// Per-device conveniences only (teaching mode, read ticks, last mode, year).
// Nothing here is ever sent anywhere. Storage can be blocked, so every call is guarded.

const PREFIX = "dtr.";

export function get(key, fallback = null) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function set(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the setting just isn't remembered */
  }
}
