import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  listSidesAdmin, disableSide, enableSide, getSideAffectedOrders,
  type AdminSide, type SideType,
} from '@/features/admin/services/adminApi';
import { SideFormDialog } from '@/features/admin/components/SideFormDialog';
import { DisableWithOrdersDialog } from '@/features/admin/components/DisableWithOrdersDialog';
import { Th, Td, EmptyState } from './AdminSectionsPage';

const TIPO_LABEL: Record<SideType, string> = {
  GUARNICION: 'Guarnición',
  SALSA: 'Salsa',
};

export function AdminSidesPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminSide | null>(null);

  const { data: sides, isLoading } = useQuery({
    queryKey: ['adminSides'],
    queryFn: listSidesAdmin,
  });

  const disableMutation = useMutation({
    mutationFn: disableSide,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminSides'] }),
  });
  const enableMutation = useMutation({
    mutationFn: enableSide,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminSides'] }),
  });

  return (
    <div className="p-6 lg:p-10">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-foreground text-3xl lg:text-4xl font-bold leading-tight mb-1">
            Acompañamientos
          </h1>
          <p className="text-muted-foreground text-sm">
            Guarniciones y salsas que se pueden asociar a los platos.
          </p>
        </div>
        <Button
          onClick={() => { setEditing(null); setFormOpen(true); }}
          className="uppercase tracking-brand font-medium self-start"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Nuevo acompañamiento
        </Button>
      </header>

      {isLoading && (
        <p className="text-center text-muted-foreground text-sm uppercase tracking-brand py-12">Cargando…</p>
      )}

      {!isLoading && sides?.length === 0 && <EmptyState message="Sin acompañamientos todavía" />}

      {sides && sides.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <Th>Nombre</Th>
                  <Th>Tipo</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {sides.map((s) => (
                  <tr key={s.id} className={cn('border-b border-border last:border-0', !s.enabled && 'opacity-50')}>
                    <Td className="font-medium text-foreground">{s.nombre}</Td>
                    <Td>
                      <Badge variant="secondary" className="uppercase tracking-brand text-[10px]">
                        {TIPO_LABEL[s.tipo]}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge className={cn(
                        'uppercase tracking-brand text-[10px]',
                        s.enabled
                          ? 'bg-success text-success-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {s.enabled ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost"
                          onClick={() => { setEditing(s); setFormOpen(true); }}
                          aria-label="Editar" className="h-8 w-8">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {s.enabled ? (
                          <DisableWithOrdersDialog
                            itemName={s.nombre}
                            fetchAffected={() => getSideAffectedOrders(s.id)}
                            queryKey={['sideAffected', s.id]}
                            allowCancel={false}
                            onConfirm={() => disableMutation.mutate(s.id)}
                            trigger={
                              <Button size="icon" variant="ghost" aria-label="Desactivar"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                                <PowerOff className="w-3.5 h-3.5" />
                              </Button>
                            }
                          />
                        ) : (
                          <Button size="icon" variant="ghost"
                            onClick={() => enableMutation.mutate(s.id)}
                            aria-label="Reactivar"
                            className="h-8 w-8 text-success hover:text-success hover:bg-success/10">
                            <Power className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <SideFormDialog open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
    </div>
  );
}
