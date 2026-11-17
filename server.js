'use strict';
const path = require('node:path');
const express = require('express');
const { normalizeDomain } = require('./src/domain');
const { scanDomain, BOT_UAS } = require('./src/scanner');
const { UA } = require('./src/fetcher');
const store = require('./src/store');
const { createLimiter } = require('./src/ratelimit');
const views = require('./src/views');

const PORT = Number(process.env.PORT || 3000);
const SCAN_TIMEOUT_MS = Number(process.env.SCAN_TOTAL_TIMEOUT_MS || 45000);
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_SCANS || 4);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY ? (isNaN(process.env.TRUST_PROXY) ? process.env.TRUST_PROXY : Number(process.env.TRUST_PROXY)) : 1);

const scanLimiter = createLimiter({ perMinute: Number(process.env.RATE_PER_MINUTE || 10), perDay: Number(process.env.RATE_PER_DAY || 50) });
const leadLimiter = createLimiter({ perMinute: 3, perDay: 20 });

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'self'; base-uri 'self'",
  });
  next();
});
app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));
app.use('/og', express.static(path.join(__dirname, 'public', 'og'), { maxAge: '7d' }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

/* ---------- scan orchestration: dedupe + concurrency cap + timeout ---------- */
const inflight = new Map();
let running = 0;
const queue = [];
function acquire() {
  if (running < MAX_CONCURRENT) { running++; return Promise.resolve(); }
  return new Promise((resolve) => queue.push(resolve));
}
function release() {
  const next = queue.shift();
  if (next) next(); else running--;
}

function runScan(domain) {
  if (inflight.has(domain)) return inflight.get(domain);
  const p = (async () => {
    await acquire();
    try {
      const report = await Promise.race([
        scanDomain(domain),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Scan timed out')), SCAN_TIMEOUT_MS)),
      ]);
      store.saveReport(report);
      return report;
    } finally {
      release();
      inflight.delete(domain);
    }
  })();
  inflight.set(domain, p);
  return p;
}

async function handleScan(req, res) {
  const input = req.query.domain ?? req.body?.domain;
  const domain = normalizeDomain(String(input || ''));
  if (!domain) return res.status(400).json({ error: 'Please enter a valid public domain, like yourbusiness.com.' });
  const cached = store.getReport(domain);
  if (cached && cached.fresh) return res.json({ domain, cached: true, score: cached.score, grade: cached.grade, url: `/score/${domain}` });

  if (!inflight.has(domain)) {
    const verdict = scanLimiter(req.ip);
    if (!verdict.ok) {
      res.set('Retry-After', String(verdict.retryAfter));
      return res.status(429).json({ error: `${verdict.reason} Please try again later.` });
    }
  }
  try {
    const report = await runScan(domain);
    return res.json({ domain, cached: false, score: report.score, grade: report.grade, url: `/score/${domain}` });
  } catch (err) {
    console.error('scan failed', domain, err.message);
    return res.status(502).json({ error: 'The scan didn\'t finish. The site may be slow or unreachable. Please try again.' });
  }
}

app.get('/api/scan', handleScan);
app.post('/api/scan', handleScan);

app.get('/api/report/:domain', (req, res) => {
  const domain = normalizeDomain(req.params.domain);
  const r = domain && store.getReport(domain);
  if (!r) return res.status(404).json({ error: 'Not scanned yet' });
  res.json(r);
});

app.post('/api/lead', (req, res) => {
  const { name, email, site, company_website: hp } = req.body || {};
  if (hp) return res.json({ ok: true }); // honeypot
  const cleanName = String(name || '').trim().slice(0, 100);
  const cleanEmail = String(email || '').trim().slice(0, 200);
  const domain = normalizeDomain(String(site || ''));
  if (!cleanName || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail) || !domain) return res.status(400).json({ error: 'Please enter your name and a valid email.' });
  const verdict = leadLimiter(req.ip);
  if (!verdict.ok) return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  const r = store.getReport(domain);
  store.saveLead({ at: new Date().toISOString(), name: cleanName, email: cleanEmail, site: domain, score: r?.score ?? null, grade: r?.grade ?? null });
  res.json({ ok: true });
});

app.get('/api/health', (req, res) => res.json({ ok: true, ip: req.ip, running, queued: queue.length }));

// Leads export, only when ADMIN_TOKEN is configured.
app.get('/admin/leads.csv', (req, res) => {
  const token = process.env.ADMIN_TOKEN;
  if (!token || req.query.token !== token) return res.status(404).send('Not found');
  const rows = store.readLeads();
  const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/^[=+\-@]/, "'$&")}"`;
  res.type('text/csv').send(['at,name,email,site,score,grade', ...rows.map((l) => [l.at, l.name, l.email, l.site, l.score, l.grade].map(csvCell).join(','))].join('\n'));
});

/* ---------- pages ---------- */
app.get('/', (req, res) => res.send(views.home({ recent: store.recentReports(8).filter((r) => !r.fatal) })));

app.get('/scan', (req, res) => {
  const domain = normalizeDomain(String(req.query.domain || ''));
  if (!domain) return res.redirect('/');
  res.redirect(`/score/${domain}`);
});

app.get('/score/:domain', (req, res) => {
  const domain = normalizeDomain(req.params.domain);
  if (!domain) return res.status(404).send(views.notFound());
  if (domain !== req.params.domain) return res.redirect(301, `/score/${domain}`);
  const r = store.getReport(domain);
  if (!r) return res.set('Cache-Control', 'no-store').send(views.pending(domain));
  res.send(views.report(r));
});

app.get('/badge/:file', (req, res) => {
  const domain = normalizeDomain(String(req.params.file).replace(/\.svg$/, ''));
  const r = domain ? store.getReport(domain) : null;
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=3600').send(views.badge(r && !r.fatal ? r : null));
});

app.get('/tools', (req, res) => {
  const domain = normalizeDomain(String(req.query.domain || '')) || '';
  const r = domain ? store.getReport(domain) : null;
  res.send(views.tools({ domain, r: r && !r.fatal ? r : null }));
});

app.get('/bot', (req, res) => res.send(views.botPage({ ua: UA, bots: BOT_UAS })));
app.get('/privacy', (req, res) => res.send(views.privacyPage()));
app.get('/robots.txt', (req, res) => res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\n\nSitemap: ${(process.env.PUBLIC_BASE_URL || 'https://scan.iwebandseo.com').replace(/\/$/, '')}/sitemap.xml\n`));
app.get('/sitemap.xml', (req, res) => {
  const base = (process.env.PUBLIC_BASE_URL || 'https://scan.iwebandseo.com').replace(/\/$/, '');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', '/tools', '/bot', '/privacy'].map((p) => `<url><loc>${base}${p}</loc></url>`).join('')}</urlset>`);
});
app.get('/llms.txt', (req, res) => res.type('text/plain').send(`# iWeb & SEO AI Readiness Scan\n\n> Free tool that checks whether AI assistants (ChatGPT, Gemini, Perplexity, Claude) can find a business website, understand it, and help customers enquire, book or buy. Built by iWeb & SEO.\n\n## Pages\n- [Scanner](${(process.env.PUBLIC_BASE_URL || 'https://scan.iwebandseo.com')}/): Enter a domain to get a 0–100 score with ranked fixes\n- [Free tools](${(process.env.PUBLIC_BASE_URL || 'https://scan.iwebandseo.com')}/tools): llms.txt, robots.txt and JSON-LD generators\n- [About the scanner bot](${(process.env.PUBLIC_BASE_URL || 'https://scan.iwebandseo.com')}/bot)\n- [iWeb & SEO](https://iwebandseo.com/): The agency that fixes what the scan finds\n- [Contact](https://iwebandseo.com/contact)\n`));

app.use((req, res) => res.status(404).send(views.notFound()));
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).send('Something went wrong.');
});

if (process.env.IWEB_NO_LISTEN !== '1') {
  app.listen(PORT, () => console.log(`iweb-scan listening on :${PORT}`));
}
module.exports = app;
