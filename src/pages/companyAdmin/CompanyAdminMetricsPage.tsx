import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useAuthStore } from '@/features/auth/store/authStore';
import {
  getDailyOrders,
  getOrdersByCategory,
  getParticipation,
} from '@/features/companyAdmin/services/companyAdminApi';
import { cn } from '@/lib/utils';

const PIE_COLORS = ['#c5191d', '#2563eb', '#16a34a', '#eab308', '#8b5cf6', '#ec4899'];

export function CompanyAdminMetricsPage() {
  const companyName = useAuthStore((s) => s.user?.companyName ?? 'Empresa');

  const { data: dailyOrders, isLoading: loadingDaily } = useQuery({
    queryKey: ['companyMetrics', 'dailyOrders'],
    queryFn: getDailyOrders,
  });

  const { data: categoryOrders, isLoading: loadingCategory } = useQuery({
    queryKey: ['companyMetrics', 'ordersByCategory'],
    queryFn: getOrdersByCategory,
  });

  const { data: participation, isLoading: loadingParticipation } = useQuery({
    queryKey: ['companyMetrics', 'participation'],
    queryFn: getParticipation,
  });

  const isLoading = loadingDaily || loadingCategory || loadingParticipation;

  return (
    <div className="p-6 lg:p-10">
      <header className="mb-8">
        <h1 className="font-display text-foreground text-3xl lg:text-4xl font-bold leading-tight mb-1">
          Métricas
        </h1>
        <p className="text-muted-foreground text-sm">{companyName}</p>
      </header>

      {isLoading && (
        <p className="text-center text-muted-foreground text-sm uppercase tracking-brand py-12">
          Cargando...
        </p>
      )}

      {!isLoading && (
        <div className="space-y-8">
          {/* Participation cards */}
          {participation && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ParticipationCard
                label="Participación hoy"
                rate={participation.todayRate}
                detail={`${participation.orderedToday} de ${participation.activeEmployees} empleados`}
              />
              <ParticipationCard
                label="Participación semanal"
                rate={participation.weekRate}
                detail={`${participation.weekOrders} pedidos esta semana`}
                accent="info"
              />
            </div>
          )}

          {/* Daily orders bar chart */}
          {dailyOrders && (
            <section className="bg-card border border-border rounded-lg p-6">
              <h2 className="font-display text-foreground text-xl font-bold mb-1">
                Pedidos diarios
              </h2>
              <p className="text-[10px] uppercase tracking-brand text-muted-foreground font-medium mb-6">
                Últimos 30 días
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyOrders}>
                  <XAxis
                    dataKey="fecha"
                    tickFormatter={(v: string) => {
                      const d = new Date(v + 'T00:00:00');
                      return `${d.getDate()}/${d.getMonth() + 1}`;
                    }}
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip
                    labelFormatter={(v) => {
                      const d = new Date(String(v) + 'T00:00:00');
                      return d.toLocaleDateString('es-AR', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      });
                    }}
                    formatter={(value) => [String(value), 'Pedidos']}
                  />
                  <Bar dataKey="count" fill="#c5191d" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}

          {/* Category donut chart */}
          {categoryOrders && (
            <section className="bg-card border border-border rounded-lg p-6">
              <h2 className="font-display text-foreground text-xl font-bold mb-1">
                Pedidos por categoría
              </h2>
              <p className="text-[10px] uppercase tracking-brand text-muted-foreground font-medium mb-6">
                Últimos 30 días
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={categoryOrders}
                    dataKey="count"
                    nameKey="categoryName"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={110}
                    paddingAngle={2}
                    label={(props) => {
                      const categoryName = (props as { categoryName?: string }).categoryName ?? '';
                      const count = Number((props as { count?: number | string }).count ?? 0);
                      return count > 0 ? `${categoryName} (${count})` : '';
                    }}
                  >
                    {categoryOrders.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [String(value), 'Pedidos']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function ParticipationCard({
  label,
  rate,
  detail,
  accent = 'primary',
}: {
  label: string;
  rate: number;
  detail: string;
  accent?: 'primary' | 'info';
}) {
  const pct = Math.round(rate * 100);
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <p className="text-[10px] uppercase tracking-brand text-muted-foreground font-medium mb-2">
        {label}
      </p>
      <p
        className={cn(
          'font-display text-5xl font-bold leading-none mb-1',
          accent === 'primary' ? 'text-primary' : 'text-blue-500'
        )}
      >
        {pct}%
      </p>
      <p className="text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
