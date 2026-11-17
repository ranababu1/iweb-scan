'use strict';
process.env.IWEB_NO_LISTEN = '1';
process.env.DATA_DIR = require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'iweb-'));
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');
const store = require('../src/store');
const { analyze } = require('../src/checks');
const { extract } = require('../src/parse');
const { goodHtml, okBots } = require('./fixtures');

let server, base;
test.before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  const url = 'https://smile.example/';
  store.saveReport(analyze({ domain: 'smile.example', finalUrl: url, home: { status: 200, url, ttfb: 200, bytes: 4000, redirects: [], https: true, challenge: { blocked: false } }, facts: extract(goodHtml, url), bots: okBots(), robots: { ok: true, text: '' }, sitemap: { found: true, url: url + 'sitemap.xml' }, llms: { ok: false }, pages: {}, wellKnown: {} }));
});
test.after(() => server.close());

test('homepage renders the hero', async () => {
  const html = await (await fetch(base + '/')).text();
  assert.match(html, /Can AI assistants find you, understand you, and take your booking\?/);
  assert.match(html, /Scan my site/);
});

test('report page, badge and tools render from cache', async () => {
  const rep = await fetch(base + '/score/smile.example');
  assert.equal(rep.status, 200);
  assert.match(await rep.text(), /We'll fix this for you|Nothing major to fix/);
  const badge = await fetch(base + '/badge/smile.example.svg');
  assert.match(badge.headers.get('content-type'), /svg/);
  assert.match(await badge.text(), /AI readiness/);
  assert.match(await (await fetch(base + '/tools?domain=smile.example')).text(), /Smile Dental Clinic/);
});

test('api rejects bad and internal domains', async () => {
  for (const d of ['localhost', '127.0.0.1', 'not a domain']) {
    const r = await fetch(base + '/api/scan?domain=' + encodeURIComponent(d));
    assert.equal(r.status, 400, d);
  }
});

test('cached scan is served without rescanning', async () => {
  const j = await (await fetch(base + '/api/scan?domain=smile.example')).json();
  assert.equal(j.cached, true);
  assert.equal(j.url, '/score/smile.example');
});

test('lead form stores leads and validates email', async () => {
  const bad = await fetch(base + '/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'A', email: 'nope', site: 'smile.example' }) });
  assert.equal(bad.status, 400);
  const ok = await fetch(base + '/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Asha', email: 'asha@example.com', site: 'smile.example' }) });
  assert.equal(ok.status, 200);
  assert.equal(store.readLeads().length, 1);
});
