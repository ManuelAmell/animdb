const ESC_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const SAFE_COVER_PROTOCOLS = new Set(['http:', 'https:']);

export function isSafeCoverUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return SAFE_COVER_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

/** Devuelve la URL recortada si es http(s); si no, undefined. */
export function sanitizeCoverUrl(url: string | undefined | null): string | undefined {
  if (url === undefined || url === null) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  return isSafeCoverUrl(trimmed) ? trimmed : undefined;
}

export function esc(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[&<>"']/g, (c) => ESC_MAP[c] ?? c);
}

export function escAttr(value: string | number | undefined | null): string {
  return esc(value);
}

/** Escapa un src de carátula solo si la URL es http(s) segura. */
export function escCoverSrc(url: string | undefined | null): string {
  const safe = sanitizeCoverUrl(url);
  return safe ? escAttr(safe) : '';
}
