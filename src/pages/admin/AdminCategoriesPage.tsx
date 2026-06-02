import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Pencil, Plus, Power, PowerOff, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  listCategoriesAdmin, disableCategory, enableCategory, archiveCategory,
  getCategoryAffectedDishesCount,
  type AdminCategoryFull,
} from '@/features/admin/services/adminApi';
import { CategoryFormDialog } from '@/features/admin/components/CategoryFormDialog';
import { Th, Td, EmptyState } from './AdminSectionsPage';

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
      // El disable cascade-deshabilita los platos, así que refrescamos su listado
      queryClient.invalidateQueries({ queryKey: ['adminDishes'] });
    },
  });
  const enableMutation = useMutation({
    mutationFn: enableCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCategories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
  const archiveMutation = useMutation({
    mutationFn: archiveCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCategories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      // El archive deshabilita los platos asociados, así que refrescamos su listado
      queryClient.invalidateQueries({ queryKey: ['adminDishes'] });
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
                          <DisableCategoryButton
                            category={c}
                            onConfirm={() => disableMutation.mutate(c.id)}
                          />
                        ) : (
                          <>
                            <Button size="icon" variant="ghost"
                              onClick={() => enableMutation.mutate(c.id)}
                              aria-label="Reactivar"
                              className="h-8 w-8 text-success hover:text-success hover:bg-success/10">
                              <Power className="w-3.5 h-3.5" />
                            </Button>
                            <ArchiveCategoryButton
                              category={c}
                              onConfirm={() => archiveMutation.mutate(c.id)}
                            />
                          </>
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

// ─── Sub-components ──────────────────────────────────────────────────

interface DisableCategoryButtonProps {
  category: AdminCategoryFull;
  onConfirm: () => void;
}

/**
 * Botón PowerOff + AlertDialog que pre-fetcha el conteo de platos activos asociados.
 * Avisa al admin cuántos platos se van a deshabilitar en cascada al desactivar la categoría.
 */
function DisableCategoryButton({ category, onConfirm }: DisableCategoryButtonProps) {
  const [open, setOpen] = useState(false);

  const { data: affectedCount, isLoading } = useQuery({
    queryKey: ['categoryAffectedDishes', category.id],
    queryFn: () => getCategoryAffectedDishesCount(category.id),
    enabled: open,
    staleTime: 0,
  });

  const count = affectedCount ?? 0;
  const hasAffected = count > 0;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Desactivar"
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
          <PowerOff className="w-3.5 h-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-2xl">
            ¿Desactivar la categoría?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed">
            <strong>{category.nombre}</strong> deja de aparecer en los dropdowns.
            La podés reactivar después.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isLoading && (
          <div className="py-2 flex items-center justify-center gap-2 text-xs uppercase tracking-brand text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Buscando platos afectados…
          </div>
        )}

        {!isLoading && hasAffected && (
          <div className="my-1 p-3 rounded-md border border-warning/40 bg-warning/5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-foreground leading-relaxed">
                <strong>{count}</strong> {count === 1 ? 'plato activo se va a deshabilitar' : 'platos activos se van a deshabilitar'} automáticamente.
                Los pedidos históricos se mantienen intactos.
              </p>
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel className="uppercase tracking-brand text-xs">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isLoading}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
              setOpen(false);
            }}
            className="uppercase tracking-brand text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Sí, desactivar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface ArchiveCategoryButtonProps {
  category: AdminCategoryFull;
  onConfirm: () => void;
}

/**
 * Botón trash + AlertDialog que pre-fetcha el conteo de platos activos asociados.
 * Avisa al admin cuántos platos se van a deshabilitar como side effect del archive.
 */
function ArchiveCategoryButton({ category, onConfirm }: ArchiveCategoryButtonProps) {
  const [open, setOpen] = useState(false);

  const { data: affectedCount, isLoading } = useQuery({
    queryKey: ['categoryAffectedDishes', category.id],
    queryFn: () => getCategoryAffectedDishesCount(category.id),
    enabled: open,
    staleTime: 0,
  });

  const count = affectedCount ?? 0;
  const hasAffected = count > 0;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Eliminar"
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-2xl">
            ¿Eliminar la categoría?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed">
            <strong>{category.nombre}</strong> va a desaparecer de los listados y dropdowns.
            No se va a poder reactivar.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isLoading && (
          <div className="py-2 flex items-center justify-center gap-2 text-xs uppercase tracking-brand text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Buscando platos afectados…
          </div>
        )}

        {!isLoading && hasAffected && (
          <div className="my-1 p-3 rounded-md border border-warning/40 bg-warning/5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-foreground leading-relaxed">
                <strong>{count}</strong> {count === 1 ? 'plato activo se va a deshabilitar' : 'platos activos se van a deshabilitar'} automáticamente.
                Los pedidos históricos se mantienen intactos.
              </p>
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel className="uppercase tracking-brand text-xs">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isLoading}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
              setOpen(false);
            }}
            className="uppercase tracking-brand text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Sí, eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
