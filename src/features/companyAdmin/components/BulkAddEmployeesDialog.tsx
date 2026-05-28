import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { bulkCreateEmployees, type BulkCreateResult } from '@/features/companyAdmin/services/companyAdminApi';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Parse de emails separados por coma, salto de línea o punto y coma.
 * Trim cada uno, descarta vacíos. NO valida formato — el backend lo hace.
 */
function parseEmails(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function BulkAddEmployeesDialog({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [raw, setRaw] = useState('');
  const [result, setResult] = useState<BulkCreateResult | null>(null);

  // Reset al abrir
  useEffect(() => {
    if (!open) return;
    setRaw('');
    setResult(null);
  }, [open]);

  const parsed = useMemo(() => parseEmails(raw), [raw]);
  const count = parsed.length;

  const mutation = useMutation({
    mutationFn: bulkCreateEmployees,
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['companyEmployees'] });
    },
  });

  const handleSubmit = () => {
    if (count === 0) return;
    mutation.mutate(parsed);
  };

  // ── Render del resultado (después de un envío exitoso) ────────────
  if (result) {
    return (
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Resultado</DialogTitle>
            <DialogDescription>
              {result.created.length} {result.created.length === 1 ? 'empleado creado' : 'empleados creados'}
              {result.skipped.length > 0 && `, ${result.skipped.length} omitido${result.skipped.length === 1 ? '' : 's'}`}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {result.created.length > 0 && (
              <div className="p-3 rounded-md border border-success/40 bg-success/5">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <p className="text-xs uppercase tracking-brand font-semibold">
                    Creados ({result.created.length})
                  </p>
                </div>
                <ul className="text-xs space-y-0.5 max-h-[150px] overflow-y-auto pr-1">
                  {result.created.map((e) => (
                    <li key={e.id} className="text-foreground">{e.email}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.skipped.length > 0 && (
              <div className="p-3 rounded-md border border-warning/40 bg-warning/5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-warning" />
                  <p className="text-xs uppercase tracking-brand font-semibold">
                    Omitidos ({result.skipped.length})
                  </p>
                </div>
                <ul className="text-xs space-y-1 max-h-[150px] overflow-y-auto pr-1">
                  {result.skipped.map((s, i) => (
                    <li key={i} className="flex flex-col">
                      <span className="text-foreground font-medium">{s.email}</span>
                      <span className="text-muted-foreground italic">{s.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={onClose} className="uppercase tracking-brand">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Render del form (input inicial) ───────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Agregar varios empleados</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Pegá los emails separados por coma, punto y coma o salto de línea.
            Ideal para el primer onboarding de la empresa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="bulk-emails" className="uppercase tracking-brand text-xs">
            Emails
          </Label>
          <Textarea
            id="bulk-emails"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="ana@empresa.com, luis@empresa.com, sofia@empresa.com"
            rows={8}
            className="resize-none font-mono text-xs"
            autoFocus
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Mail className="w-3 h-3" />
              {count === 0 && 'Sin emails detectados'}
              {count === 1 && '1 email detectado'}
              {count > 1 && `${count} emails detectados`}
            </span>
            <span>Máximo 200 a la vez</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={count === 0 || mutation.isPending || count > 200}
            className="uppercase tracking-brand"
          >
            {mutation.isPending ? 'Procesando…' : `Agregar ${count > 0 ? count : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
