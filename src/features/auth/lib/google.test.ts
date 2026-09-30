import { describe, expect, it } from 'vitest';
import { decodeGoogleCredentialEmail, isGoogleAccountNotAllowed } from './google';

function fakeCredential(payload: object): string {
  const b64url = (value: string) =>
    btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url('{"alg":"RS256"}')}.${b64url(JSON.stringify(payload))}.signature`;
}

describe('decodeGoogleCredentialEmail', () => {
  it('reads the email from the JWT payload', () => {
    expect(decodeGoogleCredentialEmail(fakeCredential({ email: 'ana@empresa.com' }))).toBe(
      'ana@empresa.com',
    );
  });

  it('handles base64url payloads that need padding and url-safe characters', () => {
    const email = 'ana?>>@empresa.com';
    expect(decodeGoogleCredentialEmail(fakeCredential({ email }))).toBe(email);
  });

  it('returns undefined when the credential cannot be decoded', () => {
    expect(decodeGoogleCredentialEmail('not-a-jwt')).toBeUndefined();
    expect(decodeGoogleCredentialEmail('a.%%%.c')).toBeUndefined();
    expect(decodeGoogleCredentialEmail(fakeCredential({ sub: '1' }))).toBeUndefined();
  });
});

describe('isGoogleAccountNotAllowed', () => {
  it('is true for a 403 carrying the GOOGLE_ACCOUNT_NOT_ALLOWED error code', () => {
    const err = { response: { status: 403, data: { title: 'GOOGLE_ACCOUNT_NOT_ALLOWED' } } };
    expect(isGoogleAccountNotAllowed(err)).toBe(true);
  });

  it('is false for any other failure', () => {
    expect(isGoogleAccountNotAllowed({ response: { status: 403, data: {} } })).toBe(false);
    expect(
      isGoogleAccountNotAllowed({ response: { status: 401, data: { title: 'GOOGLE_ACCOUNT_NOT_ALLOWED' } } }),
    ).toBe(false);
    expect(isGoogleAccountNotAllowed(new Error('boom'))).toBe(false);
    expect(isGoogleAccountNotAllowed(null)).toBe(false);
  });
});
