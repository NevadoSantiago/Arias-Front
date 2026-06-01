import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/features/me/services/meApi';

/**
 * Bell icon en el header con un mini-dropdown anchored debajo a la derecha.
 * Por ahora solo controla el flag "Recordatorio diario". Si en el futuro hay
 * más preferencias, conviene moverlo a una página /preferences.
 */
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery({
    queryKey: ['notificationPreferences'],
    queryFn: getNotificationPreferences,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (data) => {
      queryClient.setQueryData(['notificationPreferences'], data);
    },
  });

  // Cerrar al clickear afuera
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const enabled = prefs?.recibeRecordatorioPedido ?? false;

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Notificaciones"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
      </Button>

      {open && (
        <div
          className={cn(
            'absolute right-0 top-full mt-2 z-50',
            'w-72 bg-card border border-border rounded-lg shadow-lg',
            'p-4',
          )}
        >
          <p className="text-[10px] uppercase tracking-brand font-medium text-muted-foreground mb-3">
            Notificaciones
          </p>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5 flex-1 min-w-0">
              <Label htmlFor="reminder-toggle" className="text-sm font-medium text-foreground">
                Recordatorio diario
              </Label>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Si no tenés un pedido para hoy, te avisamos por mail antes del cierre.
              </p>
            </div>
            <Switch
              id="reminder-toggle"
              checked={enabled}
              disabled={!prefs || mutation.isPending}
              onCheckedChange={(v) => mutation.mutate({ recibeRecordatorioPedido: v })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
