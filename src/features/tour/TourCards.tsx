import { useId } from "react";
import { FINAL_ILLUSTRATION, WELCOME_ILLUSTRATION } from "./characters";

/** Cuadro centrado sobre una capa oscura que bloquea toda la pantalla. */
function CardFrame({
  titleId,
  children,
}: {
  titleId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[calc(100dvh-48px)] w-full max-w-sm flex-col items-center gap-3 overflow-x-hidden overflow-y-auto rounded-2xl bg-card px-[22px] pb-[22px] pt-6 text-center shadow-[0_16px_40px_rgba(26,17,15,0.35)]"
      >
        {children}
      </div>
    </div>
  );
}

const PRIMARY_BUTTON =
  "h-[54px] w-full self-stretch rounded-md bg-primary-deep text-sm font-bold uppercase tracking-brand text-primary-foreground";

/** Piezas de colores que caen alrededor del personaje: solo decoración, quietas con movimiento reducido. */
const CONFETTI = [
  {
    left: "8%",
    top: "10%",
    color: "bg-primary",
    delay: "0s",
    rotate: "rotate-12",
  },
  {
    left: "22%",
    top: "4%",
    color: "bg-warning",
    delay: "0.3s",
    rotate: "-rotate-12",
  },
  {
    left: "40%",
    top: "2%",
    color: "bg-primary-deep",
    delay: "0.6s",
    rotate: "rotate-45",
  },
  {
    left: "62%",
    top: "0%",
    color: "bg-success",
    delay: "0.15s",
    rotate: "rotate-12",
  },
  {
    left: "80%",
    top: "8%",
    color: "bg-warning",
    delay: "0.45s",
    rotate: "-rotate-45",
  },
  {
    left: "90%",
    top: "28%",
    color: "bg-primary",
    delay: "0.75s",
    rotate: "rotate-45",
  },
  {
    left: "2%",
    top: "32%",
    color: "bg-success",
    delay: "0.9s",
    rotate: "-rotate-12",
  },
];

interface WelcomeProps {
  title: string;
  text: string;
  onStart: () => void;
  onSkip: () => void;
}

/** Primer cuadro del tour: el regalo, centrado, sin señalar nada. */
export function TourWelcomeCard({
  title,
  text,
  onStart,
  onSkip,
}: WelcomeProps) {
  const titleId = useId();
  return (
    <CardFrame titleId={titleId}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-36"
      >
        {CONFETTI.map((piece, i) => (
          <span
            key={i}
            className={`tour-confetti absolute h-2.5 w-1.5 rounded-[2px] ${piece.color} ${piece.rotate}`}
            style={{
              left: piece.left,
              top: piece.top,
              animationDelay: piece.delay,
            }}
          />
        ))}
      </div>
      <img
        src={WELCOME_ILLUSTRATION}
        alt=""
        aria-hidden="true"
        className="h-[150px] w-[178px] shrink-0 select-none object-contain"
      />
      <span className="inline-flex h-7 items-center rounded-full bg-primary-deep px-3 text-[11px] font-bold uppercase tracking-brand text-primary-foreground">
        De parte de Arias
      </span>
      <h2
        id={titleId}
        className="m-0 text-[30px] font-bold leading-[1.1] text-foreground"
      >
        {title}
      </h2>
      <p className="m-0 text-[15px] leading-relaxed text-muted-foreground">
        {text}
      </p>
      <button
        type="button"
        autoFocus
        onClick={onStart}
        className={`${PRIMARY_BUTTON} mt-1.5`}
      >
        Empezar
      </button>
      <button
        type="button"
        onClick={onSkip}
        className="h-11 px-1 text-[13px] font-semibold text-muted-foreground underline"
      >
        Saltar tour
      </button>
    </CardFrame>
  );
}

interface FinalProps {
  title: string;
  text: string;
  /** Sin platos para pedir no hay nada que confirmar: se cierra con "Entendido". */
  canOrder: boolean;
  onConfirmOrder: () => void;
  onBrowseMenu: () => void;
  onPrev: () => void;
}

/** Último cuadro del tour. */
export function TourFinalCard({
  title,
  text,
  canOrder,
  onConfirmOrder,
  onBrowseMenu,
  onPrev,
}: FinalProps) {
  const titleId = useId();
  return (
    <CardFrame titleId={titleId}>
      <img
        src={FINAL_ILLUSTRATION}
        alt=""
        aria-hidden="true"
        className="h-[130px] w-[134px] shrink-0 select-none object-contain"
      />
      <h2
        id={titleId}
        className="m-0 text-[26px] font-bold leading-[1.15] text-foreground"
      >
        {title}
      </h2>
      <p className="m-0 text-sm leading-relaxed text-muted-foreground">
        {text}
      </p>
      <button
        type="button"
        onClick={canOrder ? onConfirmOrder : onBrowseMenu}
        className={`${PRIMARY_BUTTON} mt-1.5`}
      >
        {canOrder ? "Ir a confirmar mi pedido" : "Entendido"}
      </button>
      <div className="flex w-full justify-between">
        <button
          type="button"
          onClick={onPrev}
          className="h-11 px-1 text-[13px] font-semibold text-muted-foreground"
        >
          Anterior
        </button>
        {canOrder && (
          <button
            type="button"
            onClick={onBrowseMenu}
            className="h-11 px-1 text-[13px] font-bold text-primary-deep underline"
          >
            Seguir mirando el menú
          </button>
        )}
      </div>
    </CardFrame>
  );
}
