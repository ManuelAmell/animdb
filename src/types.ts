export interface MediaItem {
  id: number;
  title: string;
  type: 'movie' | 'series';
  year?: string;
  genre?: string;
  status: 'watched' | 'watching' | 'pending' | 'dropped';
  rating: number;
  notes?: string;
  moods: string[];
  isAnime: boolean;
  coverUrl?: string;
  priority: number;
}

export interface Theme {
  id: string;
  emoji: string;
  name: string;
  color: string;
}

export type ViewType = 'list' | 'ranking' | 'temas' | 'pendientes';
export type FilterType = 'all' | 'top' | 'pending';
export type PendingDisplayStyle = 'grid' | 'list';

export const THEMES: Theme[] = [
  { id: 'triste', emoji: '😢', name: 'Triste', color: '#5E9BF5' },
  { id: 'accion', emoji: '⚔️', name: 'Acción', color: '#FF6B6B' },
  { id: 'romance', emoji: '💕', name: 'Romance', color: '#FF85A1' },
  { id: 'psicologico', emoji: '🧠', name: 'Psicológico', color: '#A78BFA' },
  { id: 'individual', emoji: '🦸', name: 'Protagonista único', color: '#F59E0B' },
  { id: 'aventura', emoji: '🌍', name: 'Aventura', color: '#34D399' },
  { id: 'comedia', emoji: '😂', name: 'Comedia', color: '#FBBF24' },
  { id: 'scifi', emoji: '🚀', name: 'Sci-Fi', color: '#60A5FA' },
  { id: 'sobrenatural', emoji: '👻', name: 'Sobrenatural', color: '#818CF8' },
  { id: 'dark', emoji: '🩸', name: 'Oscuro / Gore', color: '#F87171' },
  { id: 'deportes', emoji: '🏃', name: 'Deportes', color: '#4ADE80' },
  { id: 'thriller', emoji: '🕵️', name: 'Thriller', color: '#94A3B8' },
];

export const STATUS_LABELS: Record<string, string> = {
  watched: '✅ Visto',
  watching: '▶️ Viendo',
  pending: '⏳ Pendiente',
  dropped: '❌ Dropped'
};

export const RATING_COLORS: Record<number, string> = {
  0: 'var(--text-muted)',
  1: '#8E8E93',
  2: '#8E8E93',
  3: '#FF6B6B',
  4: '#FF6B6B',
  5: '#FF9F0A',
  6: '#FF9F0A',
  7: '#30D158',
  8: '#30D158',
  9: '#FFD60A',
  10: '#FFD60A'
};

export function getRatingColor(rating: number): string {
  if (rating === 0) return 'var(--text-muted)';
  if (rating >= 9) return '#FFD60A';
  if (rating >= 7) return '#30D158';
  if (rating >= 5) return '#FF9F0A';
  if (rating >= 3) return '#FF6B6B';
  return '#8E8E93';
}

export function getRatingLabel(rating: number): string {
  if (rating === 0) return 'Sin puntuar';
  if (rating === 10) return 'Obra maestra';
  if (rating === 9) return 'Increíble';
  if (rating === 8) return 'Muy bueno';
  if (rating === 7) return 'Bueno';
  if (rating === 6) return 'Pasable';
  if (rating === 5) return 'Regular';
  if (rating >= 3) return 'Malo';
  return 'Terrible';
}