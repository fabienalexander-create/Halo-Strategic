import { describe, expect, it } from 'vitest';
import { normalizeOwnershipAnswer } from './ownershipAnswer';

describe('normalizeOwnershipAnswer', () => {
  it.each([
    ['yes', 'confirmed'],
    ['Yes', 'confirmed'],
    ['YES', 'confirmed'],
    [' yes ', 'confirmed'],
    ['yes\n', 'confirmed'],
    ['no', 'denied'],
    ['No', 'denied'],
    ['NO', 'denied'],
    [' no ', 'denied'],
    ['maybe', 'unconfirmed'],
    ['true', 'unconfirmed'],
    ['1', 'unconfirmed'],
    ['', 'unconfirmed'],
    ['   ', 'unconfirmed'],
  ])('treats plain string %j as %s', (input, expected) => {
    expect(normalizeOwnershipAnswer(input)).toBe(expected);
  });

  it.each([
    [['yes'], 'confirmed'],
    [['Yes'], 'confirmed'],
    [[' YES '], 'confirmed'],
    [['no'], 'denied'],
    [['No'], 'denied'],
    [['maybe'], 'unconfirmed'],
    [[], 'unconfirmed'], // empty array -- Meta's own shape for an unanswered checkbox question
    [['yes', 'no'], 'confirmed'], // only the first element is ever consulted
  ])("treats Meta's array shape %j as %s", (input, expected) => {
    expect(normalizeOwnershipAnswer(input)).toBe(expected);
  });

  it.each([
    [undefined, 'unconfirmed'],
    [null, 'unconfirmed'],
    [123, 'unconfirmed'],
    [true, 'unconfirmed'],
    [false, 'unconfirmed'],
    [{}, 'unconfirmed'],
    [{ value: 'yes' }, 'unconfirmed'],
    [[null], 'unconfirmed'],
    [[123], 'unconfirmed'],
    [[{}], 'unconfirmed'],
  ])('treats malformed/unexpected input %j as unconfirmed, never confirmed or denied', (input, expected) => {
    expect(normalizeOwnershipAnswer(input)).toBe(expected);
  });
});
