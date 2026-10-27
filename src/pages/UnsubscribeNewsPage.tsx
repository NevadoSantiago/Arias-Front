import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { unsubscribeNews } from '@/features/me/services/meApi';

type Status = 'loading' | 'ok' | 'error';

export function UnsubscribeNewsPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t');
  const [result, setResult] = useState<{ token: string; email: string | null } | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    unsubscribeNews(token)
      .then((r) => !cancelled && setResult({ token, email: r.email }))
      .catch(() => !cancelled && setResult({ token, email: null }));
    return () => { cancelled = true; };
  }, [token]);

  const settled = !!token && result?.token === token;
  const status: Status = !token ? 'error' : !settled ? 'loading' : result.email !== null ? 'ok' : 'error';
  const email = settled ? result.email : null;
  const errorMsg = !token ? 'Link inválido' : 'El link es inválido o vencido.';

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
                Sacamos a <strong>{email}</strong> de las novedades y promociones.
                Si cambiás de opinión, podés volver a activarlas desde la app
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
                {errorMsg}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
