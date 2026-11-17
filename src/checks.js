'use strict';
const { parseRobots, isAllowed } = require('./robots');

const SITE = 'https://iwebandseo.com';
const CATEGORIES = [
  { id: 'findable', name: 'Findable', weight: 20, blurb: 'Can AI search tools discover your site and its pages?', service: `${SITE}/services/get-found` },
  { id: 'understood', name: 'Understood', weight: 25, blurb: 'Can an AI work out who you are, what you offer and how to reach you?', service: `${SITE}/services/get-found` },
  { id: 'actionable', name: 'Actionable', weight: 25, blurb: 'Can an assistant help a customer enquire, book or buy?', service: `${SITE}/services/turn-visitors-into-customers` },
  { id: 'trusted', name: 'Trusted', weight: 15, blurb: 'Does your site show the signals that make you safe to recommend?', service: `${SITE}/services/turn-visitors-into-customers` },
  { id: 'reachable', name: 'Reachable', weight: 15, blurb: 'Do AI assistants actually get your pages, quickly and without being blocked?', service: `${SITE}/services/custom-development` },
];

const AI_SEARCH_AGENTS = ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Claude-SearchBot', 'Claude-User'];
const AI_TRAINING_AGENTS = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'CCBot', 'Applebot-Extended', 'meta-externalagent'];
const BLOCK_CAP = 59;

function gradeFor(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 55) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

// status: pass | warn | fail | info ; max 0 means "not counted"
function check(category, id, title, status, points, max, detail, fix) {
  return { category, id, title, status, points: Math.max(0, Math.min(points, max)), max, detail, fix: status === 'pass' || status === 'info' ? null : fix };
}

function analyze(data) {
  const checks = [];
  const f = data.facts || null;
  const home = data.home || {};
  const fatal = data.fatal || null;
  const homeBlocked = !!(home.challenge && home.challenge.blocked);
  const add = (...args) => checks.push(check(...args));

  if (fatal || !f) {
    return finalize(data, [], { fatal: fatal || 'No homepage content' });
  }

  /* ---------------- Findable (20) ---------------- */
  const robotsParsed = data.robots?.ok ? parseRobots(data.robots.text) : { groups: [], sitemaps: [] };
  if (data.robots?.ok) add('findable', 'robots', 'robots.txt file', 'pass', 2, 2, 'Your robots.txt loads, so crawlers get clear instructions.', null);
  else if (data.robots?.status === 404) add('findable', 'robots', 'robots.txt file', 'warn', 1.5, 2, 'No robots.txt found. Crawlers assume everything is allowed, but you lose control and a place to list your sitemap.', 'Add a /robots.txt that allows AI search bots and links to your sitemap. Our generator below writes one for you.');
  else add('findable', 'robots', 'robots.txt file', 'warn', 1, 2, `robots.txt did not load properly${data.robots?.status ? ` (HTTP ${data.robots.status})` : ''}.`, 'Make sure /robots.txt returns a plain-text file with HTTP 200.');

  const searchVerdicts = AI_SEARCH_AGENTS.map((a) => ({ agent: a, ...isAllowed(robotsParsed, a, '/') }));
  const blockedSearch = searchVerdicts.filter((v) => !v.allowed).map((v) => v.agent);
  const robotsBlocksAll = blockedSearch.length === AI_SEARCH_AGENTS.length;
  if (!blockedSearch.length) add('findable', 'ai_search_rules', 'AI search & assistant bots allowed', 'pass', 5, 5, `robots.txt lets ${AI_SEARCH_AGENTS.join(', ')} read your homepage.`, null);
  else if (!robotsBlocksAll) add('findable', 'ai_search_rules', 'AI search & assistant bots allowed', 'warn', 5 * (1 - blockedSearch.length / AI_SEARCH_AGENTS.length), 5, `robots.txt blocks: ${blockedSearch.join(', ')}. Those assistants can't fetch your pages when a user asks about you.`, `Allow ${blockedSearch.join(', ')} in robots.txt. These fetch pages live for users and are separate from AI training crawlers.`);
  else add('findable', 'ai_search_rules', 'AI search & assistant bots allowed', 'fail', 0, 5, 'robots.txt blocks every major AI search and assistant bot. ChatGPT, Perplexity and Claude can\'t read your site when users ask about you.', 'Remove the Disallow rules for OAI-SearchBot, ChatGPT-User, PerplexityBot, Perplexity-User, Claude-SearchBot and Claude-User. You can still block training crawlers like GPTBot separately.');

  const training = AI_TRAINING_AGENTS.map((a) => ({ agent: a, allowed: isAllowed(robotsParsed, a, '/').allowed }));
  const blockedTraining = training.filter((t) => !t.allowed).map((t) => t.agent);
  add('findable', 'ai_training_rules', 'AI training crawlers (not scored)', 'info', 0, 0,
    blockedTraining.length ? `You block these training crawlers: ${blockedTraining.join(', ')}. That's your choice and doesn't affect your score. It only controls whether your content trains future models.` : `Training crawlers (${AI_TRAINING_AGENTS.slice(0, 4).join(', ')} and others) are allowed. Blocking them is optional and doesn't affect whether assistants can find you today.`, null);

  if (data.sitemap?.found) add('findable', 'sitemap', 'XML sitemap', 'pass', 4, 4, `Sitemap found at ${data.sitemap.url}${data.sitemap.fromRobots ? ' (listed in robots.txt)' : ''}.`, null);
  else add('findable', 'sitemap', 'XML sitemap', 'fail', 0, 4, data.sitemap?.declaredInRobots ? 'robots.txt lists a sitemap, but it didn\'t load as valid XML.' : 'No XML sitemap found at the usual places.', 'Publish an XML sitemap (most CMSs and SEO plugins do this automatically) and add a "Sitemap:" line to robots.txt.');

  const xNoindex = /noindex/i.test(home.xRobotsTag || '');
  if (homeBlocked) add('findable', 'indexable', 'Homepage can be indexed', 'warn', 1, 4, 'We couldn\'t read your homepage because a security check blocked us, so we can\'t confirm it is indexable.', 'Let verified search and AI bots past your firewall or bot challenge.');
  else if (f.noindexMeta || xNoindex) add('findable', 'indexable', 'Homepage can be indexed', 'fail', 0, 4, `Your homepage tells search engines not to index it (${xNoindex ? 'X-Robots-Tag header' : 'meta robots noindex'}).`, 'Remove the noindex directive from your homepage unless you really want it hidden.');
  else add('findable', 'indexable', 'Homepage can be indexed', 'pass', 4, 4, 'No noindex directive on your homepage.', null);

  const llms = data.llms || {};
  if (llms.ok && llms.hasH1 && (llms.linkCount || 0) > 0) {
    const broken = (llms.checkedLinks || []).filter((l) => !l.ok);
    if (!broken.length) add('findable', 'llms_txt', 'llms.txt guide for AI', 'pass', 3, 3, `llms.txt found with ${llms.linkCount} link(s)${llms.fullExists ? ', plus llms-full.txt' : ''}. The links we checked all work.`, null);
    else add('findable', 'llms_txt', 'llms.txt guide for AI', 'warn', 1.5, 3, `llms.txt found, but ${broken.length} of ${(llms.checkedLinks || []).length} links we checked are broken.`, 'Fix or remove the broken links in /llms.txt.');
  } else if (llms.ok) add('findable', 'llms_txt', 'llms.txt guide for AI', 'warn', 1.5, 3, 'llms.txt exists but doesn\'t follow the usual format (an "# Title" first line and a list of Markdown links to your key pages).', 'Rewrite /llms.txt with a title, a one-line summary and links to your key pages. Our generator below drafts one from this scan.');
  else add('findable', 'llms_txt', 'llms.txt guide for AI', 'warn', 0, 3, 'No /llms.txt. It\'s a newer, optional standard: a short Markdown guide that points AI tools to your most important pages.', 'Add /llms.txt with a summary of your business and links to services, pricing, contact and FAQs. Our generator drafts one from this scan.');

  if (f.canonical) add('findable', 'canonical', 'Canonical URL', 'pass', 2, 2, `Canonical URL set: ${f.canonical}`, null);
  else add('findable', 'canonical', 'Canonical URL', 'warn', 0.5, 2, 'No canonical tag on your homepage, so duplicate URLs can split signals.', 'Add <link rel="canonical"> pointing at your preferred homepage URL.');

  /* ---------------- Understood (25) ---------------- */
  if (f.jsonLdCount > 0) add('understood', 'jsonld', 'Structured data (JSON-LD)', 'pass', 5, 5, `${f.jsonLdCount} JSON-LD block(s) found${f.types.length ? `: ${f.types.slice(0, 8).join(', ')}` : ''}.`, null);
  else if (f.jsonLdErrors) add('understood', 'jsonld', 'Structured data (JSON-LD)', 'fail', 1, 5, 'Your JSON-LD has syntax errors, so machines can\'t read it.', 'Fix the JSON-LD syntax (check it with Google\'s Rich Results Test).');
  else add('understood', 'jsonld', 'Structured data (JSON-LD)', 'fail', 0, 5, 'No structured data. AI tools have to guess what your business is from loose text.', 'Add JSON-LD describing your business (Organization or LocalBusiness), your services or products, and your contact details. Our generator below gets you started.');

  if (f.entityTypes.length) add('understood', 'entity', 'Business identity in schema', 'pass', 4, 4, `You describe yourself as: ${f.entityTypes.slice(0, 4).join(', ')}${f.orgName ? ` ("${String(f.orgName).slice(0, 60)}")` : ''}.`, null);
  else if (f.jsonLdCount) add('understood', 'entity', 'Business identity in schema', 'warn', 1.5, 4, 'You have structured data, but none of it says what kind of business you are (Organization, LocalBusiness, etc.).', 'Add an Organization or LocalBusiness (e.g. Dentist, Restaurant, ProfessionalService) block with name, logo, url and contact details.');
  else add('understood', 'entity', 'Business identity in schema', 'fail', 0, 4, 'Nothing machine-readable says who runs this site or what kind of business it is.', 'Add an Organization or LocalBusiness block with name, logo, url, address and phone.');

  if (f.sameAs.length) add('understood', 'sameas', 'Linked profiles (sameAs)', 'pass', 2, 2, `${f.sameAs.length} official profile(s) linked, which helps AI connect you with your other listings.`, null);
  else add('understood', 'sameas', 'Linked profiles (sameAs)', 'warn', 0.5, 2, 'No sameAs links to your official profiles (Google Business Profile, LinkedIn, Instagram, etc.).', 'Add a sameAs list to your Organization schema linking your official social and directory profiles.');

  const titleOk = f.title && f.title.length >= 10 && f.title.length <= 70;
  const descOk = f.metaDescription && f.metaDescription.length >= 50 && f.metaDescription.length <= 170;
  if (titleOk && descOk) add('understood', 'title_meta', 'Title & meta description', 'pass', 3, 3, `Title (${f.title.length} chars) and description (${f.metaDescription.length} chars) are a good length.`, null);
  else if (f.title || f.metaDescription) add('understood', 'title_meta', 'Title & meta description', 'warn', 1.5, 3, `${!f.title ? 'Missing title. ' : !titleOk ? `Title is ${f.title.length} characters (aim for 10–70). ` : ''}${!f.metaDescription ? 'Missing meta description.' : !descOk ? `Meta description is ${f.metaDescription.length} characters (aim for 50–170).` : ''}`.trim(), 'Write a clear title and a 1–2 sentence meta description saying what you do, for whom and where.');
  else add('understood', 'title_meta', 'Title & meta description', 'fail', 0, 3, 'No page title or meta description.', 'Add a descriptive <title> and meta description.');

  if (f.h1s.length === 1) add('understood', 'h1', 'One clear main heading', 'pass', 2, 2, `Main heading: "${f.h1s[0].slice(0, 90)}"`, null);
  else if (f.h1s.length > 1) add('understood', 'h1', 'One clear main heading', 'warn', 1, 2, `${f.h1s.length} H1 headings on the homepage, which blurs the main topic.`, 'Keep one H1 that states what you do; make the others H2s.');
  else add('understood', 'h1', 'One clear main heading', 'fail', 0, 2, 'No H1 heading on the homepage.', 'Add one H1 that clearly says what your business does.');

  if (homeBlocked) add('understood', 'no_js', 'Content readable without JavaScript', 'fail', 0, 5, 'We got a security check page instead of your content.', 'Let AI assistants through your bot protection so they can read your content.');
  else if (f.words >= 150) add('understood', 'no_js', 'Content readable without JavaScript', 'pass', 5, 5, `About ${f.words} words of real text in the raw HTML, so assistants that don't run JavaScript can still read it.`, null);
  else if (f.words >= 50) add('understood', 'no_js', 'Content readable without JavaScript', 'warn', 2.5, 5, `Only about ${f.words} words of text in the raw HTML${f.spaRoot ? ' (looks like a JavaScript-rendered app)' : ''}. Many AI fetchers don't run JavaScript.`, 'Server-render or pre-render your key content so it is in the HTML.');
  else add('understood', 'no_js', 'Content readable without JavaScript', 'fail', 0, 5, `Almost no text in the raw HTML (${f.words} words)${f.spaRoot ? '; the page is built by JavaScript' : ''}. Most AI fetchers see a blank page.`, 'Use server-side rendering or static pre-rendering so your content ships in the HTML.');

  const ogCount = ['title', 'description', 'image'].filter((k) => f.og[k]).length;
  if (ogCount === 3) add('understood', 'og', 'Open Graph tags', 'pass', 2, 2, 'og:title, og:description and og:image are set, so shared links look right.', null);
  else add('understood', 'og', 'Open Graph tags', ogCount ? 'warn' : 'fail', ogCount * 0.6, 2, `Missing: ${['title', 'description', 'image'].filter((k) => !f.og[k]).map((k) => 'og:' + k).join(', ')}.`, 'Add Open Graph title, description and image tags.');

  const cp = data.contactPage || {};
  const contactBits = ['phone', 'email', 'address'].filter((k) => f.contact[k] || cp.contact?.[k]);
  if (contactBits.length >= 2) add('understood', 'contact_text', 'Contact details as text', 'pass', 2, 2, `Found: ${contactBits.join(', ')}.`, null);
  else add('understood', 'contact_text', 'Contact details as text', contactBits.length ? 'warn' : 'fail', contactBits.length, 2, contactBits.length ? `Only found: ${contactBits.join(', ')}.` : 'No phone, email or address written as text on the homepage or contact page.', 'Write your phone, email and (if you have one) address as plain text, not only in images or maps, and add them to your schema.');

  /* ---------------- Actionable (25) ---------------- */
  const forms = (f.forms || 0) + (cp.forms || 0) > 0 || f.formPlugin || cp.formPlugin;
  const tel = f.links.tel + (cp.tel || 0);
  const mail = f.links.mailto + (cp.mailto || 0);
  const wa = f.links.whatsapp + (cp.whatsapp || 0);
  const booking = [...new Set([...(f.booking || []), ...(cp.booking || [])])];
  const shop = f.shop || [];
  const offerCommerce = !!f.hasProductOffer;
  const paths = [];
  if (forms) paths.push('contact form');
  if (tel) paths.push('click-to-call');
  if (mail) paths.push('email link');
  if (wa) paths.push('WhatsApp');
  if (booking.length) paths.push(`booking (${booking.slice(0, 3).join(', ')})`);
  if (shop.length || offerCommerce) paths.push(`online checkout${shop.length ? ` (${shop.slice(0, 3).join(', ')})` : ''}`);

  if (homeBlocked && !paths.length) add('actionable', 'action_path', 'A way to enquire, book or buy', 'fail', 0, 10, 'Assistants are blocked before they can see any way to contact or buy from you.', 'Let AI assistants past your bot protection.');
  else if (paths.length) add('actionable', 'action_path', 'A way to enquire, book or buy', 'pass', 10, 10, `Action paths found: ${paths.join(', ')}.`, null);
  else add('actionable', 'action_path', 'A way to enquire, book or buy', 'fail', 0, 10, 'We found no contact form, phone or email link, WhatsApp, booking tool or checkout. An assistant has no way to turn interest into a lead.', 'Add at least one clear action path: a simple contact form, a tel: or mailto: link, WhatsApp, or an online booking tool.');

  if (tel || mail || wa) add('actionable', 'direct_links', 'Machine-usable contact links', 'pass', 4, 4, `${[tel && 'tel:', mail && 'mailto:', wa && 'WhatsApp'].filter(Boolean).join(', ')} links let an assistant hand a customer straight to you.`, null);
  else if (forms) add('actionable', 'direct_links', 'Machine-usable contact links', 'warn', 2, 4, 'You only have a form. Assistants find tel:, mailto: or WhatsApp links much easier to hand over.', 'Add a clickable phone (tel:) and email (mailto:) link next to your form.');
  else add('actionable', 'direct_links', 'Machine-usable contact links', 'fail', 0, 4, 'No clickable phone, email or WhatsApp link.', 'Add tel:, mailto: and/or wa.me links in your header or footer.');

  if (f.ctas.length) add('actionable', 'cta', 'Clear call to action', 'pass', 4, 4, `Calls to action found: "${f.ctas.slice(0, 4).join('", "')}".`, null);
  else add('actionable', 'cta', 'Clear call to action', 'warn', 1, 4, 'No obvious "Book", "Get a quote", "Buy" or "Contact us" button or link on the homepage.', 'Add one or two clear, labelled buttons for your main action (e.g. "Book a consultation", "Get a quote").');

  if (f.pricesInText || f.hasOfferPrice) add('actionable', 'prices', 'Prices an assistant can quote', 'pass', 4, 4, f.hasOfferPrice ? 'Prices or a price range are in your structured data.' : 'Prices appear as text on your homepage.', null);
  else add('actionable', 'prices', 'Prices an assistant can quote', 'warn', 1.5, 4, 'No prices visible on the homepage. Assistants often skip businesses they can\'t give a ballpark for.', 'If you can, show starting prices or packages as text (e.g. "from ₹4,999") and in schema (Offer/priceRange).');

  if (booking.length || shop.length || offerCommerce) add('actionable', 'transaction', 'Book or buy online', 'pass', 3, 3, `${booking.length ? `Booking via ${booking.join(', ')}. ` : ''}${shop.length || offerCommerce ? `Shopping signals: ${[...shop, offerCommerce ? 'Product/Offer schema' : null].filter(Boolean).join(', ')}.` : ''}`.trim(), null);
  else add('actionable', 'transaction', 'Book or buy online (not scored)', 'info', 0, 0, 'No online booking or checkout found. That\'s fine for enquiry-led businesses, so it isn\'t counted against you. If customers book appointments or buy products, an online booking tool or checkout lets assistants complete the job.', null);

  const apis = [data.wellKnown?.mcp && 'MCP endpoint', data.wellKnown?.openapi && 'OpenAPI spec', data.wellKnown?.aiPlugin && 'AI plugin manifest', data.wellKnown?.apiCatalog && 'API catalog'].filter(Boolean);
  add('actionable', 'agent_api', 'Agent API / MCP (bonus)', apis.length ? 'pass' : 'info', 0, 0, apis.length ? `Bonus: ${apis.join(', ')} found. Agents can talk to your systems directly.` : 'No public API, OpenAPI spec or MCP endpoint. Optional, and mainly relevant for software and larger commerce sites.', null);
  if (apis.length) checks[checks.length - 1].bonus = 2;

  /* ---------------- Trusted (15) ---------------- */
  if (home.https) add('trusted', 'https', 'Secure connection (HTTPS)', 'pass', 3, 3, 'Your site loads over HTTPS.', null);
  else add('trusted', 'https', 'Secure connection (HTTPS)', 'fail', 0, 3, 'Your site doesn\'t load over HTTPS.', 'Install an SSL certificate and redirect all traffic to https://.');

  const pageCheck = (key, title, why, fix) => {
    const p = data.pages?.[key] || {};
    if (p.ok && p.linked) add('trusted', key, title, 'pass', 2.5, 2.5, `Found and linked: ${p.url}`, null);
    else if (p.ok) add('trusted', key, title, 'warn', 1.5, 2.5, `Found at ${p.url}, but not linked from your homepage.`, `Link your ${key} page from the homepage menu or footer.`);
    else add('trusted', key, title, 'fail', 0, 2.5, why, fix);
  };
  pageCheck('about', 'About page', 'We couldn\'t find an About page. AI tools use it to check who is behind a business.', 'Publish an About page (who you are, experience, location, team) and link it in your menu.');
  pageCheck('contact', 'Contact page', 'We couldn\'t find a Contact page.', 'Publish a Contact page with your phone, email, address and a form, and link it in your menu.');
  pageCheck('privacy', 'Privacy policy', 'We couldn\'t find a privacy policy. Assistants and customers treat a missing one as a warning sign.', 'Publish a privacy policy and link it in your footer.');

  if (f.entityTypes.length || f.metaAuthor || f.orgName) add('trusted', 'identity', 'Who is behind the site', 'pass', 2, 2, f.orgName ? `Your schema names the business or person: "${String(f.orgName).slice(0, 60)}".` : 'Author or organisation details found.', null);
  else add('trusted', 'identity', 'Who is behind the site', 'warn', 0.5, 2, 'No machine-readable organisation or author details.', 'Add Organization (or Person) schema with your legal name, logo and founder/author details.');

  if (f.hasRating) add('trusted', 'reviews', 'Reviews & ratings', 'pass', 2.5, 2.5, 'Review or rating data is in your structured data.', null);
  else add('trusted', 'reviews', 'Reviews & ratings', 'warn', 1, 2.5, 'No review or rating data that machines can read.', 'Show genuine customer reviews on your site and mark them up with Review/AggregateRating schema (following Google\'s guidelines).');

  /* ---------------- Reachable (15) ---------------- */
  if (!homeBlocked && home.status >= 200 && home.status < 300) add('reachable', 'browser', 'Loads for visitors', 'pass', 4, 4, `Your homepage returns HTTP ${home.status}.`, null);
  else add('reachable', 'browser', 'Loads for visitors', 'fail', 0, 4, `Even a normal browser request got ${home.challenge?.reason || `HTTP ${home.status}`}.`, 'Check your firewall and hosting. Your homepage should load directly with HTTP 200.');

  const bots = Object.entries(data.bots || {});
  const blockedBots = bots.filter(([, b]) => b.blocked);
  if (bots.length && !blockedBots.length) add('reachable', 'bots', 'AI assistants get through', 'pass', 6, 6, `${bots.map(([n]) => n).join(', ')} all got your real homepage.`, null);
  else if (bots.length) add('reachable', 'bots', 'AI assistants get through', blockedBots.length === bots.length ? 'fail' : 'warn', 6 * (1 - blockedBots.length / bots.length), 6, `Blocked: ${blockedBots.map(([n, b]) => `${n} (${b.reason})`).join('; ')}. When someone asks an assistant about you, it gets an error or a challenge page instead of your content.`, 'Allow AI assistant user agents through your firewall/CDN bot protection (e.g. Cloudflare "Verified bots", LiteSpeed/Imunify bot rules), and keep blocking abusive bots separately.');

  const ttfb = home.ttfb;
  if (ttfb != null && ttfb < 800) add('reachable', 'ttfb', 'Server response time', 'pass', 2, 2, `First byte in ${ttfb} ms.`, null);
  else if (ttfb != null && ttfb < 1800) add('reachable', 'ttfb', 'Server response time', 'warn', 1, 2, `First byte in ${ttfb} ms. AI fetchers have short timeouts.`, 'Add page caching or a CDN to get server response under 800 ms.');
  else add('reachable', 'ttfb', 'Server response time', 'fail', 0, 2, `Slow server response (${ttfb ?? '?'} ms).`, 'Add full-page caching, upgrade hosting or use a CDN.');

  const kb = Math.round((home.bytes || 0) / 1024);
  if (kb < 500) add('reachable', 'weight', 'HTML page weight', 'pass', 1.5, 1.5, `Homepage HTML is ${kb} KB.`, null);
  else if (kb < 1500) add('reachable', 'weight', 'HTML page weight', 'warn', 0.75, 1.5, `Homepage HTML is ${kb} KB, which is heavy. Some fetchers truncate large pages.`, 'Trim inline scripts, styles and page-builder bloat from the HTML.');
  else add('reachable', 'weight', 'HTML page weight', 'fail', 0, 1.5, `Homepage HTML is ${kb} KB or more. Fetchers may cut it off before your content.`, 'Cut inline code and builder markup; move scripts to external files.');

  const hops = (home.redirects || []).length;
  if (hops <= 1) add('reachable', 'redirects', 'Redirect chain', 'pass', 1.5, 1.5, hops ? `One redirect to ${home.url}.` : 'No redirects on the homepage.', null);
  else if (hops === 2) add('reachable', 'redirects', 'Redirect chain', 'warn', 0.75, 1.5, `${hops} redirects before your homepage loads.`, 'Redirect straight to the final https:// URL in a single hop.');
  else add('reachable', 'redirects', 'Redirect chain', 'fail', 0, 1.5, `${hops} redirects before your homepage loads.`, 'Collapse the redirect chain to a single hop.');

  const flags = [];
  if (blockedBots.length || homeBlocked) flags.push({ type: 'blocked', text: homeBlocked ? 'A firewall or bot challenge blocks automated visitors, including AI assistants. Your score is capped at 59 until it is fixed.' : `Your firewall or CDN blocks ${blockedBots.map(([n]) => n).join(', ')}. Your score is capped at 59 until AI assistants can get through.` });
  if (robotsBlocksAll) flags.push({ type: 'blocked', text: 'robots.txt blocks every AI search bot. Your score is capped at 59.' });
  return finalize(data, checks, { cap: flags.length ? BLOCK_CAP : null, flags });
}

function finalize(data, checks, { fatal = null, cap = null, flags = [] } = {}) {
  const categories = CATEGORIES.map((c) => {
    const cc = checks.filter((k) => k.category === c.id);
    const max = cc.reduce((s, k) => s + k.max, 0);
    const pts = cc.reduce((s, k) => s + k.points + (k.bonus || 0), 0);
    const ratio = max ? Math.min(1, pts / max) : 0;
    return { ...c, score: Math.round(ratio * c.weight * 10) / 10, ratio, pct: Math.round(ratio * 100) };
  });
  let raw = Math.round(categories.reduce((s, c) => s + c.score, 0));
  if (fatal) raw = 0;
  const score = cap != null ? Math.min(raw, cap) : raw;

  // impact = points of the final 100 a fix would recover
  const fixes = checks
    .filter((k) => k.fix && k.max > 0 && k.points < k.max)
    .map((k) => {
      const cat = CATEGORIES.find((c) => c.id === k.category);
      const catMax = checks.filter((x) => x.category === k.category).reduce((s, x) => s + x.max, 0) || 1;
      const blockerBoost = ['bots', 'ai_search_rules', 'browser', 'no_js'].includes(k.id) && cap != null ? 20 : 0;
      return { id: k.id, category: k.category, categoryName: cat.name, title: k.title, fix: k.fix, detail: k.detail, status: k.status, impact: Math.round(((k.max - k.points) / catMax) * cat.weight * 10) / 10, rank: ((k.max - k.points) / catMax) * cat.weight + blockerBoost, service: cat.service };
    })
    .sort((a, b) => b.rank - a.rank);

  return {
    domain: data.domain,
    finalUrl: data.finalUrl || null,
    scannedAt: new Date().toISOString(),
    score,
    rawScore: raw,
    grade: gradeFor(score),
    capped: cap != null && raw > cap,
    fatal,
    flags,
    categories,
    checks,
    fixes,
    bots: data.bots || {},
    facts: data.facts ? {
      title: data.facts.title, metaDescription: data.facts.metaDescription, h1: data.facts.h1s?.[0] || null,
      orgName: data.facts.orgName, entityTypes: data.facts.entityTypes, sameAs: data.facts.sameAs?.slice(0, 10),
      pageLinks: data.pages ? Object.fromEntries(Object.entries(data.pages).filter(([, p]) => p.ok).map(([k, p]) => [k, p.url])) : {},
      sitemap: data.sitemap?.url || null, contact: data.facts.contact, lang: data.facts.lang, ogImage: data.facts.og?.image || null,
    } : null,
  };
}

module.exports = { analyze, gradeFor, CATEGORIES, AI_SEARCH_AGENTS, AI_TRAINING_AGENTS, BLOCK_CAP };
