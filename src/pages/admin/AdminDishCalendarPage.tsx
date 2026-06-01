import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  getDishCalendar, getSpecialDishes, setDishCalendarForDate,
  type AdminDish,
} from '@/features/admin/services/adminApi';

// ─── Constantes ───────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ─── Helpers de fechas ────────────────────────────────────────────────

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/**
 * Devuelve el primer lunes ≤ a la fecha dada (si es lunes, devuelve la misma).
 * getDay() devuelve 0 = domingo … 6 = sábado. Mapeamos a lunes-base.
 */
function startOfWeekMonday(d: Date): Date {
  const dow = d.getDay(); // 0..6
  const offset = (dow + 6) % 7; // domingo→6, lunes→0, martes→1...
  return addDays(d, -offset);
}

/**
 * Devuelve las semanas (mon-fri) que cubren el mes dado.
 * Cada semana es un array de 5 fechas. Las celdas que caen fuera del mes se incluyen
 * pero se renderizan en estado muted.
 */
function weeksOfMonth(year: number, month: number): Date[][] {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  const start = startOfWeekMonday(firstOfMonth);
  const weeks: Date[][] = [];

  let cursor = start;
  while (cursor <= lastOfMonth || cursor.getMonth() === month) {
    const week: Date[] = [];
    for (let i = 0; i < 5; i++) {
      week.push(addDays(cursor, i));
    }
    weeks.push(week);
    cursor = addDays(cursor, 7);

    // Safety: nunca más de 6 semanas
    if (weeks.length >= 6) break;
  }
  return weeks;
}

// ─── Página ───────────────────────────────────────────────────────────

export function AdminDishCalendarPage() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Rango visible para el empleado: lunes de esta semana hasta viernes de la próxima
  const employeeWindowStart = useMemo(() => startOfWeekMonday(today), [today]);
  const employeeWindowEnd = useMemo(() => addDays(employeeWindowStart, 11), [employeeWindowStart]);

  const weeks = useMemo(
    () => weeksOfMonth(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  );

  // Rango de fechas a pedirle al back: desde el primer lunes hasta el último viernes mostrado.
  const fromIso = toIso(weeks[0][0]);
  const toIsoStr = toIso(weeks[weeks.length - 1][4]);

  const { data: calendar, isLoading: loadingCalendar } = useQuery({
    queryKey: ['dishCalendar', fromIso, toIsoStr],
    queryFn: () => getDishCalendar(fromIso, toIsoStr),
  });

  const goPrev = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const goNext = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  const goToday = () => setCursor(new Date(today.getFullYear(), today.getMonth(), 1));

  const monthLabel = `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-5 h-5 text-primary" />
            <h1 className="font-display text-foreground text-3xl lg:text-4xl font-bold leading-tight">
              Calendario de especiales
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Asigná qué platos especiales aparecen cada día. Solo se muestran de lunes a viernes.
          </p>
        </div>
      </header>

      {/* ── Navegación de mes ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={goPrev}
            aria-label="Mes anterior"
            className="h-9 w-9"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="font-display text-xl text-foreground min-w-[180px] text-center capitalize">
            {monthLabel}
          </h2>
          <Button
            variant="outline"
            size="icon"
            onClick={goNext}
            aria-label="Mes siguiente"
            className="h-9 w-9"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={goToday}
          className="uppercase tracking-brand text-xs"
        >
          Hoy
        </Button>
      </div>

      {/* ── Calendario ─────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {/* Headers de la semana */}
        <div className="grid grid-cols-5 border-b border-border bg-muted/30">
          {WEEKDAY_LABELS.map((d) => (
            <div
              key={d}
              className="px-3 py-2 text-[11px] uppercase tracking-brand font-medium text-muted-foreground text-center"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Filas (semanas) */}
        <div className="divide-y divide-border">
          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-5 divide-x divide-border">
              {week.map((day) => (
                <DayCell
                  key={toIso(day)}
                  day={day}
                  currentMonth={cursor.getMonth()}
                  today={today}
                  inEmployeeWindow={day >= employeeWindowStart && day <= employeeWindowEnd}
                  count={(calendar?.[toIso(day)] ?? []).length}
                  loading={loadingCalendar}
                  onClick={() => {
                    if (!loadingCalendar) setSelectedDate(day);
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Leyenda ───────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-green-100/60 border border-green-400/40 dark:bg-green-900/20" />
          Días visibles para el empleado
        </span>
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-warning" />
          Sin especiales asignados
        </span>
        <span className="flex items-center gap-1.5">
          <Badge className="bg-primary text-primary-foreground uppercase tracking-brand text-[9px] px-1.5 py-0">3</Badge>
          Cantidad de platos especiales
        </span>
      </div>

      <DayDishesDialog
        date={selectedDate}
        currentIds={selectedDate ? (calendar?.[toIso(selectedDate)] ?? []) : []}
        inEmployeeWindow={
          selectedDate
            ? selectedDate >= employeeWindowStart && selectedDate <= employeeWindowEnd
            : false
        }
        onClose={() => setSelectedDate(null)}
      />
    </div>
  );
}

// ─── Celda del día ────────────────────────────────────────────────────

interface DayCellProps {
  day: Date;
  currentMonth: number;
  today: Date;
  inEmployeeWindow: boolean;
  count: number;
  loading: boolean;
  onClick: () => void;
}

function DayCell({ day, currentMonth, today, inEmployeeWindow, count, loading, onClick }: DayCellProps) {
  const inMonth = day.getMonth() === currentMonth;
  const isPast = day < today;
  const isToday = day.getTime() === today.getTime();
  const isFuture = day > today;
  const shouldWarn = (isToday || isFuture) && count === 0 && inMonth;
  const isClickable = inMonth && !isPast && !loading;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      className={cn(
        'relative min-h-[110px] p-3 text-left transition-colors',
        'flex flex-col gap-2',
        !inMonth && 'bg-muted/10 text-muted-foreground/40 cursor-default',
        inMonth && isPast && 'bg-muted/20 cursor-not-allowed',
        isClickable && !inEmployeeWindow && 'bg-background hover:bg-muted/30 cursor-pointer',
        isClickable && inEmployeeWindow && 'bg-green-100/60 hover:bg-green-100 cursor-pointer dark:bg-green-900/20 dark:hover:bg-green-900/30',
        isToday && inMonth && 'ring-2 ring-primary ring-inset',
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'font-display text-2xl leading-none',
            inMonth
              ? isPast
                ? 'text-muted-foreground/60'
                : 'text-foreground'
              : 'text-muted-foreground/40',
            isToday && 'text-primary font-bold',
          )}
        >
          {day.getDate()}
        </span>
        {shouldWarn && !loading && (
          <AlertTriangle
            className="w-4 h-4 text-warning shrink-0"
            aria-label="Sin especiales asignados"
          />
        )}
      </div>

      {inMonth && count > 0 && (
        <Badge className="bg-primary text-primary-foreground uppercase tracking-brand text-[10px] px-1.5 py-0 self-start">
          {count} {count === 1 ? 'especial' : 'especiales'}
        </Badge>
      )}
    </button>
  );
}

// ─── Modal: asignar especiales a una fecha ────────────────────────────

interface DialogProps {
  date: Date | null;
  currentIds: number[];
  inEmployeeWindow: boolean;
  onClose: () => void;
}

function DayDishesDialog({ date, currentIds, inEmployeeWindow, onClose }: DialogProps) {
  const queryClient = useQueryClient();
  const isoDate = date ? toIso(date) : null;
  const open = !!date;

  const { data: specials, isLoading } = useQuery({
    queryKey: ['specialDishes'],
    queryFn: getSpecialDishes,
    enabled: open,
  });

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [pendingRemoveIds, setPendingRemoveIds] = useState<number[] | null>(null);

  // Cuando cambia el día seleccionado, sincronizamos la selección con lo que viene del back
  useEffect(() => {
    setSelected(new Set(currentIds));
    setSearch('');
    setPendingRemoveIds(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isoDate]);

  const filteredSpecials = useMemo(() => {
    if (!specials) return [];
    const q = search.trim().toLowerCase();
    if (!q) return specials;
    return specials.filter((d) => d.nombre.toLowerCase().includes(q));
  }, [specials, search]);

  const selectedDishes = useMemo(() => {
    if (!specials) return [];
    return specials.filter((d) => selected.has(d.id));
  }, [specials, selected]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!isoDate) return Promise.resolve();
      return setDishCalendarForDate(isoDate, Array.from(selected));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dishCalendar'] });
      toast.success('Especiales actualizados');
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'No se pudo guardar');
    },
  });

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaveClick = () => {
    const removed = currentIds.filter((id) => !selected.has(id));
    if (removed.length > 0 && inEmployeeWindow) {
      setPendingRemoveIds(removed);
      return;
    }
    mutation.mutate();
  };

  const removedDishNames = useMemo(() => {
    if (!pendingRemoveIds || !specials) return [];
    return pendingRemoveIds.map((id) => {
      const dish = specials.find((d) => d.id === id);
      return dish?.nombre ?? `Plato #${id}`;
    });
  }, [pendingRemoveIds, specials]);

  const dayLabel = date
    ? date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl capitalize">
            Especiales del {dayLabel}
          </DialogTitle>
          <DialogDescription>
            Marcá los platos especiales que querés que aparezcan ese día.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {isLoading && (
            <p className="text-xs text-muted-foreground uppercase tracking-brand py-6 text-center">
              Cargando especiales…
            </p>
          )}

          {!isLoading && (!specials || specials.length === 0) && (
            <div className="text-center py-6 border border-dashed border-border rounded-lg">
              <p className="text-sm text-muted-foreground">
                No hay platos especiales creados todavía.
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Creá uno desde "Platos" y marcalo como especial.
              </p>
            </div>
          )}

          {!isLoading && specials && specials.length > 0 && (
            <>
              {selectedDishes.length > 0 && (
                <div className="bg-muted/30 border border-border rounded-md p-2.5 space-y-1.5">
                  <p className="text-[10px] uppercase tracking-brand text-muted-foreground font-medium">
                    Seleccionados ({selectedDishes.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDishes.map((dish) => (
                      <button
                        key={dish.id}
                        type="button"
                        onClick={() => toggle(dish.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary text-primary-foreground text-[11px] hover:bg-primary/90 transition-colors"
                      >
                        <span>{dish.nombre}</span>
                        <X className="w-3 h-3 opacity-70" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar plato..."
                  value={search}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>

              <ul className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
                {filteredSpecials.length === 0 ? (
                  <li className="text-center py-4 text-xs text-muted-foreground">
                    No hay platos que coincidan con "{search}".
                  </li>
                ) : (
                  filteredSpecials.map((dish: AdminDish) => {
                    const checked = selected.has(dish.id);
                    return (
                      <li key={dish.id}>
                        <label
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors',
                            checked
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50',
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggle(dish.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {dish.nombre}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {dish.menuSection.nombre} · {dish.category.nombre}
                            </p>
                          </div>
                        </label>
                      </li>
                    );
                  })
                )}
              </ul>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSaveClick}
            disabled={mutation.isPending || isLoading}
            className="uppercase tracking-brand"
          >
            {mutation.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog
        open={pendingRemoveIds !== null}
        onOpenChange={(next) => {
          if (!next) setPendingRemoveIds(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl">
              ¿Quitar estos especiales del día?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Estás por dejar fuera del calendario:
                </p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {removedDishNames.map((name, i) => (
                    <li key={i} className="text-foreground font-medium">{name}</li>
                  ))}
                </ul>
                <p>
                  Si algún empleado ya tiene un pedido programado con alguno de
                  estos platos para esa fecha, <strong>se cancelará automáticamente</strong>{' '}
                  y le va a llegar un mail avisándole.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={mutation.isPending}
              className="uppercase tracking-brand text-xs"
            >
              Volver
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                setPendingRemoveIds(null);
                mutation.mutate();
              }}
              className="uppercase tracking-brand text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {mutation.isPending ? 'Guardando…' : 'Sí, quitar y avisar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
