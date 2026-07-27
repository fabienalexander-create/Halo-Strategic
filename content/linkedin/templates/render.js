#!/usr/bin/env node
/**
 * Halo Strategic — LinkedIn image renderer.
 *
 * Fills a template in content/linkedin/templates/*.html with data from a
 * JSON file, then uses headless Chrome to capture it as a PNG. No CMS, no
 * build step for the site itself — same "simple local generator, run by
 * hand" philosophy as tools/build-insights.js.
 *
 * Usage:
 *   node render.js <template-name> <data.json> <output-basename> [--wide]
 *
 * <template-name>   one of: quote-card, stat-card, framework, checklist,
 *                   timeline, comparison, flowchart, carousel (no .html)
 * <data.json>       path to a JSON file of {{TOKEN}}: value pairs
 * <output-basename> writes generated/<output-basename>.html and .png
 * --wide            1200x627 instead of the default 1200x1200
 *
 * For list-style templates (framework, checklist, timeline, comparison,
 * flowchart), leave unused ITEM/STEP/ROW slots out of the data JSON
 * entirely — render.js hides them automatically via each template's
 * "_EMPTY" class tokens. Don't leave a slot's text empty without also
 * omitting it; an empty box still renders.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const [, , templateName, dataPath, outputName, ...flags] = process.argv;

if (!templateName || !dataPath || !outputName) {
  console.error('Usage: node render.js <template-name> <data.json> <output-basename> [--wide]');
  process.exit(1);
}

const templateDir = __dirname;
const generatedDir = path.join(templateDir, '..', 'generated');
if (!fs.existsSync(generatedDir)) fs.mkdirSync(generatedDir, { recursive: true });

const templatePath = path.join(templateDir, `${templateName}.html`);
if (!fs.existsSync(templatePath)) {
  console.error(`Template not found: ${templatePath}`);
  process.exit(1);
}

let html = fs.readFileSync(templatePath, 'utf-8');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Auto-build carousel dots if not explicitly supplied
if (templateName === 'carousel' && !data.DOTS_HTML && data.SLIDE_NUM && data.SLIDE_TOTAL) {
  const total = Number(data.SLIDE_TOTAL);
  const current = Number(data.SLIDE_NUM);
  data.DOTS_HTML = Array.from({ length: total }, (_, i) =>
    `<div class="dot${i + 1 === current ? ' active' : ''}"></div>`).join('');
}

const tokens = [...new Set((html.match(/\{\{[A-Z0-9_]+\}\}/g) || []).map(t => t.slice(2, -2)))];

for (const token of tokens) {
  let value = data[token];
  if (value === undefined) {
    if (token.endsWith('_EMPTY')) {
      const base = token.slice(0, -'_EMPTY'.length);
      value = (data[base] === undefined || data[base] === '') ? 'empty' : '';
    } else if (token === 'DOTS_HTML') {
      value = '';
    } else {
      value = '';
    }
  }
  const rendered = (token === 'DOTS_HTML') ? value : escapeHtml(value);
  html = html.split(`{{${token}}}`).join(rendered);
}

const outHtmlPath = path.join(generatedDir, `${outputName}.html`);
const outPngPath = path.join(generatedDir, `${outputName}.png`);
fs.writeFileSync(outHtmlPath, html, 'utf-8');
console.log(`Wrote ${outHtmlPath}`);

const wide = flags.includes('--wide');
const size = wide ? '1200,627' : '1200,1200';

const chromeCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const chromePath = chromeCandidates.find(p => fs.existsSync(p));
if (!chromePath) {
  console.error('No Chrome/Edge executable found. HTML written, PNG capture skipped.');
  process.exit(1);
}

execFileSync(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  `--screenshot=${outPngPath}`,
  `--window-size=${size}`,
  '--virtual-time-budget=3000',
  `file:///${outHtmlPath.replace(/\\/g, '/')}`,
]);

console.log(`Wrote ${outPngPath}`);
