const ESC_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function esc(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[&<>"']/g, (c) => ESC_MAP[c] ?? c);
}

export function escAttr(value: string | number | undefined | null): string {
  return esc(value);
}
