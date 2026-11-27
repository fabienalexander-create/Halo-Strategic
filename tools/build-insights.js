#!/usr/bin/env node
/**
 * Halo Strategic — Insights build script.
 *
 * Generates insights/index.html and insights/{slug}.html from
 * tools/insights-article-template.html, tools/insights-index-template.html,
 * and tools/insights-articles.json.
 *
 * This is not a CMS and does not run on Netlify. It's a local generator:
 * edit insights-articles.json (or add a new entry for a new article), run
 * `node tools/build-insights.js`, review the diff, then commit the
 * regenerated insights/*.html files like any other change. See
 * docs/ARCHITECTURE.md (Folder Structure, Future Scalability) and
 * docs/ARCHITECTURAL_DECISIONS.md (ADR-004 note, ADR-009) for why this
 * exists and what it deliberately does not solve (non-technical publishing,
 * a CMS, or a Netlify-side build step — none of those were the actual
 * problem; hand-copying ~250 lines of boilerplate per article was).
 *
 * Usage: node tools/build-insights.js
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const insightsDir = path.join(rootDir, 'insights');

const articleTemplate = fs.readFileSync(path.join(__dirname, 'insights-article-template.html'), 'utf-8');
const indexTemplate = fs.readFileSync(path.join(__dirname, 'insights-index-template.html'), 'utf-8');
const articles = JSON.parse(fs.readFileSync(path.join(__dirname, 'insights-articles.json'), 'utf-8'));

// Escape HTML special characters in plain-text fields (title, meta description,
// h1, teaser, category). bodyHtml is intentionally NOT escaped here, it's meant
// to contain real markup (links, <p>, <ul>, etc.), same as every other page on
// this site, whose content is hand-authored HTML, not escaped plain text.
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Basic validation: fail loudly rather than silently generate a broken page.
for (const a of articles) {
  const required = ['slug', 'title', 'h1', 'metaDescription', 'category', 'teaser', 'publishDate', 'bodyHtml'];
  for (const field of required) {
    if (!a[field]) throw new Error(`Article "${a.slug || '(no slug)'}" is missing required field "${field}"`);
  }
  if (!/^[a-z0-9-]+$/.test(a.slug)) throw new Error(`Article slug "${a.slug}" must be lowercase letters, numbers, and hyphens only`);
}

// House style check: no em dashes or en dashes anywhere in the copy (see
// docs/SEO_CONTENT_ENGINE.md, Tone, and .claude/skills/halo-house-style/SKILL.md).
// Long dashes are one of the more obvious "this was written by AI" tells, so this
// is a hard build failure, not a warning a run can forget to act on. Use a comma,
// a period, or a colon instead. If a real en-dash number range is ever needed
// (e.g. "3-4"), write it with a plain hyphen, matching every existing article.
const LONG_DASH_FIELDS = ['title', 'h1', 'metaDescription', 'teaser', 'category', 'bodyHtml'];
const longDashHits = [];
for (const a of articles) {
  for (const field of LONG_DASH_FIELDS) {
    const value = a[field];
    if (typeof value !== 'string') continue;
    if (value.includes('—') || value.includes('–')) {
      longDashHits.push(`  ${a.slug || '(no slug)'} -> ${field}`);
    }
  }
}
if (longDashHits.length > 0) {
  throw new Error(
    `House style violation: found an em dash (—) or en dash (–) in:\n${longDashHits.join('\n')}\n` +
    `Replace it with a comma, a period, or a colon, then rebuild.`
  );
}

// JSON string literal safe to drop inside a <script type="application/ld+json"> block.
function jsonLdString(str) {
  return JSON.stringify(str).split('</').join('<\\/');
}

// Generate one file per article
for (const a of articles) {
  const canonical = `https://halostrategic.com/insights/${a.slug}`;
  // <title>, the BlogPosting headline and the breadcrumb name drop the brand
  // suffix (SEO audit, PR #9); og:title / twitter:title keep the full title.
  const pageTitle = a.title.replace(/ \| Halo Strategic$/, '');
  let html = articleTemplate
    .split('{{PAGE_TITLE}}').join(escapeHtml(pageTitle))
    .split('{{TITLE}}').join(escapeHtml(a.title))
    .split('{{META_DESCRIPTION}}').join(escapeHtml(a.metaDescription))
    .split('{{LD_HEADLINE}}').join(jsonLdString(pageTitle))
    .split('{{LD_DESCRIPTION}}').join(jsonLdString(a.metaDescription))
    .split('{{PUBLISH_DATE}}').join(a.publishDate)
    .split('{{CANONICAL}}').join(canonical)
    .split('{{H1}}').join(escapeHtml(a.h1))
    .split('{{BODY}}').join(a.bodyHtml); // trusted markup, not escaped
  fs.writeFileSync(path.join(insightsDir, `${a.slug}.html`), html, 'utf-8');
  console.log(`Wrote insights/${a.slug}.html`);
}

// Generate the index page, newest first
const sorted = [...articles].sort((x, y) => y.publishDate.localeCompare(x.publishDate));
const cards = sorted.map(a => `        <div class="card">
          <div class="k">${escapeHtml(a.category)}</div>
          <h3>${escapeHtml(a.h1)}</h3>
          <p>${escapeHtml(a.teaser)}</p>
          <a href="/insights/${a.slug}" class="readmore">Read the article &rarr;</a>
        </div>`).join('\n');

const indexHtml = indexTemplate.split('{{ARTICLE_CARDS}}').join(cards);
fs.writeFileSync(path.join(insightsDir, 'index.html'), indexHtml, 'utf-8');
console.log('Wrote insights/index.html');

console.log(`\nDone. ${articles.length} article(s) built. Review the diff before committing:\n  git diff insights/`);
