import { Link } from 'react-router-dom';
import { Clock, Smartphone, UtensilsCrossed, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/features/landing/components/Reveal';
import heroChef from '@/assets/illustrations/BienvenidaHermanos.svg';
import chefOfrece from '@/assets/illustrations/chef-ofrece.svg';
import fotoFachada from '@/assets/landing/photos/fachada.jpg';
import fotoSalon from '@/assets/landing/photos/salon.jpg';
import platoNapolitana from '@/assets/landing/photos/plato-napolitana-tile.jpg';
import platoHuevo from '@/assets/landing/photos/plato-huevo-tile.jpg';
import collagePlatos from '@/assets/landing/photos/collage-platos-tile.jpg';

const PASOS = [
  {
    icon: Wallet,
    title: 'Cargá tus almuerzos',
    text: 'Elegí un paquete de almuerzos y comprálo en segundos. Vos decidís cuántos cargar.',
  },
  {
    icon: UtensilsCrossed,
    title: 'Armá tu pedido',
    text: 'Elegí el plato del día, sumá tu guarnición favorita y confirmá. Simple, sin vueltas.',
  },
  {
    icon: Clock,
    title: 'Retiralo cuando quieras',
    text: 'Elegís el horario de retiro que más te queda cómodo, dentro de nuestra ventana de pedidos.',
  },
];

const FEATURES = [
  {
    icon: Smartphone,
    title: 'Pedís desde el celular',
    text: 'Sin llamadas ni mensajes. Entrás, elegís y listo.',
  },
  {
    icon: Wallet,
    title: 'Tus almuerzos, tu saldo',
    text: 'Comprás el paquete que más te convenga y lo vas usando pedido a pedido.',
  },
  {
    icon: Clock,
    title: 'Vos elegís el horario',
    text: 'Retirá tu almuerzo cuando te quede mejor, dentro de nuestra ventana de retiro.',
  },
];

/**
 * Landing pública raíz — recorrido B2C (historia → registro). El contenido
 * corporativo (B2B) vive ahora en `/corporate` (ver `CorporatePage.tsx`).
 * Diseño F4 en `openspec/changes/b2c-credits-pivot/design.md`.
 */
export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ─── NAV ──────────────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border shadow-sm">
        <div className="container flex h-16 items-center justify-between gap-4">
          <span className="font-display text-primary text-2xl font-bold leading-none tracking-tight">
            ARIAS
          </span>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="uppercase tracking-brand text-xs">
              <Link to="/login">Ingresar</Link>
            </Button>
            <Button asChild size="sm" className="uppercase tracking-brand text-xs">
              <Link to="/register">Registrarme</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ─── HERO ─────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-16 lg:pt-36 lg:pb-24">
        <div className="container grid lg:grid-cols-2 gap-10 items-center">
          <div className="text-center lg:text-left">
            <p className="font-sans text-primary text-sm tracking-brand uppercase font-medium mb-4">
              Bodegón &middot; Parrilla &middot; Desde 2015
            </p>
            <h1 className="font-display text-foreground text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] mb-5">
              Tu bodegón de siempre,{' '}
              <span className="text-primary">ahora a un clic de tu almuerzo</span>
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto lg:mx-0 mb-8">
              Cargá tus almuerzos, elegí el plato del día y retiralo cuando quieras.
              La misma comida casera de siempre, sin vueltas.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Button asChild size="lg" className="uppercase tracking-brand font-medium">
                <Link to="/register">Creá tu cuenta</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="uppercase tracking-brand font-medium"
              >
                <Link to="/login">Ya tengo cuenta</Link>
              </Button>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end" aria-hidden="true">
            <img
              src={heroChef}
              alt=""
              className="w-full max-w-md h-auto select-none pointer-events-none animate-bounce-in"
            />
          </div>
        </div>
      </section>

      {/* ─── HISTORIA ─────────────────────────────────────────────── */}
      <section className="py-16 lg:py-24 bg-card/40">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <Reveal>
              <p className="text-primary text-sm tracking-brand uppercase font-medium mb-2">
                Nuestra historia
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold mb-5 leading-tight">
                El bodegón de la familia Mazzariello,{' '}
                <span className="text-primary">ahora también en tu celular</span>
              </h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  Arias nació hace más de 10 años y sigue siendo lo que fue siempre: un
                  bodegón familiar. Mesas de mantel cuadrillé, parrilla prendida y cocina
                  casera de la que se hace con tiempo.
                </p>
                <p>
                  Ahora podés pedir esa misma comida sin salir de tu casa o de tu
                  trabajo: cargás tus almuerzos, elegís qué comer y lo retirás cuando te
                  quede cómodo.
                </p>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div className="grid grid-cols-2 gap-3">
                <img
                  src={fotoFachada}
                  alt="La esquina de Arias en Núñez"
                  loading="lazy"
                  className="h-full w-full object-cover rounded-lg border border-border shadow-sm"
                />
                <div className="grid grid-rows-2 gap-3">
                  <img
                    src={fotoSalon}
                    alt="El salón de Arias con mesas de mantel cuadrillé"
                    loading="lazy"
                    className="w-full h-full object-cover rounded-lg border border-border shadow-sm"
                  />
                  <img
                    src={platoNapolitana}
                    alt="Suprema napolitana con ensalada"
                    loading="lazy"
                    className="w-full h-full object-cover rounded-lg border border-border shadow-sm"
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── CÓMO FUNCIONA ────────────────────────────────────────── */}
      <section className="py-16 lg:py-24">
        <div className="container">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-primary text-sm tracking-brand uppercase font-medium mb-2">
              Simple de punta a punta
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold">Cómo funciona</h2>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-8">
            {PASOS.map((p, i) => (
              <Reveal key={p.title} delay={i * 140}>
                <div className="h-full bg-card rounded-lg border border-border p-7 shadow-sm text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-primary/10 text-primary mb-4">
                    <p.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-display text-xl font-bold mb-2">{p.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{p.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─────────────────────────────────────────────── */}
      <section className="py-16 lg:py-24 bg-card/40">
        <div className="container">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-3">
              Pedir tu almuerzo nunca fue tan fácil
            </h2>
            <p className="text-muted-foreground">
              Todo lo que necesitás para no pensar más en qué vas a comer hoy.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="h-full bg-card rounded-lg border border-border p-6 shadow-sm">
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-md bg-primary/10 text-primary mb-4">
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-display text-lg font-bold mb-1.5">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── MENÚ / GALERÍA ───────────────────────────────────────── */}
      <section className="py-16 lg:py-24">
        <div className="container">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-primary text-sm tracking-brand uppercase font-medium mb-2">
              Se come con los ojos
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold">Un vistazo a Arias</h2>
          </Reveal>

          <div className="grid grid-cols-2 gap-4 sm:gap-5 max-w-2xl mx-auto">
            {[
              { src: collagePlatos, alt: 'Variedad de platos de Arias' },
              { src: platoHuevo, alt: 'Bife a caballo con ensalada' },
            ].map((f) => (
              <Reveal key={f.alt}>
                <div className="overflow-hidden rounded-lg border border-border shadow-sm group">
                  <img
                    src={f.src}
                    alt={f.alt}
                    loading="lazy"
                    className="w-full aspect-square object-cover transition-transform duration-500 group-hover:scale-105 [filter:contrast(1.05)_saturate(1.1)_brightness(1.02)]"
                  />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA FINAL ────────────────────────────────────────────── */}
      <section className="py-16 lg:py-24 bg-primary text-primary-foreground overflow-hidden">
        <div className="container grid lg:grid-cols-2 gap-10 items-center">
          <Reveal>
            <h2 className="font-display text-3xl sm:text-4xl font-bold leading-tight mb-4">
              ¿Le damos de comer?
            </h2>
            <p className="text-lg leading-relaxed opacity-95 mb-6">
              Creá tu cuenta, cargá tus almuerzos y hacé tu primer pedido en minutos.
            </p>
            <Button asChild size="lg" variant="secondary" className="uppercase tracking-brand font-medium">
              <Link to="/register">Creá tu cuenta</Link>
            </Button>
          </Reveal>

          <div className="flex justify-center lg:justify-end" aria-hidden="true">
            <img
              src={chefOfrece}
              alt=""
              className="w-full max-w-xs h-auto select-none pointer-events-none"
            />
          </div>
        </div>
      </section>

      {/* ─── FOOTER ───────────────────────────────────────────────── */}
      <footer className="border-t border-border py-10">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <p className="font-display text-primary text-2xl font-bold leading-none">ARIAS</p>
            <p className="text-xs tracking-brand uppercase text-muted-foreground mt-1">
              Bodegón &middot; Parrilla &middot; Núñez
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Familia Mazzariello &middot; Desde 2015 &middot; © {2015}–hoy
          </p>
          <Link
            to="/corporate"
            className="text-xs text-muted-foreground hover:text-primary transition-colors underline"
          >
            ¿Tenés una empresa? Conocé nuestra propuesta corporativa
          </Link>
        </div>
      </footer>
    </div>
  );
}
