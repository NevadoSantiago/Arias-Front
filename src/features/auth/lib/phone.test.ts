import { describe, expect, it } from 'vitest';
import { buildE164, phoneFieldsSchema } from './phone';

const EMPTY_MESSAGE = 'Ingresá tu celular';
const DIGITS_MESSAGE = 'Usá solo números';

describe('buildE164', () => {
  it('builds +549 plus the 10 digits for Argentina', () => {
    expect(buildE164('AR', '1159876547')).toEqual({ ok: true, value: '+5491159876547' });
  });

  it('ignores spaces, dashes, dots and parentheses', () => {
    expect(buildE164('AR', '11 5987-6547')).toEqual({ ok: true, value: '+5491159876547' });
    expect(buildE164('AR', ' (11) 5987.6547 ')).toEqual({ ok: true, value: '+5491159876547' });
  });

  it.each(['115987654', '11598765478', '0115987654715', '1'])(
    'accepts any digit count for Argentina (%s)',
    (value) => {
      expect(buildE164('AR', value)).toEqual({ ok: true, value: `+549${value}` });
    },
  );

  it.each(['+54 9 11 5987-6547', 'abcdefghij', '11a5987'])('rejects non-digit input %s', (value) => {
    expect(buildE164('AR', value)).toEqual({ ok: false, message: DIGITS_MESSAGE });
  });

  it.each(['', '   ', ' - '])('rejects the empty value %j', (value) => {
    expect(buildE164('AR', value)).toEqual({ ok: false, message: EMPTY_MESSAGE });
    expect(buildE164('UY', value)).toEqual({ ok: false, message: EMPTY_MESSAGE });
  });

  it('builds + dial code + digits for other countries', () => {
    expect(buildE164('UY', '99123456')).toEqual({ ok: true, value: '+59899123456' });
  });

  it.each(['12345', '123456789012345'])('accepts any digit count for other countries (%s)', (value) => {
    expect(buildE164('UY', value)).toEqual({ ok: true, value: `+598${value}` });
  });

  it('rejects letters for other countries', () => {
    expect(buildE164('UY', 'abc12345')).toEqual({ ok: false, message: DIGITS_MESSAGE });
  });

  it('rejects an unknown country', () => {
    expect(buildE164('ZZ', '99123456').ok).toBe(false);
  });
});

describe('phoneFieldsSchema', () => {
  it('attaches the error to phoneNumber', () => {
    const result = phoneFieldsSchema.safeParse({ phoneCountry: 'AR', phoneNumber: '12a' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['phoneNumber']);
      expect(result.error.issues[0].message).toBe(DIGITS_MESSAGE);
    }
  });

  it('accepts a valid number', () => {
    expect(phoneFieldsSchema.safeParse({ phoneCountry: 'UY', phoneNumber: '99123456' }).success).toBe(true);
  });
});
