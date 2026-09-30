import { describe, expect, it } from 'vitest';
import { resolveCallName } from './callName';

const base = { email: 'cliente@example.com', firstName: null, lastName: null, nickname: null, displayName: '' };

describe('resolveCallName', () => {
  it('uses the backend displayName when it comes', () => {
    expect(resolveCallName({ ...base, displayName: 'Lu' })).toBe('Lu');
  });

  it('falls back to the nickname when displayName is missing', () => {
    expect(resolveCallName({ ...base, displayName: undefined, nickname: 'Lu', firstName: 'Lucía' })).toBe('Lu');
  });

  it('falls back to first + last name without a nickname', () => {
    expect(resolveCallName({ ...base, displayName: '', firstName: 'Lucía', lastName: 'Pérez' })).toBe('Lucía Pérez');
    expect(resolveCallName({ ...base, displayName: '  ', firstName: 'Lucía' })).toBe('Lucía');
  });

  it('falls back to the email as the last resort', () => {
    expect(resolveCallName({ ...base, displayName: undefined })).toBe('cliente@example.com');
  });

  it('ignores blank nicknames and names', () => {
    expect(resolveCallName({ ...base, nickname: '  ', firstName: ' ', lastName: '', displayName: '' })).toBe(
      'cliente@example.com',
    );
  });
});
