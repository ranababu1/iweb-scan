'use strict';
const net = require('node:net');

// Normalise user input ("https://www.Example.com/path?x") to a bare hostname.
function normalizeDomain(input) {
  if (typeof input !== 'string') return null;
  let s = input.trim().toLowerCase();
  if (!s || s.length > 253) return null;
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  s = s.split(/[/?#]/)[0];
  s = s.replace(/^[^@]*@/, ''); // strip credentials
  s = s.replace(/:\d+$/, ''); // strip port
  s = s.replace(/\.$/, '');
  if (!isValidHostname(s)) return null;
  return s;
}

function isValidHostname(h) {
  if (!h || h.length > 253) return false;
  if (net.isIP(h)) return false; // scan domains only, never raw IPs
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') ||
      h.endsWith('.internal') || h.endsWith('.lan') || h.endsWith('.home.arpa') || h.endsWith('.arpa')) return false;
  const labels = h.split('.');
  if (labels.length < 2) return false;
  const tld = labels[labels.length - 1];
  if (!/^(xn--[a-z0-9-]{2,59}|[a-z]{2,63})$/.test(tld)) return false;
  return labels.every((l) => /^(?!-)[a-z0-9-]{1,63}(?<!-)$/.test(l));
}

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}

const V4_BLOCKS = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4], ['255.255.255.255', 32],
].map(([base, bits]) => [ipv4ToInt(base), bits]);

// Some sandboxed dev environments resolve every host into 198.18.0.0/15
// (fake-IP proxies). SCAN_ALLOW_FAKE_IP=1 permits that range for local testing only.
const ALLOW_FAKE_IP = process.env.SCAN_ALLOW_FAKE_IP === '1';
const FAKE_BASE = ipv4ToInt('198.18.0.0');

function isPrivateIp(ip) {
  const v = net.isIP(ip);
  if (v === 4) {
    const n = ipv4ToInt(ip);
    if (ALLOW_FAKE_IP && (n & 0xfffe0000) >>> 0 === FAKE_BASE) return false;
    return V4_BLOCKS.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (base & mask);
    });
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === '::' || s === '::1') return true;
    const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    if (/^::ffff:/.test(s)) return true;
    if (/^(fc|fd)/.test(s)) return true; // unique local
    if (/^fe[89ab]/.test(s)) return true; // link-local
    if (/^ff/.test(s)) return true; // multicast
    if (/^2001:db8/.test(s)) return true; // documentation
    if (/^(64:ff9b|2002):/.test(s)) return true; // NAT64 / 6to4 could wrap private v4
    return false;
  }
  return true; // not an IP at all: treat as unsafe
}

module.exports = { normalizeDomain, isValidHostname, isPrivateIp };
