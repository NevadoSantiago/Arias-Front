import { Link } from 'react-router-dom';
import { RegisterForm } from '@/features/auth/components/RegisterForm';

export function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="text-center pt-8 lg:pt-12 pb-2 lg:pb-4">
        <h1 className="font-display text-primary text-6xl lg:text-7xl font-bold leading-none mb-2">
          ARIAS
        </h1>
        <p className="font-sans text-primary text-sm tracking-brand uppercase font-medium">
          Bodegón &middot; Parrilla
        </p>
        <p className="font-sans text-xs tracking-brand uppercase text-muted-foreground mt-2">
          Familia Mazzariello &middot; Desde 2015
        </p>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-lg border border-border p-8 shadow-sm">
            <div className="mb-8">
              <h2 className="font-display text-foreground text-3xl font-bold mb-2">
                Creá tu cuenta
              </h2>
              <p className="text-muted-foreground text-sm">
                Registrate para pedir tu almuerzo.
              </p>
            </div>

            <RegisterForm />

            <div className="mt-4 text-center">
              <Link
                to="/login"
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                ¿Ya tenés cuenta? Iniciá sesión
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
