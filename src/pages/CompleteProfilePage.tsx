import { Navigate } from 'react-router-dom';
import { CompleteProfileForm } from '@/features/auth/components/CompleteProfileForm';
import { homeForRole } from '@/features/auth/components/ProtectedRoute';
import { useAuthStore } from '@/features/auth/store/authStore';

export function CompleteProfilePage() {
  const user = useAuthStore((s) => s.user);

  // Si ya tiene el perfil completo (ej: volvió a esta URL con el back del
  // navegador), no tiene sentido mostrar el formulario de nuevo.
  if (user?.profileComplete) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

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
                Completá tu perfil
              </h2>
              <p className="text-muted-foreground text-sm">
                Nos falta tu teléfono y cómo querés que te llamemos en el ticket.
              </p>
            </div>

            <CompleteProfileForm />
          </div>
        </div>
      </div>
    </div>
  );
}
