/** Clave del dispositivo donde se recuerda que este usuario ya abrió la sorpresa. */
export function surpriseStorageKey(userId: number): string {
  return `arias:surprise-opened:${userId}`;
}

export function wasOpened(userId: number): boolean {
  try {
    return window.localStorage.getItem(surpriseStorageKey(userId)) === '1';
  } catch {
    return false;
  }
}

export function rememberOpened(userId: number): void {
  try {
    window.localStorage.setItem(surpriseStorageKey(userId), '1');
  } catch {
    // Sin almacenamiento (modo privado, bloqueado): la sorpresa igual se abre, solo no se recuerda.
  }
}
