import raw from '../../public/_headers?raw';
import { describe, expect, it } from 'vitest';

/** Parses a Cloudflare `_headers` file into a map of path -> header -> value. */
function parseHeaders(raw: string): Record<string, Record<string, string>> {
  const rules: Record<string, Record<string, string>> = {};
  let current: Record<string, string> | null = null;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = rules[line.trim()] = {};
      continue;
    }
    const idx = line.indexOf(':');
    if (current && idx > 0) current[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return rules;
}

const all = parseHeaders(raw)['/*'];

function directives(policy: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of policy.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) out[name] = values;
  }
  return out;
}

describe('public/_headers', () => {
  it('declares a rule for every path', () => {
    expect(all).toBeDefined();
  });

  it('sets the baseline security headers', () => {
    expect(all['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
    expect(all['X-Content-Type-Options']).toBe('nosniff');
    expect(all['X-Frame-Options']).toBe('DENY');
    expect(all['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(all['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=(), payment=()');
  });

  it('does not preload HSTS and adds no caching headers', () => {
    expect(all['Strict-Transport-Security']).not.toContain('preload');
    expect(all['Cache-Control']).toBeUndefined();
  });

  it('ships the CSP as report-only, not enforcing', () => {
    expect(all['Content-Security-Policy']).toBeUndefined();
    expect(all['Content-Security-Policy-Report-Only']).toBeTruthy();
  });

  describe('Content-Security-Policy-Report-Only', () => {
    const csp = directives(all['Content-Security-Policy-Report-Only'] ?? '');

    it('locks down framing, base URI, plugins and forms', () => {
      expect(csp['default-src']).toEqual(["'self'"]);
      expect(csp['frame-ancestors']).toEqual(["'none'"]);
      expect(csp['base-uri']).toEqual(["'self'"]);
      expect(csp['object-src']).toEqual(["'none'"]);
      expect(csp['form-action']).toEqual(["'self'"]);
    });

    it('allows Google Identity Services', () => {
      expect(csp['script-src']).toContain("'self'");
      expect(csp['script-src']).toContain('https://accounts.google.com/gsi/client');
      expect(csp['frame-src']).toContain('https://accounts.google.com');
      expect(csp['connect-src']).toContain('https://accounts.google.com');
      expect(csp['style-src']).toContain('https://accounts.google.com/gsi/style');
    });

    it('allows Google Fonts', () => {
      expect(csp['style-src']).toContain('https://fonts.googleapis.com');
      expect(csp['font-src']).toContain('https://fonts.gstatic.com');
    });

    it('allows the API, image storage and uploads', () => {
      expect(csp['connect-src']).toContain('https://*.ariasbodegon.com');
      expect(csp['connect-src']).toContain('https://*.r2.cloudflarestorage.com');
      expect(csp['img-src']).toEqual(
        expect.arrayContaining(["'self'", 'data:', 'blob:', 'https://*.r2.dev', 'https://*.ariasbodegon.com']),
      );
    });

    it('never allows eval or wildcard script sources', () => {
      expect(csp['script-src']).not.toContain("'unsafe-eval'");
      expect(csp['script-src']).not.toContain("'unsafe-inline'");
      expect(csp['script-src']).not.toContain('*');
    });
  });
});
