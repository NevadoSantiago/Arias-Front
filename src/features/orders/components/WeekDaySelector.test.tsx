import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeekDaySelector } from './WeekDaySelector';

/**
 * Caracterización (F13): pin del comportamiento ACTUAL de `WeekDaySelector`
 * antes de tocarlo. El componente es compartido con `CompanyOrderPage`
 * (B2B), que no debe cambiar — estos tests fijan qué muestra hoy, con el
 * reloj del sistema pisado para no depender del día real en que corre la
 * suite.
 */
describe('WeekDaySelector — current behavior (characterization, B2B unaffected)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('on a weekday (Wednesday) shows only the two Monday–Friday weeks, with today marked', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T09:00:00')); // miércoles

    render(
      <WeekDaySelector selectedDate="2026-09-28" onSelect={() => {}} orderedDates={new Set()} />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(10);
    ['28', '29', '30', '1', '2', '5', '6', '7', '8', '9'].forEach((n) => {
      expect(screen.getByText(n)).toBeInTheDocument();
    });
    expect(screen.queryByText('Sáb')).not.toBeInTheDocument();
    expect(screen.queryByText('Dom')).not.toBeInTheDocument();

    const todayButton = screen.getByText('30').closest('button')!;
    expect(todayButton.className).toContain('border-primary/50');
    expect(todayButton).not.toBeDisabled();
  });

  it('on a weekend (Saturday) shows the Monday–Friday of both weeks, none marked as today, no weekend chip', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T09:00:00')); // sábado

    render(
      <WeekDaySelector selectedDate="2026-09-30" onSelect={() => {}} orderedDates={new Set()} />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(10);
    ['21', '22', '23', '24', '25', '28', '29', '30', '1', '2'].forEach((n) => {
      expect(screen.getByText(n)).toBeInTheDocument();
    });
    expect(screen.queryByText('Sáb')).not.toBeInTheDocument();
    expect(screen.queryByText('26')).not.toBeInTheDocument();

    // Ningún chip queda marcado "hoy": ninguna de las fechas lunes-viernes
    // mostradas es el sábado real (26).
    screen.getAllByRole('button').forEach((btn) => {
      expect(btn.className).not.toContain('border-primary/50');
    });

    // La semana ya pasada (lunes a viernes anteriores al sábado) queda
    // deshabilitada.
    ['21', '22', '23', '24', '25'].forEach((n) => {
      expect(screen.getByText(n).closest('button')).toBeDisabled();
    });
  });
});
