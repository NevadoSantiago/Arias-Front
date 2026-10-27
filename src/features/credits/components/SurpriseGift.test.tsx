import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SurpriseGift } from './SurpriseGift';
import { surpriseStorageKey } from '../surpriseStorage';

const inHours = (h: number) => new Date(Date.now() + h * 3_600_000 + 60_000).toISOString();
const discount = () => ({ percent: 10, expiresAt: inHours(164) });

function renderGift(userId = 7, d = discount()) {
  return render(
    <MemoryRouter>
      <SurpriseGift userId={userId} discount={d} />
    </MemoryRouter>,
  );
}

describe('SurpriseGift', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('starts closed: a button with the invitation and the countdown, no benefit text yet', () => {
    renderGift();

    const gift = screen.getByRole('button', { name: /tu almuerzo vino con sorpresa/i });
    expect(gift).toHaveTextContent('Tocá para abrirla');
    expect(gift).toHaveTextContent(/vence en 6 d 20 h/i);
    expect(screen.queryByText(/de descuento en tu próxima compra/i)).not.toBeInTheDocument();
  });

  it('opens on tap with one confetti burst and the benefit, and links to the buy flow', () => {
    renderGift();

    fireEvent.click(screen.getByRole('button', { name: /tu almuerzo vino con sorpresa/i }));

    expect(screen.getByText('Beneficio primeros 100 clientes')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
    expect(screen.getByText('de descuento en tu próxima compra')).toBeInTheDocument();
    expect(screen.getByText(/ya está aplicado en tu cuenta/i)).toBeInTheDocument();
    expect(screen.getByText(/vence en 6 d 20 h/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /comprar almuerzos/i })).toHaveAttribute('href', '/credits?comprar=1');
    expect(screen.getAllByTestId('confetti-piece').length).toBeGreaterThan(0);
  });

  it('remembers it was opened per user on this device', () => {
    renderGift(7);
    fireEvent.click(screen.getByRole('button', { name: /tu almuerzo vino con sorpresa/i }));

    expect(window.localStorage.getItem(surpriseStorageKey(7))).toBe('1');
    expect(window.localStorage.getItem(surpriseStorageKey(8))).toBeNull();
  });

  it('comes back already opened and without confetti', () => {
    window.localStorage.setItem(surpriseStorageKey(7), '1');
    renderGift(7);

    expect(screen.getByText('de descuento en tu próxima compra')).toBeInTheDocument();
    expect(screen.queryAllByTestId('confetti-piece')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /tu almuerzo vino con sorpresa/i })).not.toBeInTheDocument();
  });

  it('still works when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderGift();

    fireEvent.click(screen.getByRole('button', { name: /tu almuerzo vino con sorpresa/i }));

    expect(screen.getByText('de descuento en tu próxima compra')).toBeInTheDocument();
  });

  it('renders nothing once the discount expired', () => {
    const { container } = renderGift(7, { percent: 10, expiresAt: '2020-01-01T00:00:00Z' });
    expect(container).toBeEmptyDOMElement();
  });
});
