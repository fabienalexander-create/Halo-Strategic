import { afterEach, describe, expect, it } from 'vitest';
import {
  deriveFollowUpToken, followUpSmsText, getFollowUpLinkKey, getFollowUpSmsMode, getFollowUpTestNumber,
  issueFollowUpToken, queueFollowUpSms, sendPendingFollowUpSms,
} from './metaFollowUpSms';
import { hashFollowUpToken } from './metaFollowUpToken';

const ENV_KEYS = ['META_FOLLOW_UP_SMS_ENABLED', 'META_FOLLOW_UP_SMS_TEST_NUMBER', 'META_FOLLOW_UP_LINK_KEY', 'MAKE_SMS_OUT_WEBHOOK_URL', 'MAKE_SMS_OUT_SECRET'];
afterEach(() => { for (const k of ENV_KEYS) delete process.env[k]; });

const neverDb = { sql: () => { throw new Error('database must not be touched'); } };

describe('meta follow-up SMS gates', () => {
  it('is off unless the switch is exactly "true" or "test"', () => {
    expect(getFollowUpSmsMode()).toBe('off');
    for (const v of ['1', 'yes', 'TRUE', 'on', '']) {
      process.env.META_FOLLOW_UP_SMS_ENABLED = v;
      expect(getFollowUpSmsMode()).toBe('off');
    }
    process.env.META_FOLLOW_UP_SMS_ENABLED = 'test';
    expect(getFollowUpSmsMode()).toBe('test');
    process.env.META_FOLLOW_UP_SMS_ENABLED = 'true';
    expect(getFollowUpSmsMode()).toBe('live');
  });

  it('only accepts a test number in the Ofcom reserved 07700 900xxx range', () => {
    process.env.META_FOLLOW_UP_SMS_TEST_NUMBER = '07700 900123';
    expect(getFollowUpTestNumber()).toBe('+447700900123');
    for (const real of ['07749927952', '+447700901000', '07700800123']) {
      process.env.META_FOLLOW_UP_SMS_TEST_NUMBER = real;
      expect(getFollowUpTestNumber()).toBeNull();
    }
  });

  it('requires a link key of at least 32 characters', () => {
    process.env.META_FOLLOW_UP_LINK_KEY = 'short';
    expect(getFollowUpLinkKey()).toBeNull();
    process.env.META_FOLLOW_UP_LINK_KEY = 'k'.repeat(32);
    expect(getFollowUpLinkKey()).toBe('k'.repeat(32));
  });

  it('does not touch the database when switched off', async () => {
    await expect(queueFollowUpSms(neverDb, { leadId: 1, mobile: '07700900123', linkNonce: 'n', createdBy: 't' }))
      .resolves.toEqual({ queued: false, reason: 'NOT_ENABLED' });
    await expect(sendPendingFollowUpSms(neverDb)).resolves.toMatchObject({ skipped: 'NOT_ENABLED', sent: 0 });
  });

  it('refuses to send without the Make webhook or link key, even when switched on', async () => {
    process.env.META_FOLLOW_UP_SMS_ENABLED = 'true';
    await expect(sendPendingFollowUpSms(neverDb)).resolves.toMatchObject({ skipped: 'NOT_CONFIGURED' });
  });

  it('never queues for a real number in test mode', async () => {
    process.env.META_FOLLOW_UP_SMS_ENABLED = 'test';
    process.env.META_FOLLOW_UP_SMS_TEST_NUMBER = '07700900123';
    await expect(queueFollowUpSms(neverDb, { leadId: 1, mobile: '07749 927952', linkNonce: 'n', createdBy: 't' }))
      .resolves.toEqual({ queued: false, reason: 'TEST_MODE_NUMBER_NOT_ALLOWED' });
  });
});

describe('meta follow-up link derivation', () => {
  it('derives a stable, URL-safe 256-bit token per nonce and key', () => {
    const key = 'k'.repeat(40);
    const a = deriveFollowUpToken(key, 'nonce-1');
    expect(a).toBe(deriveFollowUpToken(key, 'nonce-1'));
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(deriveFollowUpToken(key, 'nonce-2')).not.toBe(a);
    expect(deriveFollowUpToken('j'.repeat(40), 'nonce-1')).not.toBe(a);
  });

  it('issues a random, non-derivable token when no key is set', () => {
    const t = issueFollowUpToken();
    expect(t.linkNonce).toBeNull();
    expect(t.tokenHash).toBe(hashFollowUpToken(t.rawToken));
  });

  it('issues a derivable token when the key is set, whose hash matches what is stored', () => {
    process.env.META_FOLLOW_UP_LINK_KEY = 'k'.repeat(40);
    const t = issueFollowUpToken(new Date('2026-11-19T00:00:00Z'));
    expect(t.linkNonce).not.toBeNull();
    expect(deriveFollowUpToken('k'.repeat(40), t.linkNonce!)).toBe(t.rawToken);
    expect(t.tokenHash).toBe(hashFollowUpToken(t.rawToken));
    expect(t.expiresAt.toISOString()).toBe('2026-12-19T00:00:00.000Z');
  });
});

describe('meta follow-up wording', () => {
  it('matches the approved Option C wording exactly', () => {
    expect(followUpSmsText('https://example.test/x')).toBe(
      'Halo Strategic: thanks for your spray foam removal enquiry. Please complete your details here: https://example.test/x\n\n' +
      'If an installer covers your area, they may contact you directly. Reply STOP to opt out.'
    );
  });
});
