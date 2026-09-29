import { useEffect, useRef, useState } from 'react';
import { Lightbulb, UtensilsCrossed } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { getDishPreference } from '../../services/ordersApi';
import { formatLunches } from '../../lunches';
import type { Dish } from '../../types';

interface Props {
  dish: Dish | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (selection: { sideId: number | null; notas: string | null }) => void;
  /**
   * `sheet` (default): hoja inferior móvil. `dialog`: diálogo centrado de dos
   * columnas para escritorio (F22a) — foto 4:3, nombre, descripción y costo a
   * la izquierda; guarniciones, nota y acciones a la derecha. Mismo estado y
   * mismos handlers: solo cambia la disposición.
   */
  presentation?: 'sheet' | 'dialog';
}

/**
 * Hoja inferior B2C del detalle de plato (F4, prototipo `Main.dc.html` —
 * hoja de plato). Reemplaza a `DishDetailDialog` SOLO en `B2cOrderPage`:
 * `DishDetailDialog` sigue tal cual para `CompanyOrderPage` (B2B) y para la
 * vista de solo lectura del resumen (restricción de la feature).
 */
export function DishSheet({ dish, open, onClose, onConfirm, presentation = 'sheet' }: Props) {
  const [sideId, setSideId] = useState<string>('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [suggestedNote, setSuggestedNote] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  /** true apenas el usuario elige una guarnición a mano — evita que una preferencia que llega tarde la pise. */
  const sideTouchedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setSideId('');
    setNotas('');
    setError(null);
    setSuggestedNote(null);
    setImgFailed(false);
    sideTouchedRef.current = false;
  }, [open, dish?.id]);

  useEffect(() => {
    if (!open || !dish) return;
    let cancelled = false;
    getDishPreference(dish.id)
      .then((pref) => {
        // Ignora una respuesta tardía si la hoja ya cerró, cambió de plato,
        // o si el usuario ya eligió una guarnición a mano mientras tanto.
        if (cancelled || !pref) return;
        if (
          !sideTouchedRef.current &&
          pref.sideId &&
          dish.allowedSides.some((s) => s.id === pref.sideId && s.enabled)
        ) {
          setSideId(String(pref.sideId));
        }
        if (pref.notas && pref.notas.trim()) {
          setSuggestedNote(pref.notas.trim());
        }
      })
      .catch(() => {
        // La preferencia es opcional — un fallo de red no debe romper la hoja.
      });
    return () => {
      cancelled = true;
    };
  }, [open, dish]);

  const handleSideSelect = (value: string) => {
    sideTouchedRef.current = true;
    setSideId(value);
  };

  if (!dish) return null;

  const showFallback = !dish.fotoUrl || imgFailed;
  const requiresSide = dish.sideType !== null;
  const sideLabel = dish.sideType === 'GUARNICION' ? 'guarnición' : 'salsa';
  const sidesTitle = dish.sideType === 'GUARNICION' ? 'Elegí tu guarnición' : 'Elegí tu salsa';
  const costText = `Usa ${formatLunches(dish.category.creditCost)}`;

  const handleConfirm = () => {
    if (requiresSide && !sideId) {
      setError('Tenés que elegir una opción.');
      return;
    }
    setError(null);
    onConfirm({
      sideId: sideId && sideId !== 'none' ? Number(sideId) : null,
      notas: notas.trim() || null,
    });
  };

  const asDialog = presentation === 'dialog';

  const photo = (
    /* 4:3 completo (las fotos se recortan 4:3 al subirlas): sin tope de
       alto, la hoja scrollea para llegar a la guarnición y al botón. */
    <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-muted">
      {showFallback ? (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <UtensilsCrossed className="h-16 w-16 opacity-40" aria-hidden="true" />
        </div>
      ) : (
        <img
          src={dish.fotoUrl!}
          alt={dish.nombre}
          className="h-full w-full object-cover [filter:contrast(1.05)_saturate(1.1)_brightness(1.02)]"
          onError={() => setImgFailed(true)}
        />
      )}
    </div>
  );

  const info = (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-brand text-muted-foreground">
        {dish.menuSection.nombre}
      </span>
      <SheetTitle>{dish.nombre}</SheetTitle>
      <SheetDescription className="sr-only">Detalle de {dish.nombre}: elegí el acompañamiento y una nota opcional.</SheetDescription>
      <p className="text-sm leading-relaxed text-muted-foreground">{dish.descripcion}</p>
      <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-bold text-primary-deep">
        {costText}
      </span>
    </div>
  );

  const options = (
    <>
      {requiresSide ? (
        <div className="flex flex-col gap-2.5">
          <span id="dish-sheet-sides-title" className="text-xs font-semibold uppercase tracking-brand text-muted-foreground">
            {sidesTitle}
          </span>
          <div role="radiogroup" aria-labelledby="dish-sheet-sides-title" className={cn('gap-2', asDialog ? 'grid grid-cols-2' : 'flex flex-col')}>
            {dish.allowedSides
              .filter((s) => s.enabled)
              .map((side) => (
                <button
                  key={side.id}
                  type="button"
                  role="radio"
                  aria-checked={sideId === String(side.id)}
                  onClick={() => handleSideSelect(String(side.id))}
                  className={cn(
                    'flex min-h-[50px] items-center gap-3 rounded-lg border-2 px-3.5 text-left text-sm font-medium',
                    sideId === String(side.id)
                      ? 'border-primary-deep bg-background text-foreground'
                      : 'border-border bg-card text-foreground',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                      sideId === String(side.id) ? 'border-primary-deep' : 'border-muted-foreground',
                    )}
                  >
                    {sideId === String(side.id) && <span className="h-2.5 w-2.5 rounded-full bg-primary-deep" />}
                  </span>
                  {side.nombre}
                </button>
              ))}
            <button
              type="button"
              role="radio"
              aria-checked={sideId === 'none'}
              onClick={() => handleSideSelect('none')}
              className={cn(
                'flex min-h-[50px] items-center gap-3 rounded-lg border-2 px-3.5 text-left text-sm font-medium italic text-muted-foreground',
                sideId === 'none' ? 'border-primary-deep bg-background' : 'border-border bg-card',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                  sideId === 'none' ? 'border-primary-deep' : 'border-muted-foreground',
                )}
              >
                {sideId === 'none' && <span className="h-2.5 w-2.5 rounded-full bg-primary-deep" />}
              </span>
              Sin {sideLabel}
            </button>
          </div>
        </div>
      ) : (
        <p className="rounded-md bg-muted px-3.5 py-3 text-sm text-foreground">Este plato va sin acompañamiento.</p>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="dish-sheet-notas" className="text-xs font-semibold uppercase tracking-brand text-muted-foreground">
          Nota para la cocina <span className="font-normal normal-case tracking-normal">(opcional)</span>
        </label>
        <textarea
          id="dish-sheet-notas"
          rows={2}
          placeholder="Ej: sin sal, bien cocido, sin cebolla…"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          maxLength={200}
          className="resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
        {suggestedNote && notas.trim() !== suggestedNote && (
          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-deep" aria-hidden="true" />
            <div className="min-w-0 flex-1 text-[11px] leading-relaxed">
              <span className="text-muted-foreground">Solés pedir: </span>
              <span className="italic text-foreground">&quot;{suggestedNote}&quot;</span>
            </div>
            <button
              type="button"
              onClick={() => setNotas(suggestedNote)}
              className="shrink-0 text-[11px] font-medium uppercase tracking-brand text-primary-deep"
            >
              Usar
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </>
  );

  const confirmButton = (
    <button
      type="button"
      onClick={handleConfirm}
      className="flex h-[54px] w-full items-center justify-between rounded-md bg-primary-deep px-4 font-medium text-primary-foreground"
    >
      <span className="text-sm font-bold uppercase tracking-brand">Agregar al pedido</span>
      <span className="text-sm font-semibold">{costText}</span>
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        aria-label={dish.nombre}
        variant={presentation}
        className={cn('p-0', asDialog && 'max-w-[1060px]')}
      >
        {asDialog ? (
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,580px)_minmax(0,1fr)] overflow-hidden">
            <div className="flex min-h-0 flex-col gap-5 overflow-y-auto border-r border-border">
              {photo}
              <div className="px-6 pb-6">{info}</div>
            </div>
            <div className="flex min-h-0 flex-col">
              <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6 pt-14">{options}</div>
              <SheetFooter className="px-6 pb-6">{confirmButton}</SheetFooter>
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {photo}
              <div className="flex flex-col gap-4 p-4">
                {info}
                {options}
              </div>
            </div>
            <SheetFooter>{confirmButton}</SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
