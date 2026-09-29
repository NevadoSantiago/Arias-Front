import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PickupTimePicker } from './PickupTimePicker';
import { getPickupSlots } from '../../services/ordersApi';

vi.mock('../../services/ordersApi', () => ({
  getPickupSlots: vi.fn(),
}));

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Hora local "HH:MM" del instante ISO, tal como la calcula el componente
 * (`Date.getHours/getMinutes`) — nunca por el texto formateado, que depende
 * del timezone del entorno donde corre la suite. */
function localHM(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const SLOT_A1 = '2026-05-21T14:00:00Z';
const SLOT_A2 = '2026-05-21T14:10:00Z';
const SLOT_B1 = '2026-05-21T17:30:00Z';

function renderPicker(props: Partial<Parameters<typeof PickupTimePicker>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSelect = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <PickupTimePicker
        fecha="2026-05-21"
        isToday={true}
        dayShortLabel="jueves 21"
        lastUsedTimeOfDay={null}
        onSelect={onSelect}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onSelect };
}

describe('PickupTimePicker', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Lo antes posible · HH:MM" (first slot) with a bolt icon when there is no matching last-used time', async () => {
    vi.mocked(getPickupSlots).mockResolvedValueOnce([SLOT_A1, SLOT_A2, SLOT_B1]);

    renderPicker({ lastUsedTimeOfDay: null });

    const radio = await screen.findByRole('radio', { name: new RegExp(`lo antes posible.*${localHM(SLOT_A1)}`, 'i') });
    expect(radio).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('radio', { name: /última utilizada/i })).not.toBeInTheDocument();
  });

  it('falls back to ASAP when the last-used time of day does not match any slot for this day', async () => {
    vi.mocked(getPickupSlots).mockResolvedValueOnce([SLOT_A1, SLOT_A2, SLOT_B1]);

    renderPicker({ lastUsedTimeOfDay: '23:59' });

    expect(
      await screen.findByRole('radio', { name: new RegExp(`lo antes posible.*${localHM(SLOT_A1)}`, 'i') }),
    ).toBeInTheDocument();
  });

  it('shows "Última utilizada · HH:MM" with a history icon when the last-used time matches an available slot', async () => {
    vi.mocked(getPickupSlots).mockResolvedValueOnce([SLOT_A1, SLOT_A2, SLOT_B1]);

    renderPicker({ lastUsedTimeOfDay: localHM(SLOT_B1) });

    expect(
      await screen.findByRole('radio', { name: new RegExp(`última utilizada.*${localHM(SLOT_B1)}`, 'i') }),
    ).toBeInTheDocument();
  });

  it('shows the readout for today, appending "la última utilizada" only for the last-used option', async () => {
    vi.mocked(getPickupSlots).mockResolvedValueOnce([SLOT_A1]);

    renderPicker({ isToday: true, lastUsedTimeOfDay: localHM(SLOT_A1) });

    expect(
      await screen.findByText(`Retirás hoy a las ${localHM(SLOT_A1)}, la última utilizada`),
    ).toBeInTheDocument();
  });

  it('shows the readout for a future day without the "usual time" suffix on the ASAP option', async () => {
    vi.mocked(getPickupSlots).mockResolvedValueOnce([SLOT_A1]);

    renderPicker({ isToday: false, dayShortLabel: 'lunes 28', lastUsedTimeOfDay: null });

    expect(
      await screen.findByText(`Retirás el lunes 28 a las ${localHM(SLOT_A1)}`),
    ).toBeInTheDocument();
  });

  it('calls onSelect with the default option\'s exact backend-provided instant', async () => {
    vi.mocked(getPickupSlots).mockResolvedValueOnce([SLOT_A1, SLOT_A2]);

    const { onSelect } = renderPicker({ lastUsedTimeOfDay: null });

    await screen.findByRole('radio', { name: /lo antes posible/i });
    expect(onSelect).toHaveBeenCalledWith(SLOT_A1);
  });

  it('lets the customer pick an hour/minute, filters minutes by hour and deselects the first option', async () => {
    vi.mocked(getPickupSlots).mockResolvedValueOnce([SLOT_A1, SLOT_A2, SLOT_B1]);

    const { onSelect } = renderPicker({ lastUsedTimeOfDay: null });

    await screen.findByRole('radio', { name: /lo antes posible/i });

    const hourSelect = screen.getByLabelText(/hora de retiro/i) as HTMLSelectElement;
    const minuteSelect = screen.getByLabelText(/^minutos$/i) as HTMLSelectElement;

    // Only the hours actually present in the slots are offered.
    const hourValues = Array.from(hourSelect.options).map((o) => o.value);
    expect(hourValues).toEqual([
      String(new Date(SLOT_A1).getHours()),
      String(new Date(SLOT_B1).getHours()),
    ]);

    fireEvent.change(hourSelect, { target: { value: String(new Date(SLOT_B1).getHours()) } });

    // Minute for hour B only offers B1's minute — the A-hour minutes are not valid here.
    const minuteValuesAfterHourChange = Array.from(minuteSelect.options).map((o) => o.value);
    expect(minuteValuesAfterHourChange).toEqual([String(new Date(SLOT_B1).getMinutes())]);

    const firstOptionRadio = screen.getByRole('radio', { name: /lo antes posible/i });
    const customRadio = screen.getByRole('radio', { name: /elegir horario/i });
    expect(firstOptionRadio).toHaveAttribute('aria-checked', 'false');
    expect(customRadio).toHaveAttribute('aria-checked', 'true');
    expect(onSelect).toHaveBeenLastCalledWith(SLOT_B1);
  });

  it('snaps the minute to the hour\'s first available minute when the hour change invalidates it', async () => {
    vi.mocked(getPickupSlots).mockResolvedValueOnce([SLOT_A1, SLOT_A2, SLOT_B1]);

    const { onSelect } = renderPicker({ lastUsedTimeOfDay: null });
    await screen.findByRole('radio', { name: /lo antes posible/i });

    const hourSelect = screen.getByLabelText(/hora de retiro/i) as HTMLSelectElement;
    fireEvent.change(hourSelect, { target: { value: String(new Date(SLOT_B1).getHours()) } });

    const minuteSelect = screen.getByLabelText(/^minutos$/i) as HTMLSelectElement;
    expect(minuteSelect.value).toBe(String(new Date(SLOT_B1).getMinutes()));
    expect(onSelect).toHaveBeenLastCalledWith(SLOT_B1);
  });

  it('lets the customer pick a specific minute within the same hour', async () => {
    vi.mocked(getPickupSlots).mockResolvedValueOnce([SLOT_A1, SLOT_A2]);

    const { onSelect } = renderPicker({ lastUsedTimeOfDay: null });
    await screen.findByRole('radio', { name: /lo antes posible/i });

    const minuteSelect = screen.getByLabelText(/^minutos$/i) as HTMLSelectElement;
    fireEvent.change(minuteSelect, { target: { value: String(new Date(SLOT_A2).getMinutes()) } });

    expect(onSelect).toHaveBeenLastCalledWith(SLOT_A2);
  });

  it('shows a clear message and offers nothing to select when there are no pickup slots for the day', async () => {
    vi.mocked(getPickupSlots).mockResolvedValueOnce([]);

    renderPicker();

    expect(
      await screen.findByText(/no quedan horarios de retiro para este día\. elegí otro día\./i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('shows an error message with a retry button when the slots fail to load, never the empty state, and keeps onSelect uncalled', async () => {
    vi.mocked(getPickupSlots).mockRejectedValueOnce(new Error('network down'));

    const { onSelect } = renderPicker();

    const retryButton = await screen.findByRole('button', { name: /reintentar/i });
    expect(screen.getByText(/no pudimos cargar los horarios de retiro/i)).toBeInTheDocument();
    expect(screen.queryByText(/no quedan horarios de retiro/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();

    vi.mocked(getPickupSlots).mockResolvedValueOnce([SLOT_A1]);
    fireEvent.click(retryButton);

    await screen.findByRole('radio', { name: /lo antes posible/i });
    expect(onSelect).toHaveBeenCalledWith(SLOT_A1);
  });

  it('re-syncs the custom hour/minute selects and the radio when the chosen slot disappears after a refetch', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(getPickupSlots).mockResolvedValueOnce([SLOT_A1, SLOT_A2, SLOT_B1]);
    const onSelect = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <PickupTimePicker
          fecha="2026-05-21"
          isToday={true}
          dayShortLabel="jueves 21"
          lastUsedTimeOfDay={null}
          onSelect={onSelect}
        />
      </QueryClientProvider>,
    );

    await screen.findByRole('radio', { name: /lo antes posible/i });

    const hourSelect = screen.getByLabelText(/hora de retiro/i) as HTMLSelectElement;
    fireEvent.change(hourSelect, { target: { value: String(new Date(SLOT_B1).getHours()) } });
    expect(onSelect).toHaveBeenLastCalledWith(SLOT_B1);
    expect(screen.getByRole('radio', { name: /elegir horario/i })).toHaveAttribute('aria-checked', 'true');

    // The slots refetch and the chosen custom slot (B1) is no longer offered.
    vi.mocked(getPickupSlots).mockResolvedValueOnce([SLOT_A1, SLOT_A2]);
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ['pickupSlots'] });
    });

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /lo antes posible/i })).toHaveAttribute('aria-checked', 'true');
    });
    expect(screen.getByRole('radio', { name: /elegir horario/i })).toHaveAttribute('aria-checked', 'false');
    // The readout/select never shows a time different from what was last sent to onSelect.
    expect(onSelect).toHaveBeenLastCalledWith(SLOT_A1);
    const minuteSelect = screen.getByLabelText(/^minutos$/i) as HTMLSelectElement;
    expect(hourSelect.value).toBe(String(new Date(SLOT_A1).getHours()));
    expect(minuteSelect.value).toBe(String(new Date(SLOT_A1).getMinutes()));
  });

  // F21.1: si el horario del atajo ya no está entre los slots cargados, el
  // selector avisa en vez de ignorar el pedido en silencio.
  it('tells the customer when the jump target time is not among the loaded slots', async () => {
    vi.mocked(getPickupSlots).mockResolvedValueOnce([SLOT_A1, SLOT_A2]);

    renderPicker({ jumpTo: { pickupAt: SLOT_B1 } });

    expect(await screen.findByText(/ese horario ya no está disponible/i)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /lo antes posible/i })).toHaveAttribute('aria-checked', 'true');
  });

  // F19: variante solo-selectores ("Cambiar horario" de Mis pedidos): sin las
  // opciones automáticas ni el texto de retiro; el resto no cambia.
  it('selectOnly hides the radios and the readout but keeps hour/minute selects reporting the chosen slot', async () => {
    vi.mocked(getPickupSlots).mockResolvedValueOnce([SLOT_A1, SLOT_A2, SLOT_B1]);

    const { onSelect } = renderPicker({ selectOnly: true, jumpTo: { pickupAt: SLOT_A2 } });

    const hourSelect = (await screen.findByLabelText(/hora de retiro/i)) as HTMLSelectElement;
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(hourSelect.value).toBe(String(new Date(SLOT_A2).getHours()));
    expect((screen.getByLabelText(/^minutos$/i) as HTMLSelectElement).value).toBe(String(new Date(SLOT_A2).getMinutes()));
    await waitFor(() => expect(onSelect).toHaveBeenLastCalledWith(SLOT_A2));

    fireEvent.change(hourSelect, { target: { value: String(new Date(SLOT_B1).getHours()) } });
    fireEvent.change(screen.getByLabelText(/^minutos$/i), { target: { value: String(new Date(SLOT_B1).getMinutes()) } });
    expect(onSelect).toHaveBeenLastCalledWith(SLOT_B1);
  });
});
