import { useEffect, useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import chefIllustration from '@/assets/illustrations/chef-ofrece.svg';
import type { Dish } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  dish: Dish;
  initialSideId: number | null;
  initialNotas: string | null;
  dayLabel: string;
  onConfirm: (selection: { sideId: number | null; notas: string | null }) => Promise<void>;
}

/**
 * Modal de sugerencia "El último [día] pediste:". Layout split:
 * - Izquierda (o arriba en mobile): chef + título grande.
 * - Derecha (o abajo): foto del plato, side selector, notas, confirmar.
 *
 * El side y las notas vienen pre-cargados del pedido anterior. El empleado
 * puede ajustar antes de confirmar.
 */
export function SuggestionDialog({
  open,
  onClose,
  dish,
  initialSideId,
  initialNotas,
  dayLabel,
  onConfirm,
}: Props) {
  const [sideId, setSideId] = useState<string>('');
  const [notas, setNotas] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const requiresSide = dish.sideType !== null;
  const sideLabel = dish.sideType === 'GUARNICION' ? 'Guarnición' : 'Salsa';

  // Pre-cargar al abrir
  useEffect(() => {
    if (!open) return;
    if (initialSideId == null) {
      setSideId(requiresSide ? 'none' : '');
    } else if (dish.allowedSides.some((s) => s.id === initialSideId && s.enabled)) {
      setSideId(String(initialSideId));
    } else {
      setSideId('');
    }
    setNotas(initialNotas?.trim() ?? '');
    setError(null);
    setImgFailed(false);
  }, [open, dish, initialSideId, initialNotas, requiresSide]);

  const handleOpenChange = (next: boolean) => {
    if (!next) onClose();
  };

  const handleConfirm = async () => {
    if (requiresSide && !sideId) {
      setError('Tenés que elegir una opción');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm({
        sideId: sideId && sideId !== 'none' ? Number(sideId) : null,
        notas: notas.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error');
    } finally {
      setSubmitting(false);
    }
  };

  const showFallback = !dish.fotoUrl || imgFailed;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden gap-0 max-h-[95vh] flex flex-col sm:flex-row">
        {/* ── Izquierda (o arriba en mobile): chef + título ─────────────── */}
        <div className="bg-primary/5 p-6 sm:p-8 flex flex-col items-center justify-center text-center sm:w-[42%] sm:shrink-0 border-b sm:border-b-0 sm:border-r border-border">
          <img
            src={chefIllustration}
            alt=""
            aria-hidden="true"
            className="w-28 sm:w-44 h-auto mb-4 select-none pointer-events-none"
          />
          <p className="font-display text-xl sm:text-2xl lg:text-3xl font-bold text-primary leading-tight">
            El último {dayLabel} pediste
          </p>
        </div>

        {/* ── Derecha: detalle del plato ───────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Foto del plato */}
          <div className="shrink-0 bg-muted relative">
            {showFallback ? (
              <div className="aspect-[16/9] flex items-center justify-center text-muted-foreground">
                <UtensilsCrossed className="w-12 h-12 opacity-40" />
              </div>
            ) : (
              <img
                src={dish.fotoUrl!}
                alt={dish.nombre}
                className="w-full h-auto max-h-[28vh] object-cover block [filter:contrast(1.05)_saturate(1.1)_brightness(1.02)]"
                onError={() => setImgFailed(true)}
              />
            )}
          </div>

          {/* Contenido scrolleable */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-5 space-y-4">
              <div className="space-y-1.5 text-left">
                <h3 className="font-display text-xl sm:text-2xl font-bold leading-tight">
                  {dish.nombre}
                </h3>
                {dish.descripcion && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {dish.descripcion}
                  </p>
                )}
              </div>

              {requiresSide && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="uppercase tracking-brand text-xs">
                      Elegí tu {sideLabel.toLowerCase()}
                    </Label>
                    <RadioGroup value={sideId} onValueChange={setSideId} className="space-y-1.5">
                      {dish.allowedSides.filter((s) => s.enabled).map((side) => (
                        <Label
                          key={side.id}
                          htmlFor={`sug-side-${side.id}`}
                          className="flex items-center gap-3 p-2.5 rounded-md border border-border cursor-pointer hover:border-primary transition-colors has-[:checked]:border-primary has-[:checked]:bg-muted/50"
                        >
                          <RadioGroupItem id={`sug-side-${side.id}`} value={String(side.id)} />
                          <span className="text-sm font-normal">{side.nombre}</span>
                        </Label>
                      ))}
                      <Label
                        htmlFor="sug-side-none"
                        className="flex items-center gap-3 p-2.5 rounded-md border border-border cursor-pointer hover:border-primary transition-colors has-[:checked]:border-primary has-[:checked]:bg-muted/50"
                      >
                        <RadioGroupItem id="sug-side-none" value="none" />
                        <span className="text-sm font-normal italic text-muted-foreground">
                          Sin {sideLabel.toLowerCase()}
                        </span>
                      </Label>
                    </RadioGroup>
                  </div>
                </>
              )}

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="sug-notas" className="uppercase tracking-brand text-xs">
                  Notas <span className="text-muted-foreground/70 normal-case tracking-normal">(opcional)</span>
                </Label>
                <Textarea
                  id="sug-notas"
                  placeholder="Ej: sin sal, punto cocción jugoso, sin cebolla…"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  maxLength={200}
                  rows={2}
                  className="resize-none"
                />
                <p className="text-[11px] text-muted-foreground text-right">{notas.length}/200</p>
              </div>

              {error && <p className="text-destructive text-xs">{error}</p>}
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 p-4 border-t border-border bg-card">
            <div className="flex flex-row gap-3">
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
                {submitting ? 'Confirmando…' : 'Confirmar pedido'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
