'use strict';
const { CATEGORIES } = require('./checks');

const BASE = (process.env.PUBLIC_BASE_URL || 'https://scan.iwebandseo.com').replace(/\/$/, '');
const SITE = 'https://iwebandseo.com';
const CONTACT = `${SITE}/contact`;
const BOOK = `${SITE}/book-a-call`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const gradeColor = (g) => ({ A: '#16a34a', B: '#65a30d', C: '#d97706', D: '#ea580c', F: '#dc2626' }[g] || '#64748b');
const statusIcon = { pass: '✓', warn: '!', fail: '✕', info: 'i' };

function ago(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} hour${h > 1 ? 's' : ''} ago`;
  return `${Math.round(h / 24)} days ago`;
}

function layout({ title, description, body, canonical, ogImage, noindex = false, extraHead = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(ogImage || BASE + '/og/default.png')}">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="https://iwebandseo.com/wp-content/uploads/2026/10/iws-icon-512-150x150.png">
<link rel="stylesheet" href="/static/styles.css?v=2">
${extraHead}
</head>
<body>
<header class="topbar">
  <div class="wrap topbar-in">
    <a class="brand" href="/"><span class="brand-mark">IWS</span><span class="brand-text">AI Readiness Scan</span></a>
    <nav class="nav">
      <a href="/tools">Free tools</a>
      <a href="/bot">About the scanner</a>
      <a class="nav-cta" href="/#scan">Get my free scan</a>
    </nav>
  </div>
</header>
<main>${body}</main>
<footer class="footer">
  <div class="wrap footer-in">
    <div><strong>iWeb &amp; SEO</strong><br><span class="muted">We help businesses get found, understood and chosen by people and AI.</span></div>
    <div class="footer-links">
      <a href="${SITE}">iwebandseo.com</a>
      <a href="/tools">Free tools</a>
      <a href="/bot">Our scanner bot</a>
      <a href="/privacy">Privacy</a>
      <a href="${CONTACT}">Contact</a>
    </div>
  </div>
</footer>
<script src="/static/app.js?v=2" defer></script>
</body>
</html>`;
}

function scanForm(value = '', compact = false) {
  return `<form class="scan-form${compact ? ' compact' : ''}" action="/scan" method="get" data-scan-form>
  <label class="sr-only" for="domain${compact ? '2' : ''}">Your website</label>
  <input id="domain${compact ? '2' : ''}" name="domain" type="text" inputmode="url" autocomplete="url" spellcheck="false" placeholder="yourbusiness.com" value="${esc(value)}" required maxlength="253">
  <button type="submit">Check my business free</button>
</form>
<p class="form-msg" data-form-msg role="status" aria-live="polite"></p>`;
}

function home({ recent = [] }) {
  const pillars = [
    { name: 'Findable', weight: 20, q: 'Can AI find you at all?', stake: "If not, you're never in the answer." },
    { name: 'Understood', weight: 25, q: 'Does AI know what you do and where?', stake: 'Otherwise it describes you wrong or skips you.' },
    { name: 'Actionable', weight: 25, q: 'Can AI help a customer call, enquire or book?', stake: 'This is where enquiries are won or lost.' },
    { name: 'Trusted', weight: 15, q: 'Is there enough proof for AI to recommend you?', stake: 'Reviews, credentials, a real address.' },
    { name: 'Reachable', weight: 15, q: 'Do your pages load fast and stay unblocked?', stake: 'A slow or blocked page gets dropped.' },
  ];
  const body = `
<section class="hero" id="scan">
  <div class="wrap hero-in">
    <p class="eyebrow">Free AI readiness check</p>
    <h1>When a customer asks ChatGPT who to call, does it say your name?</h1>
    <p class="lede">More customers now ask AI where to book, who to call and what to buy. This free scan shows whether those assistants can find you, explain what you do and send people to your booking or contact page.</p>
    ${scanForm()}
    <p class="hero-note">No signup · We only read public pages · Results in about 30 seconds · <a href="/bot">How the scan works</a></p>
    <div class="scan-progress" data-progress hidden>
      <div class="bar"><span></span></div>
      <ul class="steps">
        <li>Checking robots.txt, sitemap and llms.txt</li>
        <li>Visiting as ChatGPT, Perplexity and Claude</li>
        <li>Reading your services, hours, prices and contact details</li>
        <li>Scoring 30+ checks</li>
      </ul>
    </div>
  </div>
</section>

<section class="wrap scan-how">
  <h2>How the scan works</h2>
  <ol class="how-list">
    <li><strong>We check whether AI tools are allowed in</strong><span>robots.txt, sitemap, llms.txt</span></li>
    <li><strong>We visit your site the way ChatGPT, Perplexity and Claude do</strong></li>
    <li><strong>We read what they'd read: your services, hours, prices and contact details</strong></li>
    <li><strong>You get a score out of 100 and a fix list</strong><span>30+ checks</span></li>
  </ol>
</section>

<section class="wrap pillars">
  <h2>Five things AI needs from your website</h2>
  <div class="grid5">
    ${pillars.map((c) => `<div class="pillar"><div class="pillar-w">${c.weight} pts</div><h3>${c.name}</h3><p>${esc(c.q)}</p><p class="pillar-stake">${esc(c.stake)}</p></div>`).join('')}
  </div>
</section>

<section class="wrap example-report">
  <p class="example-kicker">Example report</p>
  <div class="example-card" aria-label="Example report, for illustration only">
    <div class="example-top">
      <div class="example-gauge"><span>72<small>/100</small></span></div>
      <div>
        <p class="example-domain">yourclinic.com</p>
        <p class="example-grade"><b>C</b> Visible, but hard to act on</p>
      </div>
    </div>
    <ul class="example-bars">
      <li><span>Findable</span><i style="--w:86%"></i><em>17/20</em></li>
      <li><span>Understood</span><i style="--w:70%"></i><em>18/25</em></li>
      <li class="is-low"><span>Actionable</span><i style="--w:44%"></i><em>11/25</em></li>
      <li><span>Trusted</span><i style="--w:82%"></i><em>12/15</em></li>
      <li><span>Reachable</span><i style="--w:78%"></i><em>12/15</em></li>
    </ul>
    <div class="example-fixes">
      <p>Top fixes</p>
      <ol>
        <li>Let assistants submit your booking form</li>
        <li>Put opening hours in text, not an image</li>
        <li>Add an llms.txt file</li>
      </ol>
    </div>
  </div>
</section>

<section class="wrap split">
  <div>
    <h2>Scored like a local business, not a software company.</h2>
    <p>Most AI-readiness tools mark you down for missing developer features you'll never need. We don't. If you don't sell online, you won't lose points for it.</p>
  </div>
  <div class="card">
    <h3>Every problem comes with a fix in plain English.</h3>
    <p>Do it yourself with free tools, or let us handle it.</p>
    <div class="cta-row">
      <a class="btn" href="#scan">Get my free report</a>
      <a class="btn ghost" href="${BOOK}">Fix it for me</a>
    </div>
  </div>
</section>

${recent.length ? `<section class="wrap recent">
  <h2>Recently scanned</h2>
  <div class="recent-list">${recent.map((r) => `<a class="recent-item" href="/score/${esc(r.domain)}"><span class="pill" style="background:${gradeColor(r.grade)}">${esc(r.grade)}</span><span>${esc(r.domain)}</span><span class="muted">${r.score}/100</span></a>`).join('')}</div>
</section>` : ''}

<section class="wrap faq">
  <h2>Good questions, straight answers</h2>
  <details><summary>What is AI agent readiness?</summary><p>It is how well AI assistants and agents can find your website, understand what you offer and take an action for someone, such as sending an enquiry, booking an appointment or buying a product. A site can rank well on Google and still be hard for an assistant to read or use.</p></details>
  <details><summary>Is the scan really free?</summary><p>Yes. The scan and the full report are free, and you do not need an account. If you want help with the fixes you can ask us, but you never have to hand over your details to see your score.</p></details>
  <details><summary>Do you store my data?</summary><p>The scanner only reads public pages that anyone can open, such as your homepage, robots.txt and sitemap. It does not log in, submit your forms or touch anything private. Your report gets its own link so you can come back to it or share it.</p></details>
  <details><summary>How is this different from SEO?</summary><p>SEO is mostly about ranking in search results. Agent readiness covers some of the same ground, then goes further: whether assistants are allowed in at all, whether they can read your key facts without running scripts, and whether they can complete a task on your site. Good SEO helps, but it does not cover those last two.</p></details>
  <details><summary>What happens after the scan?</summary><p>You get your score and fix list straight away. You can work through it yourself, share it with your developer, or ask us to quote for the fixes. There is no sales call unless you want one.</p></details>
</section>

<section class="wrap cta-band">
  <h2>Check your site now</h2>
  ${scanForm('', true)}
</section>`;
  return layout({
    title: 'AI Readiness Scan: Does ChatGPT Know Your Business? | IWS',
    description: 'See in 30 seconds whether ChatGPT, Gemini and Perplexity can find your business, describe it correctly and send you customers. Free, no signup.',
    canonical: BASE + '/',
    body,
  });
}

function dial(score, grade) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const off = c * (1 - score / 100);
  return `<svg class="dial" viewBox="0 0 120 120" role="img" aria-label="Score ${score} out of 100, grade ${grade}">
  <circle cx="60" cy="60" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="10"/>
  <circle cx="60" cy="60" r="${r}" fill="none" stroke="${gradeColor(grade)}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 60 60)"/>
  <text x="60" y="58" text-anchor="middle" class="dial-score">${score}</text>
  <text x="60" y="80" text-anchor="middle" class="dial-of">/ 100</text>
</svg>`;
}

function report(r) {
  const url = `${BASE}/score/${r.domain}`;
  const color = gradeColor(r.grade);
  const verdict = r.fatal ? 'We couldn\'t reach this site.' : {
    A: 'Excellent. AI assistants can find you, understand you and act for your customers.',
    B: 'Good. A few gaps are costing you AI recommendations.',
    C: 'Fair. AI tools can find you, but important signals are missing.',
    D: 'Weak. AI assistants struggle to understand you or send you customers.',
    F: 'Poor. Most AI assistants can\'t use your site to recommend or reach you.',
  }[r.grade];

  const cats = r.categories.map((c) => `<div class="cat">
    <div class="cat-head"><strong>${esc(c.name)}</strong><span>${c.score} / ${c.weight}</span></div>
    <div class="cat-bar"><span style="width:${c.pct}%;background:${c.pct >= 75 ? '#16a34a' : c.pct >= 50 ? '#d97706' : '#dc2626'}"></span></div>
    <p class="muted small">${esc(c.blurb)}</p>
  </div>`).join('');

  const fixes = r.fixes.slice(0, 8).map((f, i) => `<li class="fix">
    <div class="fix-num">${i + 1}</div>
    <div class="fix-body">
      <div class="fix-top"><strong>${esc(f.title)}</strong><span class="tag">${esc(f.categoryName)}</span>${f.impact ? `<span class="impact">+${f.impact} pts</span>` : ''}</div>
      <p>${esc(f.detail)}</p>
      <p class="fix-how"><strong>Fix:</strong> ${esc(f.fix)}</p>
      <a class="fix-cta" href="${esc(f.service)}?utm_source=scan&amp;utm_medium=report&amp;utm_campaign=${esc(f.id)}">We'll fix this for you →</a>
    </div>
  </li>`).join('');

  const groups = r.categories.map((c) => {
    const list = r.checks.filter((k) => k.category === c.id);
    return `<details class="check-group" ${c.pct < 75 ? 'open' : ''}>
      <summary><strong>${esc(c.name)}</strong><span class="muted">${list.filter((k) => k.status === 'pass').length}/${list.filter((k) => k.status !== 'info').length} passed</span></summary>
      <ul class="checks">${list.map((k) => `<li class="chk ${k.status}"><span class="ico" aria-label="${k.status}">${statusIcon[k.status]}</span><div><strong>${esc(k.title)}</strong><p>${esc(k.detail)}</p>${k.fix ? `<p class="fix-how"><strong>Fix:</strong> ${esc(k.fix)}</p>` : ''}</div></li>`).join('')}</ul>
    </details>`;
  }).join('');

  const botRows = Object.entries(r.bots || {}).map(([n, b]) => `<tr><td>${esc(n)}</td><td class="${b.blocked ? 'bad' : 'good'}">${b.blocked ? 'Blocked' : 'OK'}</td><td>${b.status || '–'}</td><td class="muted">${esc(b.reason || '')}</td></tr>`).join('');

  const shareText = encodeURIComponent(`${r.domain} scored ${r.score}/100 (${r.grade}) on the AI Readiness Scan. Check yours:`);
  const body = `
<section class="report-hero">
  <div class="wrap report-hero-in">
    <div class="report-dial">${dial(r.score, r.grade)}<div class="grade" style="background:${color}">${esc(r.grade)}</div></div>
    <div class="report-sum">
      <p class="eyebrow">AI readiness report</p>
      <h1>${esc(r.domain)}</h1>
      <p class="verdict">${esc(verdict)}</p>
      ${r.flags.map((fl) => `<div class="flag">⚠ ${esc(fl.text)}</div>`).join('')}
      ${r.fatal ? `<div class="flag">⚠ ${esc(r.fatal)}. Check the domain is right and the site is online, then scan again.</div>` : ''}
      <p class="muted small">Scanned ${esc(ago(r.ageMs || 0))}${r.finalUrl ? ` · ${esc(r.finalUrl)}` : ''}${r.capped ? ` · uncapped score ${r.rawScore}` : ''}</p>
      <div class="report-actions">
        <button class="btn" type="button" data-share data-url="${esc(url)}" data-text="${shareText}">Share report</button>
        <button class="btn ghost" type="button" data-rescan="${esc(r.domain)}" ${r.fresh ? 'disabled title="Results are cached for an hour"' : ''}>${r.fresh ? 'Fresh result' : 'Scan again'}</button>
        <a class="btn ghost" href="/tools?domain=${encodeURIComponent(r.domain)}">Free fix tools</a>
      </div>
      <p class="form-msg" data-form-msg role="status" aria-live="polite"></p>
    </div>
  </div>
</section>

${r.fatal ? '' : `<section class="wrap cats">${cats}</section>

<section class="wrap two-col">
  <div>
    <h2>Top fixes, ranked by impact</h2>
    ${fixes ? `<ol class="fixes">${fixes}</ol>` : '<p>Nothing major to fix. Nice work.</p>'}
  </div>
  <aside class="sidebar">
    <div class="card lead" id="fix-plan">
      <h3>Get my free fix plan</h3>
      <p class="small">We'll send a prioritised plan for ${esc(r.domain)} with effort estimates. Your score stays free either way.</p>
      <form data-lead-form>
        <input type="hidden" name="site" value="${esc(r.domain)}">
        <label>Name<input name="name" required maxlength="100" autocomplete="name"></label>
        <label>Email<input name="email" type="email" required maxlength="200" autocomplete="email"></label>
        <label class="hp">Leave empty<input name="company_website" tabindex="-1" autocomplete="off"></label>
        <button class="btn" type="submit">Send my plan</button>
        <p class="small muted">We use your details only to reply about this report. <a href="/privacy">Privacy</a></p>
        <p class="form-msg" data-lead-msg role="status" aria-live="polite"></p>
      </form>
    </div>
    <div class="card">
      <h3>Rather we just fix it?</h3>
      <p class="small">iWeb &amp; SEO handles schema, llms.txt, robots and firewall rules, booking and checkout flows, and the content AI assistants need.</p>
      <a class="btn" href="${BOOK}?utm_source=scan&amp;utm_medium=report">Book a free call</a>
    </div>
    <div class="card">
      <h3>Add the badge</h3>
      <img src="/badge/${esc(r.domain)}.svg" alt="AI readiness badge for ${esc(r.domain)}" width="180" height="20">
      <textarea readonly class="embed" rows="3">&lt;a href="${esc(url)}"&gt;&lt;img src="${BASE}/badge/${esc(r.domain)}.svg" alt="AI readiness score"&gt;&lt;/a&gt;</textarea>
    </div>
  </aside>
</section>

<section class="wrap">
  <h2>How AI assistants see you</h2>
  <div class="table-wrap"><table class="bots"><thead><tr><th>Assistant</th><th>Access</th><th>HTTP</th><th>Note</th></tr></thead><tbody>${botRows}</tbody></table></div>
  <p class="small muted">We request your homepage with each assistant's user agent from our server. Some firewalls let the real bots through by IP address, so if one shows as blocked here, check your firewall's verified-bot settings before assuming the worst.</p>
</section>

<section class="wrap">
  <h2>All checks</h2>
  ${groups}
</section>`}

<section class="wrap cta-band">
  <h2>Scan another site</h2>
  ${scanForm('', true)}
</section>`;
  return layout({
    title: `${r.domain}: ${r.score}/100 (${r.grade}) – AI Readiness Report`,
    description: `${r.domain} scored ${r.score}/100 for AI readiness: can ChatGPT, Gemini and Perplexity find it, understand it and act on it? See the ranked fixes.`,
    canonical: url,
    ogImage: `${BASE}/og/${r.grade}.png`,
    body,
  });
}

function pending(domain) {
  const body = `<section class="hero small-hero"><div class="wrap hero-in">
    <p class="eyebrow">Scanning</p>
    <h1>${esc(domain)}</h1>
    <p class="lede">Hang tight, this usually takes 10–25 seconds.</p>
    <div class="scan-progress" data-progress data-autoscan="${esc(domain)}">
      <div class="bar"><span></span></div>
      <ul class="steps">
        <li>Checking robots.txt, sitemap and llms.txt</li>
        <li>Visiting as ChatGPT, Perplexity and Claude</li>
        <li>Reading your schema, content and contact paths</li>
        <li>Scoring 30+ checks</li>
      </ul>
    </div>
    <p class="form-msg" data-form-msg role="status" aria-live="polite"></p>
  </div></section>`;
  return layout({ title: `Scanning ${domain} – AI Readiness Scan`, description: 'Scanning…', body, noindex: true });
}

function tools({ domain = '', r = null }) {
  const f = r?.facts || {};
  const name = f.orgName || (f.title ? f.title.split(/[|–-]/)[0].trim() : '') || domain;
  const pages = f.pageLinks || {};
  const llmsDraft = r ? [
    `# ${name}`,
    '',
    `> ${f.metaDescription || 'One or two sentences on what you do, for whom, and where.'}`,
    '',
    '## Key pages',
    `- [Home](${r.finalUrl || `https://${domain}/`}): ${f.h1 || 'What we do'}`,
    pages.about ? `- [About](${pages.about}): Who we are` : null,
    pages.contact ? `- [Contact](${pages.contact}): Phone, email and enquiry form` : null,
    `- [Services](https://${domain}/services): Replace with your services or products page`,
    `- [Pricing](https://${domain}/pricing): Replace with your pricing page, if you have one`,
    '',
    '## Optional',
    pages.privacy ? `- [Privacy policy](${pages.privacy})` : null,
    f.sitemap ? `- [Sitemap](${f.sitemap})` : null,
  ].filter((l) => l !== null).join('\n') : '';

  const body = `<section class="hero small-hero"><div class="wrap hero-in">
    <p class="eyebrow">Free tools</p>
    <h1>Fix the basics yourself</h1>
    <p class="lede">Generate an llms.txt, AI-friendly robots.txt rules and business schema in a few minutes. ${r ? `Pre-filled from your scan of <strong>${esc(domain)}</strong>.` : 'Scan your site first and we\'ll pre-fill these for you.'}</p>
    ${r ? '' : scanForm(domain)}
  </div></section>

<section class="wrap tool" id="llms">
  <h2>1. llms.txt generator</h2>
  <p>llms.txt is a short Markdown file at <code>/llms.txt</code> that points AI tools to your most important pages. Edit the draft, then upload it to your site's root folder.</p>
  <div class="tool-grid">
    <div>
      <label>Business name<input data-llms="name" value="${esc(name)}"></label>
      <label>One-line summary<textarea data-llms="summary" rows="2">${esc(f.metaDescription || '')}</textarea></label>
      <label>Key pages (one per line: Title | URL | short note)<textarea data-llms="links" rows="6">${esc([
        `Home | ${r?.finalUrl || (domain ? `https://${domain}/` : 'https://example.com/')} | ${f.h1 || 'What we do'}`,
        pages.about ? `About | ${pages.about} | Who we are` : '',
        pages.contact ? `Contact | ${pages.contact} | How to reach us` : '',
      ].filter(Boolean).join('\n'))}</textarea></label>
      <button class="btn" type="button" data-llms-build>Build llms.txt</button>
    </div>
    <div><textarea class="out" data-llms-out rows="16" readonly>${esc(llmsDraft)}</textarea><button class="btn ghost" type="button" data-copy="[data-llms-out]">Copy</button></div>
  </div>
</section>

<section class="wrap tool" id="robots">
  <h2>2. robots.txt rules for AI assistants</h2>
  <p>Add these lines to your <code>/robots.txt</code>. They let AI search and assistant bots fetch your pages when users ask about you. Training crawlers are optional: switch them on or off below.</p>
  <label class="inline"><input type="checkbox" data-robots-training> Also block AI training crawlers (GPTBot, ClaudeBot, Google-Extended, CCBot)</label>
  <textarea class="out" data-robots-out rows="14" readonly></textarea>
  <button class="btn ghost" type="button" data-copy="[data-robots-out]">Copy</button>
  <input type="hidden" data-robots-sitemap value="${esc(f.sitemap || (domain ? `https://${domain}/sitemap.xml` : 'https://example.com/sitemap.xml'))}">
</section>

<section class="wrap tool" id="schema">
  <h2>3. Business schema (JSON-LD) generator</h2>
  <p>Paste the result into your homepage's <code>&lt;head&gt;</code> (or your SEO plugin's custom schema field).</p>
  <div class="tool-grid">
    <div class="form-grid">
      <label>Type<select data-schema="type">
        <option>Organization</option><option>LocalBusiness</option><option>ProfessionalService</option><option>Restaurant</option><option>Hotel</option><option>Dentist</option><option>MedicalClinic</option><option>LegalService</option><option>Store</option><option>RealEstateAgent</option><option>HomeAndConstructionBusiness</option><option>BeautySalon</option>
      </select></label>
      <label>Name<input data-schema="name" value="${esc(name)}"></label>
      <label>Website<input data-schema="url" value="${esc(r?.finalUrl || (domain ? `https://${domain}/` : ''))}"></label>
      <label>Logo URL<input data-schema="logo" value="${esc(f.ogImage || '')}"></label>
      <label>Description<textarea data-schema="description" rows="2">${esc(f.metaDescription || '')}</textarea></label>
      <label>Phone<input data-schema="telephone" placeholder="+91 98765 43210"></label>
      <label>Email<input data-schema="email" placeholder="hello@example.com"></label>
      <label>Street address<input data-schema="streetAddress"></label>
      <label>City<input data-schema="addressLocality"></label>
      <label>State / region<input data-schema="addressRegion"></label>
      <label>Postcode<input data-schema="postalCode"></label>
      <label>Country code<input data-schema="addressCountry" placeholder="IN"></label>
      <label>Opening hours<input data-schema="openingHours" placeholder="Mo-Fr 09:00-18:00"></label>
      <label>Price range<input data-schema="priceRange" placeholder="₹₹"></label>
      <label class="span2">Profile links (one per line)<textarea data-schema="sameAs" rows="3">${esc((f.sameAs || []).join('\n'))}</textarea></label>
    </div>
    <div><textarea class="out" data-schema-out rows="22" readonly></textarea><button class="btn ghost" type="button" data-copy="[data-schema-out]">Copy</button></div>
  </div>
</section>

<section class="wrap cta-band">
  <h2>Short on time?</h2>
  <p>We'll set all of this up properly and fix the rest of your report.</p>
  <a class="btn" href="${BOOK}?utm_source=scan&amp;utm_medium=tools">Book a free call</a>
</section>`;
  return layout({
    title: 'Free llms.txt, robots.txt & schema generators for AI assistants | iWeb & SEO',
    description: 'Free tools to make your site AI-ready: generate an llms.txt file, robots.txt rules for AI assistants, and Organization/LocalBusiness JSON-LD.',
    canonical: BASE + '/tools',
    noindex: !!domain,
    body,
  });
}

function botPage({ ua, bots }) {
  const body = `<section class="wrap prose">
  <h1>About iWebScan, our scanner</h1>
  <p>iWebScan is the crawler behind the free <a href="/">AI Readiness Scan</a> by <a href="${SITE}">iWeb &amp; SEO</a>. It runs only when someone asks for a scan of a specific website, and it is not a general web crawler.</p>
  <h2>What it requests</h2>
  <p>For each scan it makes a small number of requests (usually 15–25) to the scanned site:</p>
  <ul>
    <li>the homepage, once as a normal browser and once each as ${Object.keys(bots).join(', ')}, to test whether AI assistants are let through;</li>
    <li><code>/robots.txt</code>, <code>/llms.txt</code>, the XML sitemap, and a few well-known files such as <code>/.well-known/mcp</code> and <code>/openapi.json</code>;</li>
    <li>the About, Contact and Privacy pages linked from the homepage, plus up to five links listed in llms.txt.</li>
  </ul>
  <p>It only reads public pages. It never submits forms, logs in, or follows links beyond those above. Results are cached for an hour, so repeated scans of the same site don't trigger new requests.</p>
  <h2>User agent</h2>
  <p>Our own requests identify themselves as:</p>
  <pre>${esc(ua)}</pre>
  <p>When testing assistant access we send the assistant's published user agent with <code>iWebScan/1.0 (+${BASE}/bot)</code> appended, so you can always tell these requests apart from the real assistants.</p>
  <h2>Opting out</h2>
  <p>To stop scans of your site, block the <code>iWebScan</code> user agent at your firewall, or <a href="${CONTACT}">contact us</a> and we'll exclude your domain.</p>
</section>`;
  return layout({ title: 'iWebScan bot – AI Readiness Scan', description: 'What the iWebScan crawler does, which pages it reads and how to opt out.', canonical: BASE + '/bot', body });
}

function privacyPage() {
  const body = `<section class="wrap prose">
  <h1>Privacy</h1>
  <p>The AI Readiness Scan reads only public web pages of the site you enter, the same pages any visitor or search engine can see. We don't log into sites, submit forms or collect personal data from the sites we scan.</p>
  <h2>What we store</h2>
  <ul>
    <li><strong>Scan results</strong> for each domain, so reports can be shared by link. Reports are public at <code>/score/your-domain</code>.</li>
    <li><strong>Your IP address</strong>, held briefly in memory to enforce fair-use limits (10 scans a minute, 50 a day). It isn't written to disk.</li>
    <li><strong>Fix-plan requests</strong>: if you choose to fill in the "Get my free fix plan" form, we store your name, email and the site, and use them only to reply about your report.</li>
  </ul>
  <p>To have a report or your details removed, <a href="${CONTACT}">contact us</a>. For more, see iWeb &amp; SEO's main site at <a href="${SITE}">iwebandseo.com</a>.</p>
</section>`;
  return layout({ title: 'Privacy – AI Readiness Scan', description: 'What the AI Readiness Scan reads and stores.', canonical: BASE + '/privacy', body });
}

function notFound() {
  return layout({ title: 'Not found – AI Readiness Scan', description: 'Page not found', noindex: true, body: `<section class="wrap prose"><h1>Page not found</h1><p><a href="/">Run a scan</a> instead.</p></section>` });
}

function badge(r) {
  const label = 'AI readiness';
  const value = r ? `${r.score}/100 ${r.grade}` : 'not scanned';
  const color = r ? gradeColor(r.grade) : '#64748b';
  const lw = 84;
  const vw = Math.max(60, value.length * 7 + 14);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lw + vw}" height="20" role="img" aria-label="${label}: ${esc(value)}">
<title>${label}: ${esc(value)}</title>
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="r"><rect width="${lw + vw}" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#0f172a"/><rect x="${lw}" width="${vw}" height="20" fill="${color}"/><rect width="${lw + vw}" height="20" fill="url(#s)"/></g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="${lw / 2}" y="14">${label}</text><text x="${lw + vw / 2}" y="14">${esc(value)}</text></g>
</svg>`;
}

module.exports = { home, report, pending, tools, botPage, privacyPage, notFound, badge, esc, gradeColor };
