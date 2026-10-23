import { describe, expect, it } from 'vitest';
import { hostError, portError } from './printerAddress';

describe('hostError', () => {
  it.each(['192.168.0.121', '10.0.0.1', '172.16.0.5', '172.31.255.254', ' 192.168.1.1 '])(
    'accepts the private address %s',
    (host) => expect(hostError(host)).toBeNull(),
  );

  it('asks for a value when empty', () => {
    expect(hostError('  ')).toBe('Ingresá la IP de la ticketera.');
  });

  it('requires exactly 4 octets', () => {
    expect(hostError('192.168.0')).toMatch(/4 números separados por puntos/);
    expect(hostError('192.168.0.1.5')).toMatch(/4 números separados por puntos/);
  });

  it('rejects non numeric octets', () => {
    expect(hostError('192.168.a.1')).toMatch(/solo números y puntos/);
    expect(hostError('192.168.0.1000')).toMatch(/solo números y puntos/);
  });

  it('rejects leading zeros', () => {
    expect(hostError('192.168.000.012')).toMatch(/ceros a la izquierda/);
    expect(hostError('192.168.0.012')).toMatch(/ceros a la izquierda/);
  });

  it('rejects octets above 255', () => {
    expect(hostError('192.168.0.256')).toMatch(/0 a 255/);
  });

  it.each(['8.8.8.8', '172.15.0.1', '172.32.0.1', '192.169.0.1', '11.0.0.1'])(
    'rejects the public address %s',
    (host) => expect(hostError(host)).toMatch(/red del local/),
  );
});

describe('portError', () => {
  it.each(['1', '9100', '65535'])('accepts %s', (port) => expect(portError(port)).toBeNull());

  it('asks for a value when empty', () => {
    expect(portError('')).toBe('Ingresá el puerto.');
  });

  it.each(['0', '65536', 'abc', '91.5', '-1'])('rejects %s', (port) =>
    expect(portError(port)).toBe('El puerto es un número entre 1 y 65535.'),
  );
});
