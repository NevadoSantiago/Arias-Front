import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OrderConfirmedView } from './OrderConfirmedView';

const items = [
  { name: 'Milanesa napolitana', side: 'con papas fritas', costLabel: '2 almuerzos' },
  { name: 'Ensalada César', side: null, costLabel: '1 almuerzo' },
];

function renderView(props: Partial<Parameters<typeof OrderConfirmedView>[0]> = {}) {
  const onBackToMenu = vi.fn();
  render(
    <MemoryRouter>
      <OrderConfirmedView
        isToday={true}
        dayLongLabel="Jueves 24 de septiembre"
        pickupTimeLabel="15:00"
        items={items}
        totalLunches={3}
        walletAvailableAfter={9}
        onBackToMenu={onBackToMenu}
        {...props}
      />
    </MemoryRouter>,
  );
  return { onBackToMenu };
}

describe('OrderConfirmedView', () => {
  it('shows "¡Pedido confirmado!" and "Te esperamos hoy" for a same-day order', () => {
    renderView({ isToday: true });

    expect(screen.getByText('¡Pedido confirmado!')).toBeInTheDocument();
    expect(screen.getByText('Te esperamos hoy a las 15:00.')).toBeInTheDocument();
  });

  it('shows "¡Pedido programado!" and "Te esperamos el <día>" for a future order', () => {
    renderView({ isToday: false, dayLongLabel: 'Lunes 28 de septiembre' });

    expect(screen.getByText('¡Pedido programado!')).toBeInTheDocument();
    expect(screen.getByText('Te esperamos el lunes 28 de septiembre a las 15:00.')).toBeInTheDocument();
  });

  it('shows the pickup date/time and each line item with its cost', () => {
    renderView();

    expect(screen.getByText('Jueves 24 de septiembre · 15:00 hs')).toBeInTheDocument();
    expect(screen.getByText('Milanesa napolitana')).toBeInTheDocument();
    expect(screen.getByText('con papas fritas')).toBeInTheDocument();
    expect(screen.getByText('2 almuerzos')).toBeInTheDocument();
    expect(screen.getByText('Ensalada César')).toBeInTheDocument();
    expect(screen.getByText('1 almuerzo')).toBeInTheDocument();
  });

  it('shows how many lunches were used and, when known, the new wallet balance', () => {
    renderView({ totalLunches: 3, walletAvailableAfter: 9 });

    expect(screen.getByText('Reservaste 3 almuerzos para este pedido')).toBeInTheDocument();
    expect(screen.getByText('Te quedan 9 almuerzos')).toBeInTheDocument();
  });

  it('hides the new balance line when the wallet balance is not known', () => {
    renderView({ walletAvailableAfter: null });

    expect(screen.queryByText(/te quedan/i)).not.toBeInTheDocument();
  });

  it('calls onBackToMenu from "Volver al menú" and links "Ver mis almuerzos" to /credits', () => {
    const { onBackToMenu } = renderView();

    fireEvent.click(screen.getByRole('button', { name: /volver al menú/i }));
    expect(onBackToMenu).toHaveBeenCalled();

    expect(screen.getByRole('link', { name: /ver mis almuerzos/i })).toHaveAttribute('href', '/credits');
  });
});
