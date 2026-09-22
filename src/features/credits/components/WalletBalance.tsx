import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useWallet } from '../hooks/useWallet';

function formatExpiry(expiresAt: string): string {
  return new Date(expiresAt).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Muestra AVAILABLE y COMMITTED como dos cifras separadas — nunca sumadas en
 * un único total, para que el usuario entienda cuántos almuerzos puede
 * comprometer en un pedido nuevo frente a cuántos ya están reservados en
 * pedidos pendientes de retiro (spec `credits-ui`, Decisión F2 de `design.md`).
 */
export function WalletBalance() {
  const { data: wallet, isLoading, isError } = useWallet();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando tu billetera…</p>;
  }

  if (isError || !wallet) {
    return <p className="text-sm text-destructive">No pudimos cargar tu billetera.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tus almuerzos</CardTitle>
        {wallet.expiresAt && (
          <CardDescription>Tus almuerzos vencen el {formatExpiry(wallet.expiresAt)}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-3xl font-bold text-foreground">{wallet.available} disponibles</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-foreground">{wallet.committed} comprometidos</p>
        </div>
      </CardContent>
    </Card>
  );
}
