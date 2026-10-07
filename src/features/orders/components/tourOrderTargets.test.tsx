import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DishCard } from './DishCard';
import { CartBar } from './b2c/CartBar';
import { DishSheet } from './b2c/DishSheet';
import { OrderReviewSheet } from './b2c/OrderReviewSheet';
import { OrderReviewPanel } from './b2c/OrderReviewPanel';
import { BalanceBox } from './b2c/OrderReviewParts';
import { TourContext } from '@/features/tour/TourContext';
import type { CartLine } from '../hooks/useCart';
import type { Dish } from '../types';

vi.mock('../services/ordersApi', () => ({
  getPickupSlots: vi.fn().mockResolvedValue(['2026-05-21T15:00:00Z']),
  getDishPreference: vi.fn().mockResolvedValue(null),
}));

const dish: Dish = {
  id: 10,
  nombre: 'Milanesa napolitana',
  descripcion: 'Con papas fritas',
  fotoUrl: null,
  category: { id: 1, nombre: 'Básico', parentId: null, creditCost: 2 },
  menuSection: { id: 1, nombre: 'Carnes', ordenDisplay: 1 },
  sideType: 'GUARNICION',
  allowedSides: [{ id: 1, nombre: 'Papas', tipo: 'GUARNICION', enabled: true }],
  stockActual: 5,
  especial: false,
};
const line: CartLine = { localId: 'l1', dish, sideId: null, sideNombre: null, notas: null };

const reviewProps = {
  isToday: true,
  dayShortLabel: 'jueves 24',
  fecha: '2026-05-21',
  lastUsedTimeOfDay: null,
  onSelectPickup: vi.fn(),
  addToOrder: null,
  newOrderNotice: null,
  pickupTimeLabel: null,
  pickupJumpTo: null,
  onJoinOrder: vi.fn(),
  lines: [line],
  totalLunches: 2,
  onRemoveLine: vi.fn(),
  walletAvailable: 12,
  confirmLabel: 'Confirmar pedido',
  canConfirm: true,
  submitting: false,
  submitError: null,
  insufficientBalance: false,
  onConfirm: vi.fn(),
};

function inApp(ui: React.ReactNode, tourActive = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TourContext.Provider value={{ active: tourActive, registerPageControls: () => {} }}>
          {ui}
        </TourContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ordering — onboarding tour targets', () => {
  it('marks only the dish card chosen for the tour, with whether it has a side', () => {
    inApp(
      <>
        <DishCard dish={dish} onSelect={vi.fn()} tour={{ hasSide: true }} />
        <DishCard dish={{ ...dish, id: 11, nombre: 'Tarta' }} onSelect={vi.fn()} />
      </>,
    );

    const marked = screen.getByRole('button', { name: /milanesa napolitana/i });
    expect(marked).toHaveAttribute('data-tour', 'dish');
    expect(marked).toHaveAttribute('data-tour-has-side', 'true');
    expect(screen.getByRole('button', { name: /tarta/i })).not.toHaveAttribute('data-tour');
  });

  it('marks the sides group and the add button in the dish sheet', () => {
    inApp(<DishSheet dish={dish} open onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByRole('radiogroup').closest('[data-tour="sides"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: /agregar al pedido/i })).toHaveAttribute('data-tour', 'add');
  });

  it('marks "Ver pedido" in the cart bar', () => {
    inApp(<CartBar count={1} isToday dayLabel="hoy" onOpenReview={vi.fn()} />);

    expect(screen.getByRole('button', { name: /ver pedido/i })).toHaveAttribute('data-tour', 'cart');
  });

  it('marks the picker, the balance box and the confirm button in the review sheet', async () => {
    inApp(<OrderReviewSheet {...reviewProps} open onClose={vi.fn()} />);

    const group = await screen.findByRole('radiogroup', { name: /horario de retiro/i });
    expect(group.closest('[data-tour="picker"]')).not.toBeNull();
    expect(screen.getByText('Tenés disponibles').closest('[data-tour="balance-box"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toHaveAttribute('data-tour', 'confirm');
  });

  it('marks the picker, the balance box and the confirm button in the desktop panel', async () => {
    inApp(<OrderReviewPanel {...reviewProps} />);

    const group = await screen.findByRole('radiogroup', { name: /horario de retiro/i });
    expect(group.closest('[data-tour="picker"]')).not.toBeNull();
    expect(screen.getByText('Tenés disponibles').closest('[data-tour="balance-box"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toHaveAttribute('data-tour', 'confirm');
  });

  it('marks the balance box also when it warns about missing lunches', () => {
    inApp(<BalanceBox walletAvailable={1} totalLunches={3} missingNotice />);

    expect(screen.getByText(/te faltan 2 almuerzos/i).closest('[data-tour="balance-box"]')).not.toBeNull();
  });
});

describe('ordering — sheets while the tour is on', () => {
  const escape = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

  it('keeps the dish sheet open on Escape while the tour is active', () => {
    const onClose = vi.fn();
    inApp(<DishSheet dish={dish} open onClose={onClose} onConfirm={vi.fn()} />, true);

    escape();

    expect(onClose).not.toHaveBeenCalled();
  });

  it('still closes the dish sheet on Escape when there is no tour', () => {
    const onClose = vi.fn();
    inApp(<DishSheet dish={dish} open onClose={onClose} onConfirm={vi.fn()} />);

    escape();

    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the review sheet open on a pointer-down outside while the tour is active', () => {
    const onClose = vi.fn();
    inApp(<OrderReviewSheet {...reviewProps} open onClose={onClose} />, true);

    fireEvent.pointerDown(document.body);

    expect(onClose).not.toHaveBeenCalled();
  });
});
