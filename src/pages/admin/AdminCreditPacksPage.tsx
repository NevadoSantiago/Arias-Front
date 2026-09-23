import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  listCreditPacksAdmin,
  deleteCreditPack,
  type AdminCreditPack,
} from '@/features/admin/services/adminApi';
import { CreditPackFormDialog } from '@/features/admin/components/CreditPackFormDialog';

function formatPrice(priceCents: number): string {
  return (priceCents / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
}

/** CRUD de paquetes de almuerzos — SUPER_ADMIN (spec `credit-pack-purchase` del backend). */
export function AdminCreditPacksPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCreditPack | null>(null);

  const { data: packs, isLoading } = useQuery({
    queryKey: ['adminCreditPacks'],
    queryFn: listCreditPacksAdmin,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCreditPack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCreditPacks'] });
      toast.success('Paquete eliminado');
    },
    onError: () => toast.error('No se pudo eliminar el paquete'),
  });

  const handleNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleEdit = (pack: AdminCreditPack) => {
    setEditing(pack);
    setFormOpen(true);
  };

  return (
    <div className="p-6 lg:p-10">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-foreground text-3xl lg:text-4xl font-bold leading-tight mb-1">
            Paquetes de almuerzos
          </h1>
          <p className="text-muted-foreground text-sm">
            Catálogo de compra de almuerzos para clientes B2C. El precio es el valor
            cobrado; el descuento es solo informativo.
          </p>
        </div>
        <Button
          onClick={handleNew}
          className="uppercase tracking-brand font-medium self-start"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Nuevo paquete
        </Button>
      </header>

      {isLoading && (
        <p className="text-center text-muted-foreground text-sm uppercase tracking-brand py-12">
          Cargando…
        </p>
      )}

      {!isLoading && packs?.length === 0 && (
        <div className="text-center py-20 border border-dashed border-border rounded-lg">
          <p className="font-display text-2xl text-foreground mb-2">
            Todavía no hay paquetes
          </p>
          <p className="text-sm text-muted-foreground">
            Hacé click en "Nuevo paquete" para agregar el primero.
          </p>
        </div>
      )}

      {packs && packs.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <Th>Código</Th>
                  <Th>Nombre</Th>
                  <Th>Almuerzos</Th>
                  <Th>Precio</Th>
                  <Th>Descuento</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {packs.map((p) => (
                  <tr
                    key={p.id}
                    className={cn(
                      'border-b border-border last:border-0',
                      !p.enabled && 'opacity-50'
                    )}
                  >
                    <Td className="font-medium text-foreground">{p.code}</Td>
                    <Td>{p.nombre}</Td>
                    <Td className="text-muted-foreground">
                      {p.creditAmount} {p.creditAmount === 1 ? 'almuerzo' : 'almuerzos'}
                    </Td>
                    <Td className="text-muted-foreground">{formatPrice(p.priceCents)}</Td>
                    <Td className="text-muted-foreground">
                      {p.discountPercent > 0 ? `${p.discountPercent}%` : '—'}
                    </Td>
                    <Td>
                      <Badge
                        className={cn(
                          'uppercase tracking-brand text-[10px]',
                          p.enabled
                            ? 'bg-success text-success-foreground'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {p.enabled ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(p)}
                          aria-label="Editar paquete"
                          className="h-8 w-8"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Eliminar paquete"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="font-display text-2xl">
                                ¿Eliminar paquete?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                <strong>{p.nombre}</strong> deja de ofrecerse a los
                                clientes. Las compras ya realizadas no se ven afectadas.
                                Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="uppercase tracking-brand text-xs">
                                Cancelar
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={(e) => {
                                  e.preventDefault();
                                  deleteMutation.mutate(p.id);
                                }}
                                className="uppercase tracking-brand text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Sí, eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CreditPackFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
      />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'px-4 py-3 text-left text-[10px] uppercase tracking-brand font-bold text-muted-foreground',
        className
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 align-middle', className)}>{children}</td>;
}
