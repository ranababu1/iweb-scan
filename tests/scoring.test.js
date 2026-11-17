'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { analyze, gradeFor, BLOCK_CAP } = require('../src/checks');
const { extract, detectChallenge, parseLlmsTxt } = require('../src/parse');
const { goodHtml, thinHtml, okBots } = require('./fixtures');

function baseData(html, overrides = {}) {
  const url = 'https://smile.example/';
  return {
    domain: 'smile.example',
    finalUrl: url,
    home: { status: 200, url, ttfb: 300, bytes: Buffer.byteLength(html), redirects: [], https: true, xRobotsTag: null, challenge: { blocked: false } },
    facts: extract(html, url),
    bots: okBots(),
    robots: { ok: true, status: 200, text: 'User-agent: *\nAllow: /\nSitemap: https://smile.example/sitemap.xml' },
    sitemap: { found: true, url: 'https://smile.example/sitemap.xml', fromRobots: true },
    llms: { ok: true, hasH1: true, linkCount: 3, checkedLinks: [{ url: 'x', ok: true }] },
    pages: { about: { ok: true, linked: true, url: 'https://smile.example/about' }, contact: { ok: true, linked: true, url: 'https://smile.example/contact' }, privacy: { ok: true, linked: true, url: 'https://smile.example/privacy-policy' } },
    wellKnown: {},
    ...overrides,
  };
}

test('grade boundaries', () => {
  assert.equal(gradeFor(100), 'A'); assert.equal(gradeFor(90), 'A');
  assert.equal(gradeFor(89), 'B'); assert.equal(gradeFor(75), 'B');
  assert.equal(gradeFor(74), 'C'); assert.equal(gradeFor(55), 'C');
  assert.equal(gradeFor(54), 'D'); assert.equal(gradeFor(35), 'D');
  assert.equal(gradeFor(34), 'F'); assert.equal(gradeFor(0), 'F');
});

test('category weights add up to 100', () => {
  const r = analyze(baseData(goodHtml));
  assert.equal(r.categories.reduce((s, c) => s + c.weight, 0), 100);
});

test('well-built local business scores an A', () => {
  const r = analyze(baseData(goodHtml));
  assert.ok(r.score >= 90, `score ${r.score}`);
  assert.equal(r.grade, 'A');
  assert.equal(r.capped, false);
  const action = r.checks.find((c) => c.id === 'action_path');
  assert.equal(action.status, 'pass');
  assert.match(action.detail, /Calendly/);
});

test('blocked AI bots cap the score at 59 and are flagged', () => {
  const bots = okBots();
  bots['ChatGPT-User'] = { status: 403, blocked: true, reason: 'HTTP 403 – Cloudflare block' };
  const r = analyze(baseData(goodHtml, { bots }));
  assert.ok(r.rawScore > BLOCK_CAP);
  assert.equal(r.score, BLOCK_CAP);
  assert.equal(r.capped, true);
  assert.ok(r.flags.some((f) => /ChatGPT-User/.test(f.text)));
  assert.equal(r.fixes[0].id, 'bots', 'blocking fix ranks first');
});

test('robots.txt blocking all AI search bots caps the score', () => {
  const text = ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Claude-SearchBot', 'Claude-User'].map((a) => `User-agent: ${a}\nDisallow: /`).join('\n\n');
  const r = analyze(baseData(goodHtml, { robots: { ok: true, status: 200, text } }));
  assert.ok(r.score <= BLOCK_CAP);
  assert.equal(r.checks.find((c) => c.id === 'ai_search_rules').status, 'fail');
});

test('blocking only training crawlers is not penalised', () => {
  const text = 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nAllow: /';
  const a = analyze(baseData(goodHtml));
  const b = analyze(baseData(goodHtml, { robots: { ok: true, status: 200, text } }));
  assert.equal(a.score, b.score);
  assert.match(b.checks.find((c) => c.id === 'ai_training_rules').detail, /GPTBot/);
});

test('service business without ecommerce or booking is not punished for it', () => {
  const html = goodHtml.replace(/<a class="btn" href="https:\/\/calendly[^<]*<\/a>/, '<a href="/contact">Get a quote</a>');
  const r = analyze(baseData(html));
  const tx = r.checks.find((c) => c.id === 'transaction');
  assert.equal(tx.status, 'info');
  assert.equal(tx.max, 0);
  const act = r.categories.find((c) => c.id === 'actionable');
  assert.equal(act.pct, 100);
});

test('JavaScript-only page fails readability and the action path', () => {
  const r = analyze(baseData(thinHtml, { pages: {} }));
  assert.equal(r.checks.find((c) => c.id === 'no_js').status, 'fail');
  assert.equal(r.checks.find((c) => c.id === 'action_path').status, 'fail');
  assert.ok(r.score < 55, `score ${r.score}`);
});

test('unreachable site scores 0 with a fatal message', () => {
  const r = analyze({ domain: 'nope.example', home: { status: 0, error: 'ENOTFOUND' }, fatal: 'Could not connect' });
  assert.equal(r.score, 0);
  assert.equal(r.grade, 'F');
  assert.ok(r.fatal);
});

test('fixes are sorted by impact and each has a CTA link', () => {
  const r = analyze(baseData(thinHtml, { pages: {}, sitemap: { found: false }, llms: { ok: false } }));
  for (let i = 1; i < r.fixes.length; i++) assert.ok(r.fixes[i - 1].rank >= r.fixes[i].rank);
  assert.ok(r.fixes.every((f) => /^https:\/\/iwebandseo\.com\//.test(f.service)));
});

test('challenge detection', () => {
  assert.equal(detectChallenge({ status: 403, text: 'Forbidden' }).blocked, true);
  assert.equal(detectChallenge({ status: 200, text: '<title>Just a moment...</title>' }).blocked, true);
  assert.equal(detectChallenge({ status: 200, text: goodHtml }).blocked, false);
  assert.equal(detectChallenge({ status: 0, error: 'Timed out' }).blocked, true);
});

test('extract finds contact paths, prices and schema', () => {
  const f = extract(goodHtml, 'https://smile.example/');
  assert.deepEqual(f.entityTypes, ['Dentist']);
  assert.equal(f.links.tel, 1);
  assert.equal(f.links.mailto, 1);
  assert.ok(f.booking.includes('Calendly'));
  assert.ok(f.pricesInText);
  assert.ok(f.hasRating);
  assert.equal(f.pageLinks.about, 'https://smile.example/about');
  assert.equal(f.pageLinks.privacy, 'https://smile.example/privacy-policy');
});

test('llms.txt parsing', () => {
  const p = parseLlmsTxt('# Smile\n\n> Dentist\n\n- [About](https://smile.example/about)\n- [Contact](/contact)');
  assert.equal(p.hasH1, true);
  assert.equal(p.links.length, 2);
  assert.equal(parseLlmsTxt('<!doctype html><html>').looksHtml, true);
});
