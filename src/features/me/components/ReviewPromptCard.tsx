import { ExternalLink, Star } from 'lucide-react';
import { useReviewPrompt } from '@/features/me/hooks/useReviewPrompt';

/**
 * Tarjeta "¿Qué tal estuvo tu {plato}?" del inicio (prototipo `InicioSorpresa.dc.html`).
 * Separada de la sorpresa y sin mencionarla. Solo se muestra si el servidor lo indica.
 */
export function ReviewPromptCard({ userId }: { userId: number }) {
  const { prompt, markOpened, markNever, snooze } = useReviewPrompt(userId);
  if (!prompt) return null;

  return (
    <section
      aria-labelledby="review-prompt-title"
      className="mb-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-[#FFFCF5] text-foreground"
        >
          <Star className="h-[19px] w-[19px]" strokeWidth={1.8} />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="review-prompt-title" className="m-0 font-display text-lg font-bold leading-tight">
            ¿Qué tal estuvo tu {prompt.dishName ?? 'almuerzo'}?
          </h2>
          <p className="m-0 text-sm leading-normal text-muted-foreground">Contanos en Google, nos ayuda mucho.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <a
          href={prompt.reviewUrl ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          onClick={markOpened}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md border-[1.5px] lg:flex-none lg:px-6 border-foreground text-[13.5px] font-bold text-foreground no-underline"
        >
          Dejar mi opinión
          <ExternalLink className="h-[15px] w-[15px]" aria-hidden="true" />
        </a>
        <button
          type="button"
          onClick={snooze}
          className="h-11 border-0 bg-transparent px-3.5 text-[13.5px] font-semibold text-muted-foreground"
        >
          Ahora no
        </button>
        <button
          type="button"
          onClick={markNever}
          className="h-11 border-0 bg-transparent px-2 text-[13.5px] font-semibold text-muted-foreground"
        >
          Nunca
        </button>
      </div>
    </section>
  );
}
