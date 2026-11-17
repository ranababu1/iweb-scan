'use strict';

// Fixed-window in-memory limiter: per-minute and per-day buckets per key.
function createLimiter({ perMinute = 10, perDay = 50 } = {}) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (now - v.dayStart > 86400000) hits.delete(k);
  }, 3600000).unref();

  return function take(key, now = Date.now()) {
    let v = hits.get(key);
    if (!v) { v = { minStart: now, min: 0, dayStart: now, day: 0 }; hits.set(key, v); }
    if (now - v.minStart >= 60000) { v.minStart = now; v.min = 0; }
    if (now - v.dayStart >= 86400000) { v.dayStart = now; v.day = 0; }
    if (v.min >= perMinute) return { ok: false, retryAfter: Math.ceil((v.minStart + 60000 - now) / 1000), reason: `Limit of ${perMinute} scans a minute reached.` };
    if (v.day >= perDay) return { ok: false, retryAfter: Math.ceil((v.dayStart + 86400000 - now) / 1000), reason: `Daily limit of ${perDay} scans reached.` };
    v.min++; v.day++;
    return { ok: true };
  };
}

module.exports = { createLimiter };
