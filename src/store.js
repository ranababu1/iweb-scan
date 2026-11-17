'use strict';
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const CACHE_DIR = path.join(DATA_DIR, 'cache');
const TTL_MS = Number(process.env.CACHE_TTL_MINUTES || 60) * 60 * 1000;
fs.mkdirSync(CACHE_DIR, { recursive: true });

const file = (domain) => path.join(CACHE_DIR, domain.replace(/[^a-z0-9.-]/g, '_') + '.json');

function getReport(domain) {
  try {
    const raw = fs.readFileSync(file(domain), 'utf8');
    const report = JSON.parse(raw);
    report.ageMs = Date.now() - Date.parse(report.scannedAt);
    report.fresh = report.ageMs < TTL_MS;
    return report;
  } catch {
    return null;
  }
}

function saveReport(report) {
  const tmp = file(report.domain) + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(report));
  fs.renameSync(tmp, file(report.domain));
}

function recentReports(limit = 8) {
  try {
    return fs.readdirSync(CACHE_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({ f, t: fs.statSync(path.join(CACHE_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
      .slice(0, limit)
      .map(({ f }) => getReport(f.replace(/\.json$/, '')))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function saveLead(lead) {
  fs.appendFileSync(path.join(DATA_DIR, 'leads.jsonl'), JSON.stringify(lead) + '\n');
}

function readLeads() {
  try {
    return fs.readFileSync(path.join(DATA_DIR, 'leads.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

module.exports = { getReport, saveReport, recentReports, saveLead, readLeads, DATA_DIR, TTL_MS };
