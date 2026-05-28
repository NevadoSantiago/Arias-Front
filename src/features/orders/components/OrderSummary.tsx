import { useState } from 'react';
import { AlertTriangle, ArrowLeft, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import panaderoDuda from '@/assets/illustrations/Panadero-Duda.svg';
import chefCocinando from '@/assets/illustrations/Chef-Cocinando.svg';
import { cn } from '@/lib/utils';
import { detectOrderIssues } from '../orderIssues';
import type { DailyChoice } from '../types';

interface Props {
  order: DailyChoice;
  cutoffTime: string; // "10:00"
  companyName: string;
  onEdit: () => void;
  onCancel: () => Promise<void>;
  onBackToMenu?: () => void;
}

function calculateRemaining(cutoffTime: string): string {
  const [h, m] = cutoffTime.split(':').map(Number);
  const cutoff = new Date();
  cutoff.setHours(h, m, 0, 0);
  const diff = cutoff.getTime() - Date.now();
  if (diff <= 0) return 'Pedidos cerrados';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatToday(): string {
  const formatted = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function OrderSummary({ order, cutoffTime, companyName, onEdit, onCancel, onBackToMenu }: Props) {
  const [cancelling, setCancelling] = useState(false);
  const remaining = calculateRemaining(cutoffTime);
  const canModify = order.estado === 'PENDIENTE' && remaining !== 'Pedidos cerrados';
  const issues = detectOrderIssues(order);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await onCancel();
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      {/* ── Chef cocinando — fondo de la "cocina" ─────────────────────
          Posicionado con translate ajustable: el chef figure tiene peso
          visual asimétrico (sujeto a la izquierda, horno a la derecha)
          así que un centrado matemático puro lo deja desplazado del
          centro perceptual. Ajustamos con -translate-x-[N%]:
          50% = centro matemático del SVG
          <50% = imagen shifted hacia la derecha
          >50% = imagen shifted hacia la izquierda */}
      <img
        src={chefCocinando}
        alt=""
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-[46%] w-[140vw] sm:w-[120vw] max-w-[1500px] h-auto opacity-[0.06] pointer-events-none select-none"
      />

      <div className="relative container max-w-md mx-auto py-8 lg:py-12">
      {/* ── Link "Volver al inicio" ──────────────────────────────── */}
      {onBackToMenu && (
        <button
          type="button"
          onClick={onBackToMenu}
          className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary uppercase tracking-brand mb-6 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          <span>Volver al inicio</span>
        </button>
      )}

      {/* ── Rail (estante de cocina) ───────────────────────────────── */}
      <div className="relative">
        {/* La barra horizontal del estante */}
        <div className="h-[2px] bg-primary w-full" />
        {/* Sombritas debajo del rail para profundidad */}
        <div className="h-[1px] bg-primary/30 w-full" />
      </div>

      {/* ── Clips que sostienen la comanda ─────────────────────────── */}
      <div className="relative h-5 -mt-[2px]">
        {/* Clip izquierdo */}
        <div className="absolute top-0 left-[22%] flex flex-col items-center">
          <div className="w-1 h-1 rounded-full bg-primary" />
          <div className="w-3 h-4 bg-primary rounded-b-sm shadow-sm" />
        </div>
        {/* Clip derecho */}
        <div className="absolute top-0 right-[22%] flex flex-col items-center">
          <div className="w-1 h-1 rounded-full bg-primary" />
          <div className="w-3 h-4 bg-primary rounded-b-sm shadow-sm" />
        </div>
      </div>

      {/* ── El papel de la comanda ──────────────────────────────────── */}
      <div
        className="relative bg-card px-6 lg:px-10 py-8 lg:py-10 shadow-2xl"
        style={{
          transform: 'rotate(-0.5deg)',
          // Líneas horizontales rojas sutiles, como papel de comanda
          backgroundImage: `repeating-linear-gradient(
            to bottom,
            transparent 0px,
            transparent 31px,
            hsl(var(--primary) / 0.10) 31px,
            hsl(var(--primary) / 0.10) 32px
          )`,
        }}
      >
        {/* ── Número de comanda + fecha ─────────────────────────── */}
        <section className="text-center mb-6">
          <p className="font-display text-primary text-2xl font-bold uppercase tracking-wider leading-tight">
            Comanda Nº {String(order.id).padStart(4, '0')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{formatToday()}</p>
        </section>

        {/* ── Empresa ──────────────────────────────────────────── */}
        <DashedDivider />
        <section className="my-5">
          <Label>Empresa</Label>
          <p className="text-foreground font-semibold uppercase tracking-wide text-sm mt-1">
            {companyName}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Entrega:{' '}
            <span className="text-foreground font-medium">{order.horaEntrega}</span>
          </p>
        </section>

        {/* ── Pedido ───────────────────────────────────────────── */}
        <DashedDivider />
        <section className="my-5">
          <Label>Pedido</Label>
          <div className="mt-2">
            <h2 className={cn(
              'font-sans text-foreground font-bold uppercase tracking-wide text-base leading-snug',
              issues.dishDisabled && 'line-through text-muted-foreground'
            )}>
              {order.dishNombre}
            </h2>
          </div>
          {order.sideNombre && (
            <p className={cn(
              'ml-9 text-sm text-muted-foreground mt-1',
              issues.sideDisabled && 'line-through'
            )}>
              c/ {order.sideNombre.toLowerCase()}
            </p>
          )}

          {/* Aviso de cambio en el pedido — visible solo si hay issue */}
          {issues.hasAny && (
            <div className="mt-4 p-3 rounded-md border border-warning/50 bg-warning/10 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <p className="font-semibold uppercase tracking-brand text-foreground mb-1">
                  Tu pedido tiene un cambio
                </p>
                <p className="text-muted-foreground">
                  {issues.summary}.
                  {canModify
                    ? ' Modificá tu pedido antes del corte para elegir otra opción.'
                    : ' Tu pedido ya fue cerrado — el chef va a hacer su mejor reemplazo.'}
                </p>
              </div>
            </div>
          )}
          {order.notas && (
            <div className="ml-9 mt-3 pl-3 border-l-2 border-primary/40">
              <p className="text-[10px] uppercase tracking-brand text-primary/70 font-bold">
                Notas
              </p>
              <p className="text-sm italic text-foreground mt-0.5">"{order.notas}"</p>
            </div>
          )}
        </section>

        {/* ── Acciones / Status ────────────────────────────────── */}
        <DashedDivider />
        {canModify ? (
          <section className="mt-5 space-y-4">
            <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
              Podés editar o cancelar hasta las{' '}
              <strong className="text-foreground">{cutoffTime}</strong>
              <br />
              <span className="text-primary font-medium">
                Te quedan {remaining}
              </span>
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onEdit}
                disabled={cancelling}
                size="sm"
                className="flex-1 uppercase tracking-brand font-medium text-xs border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
              >
                <Pencil className="w-3 h-3 mr-1.5" />
                Modificar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    disabled={cancelling}
                    size="sm"
                    className="flex-1 uppercase tracking-brand font-medium text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <X className="w-3 h-3 mr-1.5" />
                    {cancelling ? 'Cancelando…' : 'Cancelar'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="sm:max-w-xl">
                  <div className="flex items-center gap-5 sm:gap-6">
                    {/* Texto + botones a la IZQUIERDA */}
                    <div className="flex-1 min-w-0">
                      <AlertDialogHeader className="text-left space-y-2">
                        <AlertDialogTitle className="font-display text-2xl text-left">
                          ¿Cancelar pedido?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm leading-relaxed text-left">
                          Podés volver a pedir antes de {cutoffTime}.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="mt-5 flex-row gap-2 sm:justify-start">
                        <AlertDialogCancel
                          disabled={cancelling}
                          className="uppercase tracking-brand text-xs mt-0"
                        >
                          No, dejarlo
                        </AlertDialogCancel>
                        <AlertDialogAction
                          disabled={cancelling}
                          onClick={(e) => {
                            // Mantenemos el dialog abierto hasta que termine la mutation;
                            // si la API falla, el usuario ve el error en lugar de
                            // un dialog que se cierra y "no hace nada"
                            e.preventDefault();
                            void handleCancel();
                          }}
                          className="uppercase tracking-brand text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {cancelling ? 'Cancelando…' : 'Sí, cancelar'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </div>

                    {/* Panadero a la DERECHA — mira hacia la izquierda, hacia el texto */}
                    <img
                      src={panaderoDuda}
                      alt=""
                      aria-hidden="true"
                      className="hidden sm:block w-32 lg:w-36 h-auto shrink-0 select-none pointer-events-none"
                    />
                  </div>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </section>
        ) : (
          <section className="mt-5">
            <p className="text-xs text-center text-muted-foreground">
              Pedido cerrado. Ya no se puede modificar.
            </p>
          </section>
        )}

      </div>
      </div>
    </div>
  );
}

/** Etiqueta pequeña en rojo brand para cada sección del papel */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-brand text-primary font-bold">
      {children}
    </p>
  );
}

/** Separador con línea punteada roja sutil */
function DashedDivider() {
  return (
    <div className="border-t border-dashed border-primary/30" aria-hidden="true" />
  );
}
