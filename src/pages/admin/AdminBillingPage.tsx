import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { AlertTriangle, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  getBilling, type CompanyBilling, type DailyTotal,
} from '@/features/admin/services/billingApi';
import { listCompanies } from '@/features/admin/services/adminApi';
import { cn } from '@/lib/utils';

/** Valor centinela del selector: Radix Select no acepta value="" en un item. */
const TODAS = 'TODAS';

/**
 * Fecha → "YYYY-MM-DD" en horario LOCAL.
 *
 * Ojo: toISOString() convierte a UTC y en Argentina (UTC-3) devuelve el día
 * anterior para cualquier hora antes de las 21:00. Eso correría el período
 * de facturación un día entero.
 */
function toISODate(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Lunes a domingo de la semana ya cerrada — el caso de uso por defecto. */
function semanaPasada(): { desde: string; hasta: string } {
  const hoy = new Date();
  const diasDesdeLunes = (hoy.getDay() + 6) % 7; // getDay(): domingo = 0
  const lunesEstaSemana = new Date(hoy);
  lunesEstaSemana.setDate(hoy.getDate() - diasDesdeLunes);

  const lunes = new Date(lunesEstaSemana);
  lunes.setDate(lunesEstaSemana.getDate() - 7);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  return { desde: toISODate(lunes), hasta: toISODate(domingo) };
}

function semanaActual(): { desde: string; hasta: string } {
  const hoy = new Date();
  const diasDesdeLunes = (hoy.getDay() + 6) % 7;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - diasDesdeLunes);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  return { desde: toISODate(lunes), hasta: toISODate(domingo) };
}

function mesActual(): { desde: string; hasta: string } {
  const hoy = new Date();
  const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  return { desde: toISODate(primero), hasta: toISODate(ultimo) };
}

const money = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

/** Compacto para el eje Y: $96.000 → "96k". Los montos exactos van en la tabla. */
const moneyCorto = (n: number) =>
  n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);

const fechaCorta = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** "2026-05-22" → "jue 22/5". El T00:00:00 evita que se parsee como UTC. */
const fechaConDia = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${DIAS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
};

export function AdminBillingPage() {
  const [rango, setRango] = useState(semanaPasada);
  // Estado del form separado del rango aplicado: la query no se dispara
  // en cada tecla mientras el admin escribe una fecha.
  const [form, setForm] = useState(rango);
  const [empresa, setEmpresa] = useState<string>(TODAS);

  const { data: empresas } = useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
  });

  const companyId = empresa === TODAS ? null : Number(empresa);
  const nombreEmpresaFiltrada =
    companyId == null ? null : empresas?.find((c) => c.id === companyId)?.nombre ?? null;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['adminBilling', rango.desde, rango.hasta, companyId],
    queryFn: () => getBilling(rango.desde, rango.hasta, companyId),
  });

  const aplicarPreset = (r: { desde: string; hasta: string }) => {
    setForm(r);
    setRango(r);
  };

  const presetActivo = (r: { desde: string; hasta: string }) =>
    rango.desde === r.desde && rango.hasta === r.hasta;

  return (
    <div className="p-6 lg:p-10">
      <header className="mb-8">
        <h1 className="font-display text-foreground text-3xl lg:text-4xl font-bold leading-tight mb-1">
          Facturación
        </h1>
        <p className="text-muted-foreground text-sm">
          Pedidos servidos por empresa, al precio acordado en el momento de cada pedido.
        </p>
      </header>

      {/* ─── Selector de período ─────────────────────────────────────── */}
      <section className="bg-card border-border mb-8 rounded-xl border p-4 lg:p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            { label: 'Semana pasada', rango: semanaPasada() },
            { label: 'Semana actual', rango: semanaActual() },
            { label: 'Mes actual', rango: mesActual() },
          ].map((p) => (
            <Button
              key={p.label}
              variant={presetActivo(p.rango) ? 'default' : 'outline'}
              size="sm"
              onClick={() => aplicarPreset(p.rango)}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <form
          className="flex flex-wrap items-end gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setRango(form);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="desde">Desde</Label>
            <Input
              id="desde"
              type="date"
              value={form.desde}
              max={form.hasta}
              onChange={(e) => setForm({ ...form, desde: e.target.value })}
              className="w-44"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hasta">Hasta</Label>
            <Input
              id="hasta"
              type="date"
              value={form.hasta}
              min={form.desde}
              onChange={(e) => setForm({ ...form, hasta: e.target.value })}
              className="w-44"
            />
          </div>

          {/* El filtro NO espera al botón: cambiar de empresa re-consulta solo. */}
          <div className="space-y-1.5">
            <Label htmlFor="empresa">Empresa</Label>
            <Select value={empresa} onValueChange={setEmpresa}>
              <SelectTrigger id="empresa" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todas las empresas</SelectItem>
                {empresas?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit">Aplicar</Button>
        </form>
      </section>

      {isLoading && (
        <p className="text-muted-foreground text-sm">Calculando…</p>
      )}

      {isError && (
        <p className="text-destructive text-sm">
          {error instanceof Error ? error.message : 'No se pudo cargar la facturación'}
        </p>
      )}

      {data && (
        <>
          {/* ─── Resumen del período ───────────────────────────────────── */}
          <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-card border-border rounded-xl border p-5">
              <p className="text-muted-foreground mb-1 text-xs uppercase tracking-wide">
                Total a facturar
              </p>
              <p className="font-display text-foreground text-3xl font-bold">
                {money(data.totalGeneral)}
              </p>
            </div>
            <div className="bg-card border-border rounded-xl border p-5">
              <p className="text-muted-foreground mb-1 text-xs uppercase tracking-wide">
                Pedidos servidos
              </p>
              <p className="font-display text-foreground text-3xl font-bold">
                {data.totalPedidos}
              </p>
            </div>
            <div className="bg-card border-border rounded-xl border p-5">
              <p className="text-muted-foreground mb-1 text-xs uppercase tracking-wide">
                Promedio por pedido
              </p>
              <p className="font-display text-foreground text-3xl font-bold">
                {data.totalPedidos > 0
                  ? money(Math.round(data.totalGeneral / data.totalPedidos))
                  : '—'}
              </p>
            </div>
            <div className="bg-card border-border rounded-xl border p-5">
              <p className="text-muted-foreground mb-1 text-xs uppercase tracking-wide">
                Período
              </p>
              <p className="text-foreground pt-2 text-sm font-medium">
                {fechaCorta(data.desde)} — {fechaCorta(data.hasta)}
              </p>
              {/* Sin esto, un total filtrado se lee como si fuera el global. */}
              <p className="text-muted-foreground mt-1 text-xs">
                {nombreEmpresaFiltrada ?? 'Todas las empresas'}
              </p>
            </div>
          </section>

          {/* Comida servida que no se está cobrando. Silenciarla sería peor. */}
          {data.pedidosSinTarifa > 0 && (
            <div className="border-destructive/40 bg-destructive/10 mb-8 flex items-start gap-3 rounded-xl border p-4">
              <AlertTriangle className="text-destructive mt-0.5 size-5 shrink-0" />
              <div className="text-sm">
                <p className="text-foreground font-semibold">
                  {data.pedidosSinTarifa} pedido{data.pedidosSinTarifa === 1 ? '' : 's'} sin tarifa acordada
                </p>
                <p className="text-muted-foreground">
                  Se sirvieron pero no suman al total. Cargá el precio de esa categoría en la
                  empresa para que los pedidos futuros se facturen.
                </p>
              </div>
            </div>
          )}

          {data.porDia.length > 0 && <DailyBreakdown dias={data.porDia} />}

          {data.empresas.length === 0 ? (
            <div className="border-border text-muted-foreground rounded-xl border border-dashed p-10 text-center">
              <Receipt className="mx-auto mb-3 size-8 opacity-40" />
              <p className="text-sm">
                {nombreEmpresaFiltrada
                  ? `${nombreEmpresaFiltrada} no tiene pedidos servidos en este período.`
                  : 'No hay pedidos servidos en este período.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.empresas.map((empresa) => (
                <CompanyCard key={empresa.companyId} empresa={empresa} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Evolución diaria de la facturación.
 *
 * Una sola serie (el monto). La cantidad de pedidos va al tooltip y a la tabla,
 * NO como segundo eje Y: monto y unidades son escalas distintas y un gráfico de
 * doble eje deja comparar cosas que no son comparables.
 *
 * Solo aparecen los días con pedidos — un hueco entre fechas ES el dato.
 */
function DailyBreakdown({ dias }: { dias: DailyTotal[] }) {
  const pico = dias.reduce((a, d) => (d.total > a.total ? d : a), dias[0]);

  return (
    <section className="bg-card border-border mb-8 rounded-xl border p-5 lg:p-6">
      <header className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-foreground text-xl font-bold">Por día</h2>
          <p className="text-muted-foreground text-sm">
            Facturación diaria · {dias.length} día{dias.length === 1 ? '' : 's'} con pedidos
          </p>
        </div>
        <p className="text-muted-foreground text-sm">
          Pico: <span className="text-foreground font-medium">{fechaConDia(pico.fecha)}</span>
          {' · '}{money(pico.total)}
        </p>
      </header>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={dias} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          {/* Grid recesivo: guía la lectura, no compite con las barras. */}
          <CartesianGrid
            vertical={false}
            stroke="hsl(var(--border))"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="fecha"
            tickFormatter={fechaConDia}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={moneyCorto}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.35 }}
            labelFormatter={(v) => (typeof v === 'string' ? fechaConDia(v) : '')}
            formatter={(value, _name, item) => {
              const dia = item?.payload as DailyTotal | undefined;
              return [
                `${money(Number(value))} · ${dia?.pedidos ?? 0} pedidos`,
                'Facturado',
              ];
            }}
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              color: 'hsl(var(--card-foreground))',
            }}
          />
          {/* Token de marca: cambia solo entre light y dark. */}
          <Bar
            dataKey="total"
            fill="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
            maxBarSize={56}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Los montos exactos, para el que va a facturar de verdad. */}
      <table className="mt-5 w-full text-sm">
        <thead>
          <tr className="text-muted-foreground text-left text-xs uppercase tracking-wide">
            <th className="pb-2 font-medium">Día</th>
            <th className="pb-2 text-right font-medium">Pedidos</th>
            <th className="pb-2 text-right font-medium">Facturado</th>
          </tr>
        </thead>
        <tbody>
          {dias.map((d) => (
            <tr key={d.fecha} className="border-border/60 border-t">
              <td className="py-2">{fechaConDia(d.fecha)}</td>
              <td className="py-2 text-right tabular-nums">{d.pedidos}</td>
              <td className="py-2 text-right font-medium tabular-nums">{money(d.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function CompanyCard({ empresa }: { empresa: CompanyBilling }) {
  return (
    <section className="bg-card border-border rounded-xl border p-5 lg:p-6">
      <header className="border-border mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b pb-4">
        <div>
          <h2 className="font-display text-foreground text-xl font-bold">
            {empresa.companyNombre}
          </h2>
          <p className="text-muted-foreground text-sm">
            {empresa.totalPedidos} pedido{empresa.totalPedidos === 1 ? '' : 's'}
            {empresa.pedidosSinTarifa > 0 && (
              <span className="text-destructive">
                {' '}· {empresa.pedidosSinTarifa} sin tarifa
              </span>
            )}
          </p>
        </div>
        <p className="font-display text-foreground text-2xl font-bold">
          {money(empresa.total)}
        </p>
      </header>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground text-left text-xs uppercase tracking-wide">
            <th className="pb-2 font-medium">Categoría</th>
            <th className="pb-2 text-right font-medium">Cantidad</th>
            <th className="pb-2 text-right font-medium">Precio unit.</th>
            <th className="pb-2 text-right font-medium">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {empresa.lineas.map((linea, i) => (
            <tr
              key={`${linea.categoria}-${linea.precioUnitario}-${i}`}
              className={cn('border-border/60 border-t', linea.sinTarifa && 'text-destructive')}
            >
              <td className="py-2">{linea.categoria}</td>
              <td className="py-2 text-right tabular-nums">{linea.cantidad}</td>
              <td className="py-2 text-right tabular-nums">
                {linea.precioUnitario === null ? '—' : money(linea.precioUnitario)}
              </td>
              <td className="py-2 text-right font-medium tabular-nums">
                {money(linea.subtotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
