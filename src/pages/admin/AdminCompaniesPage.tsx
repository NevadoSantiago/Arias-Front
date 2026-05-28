import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Power, PowerOff } from 'lucide-react';
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
  listCompanies,
  disableCompany,
  enableCompany,
  type Company,
} from '@/features/admin/services/adminApi';
import { CompanyFormDialog } from '@/features/admin/components/CompanyFormDialog';

export function AdminCompaniesPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);

  const { data: companies, isLoading } = useQuery({
    queryKey: ['adminCompanies'],
    queryFn: listCompanies,
  });

  const disableMutation = useMutation({
    mutationFn: disableCompany,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminCompanies'] }),
  });

  const enableMutation = useMutation({
    mutationFn: enableCompany,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminCompanies'] }),
  });

  const handleNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleEdit = (company: Company) => {
    setEditing(company);
    setFormOpen(true);
  };

  return (
    <div className="p-6 lg:p-10">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-foreground text-3xl lg:text-4xl font-bold leading-tight mb-1">
            Empresas
          </h1>
          <p className="text-muted-foreground text-sm">
            Clientes del restaurant. Cada empresa tiene su CompanyAdmin para
            cargar empleados.
          </p>
        </div>
        <Button
          onClick={handleNew}
          className="uppercase tracking-brand font-medium self-start"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Nueva empresa
        </Button>
      </header>

      {isLoading && (
        <p className="text-center text-muted-foreground text-sm uppercase tracking-brand py-12">
          Cargando…
        </p>
      )}

      {!isLoading && companies?.length === 0 && (
        <div className="text-center py-20 border border-dashed border-border rounded-lg">
          <p className="font-display text-2xl text-foreground mb-2">
            Todavía no hay empresas
          </p>
          <p className="text-sm text-muted-foreground">
            Hacé click en "Nueva empresa" para agregar la primera.
          </p>
        </div>
      )}

      {companies && companies.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <Th>Nombre</Th>
                  <Th>CUIT</Th>
                  <Th>Dirección</Th>
                  <Th>Entrega</Th>
                  <Th>Categoría</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr
                    key={c.id}
                    className={cn(
                      'border-b border-border last:border-0',
                      !c.enabled && 'opacity-50'
                    )}
                  >
                    <Td className="font-medium text-foreground">{c.nombre}</Td>
                    <Td className="text-muted-foreground">{c.cuit}</Td>
                    <Td className="text-muted-foreground">
                      {c.calle} {c.altura}
                      {c.piso ? `, piso ${c.piso}` : ''}
                    </Td>
                    <Td className="text-muted-foreground">{c.horaEntrega}</Td>
                    <Td>
                      <Badge variant="secondary" className="uppercase tracking-brand text-[10px]">
                        {c.categoriaDefaultNombre}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge
                        className={cn(
                          'uppercase tracking-brand text-[10px]',
                          c.enabled
                            ? 'bg-success text-success-foreground'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {c.enabled ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(c)}
                          aria-label="Editar empresa"
                          className="h-8 w-8"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {c.enabled ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label="Desactivar"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <PowerOff className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="font-display text-2xl">
                                  ¿Desactivar empresa?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  <strong>{c.nombre}</strong> deja de estar
                                  activa — sus empleados no podrán hacer
                                  pedidos. La podés reactivar después.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="uppercase tracking-brand text-xs">
                                  Cancelar
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={(e) => {
                                    e.preventDefault();
                                    disableMutation.mutate(c.id);
                                  }}
                                  className="uppercase tracking-brand text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Sí, desactivar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => enableMutation.mutate(c.id)}
                            aria-label="Reactivar"
                            className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                          >
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

      <CompanyFormDialog
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
