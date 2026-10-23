/**
 * Mirrors the backend PrivateIpv4 rule: 4 octets of 1-3 digits, no leading zeros, 0-255,
 * private ranges only (10/8, 172.16/12, 192.168/16). Returns a Spanish message or null.
 */
export function hostError(raw: string): string | null {
  const host = raw.trim();
  if (!host) return 'Ingresá la IP de la ticketera.';
  const parts = host.split('.');
  if (parts.length !== 4) {
    return 'Escribí una IP con 4 números separados por puntos, como 192.168.0.121.';
  }
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^[0-9]{1,3}$/.test(part)) return 'Usá solo números y puntos, como 192.168.0.121.';
    if (part.length > 1 && part.startsWith('0')) {
      return 'Sacá los ceros a la izquierda (192.168.0.12, no 192.168.000.012).';
    }
    const n = parseInt(part, 10);
    if (n > 255) return 'Cada número de la IP va de 0 a 255.';
    octets.push(n);
  }
  const [a, b] = octets;
  const isPrivate = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  if (!isPrivate) {
    return 'Tiene que ser una IP de la red del local: 10.x.x.x, 172.16-31.x.x o 192.168.x.x.';
  }
  return null;
}

export function portError(raw: string): string | null {
  const s = raw.trim();
  if (!s) return 'Ingresá el puerto.';
  if (!/^[0-9]+$/.test(s)) return 'El puerto es un número entre 1 y 65535.';
  const n = parseInt(s, 10);
  if (n < 1 || n > 65535) return 'El puerto es un número entre 1 y 65535.';
  return null;
}
