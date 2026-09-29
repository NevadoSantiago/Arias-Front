import { useMemo, useState } from 'react';
import { ArrowRight, Clock3 } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetTitle } from '@/components/ui/sheet';
import { PickupTimePicker } from './b2c/PickupTimePicker';
import { formatOrderDayLabel } from './orderDateLabels';
import type { OrderV2 } from '../services/ordersApi';

interface Props {
  order: OrderV2 | null;
  changing: boolean;
  errorMessage: string | null;
  /** `pickupAt` exacto del slot elegido, tal como lo devolvió `getPickupSlots`. */
  onConfirm: (pickupAt: string) => void;
  onClose: () => void;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** "HH:MM" con la misma hora local que muestran los selectores del picker. */
function hm(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sameInstant(a: string, b: string): boolean {
  return new Date(a).getTime() === new Date(b).getTime();
}

/**
 * Hoja "Cambiar horario de retiro" de Mis pedidos (F19, prototipo
 * `MyOrders.dc.html`, tablero v20). Dos pasos: 1) horario actual + selectores
 * de hora y minutos del MISMO día (los slots salen de `getPickupSlots`, el
 * backend decide qué horarios respetan la ventana y la antelación; reusa
 * `PickupTimePicker` en su variante `selectOnly`), con "Continuar"
 * deshabilitado mientras el horario no cambie; 2) confirmación Antes → Ahora.
 * Que el pedido todavía se pueda cambiar lo decide siempre el backend
 * (`pickupTimeChangeable` para ofrecer la acción, el `PATCH` al confirmar).
 * No se cierra sola (Escape ni overlay) mientras el cambio está en curso.
 */
export function ChangePickupTimeSheet({ order, changing, errorMessage, onConfirm, onClose }: Props) {
  return (
    <Sheet open={order !== null} onOpenChange={(next) => !next && !changing && onClose()}>
      <SheetContent aria-label="Cambiar horario de retiro" className="p-0">
        {order && (
          <ChangePickupTimeContent
            key={order.id}
            order={order}
            changing={changing}
            errorMessage={errorMessage}
            onConfirm={onConfirm}
            onClose={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ChangePickupTimeContent({
  order,
  changing,
  errorMessage,
  onConfirm,
  onClose,
}: Props & { order: OrderV2 }) {
  const [step, setStep] = useState<'pick' | 'confirm'>('pick');
  const [picked, setPicked] = useState<string | null>(null);
  // El selector arranca en el horario actual del pedido; al volver desde la
  // confirmación ("Elegir otro horario") retoma el que se había elegido.
  const [startIso, setStartIso] = useState(order.pickupAt);
  const startAt = useMemo(() => ({ pickupAt: startIso }), [startIso]);
  const dayLabel = useMemo(() => formatOrderDayLabel(order.pickupAt, new Date()), [order.pickupAt]);

  const currentLabel = hm(order.pickupAt);
  const unchanged = picked === null || sameInstant(picked, order.pickupAt);
  const newLabel = picked ? hm(picked) : currentLabel;
  const itemsLabel = order.items
    .map((item) => item.dishNombre + (item.sideNombre ? ` · ${item.sideNombre.toLowerCase()}` : ''))
    .join(' + ');

  if (step === 'confirm' && picked) {
    return (
      <>
        <div className="flex flex-col gap-4 p-4">
          <SheetTitle>{`¿Cambiar el retiro a las ${newLabel}?`}</SheetTitle>
          <SheetDescription className="sr-only">
            Confirmá el cambio de horario de retiro de tu pedido.
          </SheetDescription>
          <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-4 py-3">
            <span className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold uppercase tracking-brand text-muted-foreground">Antes</span>
              <span className="font-display text-2xl font-bold text-muted-foreground">{currentLabel}</span>
            </span>
            <ArrowRight className="h-[22px] w-[22px] text-primary-deep" aria-hidden="true" />
            <span className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold uppercase tracking-brand text-muted-foreground">Ahora</span>
              <span className="font-display text-2xl font-bold text-foreground">{newLabel}</span>
            </span>
          </div>
          <p className="m-0 text-sm text-muted-foreground">
            {dayLabel}. Tu pedido y tus almuerzos no cambian, solo la hora de retiro.
          </p>
          {errorMessage && (
            <p role="alert" className="text-xs text-destructive">
              {errorMessage}
            </p>
          )}
        </div>
        <SheetFooter>
          <button
            type="button"
            onClick={() => onConfirm(picked)}
            disabled={changing}
            className="h-[54px] w-full rounded-md bg-primary-deep text-sm font-bold uppercase tracking-brand text-primary-foreground disabled:opacity-70"
          >
            {changing ? 'Cambiando…' : 'Sí, cambiar horario'}
          </button>
          <button
            type="button"
            onClick={() => setStep('pick')}
            disabled={changing}
            className="h-[52px] w-full rounded-md border border-border bg-card text-sm font-semibold text-foreground disabled:opacity-70"
          >
            Elegir otro horario
          </button>
        </SheetFooter>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 p-4">
        <SheetTitle>Cambiar horario de retiro</SheetTitle>
        <SheetDescription>{dayLabel}. Podés elegir otro horario del mismo día.</SheetDescription>

        <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-4 py-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold uppercase tracking-brand text-muted-foreground">
              Horario actual
            </span>
            <span className="text-sm text-foreground">{itemsLabel}</span>
          </span>
          <span className="font-display text-2xl font-bold text-foreground">{currentLabel}</span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-brand text-muted-foreground">
            Nuevo horario
          </span>
          <PickupTimePicker
            fecha={order.fecha}
            isToday={false}
            dayShortLabel=""
            lastUsedTimeOfDay={null}
            onSelect={setPicked}
            jumpTo={startAt}
            selectOnly
          />
          <p role="status" aria-live="polite" className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Clock3 className="h-4 w-4 text-primary-deep" aria-hidden="true" />
            {unchanged ? 'Es el horario que ya tenés. Elegí otro para seguir.' : `Nuevo retiro a las ${newLabel} hs`}
          </p>
        </div>
      </div>
      <SheetFooter>
        <button
          type="button"
          onClick={() => {
            if (picked) setStartIso(picked);
            setStep('confirm');
          }}
          disabled={unchanged}
          className="h-[54px] w-full rounded-md bg-primary-deep text-sm font-bold uppercase tracking-brand text-primary-foreground disabled:cursor-not-allowed disabled:border disabled:border-dashed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
        >
          Continuar
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-[52px] w-full rounded-md border border-border bg-card text-sm font-semibold text-foreground"
        >
          Volver sin cambiar
        </button>
      </SheetFooter>
    </>
  );
}
