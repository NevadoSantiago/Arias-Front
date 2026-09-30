import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  GoogleLogin: () => <button type="button">Continuar con Google</button>,
}));

describe('GoogleLoginButton', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('renders nothing when VITE_GOOGLE_CLIENT_ID is missing, instead of crashing', async () => {
    // Vacío a propósito: un .env.local real no puede filtrarse al test.
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    const { GoogleLoginButton: FreshGoogleLoginButton } = await import('./GoogleLoginButton');
    const { container } = render(<FreshGoogleLoginButton onSuccess={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the Google button once VITE_GOOGLE_CLIENT_ID is configured', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');
    const { GoogleLoginButton: FreshGoogleLoginButton } = await import('./GoogleLoginButton');

    render(<FreshGoogleLoginButton onSuccess={vi.fn()} />);

    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument();
  });
});
