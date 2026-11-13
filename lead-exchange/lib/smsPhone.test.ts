import { describe, expect, it } from 'vitest';
import { normaliseUkMobile } from './smsPhone';
import { parseReply } from './smsVerification';
import { secretMatches } from './smsWebhookAuth';

describe('normaliseUkMobile', () => {
  it.each([
    ['07700 900123', '+447700900123'],
    ['+44 7700 900123', '+447700900123'],
    ['447700900123', '+447700900123'],
    ['0044 7700-900-123', '+447700900123'],
    ['+44 (0)7700 900123', '+447700900123'],
    [' (07700) 900.123 ', '+447700900123'],
  ])('accepts %s', (raw, out) => expect(normaliseUkMobile(raw)).toBe(out));

  it.each(['', '020 7946 0958', '+1 415 555 0100', '07700 90012', '07700 9001234', 'abc', null, undefined, 7700900123])(
    'rejects %s', (raw) => expect(normaliseUkMobile(raw)).toBeNull()
  );
});

describe('parseReply', () => {
  it('recognises YES with and without a reference', () => {
    expect(parseReply('YES')).toEqual({ kind: 'YES', ref: null });
    expect(parseReply(' yes. ')).toEqual({ kind: 'YES', ref: null });
    expect(parseReply('Yes ab3k9z')).toEqual({ kind: 'YES', ref: 'AB3K9Z' });
    expect(parseReply('Y: AB3K9Z')).toEqual({ kind: 'YES', ref: 'AB3K9Z' });
  });
  it('recognises STOP words', () => {
    for (const w of ['STOP', 'stop', 'Unsubscribe', 'cancel', 'END', 'quit', 'STOPALL']) expect(parseReply(w)).toEqual({ kind: 'STOP' });
  });
  it('ignores everything else, including look-alike references and chatter', () => {
    for (const t of ['yes please', 'YES AB3K9', 'YES AB3K9Z7', 'YES 0O1IAB', 'no', 'maybe', '', null, 42]) expect(parseReply(t).kind).toBe('OTHER');
  });
});

describe('secretMatches', () => {
  it('fails closed', () => {
    expect(secretMatches('a', undefined)).toBe(false);
    expect(secretMatches(null, 'a')).toBe(false);
    expect(secretMatches('', '')).toBe(false);
    expect(secretMatches('b', 'a')).toBe(false);
    expect(secretMatches('a', 'a')).toBe(true);
  });
});
