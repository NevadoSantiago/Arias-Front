import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listPrinters } from '@/features/admin/services/adminApi';
import { AgentStatusCard } from '@/features/admin/printing/AgentStatusCard';
import { PrinterCard } from '@/features/admin/printing/PrinterCard';
import { PRINTERS_KEY } from '@/features/admin/printing/printingKeys';
import { usePrintAgentStatus } from '@/features/admin/printing/usePrintAgentStatus';

const HOW_IT_WORKS: { title: string; body: React.ReactNode }[] = [
  {
    title: 'Comandás',
    body: 'Tenés 10 s para deshacer. Si deshacés, no se imprime nada.',
  },
  {
    title: 'Cocina, siempre',
    body: 'Cada pedido comandado imprime un ticket en Cocina con el pedido completo.',
  },
  {
    title: 'Parrilla, si hace falta',
    body: (
      <>
        Si el pedido trae algún plato de parrilla, sale también un ticket en Parrilla. La estación se
        elige en cada <Link to="/admin/dishes" className="underline text-primary-deep">plato</Link>.
      </>
    ),
  },
  {
    title: 'Si no sale',
    body: (
      <>
        Espera en cola hasta 30 min. Después queda “Sin imprimir” y lo reimprimís desde el{' '}
        <Link to="/admin/dashboard" className="underline text-primary-deep">tablero</Link>.
      </>
    ),
  },
];

export function AdminPrintersPage() {
  const agent = usePrintAgentStatus();
  const [checking, setChecking] = useState(false);
  const { data: printers, isLoading, isError } = useQuery({
    queryKey: PRINTERS_KEY,
    queryFn: listPrinters,
  });

  const recheck = async () => {
    setChecking(true);
    try {
      await agent.refetch();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="p-6 lg:p-10">
      <div className="flex max-w-[960px] flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-foreground text-3xl lg:text-4xl font-bold leading-tight">
            Ticketeras
          </h1>
          <p className="text-sm text-muted-foreground">
            Dónde se imprimen las comandas y si el programa de la PC del local está conectado.
          </p>
        </header>

        {agent.data && (
          <AgentStatusCard status={agent.data} checking={checking} onRecheck={() => void recheck()} />
        )}

        {isLoading && (
          <p className="text-center text-muted-foreground text-sm uppercase tracking-brand py-12">Cargando…</p>
        )}
        {isError && (
          <p role="alert" className="text-sm text-destructive">No se pudieron cargar las ticketeras.</p>
        )}
        {printers && (
          <div className="grid items-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
            {printers.map((p) => <PrinterCard key={p.station} printer={p} />)}
          </div>
        )}

        <section
          aria-labelledby="printer-how"
          className="flex flex-col gap-3.5 rounded-md border border-dashed border-border px-6 py-5"
        >
          <h2 id="printer-how" className="text-xs font-bold uppercase tracking-brand text-muted-foreground">
            Cómo sale una comanda
          </h2>
          <ol className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr))]">
            {HOW_IT_WORKS.map((step) => (
              <li key={step.title} className="flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-brand text-primary-deep">
                  {step.title}
                </span>
                <span className="text-[13px] leading-snug">{step.body}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
