import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminConfigPage } from './AdminConfigPage';
import { getDisabledDates } from '@/features/orders/services/ordersApi';
import {
  getRestaurantConfigAdmin,
  updatePickupSchedule,
  updateRestaurantConfig,
  type RestaurantConfig,
} from '@/features/admin/services/adminApi';

vi.mock('@/features/orders/services/ordersApi', () => ({
  getDisabledDates: vi.fn(),
}));

vi.mock('@/features/admin/services/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/admin/services/adminApi')>(
    '@/features/admin/services/adminApi',
  );
  return {
    ...actual,
    getRestaurantConfigAdmin: vi.fn(),
    updateRestaurantConfig: vi.fn(),
    updatePickupSchedule: vi.fn(),
  };
});

const baseConfig: RestaurantConfig = {
  horaCorte: '10:00',
  timezone: 'America/Argentina/Buenos_Aires',
  pickupLeadMinutes: 20,
  creditExpiryDays: 90,
  pickupWindowStart: '11:00',
  pickupWindowEnd: '23:00',
  pickupSlotMinutes: 10,
  dailySummaryTime: '08:00',
  pickupReminderMinutes: 25,
  pickupSchedule: [
    { dayOfWeek: 1, open: true, windowStart: '11:00', windowEnd: '23:00' },
    { dayOfWeek: 2, open: true, windowStart: '11:00', windowEnd: '23:00' },
    { dayOfWeek: 3, open: true, windowStart: '11:00', windowEnd: '23:00' },
    { dayOfWeek: 4, open: true, windowStart: '11:00', windowEnd: '23:00' },
    { dayOfWeek: 5, open: true, windowStart: '11:00', windowEnd: '23:00' },
    { dayOfWeek: 6, open: true, windowStart: '11:00', windowEnd: '16:00' },
    { dayOfWeek: 7, open: false, windowStart: null, windowEnd: null },
  ],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminConfigPage />
    </QueryClientProvider>,
  );
}

function scheduleRegion() {
  return screen.findByRole('region', { name: /horarios de retiro/i });
}

describe('AdminConfigPage — pickup schedule editor (B5/F14)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the seven weekdays from pickupSchedule, Monday through Sunday', async () => {
    vi.mocked(getRestaurantConfigAdmin).mockResolvedValue(baseConfig);
    vi.mocked(getDisabledDates).mockResolvedValue([]);

    renderPage();

    const region = within(await screen.findByRole('region', { name: /horarios de retiro/i }));
    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    for (const name of dayNames) {
      expect(region.getByText(name)).toBeInTheDocument();
    }
    expect(region.getAllByRole('switch')).toHaveLength(7);
  });

  it('widens the page container beyond the old max-w-2xl', async () => {
    vi.mocked(getRestaurantConfigAdmin).mockResolvedValue(baseConfig);
    vi.mocked(getDisabledDates).mockResolvedValue([]);

    const { container } = renderPage();
    await screen.findByRole('region', { name: /horarios de retiro/i });

    const root = container.querySelector('.p-6');
    expect(root?.className).not.toMatch(/max-w-2xl/);
    expect(root?.className).toMatch(/max-w-4xl/);
  });

  it('disables the time inputs for a day when it is toggled closed, keeping its values', async () => {
    vi.mocked(getRestaurantConfigAdmin).mockResolvedValue(baseConfig);
    vi.mocked(getDisabledDates).mockResolvedValue([]);

    renderPage();
    const region = within(await scheduleRegion());

    const mondaySwitch = region.getAllByRole('switch')[0];
    expect(mondaySwitch).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(mondaySwitch);
    expect(mondaySwitch).toHaveAttribute('aria-checked', 'false');

    const fromInput = region.getByLabelText(/lunes, desde/i) as HTMLInputElement;
    const toInput = region.getByLabelText(/lunes, hasta/i) as HTMLInputElement;
    expect(fromInput).toBeDisabled();
    expect(toInput).toBeDisabled();
    expect(fromInput.value).toBe('11:00');
    expect(toInput.value).toBe('23:00');
  });

  it('shows an invalid-range error and disables Guardar when "hasta" is not after "desde"', async () => {
    vi.mocked(getRestaurantConfigAdmin).mockResolvedValue(baseConfig);
    vi.mocked(getDisabledDates).mockResolvedValue([]);

    renderPage();
    const region = within(await scheduleRegion());

    const mondayTo = region.getByLabelText(/lunes, hasta/i);
    fireEvent.change(mondayTo, { target: { value: '09:00' } });

    expect(await region.findByText(/hasta.*tiene que ser después de.*desde/i)).toBeInTheDocument();
    expect(mondayTo).toHaveAttribute('aria-invalid', 'true');
    expect(region.getByRole('button', { name: /guardar cambios/i })).toBeDisabled();
  });

  it('disables "Copiar a días hábiles" while Monday is invalid, and copies Monday to Tuesday–Friday otherwise', async () => {
    vi.mocked(getRestaurantConfigAdmin).mockResolvedValue(baseConfig);
    vi.mocked(getDisabledDates).mockResolvedValue([]);

    renderPage();
    const region = within(await scheduleRegion());

    const mondayTo = region.getByLabelText(/lunes, hasta/i);
    fireEvent.change(mondayTo, { target: { value: '09:00' } });
    expect(region.getByRole('button', { name: /copiar a días hábiles/i })).toBeDisabled();

    fireEvent.change(mondayTo, { target: { value: '20:00' } });
    const mondayFrom = region.getByLabelText(/lunes, desde/i);
    fireEvent.change(mondayFrom, { target: { value: '09:00' } });

    const copyButton = region.getByRole('button', { name: /copiar a días hábiles/i });
    expect(copyButton).not.toBeDisabled();
    fireEvent.click(copyButton);

    for (const day of ['martes', 'miércoles', 'jueves', 'viernes']) {
      expect((region.getByLabelText(new RegExp(`${day}, desde`, 'i')) as HTMLInputElement).value).toBe('09:00');
      expect((region.getByLabelText(new RegExp(`${day}, hasta`, 'i')) as HTMLInputElement).value).toBe('20:00');
    }
    // Saturday/Sunday untouched
    expect((region.getByLabelText(/sábado, desde/i) as HTMLInputElement).value).toBe('11:00');
  });

  it('sends exactly 7 entries with "HH:mm" times, null for the closed day, on Guardar', async () => {
    vi.mocked(getRestaurantConfigAdmin).mockResolvedValue(baseConfig);
    vi.mocked(getDisabledDates).mockResolvedValue([]);
    vi.mocked(updatePickupSchedule).mockResolvedValueOnce(baseConfig.pickupSchedule!);

    renderPage();
    const region = within(await scheduleRegion());

    const mondayFrom = region.getByLabelText(/lunes, desde/i) as HTMLInputElement;
    fireEvent.change(mondayFrom, { target: { value: '09:00' } });

    fireEvent.click(region.getByRole('button', { name: /guardar cambios/i }));

    expect(await region.findByText('Guardado')).toBeInTheDocument();
    expect(updatePickupSchedule).toHaveBeenCalledTimes(1);
    const sent = vi.mocked(updatePickupSchedule).mock.calls[0][0];
    expect(sent).toHaveLength(7);
    expect(sent.every((d) => /^\d{2}:\d{2}$/.test(d.windowStart ?? '') || d.windowStart === null)).toBe(true);
    expect(sent.find((d) => d.dayOfWeek === 1)).toEqual({
      dayOfWeek: 1,
      open: true,
      windowStart: '09:00',
      windowEnd: '23:00',
    });
    expect(sent.find((d) => d.dayOfWeek === 7)).toEqual({
      dayOfWeek: 7,
      open: false,
      windowStart: null,
      windowEnd: null,
    });
  });

  it('shows an error state when saving the schedule is rejected by the backend', async () => {
    vi.mocked(getRestaurantConfigAdmin).mockResolvedValue(baseConfig);
    vi.mocked(getDisabledDates).mockResolvedValue([]);
    vi.mocked(updatePickupSchedule).mockRejectedValueOnce(new Error('network error'));

    renderPage();
    const region = within(await scheduleRegion());

    const mondayFrom = region.getByLabelText(/lunes, desde/i);
    fireEvent.change(mondayFrom, { target: { value: '09:00' } });
    fireEvent.click(region.getByRole('button', { name: /guardar cambios/i }));

    expect(await region.findByText(/error al guardar/i)).toBeInTheDocument();
  });

  it('still saves the existing config form fields, sending pickupWindowStart/End unchanged', async () => {
    vi.mocked(getRestaurantConfigAdmin).mockResolvedValue(baseConfig);
    vi.mocked(getDisabledDates).mockResolvedValue([]);
    vi.mocked(updateRestaurantConfig).mockResolvedValueOnce({ ...baseConfig, pickupLeadMinutes: 30 });

    renderPage();
    await screen.findByRole('region', { name: /horarios de retiro/i });

    const leadInput = screen.getByLabelText(/tiempo de preparación/i);
    fireEvent.change(leadInput, { target: { value: '30' } });

    const mainForm = leadInput.closest('form')!;
    fireEvent.submit(mainForm);

    expect(await within(mainForm).findByText('Guardado')).toBeInTheDocument();
    expect(updateRestaurantConfig).toHaveBeenCalledWith({
      horaCorte: '10:00',
      pickupLeadMinutes: 30,
      creditExpiryDays: 90,
      pickupWindowStart: '11:00',
      pickupWindowEnd: '23:00',
      pickupSlotMinutes: 10,
      dailySummaryTime: '08:00',
      pickupReminderMinutes: 25,
    });
  });

  it('no longer shows editable global pickup window inputs in the main form', async () => {
    vi.mocked(getRestaurantConfigAdmin).mockResolvedValue(baseConfig);
    vi.mocked(getDisabledDates).mockResolvedValue([]);

    renderPage();
    await screen.findByRole('region', { name: /horarios de retiro/i });

    expect(screen.queryByLabelText(/apertura de la ventana de retiro/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/cierre de la ventana de retiro/i)).not.toBeInTheDocument();
  });
});
