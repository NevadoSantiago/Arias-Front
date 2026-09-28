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

  it('shows the partial-balance subtitle and the mustard note that lunches stay untouched', async () => {
    vi.mocked(getPacks).mockResolvedValue([dayPack, weekPack]);
    renderSheet({ walletAvailable: 1, totalLunches: 2 });

    expect(await screen.findByText(/tenés 1 almuerzo y este pedido usa 2 almuerzos/i)).toBeInTheDocument();
    expect(screen.getByText(/tu almuerzo disponible queda intacto/i)).toBeInTheDocument();
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
});
