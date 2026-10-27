import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getReviewPrompt, markReviewNever, markReviewOpened } from '@/features/me/services/meApi';

const SNOOZE_MS = 24 * 3_600_000;

/** Clave del dispositivo donde se recuerda cuándo el usuario tocó "Ahora no". */
export function reviewSnoozeKey(userId: number): string {
  return `arias:review-snooze:${userId}`;
}

function isSnoozed(userId: number): boolean {
  try {
    const raw = window.localStorage.getItem(reviewSnoozeKey(userId));
    const at = raw === null ? NaN : Number(raw);
    return Number.isFinite(at) && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

/**
 * Tarjeta de reseña: el servidor decide si corresponde (`show`). "Ahora no" la
 * oculta 24 h en el dispositivo (sin API); "Dejar mi opinión" y "Nunca" la ocultan
 * para siempre avisando al servidor. El ocultamiento es optimista y un POST
 * fallido no la trae de vuelta durante la sesión.
 */
export function useReviewPrompt(userId: number) {
  const { data } = useQuery({
    queryKey: ['reviewPrompt'],
    queryFn: getReviewPrompt,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const [hidden, setHidden] = useState(() => isSnoozed(userId));

  const opened = useMutation({ mutationFn: markReviewOpened });
  const never = useMutation({ mutationFn: markReviewNever });

  return {
    prompt: data?.show && !hidden ? data : null,
    markOpened: () => {
      setHidden(true);
      opened.mutate();
    },
    markNever: () => {
      setHidden(true);
      never.mutate();
    },
    snooze: () => {
      setHidden(true);
      try {
        window.localStorage.setItem(reviewSnoozeKey(userId), String(Date.now()));
      } catch {
        // Sin almacenamiento: se oculta igual durante la sesión.
      }
    },
  };
}
