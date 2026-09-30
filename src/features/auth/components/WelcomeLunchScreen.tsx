import { Button } from '@/components/ui/button';

interface Props {
  /** Texto que explica qué acaba de pasar (verificación de correo vs. Google). */
  description: string;
  onContinue: () => void;
}

/**
 * Pantalla de felicitación por el almuerzo de bienvenida (spec
 * `self-registration`, "Pantalla de felicitación por el almuerzo de
 * bienvenida"). Se muestra EXACTAMENTE una vez, inmediatamente después de que
 * la cuenta queda validada por primera vez — verificación de correo o alta
 * con Google — nunca en un login posterior. El caller la muestra gateada por
 * `welcomeLunchGranted`, que solo el backend decide (nunca se deriva de
 * `/me`).
 */
export function WelcomeLunchScreen({ description, onContinue }: Props) {
  return (
    <div className="text-center py-6">
      <h2 className="font-display text-foreground text-3xl font-bold mb-2">
        ¡Listo, bienvenido a Arias!
      </h2>
      <p className="text-muted-foreground text-sm mb-8">{description}</p>
      <Button
        onClick={onContinue}
        className="w-full uppercase tracking-brand font-medium"
        size="lg"
      >
        Continuar
      </Button>
    </div>
  );
}
