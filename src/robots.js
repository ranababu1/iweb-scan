'use strict';

// Minimal RFC 9309 robots.txt parser: groups, Allow/Disallow, longest match wins.
function parseRobots(text) {
  const groups = [];
  const sitemaps = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (key === 'allow' || key === 'disallow') {
      if (current) current.rules.push({ type: key, path: value });
      lastWasAgent = false;
    } else if (key === 'sitemap') {
      if (value) sitemaps.push(value);
    } else {
      lastWasAgent = false;
    }
  }
  return { groups, sitemaps };
}

function groupFor(parsed, agent) {
  const a = agent.toLowerCase();
  const specific = parsed.groups.filter((g) => g.agents.some((x) => x !== '*' && (x === a || a.startsWith(x))));
  if (specific.length) return { rules: specific.flatMap((g) => g.rules), matched: 'specific' };
  const star = parsed.groups.filter((g) => g.agents.includes('*'));
  if (star.length) return { rules: star.flatMap((g) => g.rules), matched: '*' };
  return { rules: [], matched: 'none' };
}

function patternToRegex(p) {
  const anchored = p.endsWith('$');
  const body = (anchored ? p.slice(0, -1) : p)
    .split('*')
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp('^' + body + (anchored ? '$' : ''));
}

function isAllowed(parsed, agent, path = '/') {
  const { rules, matched } = groupFor(parsed, agent);
  let best = null;
  for (const r of rules) {
    if (r.path === '') continue; // empty Disallow = allow all
    if (patternToRegex(r.path).test(path)) {
      if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.type === 'allow')) best = r;
    }
  }
  return { allowed: !best || best.type === 'allow', matched, rule: best ? `${best.type}: ${best.path}` : null };
}

module.exports = { parseRobots, isAllowed };
