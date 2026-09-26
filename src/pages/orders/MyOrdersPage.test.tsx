import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { MyOrdersPage } from './MyOrdersPage';
import { cancelOrderV2, getOrdersV2 } from '@/features/orders/services/ordersApi';
import { getWallet } from '@/features/credits/services/creditsApi';
import type { OrderV2 } from '@/features/orders/services/ordersApi';

vi.mock('@/features/orders/services/ordersApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/orders/services/ordersApi')>(
    '@/features/orders/services/ordersApi',
  );
  return {
    ...actual,
    getOrdersV2: vi.fn(),
    cancelOrderV2: vi.fn(),
  };
});

// F10: el saldo mostrado en la hoja de cancelación viene de la billetera
// (`useWallet`/`creditsWallet`), así que hace falta controlarla acá también.
vi.mock('@/features/credits/services/creditsApi', () => ({
  getWallet: vi.fn(),
}));

// F10: el aviso de éxito ahora usa `toast.success` con el texto de la
// decisión del usuario ("Pedido cancelado · N almuerzo(s) volvió/volvieron
// a tu saldo"); no hay <Toaster/> montado en el test, así que se mockea
// para poder verificar el mensaje.
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Default: la mayoría de los tests no abren la hoja de cancelación, pero
// dejamos un valor resuelto por si el componente la consulta igual.
vi.mocked(getWallet).mockResolvedValue({ available: 8, committed: 4, expiresAt: null });

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MyOrdersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

const HOUR_MS = 60 * 60 * 1000;
const futureIso = (hours: number) => new Date(Date.now() + hours * HOUR_MS).toISOString();
const pastIso = (hours: number) => new Date(Date.now() - hours * HOUR_MS).toISOString();

const cancellableOrder: OrderV2 = {
  id: 123,
  fecha: '2026-09-24',
  pickupAt: futureIso(2),
  estado: 'PENDIENTE',
  creditTotal: 4,
  notas: null,
  items: [
    {
      id: 1,
      dishId: 10,
      dishNombre: 'Milanesa',
      dishCategoria: 'Premium',
      sideId: 5,
      sideNombre: 'Puré',
      creditCost: 2,
      notas: null,
    },
    {
      id: 2,
      dishId: 11,
      dishNombre: 'Ensalada',
      dishCategoria: 'Básico',
      sideId: null,
      sideNombre: null,
      creditCost: 2,
      notas: null,
    },
  ],
  cancellable: true,
};

const nonCancellableOrder: OrderV2 = {
  ...cancellableOrder,
  id: 124,
  estado: 'CONFIRMADO',
  cancellable: false,
};

const cancelledOrder: OrderV2 = {
  ...cancellableOrder,
  id: 125,
  estado: 'CANCELADO',
  cancellable: false,
};

const pastOrder: OrderV2 = {
  ...cancellableOrder,
  id: 190,
  pickupAt: pastIso(3),
  estado: 'ENTREGADO',
  cancellable: false,
};

describe('MyOrdersPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.mocked(getWallet).mockResolvedValue({ available: 8, committed: 4, expiresAt: null });
  });

  it('renders orders with items and the total formatted as "N almuerzos"', async () => {
    vi.mocked(getOrdersV2).mockResolvedValueOnce([cancellableOrder]);

    renderPage();

    expect(await screen.findByText('Milanesa')).toBeInTheDocument();
    expect(screen.getByText(/puré/i)).toBeInTheDocument();
    expect(screen.getByText('Ensalada')).toBeInTheDocument();
    expect(screen.getByText('4 almuerzos')).toBeInTheDocument();
    expect(screen.queryByText(/créditos?\b/i)).not.toBeInTheDocument();
  });

  it('offers the cancel action only when the backend reports cancellable: true', async () => {
    vi.mocked(getOrdersV2).mockResolvedValueOnce([cancellableOrder, nonCancellableOrder]);

    renderPage();

    const cards = await screen.findAllByTestId('order-card');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByRole('button', { name: /cancelar pedido/i })).toBeInTheDocument();
    expect(within(cards[1]).queryByRole('button', { name: /cancelar pedido/i })).not.toBeInTheDocument();
  });

  // F10: "Cancelar pedido" ahora abre una hoja de confirmación (D1 aprobado)
  // en vez de un AlertDialog inline; el resumen del pedido y el cálculo
  // "Pasás de X a Y almuerzos disponibles" (de la billetera) son nuevos.
  it('cancels the order through the confirmation sheet and refreshes the list and wallet', async () => {
    vi.mocked(getOrdersV2)
      .mockResolvedValueOnce([cancellableOrder])
      .mockResolvedValueOnce([{ ...cancellableOrder, estado: 'CANCELADO', cancellable: false }]);
    vi.mocked(cancelOrderV2).mockResolvedValueOnce(undefined);

    const { queryClient } = renderPage();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(await screen.findByRole('button', { name: /cancelar pedido/i }));

    expect(await screen.findByText('¿Cancelar este pedido?')).toBeInTheDocument();
    expect(await screen.findByText(/pasás de 8 a 12 almuerzos disponibles/i)).toBeInTheDocument();
    await waitFor(() => expect(getWallet).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByRole('button', { name: /sí, cancelar pedido/i }));

    // TanStack Query invoca la mutationFn con (variables, context), así que
    // afirmamos sobre el primer argumento y no sobre la lista completa.
    await waitFor(() => expect(vi.mocked(cancelOrderV2).mock.calls[0]?.[0]).toBe(123));
    await waitFor(() => expect(getOrdersV2).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Cancelado')).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringMatching(/pedido cancelado.*4 almuerzos volvieron a tu saldo/i),
    );
    // La billetera también se refresca, no solo la lista de pedidos: se
    // afirma la invalidación explícita de su clave de caché compartida
    // (misma clave que usa `useWallet`), igual que ya hace B2cOrderPage.test.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['creditsWallet'] });
  });

  // Corrección: el conteo del toast de éxito venía de `cancelTarget` (estado
  // de React) leído en el momento de `onSuccess`, no de las variables de la
  // mutación. Si `cancelTarget` cambia mientras la cancelación en curso
  // sigue pendiente (acá, pidiendo cancelar OTRO pedido debajo de la hoja),
  // el toast terminaba usando el conteo del pedido equivocado.
  it('shows the toast with the cancelled order real count, even if cancelTarget changes while the mutation is pending', async () => {
    const orderA: OrderV2 = { ...cancellableOrder, id: 201, creditTotal: 4 };
    const orderB: OrderV2 = { ...cancellableOrder, id: 202, creditTotal: 2, pickupAt: futureIso(5) };
    vi.mocked(getOrdersV2).mockResolvedValue([orderA, orderB]);
    let resolveCancel: () => void = () => {};
    vi.mocked(cancelOrderV2).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCancel = () => resolve(undefined);
        }),
    );

    renderPage();

    const cards = await screen.findAllByTestId('order-card');
    fireEvent.click(within(cards[0]).getByRole('button', { name: /cancelar pedido/i }));
    fireEvent.click(await screen.findByRole('button', { name: /sí, cancelar pedido/i }));
    await waitFor(() => expect(cancelOrderV2).toHaveBeenCalled());

    // Mientras la cancelación de orderA sigue pendiente, se pide cancelar
    // orderB (debajo de la hoja) — esto pisa `cancelTarget` en el estado.
    // Radix marca el fondo `aria-hidden` mientras la hoja está abierta, así
    // que se ubica el botón por texto (no por rol) para simular el cambio
    // de estado sin depender de que sea alcanzable por el usuario.
    fireEvent.click(within(cards[1]).getByText(/cancelar pedido/i));

    resolveCancel();

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/4 almuerzos volvieron a tu saldo/i)),
    );
  });

  // F10: un error de cancelación se muestra en la propia hoja y el pedido
  // sigue como estaba (nunca se lo saca de la lista de forma optimista).
  it('shows the error and keeps the order when cancelling fails', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([cancellableOrder]);
    vi.mocked(cancelOrderV2).mockRejectedValueOnce(new Error('network error'));

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /cancelar pedido/i }));
    fireEvent.click(await screen.findByRole('button', { name: /sí, cancelar pedido/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudimos cancelar/i);
    expect(screen.getAllByTestId('order-card')).toHaveLength(1);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('shows a cancelled order as cancelled, without a cancel action', async () => {
    vi.mocked(getOrdersV2).mockResolvedValueOnce([cancelledOrder]);

    renderPage();

    expect(await screen.findByText('Cancelado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancelar pedido/i })).not.toBeInTheDocument();
  });

  it('shows an empty state pointing to ordering when there are no orders', async () => {
    vi.mocked(getOrdersV2).mockResolvedValueOnce([]);

    renderPage();

    expect(await screen.findByText(/todavía no hiciste ningún pedido/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /hacer mi primer pedido/i });
    expect(link).toHaveAttribute('href', '/orders/today');
  });

  // F10: agrupación "Próximos" (retiro >= ahora, ascendente) / "Anteriores"
  // (retiro < ahora, descendente), cada una con su contador.
  it('splits orders into "Próximos" and "Anteriores" with a count for each', async () => {
    vi.mocked(getOrdersV2).mockResolvedValueOnce([cancellableOrder, pastOrder]);

    renderPage();

    const proximosHeader = (await screen.findByText('Próximos')).closest('header');
    const anterioresHeader = screen.getByText('Anteriores').closest('header');
    expect(proximosHeader).not.toBeNull();
    expect(anterioresHeader).not.toBeNull();
    expect(within(proximosHeader as HTMLElement).getByText('1')).toBeInTheDocument();
    expect(within(anterioresHeader as HTMLElement).getByText('1')).toBeInTheDocument();
  });

  // F10, decisión del usuario (2026-09-26): PENDIENTE se muestra como
  // "Programado" y ENTREGADO como "Retirado" (aunque v2 no lo produce hoy).
  it('maps PENDIENTE to "Programado" and ENTREGADO to "Retirado"', async () => {
    vi.mocked(getOrdersV2).mockResolvedValueOnce([cancellableOrder, pastOrder]);

    renderPage();

    expect(await screen.findByText('Programado')).toBeInTheDocument();
    expect(await screen.findByText('Retirado')).toBeInTheDocument();
  });

  it('shows the footer note about the last 30 orders when there is at least one order', async () => {
    vi.mocked(getOrdersV2).mockResolvedValueOnce([cancellableOrder]);

    renderPage();

    expect(await screen.findByText('Mostramos tus últimos 30 pedidos.')).toBeInTheDocument();
  });
});
