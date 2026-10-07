import { useEffect, useId, useRef, useState } from "react";
import { Pointer } from "lucide-react";
import { cn } from "@/lib/utils";
import { GUIDES } from "./characters";
import { computeCutout, placeTooltip, type Viewport } from "./tourGeometry";
import type { TourSpotStep } from "./tourSteps";
import { useTargetRect } from "./useTargetRect";

interface Props {
  step: TourSpotStep;
  counter: { position: number; total: number } | null;
  canGoBack: boolean;
  /** Tiempo que se espera a que aparezca el elemento antes de avisar que falta. */
  targetTimeoutMs: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onTargetMissing: () => void;
}

function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  useEffect(() => {
    const onResize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return viewport;
}

const DIM = "hsl(var(--foreground) / 0.62)";
const PANE = "pointer-events-auto fixed";

/**
 * Capa del tour sobre un elemento real: oscurece la pantalla con un recorte
 * redondeado, bloquea los toques fuera del recorte (cuatro paneles) y deja
 * pasar los del recorte en los pasos "tocá acá"; el globito lleva al personaje.
 * Está por encima de las hojas de Radix (z-50), que además ponen
 * `pointer-events: none` en el resto de la página: por eso cada panel lo
 * reactiva.
 */
export function TourSpotlight({
  step,
  counter,
  canGoBack,
  targetTimeoutMs,
  onNext,
  onPrev,
  onSkip,
  onTargetMissing,
}: Props) {
  const rect = useTargetRect(step.target, step.scroll);
  const viewport = useViewport();
  const titleId = useId();
  const textId = useId();
  const [root, setRoot] = useState<HTMLDivElement | null>(null);

  // Si el elemento no aparece (menú vacío, pantalla distinta), el tour sigue solo.
  const missingRef = useRef(onTargetMissing);
  useEffect(() => {
    missingRef.current = onTargetMissing;
  });
  const present = rect !== null;
  useEffect(() => {
    if (present) return;
    const timer = setTimeout(() => missingRef.current(), targetTimeoutMs);
    return () => clearTimeout(timer);
  }, [present, step.id, targetTimeoutMs]);

  // El scroll con la rueda o el dedo sobre la capa no debe mover la página de atrás.
  // Depende de `root`: la capa recién existe cuando aparece el elemento.
  useEffect(() => {
    if (!root) return;
    const stop = (event: Event) => {
      if ((event.target as Element).hasAttribute?.("data-tour-block"))
        event.preventDefault();
    };
    root.addEventListener("wheel", stop, { passive: false });
    root.addEventListener("touchmove", stop, { passive: false });
    return () => {
      root.removeEventListener("wheel", stop);
      root.removeEventListener("touchmove", stop);
    };
  }, [root]);

  if (!rect) {
    // Mientras el elemento no está, un bloqueo transparente evita toques sueltos.
    return (
      <div
        data-tour-block
        className="pointer-events-auto fixed inset-0 z-[100]"
      />
    );
  }

  const cut = computeCutout(rect, viewport, step.radius);
  const place = placeTooltip(cut, viewport);
  const tap = step.mode === "tap";
  const guide = GUIDES[step.guide];
  const needFacing = place.charOnLeft ? "right" : "left";
  const mirrored = guide.face !== "none" && guide.face !== needFacing;

  // La raíz no capta toques: si no, taparía el recorte; los paneles sí.
  return (
    <div ref={setRoot} className="pointer-events-none fixed inset-0 z-[100]">
      <div
        data-tour-block
        className={PANE}
        style={{ left: 0, top: 0, width: "100%", height: cut.top }}
      />
      <div
        data-tour-block
        className={PANE}
        style={{ left: 0, top: cut.bottom, width: "100%", bottom: 0 }}
      />
      <div
        data-tour-block
        className={PANE}
        style={{ left: 0, top: cut.top, width: cut.left, height: cut.height }}
      />
      <div
        data-tour-block
        className={PANE}
        style={{ left: cut.right, top: cut.top, right: 0, height: cut.height }}
      />

      {/* Recorte: la sombra enorme es la capa oscura; en los pasos "tocá" lleva un aro rojo. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed transition-[left,top,width,height] duration-200 ease-out motion-reduce:transition-none"
        style={{
          left: cut.left,
          top: cut.top,
          width: cut.width,
          height: cut.height,
          borderRadius: cut.radius,
          boxShadow: tap
            ? `0 0 0 3px hsl(var(--card)), 0 0 0 6px hsl(var(--primary)), 0 0 0 4000px ${DIM}`
            : `0 0 0 3px hsl(var(--card)), 0 0 0 4000px ${DIM}`,
        }}
      />

      {/* En los pasos informativos el elemento se ve pero no se toca. */}
      {step.mode === "info" && (
        <div
          data-tour-block
          className="pointer-events-auto fixed"
          style={{
            left: cut.left,
            top: cut.top,
            width: cut.width,
            height: cut.height,
          }}
        />
      )}

      <div
        className="pointer-events-none fixed"
        style={{
          left: place.left,
          width: place.width,
          top: place.top,
          bottom: place.bottom,
        }}
      >
        <div
          role="dialog"
          aria-labelledby={titleId}
          aria-describedby={textId}
          aria-live="polite"
          className={cn(
            "pointer-events-auto relative flex items-center gap-2 rounded-2xl bg-card p-3.5 shadow-[0_10px_30px_rgba(26,17,15,0.35)]",
            place.charOnLeft ? "flex-row" : "flex-row-reverse",
          )}
        >
          <span
            aria-hidden="true"
            className="absolute h-3.5 w-3.5 rotate-45 bg-card"
            style={{
              left: place.arrowLeft,
              top: place.below ? -7 : undefined,
              bottom: place.below ? undefined : -7,
            }}
          />
          <span
            className={cn(
              "block h-24 w-16 shrink-0",
              mirrored && "-scale-x-100",
            )}
          >
            <img
              key={step.id}
              src={guide.src}
              alt=""
              aria-hidden="true"
              className="tour-hop h-full w-full select-none object-contain"
            />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-brand text-muted-foreground">
                {counter ? `${counter.position} de ${counter.total}` : ""}
              </span>
              <button
                type="button"
                onClick={onSkip}
                className="min-h-8 px-0.5 text-[12.5px] font-semibold text-muted-foreground underline"
              >
                Saltar tour
              </button>
            </div>
            <h2
              id={titleId}
              className="m-0 text-lg font-bold leading-tight text-foreground"
            >
              {step.title}
            </h2>
            <p
              id={textId}
              className="m-0 text-[13.5px] leading-snug text-foreground"
            >
              {step.text}
            </p>
            {tap && (
              <span className="inline-flex h-7 items-center gap-1.5 self-start rounded-full bg-primary-deep px-2.5 text-xs font-bold text-primary-foreground">
                <Pointer className="h-[15px] w-[15px]" aria-hidden="true" />
                Tocá acá para seguir
              </span>
            )}
            {step.mode === "try" && (
              <span className="text-xs font-semibold text-muted-foreground">
                Probalo, o seguí con Siguiente.
              </span>
            )}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <button
                type="button"
                onClick={onPrev}
                disabled={!canGoBack}
                className="h-10 rounded-md border-[1.5px] border-border px-3 text-[13px] font-semibold text-foreground disabled:opacity-40"
              >
                Anterior
              </button>
              {!tap && (
                <button
                  type="button"
                  onClick={onNext}
                  className="h-10 rounded-md bg-primary-deep px-4 text-[13px] font-bold uppercase tracking-[0.08em] text-primary-foreground"
                >
                  Siguiente
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
