'use strict';
// Dev-only: renders the static Open Graph images in public/og (run: npm run og).
const fs = require('node:fs');
const path = require('node:path');
const { Resvg } = require('@resvg/resvg-js');

const colors = { A: '#16a34a', B: '#65a30d', C: '#d97706', D: '#ea580c', F: '#dc2626' };
const words = { A: 'Excellent', B: 'Good', C: 'Fair', D: 'Weak', F: 'Poor' };
const out = path.join(__dirname, '..', 'public', 'og');

function svg(grade) {
  const g = grade ? `<circle cx="960" cy="315" r="150" fill="${colors[grade]}"/><text x="960" y="370" text-anchor="middle" font-size="170" font-weight="800" fill="#fff">${grade}</text><text x="960" y="520" text-anchor="middle" font-size="40" fill="#cbd5e1">${words[grade]} AI readiness</text>`
    : `<circle cx="960" cy="315" r="150" fill="none" stroke="#818cf8" stroke-width="22"/><text x="960" y="350" text-anchor="middle" font-size="96" font-weight="800" fill="#fff">0–100</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" font-family="Inter, Roboto, DejaVu Sans, sans-serif">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e1b4b"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="70" y="70" width="110" height="52" rx="12" fill="#6366f1"/><text x="125" y="106" text-anchor="middle" font-size="28" font-weight="800" fill="#fff">IWS</text>
  <text x="200" y="107" font-size="30" fill="#c7d2fe" font-weight="600">AI Readiness Scan</text>
  <text x="70" y="250" font-size="60" font-weight="800" fill="#fff">Can AI assistants</text>
  <text x="70" y="325" font-size="60" font-weight="800" fill="#fff">find you, understand</text>
  <text x="70" y="400" font-size="60" font-weight="800" fill="#fff">you, and book you?</text>
  <text x="70" y="520" font-size="32" fill="#a5b4fc">scan.iwebandseo.com</text>
  ${g}
</svg>`;
}

fs.mkdirSync(out, { recursive: true });
for (const g of [null, 'A', 'B', 'C', 'D', 'F']) {
  const png = new Resvg(svg(g), { font: { loadSystemFonts: true } }).render().asPng();
  fs.writeFileSync(path.join(out, `${g || 'default'}.png`), png);
  console.log('wrote', g || 'default', png.length);
}
