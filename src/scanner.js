'use strict';
const { safeFetch, BROWSER_UA, UA } = require('./fetcher');
const { extract, detectChallenge, parseLlmsTxt } = require('./parse');
const { parseRobots } = require('./robots');
const { analyze } = require('./checks');

const SUFFIX = ' iWebScan/1.0 (+https://scan.iwebandseo.com/bot)';
const BOT_UAS = {
  'ChatGPT-User': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot' + SUFFIX,
  'OAI-SearchBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot' + SUFFIX,
  PerplexityBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)' + SUFFIX,
  ClaudeBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)' + SUFFIX,
};

const isXmlSitemap = (r) => r && r.ok && /<(urlset|sitemapindex)[\s>]/i.test(r.text || '');
const isTextFile = (r) => r && r.ok && !/text\/html/i.test(r.headers?.['content-type'] || '') && !/^\s*<(!doctype|html)/i.test(r.text || '');

async function fetchHome(domain) {
  const candidates = [`https://${domain}/`];
  if (!domain.startsWith('www.')) candidates.push(`https://www.${domain}/`);
  candidates.push(`http://${domain}/`);
  let best = null;
  for (const url of candidates) {
    const r = await safeFetch(url, { ua: BROWSER_UA });
    if (r.status > 0 && r.status < 500) return r; // a real HTTP answer (even 403) counts as reachable
    if (!best || (r.status > 0 && best.status === 0)) best = r;
  }
  return best;
}

async function scanDomain(domain) {
  const startedAt = new Date().toISOString();
  const home = await fetchHome(domain);
  const data = { domain, startedAt, home: slimRes(home), bots: {}, robots: null, sitemap: null, llms: null, pages: {}, wellKnown: {} };
  if (!home || home.status === 0 || (home.status >= 500 && !(home.text || '').trim())) {
    data.fatal = home?.error || (home?.status ? `The site returned HTTP ${home.status}` : 'Could not connect');
    return analyze(data);
  }

  const finalUrl = home.url;
  const origin = new URL(finalUrl).origin;
  data.finalUrl = finalUrl;
  const homeChallenge = detectChallenge(home);
  data.home.challenge = homeChallenge;
  const facts = extract(home.text || '', finalUrl);
  data.facts = facts;

  const get = (path, opts = {}) => safeFetch(new URL(path, origin).toString(), { ua: UA, maxBytes: 512 * 1024, timeout: 8000, ...opts });

  // Round 1: bots, robots, llms, well-known, in parallel.
  const botEntries = Object.entries(BOT_UAS);
  const [botResults, robots, llms, llmsFull, mcp, mcpJson, openapi, aiPlugin, apiCatalog] = await Promise.all([
    Promise.all(botEntries.map(([, ua]) => safeFetch(finalUrl, { ua, timeout: 10000 }))),
    get('/robots.txt', { accept: 'text/plain,*/*' }),
    get('/llms.txt', { accept: 'text/plain,text/markdown,*/*' }),
    get('/llms-full.txt', { method: 'HEAD' }),
    get('/.well-known/mcp', { maxBytes: 65536 }),
    get('/.well-known/mcp.json', { maxBytes: 65536 }),
    get('/openapi.json', { maxBytes: 65536 }),
    get('/.well-known/ai-plugin.json', { maxBytes: 65536 }),
    get('/.well-known/api-catalog', { maxBytes: 65536 }),
  ]);
  botEntries.forEach(([name], i) => {
    const r = botResults[i];
    const ch = detectChallenge(r);
    // A bot response that is drastically smaller than the browser one is probably an interstitial.
    if (!ch.blocked && home.bytes > 20000 && r.bytes < home.bytes * 0.15 && !/<h1|<main|<article/i.test(r.text || '')) {
      ch.blocked = true; ch.reason = 'Different, near-empty page served to this bot';
    }
    data.bots[name] = { status: r.status, blocked: ch.blocked, reason: ch.reason, bytes: r.bytes || 0, ttfb: r.ttfb ?? null };
  });

  const robotsOk = robots.ok && !/^\s*</.test(robots.text || '');
  data.robots = { status: robots.status, ok: robotsOk, text: robotsOk ? robots.text.slice(0, 50000) : '', error: robots.error || null };
  const parsedRobots = robotsOk ? parseRobots(robots.text) : { groups: [], sitemaps: [] };

  // llms.txt + check up to 5 links resolve
  const llmsOk = isTextFile(llms);
  data.llms = { status: llms.status, ok: llmsOk, fullExists: !!(llmsFull && llmsFull.ok), contentType: llms.headers?.['content-type'] || null };
  if (llmsOk) {
    const parsed = parseLlmsTxt(llms.text);
    const sample = parsed.links.slice(0, 5).map((l) => new URL(l, origin).toString());
    const linkRes = await Promise.all(sample.map((u) => safeFetch(u, { ua: UA, method: 'GET', maxBytes: 4096, timeout: 6000 })));
    data.llms = { ...data.llms, ...parsed, links: undefined, linkCount: parsed.links.length, checkedLinks: sample.map((u, i) => ({ url: u, ok: linkRes[i].ok, status: linkRes[i].status })) };
  }

  const jsonish = (r) => r && r.ok && /^\s*[[{]/.test(r.text || '');
  data.wellKnown = {
    mcp: jsonish(mcp) || jsonish(mcpJson),
    openapi: jsonish(openapi) && /"openapi"|"swagger"/.test(openapi.text || ''),
    aiPlugin: jsonish(aiPlugin),
    apiCatalog: !!(apiCatalog && apiCatalog.ok && /linkset|api/i.test(apiCatalog.text || '')),
  };

  // Round 2: sitemap + trust pages
  const sitemapCandidates = [...parsedRobots.sitemaps.slice(0, 3), '/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml'];
  const pageTargets = {
    about: facts.pageLinks.about || '/about',
    contact: facts.pageLinks.contact || '/contact',
    privacy: facts.pageLinks.privacy || '/privacy-policy',
  };
  const [sitemapRes, ...pageRes] = await Promise.all([
    (async () => {
      for (const c of sitemapCandidates) {
        let u;
        try { u = new URL(c, origin).toString(); } catch { continue; }
        const r = await safeFetch(u, { ua: UA, maxBytes: 1024 * 1024, timeout: 8000, accept: 'application/xml,text/xml,*/*' });
        if (isXmlSitemap(r)) return { found: true, url: u, fromRobots: parsedRobots.sitemaps.includes(c) };
      }
      return { found: false, declaredInRobots: parsedRobots.sitemaps.length > 0 };
    })(),
    ...Object.values(pageTargets).map((p) => get(p, { maxBytes: 600 * 1024 })),
  ]);
  data.sitemap = sitemapRes;
  Object.keys(pageTargets).forEach((k, i) => {
    const r = pageRes[i];
    data.pages[k] = { url: r.url || pageTargets[k], linked: !!facts.pageLinks[k], status: r.status, ok: r.ok && !detectChallenge(r).blocked };
    if (k === 'contact' && r.ok) {
      const cf = extract(r.text || '', r.url);
      data.contactPage = { forms: cf.forms, formPlugin: cf.formPlugin, tel: cf.links.tel, mailto: cf.links.mailto, whatsapp: cf.links.whatsapp, booking: cf.booking, contact: cf.contact };
    }
  });

  delete facts.text;
  return analyze(data);
}

function slimRes(r) {
  if (!r) return null;
  return {
    status: r.status, url: r.url, error: r.error || null, ttfb: r.ttfb ?? null, totalMs: r.totalMs ?? null,
    bytes: r.bytes || 0, redirects: r.redirects || [], https: /^https:/.test(r.url || ''),
    xRobotsTag: r.headers?.['x-robots-tag'] || null, server: r.headers?.server || null,
  };
}

module.exports = { scanDomain, BOT_UAS };
