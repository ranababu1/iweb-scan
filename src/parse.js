'use strict';
const cheerio = require('cheerio');

const CHALLENGE_MARKERS = [
  [/cf-chl-|challenge-platform|cf_chl_opt|<title>just a moment\.\.\.<\/title>/i, 'Cloudflare challenge'],
  [/attention required! \| cloudflare|cf-error-details|sorry, you have been blocked/i, 'Cloudflare block'],
  [/sucuri website firewall|sucuri_cloudproxy|access denied - sucuri/i, 'Sucuri firewall'],
  [/lsrecaptcha|litespeed.{0,40}(captcha|bot)/i, 'LiteSpeed bot check'],
  [/imunify360|bot-protection.{0,40}imunify/i, 'Imunify360 bot protection'],
  [/vercel security checkpoint/i, 'Vercel security checkpoint'],
  [/_incapsula_resource|incapsula incident/i, 'Imperva/Incapsula'],
  [/datadome|geo\.captcha-delivery\.com/i, 'DataDome'],
  [/px-captcha|perimeterx/i, 'PerimeterX/HUMAN'],
  [/<title>challenge validation<\/title>|id="sec-cpt-if"|sec-if-container/i, 'Akamai bot challenge'],
  [/<title>access denied<\/title>[\s\S]{0,800}reference(&#32;| )#/i, 'Akamai block'],
  [/checking (if the site connection is secure|your browser before accessing)|ddos protection by/i, 'Bot challenge'],
  [/sgcaptcha|\.well-known\/sgcaptcha/i, 'SiteGround captcha'],
  [/hcdn-cgi|hostinger.{0,40}(security|challenge)/i, 'Hostinger CDN challenge'],
];

function detectChallenge(res) {
  if (!res) return { blocked: true, reason: 'No response' };
  if (res.error) return { blocked: true, reason: res.error };
  if ([401, 403, 406, 429, 503].includes(res.status)) {
    const m = CHALLENGE_MARKERS.find(([re]) => re.test(res.text || ''));
    return { blocked: true, reason: `HTTP ${res.status}${m ? ' – ' + m[1] : ''}` };
  }
  if (res.status >= 400) return { blocked: true, reason: `HTTP ${res.status}` };
  const text = res.text || '';
  // Only inspect small pages for markers: real sites can mention "captcha" in big pages.
  if (text.length < 40000) {
    const m = CHALLENGE_MARKERS.find(([re]) => re.test(text));
    if (m) return { blocked: true, reason: m[1] };
  }
  return { blocked: false, reason: null };
}

const LOCAL_TYPES = /(Organization|Corporation|LocalBusiness|Business|Store|Shop|Restaurant|Cafe|Bakery|BarOrPub|Hotel|LodgingBusiness|Resort|Hostel|MedicalBusiness|MedicalClinic|Dentist|Physician|Hospital|Pharmacy|LegalService|Attorney|Notary|RealEstateAgent|ProfessionalService|FinancialService|AccountingService|InsuranceAgency|AutoRepair|AutoDealer|HealthAndBeautyBusiness|BeautySalon|DaySpa|HairSalon|ExerciseGym|SportsActivityLocation|EducationalOrganization|School|CollegeOrUniversity|NGO|GovernmentOrganization|TravelAgency|HomeAndConstructionBusiness|Plumber|Electrician|Locksmith|FoodEstablishment|EntertainmentBusiness|Airline|OnlineBusiness|OnlineStore)$/;
const OFFER_TYPES = /^(Product|ProductGroup|Service|Offer|AggregateOffer|SoftwareApplication|Course|Event|Menu|Book|IndividualProduct)$/;

function flattenJsonLd(node, out = []) {
  if (Array.isArray(node)) { node.forEach((n) => flattenJsonLd(n, out)); return out; }
  if (node && typeof node === 'object') {
    out.push(node);
    for (const v of Object.values(node)) if (v && typeof v === 'object') flattenJsonLd(v, out);
  }
  return out;
}

function typesOf(obj) {
  const t = obj['@type'];
  return (Array.isArray(t) ? t : t ? [t] : []).map((x) => String(x).replace(/^https?:\/\/schema\.org\//, ''));
}

function visibleText($) {
  const clone = $.root().clone();
  clone.find('script,style,noscript,template,svg,iframe').remove();
  return clone.text().replace(/\s+/g, ' ').trim();
}

const BOOKING_SIGNS = [
  ['Calendly', /calendly\.com/i], ['Cal.com', /\bcal\.com\/|app\.cal\.com/i], ['Acuity', /acuityscheduling\.com|as\.me\//i],
  ['SimplyBook', /simplybook\.(me|it|asia)/i], ['OpenTable', /opentable\.(com|co\.uk|in)/i], ['Resy', /resy\.com/i],
  ['SevenRooms', /sevenrooms\.com/i], ['Tock', /exploretock\.com/i], ['TableCheck', /tablecheck\.com/i],
  ['EazyDiner', /eazydiner\.com/i], ['Dineout', /dineout\.co\.in/i], ['Setmore', /setmore\.com/i],
  ['Square Appointments', /squareup\.com\/appointments|book\.squareup\.com|square\.site\/book/i], ['Fresha', /fresha\.com/i],
  ['Vagaro', /vagaro\.com/i], ['Mindbody', /mindbodyonline\.com|mindbody\.io/i], ['Zocdoc', /zocdoc\.com/i], ['Practo', /practo\.com/i],
  ['TidyCal', /tidycal\.com/i], ['YouCanBook.me', /youcanbook\.me/i], ['HubSpot Meetings', /meetings(-[a-z0-9]+)?\.hubspot\.com/i],
  ['Zoho Bookings', /bookings\.zoho|zohobookings/i], ['Google appointments', /calendar\.app\.google|calendar\.google\.com\/calendar\/appointments/i],
  ['Bookeo', /bookeo\.com/i], ['Checkfront', /checkfront\.com/i], ['FareHarbor', /fareharbor\.com/i], ['Peek', /peek\.com\/book/i],
  ['Cloudbeds', /cloudbeds\.com/i], ['SiteMinder', /siteminder\.com|thebookingbutton/i], ['SynXis', /synxis\.com/i], ['Mews', /mews\.(com|li)\/(distributor|booking)/i],
  ['Little Hotelier', /littlehotelier\.com/i], ['Beds24', /beds24\.com/i], ['eZee', /ezeeabsolute|live\.ipms247\.com/i], ['Booking.com', /booking\.com\/hotel/i],
  ['Amelia', /amelia-booking|wpamelia/i], ['Bookly', /bookly-form|bookly-js/i], ['WooCommerce Bookings', /wc-bookings/i],
];
const SHOP_SIGNS = [
  ['WooCommerce', /add_to_cart_button|ajax_add_to_cart|wc-block-mini-cart|woocommerce-mini-cart|wc-block-cart|single_add_to_cart/i], ['Shopify', /cdn\.shopify\.com|shopify\.theme|myshopify\.com/i],
  ['BigCommerce', /bigcommerce\.com|stencil-utils/i], ['Magento', /mage\/cookies|magento/i], ['PrestaShop', /prestashop/i],
  ['Wix Stores', /wixstores|wix-ecommerce/i], ['Squarespace Commerce', /squarespace-commerce|sqs-add-to-cart/i], ['Ecwid', /ecwid\.com|app\.ecwid/i],
  ['Snipcart', /snipcart/i], ['Stripe Payment Link', /buy\.stripe\.com|checkout\.stripe\.com/i], ['Razorpay', /razorpay\.(com|me)|rzp\.io/i],
  ['PayPal', /paypal\.com\/(sdk|cgi-bin\/webscr)|paypalobjects/i], ['Gumroad', /gumroad\.com/i], ['Lemon Squeezy', /lemonsqueezy\.com/i],
  ['Cart/checkout links', /href=["'][^"']*\/(cart|checkout|basket)(\/|["'?])/i],
];
const FORM_PLUGINS = /wpcf7|gform_wrapper|wpforms|elementor-form|forminator|ninja-forms|fluentform|hsforms|hbspt\.forms|typeform\.com|jotform|formspree\.io|tally\.so|getform\.io|basin|netlify(-|\s)?form|zohopublic.*form|google\.com\/forms|forms\.gle|hubspot.*form/i;
const CTA_WORDS = /\b(book( now| a| an| online| your)?|reserve|schedule|get (a |your )?(quote|estimate|started|in touch|demo|free)|contact us|talk to|enquire|inquire|request|buy( now)?|shop( now)?|order( now| online)?|add to cart|subscribe|sign up|start (free|trial|now)|call (us|now)|whatsapp|hire|apply|donate|try (it )?free|free trial|let'?s talk)\b/i;
const PRICE_RE = /([$€£₹¥]\s?\d[\d,]*(\.\d{1,2})?|\b\d[\d,]*(\.\d{1,2})?\s?(USD|EUR|GBP|INR|AUD|CAD|AED|SGD)\b|\b(Rs\.?|INR|USD)\s?\d[\d,]*)/;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/i;
const PHONE_RE = /(\+\d{1,3}[\s.-]?\(?\d{1,4}\)?([\s.-]?\d{2,5}){2,4}|\(\d{3}\)\s?\d{3}[\s.-]\d{4}|\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b)/;
const ADDRESS_RE = /\b\d{1,5}\s+[A-Za-z0-9 .'-]{2,40}\b(street|st\.|road|rd\.|avenue|ave\.|lane|ln\.|boulevard|blvd|drive|dr\.|marg|nagar|layout|cross|main road|sector|floor)\b|\b(pin(code)?|zip)[:\s-]*\d{5,6}\b|\b[A-Z][a-z]+,\s*[A-Z]{2}\s+\d{5}\b|\b\d{3}\s?\d{3}\b,?\s*(india)/i;

function absolute(href, base) {
  try { return new URL(href, base).toString(); } catch { return null; }
}

function findLink($, base, origin, patterns) {
  const hits = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().replace(/\s+/g, ' ').trim().toLowerCase();
    const abs = absolute(href, base);
    if (!abs) return;
    let u;
    try { u = new URL(abs); } catch { return; }
    if (!/^https?:$/.test(u.protocol)) return;
    const sameSite = u.hostname.replace(/^www\./, '') === new URL(origin).hostname.replace(/^www\./, '');
    if (!sameSite) return;
    const path = u.pathname.toLowerCase();
    if (patterns.some((p) => p.test(path) || p.test(text))) hits.push(u.toString().split('#')[0]);
  });
  return hits[0] || null;
}

/** Extract everything the checks need from homepage HTML. */
function extract(html, baseUrl) {
  const $ = cheerio.load(html || '');
  const origin = (() => { try { return new URL(baseUrl).origin; } catch { return baseUrl; } })();

  const jsonLdBlocks = [];
  let jsonLdErrors = 0;
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text().trim();
    if (!raw) return;
    try { jsonLdBlocks.push(JSON.parse(raw)); } catch { jsonLdErrors++; }
  });
  const nodes = flattenJsonLd(jsonLdBlocks);
  const types = [...new Set(nodes.flatMap(typesOf))];
  const entityTypes = types.filter((t) => LOCAL_TYPES.test(t) || t === 'Person');
  const offerTypes = types.filter((t) => OFFER_TYPES.test(t));
  const sameAs = [...new Set(nodes.flatMap((n) => (Array.isArray(n.sameAs) ? n.sameAs : n.sameAs ? [n.sameAs] : [])))];
  const hasRating = types.some((t) => t === 'AggregateRating' || t === 'Review') || nodes.some((n) => n.aggregateRating || n.review);
  const hasOfferPrice = nodes.some((n) => (typesOf(n).some((t) => /Offer/.test(t)) && (n.price != null || n.lowPrice != null)) || n.priceRange);
  const hasProductOffer = nodes.some((n) => typesOf(n).some((t) => /^(Product|ProductGroup|IndividualProduct)$/.test(t)) && n.offers);
  const hasAddressSchema = nodes.some((n) => n.address || typesOf(n).includes('PostalAddress'));
  const schemaPhone = nodes.some((n) => n.telephone);
  const schemaEmail = nodes.some((n) => n.email);
  const orgName = nodes.find((n) => typesOf(n).some((t) => LOCAL_TYPES.test(t) || t === 'Person') && n.name)?.name || null;

  const text = visibleText($);
  const words = text ? text.split(' ').filter((w) => /[\p{L}\p{N}]/u.test(w)).length : 0;
  const rawHtml = html || '';

  const metaRobots = ($('meta[name="robots"]').attr('content') || '') + ' ' + ($('meta[name="googlebot"]').attr('content') || '');
  const hrefs = $('a[href]').map((_, el) => $(el).attr('href') || '').get();
  const tel = hrefs.filter((h) => /^tel:/i.test(h));
  const mailto = hrefs.filter((h) => /^mailto:/i.test(h));
  const whatsapp = hrefs.filter((h) => /wa\.me\/|api\.whatsapp\.com|whatsapp:\/\/|web\.whatsapp\.com\/send/i.test(h));
  const forms = $('form').filter((_, f) => $(f).find('textarea, input[type="email"], input[name*="email" i], input[type="tel"]').length > 0).length;
  const formPlugin = FORM_PLUGINS.test(rawHtml);
  const booking = BOOKING_SIGNS.filter(([, re]) => re.test(rawHtml)).map(([n]) => n);
  const shop = SHOP_SIGNS.filter(([, re]) => re.test(rawHtml)).map(([n]) => n);
  const ctaTexts = [];
  $('a, button, input[type="submit"]').each((_, el) => {
    const t = ($(el).text() || $(el).attr('value') || $(el).attr('aria-label') || '').replace(/\s+/g, ' ').trim();
    const m = t && t.length < 45 ? t.match(CTA_WORDS) : null;
    if (m && m.index <= 12 && !/\.[a-z]{2,}$/i.test(t)) ctaTexts.push(t);
  });

  const linkPatterns = {
    about: [/\/(about|about-us|who-we-are|our-story|company|team)(\/|$|\.html?)/, /^about( us)?$/],
    contact: [/\/(contact|contact-us|get-in-touch|reach-us|support)(\/|$|\.html?)/, /^(contact( us)?|get in touch)$/],
    privacy: [/\/(privacy|privacy-policy|privacy-notice|legal\/privacy|policies\/privacy-policy)(\/|$|\.html?)/, /privacy/],
  };

  return {
    title: $('head > title').first().text().replace(/\s+/g, ' ').trim() || $('title').first().text().trim(),
    metaDescription: ($('meta[name="description"]').attr('content') || '').trim(),
    h1s: $('h1').map((_, el) => $(el).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean),
    canonical: $('link[rel="canonical"]').attr('href') || null,
    noindexMeta: /noindex/i.test(metaRobots),
    og: {
      title: $('meta[property="og:title"]').attr('content') || null,
      description: $('meta[property="og:description"]').attr('content') || null,
      image: $('meta[property="og:image"]').attr('content') || null,
    },
    metaAuthor: $('meta[name="author"]').attr('content') || null,
    lang: $('html').attr('lang') || null,
    jsonLdCount: jsonLdBlocks.length,
    jsonLdErrors,
    types,
    entityTypes,
    offerTypes,
    sameAs,
    hasRating,
    hasOfferPrice,
    hasProductOffer,
    hasAddressSchema,
    orgName,
    words,
    spaRoot: /<div[^>]+id=["'](root|app|__next|__nuxt|svelte)["'][^>]*>\s*<\/div>/i.test(rawHtml),
    text: text.slice(0, 20000),
    contact: {
      phone: tel.length > 0 || schemaPhone || PHONE_RE.test(text),
      email: mailto.length > 0 || schemaEmail || EMAIL_RE.test(text.replace(/\S+\.(png|jpe?g|webp|svg|gif)\b/gi, '')),
      address: hasAddressSchema || ADDRESS_RE.test(text),
    },
    links: { tel: tel.length, mailto: mailto.length, whatsapp: whatsapp.length },
    forms,
    formPlugin,
    booking,
    shop,
    ctas: [...new Set(ctaTexts)].slice(0, 8),
    pricesInText: PRICE_RE.test(text),
    pageLinks: {
      about: findLink($, baseUrl, origin, linkPatterns.about),
      contact: findLink($, baseUrl, origin, linkPatterns.contact),
      privacy: findLink($, baseUrl, origin, linkPatterns.privacy),
    },
    hasLlmsLink: /href=["'][^"']*llms(-full)?\.txt/i.test(rawHtml),
  };
}

function parseLlmsTxt(text) {
  const t = String(text || '').trim();
  const lines = t.split(/\r?\n/).filter((l) => l.trim());
  const looksHtml = /^\s*<(!doctype|html|head|body)/i.test(t);
  const hasH1 = lines.length > 0 && /^#\s+\S/.test(lines[0]);
  const links = [...t.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g)].map((m) => m[2]);
  const hasSummary = lines.some((l) => /^>\s*\S/.test(l));
  return { looksHtml, hasH1, hasSummary, links, lines: lines.length };
}

module.exports = { extract, detectChallenge, parseLlmsTxt, CHALLENGE_MARKERS };
