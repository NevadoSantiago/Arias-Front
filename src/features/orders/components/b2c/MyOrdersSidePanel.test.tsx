import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MyOrdersSidePanel } from './MyOrdersSidePanel';

function renderPanel() {
  return render(
    <MemoryRouter>
      <MyOrdersSidePanel available={3} committed={1} cancelLimitMinutes={20} />
    </MemoryRouter>,
  );
}

describe('MyOrdersSidePanel — balance box', () => {
  it('paints the balance box with the Arias gingham instead of the dark background', () => {
    renderPanel();

    const box = screen.getByRole('region', { name: 'Tu saldo' });
    expect(box.style.backgroundImage).toContain(
      'repeating-linear-gradient(90deg',
    );
    expect(box.style.backgroundImage).toContain(
      'repeating-linear-gradient(0deg',
    );
    expect(box.style.backgroundColor).toBe('rgb(255, 252, 245)');
    expect(box.className).not.toContain('bg-foreground');
    expect(box.className).not.toContain('text-background');
  });

  it('keeps the balance figures and the link to the lunches page', () => {
    renderPanel();

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('almuerzos para pedir')).toBeInTheDocument();
    expect(screen.getByText('1 almuerzo')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ver mis almuerzos' }),
    ).toHaveAttribute('href', '/credits');
  });
});

describe('MyOrdersSidePanel — refund note', () => {
  it('explains the refund window instead of saying cancelling stops being possible', () => {
    renderPanel();

    expect(
      screen.getByText('Si cancelás hasta 20 minutos antes del retiro, el almuerzo vuelve a tu saldo. Después, se descuenta.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ya no se puede cancelar/i)).not.toBeInTheDocument();
  });
});
