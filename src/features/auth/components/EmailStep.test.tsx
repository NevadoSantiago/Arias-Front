import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EmailStep } from './EmailStep';

vi.mock('@/features/auth/services/authApi', () => ({
  checkEmail: vi.fn(),
  googleLogin: vi.fn(),
  me: vi.fn(),
}));

function renderStep() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <EmailStep onFirstLogin={vi.fn()} onPassword={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('EmailStep — sign-up link', () => {
  it('links to /register with "Creá tu cuenta" under a "¿No tenés cuenta?" divider', () => {
    renderStep();

    expect(screen.getByText('¿No tenés cuenta?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Creá tu cuenta' })).toHaveAttribute('href', '/register');
  });
});
