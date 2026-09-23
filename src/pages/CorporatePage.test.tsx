import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CorporatePage } from './CorporatePage';

vi.mock('@/features/landing/services/landingApi', () => ({
  submitQuote: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <CorporatePage />
    </MemoryRouter>,
  );
}

describe('CorporatePage (/corporate — spec public-landing)', () => {
  it('keeps the quote form working exactly as before the landing split', () => {
    renderPage();

    const empresaField = screen.getByLabelText(/^empresa$/i);
    expect(empresaField).toBeInTheDocument();

    // The exact button text appears twice (a scroll CTA in the hero and the
    // form's submit button) — the submit one is what actually sends the quote.
    const submitButton = screen
      .getAllByRole('button', { name: /pida su cotización/i })
      .find((btn) => btn.getAttribute('type') === 'submit');
    expect(submitButton).toBeInTheDocument();
  });

  it('preserves the corporate pitch content moved from the former root landing', () => {
    renderPage();

    expect(screen.getByText(/todo lo que su empresa necesita/i)).toBeInTheDocument();
  });
});
