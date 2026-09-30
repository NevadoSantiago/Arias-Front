import { describe, expect, it } from 'vitest';
import { phoneSchema } from './phone';

describe('phoneSchema', () => {
  it('accepts exactly 10 digits', () => {
    expect(phoneSchema.parse('1159876547')).toBe('1159876547');
  });

  it('strips spaces and dashes before validating and returns only the digits', () => {
    expect(phoneSchema.parse('11 5987-6547')).toBe('1159876547');
    expect(phoneSchema.parse(' 11-5987 6547 ')).toBe('1159876547');
  });

  it.each(['115987654', '11598765478', '+54 9 11 5987-6547', '011 5987 6547', 'abcdefghij'])(
    'rejects %s',
    (value) => {
      const result = phoneSchema.safeParse(value);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Ingresá los 10 dígitos de tu celular');
      }
    },
  );

  it('asks for the phone when empty', () => {
    const result = phoneSchema.safeParse('');
    expect(result.success).toBe(false);
  });
});
