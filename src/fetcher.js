'use strict';
const dns = require('node:dns');
const { Agent } = require('undici');
const { isPrivateIp, isValidHostname } = require('./domain');

const UA = process.env.SCAN_USER_AGENT || 'iWebScan/1.0 (+https://scan.iwebandseo.com/bot)';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 iWebScan/1.0';
const MAX_BYTES = Number(process.env.SCAN_MAX_BYTES || 3 * 1024 * 1024);
const TIMEOUT_MS = Number(process.env.SCAN_TIMEOUT_MS || 10000);
const MAX_REDIRECTS = 5;

// Every TCP connection goes through this lookup, so DNS rebinding cannot
// smuggle a private address in after validation.
function safeLookup(hostname, options, cb) {
  dns.lookup(hostname, { all: true }, (err, addrs) => {
    if (err) return cb(err);
    const ok = addrs.filter((a) => !isPrivateIp(a.address));
    if (!ok.length || ok.length !== addrs.length) {
      const e = new Error(`Blocked private address for ${hostname}`);
      e.code = 'EPRIVATE';
      return cb(e);
    }
    if (options && options.all) return cb(null, ok);
    return cb(null, ok[0].address, ok[0].family);
  });
}

const agent = new Agent({
  connect: { lookup: safeLookup, timeout: TIMEOUT_MS },
  headersTimeout: TIMEOUT_MS,
  bodyTimeout: TIMEOUT_MS,
});

function checkUrl(u) {
  const url = new URL(u);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Unsupported protocol');
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('Unsupported port');
  if (url.username || url.password) throw new Error('Credentials in URL');
  if (!isValidHostname(url.hostname)) throw new Error('Invalid host');
  return url;
}

async function readCapped(res, maxBytes) {
  if (!res.body) return { text: '', bytes: 0, truncated: false };
  const reader = res.body.getReader();
  const chunks = [];
  let bytes = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      chunks.push(value.subarray(0, value.byteLength - (bytes - maxBytes)));
      truncated = true;
      try { await reader.cancel(); } catch { /* ignore */ }
      break;
    }
    chunks.push(value);
  }
  return { text: Buffer.concat(chunks).toString('utf8'), bytes: Math.min(bytes, maxBytes), truncated };
}

/**
 * Fetch a public URL safely. Follows redirects manually (each hop re-validated).
 * Never throws: returns { ok:false, error } on failure.
 */
async function safeFetch(startUrl, opts = {}) {
  const ua = opts.ua || UA;
  const method = opts.method || 'GET';
  const maxBytes = opts.maxBytes || MAX_BYTES;
  const chain = [];
  const started = Date.now();
  let url = startUrl;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      checkUrl(url);
      const t0 = Date.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), opts.timeout || TIMEOUT_MS);
      let res;
      try {
        res = await fetch(url, {
          method,
          redirect: 'manual',
          dispatcher: agent,
          signal: ctrl.signal,
          headers: {
            'user-agent': ua,
            accept: opts.accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
            'accept-language': 'en',
          },
        });
        const ttfb = Date.now() - t0;
        chain.push({ url, status: res.status });
        const loc = res.headers.get('location');
        if (res.status >= 300 && res.status < 400 && loc) {
          try { await res.body?.cancel(); } catch { /* ignore */ }
          url = new URL(loc, url).toString();
          continue;
        }
        const body = method === 'HEAD' ? { text: '', bytes: 0, truncated: false } : await readCapped(res, maxBytes);
        return {
          ok: res.status >= 200 && res.status < 300,
          status: res.status,
          url,
          headers: Object.fromEntries(res.headers.entries()),
          text: body.text,
          bytes: body.bytes,
          truncated: body.truncated,
          ttfb,
          totalMs: Date.now() - started,
          redirects: chain.slice(0, -1),
        };
      } finally {
        clearTimeout(timer);
      }
    }
    return { ok: false, status: 0, error: 'Too many redirects', url, redirects: chain, totalMs: Date.now() - started };
  } catch (err) {
    const msg = err && err.name === 'AbortError' ? 'Timed out' : (err && (err.cause?.code === 'EPRIVATE' || err.code === 'EPRIVATE') ? 'Blocked private address' : (err.cause?.message || err.message || 'Fetch failed'));
    return { ok: false, status: 0, error: msg, url, redirects: chain, totalMs: Date.now() - started };
  }
}

module.exports = { safeFetch, UA, BROWSER_UA };
