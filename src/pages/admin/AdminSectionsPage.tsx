import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  listMenuSectionsAdmin, disableMenuSection, enableMenuSection,
  type AdminMenuSection,
} from '@/features/admin/services/adminApi';
import { SectionFormDialog } from '@/features/admin/components/SectionFormDialog';

export function AdminSectionsPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminMenuSection | null>(null);

  const { data: sections, isLoading } = useQuery({
    queryKey: ['adminMenuSections'],
    queryFn: listMenuSectionsAdmin,
  });

  const disableMutation = useMutation({
    mutationFn: disableMenuSection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminMenuSections'] }),
  });
  const enableMutation = useMutation({
    mutationFn: enableMenuSection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminMenuSections'] }),
  });

  return (
    <div className="p-6 lg:p-10">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-foreground text-3xl lg:text-4xl font-bold leading-tight mb-1">
            Secciones del menú
          </h1>
          <p className="text-muted-foreground text-sm">
            Agrupaciones que ve el empleado en los filter pills (Carnes, Pastas, etc.).
          </p>
        </div>
        <Button
          onClick={() => { setEditing(null); setFormOpen(true); }}
          className="uppercase tracking-brand font-medium self-start"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Nueva sección
        </Button>
      </header>

      {isLoading && (
        <p className="text-center text-muted-foreground text-sm uppercase tracking-brand py-12">Cargando…</p>
      )}

      {!isLoading && sections?.length === 0 && (
        <EmptyState message="Sin secciones todavía" />
      )}

      {sections && sections.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <Th>Orden</Th>
                  <Th>Nombre</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {sections.map((s) => (
                  <tr key={s.id} className={cn('border-b border-border last:border-0', !s.enabled && 'opacity-50')}>
                    <Td className="text-muted-foreground font-mono">{s.ordenDisplay}</Td>
                    <Td className="font-medium text-foreground">{s.nombre}</Td>
                    <Td>
                      <Badge className={cn(
                        'uppercase tracking-brand text-[10px]',
                        s.enabled
                          ? 'bg-success text-success-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {s.enabled ? 'Activa' : 'Inactiva'}
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
                          <DisableConfirm
                            name={s.nombre}
                            onConfirm={() => disableMutation.mutate(s.id)}
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

      <SectionFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
      />
    </div>
  );
}

// ─── Sub-components compartidos ──────────────────────────────────────

export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn('px-4 py-3 text-left text-[10px] uppercase tracking-brand font-bold text-muted-foreground', className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 align-middle', className)}>{children}</td>;
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-20 border border-dashed border-border rounded-lg">
      <p className="font-display text-2xl text-foreground">{message}</p>
    </div>
  );
}

export function DisableConfirm({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Desactivar"
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
          <PowerOff className="w-3.5 h-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-2xl">¿Desactivar?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{name}</strong> deja de aparecer en el menú del empleado. La podés reactivar después.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="uppercase tracking-brand text-xs">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
            className="uppercase tracking-brand text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Sí, desactivar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
