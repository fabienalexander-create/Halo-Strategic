import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendPendingMock = vi.hoisted(() => vi.fn());
const getDatabaseMock = vi.hoisted(() => vi.fn(() => ({ sql: vi.fn() })));
vi.mock('../../lib/smsSender', () => ({ sendPendingVerifications: sendPendingMock }));
vi.mock('@netlify/database', () => ({ getDatabase: getDatabaseMock }));

describe('sms-send-pending scheduled function', () => {
  beforeEach(() => {
    sendPendingMock.mockReset();
    getDatabaseMock.mockClear();
    delete process.env.SMS_VERIFICATION_ENABLED;
  });
  afterEach(() => {
    delete process.env.SMS_VERIFICATION_ENABLED;
  });

  it('runs every 15 minutes', async () => {
    const { config } = await import('./sms-send-pending');
    expect(config.schedule).toBe('*/15 * * * *');
  });

  it('does nothing at all, not even a database connection, while SMS is switched off', async () => {
    const { default: handler } = await import('./sms-send-pending');
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
    const { default: handler } = await import('./sms-send-pending');

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
    const { default: handler } = await import('./sms-send-pending');

    const res = await handler();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed.' });
    err.mockRestore();
  });
});
