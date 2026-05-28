import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, ClipboardCheck, Clock, Download, MapPin, Users } from 'lucide-react';
import { getDisabledDates } from '@/features/orders/services/ordersApi';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/alert-dialog';
import {
  exportOrders,
  getOrdersByDate,
  markOrderDelivered,
  markCompanyOrdersDelivered,
  markOrderComandado,
  markCompanyOrdersComandado,
  type AdminOrder,
} from '@/features/admin/services/adminApi';
import { WeekDaySelector } from '@/features/orders/components/WeekDaySelector';
import { cn } from '@/lib/utils';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const formatted = d.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/** Agrupa pedidos primero por hora_entrega, después por empresa */
interface GroupedOrders {
  horaEntrega: string;
  companies: {
    companyId: number;
    companyName: string;
    orders: AdminOrder[];
  }[];
}

function groupOrders(orders: AdminOrder[]): GroupedOrders[] {
  const byHora = new Map<string, Map<number, AdminOrder[]>>();
  for (const o of orders) {
    if (!byHora.has(o.horaEntrega)) byHora.set(o.horaEntrega, new Map());
    const byCompany = byHora.get(o.horaEntrega)!;
    if (!byCompany.has(o.companyId)) byCompany.set(o.companyId, []);
    byCompany.get(o.companyId)!.push(o);
  }
  return Array.from(byHora.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([horaEntrega, companyMap]) => ({
      horaEntrega,
      companies: Array.from(companyMap.values()).map((orders) => ({
        companyId: orders[0].companyId,
        companyName: orders[0].companyName,
        orders,
      })),
    }));
}

export function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const [selectedDate, setSelectedDate] = useState(today);
  const isToday = selectedDate === today;
  const isFuture = selectedDate > today;

  const { data: orders, isLoading } = useQuery({
    queryKey: ['adminOrders', selectedDate],
    queryFn: () => getOrdersByDate(isToday ? undefined : selectedDate),
    refetchInterval: isToday ? 30_000 : false,
  });

  const deliverCompanyMutation = useMutation({
    mutationFn: markCompanyOrdersDelivered,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
      toast.success('Pedidos marcados como entregados');
    },
  });

  const comandarCompanyMutation = useMutation({
    mutationFn: markCompanyOrdersComandado,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
      toast.success('Pedidos comandados');
    },
  });

  const [exportConfirm, setExportConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    if (!isToday) {
      setExportConfirm(true);
    } else {
      doExport();
    }
  };

  const doExport = async () => {
    setExporting(true);
    try {
      await exportOrders(selectedDate);
      toast.success('Excel descargado');
    } catch {
      toast.error('Error al exportar');
    } finally {
      setExporting(false);
      setExportConfirm(false);
    }
  };

  const [deliverConfirm, setDeliverConfirm] = useState<{
    companyId: number;
    companyName: string;
    count: number;
  } | null>(null);

  const { data: disabledDatesData } = useQuery({
    queryKey: ['disabledDates'],
    queryFn: () => getDisabledDates(),
  });

  const disabledDates = useMemo(() => {
    return new Set(disabledDatesData?.map((d) => d.fecha) ?? []);
  }, [disabledDatesData]);

  const orderedDates = useMemo(() => {
    return new Set<string>(orders?.length ? [selectedDate] : []);
  }, [orders, selectedDate]);

  const groups = useMemo(() => (orders ? groupOrders(orders) : []), [orders]);

  const totalOrders = orders?.length ?? 0;
  const totalCompanies = new Set(orders?.map((o) => o.companyId) ?? []).size;
  const pendientes = orders?.filter((o) => o.estado === 'PENDIENTE').length ?? 0;
  const confirmados = orders?.filter((o) => o.estado === 'CONFIRMADO').length ?? 0;
  const comandados = orders?.filter((o) => o.estado === 'COMANDADO').length ?? 0;
  const entregados = orders?.filter((o) => o.estado === 'ENTREGADO').length ?? 0;

  return (
    <div className="p-6 lg:p-10">
      {/* Week selector */}
      <div className="mb-6">
        <WeekDaySelector
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
          orderedDates={orderedDates}
          disabledDates={disabledDates}
        />
      </div>

      {/* Header */}
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-display text-foreground text-3xl lg:text-4xl font-bold leading-tight mb-1">
            {isToday ? 'Pedidos de hoy' : isFuture ? 'Pedidos tentativos' : 'Pedidos'}
          </h1>
          <p className="text-muted-foreground text-sm">{formatDate(selectedDate)}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="uppercase tracking-brand text-[11px]"
          disabled={totalOrders === 0 || exporting}
          onClick={handleExport}
        >
          <Download className="w-3.5 h-3.5 mr-1" />
          {exporting ? 'Exportando...' : 'Exportar Excel'}
        </Button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 lg:gap-4 mb-10">
        <StatCard label="Total" value={totalOrders} />
        <StatCard label="Empresas" value={totalCompanies} icon={Users} />
        <StatCard label="Pendientes" value={pendientes} accent="warning" />
        <StatCard label="Confirmados" value={confirmados} accent="primary" />
        <StatCard label="Comandados" value={comandados} accent="info" />
        <StatCard label="Entregados" value={entregados} accent="success" />
      </div>

      {/* Loading / Vacío */}
      {isLoading && (
        <p className="text-center text-muted-foreground text-sm uppercase tracking-brand py-12">
          Cargando…
        </p>
      )}

      {!isLoading && totalOrders === 0 && (
        <div className="text-center py-20 border border-dashed border-border rounded-lg">
          <p className="font-display text-2xl text-foreground mb-2">
            {isFuture ? 'Sin pedidos programados' : 'Todavía no hay pedidos'}
          </p>
          <p className="text-sm text-muted-foreground">
            {isFuture
              ? 'Los empleados todavía no programaron pedidos para este día.'
              : 'Cuando los empleados empiecen a pedir, los vas a ver acá.'}
          </p>
        </div>
      )}

      {/* Grupos */}
      <div className="space-y-8">
        {groups.map((group) => (
          <section key={group.horaEntrega}>
            <div className="flex items-center gap-3 mb-4 pb-2 border-b-2 border-primary">
              <Clock className="w-5 h-5 text-primary" />
              <h2 className="font-display text-2xl text-foreground font-bold">
                {group.horaEntrega}
              </h2>
              <span className="text-xs uppercase tracking-brand text-muted-foreground">
                Hora de entrega
              </span>
            </div>

            {group.companies.map((company) => {
              const hasConfirmados = company.orders.some((o) => o.estado === 'CONFIRMADO');
              const hasComandados = company.orders.some((o) => o.estado === 'COMANDADO');
              return (
                <div key={company.companyId} className="mb-6 last:mb-0">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-primary" />
                    <h3 className="font-sans text-sm font-semibold uppercase tracking-brand text-foreground">
                      {company.companyName}
                    </h3>
                    <span className="text-[11px] text-muted-foreground">
                      ({company.orders.length} {company.orders.length === 1 ? 'pedido' : 'pedidos'})
                    </span>
                    <div className="ml-auto flex gap-2">
                      {isToday && hasConfirmados && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] uppercase tracking-brand"
                          disabled={comandarCompanyMutation.isPending}
                          onClick={() => comandarCompanyMutation.mutate(company.companyId)}
                        >
                          <ClipboardCheck className="w-3.5 h-3.5 mr-1" />
                          Pedidos comandados
                        </Button>
                      )}
                      {isToday && hasComandados && !hasConfirmados && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] uppercase tracking-brand"
                          disabled={deliverCompanyMutation.isPending}
                          onClick={() => setDeliverConfirm({
                            companyId: company.companyId,
                            companyName: company.companyName,
                            count: company.orders.filter((o) => o.estado === 'COMANDADO').length,
                          })}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Entregar todos
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {company.orders.map((order) => (
                      <OrderCard key={order.id} order={order} actionsEnabled={isToday} />
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div>

      <AlertDialog open={!!deliverConfirm} onOpenChange={(open) => !open && setDeliverConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar entrega</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Tenés los {deliverConfirm?.count} {deliverConfirm?.count === 1 ? 'pedido' : 'pedidos'} para{' '}
              <strong>{deliverConfirm?.companyName}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deliverConfirm) {
                  deliverCompanyMutation.mutate(deliverConfirm.companyId);
                  setDeliverConfirm(null);
                }
              }}
            >
              Sí, entregar todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={exportConfirm} onOpenChange={setExportConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exportar pedidos</AlertDialogTitle>
            <AlertDialogDescription>
              No estás exportando los pedidos de hoy. Estás exportando los pedidos del{' '}
              <strong>{formatDate(selectedDate)}</strong>. ¿Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doExport}>Exportar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: 'primary' | 'warning' | 'success' | 'info';
}

function StatCard({ label, value, icon: Icon, accent }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] uppercase tracking-brand text-muted-foreground font-medium">
          {label}
        </p>
        {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
      </div>
      <p
        className={cn(
          'font-display text-3xl font-bold leading-none',
          accent === 'primary' && 'text-primary',
          accent === 'warning' && 'text-warning',
          accent === 'success' && 'text-success',
          accent === 'info' && 'text-blue-500',
          !accent && 'text-foreground'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function OrderCard({ order, actionsEnabled = true }: { order: AdminOrder; actionsEnabled?: boolean }) {
  const queryClient = useQueryClient();

  const deliverMutation = useMutation({
    mutationFn: markOrderDelivered,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
      toast.success('Pedido marcado como entregado');
    },
  });

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-lg p-4 space-y-2',
        actionsEnabled && order.estado === 'CONFIRMADO' && 'border-l-4 border-l-warning'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-sans text-sm font-semibold text-foreground truncate">
          {order.userFirstName} {order.userLastName}
        </p>
        <EstadoBadge estado={order.estado} />
      </div>

      <div className="text-xs leading-relaxed">
        <p className="text-foreground font-medium uppercase tracking-brand text-[11px]">
          {order.dishNombre}
        </p>
        {order.sideNombre && (
          <p className="text-muted-foreground">
            c/ {order.sideNombre.toLowerCase()}
          </p>
        )}
      </div>

      {order.notas && (
        <div className="text-[11px] italic text-foreground border-l-2 border-primary/40 pl-2">
          "{order.notas}"
        </div>
      )}

      {actionsEnabled && order.estado === 'COMANDADO' && (
        <Button
          size="sm"
          variant="outline"
          className="w-full h-7 text-[11px] uppercase tracking-brand"
          disabled={deliverMutation.isPending}
          onClick={() => deliverMutation.mutate(order.id)}
        >
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          Marcar entregado
        </Button>
      )}
    </div>
  );
}

function EstadoBadge({ estado }: { estado: AdminOrder['estado'] }) {
  const map = {
    PENDIENTE: { label: 'Pendiente', className: 'bg-warning text-warning-foreground' },
    CONFIRMADO: { label: 'Confirmado', className: 'bg-primary text-primary-foreground' },
    COMANDADO: { label: 'Comandado', className: 'bg-blue-500 text-white' },
    ENTREGADO: { label: 'Entregado', className: 'bg-success text-success-foreground' },
  };
  const { label, className } = map[estado];
  return (
    <Badge className={cn('uppercase tracking-brand text-[9px] shrink-0', className)}>
      {label}
    </Badge>
  );
}
