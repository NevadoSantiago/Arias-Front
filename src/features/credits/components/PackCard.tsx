import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CreditPack } from '../types';

function formatPrice(priceCents: number): string {
  return (priceCents / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
}

interface PackCardProps {
  pack: CreditPack;
  onSelect: (pack: CreditPack) => void;
  isPending?: boolean;
}

/**
 * Presentacional puro: muestra el precio y el descuento tal como los
 * devuelve la API, sin recalcularlos en el cliente (spec `credits-ui`,
 * requisito "Catálogo de paquetes con precio y descuento").
 */
export function PackCard({ pack, onSelect, isPending }: PackCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{pack.nombre}</CardTitle>
        <CardDescription>
          {pack.creditAmount} {pack.creditAmount === 1 ? 'almuerzo' : 'almuerzos'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <p className="text-2xl font-bold text-foreground">{formatPrice(pack.priceCents)}</p>
          {pack.discountPercent > 0 && <Badge variant="secondary">{pack.discountPercent}% off</Badge>}
        </div>
        <Button onClick={() => onSelect(pack)} disabled={isPending}>
          Comprar
        </Button>
      </CardContent>
    </Card>
  );
}
