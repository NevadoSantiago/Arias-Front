import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { unsubscribeReminder } from '@/features/me/services/meApi';

type Status = 'loading' | 'ok' | 'error';

export function UnsubscribeReminderPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t');
  const [status, setStatus] = useState<Status>('loading');
  const [email, setEmail] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('Link inválido');
      return;
    }
    let cancelled = false;
    unsubscribeReminder(token)
      .then((result) => {
        if (cancelled) return;
        setEmail(result.email);
        setStatus('ok');
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : 'No pudimos procesar el pedido');
      });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-16 bg-background">
      <div className="max-w-md w-full bg-card border border-border rounded-lg p-8 text-center space-y-5">
        <div>
          <h1 className="font-display text-primary text-3xl font-bold leading-none">
            ARIAS
          </h1>
          <p className="text-primary text-[10px] tracking-brand uppercase mt-1">
            Bodegón · Parrilla
          </p>
        </div>

        {status === 'loading' && (
          <p className="text-sm text-muted-foreground uppercase tracking-brand py-4">
            Procesando…
          </p>
        )}

        {status === 'ok' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
            <div className="space-y-2">
              <h2 className="font-display text-xl font-bold">Listo</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Sacamos a <strong>{email}</strong> de los recordatorios diarios.
                Si cambiás de opinión, podés volver a activarlos desde la app
                en cualquier momento.
              </p>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-destructive mx-auto" />
            <div className="space-y-2">
              <h2 className="font-display text-xl font-bold">No pudimos hacerlo</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {errorMsg ?? 'El link es inválido o vencido.'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
