'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRobots, isAllowed } = require('../src/robots');

test('wildcard group applies when no specific group', () => {
  const p = parseRobots('User-agent: *\nDisallow: /private\n');
  assert.equal(isAllowed(p, 'GPTBot', '/').allowed, true);
  assert.equal(isAllowed(p, 'GPTBot', '/private/x').allowed, false);
});

test('specific group overrides wildcard', () => {
  const p = parseRobots('User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /');
  assert.equal(isAllowed(p, 'GPTBot', '/').allowed, false);
  assert.equal(isAllowed(p, 'OAI-SearchBot', '/').allowed, true);
});

test('grouped user-agents share rules', () => {
  const p = parseRobots('User-agent: PerplexityBot\nUser-agent: Claude-User\nDisallow: /');
  assert.equal(isAllowed(p, 'PerplexityBot').allowed, false);
  assert.equal(isAllowed(p, 'Claude-User').allowed, false);
  assert.equal(isAllowed(p, 'ChatGPT-User').allowed, true);
});

test('longest match wins; allow wins ties', () => {
  const p = parseRobots('User-agent: *\nDisallow: /\nAllow: /$');
  assert.equal(isAllowed(p, 'x', '/').allowed, true);
  assert.equal(isAllowed(p, 'x', '/page').allowed, false);
});

test('empty disallow allows everything; sitemaps collected', () => {
  const p = parseRobots('User-agent: *\nDisallow:\nSitemap: https://a.example/s.xml');
  assert.equal(isAllowed(p, 'x', '/').allowed, true);
  assert.deepEqual(p.sitemaps, ['https://a.example/s.xml']);
});
