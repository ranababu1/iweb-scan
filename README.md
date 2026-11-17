# iweb-scan

AI readiness scanner for [iWeb & SEO](https://iwebandseo.com). Enter a domain and get a 0–100 score (grade A–F) showing whether AI assistants such as ChatGPT, Gemini, Perplexity and Claude can **find** the site, **understand** the business, and **act** on it (enquire, book, buy), with ranked, plain-English fixes.

Live: https://scan.iwebandseo.com

## What it checks

| Category | Weight | Examples |
| --- | --- | --- |
| Findable | 20 | robots.txt rules for AI search/assistant bots (training crawlers noted, not scored), XML sitemap, noindex, llms.txt (+ links resolve), canonical |
| Understood | 25 | JSON-LD, Organization/LocalBusiness/Person types, sameAs, title + meta description, single H1, text readable without JS, Open Graph, contact details as text |
| Actionable | 25 | any real action path (form, tel:, mailto:, WhatsApp, booking widget, checkout), CTAs, prices as text/schema; online booking/checkout counted only when present; API/MCP is a bonus |
| Trusted | 15 | HTTPS, About / Contact / Privacy pages, organisation identity, reviews/ratings schema |
| Reachable | 15 | homepage 200 for a browser and for ChatGPT-User, OAI-SearchBot, PerplexityBot, ClaudeBot (WAF/challenge detection), TTFB, HTML weight, redirect chain |

If AI bots are blocked by a firewall/challenge, or robots.txt blocks every AI search bot, the total is capped at **59**.

Grades: A 90+, B 75–89, C 55–74, D 35–54, F below 35.

## Routes

- `/` landing page with the scan form
- `GET|POST /api/scan?domain=example.com` runs a scan (cached for `CACHE_TTL_MINUTES`, rate-limited per IP) and returns `{ score, grade, url }`
- `/score/{domain}` public, shareable report (`/api/report/{domain}` for JSON)
- `/badge/{domain}.svg` embeddable badge
- `/tools` llms.txt, robots.txt and JSON-LD generators (pre-filled with `?domain=`)
- `/bot` explains the iWebScan crawler; `/privacy`
- `POST /api/lead` stores "free fix plan" requests in `DATA_DIR/leads.jsonl`; `GET /admin/leads.csv?token=ADMIN_TOKEN` exports them when `ADMIN_TOKEN` is set

## Safety

- Domains only (no IPs, no internal TLDs); every connection's DNS answer is checked and private/reserved IPs are refused (blocks SSRF and DNS rebinding); ports 80/443 only; redirects re-validated per hop.
- Per-request timeouts, 3 MB body cap, max 4 concurrent scans, 45 s overall timeout.
- Identifies itself as `iWebScan/1.0 (+https://scan.iwebandseo.com/bot)`.

## Run locally

```bash
npm install
npm test
npm start            # http://localhost:3000
```

Copy `.env.example` to `.env` values as environment variables if you need to change defaults (the app reads `process.env`; it doesn't load `.env` files itself).

## Deploy (Hostinger Node.js)

Hostinger builds the repo with `npm install` and runs `npm start` (`node server.js`); the port comes from `process.env.PORT`. Node 18.17+.

1. hPanel → Websites → `scan.iwebandseo.com` (Node.js app) → connected to this GitHub repo, branch `main`.
2. Push to `main` to redeploy.
3. Optional environment variables: `PUBLIC_BASE_URL`, `ADMIN_TOKEN`, `DATA_DIR`.

Cached reports and leads live in `DATA_DIR` (default `./data`). A redeploy can replace the app folder, so point `DATA_DIR` at a folder outside the app directory if you want leads to survive deploys.

## Regenerate OG images

```bash
npm run og
```
