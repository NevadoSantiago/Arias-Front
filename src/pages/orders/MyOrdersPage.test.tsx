import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { MyOrdersPage } from './MyOrdersPage';
import {
  cancelOrderV2,
  changeOrderPickupTimeV2,
  DirectCheckoutNotResumableError,
  getOrdersV2,
  getPickupSlots,
  getRestaurantConfig,
  PickupTimeChangeError,
  resumeDirectCheckoutV2,
} from '@/features/orders/services/ordersApi';
import { getWallet } from '@/features/credits/services/creditsApi';
import { useAuthStore } from '@/features/auth/store/authStore';
import { formatOrderTimeLabel } from '@/features/orders/components/orderDateLabels';
import type { OrderV2 } from '@/features/orders/services/ordersApi';

vi.mock('@/features/orders/services/ordersApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/orders/services/ordersApi')>(
    '@/features/orders/services/ordersApi',
  );
  return {
    ...actual,
    getOrdersV2: vi.fn(),
    cancelOrderV2: vi.fn(),
    changeOrderPickupTimeV2: vi.fn(),
    getPickupSlots: vi.fn(),
    getRestaurantConfig: vi.fn(),
    resumeDirectCheckoutV2: vi.fn(),
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
// F18: "Pago pendiente" necesita `pickupLeadMinutes` para el aviso de corte
// — valor por defecto para los tests que no lo ejercitan directamente.
vi.mocked(getRestaurantConfig).mockResolvedValue({
  horaCorte: '10:00',
  pickupWindowStart: null,
  pickupWindowEnd: null,
  pickupLeadMinutes: 20,
});

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
  modifiable: true,
  pickupTimeChangeable: true,
  paidWithMercadoPago: false,
  creditsFromBalance: 0,
};

const nonCancellableOrder: OrderV2 = {
  ...cancellableOrder,
  id: 124,
  estado: 'CONFIRMADO',
  cancellable: false,
  modifiable: false,
  pickupTimeChangeable: false,
  paidWithMercadoPago: false,
  creditsFromBalance: 0,
};

const cancelledOrder: OrderV2 = {
  ...cancellableOrder,
  id: 125,
  estado: 'CANCELADO',
  cancellable: false,
  modifiable: false,
  pickupTimeChangeable: false,
  paidWithMercadoPago: false,
  creditsFromBalance: 0,
};

const pastOrder: OrderV2 = {
  ...cancellableOrder,
  id: 190,
  pickupAt: pastIso(3),
  estado: 'ENTREGADO',
  cancellable: false,
  modifiable: false,
  pickupTimeChangeable: false,
  paidWithMercadoPago: false,
  creditsFromBalance: 0,
};

describe('MyOrdersPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    // F17: por si un test que fija el reloj (`vi.useFakeTimers`) falla antes
    // de restaurarlo — sin esto, el reloj falso quedaría pisando el resto
    // de la suite. Es un no-op inofensivo cuando no había timers falsos.
    vi.useRealTimers();
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
    // F17: nonCancellableOrder es CONFIRMADO, que por defecto solo se
    // muestra si su retiro es hoy — se fija el reloj para que esta
    // aserción no dependa de la hora real de la corrida (cerca de
    // medianoche en Buenos Aires, "+2 horas" podría caer al día siguiente).
    vi.useFakeTimers({ toFake: ['Date'] });
    const now = new Date('2026-09-27T10:00:00-03:00');
    vi.setSystemTime(now);
    const samedayPickup = new Date(now.getTime() + 2 * HOUR_MS).toISOString();
    vi.mocked(getOrdersV2).mockResolvedValueOnce([
      { ...cancellableOrder, pickupAt: samedayPickup },
      { ...nonCancellableOrder, pickupAt: samedayPickup },
    ]);

    renderPage();

    const cards = await screen.findAllByTestId('order-card');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByRole('button', { name: /cancelar pedido/i })).toBeInTheDocument();
    expect(within(cards[1]).queryByRole('button', { name: /cancelar pedido/i })).not.toBeInTheDocument();

    vi.useRealTimers();
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
    // F17: un pedido CANCELADO queda oculto por defecto (incluso este, que
    // era el único "próximo" antes de cancelarlo), así que hay que revelar
    // "Anteriores" para verlo con su nuevo estado.
    fireEvent.click(await screen.findByRole('button', { name: /ver pedidos anteriores/i }));
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

    // F17: cancelados quedan ocultos por defecto, incluso si son futuros.
    fireEvent.click(await screen.findByRole('button', { name: /ver pedidos anteriores/i }));
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

    // F17: "Anteriores" queda oculta por defecto (pastOrder es ENTREGADO,
    // fuera de la vista por defecto), hay que revelarla primero.
    fireEvent.click(await screen.findByRole('button', { name: /ver pedidos anteriores/i }));

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
    // F17: ENTREGADO (pasado) queda oculto por defecto, hay que revelarlo.
    fireEvent.click(await screen.findByRole('button', { name: /ver pedidos anteriores/i }));
    expect(await screen.findByText('Retirado')).toBeInTheDocument();
  });

  it('shows the footer note about the last 30 orders when there is at least one order', async () => {
    vi.mocked(getOrdersV2).mockResolvedValueOnce([cancellableOrder]);

    renderPage();

    expect(await screen.findByText('Mostramos tus últimos 30 pedidos.')).toBeInTheDocument();
  });
});

// F18 (backend B7): "Pago pendiente" — pedido esperando la confirmación de
// Mercado Pago, cancelable con la misma ventana que uno PENDIENTE, pero no
// modificable (ver `OrderPlacementService.assertModifiable`).
describe('MyOrdersPage — PENDIENTE_PAGO ("Pago pendiente")', () => {
  const pendingPaymentOrder: OrderV2 = {
    ...cancellableOrder,
    id: 400,
    pickupAt: '2026-09-26T13:00:00-03:00',
    estado: 'PENDIENTE_PAGO',
    cancellable: true,
    modifiable: true,
    pickupTimeChangeable: true,
    paidWithMercadoPago: false,
    creditsFromBalance: 0,
  };

  // Reloj fijo el mismo día del pedido (antes del retiro) para que
  // `isDefaultUpcoming` lo muestre en "Próximos" sin depender de la fecha
  // real de la corrida — los tests que necesitan otra fecha la pisan.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-26T10:00:00-03:00'));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.mocked(getWallet).mockResolvedValue({ available: 8, committed: 4, expiresAt: null });
    vi.mocked(getRestaurantConfig).mockResolvedValue({
      horaCorte: '10:00',
      pickupWindowStart: null,
      pickupWindowEnd: null,
      pickupLeadMinutes: 20,
    });
  });

  it('shows the "Pago pendiente" badge and the Mercado Pago confirmation deadline line', async () => {
    vi.mocked(getOrdersV2).mockResolvedValueOnce([pendingPaymentOrder]);

    renderPage();

    expect(await screen.findByText('Pago pendiente')).toBeInTheDocument();
    // pickupAt 13:00 − 20 min de antelación = 12:40.
    expect(
      await screen.findByText(/si no se confirma antes de las 12:40, se cancela/i),
    ).toBeInTheDocument();
  });

  it('offers "Cancelar pedido" for a cancellable PENDIENTE_PAGO order, same as PENDIENTE', async () => {
    vi.mocked(getOrdersV2).mockResolvedValueOnce([pendingPaymentOrder]);

    renderPage();

    expect(await screen.findByRole('button', { name: /cancelar pedido/i })).toBeInTheDocument();
  });

  it('resumes the payment via "Pagar ahora" and redirects to Mercado Pago', async () => {
    // Autocontenido: el stub se restaura en el `finally` de este mismo test.
    const originalLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location')!;
    Object.defineProperty(window, 'location', { writable: true, value: { href: '' } });
    try {
      vi.mocked(getOrdersV2).mockResolvedValueOnce([pendingPaymentOrder]);
      vi.mocked(resumeDirectCheckoutV2).mockResolvedValueOnce({
        orderId: 400,
        purchaseId: 'p-1',
        initPoint: 'https://mp.example/checkout/p-1',
      });

      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: /pagar ahora/i }));

      await waitFor(() => expect(resumeDirectCheckoutV2).toHaveBeenCalledWith(400));
      await waitFor(() => expect(window.location.href).toBe('https://mp.example/checkout/p-1'));
    } finally {
      Object.defineProperty(window, 'location', originalLocationDescriptor);
    }
  });

  it('shows "Este pago ya no se puede retomar." and refetches orders on a 409', async () => {
    vi.mocked(getOrdersV2)
      .mockResolvedValueOnce([pendingPaymentOrder])
      .mockResolvedValueOnce([{ ...pendingPaymentOrder, estado: 'CANCELADO', cancellable: false }]);
    vi.mocked(resumeDirectCheckoutV2).mockRejectedValueOnce(new DirectCheckoutNotResumableError());

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /pagar ahora/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Este pago ya no se puede retomar.'),
    );
    await waitFor(() => expect(getOrdersV2).toHaveBeenCalledTimes(2));
  });

  it('shows a future PENDIENTE_PAGO order by default, in "Próximos"', async () => {
    vi.setSystemTime(new Date('2026-09-25T10:00:00-03:00'));
    vi.mocked(getOrdersV2).mockResolvedValueOnce([pendingPaymentOrder]);

    renderPage();

    const proximosHeader = (await screen.findByText('Próximos')).closest('header');
    expect(proximosHeader).not.toBeNull();
    expect(screen.getByText('Pago pendiente')).toBeInTheDocument();
  });

  // F18: cuenta como "próximo" hoy o en el futuro, no solo si el horario de
  // retiro todavía no pasó — el corte de pago es independiente del retiro.
  it("shows today's PENDIENTE_PAGO order by default even if its pickup time already passed", async () => {
    vi.setSystemTime(new Date('2026-09-26T20:00:00-03:00'));
    vi.mocked(getOrdersV2).mockResolvedValueOnce([pendingPaymentOrder]);

    renderPage();

    expect(await screen.findByText('Pago pendiente')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ver pedidos anteriores/i })).not.toBeInTheDocument();
  });
});

// F17: por defecto "Mis pedidos" solo muestra próximos programados
// (PENDIENTE con pickupAt >= ahora) y confirmados de HOY (CONFIRMADO cuyo
// día de retiro es hoy en la zona del restaurante) — todo lo demás
// (cancelados, pasados, confirmados de otro día) queda oculto detrás de
// "Ver pedidos anteriores". Reloj fijo para que la agrupación no dependa de
// la hora real de la corrida.
describe('MyOrdersPage — F17 default view (only upcoming + today)', () => {
  const NOW = new Date('2026-09-27T10:00:00-03:00');

  const futurePendiente: OrderV2 = {
    ...cancellableOrder,
    id: 301,
    pickupAt: '2026-09-28T13:00:00-03:00',
    estado: 'PENDIENTE',
    cancellable: true,
    modifiable: true,
    pickupTimeChangeable: true,
    paidWithMercadoPago: false,
    creditsFromBalance: 0,
    notas: 'Pedido futuro programado',
  };
  const todayConfirmado: OrderV2 = {
    ...cancellableOrder,
    id: 302,
    pickupAt: '2026-09-27T08:00:00-03:00',
    estado: 'CONFIRMADO',
    cancellable: false,
    modifiable: false,
    pickupTimeChangeable: false,
    paidWithMercadoPago: false,
    creditsFromBalance: 0,
    notas: 'Pedido confirmado de hoy',
  };
  const pastConfirmado: OrderV2 = {
    ...cancellableOrder,
    id: 303,
    pickupAt: '2026-09-26T13:00:00-03:00',
    estado: 'CONFIRMADO',
    cancellable: false,
    modifiable: false,
    pickupTimeChangeable: false,
    paidWithMercadoPago: false,
    creditsFromBalance: 0,
    notas: 'Pedido confirmado pasado',
  };
  const pastPendiente: OrderV2 = {
    ...cancellableOrder,
    id: 304,
    pickupAt: '2026-09-26T13:00:00-03:00',
    estado: 'PENDIENTE',
    cancellable: false,
    modifiable: false,
    pickupTimeChangeable: false,
    paidWithMercadoPago: false,
    creditsFromBalance: 0,
    notas: 'Pedido pendiente pasado',
  };
  const futureCancelado: OrderV2 = {
    ...cancellableOrder,
    id: 305,
    pickupAt: '2026-09-28T13:00:00-03:00',
    estado: 'CANCELADO',
    cancellable: false,
    modifiable: false,
    pickupTimeChangeable: false,
    paidWithMercadoPago: false,
    creditsFromBalance: 0,
    notas: 'Pedido cancelado futuro',
  };
  // Fix de revisión: un CONFIRMADO con retiro en un día FUTURO (no hoy)
  // quedaba oculto por defecto porque `isDefaultUpcoming` solo aceptaba
  // CONFIRMADO de hoy. Debe mostrarse igual que un PENDIENTE futuro.
  const futureConfirmado: OrderV2 = {
    ...cancellableOrder,
    id: 306,
    pickupAt: '2026-09-28T13:00:00-03:00',
    estado: 'CONFIRMADO',
    cancellable: false,
    modifiable: false,
    pickupTimeChangeable: false,
    paidWithMercadoPago: false,
    creditsFromBalance: 0,
    notas: 'Pedido confirmado futuro',
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a future CONFIRMADO (not just today\'s) by default', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.mocked(getOrdersV2).mockResolvedValueOnce([futureConfirmado, pastConfirmado]);

    renderPage();

    expect(await screen.findByText('Pedido confirmado futuro')).toBeInTheDocument();
    expect(screen.queryByText('Pedido confirmado pasado')).not.toBeInTheDocument();
  });

  it('shows only the future PENDIENTE and today\'s CONFIRMADO by default, hiding the rest', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.mocked(getOrdersV2).mockResolvedValueOnce([
      futurePendiente,
      todayConfirmado,
      pastConfirmado,
      pastPendiente,
      futureCancelado,
    ]);

    renderPage();

    expect(await screen.findByText('Pedido futuro programado')).toBeInTheDocument();
    expect(screen.getByText('Pedido confirmado de hoy')).toBeInTheDocument();
    expect(screen.queryByText('Pedido confirmado pasado')).not.toBeInTheDocument();
    expect(screen.queryByText('Pedido pendiente pasado')).not.toBeInTheDocument();
    expect(screen.queryByText('Pedido cancelado futuro')).not.toBeInTheDocument();
  });

  it('reveals the hidden orders when "Ver pedidos anteriores" is clicked', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.mocked(getOrdersV2).mockResolvedValueOnce([
      futurePendiente,
      todayConfirmado,
      pastConfirmado,
      pastPendiente,
      futureCancelado,
    ]);

    renderPage();
    await screen.findByText('Pedido futuro programado');

    fireEvent.click(await screen.findByRole('button', { name: /ver pedidos anteriores/i }));

    expect(await screen.findByText('Pedido confirmado pasado')).toBeInTheDocument();
    expect(screen.getByText('Pedido pendiente pasado')).toBeInTheDocument();
    expect(screen.getByText('Pedido cancelado futuro')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /ocultar pedidos anteriores/i }),
    ).toBeInTheDocument();
  });

  it('shows the "no upcoming orders" empty state, with the toggle still available, when only past orders exist', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.mocked(getOrdersV2).mockResolvedValueOnce([pastConfirmado, futureCancelado]);

    renderPage();

    expect(await screen.findByText('No tenés pedidos próximos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /hacer.*pedido/i })).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /ver pedidos anteriores/i }),
    ).toBeInTheDocument();
  });
});

describe('MyOrdersPage — "Cambiar horario" (F19)', () => {
  const NOW = new Date('2026-09-26T10:00:00-03:00');
  const CURRENT = new Date(NOW.getTime() + 3 * HOUR_MS).toISOString();
  const OTHER = new Date(NOW.getTime() + 3 * HOUR_MS + 30 * 60 * 1000).toISOString();
  const scheduled: OrderV2 = { ...cancellableOrder, id: 300, pickupAt: CURRENT, pickupTimeChangeable: true };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.mocked(getPickupSlots).mockResolvedValue([CURRENT, OTHER]);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.mocked(getWallet).mockResolvedValue({ available: 8, committed: 4, expiresAt: null });
  });

  async function pickOtherAndContinue() {
    fireEvent.click(await screen.findByRole('button', { name: /cambiar el horario de retiro del pedido/i }));
    const hour = await screen.findByLabelText('Hora de retiro');
    const target = new Date(OTHER);
    fireEvent.change(hour, { target: { value: String(target.getHours()) } });
    fireEvent.change(screen.getByLabelText('Minutos'), { target: { value: String(target.getMinutes()) } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  }

  it('offers "Cambiar horario" only on orders whose pickupTimeChangeable is true', async () => {
    vi.mocked(getOrdersV2).mockResolvedValueOnce([
      scheduled,
      { ...nonCancellableOrder, id: 301, pickupAt: CURRENT, pickupTimeChangeable: false },
      { ...cancellableOrder, id: 302, pickupAt: CURRENT, estado: 'PENDIENTE_PAGO', pickupTimeChangeable: false },
    ]);

    renderPage();

    const cards = await screen.findAllByTestId('order-card');
    expect(cards).toHaveLength(3);
    expect(within(cards[0]).getByRole('button', { name: /cambiar el horario de retiro del pedido/i })).toBeInTheDocument();
    expect(within(cards[1]).queryByRole('button', { name: /cambiar el horario de retiro del pedido/i })).not.toBeInTheDocument();
    expect(within(cards[2]).queryByRole('button', { name: /cambiar el horario de retiro del pedido/i })).not.toBeInTheDocument();
  });

  it('changes the pickup time in two steps, shows the toast and refreshes the orders', async () => {
    vi.mocked(getOrdersV2)
      .mockResolvedValueOnce([scheduled])
      .mockResolvedValueOnce([{ ...scheduled, pickupAt: OTHER }]);
    vi.mocked(changeOrderPickupTimeV2).mockResolvedValueOnce({ ...scheduled, pickupAt: OTHER });

    renderPage();
    await pickOtherAndContinue();

    fireEvent.click(await screen.findByRole('button', { name: /sí, cambiar horario/i }));

    await waitFor(() => expect(changeOrderPickupTimeV2).toHaveBeenCalledWith(300, OTHER));
    await waitFor(() => expect(getOrdersV2).toHaveBeenCalledTimes(2));
    expect(toast.success).toHaveBeenCalledWith('Horario cambiado', expect.objectContaining({ description: expect.stringContaining(formatOrderTimeLabel(OTHER)) }));
    await waitFor(() => expect(screen.queryByText('Cambiar horario de retiro')).not.toBeInTheDocument());
    expect(await screen.findByText(new RegExp(`Retiro ${formatOrderTimeLabel(OTHER)} hs`))).toBeInTheDocument();
  });

  it('shows the backend message and keeps the sheet open when the change is rejected', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([scheduled]);
    vi.mocked(changeOrderPickupTimeV2).mockRejectedValueOnce(
      new PickupTimeChangeError('El horario de retiro ya no se puede cambiar.'),
    );

    renderPage();
    await pickOtherAndContinue();
    fireEvent.click(await screen.findByRole('button', { name: /sí, cambiar horario/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El horario de retiro ya no se puede cambiar.');
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe('MyOrdersPage — comanda del pedido (F20)', () => {
  const NOW = new Date('2026-09-26T10:00:00-03:00');
  const CURRENT = new Date(NOW.getTime() + 3 * HOUR_MS).toISOString();
  const OTHER = new Date(NOW.getTime() + 3 * HOUR_MS + 30 * 60 * 1000).toISOString();
  const scheduled: OrderV2 = { ...cancellableOrder, id: 300, fecha: '2026-09-26', pickupAt: CURRENT };
  const awaiting: OrderV2 = {
    ...scheduled,
    id: 301,
    estado: 'PENDIENTE_PAGO',
    paidWithMercadoPago: true,
    creditsFromBalance: 0,
    modifiable: false,
    pickupTimeChangeable: false,
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.mocked(getPickupSlots).mockResolvedValue([CURRENT, OTHER]);
    useAuthStore.setState({
      accessToken: 'token',
      user: {
        id: 7,
        email: 'sofi@example.com',
        firstName: 'Sofía',
        lastName: null,
        nickname: 'Sofi',
        displayName: 'Sofi',
        role: 'EMPLOYEE',
        companyId: null,
        companyName: null,
        categoryId: null,
        emailVerified: true,
        profileComplete: true,
      },
      bootstrapping: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: true });
    vi.mocked(getWallet).mockResolvedValue({ available: 8, committed: 4, expiresAt: null });
  });

  async function openComanda(name = /ver la comanda del pedido/i) {
    fireEvent.click(await screen.findByRole('button', { name }));
    return screen.findByRole('dialog', { name: /pedido programado|falta confirmar el pago|ya lo estamos preparando|pedido cancelado/i });
  }

  it('opens a full-screen comanda with the name they call, and closes it with "‹ Mis pedidos"', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([scheduled]);
    renderPage();

    const dialog = await openComanda();

    expect(within(dialog).getByText('Comanda Nº 0300')).toBeInTheDocument();
    expect(within(dialog).getByText('Sofi')).toBeInTheDocument();
    expect(within(dialog).getByText('Programado')).toBeInTheDocument();
    expect(within(dialog).getByText('Milanesa')).toBeInTheDocument();
    expect(await within(dialog).findByText('Te quedan 8 almuerzos')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /mis pedidos/i }));

    expect(screen.queryByRole('dialog', { name: /pedido programado/i })).not.toBeInTheDocument();
  });

  it('falls back to the nickname when the backend does not send displayName', async () => {
    const user = useAuthStore.getState().user!;
    useAuthStore.setState({ user: { ...user, displayName: undefined as unknown as string } });
    vi.mocked(getOrdersV2).mockResolvedValue([scheduled]);
    renderPage();

    const dialog = await openComanda();

    expect(within(dialog).getByText('Sofi')).toBeInTheDocument();
  });

  it('does not open the comanda from the buttons on the card', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([scheduled]);
    renderPage();

    const card = await screen.findByTestId('order-card');
    fireEvent.click(within(card).getByRole('button', { name: /^cancelar pedido$/i }));

    expect(await screen.findByText('¿Cancelar este pedido?')).toBeInTheDocument();
    expect(screen.queryByText('Comanda Nº 0300')).not.toBeInTheDocument();
  });

  it('Programado: "Agregar platos" goes to the order page with the day and the pickup time', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([scheduled]);
    renderPage();

    const dialog = await openComanda();

    expect(within(dialog).getByRole('link', { name: /agregar platos/i })).toHaveAttribute(
      'href',
      `/orders/today?fecha=2026-09-26&hora=${encodeURIComponent(CURRENT)}`,
    );
  });

  it('Programado: changing the time from the comanda updates it in place', async () => {
    vi.mocked(getOrdersV2)
      .mockResolvedValueOnce([scheduled])
      .mockResolvedValue([{ ...scheduled, pickupAt: OTHER }]);
    vi.mocked(changeOrderPickupTimeV2).mockResolvedValueOnce({ ...scheduled, pickupAt: OTHER });
    renderPage();

    const dialog = await openComanda();
    fireEvent.click(within(dialog).getByRole('button', { name: /^cambiar horario$/i }));
    const target = new Date(OTHER);
    fireEvent.change(await screen.findByLabelText('Hora de retiro'), { target: { value: String(target.getHours()) } });
    fireEvent.change(screen.getByLabelText('Minutos'), { target: { value: String(target.getMinutes()) } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.click(await screen.findByRole('button', { name: /sí, cambiar horario/i }));

    await waitFor(() => expect(changeOrderPickupTimeV2).toHaveBeenCalledWith(300, OTHER));
    const updated = await screen.findByRole('dialog', { name: /pedido programado/i });
    expect(await within(updated).findByText(new RegExp(`· ${formatOrderTimeLabel(OTHER)} hs`))).toBeInTheDocument();
  });

  it('Programado: cancelling from the comanda leaves it open, cancelled and read-only', async () => {
    vi.mocked(getOrdersV2)
      .mockResolvedValueOnce([scheduled])
      .mockResolvedValue([{ ...scheduled, estado: 'CANCELADO', cancellable: false, modifiable: false, pickupTimeChangeable: false }]);
    vi.mocked(cancelOrderV2).mockResolvedValueOnce(undefined);
    renderPage();

    const dialog = await openComanda();
    fireEvent.click(within(dialog).getByRole('button', { name: /^cancelar pedido$/i }));
    expect(await screen.findByText('Tus 4 almuerzos vuelven a tu saldo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /sí, cancelar pedido/i }));

    await waitFor(() => expect(cancelOrderV2).toHaveBeenCalledWith(300));
    const cancelled = await screen.findByRole('dialog', { name: 'Pedido cancelado' });
    expect(within(cancelled).getByText('Cancelado')).toBeInTheDocument();
    expect(within(cancelled).queryByRole('button', { name: /cancelar pedido|cambiar horario/i })).not.toBeInTheDocument();
  });

  it('Pago pendiente: shows the Mercado Pago comanda without change actions and pays now from it', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([awaiting]);
    vi.mocked(resumeDirectCheckoutV2).mockResolvedValue({ orderId: 301, purchaseId: 'p', initPoint: 'https://mp.test/pay' });
    renderPage();

    const dialog = await openComanda();
    expect(within(dialog).getByText('A pagar con Mercado Pago')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /cambiar horario/i })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /pagar ahora/i }));
    await waitFor(() => expect(resumeDirectCheckoutV2).toHaveBeenCalledWith(301));
  });

  it('Pago pendiente: the cancel sheet opened from the comanda says "Tu saldo no cambia"', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([awaiting]);
    renderPage();

    const dialog = await openComanda();
    fireEvent.click(within(dialog).getByRole('button', { name: /^cancelar pedido$/i }));

    expect(await screen.findByText('Tu saldo no cambia')).toBeInTheDocument();
    expect(screen.queryByText(/vuelve/i)).not.toBeInTheDocument();
  });

  it('Confirmado: read-only, no actions', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([
      { ...scheduled, estado: 'CONFIRMADO', cancellable: false, modifiable: false, pickupTimeChangeable: false },
    ]);
    renderPage();

    const dialog = await openComanda();

    expect(within(dialog).getByText('Confirmado')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /cancelar pedido|cambiar horario|pagar ahora/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('link', { name: /agregar platos/i })).not.toBeInTheDocument();
  });
});

describe('MyOrdersPage — deep link ?pedido= (D6)', () => {
  const linked: OrderV2 = { ...cancellableOrder, id: 300 };
  const other: OrderV2 = { ...cancellableOrder, id: 301 };

  afterEach(() => vi.clearAllMocks());

  function renderAt(entry: string) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[entry]}>
          <MyOrdersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('opens the comanda of the order in the query string once the orders load', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([other, linked]);
    renderAt('/orders/mine?pedido=300');

    const dialog = await screen.findByRole('dialog', { name: /pedido programado/i });
    expect(within(dialog).getByText('Comanda Nº 0300')).toBeInTheDocument();
  });

  it('closes normally and does not reopen by itself', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([linked]);
    renderAt('/orders/mine?pedido=300');

    const dialog = await screen.findByRole('dialog', { name: /pedido programado/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /mis pedidos/i }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /pedido programado/i })).not.toBeInTheDocument());
  });

  it.each(['999', 'abc', ''])('ignores an unknown pedido (%j) and shows the list', async (value) => {
    vi.mocked(getOrdersV2).mockResolvedValue([linked]);
    renderAt(`/orders/mine?pedido=${value}`);

    expect(await screen.findByRole('button', { name: /ver la comanda del pedido/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
