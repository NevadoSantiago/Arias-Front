import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SECTIONS } from '../landingConfig';

const NAV_LINKS = [
  { id: SECTIONS.quienes, label: 'Nosotros' },
  { id: SECTIONS.comoFunciona, label: 'Cómo funciona' },
  { id: SECTIONS.features, label: 'Servicio' },
  { id: SECTIONS.menu, label: 'Menú' },
];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Barra de navegación de la landing. Arranca transparente sobre el hero
 * y se vuelve sólida (con sombra) al scrollear, para mantener legibilidad.
 */
export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 transition-all duration-300',
        scrolled
          ? 'bg-background/90 backdrop-blur-md border-b border-border shadow-sm'
          : 'bg-transparent',
      )}
    >
      <div className="container flex h-16 items-center justify-between gap-4">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="font-display text-primary text-2xl font-bold leading-none tracking-tight"
        >
          ARIAS
        </button>

        <nav className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map((l) => (
            <button
              key={l.id}
              onClick={() => scrollToId(l.id)}
              className="text-xs uppercase tracking-brand text-foreground/70 hover:text-primary transition-colors"
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="uppercase tracking-brand text-xs">
            <Link to="/login">Ingresar</Link>
          </Button>
          <Button
            size="sm"
            className="uppercase tracking-brand text-xs"
            onClick={() => scrollToId(SECTIONS.cotizacion)}
          >
            Pida cotización
          </Button>
        </div>
      </div>
    </header>
  );
}
