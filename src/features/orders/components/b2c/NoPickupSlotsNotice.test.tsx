import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NoPickupSlotsNotice } from './NoPickupSlotsNotice';

describe('NoPickupSlotsNotice', () => {
  it('asks to pick another day when there is no next day', () => {
    render(<NoPickupSlotsNotice />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/ya no quedan horarios de retiro para este día/i)).toBeInTheDocument();
    expect(screen.getByText('Elegí otro día para armar tu pedido.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers a button to the next day instead of the paragraph', () => {
    render(<NoPickupSlotsNotice nextDay={{ date: '2026-10-27', label: 'Martes 27' }} onGoToDay={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Ir al menú del martes 27' })).toBeInTheDocument();
    expect(screen.queryByText('Elegí otro día para armar tu pedido.')).not.toBeInTheDocument();
    expect(screen.getByText(/ya no quedan horarios de retiro para este día/i)).toBeInTheDocument();
  });

  it('calls onGoToDay with the date of the next day when clicked', () => {
    const onGoToDay = vi.fn();
    render(<NoPickupSlotsNotice nextDay={{ date: '2026-10-27', label: 'Martes 27' }} onGoToDay={onGoToDay} />);

    fireEvent.click(screen.getByRole('button', { name: /ir al menú del/i }));

    expect(onGoToDay).toHaveBeenCalledTimes(1);
    expect(onGoToDay).toHaveBeenCalledWith('2026-10-27');
  });
});
