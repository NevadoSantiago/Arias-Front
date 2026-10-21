import { afterEach, describe, expect, it } from 'vitest';
import { useAuthStore } from './authStore';

describe('authStore — pendingWelcomeLunch', () => {
  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, pendingWelcomeLunch: false });
  });

  it('is off by default', () => {
    expect(useAuthStore.getState().pendingWelcomeLunch).toBe(false);
  });

  it('is set by setPendingWelcomeLunch and reset by clear()', () => {
    useAuthStore.getState().setPendingWelcomeLunch(true);
    expect(useAuthStore.getState().pendingWelcomeLunch).toBe(true);

    useAuthStore.getState().clear();
    expect(useAuthStore.getState().pendingWelcomeLunch).toBe(false);
  });
});
