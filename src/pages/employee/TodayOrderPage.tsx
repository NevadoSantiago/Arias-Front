import { useAuthStore } from '@/features/auth/store/authStore';
import { CompanyOrderPage } from './CompanyOrderPage';
import { B2cOrderPage } from './B2cOrderPage';

/**
 * Ruta `/orders/today` (y `/company-admin/today`) — pantalla de pedido del
 * día. Ambos tipos de cliente son `Role.EMPLOYEE`; `user.companyId` es la
 * ÚNICA señal que distingue un empleado de empresa (B2B) de un cliente
 * autorregistrado (B2C) — ver diseño §Decisión 5, `MeResponse.companyId`.
 *
 * Este componente es SOLO el branch: cada flujo vive en su propia pantalla
 * hermana para que ninguno herede lógica del otro.
 * - `companyId` presente → `CompanyOrderPage`, el flujo histórico de un
 *   único plato por día, SIN CAMBIOS de comportamiento, texto ni layout.
 * - `companyId` null → `B2cOrderPage`, el carrito multi-ítem por créditos
 *   con horario de retiro.
 */
export function TodayOrderPage() {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return (
      <div className="container py-12">
        <p className="text-center text-muted-foreground text-sm uppercase tracking-brand">
          Cargando…
        </p>
      </div>
    );
  }

  return user.companyId == null ? <B2cOrderPage /> : <CompanyOrderPage />;
}
