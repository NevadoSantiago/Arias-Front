import { Link } from 'react-router-dom';
import {
  Clock,
  Truck,
  BarChart3,
  SlidersHorizontal,
  UtensilsCrossed,
  HeartHandshake,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LandingNav } from '@/features/landing/components/LandingNav';
import { WhatsAppFab } from '@/features/landing/components/WhatsAppFab';
import { QuoteForm } from '@/features/landing/components/QuoteForm';
import { Reveal } from '@/features/landing/components/Reveal';
import { SECTIONS } from '@/features/landing/landingConfig';
import heroChef from '@/assets/illustrations/BienvenidaHermanos.svg';
import chefCocinando from '@/assets/illustrations/Chef-Cocinando.svg';
import chefOfrece from '@/assets/illustrations/chef-ofrece.svg';
import panaderoDuda from '@/assets/illustrations/Panadero-Duda.svg';
// Fotos reales de Arias (optimizadas en src/assets/landing/photos/)
import fotoFachada from '@/assets/landing/photos/fachada.jpg';
import fotoSalon from '@/assets/landing/photos/salon.jpg';
import fotoInteriorLamparas from '@/assets/landing/photos/interior-lamparas.jpg';
import fotoInteriorVinos from '@/assets/landing/photos/interior-vinos.jpg';
import fotoVentanaSalon from '@/assets/landing/photos/ventana-salon.jpg';
import fotoTiraDeAsado from '@/assets/landing/photos/tira-de-asado-tile.jpg';
// Versiones "tile" (cuadradas, al tamaño de display) para evitar el moiré del mantel
import platoHuevo from '@/assets/landing/photos/plato-huevo-tile.jpg';
import platoNapolitana from '@/assets/landing/photos/plato-napolitana-tile.jpg';
import platoEnsaladaPollo from '@/assets/landing/photos/plato-ensalada-pollo-tile.jpg';
import collagePlatos from '@/assets/landing/photos/collage-platos-tile.jpg';

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const DIFERENCIADORES = [
  {
    img: chefCocinando,
    title: 'Comida casera de bodegón',
    text: 'Más de 10 años de trayectoria, cocinando rico y dando el mejor servicio a todas las empresas de la zona.',
  },
  {
    img: panaderoDuda,
    title: 'Presupuesto personalizado para empresas',
    text: 'Acordamos con cada empresa el presupuesto real por vianda.',
  },
  {
    img: chefOfrece,
    title: 'Control y autogestión para su empresa',
    text: 'Desde su panel de gestión puede monitorear consumo, dar altas y bajas a cada empleado y personalizar su experiencia.',
  },
];

const PASOS = [
  {
    n: '01',
    title: 'Su empresa configura',
    text: 'Define categorías, precios y horarios. Usted tiene el control de qué puede pedir cada empleado.',
  },
  {
    n: '02',
    title: 'El usuario elige',
    text: 'Entra a la web, hace su pedido en segundos y listo.',
  },
  {
    n: '03',
    title: 'Arias cocina y entrega',
    text: 'Cocinamos la mejor comida casera y la entregamos en el horario pactado. Sin demoras, sin complicaciones.',
  },
];

const FEATURES = [
  { icon: Clock, title: 'Horarios por empresa', text: 'Cada empresa define su horario de entrega. Nos adaptamos a su operativa, no al revés.' },
  { icon: Truck, title: 'Entrega a domicilio', text: 'Llevamos los pedidos directo a su oficina, listos para almorzar.' },
  { icon: BarChart3, title: 'Panel de control', text: 'Mire en directo los consumos y los pedidos de su equipo.' },
  { icon: SlidersHorizontal, title: 'App configurable', text: 'Categorías, platos, precios y permisos: todo a su medida desde el panel de administración.' },
  { icon: UtensilsCrossed, title: 'Menú variado', text: 'Ofrecemos distintas categorías de menú: usted elige la que mejor se ajusta al presupuesto y a los gustos de su equipo.' },
  { icon: HeartHandshake, title: 'Trato familiar', text: 'Detrás de Arias está la familia Mazzariello. Habla con personas, no con un call center.' },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <LandingNav />
      <WhatsAppFab />

      {/* ─── HERO ─────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-16 lg:pt-36 lg:pb-24">
        <div className="container grid lg:grid-cols-2 gap-10 items-center">
          <div className="text-center lg:text-left">
            <p className="font-sans text-primary text-sm tracking-brand uppercase font-medium mb-4">
              Bodegón &middot; Parrilla &middot; Desde 2015
            </p>
            <h1 className="font-display text-foreground text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] mb-5">
              Comida casera de bodegón,{' '}
              <span className="text-primary">pensada para su empresa</span>
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto lg:mx-0 mb-8">
              Adaptamos nuestra propuesta de bodegón clásico porteño a la medida de lo
              que su empresa necesita. Comida de primera calidad, servicio personalizado
              y compromiso con su experiencia son nuestros pilares fundamentales.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Button
                size="lg"
                className="uppercase tracking-brand font-medium"
                onClick={() => scrollToId(SECTIONS.cotizacion)}
              >
                Pida su cotización
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="uppercase tracking-brand font-medium"
              >
                <Link to="/login">Ya soy cliente</Link>
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

      {/* ─── DIFERENCIADORES ──────────────────────────────────────── */}
      <section id={SECTIONS.diferenciadores} className="py-16 lg:py-24 bg-card/40">
        <div className="container">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-3">
              ¿Por qué Arias?
            </h2>
            <p className="text-muted-foreground">
              Somos un bodegón familiar que intenta llevar su amor y dedicación en
              cada plato que hacemos.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-8">
            {DIFERENCIADORES.map((d, i) => (
              <Reveal key={d.title} delay={i * 120}>
                <div className="h-full bg-card rounded-lg border border-border p-7 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md text-center">
                  <img src={d.img} alt="" className="h-28 w-auto mb-5 mx-auto block select-none pointer-events-none" />
                  <h3 className="font-display text-xl font-bold mb-2">{d.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{d.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── QUIÉNES SOMOS ────────────────────────────────────────── */}
      <section id={SECTIONS.quienes} className="py-16 lg:py-24">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <Reveal>
              <p className="text-primary text-sm tracking-brand uppercase font-medium mb-2">
                Quiénes somos
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold mb-5 leading-tight">
                El bodegón de siempre,{' '}
                <span className="text-primary">ahora a un clic de distancia</span>
              </h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  Arias nació hace más de 10 años como lo que sigue siendo hoy: un bodegón
                  familiar de la familia Mazzariello. Mesas de mantel cuadrillé, parrilla
                  prendida y cocina casera de la que se hace con tiempo.
                </p>
                <p>
                  Cuando las empresas nos empezaron a pedir viandas para sus equipos, no
                  cambiamos lo que somos: llevamos <strong className="text-foreground">la
                  misma comida que servimos en el salón</strong> a las oficinas. No somos
                  un servicio de viandas rápidas. Somos el bodegón de la esquina, ahora
                  también en su trabajo.
                </p>
              </div>
            </Reveal>

            {/* Mosaico de ambiente — fachada vertical protagónica + interiores 2x2 */}
            <Reveal delay={120}>
              <div className="grid grid-cols-2 gap-3">
                {/* La esquina de Arias, vertical, a la izquierda */}
                <img
                  src={fotoFachada}
                  alt="La esquina de Arias en Núñez"
                  loading="lazy"
                  className="h-full w-full object-cover rounded-lg border border-border shadow-sm"
                />
                {/* Interiores a la derecha, en grilla 2x2 */}
                <div className="grid grid-cols-2 gap-3">
                  <img
                    src={fotoSalon}
                    alt="El salón de Arias con mesas de mantel cuadrillé"
                    loading="lazy"
                    className="w-full h-40 sm:h-44 object-cover rounded-lg border border-border shadow-sm"
                  />
                  <img
                    src={fotoInteriorLamparas}
                    alt="Interior de Arias con lámparas de mimbre"
                    loading="lazy"
                    className="w-full h-40 sm:h-44 object-cover rounded-lg border border-border shadow-sm"
                  />
                  <img
                    src={fotoInteriorVinos}
                    alt="La barra de Arias con su selección de vinos"
                    loading="lazy"
                    className="w-full h-40 sm:h-44 object-cover rounded-lg border border-border shadow-sm"
                  />
                  <img
                    src={fotoVentanaSalon}
                    alt="Vista del salón de Arias desde la ventana"
                    loading="lazy"
                    className="w-full h-40 sm:h-44 object-cover rounded-lg border border-border shadow-sm"
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── CÓMO FUNCIONA ────────────────────────────────────────── */}
      <section id={SECTIONS.comoFunciona} className="py-16 lg:py-24 bg-card/40">
        <div className="container">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-primary text-sm tracking-brand uppercase font-medium mb-2">
              Simple de punta a punta
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold">Cómo funciona</h2>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {PASOS.map((p, i) => (
              <Reveal key={p.n} delay={i * 140}>
                <div className="relative text-center md:text-left">
                  <span className="font-display text-6xl font-bold text-primary/15 leading-none">
                    {p.n}
                  </span>
                  <h3 className="font-display text-xl font-bold mt-2 mb-2">{p.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{p.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─────────────────────────────────────────────── */}
      <section id={SECTIONS.features} className="py-16 lg:py-24">
        <div className="container">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-3">
              Todo lo que su empresa necesita
            </h2>
            <p className="text-muted-foreground">
              Una herramienta completa para que dar de comer a su equipo deje de ser un problema.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 100}>
                <div className="h-full bg-card rounded-lg border border-border p-6 shadow-sm">
                  <div className="inline-flex items-center justify-center w-11 h-11 rounded-md bg-primary/10 text-primary mb-4">
                    <f.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-display text-lg font-bold mb-1.5">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── EL CHISTE DE LA TIRA DE ASADO ────────────────────────── */}
      <section className="py-16 lg:py-24 bg-primary text-primary-foreground overflow-hidden">
        <div className="container grid lg:grid-cols-2 gap-10 items-center">
          <Reveal>
            <div className="overflow-hidden rounded-xl shadow-lg shadow-black/20 rotate-[-2deg]">
              <img
                src={fotoTiraDeAsado}
                alt="Bife de chorizo de Arias"
                loading="lazy"
                className="w-full h-72 sm:h-80 object-cover object-[50%_15%]"
              />
            </div>
          </Reveal>

          <Reveal delay={120}>
            <p className="text-sm tracking-brand uppercase font-medium opacity-80 mb-3">
              Hablemos claro 😏
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold leading-tight mb-4">
              ¿Ves este platazo?
            </h2>
            <p className="text-lg leading-relaxed opacity-95 mb-3">
              La idea es llevar la calidad y la cantidad que tanto nos caracteriza
              directo a tus oficinas.
            </p>
            <p className="text-lg leading-relaxed opacity-95">
              No somos una empresa de viandas industriales, somos un bodegón familiar
              que busca dar la mejor solución a los almuerzos de tu equipo.
            </p>
            <div className="mt-6">
              <Button
                size="lg"
                variant="secondary"
                className="uppercase tracking-brand font-medium"
                onClick={() => scrollToId(SECTIONS.cotizacion)}
              >
                Dale, me interesa
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── MENÚ / GALERÍA ───────────────────────────────────────── */}
      <section id={SECTIONS.menu} className="py-16 lg:py-24">
        <div className="container">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-primary text-sm tracking-brand uppercase font-medium mb-2">
              Se come con los ojos
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold">Un vistazo a Arias</h2>
          </Reveal>

          <div className="grid grid-cols-2 gap-4 sm:gap-5 max-w-3xl mx-auto">
            {[
              { src: collagePlatos, alt: 'Variedad de platos de Arias' },
              { src: platoHuevo, alt: 'Bife a caballo con ensalada' },
              { src: platoNapolitana, alt: 'Suprema napolitana con ensalada' },
              { src: platoEnsaladaPollo, alt: 'Ensalada con pollo, champiñones y nueces' },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 100}>
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

      {/* ─── COTIZACIÓN ───────────────────────────────────────────── */}
      <section id={SECTIONS.cotizacion} className="py-16 lg:py-24 bg-card/40">
        <div className="container grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <p className="text-primary text-sm tracking-brand uppercase font-medium mb-2">
              Empecemos
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
              Pida su cotización
            </h2>
            <p className="text-muted-foreground mb-6">
              Cuéntenos cuántos son y qué necesita. Le armamos una propuesta a medida
              para su empresa, sin compromiso.
            </p>
            <img
              src={chefOfrece}
              alt=""
              className="hidden lg:block w-56 h-auto select-none pointer-events-none"
            />
          </Reveal>

          <Reveal delay={120}>
            <div className="bg-card rounded-lg border border-border p-7 shadow-sm">
              <QuoteForm />
            </div>
          </Reveal>
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
        </div>
      </footer>
    </div>
  );
}
