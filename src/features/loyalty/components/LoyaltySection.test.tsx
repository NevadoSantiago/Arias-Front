import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { LoyaltySection } from './LoyaltySection';
import { getLoyalty } from '../services/loyaltyApi';
import { getWallet } from '@/features/credits/services/creditsApi';
import { celebrationKey } from '../loyaltyStorage';
import { formatDayMonth } from '../timelineModel';
import { mockMatchMedia } from '@/test/matchMedia';
import type { Loyalty, LoyaltyMilestone } from '../types';

vi.mock('../services/loyaltyApi', () => ({ getLoyalty: vi.fn(), getAvailableDesserts: vi.fn() }));
vi.mock('@/features/credits/services/creditsApi', () => ({ getWallet: vi.fn() }));

const DAY = 86_400_000;
const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString();

function milestones(over: Partial<Record<number, Partial<LoyaltyMilestone>>> = {}): LoyaltyMilestone[] {
  return [
    { lunches: 6, kind: 'DESSERT', status: 'LOCKED', expiresAt: null, ...over[6] },
    { lunches: 18, kind: 'LUNCH', status: 'LOCKED', expiresAt: null, ...over[18] },
    { lunches: 24, kind: 'DISCOUNT', percent: 10, status: 'LOCKED', expiresAt: null, ...over[24] },
  ];
}

const startedAt = inDays(-17);
const endsAt = inDays(43);

function active(lunches: number, ms = milestones(), extra: Record<string, unknown> = {}): Loyalty {
  return {
    enabled: true, cycle: { startedAt, endsAt, lunches }, waiting: false, milestones: ms, pendingDessert: null,
    ...extra,
  } as Loyalty;
}

function Where() {
  const l = useLocation();
  return <span data-testid="where">{l.pathname + l.search}</span>;
}

function renderSection(onUseDessert = vi.fn(), userId = 5) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = () => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LoyaltySection userId={userId} onUseDessert={onUseDessert} />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>
  );
  const view = render(ui());
  return { ...view, onUseDessert, remount: () => { view.unmount(); return render(ui()); } };
}

const node = (n: number) => screen.getByTestId(`loyalty-node-${n}`);
const region = () => screen.findByRole('region', { name: /línea de beneficios/i });

let media: ReturnType<typeof mockMatchMedia>;

beforeEach(() => {
  window.localStorage.clear();
  media = mockMatchMedia(true); // reduced motion: values land immediately
  vi.mocked(getWallet).mockResolvedValue({ available: 3, committed: 0, expiresAt: null });
});
afterEach(() => {
  media.restore();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Controla requestAnimationFrame y performance.now para empujar la animación a mano. */
function stubFrames() {
  let now = 0;
  const queue: FrameRequestCallback[] = [];
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { queue.push(cb); return queue.length; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  return (ms: number) => act(() => {
    now += ms;
    queue.splice(0).forEach((cb) => cb(now));
  });
}

describe('LoyaltySection visibility', () => {
  it('renders nothing when the feature is off for the user', async () => {
    vi.mocked(getLoyalty).mockResolvedValue({ enabled: false });
    const { container } = renderSection();
    await act(async () => {});
    expect(screen.queryByRole('region', { name: /línea de beneficios/i })).not.toBeInTheDocument();
    expect(container.querySelector('section')).toBeNull();
  });

  it('renders nothing (and does not throw) when the request fails', async () => {
    vi.mocked(getLoyalty).mockRejectedValue(new Error('boom'));
    renderSection();
    await act(async () => {});
    expect(screen.queryByRole('region', { name: /línea de beneficios/i })).not.toBeInTheDocument();
  });
});

describe('timeline', () => {
  it('shows the personal dates at the ends and the lunches count', async () => {
    vi.mocked(getLoyalty).mockResolvedValue(active(7));
    renderSection();
    const r = await region();
    expect(within(r).getByText(formatDayMonth(startedAt))).toBeInTheDocument();
    expect(within(r).getByText(formatDayMonth(endsAt))).toBeInTheDocument();
    expect(screen.getByTestId('loyalty-count')).toHaveTextContent('7');
  });

  it('places the markers at fixed non-proportional positions and labels them with their lunches', async () => {
    vi.mocked(getLoyalty).mockResolvedValue(active(7));
    renderSection();
    await region();
    expect(node(6).style.left).toBe('30%');
    expect(node(6).querySelector('svg.lucide-dessert')).not.toBeNull();
    expect(node(6).querySelector('svg.lucide-cake')).toBeNull();
    expect(node(18).style.left).toBe('66%');
    expect(node(24).style.left).toBe('92%');
    expect(screen.getByTestId('loyalty-label-18')).toHaveTextContent('18');
  });

  it('renders the ready, done and expired marker states', async () => {
    window.localStorage.setItem(celebrationKey(5, `DESSERT:6:${startedAt}`), '1');
    window.localStorage.setItem(celebrationKey(5, `LUNCH:18:${startedAt}`), '1');
    vi.mocked(getLoyalty).mockResolvedValue(
      active(25, milestones({
        6: { status: 'EARNED', expiresAt: inDays(3) },
        18: { status: 'USED' },
        24: { status: 'EXPIRED', expiresAt: inDays(-1) },
      })),
    );
    renderSection();
    await region();
    expect(node(6)).toHaveAttribute('data-status', 'ready');
    expect(screen.getByRole('button', { name: 'Postre de regalo listo para usar. Usarlo' })).toBeInTheDocument();
    expect(node(18)).toHaveAttribute('data-status', 'done');
    expect(node(24)).toHaveAttribute('data-status', 'expired');
  });

  it('renders markers still to reach as locked', async () => {
    vi.mocked(getLoyalty).mockResolvedValue(active(3));
    renderSection();
    await region();
    expect(node(6)).toHaveAttribute('data-status', 'locked');
    expect(node(24)).toHaveAttribute('data-status', 'locked');
  });

  it('describes the whole line for assistive tech on the button that opens the rules', async () => {
    window.localStorage.setItem(celebrationKey(5, `DESSERT:6:${startedAt}`), '1');
    vi.mocked(getLoyalty).mockResolvedValue(active(7, milestones({ 6: { status: 'EARNED', expiresAt: inDays(3) } })));
    renderSection();
    const line = await screen.findByRole('button', { name: /7 almuerzos retirados/i });
    expect(line).toHaveAccessibleName(
      `Tu ciclo del ${formatDayMonth(startedAt)} al ${formatDayMonth(endsAt)}: 7 almuerzos retirados. `
      + 'Postre de regalo a los 6: listo para usar. Almuerzo de regalo a los 18: bloqueado. '
      + '10% off a los 24: bloqueado. Ver cómo funciona',
    );
  });
});

describe('fill animation', () => {
  it('fills from zero to the current point on every mount, lighting markers as it reaches them', async () => {
    media.set(false);
    const advance = stubFrames();
    vi.mocked(getLoyalty).mockResolvedValue(active(7, milestones({ 6: { status: 'EARNED', expiresAt: inDays(3) } })));
    renderSection();
    await region();
    expect(screen.getByTestId('loyalty-count')).toHaveTextContent('0');
    expect(screen.getByTestId('loyalty-fill').style.width).toBe('0%');
    expect(node(6)).toHaveAttribute('data-status', 'locked');

    advance(2000);
    expect(screen.getByTestId('loyalty-count')).toHaveTextContent('7');
    expect(node(6)).toHaveAttribute('data-status', 'ready');
    expect(parseFloat(screen.getByTestId('loyalty-fill').style.width)).toBeCloseTo(33, 1);
  });

  it('skips the animation with prefers-reduced-motion', async () => {
    vi.mocked(getLoyalty).mockResolvedValue(active(7));
    renderSection();
    await region();
    expect(screen.getByTestId('loyalty-count')).toHaveTextContent('7');
    expect(parseFloat(screen.getByTestId('loyalty-fill').style.width)).toBeCloseTo(33, 1);
  });
});

describe('reward chips', () => {
  it('shows the pending dessert with its expiry and uses it on tap', async () => {
    vi.mocked(getLoyalty).mockResolvedValue(
      active(7, milestones({ 6: { status: 'EARNED', expiresAt: inDays(5) } }), {
        pendingDessert: { rewardId: 9, expiresAt: inDays(5) },
      }),
    );
    window.localStorage.setItem(celebrationKey(5, `DESSERT:6:${startedAt}`), '1');
    const { onUseDessert } = renderSection();
    const chip = await screen.findByRole('button', { name: /postre de regalo · vence en 5 días · usar/i });
    fireEvent.click(chip);
    expect(onUseDessert).toHaveBeenCalledTimes(1);
  });

  it('flags a reward that expires today or tomorrow in mustard', async () => {
    window.localStorage.setItem(celebrationKey(5, `DESSERT:6:${startedAt}`), '1');
    vi.mocked(getLoyalty).mockResolvedValue(
      active(7, milestones({ 6: { status: 'EARNED', expiresAt: inDays(1) } }), {
        pendingDessert: { rewardId: 9, expiresAt: inDays(1) },
      }),
    );
    renderSection();
    const exp = await screen.findByText('· vence mañana');
    expect(exp.className).toContain('text-warning-deep');
  });

  it('keeps the usual color when there is time left', async () => {
    window.localStorage.setItem(celebrationKey(5, `DESSERT:6:${startedAt}`), '1');
    vi.mocked(getLoyalty).mockResolvedValue(
      active(7, milestones({ 6: { status: 'EARNED', expiresAt: inDays(4) } }), {
        pendingDessert: { rewardId: 9, expiresAt: inDays(4) },
      }),
    );
    renderSection();
    const exp = await screen.findByText('· vence en 4 días');
    expect(exp.className).not.toContain('text-warning-deep');
  });

  it('shows the 10% chip when the wallet discount comes from the loyalty line', async () => {
    window.localStorage.setItem(celebrationKey(5, `DISCOUNT:24:${startedAt}`), '1');
    vi.mocked(getLoyalty).mockResolvedValue(
      active(24, milestones({ 24: { status: 'EARNED', expiresAt: inDays(4) } })),
    );
    vi.mocked(getWallet).mockResolvedValue({
      available: 3, committed: 0, expiresAt: null, discount: { percent: 10, expiresAt: inDays(4), source: 'LOYALTY' },
    });
    renderSection();
    const chip = await screen.findByRole('button', { name: /10% off · vence en 4 días · usar/i });
    fireEvent.click(chip);
    expect(screen.getByTestId('where')).toHaveTextContent('/credits?comprar=1');
  });

  it('shows no 10% chip when the discount comes from the review campaign', async () => {
    window.localStorage.setItem(celebrationKey(5, `DISCOUNT:24:${startedAt}`), '1');
    vi.mocked(getLoyalty).mockResolvedValue(
      active(24, milestones({ 24: { status: 'EARNED', expiresAt: inDays(4) } })),
    );
    vi.mocked(getWallet).mockResolvedValue({
      available: 3, committed: 0, expiresAt: null, discount: { percent: 10, expiresAt: inDays(4), source: 'REVIEW_CAMPAIGN' },
    });
    renderSection();
    await region();
    await act(async () => {});
    expect(screen.queryByRole('button', { name: /10% off · vence/i })).not.toBeInTheDocument();
  });

  it('gives no chip for the gift lunch', async () => {
    window.localStorage.setItem(celebrationKey(5, `LUNCH:18:${startedAt}`), '1');
    vi.mocked(getLoyalty).mockResolvedValue(active(19, milestones({ 18: { status: 'EARNED', expiresAt: inDays(5) } })));
    renderSection();
    await region();
    expect(screen.queryByRole('button', { name: /· usar/i })).not.toBeInTheDocument();
  });
});

describe('rules sheet', () => {
  it('opens from the line with the cycle status, the rewards from the API and the rules text', async () => {
    vi.mocked(getLoyalty).mockResolvedValue(active(7));
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: /7 almuerzos retirados/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Cómo funciona' });
    // Desktop: anchored near the top instead of the bottom edge (mobile stays a bottom sheet).
    expect(dialog.className).toContain('lg:top-');
    expect(dialog.className).toContain('lg:bottom-auto');
    expect(dialog).toHaveTextContent(
      `Tu ciclo va del ${formatDayMonth(startedAt)} al ${formatDayMonth(endsAt)}. Llevás 7 almuerzos.`,
    );
    expect(dialog).toHaveTextContent('6 almuerzos: un postre de regalo');
    expect(dialog).toHaveTextContent('18 almuerzos: un almuerzo de regalo');
    expect(dialog).toHaveTextContent('24 almuerzos: 10% off en tu próxima compra');
    expect(dialog).toHaveTextContent(
      'Arranca el día que retirás tu primer almuerzo. Cuando termina el ciclo, la línea vuelve a cero y arranca con el próximo almuerzo que retirás.',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByRole('dialog', { name: 'Cómo funciona' })).not.toBeInTheDocument();
  });
});

describe('celebrations', () => {
  it('celebrates a new dessert once, with its CTA', async () => {
    vi.mocked(getLoyalty).mockResolvedValue(
      active(6, milestones({ 6: { status: 'EARNED', expiresAt: inDays(7) } }), {
        pendingDessert: { rewardId: 9, expiresAt: inDays(7) },
      }),
    );
    const { remount, onUseDessert } = renderSection();
    const dialog = await screen.findByRole('dialog', { name: '¡Postre de regalo!' });
    expect(dialog).toHaveTextContent(`Sumalo a tu próximo pedido de almuerzo. Tenés hasta el ${formatDayMonth(inDays(7))}.`);
    expect(dialog.querySelector('svg.lucide-dessert')).not.toBeNull();
    expect(dialog.querySelector('svg.lucide-cake')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pedir con postre' }));
    expect(onUseDessert).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: '¡Postre de regalo!' })).not.toBeInTheDocument();

    remount();
    await region();
    expect(screen.queryByRole('dialog', { name: '¡Postre de regalo!' })).not.toBeInTheDocument();
  });

  it('celebrates the gift lunch', async () => {
    vi.mocked(getLoyalty).mockResolvedValue(active(18, milestones({ 18: { status: 'USED' } })));
    renderSection();
    const almuerzo = await screen.findByRole('dialog', { name: '¡Almuerzo de regalo en tu saldo!' });
    expect(almuerzo).toHaveTextContent('Ya sumamos 1 almuerzo a tu saldo. Vence como el resto.');
    fireEvent.click(within(almuerzo).getByRole('button', { name: '¡Genial!' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('celebrates the 10% and sends the customer to buy', async () => {
    window.localStorage.setItem(celebrationKey(5, `LUNCH:18:${startedAt}`), '1');
    vi.mocked(getLoyalty).mockResolvedValue(
      active(24, milestones({ 18: { status: 'USED' }, 24: { status: 'EARNED', expiresAt: inDays(7) } })),
    );
    vi.mocked(getWallet).mockResolvedValue({
      available: 3, committed: 0, expiresAt: null, discount: { percent: 10, expiresAt: inDays(7), source: 'LOYALTY' },
    });
    renderSection();
    const d10 = await screen.findByRole('dialog', { name: '¡Ganaste 10% off!' });
    expect(d10).toHaveTextContent(`Para tu próxima compra de almuerzos. Tenés hasta el ${formatDayMonth(inDays(7))}.`);
    fireEvent.click(within(d10).getByRole('button', { name: 'Usar ahora' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/credits?comprar=1');
  });

  it('waits for the fill animation to land before celebrating', async () => {
    media.set(false);
    const advance = stubFrames();
    vi.mocked(getLoyalty).mockResolvedValue(
      active(6, milestones({ 6: { status: 'EARNED', expiresAt: inDays(7) } }), {
        pendingDessert: { rewardId: 9, expiresAt: inDays(7) },
      }),
    );
    renderSection();
    await region();
    expect(screen.queryByRole('dialog', { name: '¡Postre de regalo!' })).not.toBeInTheDocument();
    advance(2000);
    expect(await screen.findByRole('dialog', { name: '¡Postre de regalo!' })).toBeInTheDocument();
  });
});

describe('edge states', () => {
  it('invites a new customer to start the cycle with the first lunch', async () => {
    vi.mocked(getLoyalty).mockResolvedValue({
      enabled: true, cycle: null, waiting: false, milestones: milestones(), pendingDessert: null,
    });
    renderSection();
    const r = await region();
    expect(within(r).getByText('Tu ciclo arranca con tu primer almuerzo.')).toBeInTheDocument();
    expect(within(r).getByText('Inicio')).toBeInTheDocument();
    expect(within(r).getByText('+2 meses')).toBeInTheDocument();
    expect(screen.queryByTestId('loyalty-count')).not.toBeInTheDocument();
    expect(node(6)).toHaveAttribute('data-status', 'locked');
  });

  it('explains that the next cycle starts with the next lunch when waiting, keeping pending rewards', async () => {
    const exp = inDays(2);
    window.localStorage.setItem(celebrationKey(5, `DESSERT:6:${exp}`), '1');
    vi.mocked(getLoyalty).mockResolvedValue({
      enabled: true, cycle: null, waiting: true,
      milestones: milestones({ 6: { status: 'EARNED', expiresAt: exp } }),
      pendingDessert: { rewardId: 3, expiresAt: exp },
    });
    renderSection();
    const r = await region();
    expect(within(r).getByText('Tu ciclo terminó. El próximo arranca con tu próximo almuerzo.')).toBeInTheDocument();
    expect(node(6)).toHaveAttribute('data-status', 'locked');
    expect(within(r).getByRole('button', { name: /postre de regalo · vence en 2 días · usar/i })).toBeInTheDocument();
  });
});
