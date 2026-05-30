import type { MediaItem } from './types';

export const EXPORT_VERSION = 2;

export interface ExportBundle {
  version: number;
  app: 'AniMDB';
  exportedAt: string;
  itemCount: number;
  items: MediaItem[];
  nextId?: number;
}

export interface ParsedImportItem {
  title: string;
  type: 'movie' | 'series';
  year?: string;
  genre?: string;
  status: MediaItem['status'];
  rating: number;
  notes?: string;
  moods: string[];
  tags: string[];
  isAnime: boolean;
  coverUrl?: string;
}

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export type ExportFormat = 'json' | 'csv' | 'txt' | 'txt-full' | 'markdown';
export type ImportFormat = 'json' | 'csv' | 'txt';

function dateStamp(): string {
  return new Date().toISOString().split('T')[0];
}

function csvEscape(value: string | number | boolean | undefined | null): string {
  const str = value === undefined || value === null ? '' : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function normalizeStatus(raw: string | undefined, rating: number): MediaItem['status'] {
  const s = (raw || '').toLowerCase().trim();
  if (['watched', 'visto', 'seen', 'done'].includes(s)) return 'watched';
  if (['watching', 'viendo', 'ongoing'].includes(s)) return 'watching';
  if (['pending', 'pendiente', 'plan', 'todo'].includes(s)) return 'pending';
  if (['dropped', 'drop', 'abandonado'].includes(s)) return 'dropped';
  return rating > 0 ? 'watched' : 'pending';
}

function parseBool(raw: string | undefined, fallback = false): boolean {
  const s = (raw || '').toLowerCase().trim();
  if (['1', 'true', 'yes', 'si', 'sí', 'anime'].includes(s)) return true;
  if (['0', 'false', 'no'].includes(s)) return false;
  return fallback;
}

function parseType(raw: string | undefined): 'movie' | 'series' {
  const s = (raw || '').toLowerCase().trim();
  if (['series', 'serie', 'tv', 'anime'].includes(s)) return 'series';
  return 'movie';
}

function parseRating(raw: string | undefined): number {
  if (!raw?.trim()) return 0;
  const n = parseFloat(raw.replace(',', '.'));
  return Number.isFinite(n) ? Math.min(10, Math.max(0, n)) : 0;
}

function extractYearFromTitle(title: string): { title: string; year?: string } {
  const match = title.match(/^(.*)\((\d{4})\)\s*$/);
  if (!match) return { title: title.trim() };
  return { title: match[1].trim(), year: match[2] };
}

export function detectImportFormat(filename: string, content: string): ImportFormat {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'csv') return 'csv';
  if (ext === 'json') return 'json';
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (trimmed.includes('title,type,year') || trimmed.split('\n')[0]?.includes(',')) return 'csv';
  return 'txt';
}

export function parseTxtImport(text: string): { items: ParsedImportItem[]; errors: string[] } {
  const items: ParsedImportItem[] = [];
  const errors: string[] = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.includes('|')) {
      const parts = line.split('|').map((p) => p.trim());
      const titlePart = parts[0] || '';
      const { title, year: yearFromTitle } = extractYearFromTitle(titlePart);
      const rating = parseRating(parts[1]);
      items.push({
        title,
        type: parseType(parts[2]),
        year: parts[3] || yearFromTitle,
        genre: parts[4] || '',
        status: normalizeStatus(parts[5], rating),
        rating,
        notes: parts[6] || '',
        moods: (parts[7] || '')
          .split(';')
          .map((m) => m.trim())
          .filter(Boolean),
        tags: (parts[8] || '')
          .split(';')
          .map((m) => m.trim())
          .filter(Boolean),
        isAnime: parseBool(parts[9], true),
        coverUrl: parts[10] || undefined,
      });
      continue;
    }

    const dashMatch = line.match(/^(.+?)\s*[-–:]\s*(\d+(?:[.,]\d+)?)\s*$/);
    if (dashMatch) {
      const { title, year } = extractYearFromTitle(dashMatch[1].trim());
      items.push({
        title,
        year,
        type: 'movie',
        rating: parseRating(dashMatch[2]),
        status: parseRating(dashMatch[2]) > 0 ? 'watched' : 'pending',
        moods: [],
        tags: [],
        isAnime: true,
      });
      continue;
    }

    const bracketMatch = line.match(/^\[(movie|serie|series|película|pelicula)\]\s*(.+)$/i);
    if (bracketMatch) {
      const { title, year } = extractYearFromTitle(bracketMatch[2].trim());
      items.push({
        title,
        year,
        type: parseType(bracketMatch[1]),
        rating: 0,
        status: 'pending',
        moods: [],
        tags: [],
        isAnime: true,
      });
      continue;
    }

    if (line.length >= 2) {
      const { title, year } = extractYearFromTitle(line);
      items.push({
        title,
        year,
        type: 'movie',
        rating: 0,
        status: 'pending',
        moods: [],
        tags: [],
        isAnime: true,
      });
      continue;
    }

    errors.push(`Línea no reconocida: ${line}`);
  }

  return { items, errors };
}

export function parseCsvImport(text: string): { items: ParsedImportItem[]; errors: string[] } {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length === 0) return { items: [], errors: ['CSV vacío'] };

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const hasHeader = header.includes('title') || header.includes('titulo');
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const idx = (names: string[]) => header.findIndex((h) => names.includes(h));

  const titleIdx = hasHeader ? idx(['title', 'titulo', 'nombre']) : 0;
  const typeIdx = hasHeader ? idx(['type', 'tipo']) : 1;
  const yearIdx = hasHeader ? idx(['year', 'año', 'ano']) : 2;
  const genreIdx = hasHeader ? idx(['genre', 'genero', 'género']) : 3;
  const statusIdx = hasHeader ? idx(['status', 'estado']) : 4;
  const ratingIdx = hasHeader ? idx(['rating', 'puntuacion', 'puntuación', 'score']) : 5;
  const notesIdx = hasHeader ? idx(['notes', 'notas']) : 6;
  const moodsIdx = hasHeader ? idx(['moods', 'temas']) : 7;
  const tagsIdx = hasHeader ? idx(['tags', 'etiquetas']) : 8;
  const animeIdx = hasHeader ? idx(['isanime', 'is_anime', 'anime']) : 9;
  const coverIdx = hasHeader ? idx(['coverurl', 'cover', 'caratula', 'carátula']) : 10;

  const items: ParsedImportItem[] = [];
  const errors: string[] = [];

  for (const line of dataLines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const cols = parseCsvLine(line);
    const title = cols[titleIdx >= 0 ? titleIdx : 0]?.trim();
    if (!title) {
      errors.push(`Fila sin título: ${line}`);
      continue;
    }
    const rating = parseRating(cols[ratingIdx >= 0 ? ratingIdx : 5]);
    items.push({
      title,
      type: parseType(cols[typeIdx >= 0 ? typeIdx : 1]),
      year: cols[yearIdx >= 0 ? yearIdx : 2] || undefined,
      genre: cols[genreIdx >= 0 ? genreIdx : 3] || undefined,
      status: normalizeStatus(cols[statusIdx >= 0 ? statusIdx : 4], rating),
      rating,
      notes: cols[notesIdx >= 0 ? notesIdx : 6] || undefined,
      moods: (cols[moodsIdx >= 0 ? moodsIdx : 7] || '')
        .split(';')
        .map((m) => m.trim())
        .filter(Boolean),
      tags: (cols[tagsIdx >= 0 ? tagsIdx : 8] || '')
        .split(';')
        .map((m) => m.trim())
        .filter(Boolean),
      isAnime: parseBool(cols[animeIdx >= 0 ? animeIdx : 9], true),
      coverUrl: cols[coverIdx >= 0 ? coverIdx : 10] || undefined,
    });
  }

  return { items, errors };
}

export function parseJsonImport(text: string): { items: MediaItem[]; nextId?: number; errors: string[] } {
  const errors: string[] = [];
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return { items: data, errors };
    if (data.items && Array.isArray(data.items)) {
      return { items: data.items, nextId: data.nextId, errors };
    }
    errors.push('JSON sin campo items');
    return { items: [], errors };
  } catch {
    errors.push('JSON inválido');
    return { items: [], errors };
  }
}

export function exportJsonBundle(items: MediaItem[], nextId: number): string {
  const bundle: ExportBundle = {
    version: EXPORT_VERSION,
    app: 'AniMDB',
    exportedAt: new Date().toISOString(),
    itemCount: items.length,
    items,
    nextId,
  };
  return JSON.stringify(bundle, null, 2);
}

export function exportCsv(items: MediaItem[]): string {
  const header =
    'title,type,year,genre,status,rating,notes,moods,tags,isAnime,coverUrl,priority';
  const rows = items.map((item) =>
    [
      csvEscape(item.title),
      csvEscape(item.type),
      csvEscape(item.year),
      csvEscape(item.genre),
      csvEscape(item.status),
      csvEscape(item.rating),
      csvEscape(item.notes),
      csvEscape(item.moods?.join(';')),
      csvEscape(item.tags?.join(';')),
      csvEscape(item.isAnime ? 1 : 0),
      csvEscape(item.coverUrl),
      csvEscape(item.priority),
    ].join(',')
  );
  return `# AniMDB export ${dateStamp()}\n${header}\n${rows.join('\n')}`;
}

export function exportTxtSimple(items: MediaItem[]): string {
  const rated = items.filter((i) => i.rating > 0).sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title));
  const lines = rated.map((i) => `${i.title} - ${i.rating}`);
  return `# AniMDB · ${dateStamp()} · ${rated.length} títulos puntuados\n# Formato: Título - Puntuación\n\n${lines.join('\n')}`;
}

export function exportTxtFull(items: MediaItem[]): string {
  const header = '# Formato: Título | Rating | Tipo | Año | Género | Estado | Notas | Moods | Anime | CoverURL';
  const lines = items.map((i) =>
    [
      i.title,
      i.rating,
      i.type,
      i.year || '',
      i.genre || '',
      i.status,
      (i.notes || '').replace(/\|/g, '/'),
      (i.moods || []).join(';'),
      i.isAnime ? 'yes' : 'no',
      i.coverUrl || '',
    ].join(' | ')
  );
  return `# AniMDB · exportación completa · ${dateStamp()}\n${header}\n\n${lines.join('\n')}`;
}

export function exportMarkdown(items: MediaItem[]): string {
  const rated = items.filter((i) => i.rating > 0).sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title));
  const groups = new Map<number, MediaItem[]>();
  for (const item of rated) {
    const key = Math.floor(item.rating);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  let md = `# Mi lista AniMDB (${dateStamp()})\n\n`;
  for (const score of [...groups.keys()].sort((a, b) => b - a)) {
    md += `## ★ ${score}${groups.get(score)!.some((i) => i.rating % 1 !== 0) ? '+' : ''}\n\n`;
    for (const item of groups.get(score)!) {
      const type = item.type === 'movie' ? 'Película' : item.isAnime ? 'Anime' : 'Serie';
      md += `- **${item.title}** (${item.rating}/10) · ${type}${item.year ? ` · ${item.year}` : ''}\n`;
    }
    md += '\n';
  }

  const pending = items.filter((i) => i.status === 'pending');
  if (pending.length) {
    md += `## Pendientes (${pending.length})\n\n`;
    pending.forEach((i) => {
      md += `- ${i.title}${i.year ? ` (${i.year})` : ''}\n`;
    });
  }

  return md.trim();
}

export function buildExportFile(format: ExportFormat, items: MediaItem[], nextId: number): { content: string; mime: string; filename: string } {
  const stamp = dateStamp();
  switch (format) {
    case 'json':
      return {
        content: exportJsonBundle(items, nextId),
        mime: 'application/json',
        filename: `animdb-backup-${stamp}.json`,
      };
    case 'csv':
      return { content: exportCsv(items), mime: 'text/csv', filename: `animdb-${stamp}.csv` };
    case 'txt-full':
      return { content: exportTxtFull(items), mime: 'text/plain', filename: `animdb-completo-${stamp}.txt` };
    case 'markdown':
      return { content: exportMarkdown(items), mime: 'text/markdown', filename: `animdb-lista-${stamp}.md` };
    case 'txt':
    default:
      return { content: exportTxtSimple(items), mime: 'text/plain', filename: `animdb-lista-${stamp}.txt` };
  }
}

export function downloadText(content: string, mime: string, filename: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
