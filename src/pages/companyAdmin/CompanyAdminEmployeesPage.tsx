import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Power, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  listEmployees, disableEmployee, enableEmployee, archiveEmployee,
  type Employee,
} from '@/features/companyAdmin/services/companyAdminApi';
import { EmployeeFormDialog } from '@/features/companyAdmin/components/EmployeeFormDialog';
import { EmployeeCategorySelect } from '@/features/companyAdmin/components/EmployeeCategorySelect';
import { BulkAddEmployeesDialog } from '@/features/companyAdmin/components/BulkAddEmployeesDialog';
import { Th, Td, EmptyState, DisableConfirm } from '@/pages/admin/AdminSectionsPage';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function displayName(e: Employee): string {
  if (!e.firstName && !e.lastName) return '(pendiente)';
  return `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim();
}

export function CompanyAdminEmployeesPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const { data: employees, isLoading } = useQuery({
    queryKey: ['companyEmployees'],
    queryFn: listEmployees,
  });

  const disableMutation = useMutation({
    mutationFn: disableEmployee,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companyEmployees'] }),
  });
  const enableMutation = useMutation({
    mutationFn: enableEmployee,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companyEmployees'] }),
  });
  const archiveMutation = useMutation({
    mutationFn: archiveEmployee,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companyEmployees'] }),
  });

  return (
    <div className="p-6 lg:p-10">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-foreground text-3xl lg:text-4xl font-bold leading-tight mb-1">
            Empleados
          </h1>
          <p className="text-muted-foreground text-sm">
            Whitelist de empleados que pueden pedir su almuerzo desde la app.
          </p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1.5">
          <Button
            onClick={() => setFormOpen(true)}
            className="uppercase tracking-brand font-medium"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nuevo empleado
          </Button>
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="text-[11px] uppercase tracking-brand text-muted-foreground hover:text-primary transition-colors"
          >
            o agregar varios a la vez →
          </button>
        </div>
      </header>

      {isLoading && (
        <p className="text-center text-muted-foreground text-sm uppercase tracking-brand py-12">Cargando…</p>
      )}

      {!isLoading && employees?.length === 0 && (
        <EmptyState message="Sin empleados todavía" />
      )}

      {employees && employees.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <Th>Email</Th>
                  <Th>Nombre</Th>
                  <Th>Categoría</Th>
                  <Th>Último ingreso</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id} className={cn('border-b border-border last:border-0', !e.active && 'opacity-50')}>
                    <Td className="font-medium text-foreground">{e.email}</Td>
                    <Td className={cn('text-xs', !e.firstName && 'text-muted-foreground italic')}>
                      {displayName(e)}
                    </Td>
                    <Td>
                      <EmployeeCategorySelect
                        employeeId={e.id}
                        currentCategoryId={e.categoryId}
                        disabled={!e.active}
                      />
                    </Td>
                    <Td className="text-xs text-muted-foreground">{formatDate(e.lastLoginAt)}</Td>
                    <Td>
                      {e.firstLoginPending && e.active ? (
                        <Badge className="uppercase tracking-brand text-[10px] bg-warning text-warning-foreground">
                          Pendiente
                        </Badge>
                      ) : (
                        <Badge className={cn(
                          'uppercase tracking-brand text-[10px]',
                          e.active
                            ? 'bg-success text-success-foreground'
                            : 'bg-muted text-muted-foreground'
                        )}>
                          {e.active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      )}
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {e.active ? (
                          <DisableConfirm name={e.email} onConfirm={() => disableMutation.mutate(e.id)} />
                        ) : (
                          <>
                            <Button size="icon" variant="ghost"
                              onClick={() => enableMutation.mutate(e.id)}
                              aria-label="Reactivar"
                              className="h-8 w-8 text-success hover:text-success hover:bg-success/10">
                              <Power className="w-3.5 h-3.5" />
                            </Button>
                            <ArchiveConfirm
                              email={e.email}
                              onConfirm={() => archiveMutation.mutate(e.id)}
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

      <EmployeeFormDialog open={formOpen} onClose={() => setFormOpen(false)} />
      <BulkAddEmployeesDialog open={bulkOpen} onClose={() => setBulkOpen(false)} />
    </div>
  );
}

/** Confirmación de soft-delete — distinto al "desactivar" (este es definitivo). */
function ArchiveConfirm({ email, onConfirm }: { email: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Borrar"
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-2xl">¿Borrar definitivamente?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{email}</strong> desaparece de la lista y no va a poder loguearse más.
            Los pedidos que haya hecho quedan en el historial del restaurant.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="uppercase tracking-brand text-xs">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
            className="uppercase tracking-brand text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Sí, borrar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
