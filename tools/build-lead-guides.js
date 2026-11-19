#!/usr/bin/env node
/**
 * Halo Lead Exchange — Lead Guides build script (one guide a day).
 *
 * Reads tools/lead-guides.json and publishes every guide that is
 * status "approved" AND whose publishDate has arrived (UK date). Anything
 * else (drafts, future dates) is NOT written, and any previously generated
 * page that no longer qualifies is removed, so nothing goes live early.
 *
 * Also maintains, between marker comments:
 *   - the Lead Guides block in sitemap.xml
 *   - the .html -> clean URL redirects in _redirects
 *
 * Usage:
 *   node tools/build-lead-guides.js             # publish what is due today
 *   node tools/build-lead-guides.js --date=2026-11-25   # preview a future day
 *   node tools/build-lead-guides.js --check     # validate only, write nothing
 *
 * Runs daily via a scheduled task (see docs/LEAD_GUIDES_CONTENT_ENGINE.md),
 * which commits and pushes only when this produces a change.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const outDir = path.join(rootDir, 'lead-guides');
const BASE = 'https://halostrategic.com/lead-guides';

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const dateArg = (args.find((a) => a.startsWith('--date=')) || '').slice(7);
const today = dateArg || new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error(`Bad date: ${today}`);

const articleTemplate = fs.readFileSync(path.join(__dirname, 'lead-guides-article-template.html'), 'utf-8');
const indexTemplate = fs.readFileSync(path.join(__dirname, 'lead-guides-index-template.html'), 'utf-8');
const guides = JSON.parse(fs.readFileSync(path.join(__dirname, 'lead-guides.json'), 'utf-8'));

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function jsonLdString(str) {
  return JSON.stringify(str).split('</').join('<\\/');
}

// ---- Validation: fail loudly rather than publish something broken ----
const seen = new Set();
const dates = new Map();
for (const g of guides) {
  for (const f of ['slug', 'title', 'h1', 'metaDescription', 'category', 'teaser', 'publishDate', 'status', 'bodyHtml']) {
    if (!g[f]) throw new Error(`Guide "${g.slug || '(no slug)'}" is missing "${f}"`);
  }
  if (!/^[a-z0-9-]+$/.test(g.slug)) throw new Error(`Slug "${g.slug}" must be lowercase letters, numbers and hyphens`);
  if (seen.has(g.slug)) throw new Error(`Duplicate slug "${g.slug}"`);
  seen.add(g.slug);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g.publishDate)) throw new Error(`Guide "${g.slug}" has a bad publishDate`);
  if (!['approved', 'draft'].includes(g.status)) throw new Error(`Guide "${g.slug}" status must be "approved" or "draft"`);
  if (g.metaDescription.length > 165) throw new Error(`Guide "${g.slug}" metaDescription is over 165 characters`);
  if (/\{\{|\}\}/.test(g.bodyHtml)) throw new Error(`Guide "${g.slug}" body contains a template placeholder`);
  if (g.status === 'approved') {
    if (dates.has(g.publishDate)) throw new Error(`Two approved guides share ${g.publishDate}: ${dates.get(g.publishDate)} and ${g.slug}`);
    dates.set(g.publishDate, g.slug);
  }
  for (const item of g.faq || []) if (!item.q || !item.a) throw new Error(`Guide "${g.slug}" has an incomplete FAQ item`);
}

const published = guides
  .filter((g) => g.status === 'approved' && g.publishDate <= today)
  .sort((x, y) => y.publishDate.localeCompare(x.publishDate));
const upcoming = guides
  .filter((g) => g.status === 'approved' && g.publishDate > today)
  .sort((x, y) => x.publishDate.localeCompare(y.publishDate));

if (checkOnly) {
  console.log(`OK. ${guides.length} guides valid. Due by ${today}: ${published.length}. Queued: ${upcoming.length}. Drafts: ${guides.filter((g) => g.status === 'draft').length}.`);
  process.exit(0);
}

// ---- Related guides: same category first, then newest ----
function relatedFor(g) {
  const others = published.filter((o) => o.slug !== g.slug);
  const picks = [...others.filter((o) => o.category === g.category), ...others.filter((o) => o.category !== g.category)].slice(0, 3);
  if (picks.length === 0) return '';
  return `
      <div style="margin-top:40px;">
        <h2 style="font-size:1.3rem;">Related guides</h2>
        <ul>
${picks.map((o) => `          <li><a href="/lead-guides/${o.slug}" style="color:var(--bronze); text-decoration:underline;">${escapeHtml(o.h1)}</a></li>`).join('\n')}
        </ul>
      </div>`;
}

function faqHtml(g) {
  if (!g.faq || g.faq.length === 0) return '';
  return `

      <h2>Frequently asked questions</h2>
      <div class="faq">
${g.faq.map((f) => `        <details>
          <summary>${escapeHtml(f.q)}</summary>
          <p>${escapeHtml(f.a)}</p>
        </details>`).join('\n')}
      </div>`;
}

// ---- Write pages ----
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
const keep = new Set(['index.html']);
for (const g of published) {
  const canonical = `${BASE}/${g.slug}`;
  const pageTitle = g.title.replace(/ \| Halo Lead Exchange$/, '');
  const html = articleTemplate
    .split('{{PAGE_TITLE}}').join(escapeHtml(pageTitle))
    .split('{{TITLE}}').join(escapeHtml(g.title))
    .split('{{META_DESCRIPTION}}').join(escapeHtml(g.metaDescription))
    .split('{{LD_HEADLINE}}').join(jsonLdString(pageTitle))
    .split('{{LD_DESCRIPTION}}').join(jsonLdString(g.metaDescription))
    .split('{{PUBLISH_DATE}}').join(g.publishDate)
    .split('{{CANONICAL}}').join(canonical)
    .split('{{CATEGORY}}').join(escapeHtml(g.category))
    .split('{{H1}}').join(escapeHtml(g.h1))
    .split('{{RELATED}}').join(relatedFor(g))
    .split('{{BODY}}').join(g.bodyHtml + faqHtml(g));
  if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error(`Unfilled placeholder in ${g.slug}`);
  fs.writeFileSync(path.join(outDir, `${g.slug}.html`), html, 'utf-8');
  keep.add(`${g.slug}.html`);
}
for (const f of fs.readdirSync(outDir)) {
  if (f.endsWith('.html') && !keep.has(f)) {
    fs.unlinkSync(path.join(outDir, f));
    console.log(`Removed lead-guides/${f} (not approved or not yet due)`);
  }
}

const cards = published.length
  ? published.map((g) => `        <div class="card">
          <div class="k">${escapeHtml(g.category)}</div>
          <h3>${escapeHtml(g.h1)}</h3>
          <p>${escapeHtml(g.teaser)}</p>
          <a href="/lead-guides/${g.slug}" class="readmore">Read the guide &rarr;</a>
        </div>`).join('\n')
  : '        <p>The first guide is on its way.</p>';
fs.writeFileSync(path.join(outDir, 'index.html'), indexTemplate.split('{{ARTICLE_CARDS}}').join(cards), 'utf-8');

// ---- Sitemap and redirects, between markers ----
function replaceBlock(file, start, end, body, insertBefore) {
  const p = path.join(rootDir, file);
  let s = fs.readFileSync(p, 'utf-8');
  const block = `${start}\n${body}\n${end}`;
  const re = new RegExp(`${start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  if (re.test(s)) s = s.replace(re, block);
  else if (insertBefore) s = s.replace(insertBefore, `${block}\n${insertBefore}`);
  else s = `${s.replace(/\s*$/, '')}\n\n${block}\n`;
  fs.writeFileSync(p, s, 'utf-8');
}
const newest = published[0] ? published[0].publishDate : today;
const sitemapUrls = [
  `  <url><loc>${BASE}/</loc><lastmod>${newest}</lastmod></url>`,
  ...published.map((g) => `  <url><loc>${BASE}/${g.slug}</loc><lastmod>${g.publishDate}</lastmod></url>`),
].join('\n');
replaceBlock('sitemap.xml', '<!-- lead-guides:start -->', '<!-- lead-guides:end -->', sitemapUrls, '</urlset>');

const redirects = [
  `/lead-guides/index.html  /lead-guides/  301!`,
  ...published.map((g) => `/lead-guides/${g.slug}.html  /lead-guides/${g.slug}  301!`),
].join('\n');
replaceBlock('_redirects', '# lead-guides:start', '# lead-guides:end', redirects);

console.log(`Published ${published.length} guide(s) as of ${today}.`);
if (published[0]) console.log(`Latest: ${published[0].publishDate} ${published[0].slug}`);
console.log(upcoming.length
  ? `Queued: ${upcoming.length} (next ${upcoming[0].publishDate} ${upcoming[0].slug}, last ${upcoming[upcoming.length - 1].publishDate})`
  : 'Queue is EMPTY: no approved guides scheduled after today.');
