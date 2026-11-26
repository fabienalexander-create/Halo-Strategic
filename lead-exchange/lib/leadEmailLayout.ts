import { canonicalUrl } from './seo';

// Branded HTML shell for the buyer-facing lead emails (offer and unlocked). Email clients ignore
// <style> blocks and modern CSS unevenly (Outlook especially), so everything here is table layout
// with inline styles and web-safe font stacks; the plain-text part of each email is unchanged and
// still sent alongside. Callers pass values that are ALREADY HTML-escaped.

const NAVY_DEEP = '#101A30';
const BRONZE = '#B08D57';
const BRONZE_TEXT = '#7A5F33'; // bronze dark enough for small text on white (passes 4.5:1)
const PAPER = '#F6F6F3';
const INK = '#1A1D24';
const SLATE = '#44546A';
const BORDER = '#E1E3DE';
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "'Courier New', Courier, monospace";

export const LEAD_REPLACEMENT_POLICY_URL = canonicalUrl('/lead-replacement-policy');

export interface DetailRow {
  label: string;
  valueHtml: string; // already escaped / built from escaped parts
  mono?: boolean;
}

export function detailRows(rows: DetailRow[]): string {
  return rows
    .map(
      (r) => `<tr>
<td style="padding:10px 12px 10px 0;border-top:1px solid ${BORDER};font-family:${SANS};font-size:15px;line-height:22px;color:${SLATE};vertical-align:top;width:38%;">${r.label}</td>
<td style="padding:10px 0;border-top:1px solid ${BORDER};font-family:${r.mono ? MONO : SANS};font-size:15px;line-height:22px;color:${INK};vertical-align:top;">${r.valueHtml}</td>
</tr>`,
    )
    .join('\n');
}

export function primaryButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0;">
<tr><td style="border-radius:8px;background:${BRONZE};">
<a href="${href}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:16px;font-weight:bold;line-height:20px;color:${NAVY_DEEP};text-decoration:none;border-radius:8px;">${label}</a>
</td></tr>
</table>`;
}

export function badge(text: string): string {
  return `<span style="display:inline-block;padding:4px 12px;border:1px solid ${BORDER};border-radius:999px;background:${PAPER};font-family:${SANS};font-size:13px;line-height:18px;color:${SLATE};">${text}</span>`;
}

export function paragraph(html: string): string {
  return `<p style="margin:16px 0 0;font-family:${SANS};font-size:15px;line-height:23px;color:${INK};">${html}</p>`;
}

export function smallNote(html: string): string {
  return `<p style="margin:12px 0 0;font-family:${SANS};font-size:13px;line-height:20px;color:${SLATE};">${html}</p>`;
}

export function link(href: string, label: string): string {
  return `<a href="${href}" style="color:${BRONZE_TEXT};text-decoration:underline;">${label}</a>`;
}

// The whole email: preheader (inbox preview text), navy header, white card with an eyebrow,
// headline, optional badge and the caller's body, then a quiet footer.
export function leadEmailLayout(params: {
  title: string; // <title>, plain text already escaped
  preheader: string; // escaped
  eyebrow: string; // escaped
  headline: string; // escaped
  badgeText?: string; // escaped
  bodyHtml: string;
}): string {
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${params.title}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${params.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="background:${NAVY_DEEP};border-radius:12px 12px 0 0;padding:18px 24px;font-family:${SERIF};font-size:20px;line-height:26px;color:${PAPER};">Halo Lead Exchange</td></tr>
<tr><td style="background:#FFFFFF;border:1px solid ${BORDER};border-top:none;border-radius:0 0 12px 12px;padding:28px 24px;">
<div style="font-family:${MONO};font-size:12px;line-height:16px;letter-spacing:1px;text-transform:uppercase;color:${BRONZE_TEXT};">${params.eyebrow}</div>
${params.badgeText ? `<div style="margin-top:12px;">${badge(params.badgeText)}</div>` : ''}
<h1 style="margin:14px 0 8px;font-family:${SERIF};font-size:26px;line-height:32px;font-weight:normal;color:${NAVY_DEEP};">${params.headline}</h1>
${params.bodyHtml}
</td></tr>
<tr><td style="padding:16px 8px;font-family:${SANS};font-size:12px;line-height:18px;color:${SLATE};text-align:center;">Halo Lead Exchange is part of Halo Strategic. You are receiving this because you are an approved buyer.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
