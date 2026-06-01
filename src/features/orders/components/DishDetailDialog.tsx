import { useEffect, useState } from 'react';
import { Lightbulb, UtensilsCrossed } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { getDishPreference } from '../services/ordersApi';
import type { Dish } from '../types';

interface Props {
  dish: Dish | null;
  open: boolean;
  onClose: () => void;
  onConfirm?: (selection: { sideId: number | null; notas: string | null }) => Promise<void>;
  /** Cambia el label del botón de submit. Por default: "Confirmar pedido". */
  confirmLabel?: string;
  readonly?: boolean;
}

export function DishDetailDialog({ dish, open, onClose, onConfirm, confirmLabel = 'Confirmar pedido', readonly = false }: Props) {
  const [sideId, setSideId] = useState<string>('');
  const [notas, setNotas] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [suggestedNote, setSuggestedNote] = useState<string | null>(null);

  // Resetear cada vez que se abre con un dish nuevo
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      onClose();
      setTimeout(() => {
        setSideId('');
        setNotas('');
        setError(null);
        setImgFailed(false);
        setSuggestedNote(null);
      }, 200);
    }
  };

  useEffect(() => {
    if (!open || !dish || readonly) return;
    let cancelled = false;
    getDishPreference(dish.id).then((pref) => {
      if (cancelled || !pref) return;
      if (pref.sideId && dish.allowedSides.some((s) => s.id === pref.sideId && s.enabled)) {
        setSideId(String(pref.sideId));
      }
      if (pref.notas && pref.notas.trim()) {
        setSuggestedNote(pref.notas.trim());
      }
    });
    return () => { cancelled = true; };
  }, [open, dish, readonly]);

  if (!dish) return null;
  const showFallback = !dish.fotoUrl || imgFailed;

  const requiresSide = dish.sideType !== null;
  const sideLabel = dish.sideType === 'GUARNICION' ? 'Guarnición' : 'Salsa';

  const handleConfirm = async () => {
    if (!onConfirm) return;
    if (requiresSide && !sideId) {
      setError(`Tenés que elegir una opción`);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm({
        // "none" = sentinel del radio para "sin acompañamiento/salsa" → null
        sideId: sideId && sideId !== 'none' ? Number(sideId) : null,
        notas: notas.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Flex column con max-h-[95vh]: foto fija arriba, contenido scrolleable
          en el medio, footer fijo abajo. Garantiza que los botones SIEMPRE
          quedan visibles, incluso con muchas guarniciones o pantallas chicas */}
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden gap-0 max-h-[95vh] flex flex-col">
        {/* ── Foto (no scrolls — pegada arriba) ───────────────────────── */}
        <div className="shrink-0 bg-muted relative">
          {showFallback ? (
            <div className="aspect-[4/3] flex items-center justify-center text-muted-foreground">
              <UtensilsCrossed className="w-16 h-16 opacity-40" />
            </div>
          ) : (
            <img
              src={dish.fotoUrl!}
              alt={dish.nombre}
              className="w-full h-auto max-h-[40vh] object-contain block [filter:contrast(1.05)_saturate(1.1)_brightness(1.02)]"
              onError={() => setImgFailed(true)}
            />
          )}
        </div>

        {/* ── Contenido (scrolls si hace falta) ───────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="font-display text-2xl font-bold leading-tight">
                {dish.nombre}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                {dish.descripcion}
              </DialogDescription>
            </DialogHeader>

            {requiresSide && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label className="uppercase tracking-brand text-xs">
                    {readonly ? (dish.sideType === 'GUARNICION' ? 'Guarniciones disponibles' : 'Salsas disponibles') : `Elegí tu ${sideLabel.toLowerCase()}`}
                  </Label>
                  {readonly ? (
                    <ul className="space-y-2">
                      {dish.allowedSides.filter((s) => s.enabled).map((side) => (
                        <li
                          key={side.id}
                          className="p-3 rounded-md border border-border text-sm"
                        >
                          {side.nombre}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <RadioGroup value={sideId} onValueChange={setSideId} className="space-y-2">
                      {dish.allowedSides.filter((s) => s.enabled).map((side) => (
                        <Label
                          key={side.id}
                          htmlFor={`side-${side.id}`}
                          className="flex items-center gap-3 p-3 rounded-md border border-border cursor-pointer hover:border-primary transition-colors has-[:checked]:border-primary has-[:checked]:bg-muted/50"
                        >
                          <RadioGroupItem id={`side-${side.id}`} value={String(side.id)} />
                          <span className="text-sm font-normal">{side.nombre}</span>
                        </Label>
                      ))}
                      <Label
                        htmlFor="side-none"
                        className="flex items-center gap-3 p-3 rounded-md border border-border cursor-pointer hover:border-primary transition-colors has-[:checked]:border-primary has-[:checked]:bg-muted/50"
                      >
                        <RadioGroupItem id="side-none" value="none" />
                        <span className="text-sm font-normal italic text-muted-foreground">
                          Sin {sideLabel.toLowerCase()}
                        </span>
                      </Label>
                    </RadioGroup>
                  )}
                </div>
              </>
            )}

            {!readonly && (
              <>
                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="notas" className="uppercase tracking-brand text-xs">
                    Notas <span className="text-muted-foreground/70 normal-case tracking-normal">(opcional)</span>
                  </Label>
                  <Textarea
                    id="notas"
                    placeholder="Ej: sin sal, punto cocción jugoso, sin cebolla…"
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    maxLength={200}
                    rows={2}
                    className="resize-none"
                  />
                  <p className="text-[11px] text-muted-foreground text-right">{notas.length}/200</p>
                  {suggestedNote && notas.trim() !== suggestedNote && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-muted/50 border border-border">
                      <Lightbulb className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0 text-[11px] leading-relaxed">
                        <span className="text-muted-foreground">Solés pedir: </span>
                        <span className="text-foreground italic">"{suggestedNote}"</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNotas(suggestedNote)}
                        className="text-[11px] uppercase tracking-brand font-medium text-primary hover:text-primary/80 transition-colors shrink-0"
                      >
                        Usar
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {error && <p className="text-destructive text-xs">{error}</p>}
          </div>
        </div>

        {/* ── Footer (pegado abajo siempre) ────────────────────────────── */}
        <div className="shrink-0 p-4 border-t border-border bg-card">
          <DialogFooter className="flex-row gap-3 m-0 sm:space-x-0">
            {readonly ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="flex-1 uppercase tracking-brand font-medium"
              >
                Cerrar
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={submitting}
                  className="flex-1 uppercase tracking-brand font-medium"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="flex-1 uppercase tracking-brand font-medium"
                >
                  {submitting ? 'Confirmando…' : confirmLabel}
                </Button>
              </>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
