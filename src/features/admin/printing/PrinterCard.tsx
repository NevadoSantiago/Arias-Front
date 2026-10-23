import { useEffect, useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  updatePrinter, type DishStation, type PrinterConfig,
} from '@/features/admin/services/adminApi';
import { hostError, portError } from './printerAddress';
import { formatStamp } from './printTime';
import { PRINTERS_KEY } from './printingKeys';

const SAVED_VISIBLE_MS = 2500;

const META: Record<DishStation, { name: string; rule: string; tag: string; tagClass: string }> = {
  COCINA: {
    name: 'Cocina',
    rule: 'Imprime todas las comandas.',
    tag: 'Siempre',
    tagClass: 'bg-primary-deep text-primary-foreground',
  },
  PARRILLA: {
    name: 'Parrilla',
    rule: 'Imprime solo los pedidos con algún plato de parrilla.',
    tag: 'Si hay parrilla',
    tagClass: 'bg-warning/20 text-[#5E4106]',
  },
};

/** One printer: editable IP and port with inline validation and its own save. */
export function PrinterCard({ printer }: { printer: PrinterConfig }) {
  const queryClient = useQueryClient();
  const ids = useId();
  const headId = `${ids}-head`;
  const hostId = `${ids}-host`;
  const portId = `${ids}-port`;
  const hostMsgId = `${ids}-host-msg`;
  const portMsgId = `${ids}-port-msg`;
  const meta = META[printer.station];

  const [saved, setSaved] = useState({
    host: printer.host, port: String(printer.port), updatedAt: printer.updatedAt,
  });
  const [host, setHost] = useState(printer.host);
  const [port, setPort] = useState(String(printer.port));
  const [touched, setTouched] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [addressChanged, setAddressChanged] = useState(false);

  const mutation = useMutation({
    mutationFn: () => updatePrinter(printer.station, {
      host: host.trim(), port: parseInt(port.trim(), 10),
    }),
    onSuccess: (row) => {
      const next = { host: row.host, port: String(row.port), updatedAt: row.updatedAt };
      setAddressChanged(next.host !== saved.host || next.port !== saved.port);
      setSaved(next);
      setHost(next.host);
      setPort(next.port);
      setTouched(false);
      setJustSaved(true);
      queryClient.setQueryData<PrinterConfig[]>(PRINTERS_KEY, (rows) =>
        rows?.map((r) => (r.station === row.station ? row : r)));
    },
  });

  useEffect(() => {
    if (!justSaved) return;
    const id = setTimeout(() => setJustSaved(false), SAVED_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [justSaved]);

  const dirty = host !== saved.host || port !== saved.port;
  const hErr = hostError(host);
  const pErr = portError(port);
  const showErrors = dirty || touched;
  const hostInvalid = showErrors && !!hErr;
  const portInvalid = showErrors && !!pErr;
  const saving = mutation.isPending;
  const saveDisabled = saving || !dirty || !!hErr || !!pErr;

  const markEdited = () => {
    setJustSaved(false);
  };

  return (
    <form
      aria-labelledby={headId}
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!hErr && !pErr && dirty) mutation.mutate();
      }}
      className="flex flex-col gap-4 rounded-md border border-border bg-card p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={headId} className="font-display text-2xl font-bold leading-tight">{meta.name}</h2>
          <p className="text-[13px] text-muted-foreground">{meta.rule}</p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-brand',
            meta.tagClass,
          )}
        >
          {meta.tag}
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3 items-start">
        <div className="flex flex-col gap-1.5 min-w-0">
          <Label htmlFor={hostId} className="uppercase tracking-brand text-xs">IP de la ticketera</Label>
          <Input
            id={hostId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            value={host}
            onChange={(e) => { setHost(e.target.value); markEdited(); }}
            onBlur={() => setTouched(true)}
            aria-invalid={hostInvalid}
            aria-describedby={hostMsgId}
            disabled={saving}
            className={cn('h-11 tabular-nums', hostInvalid && 'border-destructive')}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={portId} className="uppercase tracking-brand text-xs">Puerto</Label>
          <Input
            id={portId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={port}
            onChange={(e) => { setPort(e.target.value); markEdited(); }}
            onBlur={() => setTouched(true)}
            aria-invalid={portInvalid}
            aria-describedby={portMsgId}
            disabled={saving}
            className={cn('h-11 tabular-nums', portInvalid && 'border-destructive')}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1 -mt-1.5">
        <p
          id={hostMsgId}
          className={cn('text-xs leading-snug', hostInvalid ? 'text-destructive' : 'text-muted-foreground')}
        >
          {hostInvalid
            ? hErr
            : 'IP fija de la ticketera en la red del local. Puerto habitual: 9100.'}
        </p>
        {portInvalid && (
          <p id={portMsgId} className="text-xs leading-snug text-destructive">{pErr}</p>
        )}
      </div>

      {mutation.isError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/45 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            No se pudo guardar. Revisá tu conexión y probá de nuevo; la ticketera sigue usando{' '}
            {saved.host}:{saved.port}.
          </span>
        </div>
      )}

      {justSaved && addressChanged && (
        <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs leading-snug">
          Las comandas que ya están en cola salen por la dirección anterior. Si alguna no sale,
          reimprimila desde el tablero.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          aria-live="polite"
          className={cn(
            'flex items-center gap-1.5 text-xs',
            justSaved ? 'font-semibold text-success' : 'text-muted-foreground',
          )}
        >
          {justSaved && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
          {justSaved
            ? `Guardado. Las comandas nuevas salen por ${saved.host}:${saved.port}.`
            : `Actualizada ${formatStamp(saved.updatedAt, new Date())}`}
        </p>
        <div className="flex items-center gap-2">
          {dirty && (
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => { setHost(saved.host); setPort(saved.port); setTouched(false); mutation.reset(); }}
              className="uppercase tracking-brand text-xs"
            >
              Descartar
            </Button>
          )}
          <Button type="submit" disabled={saveDisabled} className="uppercase tracking-brand text-xs">
            {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" aria-hidden="true" />}
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </form>
  );
}
