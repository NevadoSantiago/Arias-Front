import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PrintAgentPill } from './PrintAgentPill';

const NOW = new Date('2026-10-23T16:00:00Z');

function renderPill(props: Partial<React.ComponentProps<typeof PrintAgentPill>> = {}) {
  return render(
    <MemoryRouter>
      <PrintAgentPill
        status={{ lastSeenAt: '2026-10-23T15:59:58Z', online: true }}
        queued={0}
        now={NOW}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('PrintAgentPill', () => {
  it('renders nothing until the first status arrives', () => {
    const { container } = renderPill({ status: undefined });
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the online state and opens the popover', () => {
    renderPill();
    const pill = screen.getByRole('button', { name: /ticketera en línea/i });
    expect(pill).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Programa de impresión activo')).toBeInTheDocument();

    fireEvent.click(pill);
    expect(pill).toHaveAttribute('aria-expanded', 'true');
    const pop = document.getElementById(pill.getAttribute('aria-controls')!)!;
    expect(pop).toHaveTextContent('Programa de impresión');
    expect(pop).toHaveTextContent('PC del local');
    expect(pop).toHaveTextContent('En línea');
    expect(pop).toHaveTextContent('hoy 12:59:58');
    expect(pop).toHaveTextContent('0 comandas');
    expect(screen.getByRole('link', { name: /ver ticketeras/i })).toHaveAttribute('href', '/admin/printers');
    expect(pop).not.toHaveTextContent('quedan en cola');
  });

  it('shows the offline state since the last contact, with the queue and the advice', () => {
    renderPill({ status: { lastSeenAt: '2026-10-23T15:20:47Z', online: false }, queued: 1 });
    const pill = screen.getByRole('button', { name: /sin conexión desde 12:20/i });
    expect(screen.getByText('Revisá la PC del local')).toBeInTheDocument();

    fireEvent.click(pill);
    const pop = document.getElementById(pill.getAttribute('aria-controls')!)!;
    expect(pop).toHaveTextContent('Sin conexión');
    expect(pop).toHaveTextContent('1 comanda');
    expect(pop).toHaveTextContent('Las comandas quedan en cola y salen solas cuando el programa vuelva. Si no salen en 30 min, vencen.');
  });

  it('closes the popover when the pill is clicked again', () => {
    renderPill();
    const pill = screen.getByRole('button', { name: /ticketera en línea/i });
    fireEvent.click(pill);
    fireEvent.click(pill);
    expect(pill).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: /ver ticketeras/i })).not.toBeInTheDocument();
  });
});
