import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from './LandingPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe('LandingPage (B2C root — spec public-landing)', () => {
  it('shows the B2C journey with a call to action to register', () => {
    renderPage();

    const registerLinks = screen.getAllByRole('link', { name: /cre[áa] tu cuenta/i });
    expect(registerLinks.length).toBeGreaterThan(0);
    for (const link of registerLinks) {
      expect(link).toHaveAttribute('href', '/register');
    }
    expect(screen.getByRole('link', { name: /ya tengo cuenta/i })).toHaveAttribute('href', '/login');
  });

  it('does not show corporate (B2B) content directly on the root page', () => {
    renderPage();

    // The quote form ("Empresa" field, "Pida su cotización" button) belongs
    // exclusively to /corporate — the root must never render it.
    expect(screen.queryByLabelText(/^empresa$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pida su cotización/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/cantidad de empleados/i)).not.toBeInTheDocument();
  });

  it('links to /corporate for visitors looking for the business offering', () => {
    renderPage();

    expect(screen.getByRole('link', { name: /propuesta corporativa/i })).toHaveAttribute(
      'href',
      '/corporate',
    );
  });
});
