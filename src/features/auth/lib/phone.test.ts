import { describe, expect, it } from 'vitest';
import { buildE164, phoneFieldsSchema } from './phone';

const AR_MESSAGE = 'Ingresá los 10 dígitos de tu celular';

describe('buildE164', () => {
  it('builds +549 plus the 10 digits for Argentina', () => {
    expect(buildE164('AR', '1159876547')).toEqual({ ok: true, value: '+5491159876547' });
  });

  it('ignores spaces, dashes, dots and parentheses', () => {
    expect(buildE164('AR', '11 5987-6547')).toEqual({ ok: true, value: '+5491159876547' });
    expect(buildE164('AR', ' (11) 5987.6547 ')).toEqual({ ok: true, value: '+5491159876547' });
  });

  it.each(['115987654', '11598765478', '+54 9 11 5987-6547', '011 5987 6547', 'abcdefghij', ''])(
    'rejects the Argentine number %s',
    (value) => {
      expect(buildE164('AR', value)).toEqual({ ok: false, message: AR_MESSAGE });
    },
  );

  it('builds + dial code + digits for other countries', () => {
    expect(buildE164('UY', '99123456')).toEqual({ ok: true, value: '+59899123456' });
  });

  it.each(['12345', '123456789012345', 'abc12345', ''])('rejects the foreign number %s', (value) => {
    const result = buildE164('UY', value);
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown country', () => {
    expect(buildE164('ZZ', '99123456').ok).toBe(false);
  });
});

describe('phoneFieldsSchema', () => {
  it('attaches the error to phoneNumber', () => {
    const result = phoneFieldsSchema.safeParse({ phoneCountry: 'AR', phoneNumber: '123' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['phoneNumber']);
      expect(result.error.issues[0].message).toBe(AR_MESSAGE);
    }
  });

  it('accepts a valid number', () => {
    expect(phoneFieldsSchema.safeParse({ phoneCountry: 'UY', phoneNumber: '99123456' }).success).toBe(true);
  });
});
