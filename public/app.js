(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function normalize(v) {
    v = String(v || '').trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split(/[\/?#]/)[0].replace(/:\d+$/, '').replace(/\.$/, '');
    return /^([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(v) || /^([a-z0-9-]{1,63}\.)+xn--[a-z0-9-]+$/.test(v) ? v : null;
  }

  function progress(box) {
    if (!box) return function () {};
    box.hidden = false;
    var bar = $('.bar span', box), steps = $$('li', box), pct = 4, i = 0;
    var t = setInterval(function () {
      pct = Math.min(94, pct + (100 - pct) * 0.07);
      bar.style.width = pct + '%';
      var idx = Math.min(steps.length - 1, Math.floor(pct / 25));
      for (; i <= idx; i++) steps[i].classList.add('on');
    }, 600);
    return function (done) { clearInterval(t); bar.style.width = done ? '100%' : '0'; };
  }

  function runScan(domain, msgEl, box, onFail) {
    var stop = progress(box);
    fetch('/api/scan?domain=' + encodeURIComponent(domain), { headers: { accept: 'application/json' } })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.j.error || 'Scan failed');
        stop(true);
        window.location.href = res.j.url;
      })
      .catch(function (e) {
        stop(false);
        if (msgEl) msgEl.textContent = e.message || 'Scan failed. Please try again.';
        if (onFail) onFail();
      });
  }

  $$('[data-scan-form]').forEach(function (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var input = $('input[name=domain]', form);
      var msg = form.nextElementSibling && form.nextElementSibling.matches('[data-form-msg]') ? form.nextElementSibling : null;
      var d = normalize(input.value);
      if (!d) { if (msg) msg.textContent = 'Please enter a domain like yourbusiness.com'; return; }
      if (msg) msg.textContent = '';
      var btn = $('button', form);
      btn.disabled = true; btn.textContent = 'Scanning…';
      var box = form.parentNode.querySelector('[data-progress]');
      runScan(d, msg, box, function () { btn.disabled = false; btn.textContent = 'Check my business free'; });
    });
  });

  var auto = $('[data-autoscan]');
  if (auto) runScan(auto.getAttribute('data-autoscan'), $('[data-form-msg]'), auto);

  $$('[data-rescan]').forEach(function (b) {
    b.addEventListener('click', function () {
      b.disabled = true; b.textContent = 'Scanning…';
      runScan(b.getAttribute('data-rescan'), $('[data-form-msg]'), null, function () { b.disabled = false; b.textContent = 'Scan again'; });
    });
  });

  $$('[data-share]').forEach(function (b) {
    b.addEventListener('click', function () {
      var url = b.getAttribute('data-url'), text = decodeURIComponent(b.getAttribute('data-text'));
      if (navigator.share) { navigator.share({ title: document.title, text: text, url: url }).catch(function () {}); return; }
      navigator.clipboard && navigator.clipboard.writeText(text + ' ' + url).then(function () { b.textContent = 'Link copied'; setTimeout(function () { b.textContent = 'Share report'; }, 2000); });
    });
  });

  var lead = $('[data-lead-form]');
  if (lead) lead.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var msg = $('[data-lead-msg]', lead), btn = $('button', lead);
    var data = {}; new FormData(lead).forEach(function (v, k) { data[k] = v; });
    btn.disabled = true;
    fetch('/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.j.error || 'Something went wrong');
        lead.innerHTML = '<p><strong>Thanks!</strong> The iWeb &amp; SEO team will be in touch about your fix plan.</p>';
      })
      .catch(function (e) { btn.disabled = false; msg.textContent = e.message; });
  });

  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = $(b.getAttribute('data-copy'));
      if (!t) return;
      t.select();
      (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.resolve(document.execCommand('copy'))).then(function () {
        var o = b.textContent; b.textContent = 'Copied'; setTimeout(function () { b.textContent = o; }, 1500);
      });
    });
  });

  // llms.txt generator
  var llmsBtn = $('[data-llms-build]');
  if (llmsBtn) llmsBtn.addEventListener('click', function () {
    var name = $('[data-llms=name]').value.trim() || 'Your business';
    var summary = $('[data-llms=summary]').value.trim();
    var lines = $('[data-llms=links]').value.split('\n').map(function (l) { return l.split('|').map(function (x) { return x.trim(); }); }).filter(function (p) { return p[0] && p[1]; });
    var out = ['# ' + name, ''];
    if (summary) out.push('> ' + summary, '');
    out.push('## Key pages');
    lines.forEach(function (p) { out.push('- [' + p[0] + '](' + p[1] + ')' + (p[2] ? ': ' + p[2] : '')); });
    $('[data-llms-out]').value = out.join('\n') + '\n';
  });

  // robots.txt snippet
  var robotsOut = $('[data-robots-out]');
  function buildRobots() {
    var block = $('[data-robots-training]').checked;
    var search = ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Claude-SearchBot', 'Claude-User'];
    var training = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'CCBot'];
    var out = ['# AI search & assistant bots: allowed so they can find and cite you'];
    search.forEach(function (a) { out.push('User-agent: ' + a); });
    out.push('Allow: /', '');
    out.push('# AI training crawlers: ' + (block ? 'blocked (optional)' : 'allowed (optional)'));
    training.forEach(function (a) { out.push('User-agent: ' + a); });
    out.push(block ? 'Disallow: /' : 'Allow: /', '');
    out.push('Sitemap: ' + $('[data-robots-sitemap]').value);
    robotsOut.value = out.join('\n') + '\n';
  }
  if (robotsOut) { buildRobots(); $('[data-robots-training]').addEventListener('change', buildRobots); }

  // JSON-LD generator
  var schemaOut = $('[data-schema-out]');
  function buildSchema() {
    var g = function (k) { var el = $('[data-schema=' + k + ']'); return el ? el.value.trim() : ''; };
    var o = { '@context': 'https://schema.org', '@type': g('type') || 'Organization', name: g('name'), url: g('url') };
    if (g('logo')) { o.logo = g('logo'); if (o['@type'] !== 'Organization') o.image = g('logo'); }
    if (g('description')) o.description = g('description');
    if (g('telephone')) o.telephone = g('telephone');
    if (g('email')) o.email = g('email');
    if (g('streetAddress') || g('addressLocality')) {
      o.address = { '@type': 'PostalAddress', streetAddress: g('streetAddress') || undefined, addressLocality: g('addressLocality') || undefined, addressRegion: g('addressRegion') || undefined, postalCode: g('postalCode') || undefined, addressCountry: g('addressCountry') || undefined };
    }
    if (g('openingHours') && o['@type'] !== 'Organization') o.openingHours = g('openingHours');
    if (g('priceRange') && o['@type'] !== 'Organization') o.priceRange = g('priceRange');
    var same = g('sameAs').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (same.length) o.sameAs = same;
    schemaOut.value = '<script type="application/ld+json">\n' + JSON.stringify(o, null, 2) + '\n</' + 'script>';
  }
  if (schemaOut) { buildSchema(); $$('[data-schema]').forEach(function (el) { el.addEventListener('input', buildSchema); el.addEventListener('change', buildSchema); }); }
})();
