/** Festejos de la línea de beneficios: cada premio se festeja una sola vez por usuario y dispositivo. */
export function celebrationKey(userId: number, rewardKey: string): string {
  return `arias:loyalty-celebrated:${userId}:${rewardKey}`;
}

export function wasCelebrated(userId: number, rewardKey: string): boolean {
  try {
    return window.localStorage.getItem(celebrationKey(userId, rewardKey)) === '1';
  } catch {
    return false;
  }
}

export function rememberCelebrated(userId: number, rewardKey: string): void {
  try {
    window.localStorage.setItem(celebrationKey(userId, rewardKey), '1');
  } catch {
    // Sin almacenamiento: el festejo se ve igual, solo no se recuerda.
  }
}
