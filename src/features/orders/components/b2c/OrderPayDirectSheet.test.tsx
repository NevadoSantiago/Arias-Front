import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { OrderPayDirectSheet } from './OrderPayDirectSheet';
import { getPacks } from '@/features/credits/services/creditsApi';
import type { CreditPack } from '@/features/credits/types';
import type { CartLine } from '../../hooks/useCart';
import type { Dish } from '../../types';

vi.mock('@/features/credits/services/creditsApi', () => ({
  getPacks: vi.fn(),
}));

const dish: Dish = {
  id: 10,
  nombre: 'Milanesa napolitana',
  descripcion: 'Con papas fritas',
  fotoUrl: null,
  category: { id: 1, nombre: 'Básico', parentId: null, creditCost: 1 },
  menuSection: { id: 1, nombre: 'Carnes', ordenDisplay: 1 },
  sideType: null,
  allowedSides: [],
  stockActual: 5,
  especial: false,
};

const dish2: Dish = {
  ...dish,
  id: 11,
  nombre: 'Ensalada César',
};

const lines: CartLine[] = [
  { localId: 'l1', dish, sideId: null, sideNombre: 'Papas fritas', notas: null },
  { localId: 'l2', dish: dish2, sideId: null, sideNombre: null, notas: null },
];

const dayPack: CreditPack = {
  id: 1,
  code: 'DAY',
  nombre: 'Sueltos',
  creditAmount: 1,
  priceCents: 150000, // $1500 por almuerzo
  discountPercent: 0,
  ordenDisplay: 1,
  enabled: true,
};

const weekPack: CreditPack = {
  id: 2,
  code: 'WEEK',
  nombre: 'Paquete Semana',
  creditAmount: 5,
  priceCents: 600000, // $1200 por almuerzo — más barato que Sueltos
  discountPercent: 20,
  ordenDisplay: 2,
  enabled: true,
};

function baseProps(overrides: Partial<Parameters<typeof OrderPayDirectSheet>[0]> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    pickupLabel: 'Retiro hoy 13:00 hs',
    lines,
    totalLunches: 2,
    walletAvailable: 0,
    onPay: vi.fn(),
    paying: false,
    payError: null,
    ...overrides,
  };
}

function renderSheet(overrides: Partial<Parameters<typeof OrderPayDirectSheet>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props = baseProps(overrides);
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <OrderPayDirectSheet {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return props;
}

describe('OrderPayDirectSheet', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the zero-balance subtitle and no partial note when the wallet is empty', async () => {
    vi.mocked(getPacks).mockResolvedValue([dayPack, weekPack]);
    renderSheet({ walletAvailable: 0 });

    expect(await screen.findByText('Pagá este pedido con Mercado Pago')).toBeInTheDocument();
    expect(screen.getByText(/no tenés almuerzos disponibles\. pagás solo este pedido y listo/i)).toBeInTheDocument();
    expect(screen.queryByText(/queda intacto|quedan intactos/i)).not.toBeInTheDocument();
  });

  describe('partial balance (F23, D5)', () => {
    it('titles the dialog "Pagá lo que falta" and says how many lunches come from the balance', async () => {
      vi.mocked(getPacks).mockResolvedValue([dayPack, weekPack]);
      renderSheet({ walletAvailable: 1, totalLunches: 2 });

      expect(await screen.findByText('Pagá lo que falta con Mercado Pago')).toBeInTheDocument();
      expect(screen.queryByText('Pagá este pedido con Mercado Pago')).not.toBeInTheDocument();
      // Usás 1 almuerzo de tu saldo y pagás 1 con Mercado Pago · $1.500 (M × precio DÍA)
      expect(
        await screen.findByText(/usás 1 almuerzo de tu saldo y pagás 1 con mercado pago · \$\s?1\.500,00/i),
      ).toBeInTheDocument();
    });

    it('splits the order into the balance part and the Mercado Pago part with the price of M lunches only', async () => {
      vi.mocked(getPacks).mockResolvedValue([dayPack, weekPack]);
      renderSheet({ walletAvailable: 1, totalLunches: 3, lines: [...lines, { ...lines[0], localId: 'l3' }] });

      expect(await screen.findByText('De tu saldo')).toBeInTheDocument();
      expect(screen.getByText('Pagás con Mercado Pago')).toBeInTheDocument();
      // M = 3 - 1 = 2 → 2 × $1.500,00 = $3.000,00
      expect(await screen.findByText(/2 × \$\s?1\.500,00/)).toBeInTheDocument();
      expect(screen.getByText('Total a pagar')).toBeInTheDocument();
      expect(screen.getAllByText(/\$\s?3\.000,00/).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /pagar \$\s?3\.000,00 con mercado pago/i })).toBeEnabled();
    });

    it('pluralizes the balance part and the note (2 lunches from the balance)', async () => {
      vi.mocked(getPacks).mockResolvedValue([dayPack, weekPack]);
      renderSheet({ walletAvailable: 2, totalLunches: 3, lines: [...lines, { ...lines[0], localId: 'l3' }] });

      expect(await screen.findByText(/usás 2 almuerzos de tu saldo y pagás 1 con mercado pago/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /al pagar reservamos tu pedido y tus 2 almuerzos\. si el pago no se aprueba, se cancela y vuelven a tu saldo\./i,
        ),
      ).toBeInTheDocument();
    });

    it('explains that the single reserved lunch goes back to the balance if the payment fails', async () => {
      vi.mocked(getPacks).mockResolvedValue([dayPack, weekPack]);
      renderSheet({ walletAvailable: 1, totalLunches: 2 });

      expect(
        await screen.findByText(
          'Al pagar reservamos tu pedido y tu almuerzo. Si el pago no se aprueba, se cancela y el almuerzo vuelve a tu saldo.',
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText(/queda intacto|quedan intactos|pedido completo/i)).not.toBeInTheDocument();
    });

    it('keeps the pack reminder and its link in the partial variant', async () => {
      vi.mocked(getPacks).mockResolvedValue([dayPack, weekPack]);
      renderSheet({ walletAvailable: 1, totalLunches: 2 });

      expect(await screen.findByText(/paquete semana/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Ver paquetes' })).toHaveAttribute('href', '/credits/packs');
    });

    it('keeps the full-order copy and amount with an empty balance', async () => {
      vi.mocked(getPacks).mockResolvedValue([dayPack, weekPack]);
      renderSheet({ walletAvailable: 0, totalLunches: 2 });

      expect(await screen.findByText('Pagá este pedido con Mercado Pago')).toBeInTheDocument();
      expect(screen.queryByText('De tu saldo')).not.toBeInTheDocument();
      expect(screen.getByText('Reservamos tu pedido mientras pagás. Si el pago no se aprueba, se cancela solo.')).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: /pagar \$\s?3\.000,00 con mercado pago/i })).toBeInTheDocument();
    });
  });

  it('shows the ticket with dishes, the pickup line and the total from the DAY pack price, rounded up', async () => {
    vi.mocked(getPacks).mockResolvedValue([dayPack, weekPack]);
    renderSheet({ lines, totalLunches: 2, pickupLabel: 'Retiro hoy 13:00 hs' });

    expect(await screen.findByText('Milanesa napolitana')).toBeInTheDocument();
    expect(screen.getByText('Ensalada César')).toBeInTheDocument();
    expect(screen.getByText('Retiro hoy 13:00 hs')).toBeInTheDocument();
    // 2 almuerzos × $1.500,00 = $3.000,00 — depende de que `getPacks` resuelva.
    expect(await screen.findByText(/2 × \$\s?1\.500,00/)).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /pagar \$\s?3\.000,00 con mercado pago/i }),
    ).toBeInTheDocument();
  });

  it('shows the cheaper pack callout with the savings and a link to /credits/packs', async () => {
    vi.mocked(getPacks).mockResolvedValue([dayPack, weekPack]);
    renderSheet({ totalLunches: 2 });

    // El nombre del pack va en un <strong>, así que el texto está partido en
    // varios nodos — se compara contra el textContent completo del párrafo.
    const packName = await screen.findByText('Paquete Semana');
    expect(packName.closest('span')).toHaveTextContent(/cada almuerzo te sale \$\s?1\.200,00 \(ahorrás 20%\)/i);
    expect(screen.getByRole('link', { name: /ver paquetes/i })).toHaveAttribute('href', '/credits/packs');
  });

  it('hides the callout when no named pack is cheaper per lunch than DAY', async () => {
    const expensivePack: CreditPack = { ...weekPack, priceCents: 900000 }; // $1800/almuerzo > $1500
    vi.mocked(getPacks).mockResolvedValue([dayPack, expensivePack]);
    renderSheet({ totalLunches: 2 });

    await screen.findByText('Pagá este pedido con Mercado Pago');
    expect(screen.queryByText(/cada almuerzo te sale/i)).not.toBeInTheDocument();
  });

  it('calls onPay when the primary button is clicked', async () => {
    vi.mocked(getPacks).mockResolvedValue([dayPack, weekPack]);
    const props = renderSheet();

    fireEvent.click(await screen.findByRole('button', { name: /con mercado pago/i }));

    expect(props.onPay).toHaveBeenCalled();
  });

  it('calls onClose (keeping the cart) when "Volver" is clicked', async () => {
    vi.mocked(getPacks).mockResolvedValue([dayPack, weekPack]);
    const props = renderSheet();

    fireEvent.click(await screen.findByRole('button', { name: /^volver$/i }));

    expect(props.onClose).toHaveBeenCalled();
  });

  it('shows the pay error message when present', async () => {
    vi.mocked(getPacks).mockResolvedValue([dayPack, weekPack]);
    renderSheet({ payError: 'El pago directo no está disponible ahora. Comprá un paquete para pedir.' });

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('El pago directo no está disponible ahora. Comprá un paquete para pedir.');
  });

  // Fix de review: cuando el precio no se puede calcular (falla `getPacks`
  // o no hay un pack DAY habilitado), el botón de pago quedaba habilitado
  // con "Pagar  con Mercado Pago" (doble espacio) y un total "—". Ahora se
  // deshabilita y se explica el motivo, con un link a los paquetes.
  it('disables the pay button and explains the price could not be calculated when there is no enabled DAY pack', async () => {
    vi.mocked(getPacks).mockResolvedValue([weekPack]); // sin DAY habilitado
    renderSheet({ totalLunches: 2 });

    expect(
      await screen.findByText(/no pudimos calcular el precio\. probá de nuevo en un momento o comprá un paquete/i),
    ).toBeInTheDocument();
    const payButton = screen.getByRole('button', { name: /con mercado pago/i });
    expect(payButton).toBeDisabled();
    expect(screen.getByRole('link', { name: /ver paquetes/i })).toHaveAttribute('href', '/credits/packs');
  });

  it('disables the pay button and explains the price could not be calculated when getPacks fails', async () => {
    vi.mocked(getPacks).mockRejectedValue(new Error('network error'));
    renderSheet({ totalLunches: 2 });

    expect(
      await screen.findByText(/no pudimos calcular el precio\. probá de nuevo en un momento o comprá un paquete/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /con mercado pago/i })).toBeDisabled();
    expect(screen.getByRole('link', { name: /ver paquetes/i })).toHaveAttribute('href', '/credits/packs');
  });

  it('shows a disabled loading state while packs are still loading', () => {
    vi.mocked(getPacks).mockReturnValue(new Promise(() => {})); // never resolves
    renderSheet({ totalLunches: 2 });

    expect(screen.getByRole('button', { name: /calculando precio/i })).toBeDisabled();
    expect(
      screen.queryByText(/no pudimos calcular el precio/i),
    ).not.toBeInTheDocument();
  });

  it('enables the pay button with the calculated amount once packs load successfully', async () => {
    vi.mocked(getPacks).mockResolvedValue([dayPack, weekPack]);
    renderSheet({ totalLunches: 2 });

    const payButton = await screen.findByRole('button', { name: /pagar \$\s?3\.000,00 con mercado pago/i });
    expect(payButton).not.toBeDisabled();
  });
});
