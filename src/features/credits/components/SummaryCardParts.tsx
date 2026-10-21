import type { ReactNode } from 'react';

/** Fila superior de las tarjetas-resumen: tile con ícono, nombre + cantidad y el lema a la derecha. */
export function SummaryHeader({
  icon,
  name,
  amount,
  lema,
}: {
  icon: ReactNode;
  name: string;
  amount: string;
  lema: string;
}) {
  return (
    <span className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-deep text-primary-foreground"
      >
        {icon}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="font-display text-[17px] font-bold leading-tight text-foreground">{name}</span>
        <span className="text-[13px] text-muted-foreground">{amount}</span>
      </span>
      <span className="ml-auto shrink-0 self-start pt-0.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-primary-deep">
        {lema}
      </span>
    </span>
  );
}

/** Línea punteada entre la fila superior y los renglones. */
export function SummaryDivider() {
  return <span aria-hidden="true" className="block border-t border-dashed border-border" />;
}

/** Renglón "etiqueta ........ valor" (spans, no `<dl>`: va dentro de un botón). */
export function SummaryRow({
  label,
  value,
  valueClassName = 'font-semibold',
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <span className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={valueClassName}>{value}</span>
    </span>
  );
}
