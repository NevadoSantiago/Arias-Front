import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { summarizeDishes } from './dashboardDay';
import { DishList } from './kitchenParts';

const item = (dishNombre: string, sideNombre: string | null, notas: string | null = null) => ({
  dishNombre,
  sideNombre,
  notas,
});

function renderList(...items: ReturnType<typeof item>[]) {
  render(<DishList dishes={summarizeDishes([{ items }]).dishes} label="Platos" />);
  return screen.getByRole('list', { name: 'Platos' });
}

describe('DishList', () => {
  it('renders dishes without notes with no box and no note rows', () => {
    const list = renderList(item('Milanesa', 'Puré'), item('Milanesa', null), item('Tarta', null));

    const milanesa = within(list).getByText('Milanesa').closest('li') as HTMLElement;
    expect(milanesa).not.toHaveAttribute('aria-label');
    expect(milanesa.className).not.toContain('destructive');
    expect(within(list).getByText('2 ×')).toBeInTheDocument();
    expect(within(list).getByText('1 c/ Puré · 1 sin acompañamiento')).toBeInTheDocument();
  });

  it('boxes a dish with notes: main row counts the plain ones, a sub-row lists each noted group', () => {
    const list = renderList(
      ...Array.from({ length: 4 }, () => item('Milanesa de pollo', 'Puré')),
      item('Milanesa de pollo', 'Papas', 'sin sal'),
    );

    const box = within(list).getByLabelText('Milanesa de pollo: 5 en total, 1 con nota');
    expect(box.className).toContain('border-destructive/20');
    expect(box.className).toContain('bg-destructive/5');
    expect(within(box).getByText('4 ×')).toBeInTheDocument();
    expect(within(box).getByText('4 c/ Puré')).toBeInTheDocument();
    expect(within(box).getByText('1 ×')).toBeInTheDocument();
    expect(within(box).getAllByText('Milanesa de pollo')).toHaveLength(2);
    expect(within(box).getByText('c/ Papas')).toBeInTheDocument();
    expect(within(box).getByText('sin sal')).toBeInTheDocument();
  });

  it('shows no main row when every item of the dish has a note', () => {
    const list = renderList(item('Tarta', null, 'sin cebolla'), item('Tarta', null, 'sin cebolla'));

    const box = within(list).getByLabelText('Tarta: 2 en total, 2 con nota');
    expect(within(box).getAllByText('Tarta')).toHaveLength(1);
    expect(within(box).getByText('2 ×')).toBeInTheDocument();
    expect(within(box).getByText('sin acompañamiento')).toBeInTheDocument();
    expect(within(box).getByText('sin cebolla')).toBeInTheDocument();
  });

  it('merges notes that differ only in case or spacing into one row', () => {
    const list = renderList(item('Bife', 'Puré', 'Sin sal'), item('Bife', 'Puré', ' sin SAL '));

    expect(within(list).getAllByText('Sin sal')).toHaveLength(1);
    expect(within(list).getByText('2 ×')).toBeInTheDocument();
  });
});
