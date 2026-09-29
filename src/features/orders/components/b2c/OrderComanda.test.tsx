import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { OrderComanda } from './OrderComanda';
import type { ComandaItem } from './comandaModel';

const items: ComandaItem[] = [
  { name: 'Milanesa napolitana', side: 'c/ papas fritas', note: 'Sin sal, por favor', costLabel: '1 almuerzo', isNew: false },
  { name: 'Ensalada César', side: null, note: null, costLabel: '1 almuerzo', isNew: true },
];

function renderComanda(props: Partial<React.ComponentProps<typeof OrderComanda>> = {}) {
  return render(
    <OrderComanda
      orderId={142}
      dateLabel="Jueves 24 de septiembre"
      callName="Sofi"
      whenLabel="Hoy, jueves 24 · 13:00 hs"
      items={items}
      footer={{ label: 'Reservaste 2 almuerzos para este pedido', value: 'Te quedan 10 almuerzos', icon: 'lunches' }}
      {...props}
    />,
  );
}

describe('OrderComanda', () => {
  it('shows the zero-padded order number, the date and the boxed name the kitchen calls', () => {
    renderComanda();

    const paper = screen.getByRole('article', { name: /comanda número 0142/i });
    expect(within(paper).getByText('Comanda Nº 0142')).toBeInTheDocument();
    expect(within(paper).getByText('Jueves 24 de septiembre')).toBeInTheDocument();
    expect(within(paper).getByText('Te vamos a llamar como')).toBeInTheDocument();
    expect(within(paper).getByText('Sofi')).toBeInTheDocument();
  });

  it('shows the pickup time and the visible address placeholder', () => {
    renderComanda();

    expect(screen.getByText('Hoy, jueves 24 · 13:00 hs')).toBeInTheDocument();
    expect(screen.getByText('[DIRECCIÓN DEL LOCAL]')).toBeInTheDocument();
  });

  it('lists every item with its side, note, cost and the "Nuevo" tag on added ones', () => {
    renderComanda();

    expect(screen.getByText('Milanesa napolitana')).toBeInTheDocument();
    expect(screen.getByText('c/ papas fritas')).toBeInTheDocument();
    expect(screen.getByText('Sin sal, por favor')).toBeInTheDocument();
    expect(screen.getByText('Ensalada César')).toBeInTheDocument();
    expect(screen.getByText('sin acompañamiento')).toBeInTheDocument();
    expect(screen.getAllByText('1 almuerzo')).toHaveLength(2);
    expect(screen.getAllByText('Nuevo')).toHaveLength(1);
  });

  it('shows the footer label and value', () => {
    renderComanda();

    expect(screen.getByText('Reservaste 2 almuerzos para este pedido')).toBeInTheDocument();
    expect(screen.getByText('Te quedan 10 almuerzos')).toBeInTheDocument();
  });

  it('shows the Mercado Pago footer with the visible price placeholder', () => {
    renderComanda({ footer: { label: 'Pagado con Mercado Pago', value: '$ [PRECIO]', icon: 'card' } });

    expect(screen.getByText('Pagado con Mercado Pago')).toBeInTheDocument();
    expect(screen.getByText('$ [PRECIO]')).toBeInTheDocument();
  });

  it('shows the state badge when an estado is given and none otherwise', () => {
    const { unmount } = renderComanda({ estado: 'PENDIENTE' });
    expect(screen.getByText('Programado')).toBeInTheDocument();
    unmount();

    renderComanda();
    expect(screen.queryByText('Programado')).not.toBeInTheDocument();
  });

  it('looks muted for a cancelled order', () => {
    renderComanda({ estado: 'CANCELADO', muted: true });

    expect(screen.getByText('Cancelado')).toBeInTheDocument();
    expect(screen.getByTestId('comanda')).toHaveClass('opacity-60');
  });
});
