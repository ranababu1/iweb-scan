'use strict';
const goodHtml = `<!doctype html><html lang="en"><head>
<title>Smile Dental Clinic – Dentist in Bengaluru</title>
<meta name="description" content="Family and cosmetic dentistry in Indiranagar, Bengaluru. Book a check-up online or call us today.">
<link rel="canonical" href="https://smile.example/">
<meta property="og:title" content="Smile Dental"><meta property="og:description" content="Dentist"><meta property="og:image" content="https://smile.example/og.png">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Dentist","name":"Smile Dental Clinic","telephone":"+91 98765 43210","address":{"@type":"PostalAddress","streetAddress":"12 100 Feet Road"},"sameAs":["https://instagram.com/smile"],"aggregateRating":{"@type":"AggregateRating","ratingValue":4.8,"reviewCount":120},"priceRange":"₹₹"}</script>
</head><body>
<nav><a href="/about">About</a><a href="/contact">Contact</a><a href="/privacy-policy">Privacy</a></nav>
<h1>Gentle dentistry in Indiranagar</h1>
<p>${'We look after families with gentle, modern dental care. '.repeat(30)}</p>
<p>Check-ups from ₹799.</p>
<a href="tel:+919876543210">Call us</a> <a href="mailto:hi@smile.example">Email</a>
<a class="btn" href="https://calendly.com/smile/checkup">Book a check-up</a>
</body></html>`;

const thinHtml = '<!doctype html><html><head><title>App</title></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>';

const challengeHtml = '<!DOCTYPE html><html><head><title>Just a moment...</title></head><body><div id="challenge-platform"></div></body></html>';

const okBots = (bytes = 5000) => Object.fromEntries(['ChatGPT-User', 'OAI-SearchBot', 'PerplexityBot', 'ClaudeBot'].map((n) => [n, { status: 200, blocked: false, reason: null, bytes }]));

module.exports = { goodHtml, thinHtml, challengeHtml, okBots };
