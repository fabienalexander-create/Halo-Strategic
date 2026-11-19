import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sendPendingMock = vi.hoisted(() => vi.fn());
const getDatabaseMock = vi.hoisted(() => vi.fn(() => ({ sql: vi.fn() })));
vi.mock('./smsSender', () => ({ sendPendingVerifications: sendPendingMock }));
vi.mock('@netlify/database', () => ({ getDatabase: getDatabaseMock }));

describe('scheduled SMS send (netlify/functions/sms-send-pending.mts)', () => {
  beforeEach(() => {
    sendPendingMock.mockReset();
    getDatabaseMock.mockClear();
    delete process.env.SMS_VERIFICATION_ENABLED;
  });
  afterEach(() => {
    delete process.env.SMS_VERIFICATION_ENABLED;
  });

  it('the Netlify function runs every 15 minutes and only delegates here', () => {
    const fn = readFileSync(join(__dirname, '..', 'netlify', 'functions', 'sms-send-pending.mts'), 'utf8');
    expect(fn).toContain("export const config = { schedule: '*/15 * * * *' };");
    expect(fn).toContain('export default async () => runScheduledSmsSend();');
  });

  it('does nothing at all, not even a database connection, while SMS is switched off', async () => {
    const { runScheduledSmsSend: handler } = await import('./smsScheduledSend');
    for (const value of [undefined, 'false', 'TRUE', '1']) {
      if (value === undefined) delete process.env.SMS_VERIFICATION_ENABLED;
      else process.env.SMS_VERIFICATION_ENABLED = value;
      const res = await handler();
      expect(await res.json()).toEqual({ skipped: 'NOT_ENABLED' });
    }
    expect(getDatabaseMock).not.toHaveBeenCalled();
    expect(sendPendingMock).not.toHaveBeenCalled();
  });

  it('when switched on, runs the shared sender once and reports counts only', async () => {
    process.env.SMS_VERIFICATION_ENABLED = 'true';
    sendPendingMock.mockResolvedValue({ expired: 0, suppressed: 0, claimed: 1, sent: 1, failed: 0, superseded: 0 });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { runScheduledSmsSend: handler } = await import('./smsScheduledSend');

    const res = await handler();

    expect(sendPendingMock).toHaveBeenCalledTimes(1);
    expect(sendPendingMock.mock.calls[0][1]).toEqual({ limit: 20 });
    expect((await res.json()).sent).toBe(1);
    expect(log.mock.calls[0][1]).not.toMatch(/\+44|07\d{9}/);
    log.mockRestore();
  });

  it('reports a failure without leaking detail', async () => {
    process.env.SMS_VERIFICATION_ENABLED = 'true';
    sendPendingMock.mockRejectedValue(new Error('db down'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { runScheduledSmsSend: handler } = await import('./smsScheduledSend');

    const res = await handler();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed.' });
    err.mockRestore();
  });
});
