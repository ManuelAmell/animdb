import type { AuthUser, ContentFilter, FilterType, KanbanGroup, MediaItem, SavedFilter, ViewType } from './types';

export interface App {
  importMode: 'merge' | 'update';
  movieFilter: FilterType;
  seriesFilter: FilterType;
  rankFilter: 'all' | 'movie' | 'series' | 'unrated' | 'tema';
  activeTemaId: string | null;
  modalTags: string[];
  kanbanDragId: number | null;
  contentFilter: ContentFilter;
  bulkMode: boolean;
  selectedIds: Set<number>;
  savedFilters: SavedFilter[];
  authUser: AuthUser | null;
  kanbanGroup: KanbanGroup;
  rankTemaId: string | null;

  render(): void;
  renderKanban(): void;
  renderSavedFilters(): void;
  openModal(id: string): void;
  closeModal(id: string): void;
  showToast(message: string, icon?: string): void;
  openDetail(id: number): void;
  filterByTema(items: MediaItem[]): MediaItem[];
  applyContentFilter(items: MediaItem[]): MediaItem[];
  getSearchQuery(): string;
  matches(item: MediaItem, query: string): boolean;
  updateAuthUI(): void;
  updateContentFilterUI(): void;
  updateBulkBar(): void;
}

export type { ViewType };
