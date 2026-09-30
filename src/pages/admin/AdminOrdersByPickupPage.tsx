import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Clock, Download, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { exportOrdersByPickup, getOrdersByPickup } from '@/features/admin/services/adminApi';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Consolidado de cocina agrupado por horario de retiro — unidad 13 del
 * backend (spec `admin-order-fulfillment`). Fuente distinta de la vista por
 * empresa de `AdminDashboardPage`: lee `orders` (pedidos B2C con retiro
 * directo), no `daily_choice`.
 */
export function AdminOrdersByPickupPage() {
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [isExporting, setIsExporting] = useState(false);

  const { data: groups, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['adminOrdersByPickup', selectedDate],
    queryFn: () => getOrdersByPickup(selectedDate),
  });

  const totalOrders = useMemo(
    () => groups?.reduce((sum, g) => sum + g.orders.length, 0) ?? 0,
    [groups],
  );

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportOrdersByPickup(selectedDate);
      toast.success('Excel de pedidos por horario descargado');
    } catch {
      toast.error('Error al exportar');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 lg:p-10">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-foreground text-3xl lg:text-4xl font-bold leading-tight mb-1">
            Pedidos por horario de retiro
          </h1>
          <p className="text-muted-foreground text-sm">
            Consolidado de cocina para pedidos con retiro directo (clientes B2C).
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <Label htmlFor="fecha" className="uppercase tracking-brand text-xs">
              Fecha
            </Label>
            <Input
              id="fecha"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="max-w-[180px]"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="uppercase tracking-brand text-[11px]"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            <RefreshCw className={cn('w-3.5 h-3.5 mr-1', isFetching && 'animate-spin')} />
            Actualizar
          </Button>
          <Button
            size="sm"
            className="uppercase tracking-brand text-[11px]"
            disabled={isExporting || totalOrders === 0}
            onClick={() => void handleExport()}
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            {isExporting ? 'Exportando…' : 'Exportar'}
          </Button>
        </div>
      </header>

      {isLoading && (
        <p className="text-center text-muted-foreground text-sm uppercase tracking-brand py-12">
          Cargando…
        </p>
      )}

      {!isLoading && totalOrders === 0 && (
        <div className="text-center py-20 border border-dashed border-border rounded-lg">
          <p className="font-display text-2xl text-foreground mb-2">
            Sin pedidos para esta fecha
          </p>
          <p className="text-sm text-muted-foreground">
            Cuando haya pedidos con retiro directo, se van a agrupar acá por horario.
          </p>
        </div>
      )}

      <div className="space-y-8">
        {groups?.map((group) => (
          <section key={group.pickupTime}>
            <div className="flex items-center gap-3 mb-4 pb-2 border-b-2 border-primary">
              <Clock className="w-5 h-5 text-primary" />
              <h2 className="font-display text-2xl text-foreground font-bold">
                {group.pickupTime}
              </h2>
              <span className="text-xs uppercase tracking-brand text-muted-foreground flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {group.orders.length} {group.orders.length === 1 ? 'pedido' : 'pedidos'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {group.orders.map((order) => (
                <div key={order.id} className="bg-card border border-border rounded-lg p-4 space-y-2">
                  <p className="font-sans text-sm font-semibold text-foreground truncate">
                    {order.customerNickname}
                  </p>
                  <ul className="text-xs leading-relaxed space-y-1">
                    {order.items.map((item, i) => (
                      <li key={i} className="text-foreground">
                        {item.dishNombre}
                        {item.sideNombre && (
                          <span className="text-muted-foreground"> c/ {item.sideNombre.toLowerCase()}</span>
                        )}
                        <span className="text-muted-foreground">
                          {' '}— {item.creditCost} {item.creditCost === 1 ? 'almuerzo' : 'almuerzos'}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {order.notas && (
                    <div className="text-[11px] italic text-foreground border-l-2 border-primary/40 pl-2">
                      "{order.notas}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
