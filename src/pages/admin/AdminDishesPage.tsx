import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Power, PowerOff, Search, Trash2, UtensilsCrossed, X } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  listDishesAdmin, disableDish, enableDish, archiveDish,
  listMenuSectionsAdmin, listCategories, getDishAffectedOrders,
  type AdminDish, type SideType,
} from '@/features/admin/services/adminApi';
import { DishFormDialog } from '@/features/admin/components/DishFormDialog';
import { DisableWithOrdersDialog } from '@/features/admin/components/DisableWithOrdersDialog';
import { Th, Td, EmptyState } from './AdminSectionsPage';

const SIDE_TYPE_LABEL: Record<SideType, string> = {
  GUARNICION: 'Guarnición',
  SALSA: 'Salsa',
};

const ALL_SECTIONS = 'all';
const ALL_CATEGORIES = 'all';

export function AdminDishesPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminDish | null>(null);

  // ─── Filtros ─────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState<string>(ALL_SECTIONS);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES);

  const { data: dishes, isLoading } = useQuery({
    queryKey: ['adminDishes'],
    queryFn: listDishesAdmin,
  });

  const { data: sections } = useQuery({
    queryKey: ['adminMenuSections'],
    queryFn: listMenuSectionsAdmin,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
  });

  const disableMutation = useMutation({
    mutationFn: ({ id, cancelAffected }: { id: number; cancelAffected: boolean }) =>
      disableDish(id, cancelAffected),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDishes'] });
      queryClient.invalidateQueries({ queryKey: ['adminTodayOrders'] });
    },
  });
  const enableMutation = useMutation({
    mutationFn: enableDish,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminDishes'] }),
  });
  const archiveMutation = useMutation({
    mutationFn: archiveDish,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminDishes'] }),
  });

  // Filtrado: búsqueda case-insensitive por nombre + match exacto de sección + categoría
  const filteredDishes = useMemo(() => {
    if (!dishes) return [];
    const q = search.trim().toLowerCase();
    return dishes.filter((d) => {
      if (sectionFilter !== ALL_SECTIONS && String(d.menuSection.id) !== sectionFilter) return false;
      if (categoryFilter !== ALL_CATEGORIES && String(d.category.id) !== categoryFilter) return false;
      if (q && !d.nombre.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [dishes, search, sectionFilter, categoryFilter]);

  const hasActiveFilter = search.trim() !== ''
    || sectionFilter !== ALL_SECTIONS
    || categoryFilter !== ALL_CATEGORIES;
  const totalDishes = dishes?.length ?? 0;

  return (
    <div className="p-6 lg:p-10">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-foreground text-3xl lg:text-4xl font-bold leading-tight mb-1">
            Platos
          </h1>
          <p className="text-muted-foreground text-sm">
            Catálogo del restaurant. Los empleados ven los platos según su categoría.
          </p>
        </div>
        <Button
          onClick={() => { setEditing(null); setFormOpen(true); }}
          className="uppercase tracking-brand font-medium self-start"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Nuevo plato
        </Button>
      </header>

      {/* ── Filtros ─────────────────────────────────────────────────── */}
      {totalDishes > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Buscar por nombre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Section filter */}
          <Select value={sectionFilter} onValueChange={setSectionFilter}>
            <SelectTrigger className="sm:w-[200px]">
              <SelectValue placeholder="Sección" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SECTIONS}>Todas las secciones</SelectItem>
              {sections?.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Category filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="sm:w-[200px]">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>Todas las categorías</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear all + contador */}
          {hasActiveFilter && (
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setSectionFilter(ALL_SECTIONS);
                  setCategoryFilter(ALL_CATEGORIES);
                }}
                className="uppercase tracking-brand text-xs"
              >
                Limpiar filtros
              </Button>
              <span className="text-xs text-muted-foreground">
                {filteredDishes.length} de {totalDishes}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Listado ────────────────────────────────────────────────── */}
      {isLoading && (
        <p className="text-center text-muted-foreground text-sm uppercase tracking-brand py-12">Cargando…</p>
      )}

      {!isLoading && totalDishes === 0 && (
        <EmptyState message="Sin platos todavía" />
      )}

      {!isLoading && totalDishes > 0 && filteredDishes.length === 0 && (
        <div className="text-center py-20 border border-dashed border-border rounded-lg">
          <p className="font-display text-2xl text-foreground mb-1">Sin resultados</p>
          <p className="text-sm text-muted-foreground">
            Probá con otro nombre o cambiá el filtro de sección.
          </p>
        </div>
      )}

      {filteredDishes.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <Th>Foto</Th>
                  <Th>Nombre</Th>
                  <Th>Sección</Th>
                  <Th>Categoría</Th>
                  <Th>Acompaña con</Th>
                  <Th>Stock</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {filteredDishes.map((d) => (
                  <tr key={d.id} className={cn('border-b border-border last:border-0', !d.enabled && 'opacity-50')}>
                    <Td>
                      <DishThumb fotoUrl={d.fotoUrl} alt={d.nombre} />
                    </Td>
                    <Td className="font-medium text-foreground">
                      <div>
                        {d.nombre}
                        {d.especial && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Badge variant="outline" className="text-primary border-primary/40 uppercase tracking-brand text-[9px] px-1.5 py-0">
                              Especial
                            </Badge>
                          </div>
                        )}
                      </div>
                    </Td>
                    <Td className="text-muted-foreground text-xs">{d.menuSection.nombre}</Td>
                    <Td>
                      <Badge variant="secondary" className="uppercase tracking-brand text-[10px]">
                        {d.category.nombre}
                      </Badge>
                    </Td>
                    <Td className="text-muted-foreground text-xs">
                      {d.sideType ? (
                        <div>
                          <p>{SIDE_TYPE_LABEL[d.sideType]}</p>
                          <p className="text-[10px] opacity-70">
                            {d.allowedSides.length} {d.allowedSides.length === 1 ? 'opción' : 'opciones'}
                          </p>
                        </div>
                      ) : (
                        <span className="text-[11px] italic">—</span>
                      )}
                    </Td>
                    <Td>
                      <StockCell actual={d.stockActual} defaultStock={d.stockDiarioDefault} />
                    </Td>
                    <Td>
                      <Badge className={cn(
                        'uppercase tracking-brand text-[10px]',
                        d.enabled
                          ? 'bg-success text-success-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {d.enabled ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost"
                          onClick={() => { setEditing(d); setFormOpen(true); }}
                          aria-label="Editar" className="h-8 w-8">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {d.enabled ? (
                          <DisableWithOrdersDialog
                            itemName={d.nombre}
                            fetchAffected={() => getDishAffectedOrders(d.id)}
                            queryKey={['dishAffected', d.id]}
                            allowCancel
                            allowKeep={false}
                            onConfirm={(cancelOrders) =>
                              disableMutation.mutate({ id: d.id, cancelAffected: cancelOrders })
                            }
                            trigger={
                              <Button size="icon" variant="ghost" aria-label="Desactivar"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                                <PowerOff className="w-3.5 h-3.5" />
                              </Button>
                            }
                          />
                        ) : (
                          <>
                            <Button size="icon" variant="ghost"
                              onClick={() => enableMutation.mutate(d.id)}
                              aria-label="Reactivar"
                              className="h-8 w-8 text-success hover:text-success hover:bg-success/10">
                              <Power className="w-3.5 h-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" aria-label="Eliminar"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="font-display text-2xl">
                                    ¿Eliminar el plato?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    <strong>{d.nombre}</strong> va a desaparecer del listado.
                                    Los pedidos históricos van a seguir mostrando su nombre,
                                    pero no se va a poder reactivar.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="uppercase tracking-brand text-xs">
                                    Cancelar
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={(e) => { e.preventDefault(); archiveMutation.mutate(d.id); }}
                                    className="uppercase tracking-brand text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Sí, eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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

      <DishFormDialog open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function DishThumb({ fotoUrl, alt }: { fotoUrl: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!fotoUrl || failed) {
    return (
      <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
        <UtensilsCrossed className="w-4 h-4 text-muted-foreground/50" />
      </div>
    );
  }
  return (
    <img
      src={fotoUrl}
      alt={alt}
      className="w-12 h-12 rounded-md object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function StockCell({ actual, defaultStock }: { actual: number; defaultStock: number }) {
  const isOut = actual === 0;
  const isLow = actual > 0 && actual <= 3;
  return (
    <div className="text-xs leading-tight">
      <span className={cn(
        'font-medium',
        isOut && 'text-destructive',
        isLow && 'text-warning',
        !isOut && !isLow && 'text-foreground'
      )}>
        {actual}
      </span>
      <span className="text-muted-foreground opacity-70"> / {defaultStock}</span>
    </div>
  );
}
