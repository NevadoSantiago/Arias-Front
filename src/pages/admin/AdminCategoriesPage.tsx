import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  listCategoriesAdmin, disableCategory, enableCategory,
  type AdminCategoryFull,
} from '@/features/admin/services/adminApi';
import { CategoryFormDialog } from '@/features/admin/components/CategoryFormDialog';
import { Th, Td, EmptyState, DisableConfirm } from './AdminSectionsPage';

export function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCategoryFull | null>(null);

  const { data: categories, isLoading } = useQuery({
    queryKey: ['adminCategories'],
    queryFn: listCategoriesAdmin,
  });

  const disableMutation = useMutation({
    mutationFn: disableCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCategories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
  const enableMutation = useMutation({
    mutationFn: enableCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCategories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  return (
    <div className="p-6 lg:p-10">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-foreground text-3xl lg:text-4xl font-bold leading-tight mb-1">
            Categorías
          </h1>
          <p className="text-muted-foreground text-sm">
            Categorías de acceso del empleado. Definen qué platos puede ver según la jerarquía.
          </p>
        </div>
        <Button
          onClick={() => { setEditing(null); setFormOpen(true); }}
          className="uppercase tracking-brand font-medium self-start"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Nueva categoría
        </Button>
      </header>

      {isLoading && (
        <p className="text-center text-muted-foreground text-sm uppercase tracking-brand py-12">Cargando…</p>
      )}

      {!isLoading && categories?.length === 0 && (
        <EmptyState message="Sin categorías todavía" />
      )}

      {categories && categories.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <Th>Orden</Th>
                  <Th>Nombre</Th>
                  <Th>Padre</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id} className={cn('border-b border-border last:border-0', !c.enabled && 'opacity-50')}>
                    <Td className="text-muted-foreground font-mono">{c.ordenDisplay}</Td>
                    <Td className="font-medium text-foreground">{c.nombre}</Td>
                    <Td className="text-muted-foreground text-xs">
                      {c.parentNombre ?? <span className="italic">— raíz —</span>}
                    </Td>
                    <Td>
                      <Badge className={cn(
                        'uppercase tracking-brand text-[10px]',
                        c.enabled
                          ? 'bg-success text-success-foreground'
                          : 'bg-muted text-muted-foreground',
                      )}>
                        {c.enabled ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost"
                          onClick={() => { setEditing(c); setFormOpen(true); }}
                          aria-label="Editar" className="h-8 w-8">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {c.enabled ? (
                          <DisableConfirm
                            name={c.nombre}
                            onConfirm={() => disableMutation.mutate(c.id)}
                          />
                        ) : (
                          <Button size="icon" variant="ghost"
                            onClick={() => enableMutation.mutate(c.id)}
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

      <CategoryFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        allCategories={categories ?? []}
      />
    </div>
  );
}
