import { getApiUrl } from './config';
import type { ParsedImportItem } from './io';

export type ImportSource = 'anilist' | 'mal' | 'trakt';

export interface ExternalImportResult {
  source: ImportSource;
  username: string;
  count: number;
  items: ParsedImportItem[];
}

function normalizeTag(tag: string): string {
  const t = tag.trim().toLowerCase();
  return t.startsWith('#') ? t : `#${t}`;
}

export function parseLetterboxdCsv(text: string): ParsedImportItem[] {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase();
  const isLetterboxd = header.includes('name') && header.includes('year');
  if (!isLetterboxd) return [];

  const cols = lines[0].split(',').map((c) => c.trim().toLowerCase());
  const nameIdx = cols.indexOf('name');
  const yearIdx = cols.indexOf('year');
  const ratingIdx = cols.indexOf('rating');

  const items: ParsedImportItem[] = [];
  for (const line of lines.slice(1)) {
    const parts = line.match(/(".*?"|[^,]+)(?=,|$)/g)?.map((p) => p.replace(/^"|"$/g, '').trim()) || [];
    const title = parts[nameIdx >= 0 ? nameIdx : 0];
    if (!title) continue;
    const year = parts[yearIdx >= 0 ? yearIdx : 1];
    const stars = parseFloat(parts[ratingIdx >= 0 ? ratingIdx : 2] || '0');
    const rating = stars > 0 ? Math.min(10, stars * 2) : 0;
    items.push({
      title,
      type: 'movie',
      year: year || undefined,
      rating,
      status: rating > 0 ? 'watched' : 'pending',
      isAnime: false,
      moods: [],
      tags: [],
    });
  }
  return items;
}

export async function fetchExternalList(
  source: ImportSource,
  username: string
): Promise<ExternalImportResult> {
  const res = await fetch(`${getApiUrl()}/import/${source}/${encodeURIComponent(username)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al importar');
  return data;
}

export function parseExternalUsername(input: string): { source: ImportSource | null; username: string } {
  const raw = input.trim();
  const urlMatch = raw.match(/(?:anilist\.co|myanimelist\.net|trakt\.tv)\/user\/([^/?#]+)/i);
  if (urlMatch) {
    if (/anilist/i.test(raw)) return { source: 'anilist', username: urlMatch[1] };
    if (/myanimelist|mal/i.test(raw)) return { source: 'mal', username: urlMatch[1] };
    if (/trakt/i.test(raw)) return { source: 'trakt', username: urlMatch[1] };
  }
  if (/^mal:/i.test(raw)) return { source: 'mal', username: raw.replace(/^mal:/i, '').trim() };
  if (/^anilist:/i.test(raw)) return { source: 'anilist', username: raw.replace(/^anilist:/i, '').trim() };
  if (/^trakt:/i.test(raw)) return { source: 'trakt', username: raw.replace(/^trakt:/i, '').trim() };
  return { source: null, username: raw };
}

export { normalizeTag };
