'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeDomain, isPrivateIp } = require('../src/domain');
const { createLimiter } = require('../src/ratelimit');

test('normalizes user input', () => {
  assert.equal(normalizeDomain('https://www.Example.com/path?q=1'), 'www.example.com');
  assert.equal(normalizeDomain('example.co.in'), 'example.co.in');
  assert.equal(normalizeDomain(' shop.example.com:443 '), 'shop.example.com');
});

test('rejects invalid and internal hosts', () => {
  for (const bad of ['localhost', '127.0.0.1', '10.0.0.1', 'intranet', 'foo.local', 'a..b.com', '-bad.com', '', 'http://[::1]/', 'x.internal', 'user@localhost']) {
    assert.equal(normalizeDomain(bad), null, bad);
  }
});

test('private IP detection', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.5.4', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700::1111']) assert.equal(isPrivateIp(ip), false, ip);
});

test('rate limiter enforces per-minute and per-day caps', () => {
  const take = createLimiter({ perMinute: 2, perDay: 3 });
  const t = 1_000_000;
  assert.ok(take('a', t).ok); assert.ok(take('a', t).ok);
  assert.equal(take('a', t).ok, false);
  assert.ok(take('a', t + 61000).ok);
  assert.equal(take('a', t + 122000).ok, false, 'daily cap');
  assert.ok(take('b', t).ok, 'separate keys');
});
