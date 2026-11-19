import { afterEach, describe, expect, it } from 'vitest';
import { buildFollowUpUrl, generateFollowUpToken } from './metaFollowUpToken';
import { decryptLinkToken, encryptLinkToken, linkEncryptionKey, linkTokenAad } from './smsLinkCrypto';
import {
  isWithinSendingHours, metaFollowUpSmsEnabled, metaFollowUpSmsText, smsSegmentInfo,
} from './smsVerification';

// Fabien, 2026-11-19: approved wording Option C, plain GSM-7 characters only, never more than two
// SMS segments. These tests run against the ACTUAL generated message with a real follow-up link,
// not just the template, so a future wording or URL change that adds a segment fails here first.

const APPROVED_TEXT_WITH_LINK = (url: string) =>
  `Halo Strategic: thanks for your spray foam removal enquiry. Please complete your details here: ${url}\n` +
  'If an installer covers your area, they may contact you directly. Reply STOP to opt out.';

function realLink(): string {
  return buildFollowUpUrl(generateFollowUpToken().rawToken);
}

describe('Meta follow-up SMS text', () => {
  it('uses a realistic 118-character link', () => {
    expect(realLink()).toHaveLength(118);
  });

  it('matches the approved wording exactly', () => {
    const url = realLink();
    expect(metaFollowUpSmsText(url)).toBe(APPROVED_TEXT_WITH_LINK(url));
  });

  it('is GSM-7, at most two segments, contains the link once and the opt-out, for 200 real links', () => {
    // Tokens are random base64url, so every character class a token can contain gets exercised.
    for (let i = 0; i < 200; i++) {
      const url = realLink();
      const text = metaFollowUpSmsText(url);
      const info = smsSegmentInfo(text);
      expect(info.encoding).toBe('GSM-7');
      expect(info.segments).toBeLessThanOrEqual(2);
      expect(text.split(url)).toHaveLength(2);
      expect(text).toContain('Reply STOP to opt out.');
    }
  });

  it('stays within two segments with room to spare (current length is fixed by the token size)', () => {
    const info = smsSegmentInfo(metaFollowUpSmsText(realLink()));
    expect(info.units).toBe(301);
    expect(306 - info.units).toBeGreaterThanOrEqual(5);
  });

  it('contains only plain ASCII: no curly quotes, dashes or other auto-formatted characters', () => {
    const text = metaFollowUpSmsText(realLink());
    expect([...text].every((c) => c.charCodeAt(0) < 128)).toBe(true);
  });

  it('never names the homeowner or promises contact', () => {
    const text = metaFollowUpSmsText(realLink());
    expect(text).toContain('they may contact you');
    expect(text).not.toMatch(/will (call|contact)|guarantee/i);
  });
});

describe('smsSegmentInfo', () => {
  it('counts GSM-7 single and concatenated segments at the boundaries', () => {
    expect(smsSegmentInfo('a'.repeat(160))).toEqual({ encoding: 'GSM-7', units: 160, segments: 1 });
    expect(smsSegmentInfo('a'.repeat(161))).toEqual({ encoding: 'GSM-7', units: 161, segments: 2 });
    expect(smsSegmentInfo('a'.repeat(306))).toEqual({ encoding: 'GSM-7', units: 306, segments: 2 });
    expect(smsSegmentInfo('a'.repeat(307))).toEqual({ encoding: 'GSM-7', units: 307, segments: 3 });
  });

  it('counts extension-table characters as two units', () => {
    expect(smsSegmentInfo('[x]').units).toBe(5);
    expect(smsSegmentInfo('€').encoding).toBe('GSM-7');
  });

  it('flags a single curly apostrophe as UCS-2, which more than doubles the cost', () => {
    const plain = metaFollowUpSmsText(realLink()).replace('they may', "they'll");
    const curly = plain.replace("they'll", 'they’ll');
    expect(smsSegmentInfo(plain).encoding).toBe('GSM-7');
    expect(smsSegmentInfo(curly)).toMatchObject({ encoding: 'UCS-2', segments: 5 });
  });
});

describe('isWithinSendingHours (08:00-20:00 Europe/London)', () => {
  it('handles GMT (winter): 07:59 no, 08:00 yes, 19:59 yes, 20:00 no', () => {
    expect(isWithinSendingHours(new Date('2026-01-15T07:59:00Z'))).toBe(false);
    expect(isWithinSendingHours(new Date('2026-01-15T08:00:00Z'))).toBe(true);
    expect(isWithinSendingHours(new Date('2026-01-15T19:59:00Z'))).toBe(true);
    expect(isWithinSendingHours(new Date('2026-01-15T20:00:00Z'))).toBe(false);
  });

  it('handles BST (summer), one hour ahead of UTC', () => {
    expect(isWithinSendingHours(new Date('2026-07-01T06:59:00Z'))).toBe(false); // 07:59 BST
    expect(isWithinSendingHours(new Date('2026-07-01T07:00:00Z'))).toBe(true); // 08:00 BST
    expect(isWithinSendingHours(new Date('2026-07-01T18:59:00Z'))).toBe(true); // 19:59 BST
    expect(isWithinSendingHours(new Date('2026-07-01T19:00:00Z'))).toBe(false); // 20:00 BST
  });

  it('is never open in the middle of the night', () => {
    expect(isWithinSendingHours(new Date('2026-11-19T03:00:00Z'))).toBe(false);
  });
});

describe('follow-up link encryption (AES-256-GCM)', () => {
  const key = Buffer.alloc(32, 7);
  const token = generateFollowUpToken().rawToken;

  it('round-trips, with a fresh IV each time', () => {
    const a = encryptLinkToken(token, key, linkTokenAad(1));
    const b = encryptLinkToken(token, key, linkTokenAad(1));
    expect(a).not.toBe(b);
    expect(a).not.toContain(token);
    expect(decryptLinkToken(a, key, linkTokenAad(1))).toBe(token);
    expect(decryptLinkToken(b, key, linkTokenAad(1))).toBe(token);
  });

  it('refuses a value bound to a different row, a wrong key, a tampered value or junk', () => {
    const enc = encryptLinkToken(token, key, linkTokenAad(1));
    expect(decryptLinkToken(enc, key, linkTokenAad(2))).toBeNull();
    expect(decryptLinkToken(enc, Buffer.alloc(32, 8), linkTokenAad(1))).toBeNull();
    const parts = enc.split('.');
    parts[2] = parts[2].slice(0, 3) + (parts[2][3] === 'A' ? 'B' : 'A') + parts[2].slice(4);
    expect(decryptLinkToken(parts.join('.'), key, linkTokenAad(1))).toBeNull();
    for (const junk of [null, 42, '', 'v1.x.y', 'v2.a.b.c', enc.replace('v1', 'v0')]) {
      expect(decryptLinkToken(junk, key, linkTokenAad(1))).toBeNull();
    }
  });

  it('only accepts a 32-byte base64 key from SMS_LINK_ENCRYPTION_KEY', () => {
    const original = process.env.SMS_LINK_ENCRYPTION_KEY;
    delete process.env.SMS_LINK_ENCRYPTION_KEY;
    expect(linkEncryptionKey()).toBeNull();
    process.env.SMS_LINK_ENCRYPTION_KEY = Buffer.alloc(16).toString('base64');
    expect(linkEncryptionKey()).toBeNull();
    process.env.SMS_LINK_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64');
    expect(linkEncryptionKey()?.length).toBe(32);
    if (original === undefined) delete process.env.SMS_LINK_ENCRYPTION_KEY; else process.env.SMS_LINK_ENCRYPTION_KEY = original;
  });
});

describe('metaFollowUpSmsEnabled', () => {
  afterEach(() => {
    delete process.env.SMS_VERIFICATION_ENABLED;
    delete process.env.META_FOLLOW_UP_SMS_ENABLED;
  });

  it('requires BOTH the master switch and the follow-up switch, set to exactly "true"', () => {
    expect(metaFollowUpSmsEnabled()).toBe(false);
    process.env.SMS_VERIFICATION_ENABLED = 'true';
    expect(metaFollowUpSmsEnabled()).toBe(false);
    process.env.META_FOLLOW_UP_SMS_ENABLED = 'TRUE';
    expect(metaFollowUpSmsEnabled()).toBe(false);
    process.env.META_FOLLOW_UP_SMS_ENABLED = 'true';
    expect(metaFollowUpSmsEnabled()).toBe(true);
    process.env.SMS_VERIFICATION_ENABLED = 'false';
    expect(metaFollowUpSmsEnabled()).toBe(false);
  });
});
