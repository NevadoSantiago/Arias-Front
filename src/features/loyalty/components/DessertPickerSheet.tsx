import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { AVAILABLE_DESSERTS_KEY } from '../queryKeys';
import { getAvailableDesserts } from '../services/loyaltyApi';
import { daysUntil, expiryText } from '../timelineModel';
import type { AvailableDessert } from '../types';
import { DessertPhoto } from './GiftDessertCard';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Vencimiento del postre de regalo, para "De regalo, sin cargo · vence en N días". */
  expiresAt: string;
  /** Postre que el pedido ya tiene (para cambiarlo); `null` si todavía no eligió. */
  selectedId: number | null;
  onConfirm: (dessert: { dessertId: number; nombre: string; fotoUrl: string | null }) => void;
  presentation?: 'sheet' | 'dialog';
}

/**
 * Selector del postre de regalo (prototipo "Elegí tu postre"): los postres con stock de hoy,
 * con nombre, descripción y foto. Un postre sin stock se ve pero no se puede elegir.
 */
export function DessertPickerSheet(props: Props) {
  // Cada apertura arranca de cero: la elección en curso no sobrevive al cierre.
  return props.open ? <OpenPicker {...props} /> : null;
}

function OpenPicker({ onClose, expiresAt, selectedId, onConfirm, presentation = 'sheet' }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: AVAILABLE_DESSERTS_KEY,
    queryFn: getAvailableDesserts,
    staleTime: 0,
  });
  const [pickedId, setPickedId] = useState<number | null>(selectedId);

  const desserts = data ?? [];
  // La elección vigente solo cuenta si el postre sigue con stock: nunca se confirma uno agotado.
  const picked = desserts.find((d) => d.id === pickedId && d.stockActual > 0) ?? null;

  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        aria-label="Elegí tu postre de regalo"
        variant={presentation}
        className={presentation === 'dialog' ? 'max-w-[520px] p-0' : 'p-0'}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="flex flex-col gap-1 pr-10">
            <SheetTitle className="text-[22px]">Elegí tu postre</SheetTitle>
            <SheetDescription>De regalo, sin cargo · {expiryText(daysUntil(expiresAt))}</SheetDescription>
          </div>

          {isLoading && <p className="m-0 text-sm text-muted-foreground">Cargando postres…</p>}
          {isError && <p className="m-0 text-sm text-destructive">No pudimos cargar los postres. Probá de nuevo en un momento.</p>}
          {!isLoading && !isError && desserts.length === 0 && (
            <p className="m-0 rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Hoy no hay postres disponibles.
            </p>
          )}

          {desserts.length > 0 && (
            <div role="radiogroup" aria-label="Postres disponibles hoy" className="flex flex-col gap-2.5">
              {desserts.map((dessert) => (
                <DessertOption
                  key={dessert.id}
                  dessert={dessert}
                  checked={picked?.id === dessert.id}
                  onPick={() => setPickedId(dessert.id)}
                />
              ))}
            </div>
          )}
        </div>
        <SheetFooter>
          <button
            type="button"
            disabled={!picked}
            onClick={() => picked && onConfirm({ dessertId: picked.id, nombre: picked.nombre, fotoUrl: picked.fotoUrl })}
            className="h-[52px] w-full rounded-md bg-primary-deep text-sm font-bold uppercase tracking-brand text-primary-foreground disabled:cursor-not-allowed disabled:border disabled:border-dashed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
          >
            Sumar al pedido
          </button>
          <span className="text-center text-[12.5px] text-muted-foreground">No cambia los almuerzos de tu pedido.</span>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function DessertOption({ dessert, checked, onPick }: { dessert: AvailableDessert; checked: boolean; onPick: () => void }) {
  const out = dessert.stockActual <= 0;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={out}
      onClick={onPick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl bg-background p-2.5 text-left text-foreground',
        out && 'cursor-not-allowed border-[1.5px] border-border bg-muted opacity-55',
        !out && checked && 'border-2 border-primary-deep',
        !out && !checked && 'border-[1.5px] border-border',
      )}
    >
      <DessertPhoto fotoUrl={dessert.fotoUrl} size={56} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-display text-base font-bold">{dessert.nombre}</span>
        {dessert.descripcion && <span className="text-[12.5px] text-muted-foreground">{dessert.descripcion}</span>}
        <span className={cn('text-[11.5px] font-bold', out ? 'text-destructive' : 'text-success')}>
          {out ? 'Sin stock hoy' : `Quedan ${dessert.stockActual} hoy`}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
          checked && !out ? 'bg-primary-deep text-primary-foreground' : 'border-[1.5px] border-muted-foreground/60 text-transparent',
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
      </span>
    </button>
  );
}
