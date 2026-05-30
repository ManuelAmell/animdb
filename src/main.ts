import { store } from './store';
import type { MediaItem, ViewType, FilterType, PendingDisplayStyle, ContentFilter, SavedFilter, AuthUser, KanbanGroup } from './types';
import { THEMES, getRatingColor, getRatingLabel, STATUS_LABELS } from './types';
import { smartSearch, fetchByIMDBId, fetchByAnimeListId, type SearchResult } from './api';
import { fetchNetworkInfo, testNetworkConnection } from './network-api';
import {
  loadNetworkSettings,
  saveNetworkSettings,
  resolveNetworkUrls,
  getShareUrl,
  type NetworkMode,
  type NetworkSettings,
  type ServerNetworkInfo,
} from './network-config';
import { getApiUrl, getWsUrl } from './config';
import { esc, escAttr } from './utils';
import { buildExportFile, downloadText, type ExportFormat } from './io';
import { bindFeatureMethods } from './app-features';
import './styles/main.css';
import './styles/moods.css';

type ListSort = 'default' | 'rating' | 'title' | 'year';

class App {
  private currentView: ViewType = 'list';
  private importMode: 'merge' | 'update' = 'merge';
  private movieFilter: FilterType = 'all';
  private seriesFilter: FilterType = 'all';
  private rankFilter: 'all' | 'movie' | 'series' | 'unrated' | 'tema' = 'all';
  rankTemaId: string | null = null;
  contentFilter: ContentFilter = 'all';
  bulkMode = false;
  selectedIds = new Set<number>();
  savedFilters: SavedFilter[] = [];
  authUser: AuthUser | null = null;
  kanbanGroup: KanbanGroup = 'status';
  kanbanDragId: number | null = null;
  private modalTags: string[] = [];
  private pendingStyle: PendingDisplayStyle = 'grid';
  private listSort: ListSort = 'default';
  private activeTemaId: string | null = null;
  private modalRating = 0;
  private modalMoods: string[] = [];
  private editingId: number | null = null;
  private detailItemId: number | null = null;
  private unsubscribe: (() => void) | null = null;
  private draggedItemId: number | null = null;
  private quickRateTargetId: number | null = null;
  private networkSettings: NetworkSettings = loadNetworkSettings();
  private serverNetworkInfo: ServerNetworkInfo | null = null;
  private pendingShareUrl: string | null = null;
  private globalSearchResults: SearchResult[] = [];
  private globalSearchLoading = false;
  private globalSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private globalSearchRequestId = 0;

  constructor() {
    bindFeatureMethods(this);
    this.init();
    window.addEventListener('beforeunload', () => {
      if (this.unsubscribe) this.unsubscribe();
    });
  }

  private async init(): Promise<void> {
    this.initTheme();
    this.initQuickRatePopover();
    this.unsubscribe = store.subscribe(() => this.render());
    this.bindEvents();
    this.initMoodChips();
    void this.refreshServerNetworkInfo();
    await this.initFeatures();
    this.render();
  }

  private initTheme(): void {
    const saved = localStorage.getItem('animdb-theme');
    document.documentElement.dataset.theme = saved === 'light' ? 'light' : 'dark';
  }

  toggleTheme(): void {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('animdb-theme', next);
    this.showToast(next === 'light' ? 'Tema claro activado' : 'Tema oscuro activado');
  }

  private initQuickRatePopover(): void {
    const grid = document.getElementById('quickRateGrid');
    if (!grid) return;

    const values = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
    grid.innerHTML = values
      .map(
        (v) =>
          `<button type="button" class="quick-rate-btn" data-value="${v}">${v === 0 ? '—' : v}</button>`
      )
      .join('');

    grid.querySelectorAll('.quick-rate-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = parseFloat(btn.getAttribute('data-value') || '0');
        void this.applyQuickRate(val);
      });
    });
  }

  private bindEvents(): void {
    document.addEventListener('keydown', (e) => this.handleKeydown(e));
    document.addEventListener('click', (e) => {
      const popover = document.getElementById('quickRatePopover');
      if (popover && !popover.classList.contains('hidden') && !popover.contains(e.target as Node)) {
        this.closeQuickRatePopover();
      }

      const searchWrap = document.querySelector('.search-wrap');
      const panel = document.getElementById('globalSearchPanel');
      if (
        panel &&
        !panel.classList.contains('hidden') &&
        searchWrap &&
        !searchWrap.contains(e.target as Node)
      ) {
        this.closeGlobalSearchPanel();
      }
    });

    document.querySelectorAll('.imdb-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseFloat(btn.getAttribute('data-value') || '0');
        this.setModalRating(val);
      });
    });

    document.querySelectorAll('#detailImdbPicker .imdb-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseFloat(btn.getAttribute('data-value') || '0');
        this.setDetailRating(val);
      });
    });

    document.getElementById('tailscaleIpInput')?.addEventListener('input', () => this.updateShareUrlBox());

    const searchInput = document.getElementById('searchInput') as HTMLInputElement | null;
    searchInput?.addEventListener('input', () => this.filterContent());
    searchInput?.addEventListener('search', () => this.filterContent());
    searchInput?.addEventListener('focus', () => {
      if (this.getSearchQuery().length >= 2) this.openGlobalSearchPanel();
    });

    document.getElementById('globalSearchPanel')?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const item = target.closest('[data-action]') as HTMLElement | null;
      if (!item) return;
      e.stopPropagation();

      const action = item.getAttribute('data-action');
      const id = item.getAttribute('data-id');
      const idx = item.getAttribute('data-index');
      const rating = parseFloat(item.getAttribute('data-rating') || '0');

      if (action === 'open' && id) this.openDetail(Number(id));
      if (action === 'rate' && id) void this.rateFromSearch(Number(id), rating);
      if (action === 'add' && idx !== null) void this.addFromDiscover(Number(idx), 0);
      if (action === 'add-rate' && idx !== null) void this.addFromDiscover(Number(idx), rating);
      if (action === 'edit' && id) this.openEditModal(Number(id));
    });

    document.getElementById('apiResults')?.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('.api-result-item') as HTMLElement;
      if (target) {
        const title = target.getAttribute('data-title');
        const img = target.getAttribute('data-img');
        const year = target.getAttribute('data-year');
        const type = target.getAttribute('data-type');
        const genres = target.getAttribute('data-genres');
        const isAnime = target.getAttribute('data-anime') === 'true';
        this.selectAPIResult(title!, img!, year!, type!, genres!, isAnime);
      }
    });
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (!document.getElementById('globalSearchPanel')?.classList.contains('hidden')) {
        this.closeGlobalSearchPanel();
        return;
      }
      this.closeAllModals();
      this.closeQuickRatePopover();
    }
    if (e.key === 'n' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
      this.openAddModal();
    }
    if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
      this.openShortcutsModal();
    }
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
      e.preventDefault();
      (document.getElementById('searchInput') as HTMLInputElement)?.focus();
    }
  }

  openShortcutsModal(): void {
    this.openModal('shortcutsModal');
  }

  async retryLoad(): Promise<void> {
    await store.retryLoad();
    this.render();
  }

  setListSort(sort: string): void {
    this.listSort = sort as ListSort;
    this.renderList();
  }

  private initMoodChips(): void {
    const container = document.getElementById('moodChips');
    if (!container) return;

    container.innerHTML = THEMES.map(theme => `
      <button type="button" class="mood-chip" data-mood="${theme.id}" style="--mc:${theme.color}">
        ${theme.emoji} ${theme.name}
      </button>
    `).join('');

    container.querySelectorAll('.mood-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const mood = chip.getAttribute('data-mood')!;
        chip.classList.toggle('selected');
        if (chip.classList.contains('selected')) {
          if (!this.modalMoods.includes(mood)) {
            this.modalMoods.push(mood);
          }
        } else {
          this.modalMoods = this.modalMoods.filter(m => m !== mood);
        }
      });
    });
  }

  render(): void {
    this.renderLoadBanner();
    this.renderConnectionStatus();
    this.renderInsights();
    this.renderList();
    this.renderRanking();
    this.renderPendientes();
    this.renderTemas();
    this.renderKanban();
    this.renderSavedFilters();
    this.updateBulkBar();
  }

  private renderConnectionStatus(): void {
    const dot = document.getElementById('connDot');
    const label = document.getElementById('connLabel');
    if (!dot || !label) return;

    const urls = resolveNetworkUrls(this.networkSettings);
    const loadStatus = store.getLoadStatus();
    const wsOk = store.isConnected();

    dot.className = 'conn-dot';
    if (loadStatus === 'loading') {
      label.textContent = 'Conectando…';
    } else if (loadStatus === 'error') {
      dot.classList.add('offline');
      label.textContent = 'Sin servidor';
    } else if (wsOk) {
      dot.classList.add(urls.mode === 'local' || urls.mode === 'auto' ? 'local' : 'online');
      label.textContent = urls.label;
    } else {
      dot.classList.add('offline');
      label.textContent = 'Desconectado';
    }
  }

  private renderLoadBanner(): void {
    const banner = document.getElementById('loadBanner');
    const msg = document.getElementById('loadBannerMsg');
    const retry = document.getElementById('loadRetryBtn');
    if (!banner || !msg || !retry) return;

    const status = store.getLoadStatus();
    if (status === 'loading') {
      banner.classList.remove('hidden', 'error');
      msg.textContent = 'Cargando tu colección…';
      retry.classList.add('hidden');
      return;
    }
    if (status === 'error') {
      banner.classList.remove('hidden');
      banner.classList.add('error');
      msg.textContent = store.getLoadError() || 'Error al cargar';
      retry.classList.remove('hidden');
      retry.textContent = 'Configurar conexión';
      retry.onclick = () => void this.openNetworkModal();
      return;
    }
    retry.textContent = 'Reintentar';
    retry.onclick = () => void this.retryLoad();
    banner.classList.add('hidden');
    banner.classList.remove('error');
    retry.classList.add('hidden');
  }

  private renderInsights(): void {
    const panel = document.getElementById('insightsPanel');
    if (!panel) return;

    const query = this.getSearchQuery();
    let items = query
      ? this.applyContentFilter(store.getAll()).filter((i) => this.matches(i, query))
      : this.applyContentFilter(this.filterByTema(store.getAll()));
    if (items.length === 0 || store.getLoadStatus() === 'loading') {
      panel.innerHTML = '';
      return;
    }

    const rated = items.filter((i) => i.rating > 0);
    const avg = rated.length
      ? (rated.reduce((s, i) => s + i.rating, 0) / rated.length).toFixed(1)
      : '—';
    const pending = items.filter((i) => i.status === 'pending').length;
    const topMood = THEMES.map((t) => ({
      ...t,
      count: items.filter((i) => i.moods?.includes(t.id)).length,
    }))
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count)[0];

    panel.innerHTML = `
      <div class="insight-card">
        <div class="insight-label">Media de puntuación</div>
        <div class="insight-value" style="color:var(--green)">${esc(avg)}</div>
        <div class="insight-sub">${rated.length} valorados</div>
      </div>
      <div class="insight-card">
        <div class="insight-label">Pendientes</div>
        <div class="insight-value" style="color:var(--orange)">${pending}</div>
        <div class="insight-sub">por ver</div>
      </div>
      <div class="insight-card">
        <div class="insight-label">Tema favorito</div>
        <div class="insight-value">${topMood ? `${topMood.emoji} ${esc(topMood.name)}` : '—'}</div>
        <div class="insight-sub">${topMood ? `${topMood.count} títulos` : 'Sin moods aún'}</div>
      </div>
      <div class="insight-card">
        <div class="insight-label">Colección total</div>
        <div class="insight-value" style="color:var(--accent)">${items.length}</div>
        <div class="insight-sub">${items.filter((i) => i.type === 'movie').length} películas · ${items.filter((i) => i.type === 'series').length} series</div>
      </div>
    `;
  }

  filterByTema(items: MediaItem[]): MediaItem[] {
    if (!this.activeTemaId) return items;
    return items.filter((i) => i.moods?.includes(this.activeTemaId!));
  }

  private sortItems(items: MediaItem[]): MediaItem[] {
    const sorted = [...items];
    if (this.listSort === 'rating') {
      return sorted.sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title));
    }
    if (this.listSort === 'title') {
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    }
    if (this.listSort === 'year') {
      return sorted.sort((a, b) => (b.year || '').localeCompare(a.year || '') || a.title.localeCompare(b.title));
    }
    return sorted;
  }

  private getFilteredItems(items: MediaItem[], filter: FilterType): MediaItem[] {
    if (filter === 'top') return items.filter(i => i.rating >= 8);
    if (filter === 'pending') return items.filter(i => i.status === 'pending' || i.rating === 0);
    return items;
  }

  getSearchQuery(): string {
    return (document.getElementById('searchInput') as HTMLInputElement)?.value.trim().toLowerCase() || '';
  }

  matches(item: MediaItem, query: string): boolean {
    if (!query) return true;
    const q = query.toLowerCase();
    const moodText =
      item.moods
        ?.map((id) => THEMES.find((t) => t.id === id)?.name)
        .filter(Boolean)
        .join(' ') || '';

    const haystack = [
      item.title,
      item.genre,
      item.year,
      item.notes,
      moodText,
      ...(item.tags || []),
      item.type === 'movie' ? 'película' : 'serie',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  }

  renderList(): void {
    const query = this.getSearchQuery();
    let movies = this.applyContentFilter(store.getMovies()).filter((i) => this.matches(i, query));
    let series = this.applyContentFilter(store.getSeries()).filter((i) => this.matches(i, query));

    if (!query) {
      movies = this.filterByTema(movies);
      series = this.filterByTema(series);
    }

    const filteredMovies = this.sortItems(this.getFilteredItems(movies, this.movieFilter));
    const filteredSeries = this.sortItems(this.getFilteredItems(series, this.seriesFilter));

    if (store.getLoadStatus() === 'loading') {
      this.renderSkeletonGrid('moviesGrid');
      this.renderSkeletonGrid('seriesGrid');
    } else {
      this.renderGrid('moviesGrid', filteredMovies);
      this.renderGrid('seriesGrid', filteredSeries);
    }

    this.updateStats();
  }

  private renderSkeletonGrid(gridId: string): void {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = Array.from({ length: 6 })
      .map(() => `<div class="skeleton-card" aria-hidden="true"></div>`)
      .join('');
  }

  private updateStats(): void {
    const movies = store.getMovies();
    const series = store.getSeries();
    const avg = store.getAverageRating();

    document.getElementById('movieCount')!.textContent = movies.length.toString();
    document.getElementById('seriesCount')!.textContent = series.length.toString();
    document.getElementById('statMovies')!.textContent = movies.length.toString();
    document.getElementById('statSeries')!.textContent = series.length.toString();
    document.getElementById('statAvg')!.textContent = avg > 0 ? avg.toFixed(1) : '—';
  }

  renderGrid(gridId: string, items: MediaItem[]): void {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    if (items.length === 0) {
      const query = this.getSearchQuery();
      grid.innerHTML = `
        <div class="empty">
          <div class="empty-icon">🔍</div>
          <p>${query ? `Sin resultados para «${esc(query)}»` : 'Sin resultados'}</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = items.map((item, idx) => {
      const color = getRatingColor(item.rating);
      const typeIcon = item.type === 'movie' 
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>';

      const title = esc(item.title);
      const year = esc(item.year || '');
      const cover = item.coverUrl ? escAttr(item.coverUrl) : '';

      return `
        <div class="card${this.bulkMode ? ' bulk-mode' : ''}${this.selectedIds.has(item.id) ? ' selected' : ''}" style="animation-delay:${idx * 0.04}s" onclick="${this.bulkMode ? `app.toggleSelectItem(${item.id}, event)` : `app.openDetail(${item.id})`}" role="listitem">
          ${this.bulkMode ? `<button type="button" class="bulk-check${this.selectedIds.has(item.id) ? ' on' : ''}" data-select-id="${item.id}" onclick="app.toggleSelectItem(${item.id}, event)"></button>` : ''}
          <div style="position:relative; aspect-ratio:2/3; overflow:hidden">
            ${item.coverUrl 
              ? `<img src="${cover}" class="card-poster" alt="${title}" loading="lazy">` 
              : `<div class="card-poster-placeholder">${typeIcon}</div>
                 <button class="card-search-btn" onclick="event.stopPropagation(); app.quickSearchCover(${item.id})">
                   <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                     <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                   </svg>
                   Buscar Carátula
                 </button>`
            }
            <div class="card-overlay"></div>
            <div class="card-score ${item.rating > 0 ? 'scored' : 'unscored'}">
              ${item.rating > 0 ? '★ ' + item.rating : '—'}
            </div>
          </div>
          <div class="card-info">
            <div class="card-name">${title}</div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <div class="card-year">${year}</div>
              <div class="status-badge status-${item.status}">
                ${item.status === 'watched' ? 'Visto' : item.status === 'pending' ? 'Pendiente' : item.status === 'dropped' ? 'Dropped' : 'Viendo'}
              </div>
            </div>
            <div class="card-rate-row">
              <div class="card-imdb-score" style="color:${color}">
                ${item.rating > 0 ? `${item.rating}<span class="out">/10</span>` : '<span class="out">—</span>'}
              </div>
              <button class="card-rate-btn" onclick="event.stopPropagation(); app.quickRate(event, ${item.id})">★ Puntuar</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  filterContent(): void {
    this.renderList();
    this.renderRanking();
    this.renderPendientes();
    void this.updateGlobalSearch();
  }

  private getSearchQueryRaw(): string {
    return (document.getElementById('searchInput') as HTMLInputElement)?.value.trim() || '';
  }

  private clearSearchInput(): void {
    const input = document.getElementById('searchInput') as HTMLInputElement;
    if (input) {
      input.value = '';
      input.focus();
    }
    this.filterContent();
  }

  openGlobalSearchPanel(): void {
    const panel = document.getElementById('globalSearchPanel');
    const input = document.getElementById('searchInput') as HTMLInputElement;
    if (panel) panel.classList.remove('hidden');
    if (input) input.setAttribute('aria-expanded', 'true');
  }

  closeGlobalSearchPanel(): void {
    const panel = document.getElementById('globalSearchPanel');
    const input = document.getElementById('searchInput') as HTMLInputElement;
    if (panel) panel.classList.add('hidden');
    if (input) input.setAttribute('aria-expanded', 'false');
    this.globalSearchResults = [];
    this.globalSearchLoading = false;
    if (this.globalSearchTimer) clearTimeout(this.globalSearchTimer);
  }

  private renderGlobalSearchLocal(query: string): void {
    const el = document.getElementById('globalSearchLocal');
    if (!el) return;

    const local = store.getAll().filter((i) => this.matches(i, query)).slice(0, 6);

    if (local.length === 0) {
      el.innerHTML = `
        <div class="gs-section-title">En tu lista</div>
        <div class="gs-empty">Nada en tu colección con «${esc(query)}»</div>
      `;
      return;
    }

    el.innerHTML = `
      <div class="gs-section-title">En tu lista</div>
      ${local
        .map(
          (item) => `
        <div class="gs-item" tabindex="0" data-action="open" data-id="${item.id}">
          ${
            item.coverUrl
              ? `<img src="${escAttr(item.coverUrl)}" class="gs-thumb" alt="">`
              : `<div class="gs-thumb-placeholder">${item.type === 'movie' ? '🎬' : '📺'}</div>`
          }
          <div class="gs-info">
            <div class="gs-title">${esc(item.title)}</div>
            <div class="gs-meta">${esc(item.year || '—')} · ${item.rating > 0 ? `★ ${item.rating}/10` : 'Sin puntuar'}</div>
            <div class="gs-rating-row">
              ${[7, 8, 9, 10]
                .map(
                  (r) =>
                    `<button type="button" data-action="rate" data-id="${item.id}" data-rating="${r}">★${r}</button>`
                )
                .join('')}
            </div>
          </div>
          <span class="gs-badge">En lista</span>
        </div>
      `
        )
        .join('')}
    `;
  }

  private renderGlobalSearchExternal(query: string): void {
    const el = document.getElementById('globalSearchExternal');
    if (!el) return;

    if (this.globalSearchLoading) {
      el.innerHTML = `
        <div class="gs-section-title">Descubrir contenido</div>
        <div class="gs-loading">Buscando en TMDB, Jikan, TVMaze…</div>
      `;
      return;
    }

    if (this.globalSearchResults.length === 0) {
      el.innerHTML = `
        <div class="gs-section-title">Descubrir contenido</div>
        <div class="gs-empty">No se encontró «${esc(query)}» en catálogos externos</div>
      `;
      return;
    }

    el.innerHTML = `
      <div class="gs-section-title">Descubrir y añadir</div>
      ${this.globalSearchResults
        .slice(0, 8)
        .map((r, idx) => {
          const existing = store
            .getAll()
            .find((i) => i.title.toLowerCase() === r.title.toLowerCase());
          return `
          <div class="gs-item">
            ${
              r.img
                ? `<img src="${escAttr(r.img)}" class="gs-thumb" alt="">`
                : `<div class="gs-thumb-placeholder">✨</div>`
            }
            <div class="gs-info">
              <div class="gs-title">${esc(r.title)}</div>
              <div class="gs-meta">${esc(r.year || '—')} · ${esc(r.type === 'movie' ? 'Película' : 'Serie')} · ${esc(r.source)}</div>
              ${
                existing
                  ? `<div class="gs-rating-row">
                      ${[7, 8, 9, 10]
                        .map(
                          (rating) =>
                            `<button type="button" data-action="rate" data-id="${existing.id}" data-rating="${rating}">★${rating}</button>`
                        )
                        .join('')}
                    </div>`
                  : `<div class="gs-rating-row">
                      <button type="button" class="gs-action-btn primary" data-action="add" data-index="${idx}">+ Añadir</button>
                      ${[8, 9, 10]
                        .map(
                          (rating) =>
                            `<button type="button" data-action="add-rate" data-index="${idx}" data-rating="${rating}">+ ★${rating}</button>`
                        )
                        .join('')}
                    </div>`
              }
            </div>
            ${existing ? `<span class="gs-badge">En lista</span>` : `<span class="gs-badge new">Nuevo</span>`}
          </div>
        `;
        })
        .join('')}
    `;
  }

  private async updateGlobalSearch(): Promise<void> {
    const query = this.getSearchQueryRaw();
    const panel = document.getElementById('globalSearchPanel');
    if (!panel) return;

    if (query.length < 2) {
      this.closeGlobalSearchPanel();
      return;
    }

    this.openGlobalSearchPanel();
    this.renderGlobalSearchLocal(query.toLowerCase());

    if (this.globalSearchTimer) clearTimeout(this.globalSearchTimer);
    this.globalSearchLoading = true;
    this.renderGlobalSearchExternal(query);

    const requestId = ++this.globalSearchRequestId;
    this.globalSearchTimer = setTimeout(async () => {
      try {
        const isAnime = true;
        const results = await smartSearch(query, isAnime);
        if (requestId !== this.globalSearchRequestId) return;
        this.globalSearchResults = results;
      } catch {
        if (requestId !== this.globalSearchRequestId) return;
        this.globalSearchResults = [];
      } finally {
        if (requestId !== this.globalSearchRequestId) return;
        this.globalSearchLoading = false;
        this.renderGlobalSearchExternal(query);
      }
    }, 350);
  }

  async rateFromSearch(id: number, rating: number): Promise<void> {
    await store.setRating(id, rating);
    this.closeGlobalSearchPanel();
    this.showToast(`Puntuado: ${rating}/10`);
    this.render();
  }

  async addFromDiscover(index: number, rating: number): Promise<void> {
    const result = this.globalSearchResults[index];
    if (!result) return;

    const existing = store
      .getAll()
      .find((i) => i.title.toLowerCase() === result.title.toLowerCase());

    if (existing) {
      if (rating > 0) await store.setRating(existing.id, rating);
      this.closeGlobalSearchPanel();
      this.clearSearchInput();
      this.showToast(rating > 0 ? `Puntuado: ${rating}/10` : 'Ya está en tu lista');
      this.openDetail(existing.id);
      return;
    }

    await store.add({
      title: result.title,
      coverUrl: result.img,
      type: result.type,
      year: result.year,
      genre: result.genres,
      status: rating > 0 ? 'watched' : 'pending',
      rating,
      moods: [],
      tags: [],
      isAnime: ['Jikan', 'MAL', 'Kitsu'].includes(result.source),
    });

    this.closeGlobalSearchPanel();
    this.clearSearchInput();
    this.showToast(
      rating > 0 ? `${result.title} añadido con ★${rating}` : `${result.title} añadido a pendientes`
    );
    this.render();
  }

  setFilter(section: 'movies' | 'series', filter: FilterType, el: HTMLElement): void {
    const tabs = document.querySelectorAll(`#${section === 'movies' ? 'movieFilters' : 'seriesFilters'} .filter-tab`);
    tabs.forEach(t => t.classList.remove('active'));
    el.classList.add('active');

    if (section === 'movies') this.movieFilter = filter;
    else this.seriesFilter = filter;

    this.renderList();
  }

  switchView(view: ViewType): void {
    if (this.currentView === view) return;

    this.currentView = view;
    const views = ['listView', 'rankingView', 'temasView', 'pendientesView', 'kanbanView'];

    views.forEach(v => {
      const el = document.getElementById(v);
      if (el) {
        if (v === view + 'View') {
          el.classList.remove('hidden');
          el.classList.add('active');
          el.style.display = 'block';
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        } else {
          el.classList.add('hidden');
          el.classList.remove('active');
          el.style.display = 'none';
        }
      }
    });

    document.getElementById('tabLista')?.classList.toggle('active', view === 'list');
    document.getElementById('tabRanking')?.classList.toggle('active', view === 'ranking');
    document.getElementById('tabPendientes')?.classList.toggle('active', view === 'pendientes');
    document.getElementById('tabTemas')?.classList.toggle('active', view === 'temas');
    document.getElementById('tabKanban')?.classList.toggle('active', view === 'kanban');

    this.render();
  }

  openModal(id: string): void {
    document.getElementById(id)?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  closeModal(id: string): void {
    document.getElementById(id)?.classList.remove('open');
    if (!document.querySelector('.modal-backdrop.open')) {
      document.body.style.overflow = '';
    }
  }

  closeModalIfBackdrop(e: MouseEvent, id: string): void {
    if (e.target === document.getElementById(id)) {
      this.closeModal(id);
    }
  }

  closeAllModals(): void {
    document.querySelectorAll('.modal-backdrop.open').forEach(modal => {
      modal.classList.remove('open');
    });
    document.body.style.overflow = '';
  }

  openAddModal(): void {
    this.editingId = null;
    this.modalRating = 0;
    this.modalMoods = [];
    this.modalTags = [];

    document.getElementById('addModalTitle')!.textContent = 'Nueva entrada';
    (document.getElementById('fTitle') as HTMLInputElement).value = '';
    (document.getElementById('fCoverUrl') as HTMLInputElement).value = '';
    (document.getElementById('fType') as HTMLSelectElement).value = 'movie';
    (document.getElementById('fYear') as HTMLInputElement).value = new Date().getFullYear().toString();
    (document.getElementById('fGenre') as HTMLInputElement).value = '';
    (document.getElementById('fStatus') as HTMLSelectElement).value = 'watched';
    (document.getElementById('fNotes') as HTMLTextAreaElement).value = '';
    (document.getElementById('fTags') as HTMLInputElement).value = '';
    (document.getElementById('fIsAnime') as HTMLInputElement).checked = true;

    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) deleteBtn.style.display = 'none';
    const removeCoverBtn = document.getElementById('removeCoverBtn');
    if (removeCoverBtn) removeCoverBtn.style.display = 'none';

    this.setModalRating(0);
    this.openModal('addModal');
    setTimeout(() => (document.getElementById('fTitle') as HTMLInputElement).focus(), 300);
  }

  async searchMetadataAPI(forceOpen = false): Promise<void> {
    const query = (document.getElementById('fTitle') as HTMLInputElement).value.trim();
    const year = (document.getElementById('fYear') as HTMLInputElement).value.trim();
    const isAnime = (document.getElementById('fIsAnime') as HTMLInputElement).checked;
    const resultsEl = document.getElementById('apiResults');

    if (!resultsEl) return;

    if (!forceOpen && resultsEl.classList.contains('active')) {
      resultsEl.classList.remove('active');
      return;
    }

    if (query.length < 2) {
      resultsEl.innerHTML = '<div class="api-loading">Escribe algo más...</div>';
      resultsEl.classList.add('active');
      return;
    }

    resultsEl.innerHTML = '<div class="api-loading">Buscando con prioridad inteligente...</div>';
    resultsEl.classList.add('active');

    try {
      const results = await smartSearch(query, isAnime, year);

      if (results.length === 0) {
        resultsEl.innerHTML = '<div class="api-loading">No se encontraron resultados</div>';
        return;
      }

      resultsEl.innerHTML = results.map(r => `
        <div class="api-result-item" 
          data-title="${escAttr(r.title)}" data-img="${escAttr(r.img)}" data-year="${escAttr(r.year)}" data-type="${escAttr(r.type)}" data-genres="${escAttr(r.genres)}" data-anime="${r.source === 'Jikan'}">
          <img src="${escAttr(r.img)}" class="api-result-img" alt="${esc(r.title)}" 
            onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 52 74%22><rect width=%2252%22 height=%2274%22 fill=%22%23333%22/></svg>'">
          <div class="api-result-info">
            <div class="api-result-title">${esc(r.title)}</div>
            <div class="api-result-year">${esc(r.year || '')}</div>
          </div>
        </div>
      `).join('');
    } catch {
      resultsEl.innerHTML = '<div class="api-loading">Error en la búsqueda</div>';
    }
  }

  selectAPIResult(title: string, img: string, year: string, type: string, genres: string, isAnime: boolean): void {
    if (this.editingId === null) {
      (document.getElementById('fTitle') as HTMLInputElement).value = title;
      if (year && year !== 'null') (document.getElementById('fYear') as HTMLInputElement).value = year;
      (document.getElementById('fType') as HTMLSelectElement).value = type;
      if (genres) (document.getElementById('fGenre') as HTMLInputElement).value = genres;
      (document.getElementById('fIsAnime') as HTMLInputElement).checked = isAnime;
    }
    (document.getElementById('fCoverUrl') as HTMLInputElement).value = img;
    document.getElementById('apiResults')?.classList.remove('active');
    const removeCoverBtn = document.getElementById('removeCoverBtn');
    if (removeCoverBtn) removeCoverBtn.style.display = img ? 'flex' : 'none';
  }

  async fetchByIMDB(): Promise<void> {
    const imdbId = (document.getElementById('imdbIdInput') as HTMLInputElement).value.trim();
    if (!imdbId) {
      this.showToast('Introduce una IMDB ID', '⚠');
      return;
    }
    const resultsEl = document.getElementById('apiResults');
    if (resultsEl) {
      resultsEl.innerHTML = '<div class="api-loading">Buscando...</div>';
      resultsEl.classList.add('active');
    }
    const result = await fetchByIMDBId(imdbId);
    if (result && result.img) {
      (document.getElementById('fCoverUrl') as HTMLInputElement).value = result.img;
      if (this.editingId === null) {
        if (result.year) (document.getElementById('fYear') as HTMLInputElement).value = result.year;
        (document.getElementById('fType') as HTMLSelectElement).value = result.type;
        (document.getElementById('fIsAnime') as HTMLInputElement).checked = false;
      }
      const removeCoverBtn = document.getElementById('removeCoverBtn');
      if (removeCoverBtn) removeCoverBtn.style.display = 'flex';
      this.showToast('Carátula encontrada');
      (document.getElementById('imdbIdInput') as HTMLInputElement).value = '';
    } else {
      this.showToast('No se encontró', '❌');
    }
    if (resultsEl) resultsEl.classList.remove('active');
  }

async fetchByAnimeList(): Promise<void> {
    const animeListId = (document.getElementById('animeListIdInput') as HTMLInputElement).value.trim();
    if (!animeListId) {
      this.showToast('Introduce una ID', '⚠');
      return;
    }
    const resultsEl = document.getElementById('apiResults');
    if (resultsEl) {
      resultsEl.innerHTML = '<div class="api-loading">Buscando...</div>';
      resultsEl.classList.add('active');
    }
    const result = await fetchByAnimeListId(animeListId);
    if (result && result.img) {
      (document.getElementById('fCoverUrl') as HTMLInputElement).value = result.img;
      if (this.editingId === null) {
        (document.getElementById('fTitle') as HTMLInputElement).value = result.title;
        if (result.year) (document.getElementById('fYear') as HTMLInputElement).value = result.year;
        (document.getElementById('fType') as HTMLSelectElement).value = result.type;
        if (result.genres) (document.getElementById('fGenre') as HTMLInputElement).value = result.genres;
        (document.getElementById('fIsAnime') as HTMLInputElement).checked = true;
      }
      const removeCoverBtn = document.getElementById('removeCoverBtn');
      if (removeCoverBtn) removeCoverBtn.style.display = 'flex';
      this.showToast('Carátula encontrada');
      (document.getElementById('animeListIdInput') as HTMLInputElement).value = '';
    } else {
      this.showToast('No se encontró', '❌');
    }
    if (resultsEl) resultsEl.classList.remove('active');
  }

  setModalRating(val: number): void {
    this.modalRating = val;
    document.querySelectorAll('#imdbPicker .imdb-btn').forEach(btn => {
      const btnVal = parseFloat(btn.getAttribute('data-value') || '0');
      btn.classList.toggle('selected', btnVal === val);
    });

    const label = document.getElementById('imdbLabel');
    if (label) {
      if (val === 0) {
        label.innerHTML = '<span>Sin puntuar</span>';
      } else {
        label.innerHTML = `<strong style="color:${getRatingColor(val)}">${val}</strong><span>/ 10 · ${getRatingLabel(val)}</span>`;
      }
    }
  }

  toggleAnime(): void {
    const checkbox = document.getElementById('fIsAnime') as HTMLInputElement;
    checkbox.checked = !checkbox.checked;
  }

  removeCover(): void {
    (document.getElementById('fCoverUrl') as HTMLInputElement).value = '';
    const btn = document.getElementById('removeCoverBtn');
    if (btn) btn.style.display = 'none';
    this.showToast('Carátula eliminada');
  }

  async saveItem(): Promise<void> {
    const title = (document.getElementById('fTitle') as HTMLInputElement).value.trim();
    if (!title) {
      (document.getElementById('fTitle') as HTMLInputElement).style.borderColor = 'var(--red)';
      return;
    }
    (document.getElementById('fTitle') as HTMLElement).style.borderColor = '';

    const coverUrl = (document.getElementById('fCoverUrl') as HTMLInputElement).value;
    this.setModalTags((document.getElementById('fTags') as HTMLInputElement)?.value || '');

    const existingByTitle = store.getAll().find(i => 
      i.title.toLowerCase() === title.toLowerCase() && 
      i.id !== this.editingId
    );
    
    if (existingByTitle && this.editingId === null) {
      this.editingId = existingByTitle.id;
    }

    if (this.editingId !== null && !existingByTitle) {
      await store.update(this.editingId, {
        title,
        coverUrl,
        type: (document.getElementById('fType') as HTMLSelectElement).value as 'movie' | 'series',
        year: (document.getElementById('fYear') as HTMLInputElement).value,
        genre: (document.getElementById('fGenre') as HTMLInputElement).value,
        status: (document.getElementById('fStatus') as HTMLSelectElement).value as MediaItem['status'],
        rating: this.modalRating,
        notes: (document.getElementById('fNotes') as HTMLTextAreaElement).value.trim(),
        moods: [...this.modalMoods],
        tags: [...this.modalTags],
        isAnime: (document.getElementById('fIsAnime') as HTMLInputElement).checked,
      });
      this.showToast('Cambios guardados');
    } else if (this.editingId !== null && existingByTitle) {
      await store.update(this.editingId, {
        title,
        coverUrl,
        type: (document.getElementById('fType') as HTMLSelectElement).value as 'movie' | 'series',
        year: (document.getElementById('fYear') as HTMLInputElement).value,
        genre: (document.getElementById('fGenre') as HTMLInputElement).value,
        status: (document.getElementById('fStatus') as HTMLSelectElement).value as MediaItem['status'],
        rating: this.modalRating,
        notes: (document.getElementById('fNotes') as HTMLTextAreaElement).value.trim(),
        moods: [...this.modalMoods],
        tags: [...this.modalTags],
        isAnime: (document.getElementById('fIsAnime') as HTMLInputElement).checked,
      });
      this.showToast('Cambios guardados');
    } else {
      await store.add({
        title,
        coverUrl,
        type: (document.getElementById('fType') as HTMLSelectElement).value as 'movie' | 'series',
        year: (document.getElementById('fYear') as HTMLInputElement).value,
        genre: (document.getElementById('fGenre') as HTMLInputElement).value,
        status: (document.getElementById('fStatus') as HTMLSelectElement).value as MediaItem['status'],
        rating: this.modalRating,
        notes: (document.getElementById('fNotes') as HTMLTextAreaElement).value.trim(),
        moods: [...this.modalMoods],
        tags: [...this.modalTags],
        isAnime: (document.getElementById('fIsAnime') as HTMLInputElement).checked,
      });
      this.showToast('Añadido a tu lista');
    }

    this.editingId = null;
    this.closeModal('addModal');
    this.render();
  }

  async deleteCurrentItem(): Promise<void> {
    if (this.editingId === null) return;
    const item = store.getById(this.editingId);
    if (!item) return;
    if (!confirm(`¿Eliminar "${item.title}"?`)) return;

    await store.delete(this.editingId);
    this.editingId = null;
    this.closeModal('addModal');
    this.showToast('Eliminado');
    this.render();
  }

  quickSearchCover(id: number): void {
    this.editingId = id;
    const item = store.getById(id);
    if (!item) return;
    (document.getElementById('fTitle') as HTMLInputElement).value = item.title;
    (document.getElementById('fType') as HTMLSelectElement).value = item?.type || 'movie';
    (document.getElementById('fYear') as HTMLInputElement).value = item?.year || '';
    (document.getElementById('fGenre') as HTMLInputElement).value = item?.genre || '';
    (document.getElementById('fStatus') as HTMLSelectElement).value = item?.status || 'pending';
    (document.getElementById('fIsAnime') as HTMLInputElement).checked = item?.isAnime !== false;
    (document.getElementById('fNotes') as HTMLTextAreaElement).value = item?.notes || '';
    
    this.setModalRating(item?.rating || 0);
    this.modalMoods = item?.moods || [];
    document.getElementById('moodChips')?.querySelectorAll('.mood-chip').forEach(chip => {
      const mood = chip.getAttribute('data-mood');
      chip.classList.toggle('selected', this.modalMoods.includes(mood!));
    });
    
    document.getElementById('addModalTitle')!.textContent = 'Buscar Carátula';
    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) deleteBtn.style.display = 'flex';
    const removeCoverBtn = document.getElementById('removeCoverBtn');
    if (removeCoverBtn) removeCoverBtn.style.display = item?.coverUrl ? 'flex' : 'none';
    
    this.openModal('addModal');
    this.searchMetadataAPI(true);
  }

  openDetail(id: number): void {
    const item = store.getById(id);
    if (!item) return;

    this.detailItemId = id;
    document.getElementById('detailTitle')!.textContent = item.title;

    const poster = document.getElementById('detailPoster');
    if (poster) {
      poster.innerHTML = item.coverUrl
        ? `<img src="${escAttr(item.coverUrl)}" alt="${esc(item.title)}">`
        : (item.type === 'movie'
          ? '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/></svg>'
          : '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="15" rx="2"/></svg>');
    }

    const meta = document.getElementById('detailMeta');
    if (meta) {
      meta.innerHTML = `
        <span class="tag type-${item.type}">${item.type === 'movie' ? 'Película' : 'Serie'}</span>
        ${item.year ? `<span class="tag">${esc(item.year)}</span>` : ''}
        ${item.genre ? `<span class="tag">${esc(item.genre)}</span>` : ''}
        <span class="tag">${STATUS_LABELS[item.status] || item.status}</span>
      `;
    }

    const ratingBig = document.getElementById('detailRatingBig');
    if (ratingBig) {
      if (item.rating > 0) {
        const color = getRatingColor(item.rating);
        ratingBig.className = 'rating-big';
        ratingBig.style.color = color;
        ratingBig.textContent = item.rating.toString();
        document.getElementById('detailStarsDisplay')!.innerHTML = 
          `<span style="font-size:22px;font-weight:700;color:${color}">${item.rating}</span><span style="color:var(--text-muted);font-size:14px">/10</span>`;
        document.getElementById('detailRatingOut')!.textContent = getRatingLabel(item.rating);
      } else {
        ratingBig.className = 'rating-big no-rating';
        ratingBig.textContent = '—';
        document.getElementById('detailStarsDisplay')!.innerHTML = '';
        document.getElementById('detailRatingOut')!.textContent = 'Sin puntuar';
      }
    }

    document.querySelectorAll('#detailImdbPicker .imdb-btn').forEach(btn => {
      const btnVal = parseFloat(btn.getAttribute('data-value') || '0');
      btn.classList.toggle('selected', btnVal === (item.rating || 0));
    });

    const notes = document.getElementById('detailNotes');
    if (notes) notes.textContent = item.notes || '';

    this.openModal('detailModal');
  }

  async setDetailRating(val: number): Promise<void> {
    if (this.detailItemId === null) return;
    await store.setRating(this.detailItemId, val);
    this.openDetail(this.detailItemId);
  }

  openEditFromDetail(): void {
    this.closeModal('detailModal');
    if (this.detailItemId) {
      this.openEditModal(this.detailItemId);
    }
  }

  openEditModal(id: number): void {
    const item = store.getById(id);
    if (!item) return;

    this.editingId = id;
    document.getElementById('addModalTitle')!.textContent = 'Editar';
    (document.getElementById('fTitle') as HTMLInputElement).value = item.title;
    (document.getElementById('fCoverUrl') as HTMLInputElement).value = item.coverUrl || '';
    (document.getElementById('fType') as HTMLSelectElement).value = item.type;
    (document.getElementById('fYear') as HTMLInputElement).value = item.year || '';
    (document.getElementById('fGenre') as HTMLInputElement).value = item.genre || '';
    (document.getElementById('fStatus') as HTMLSelectElement).value = item.status;
    (document.getElementById('fNotes') as HTMLTextAreaElement).value = item.notes || '';
    (document.getElementById('fIsAnime') as HTMLInputElement).checked = item.isAnime !== false;

    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) deleteBtn.style.display = 'flex';
    const removeCoverBtn = document.getElementById('removeCoverBtn');
    if (removeCoverBtn) removeCoverBtn.style.display = item.coverUrl ? 'flex' : 'none';

    this.setModalRating(item.rating || 0);
    this.modalMoods = item.moods || [];
    this.modalTags = item.tags || [];
    (document.getElementById('fTags') as HTMLInputElement).value = (item.tags || []).join(' ');
    
    document.querySelectorAll('.mood-chip').forEach(chip => {
      const mood = chip.getAttribute('data-mood');
      chip.classList.toggle('selected', this.modalMoods.includes(mood!));
    });

    this.openModal('addModal');
  }

  quickRate(e: MouseEvent, id: number): void {
    e.stopPropagation();
    this.quickRateTargetId = id;
    const item = store.getById(id);
    const popover = document.getElementById('quickRatePopover');
    if (!popover) return;

    popover.classList.remove('hidden');
    popover.style.left = `${Math.min(e.clientX, window.innerWidth - 240)}px`;
    popover.style.top = `${Math.min(e.clientY, window.innerHeight - 280)}px`;

    popover.querySelectorAll('.quick-rate-btn').forEach((btn) => {
      const val = parseFloat(btn.getAttribute('data-value') || '0');
      btn.classList.toggle('selected', val === (item?.rating || 0));
    });
  }

  closeQuickRatePopover(): void {
    document.getElementById('quickRatePopover')?.classList.add('hidden');
    this.quickRateTargetId = null;
  }

  async applyQuickRate(val: number): Promise<void> {
    if (this.quickRateTargetId === null) return;
    await store.setRating(this.quickRateTargetId, val);
    this.closeQuickRatePopover();
    this.showToast(val > 0 ? `Puntuado: ${val}/10` : 'Sin puntuar');
    this.render();
  }

  async autoFetchCovers(): Promise<void> {
    await this.batchFetchAllCovers();
  }

  // Ranking methods
  setRankFilter(filter: string, el: HTMLElement): void {
    this.rankFilter = filter as typeof this.rankFilter;
    document.querySelectorAll('.rank-filter-row .filter-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    this.renderRanking();
  }

  renderRanking(): void {
    const query = this.getSearchQuery();
    let list = query
      ? this.applyContentFilter(store.getAll()).filter((i) => this.matches(i, query))
      : this.applyContentFilter(this.filterByTema(store.getAll()));
    if (this.rankFilter === 'movie') list = list.filter(i => i.type === 'movie');
    else if (this.rankFilter === 'series') list = list.filter(i => i.type === 'series');
    else if (this.rankFilter === 'unrated') list = list.filter(i => i.rating === 0);
    else if (this.rankFilter === 'tema' && this.rankTemaId) list = list.filter(i => i.moods?.includes(this.rankTemaId!));

    const rated = list.filter(i => i.rating > 0).sort((a, b) => b.rating - a.rating || (a.priority || 0) - (b.priority || 0));
    const unrated = list.filter(i => i.rating === 0).sort((a, b) => (a.priority || 0) - (b.priority || 0));

    const all = store.getAll();
    document.getElementById('rankStatTotal')!.textContent = all.length.toString();
    document.getElementById('rankStatPerfect')!.textContent = all.filter(i => i.rating === 10).length.toString();
    document.getElementById('rankStatUnrated')!.textContent = all.filter(i => i.rating === 0).length.toString();

    const rankEl = document.getElementById('rankList');
    if (!rankEl) return;

    if (list.length === 0) {
      const query = this.getSearchQueryRaw();
      rankEl.innerHTML = `<div class="empty"><div class="empty-icon">🔍</div><p>${query ? `Sin resultados para «${esc(query)}»` : 'Sin resultados'}</p></div>`;
      return;
    }

    let posCounter = 0;
    let prevRating: number | null = null;
    let sameCount = 0;

    const combined = [...rated, ...unrated];
    rankEl.innerHTML = combined.map((item, idx) => {
      if (item.rating > 0) {
        if (item.rating !== prevRating) {
          posCounter += sameCount + 1;
          sameCount = 0;
        } else {
          sameCount++;
        }
        prevRating = item.rating;
      }

      const pos = posCounter > 0 ? posCounter : idx + 1;
      const posClass = pos === 1 ? 'p1' : pos === 2 ? 'p2' : pos === 3 ? 'p3' : 'pn';
      const barPct = (item.rating / 10) * 100;
      const color = getRatingColor(item.rating);

      return `
        <div class="rank-item rank-animate" data-id="${item.id}" data-pos="${pos}" draggable="true" ondragstart="app.handleDragStart(event, ${item.id})" ondragover="app.handleDragOver(event)" ondrop="app.handleDrop(event, ${item.id})" onclick="app.openDetail(${item.id})">
          <div class="rank-pos ${posClass}">${pos <= 3 ? ['🥇', '🥈', '🥉'][pos - 1] : '#' + pos}</div>
          <div class="rank-emoji">
            ${item.coverUrl 
              ? `<img src="${escAttr(item.coverUrl)}" alt="${esc(item.title)}">` 
              : '<svg xmlns="http://www.w3.org/2000/svg" width="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2"/></svg>'}
          </div>
          <div class="rank-info">
            <div class="rank-title">${esc(item.title)}</div>
            <div class="rank-sub">
              <span>${item.type === 'movie' ? 'Película' : 'Serie'}</span>
              ${item.year ? `<span class="dot"></span><span>${esc(item.year)}</span>` : ''}
            </div>
          </div>
          ${item.rating > 0 ? `
            <div class="rank-bar-wrap">
              <div class="rank-bar-track">
                <div class="rank-bar-fill" style="width:${barPct}%;background:${color}"></div>
              </div>
              <div class="rank-bar-label"><span>${getRatingLabel(item.rating)}</span><span>${item.rating}/10</span></div>
            </div>
            <div class="rank-score">
              <div class="rank-score-num" style="color:${color}">${item.rating}</div>
            </div>
          ` : `
            <div class="rank-unrated-label">SIN PUNTUAR</div>
          `}
        </div>
      `;
    }).join('');

    this.initDragAndDrop();
  }

  private initDragAndDrop(): void {
    const rankEl = document.getElementById('rankList');
    if (!rankEl) return;

    rankEl.querySelectorAll('.rank-item').forEach(item => {
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        (item as HTMLElement).classList.add('drag-over');
      });

      item.addEventListener('dragleave', () => {
        (item as HTMLElement).classList.remove('drag-over');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        (item as HTMLElement).classList.remove('drag-over');
      });
    });
  }

  handleDragStart(e: DragEvent, itemId: number): void {
    this.draggedItemId = itemId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', itemId.toString());
    }
    const target = e.target as HTMLElement;
    target.classList.add('dragging');
  }

  handleDragOver(e: DragEvent): void {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  }

  async handleDrop(e: DragEvent, targetId: number): Promise<void> {
    e.preventDefault();
    if (this.draggedItemId === null || this.draggedItemId === targetId) return;

    let list = this.applyContentFilter(this.filterByTema(store.getAll()));
    if (this.rankFilter === 'movie') list = list.filter(i => i.type === 'movie');
    else if (this.rankFilter === 'series') list = list.filter(i => i.type === 'series');
    else if (this.rankFilter === 'unrated') list = list.filter(i => i.rating === 0);
    else if (this.rankFilter === 'tema' && this.rankTemaId) list = list.filter(i => i.moods?.includes(this.rankTemaId!));

    const rated = list.filter(i => i.rating > 0).sort((a, b) => b.rating - a.rating || (a.priority || 0) - (b.priority || 0));
    const unrated = list.filter(i => i.rating === 0).sort((a, b) => (a.priority || 0) - (b.priority || 0));
    const combined = [...rated, ...unrated];

    const fromIdx = combined.findIndex(i => i.id === this.draggedItemId);
    const toIdx = combined.findIndex(i => i.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = combined.splice(fromIdx, 1);
    combined.splice(toIdx, 0, moved);

    await store.reorder(combined.map(i => i.id));

    this.draggedItemId = null;
    this.renderRanking();
    this.showToast('Orden actualizado');
  }
  setPendingStyle(style: PendingDisplayStyle): void {
    this.pendingStyle = style;
    this.renderPendientes();
  }

  renderPendientes(): void {
    const query = this.getSearchQuery();

    const movies = query
      ? this.applyContentFilter(store.getPendingMovies()).filter((i) => this.matches(i, query))
      : this.applyContentFilter(this.filterByTema(store.getPendingMovies()));
    const series = query
      ? this.applyContentFilter(store.getPendingSeries()).filter((i) => this.matches(i, query))
      : this.applyContentFilter(this.filterByTema(store.getPendingSeries()));
    const animeSeries = query
      ? this.applyContentFilter(store.getPendingAnimeSeries()).filter((i) => this.matches(i, query))
      : this.applyContentFilter(this.filterByTema(store.getPendingAnimeSeries()));

    const list = [...movies, ...series, ...animeSeries];

    const gridBtn = document.getElementById('pendingGridBtn');
    const listBtn = document.getElementById('pendingListBtn');
    gridBtn?.classList.toggle('btn-primary', this.pendingStyle === 'grid');
    gridBtn?.classList.toggle('btn-ghost', this.pendingStyle !== 'grid');
    listBtn?.classList.toggle('btn-primary', this.pendingStyle === 'list');
    listBtn?.classList.toggle('btn-ghost', this.pendingStyle !== 'list');

    if (this.pendingStyle === 'grid') {
      document.getElementById('pendingGridArea')!.style.display = 'block';
      document.getElementById('pendingListArea')!.style.display = 'none';

      const moviesSection = document.getElementById('pendingMoviesSection');
      const seriesSection = document.getElementById('pendingSeriesSection');
      const animeSection = document.getElementById('pendingAnimeSeriesSection');
      
      if (moviesSection) moviesSection.style.display = movies.length ? 'block' : 'none';
      if (seriesSection) seriesSection.style.display = series.length ? 'block' : 'none';
      if (animeSection) animeSection.style.display = animeSeries.length ? 'block' : 'none';

      document.getElementById('pendingMovieCount')!.textContent = movies.length.toString();
      document.getElementById('pendingSeriesCount')!.textContent = series.length.toString();
      document.getElementById('pendingAnimeSeriesCount')!.textContent = animeSeries.length.toString();

      this.renderGrid('pendingMoviesGrid', movies);
      this.renderGrid('pendingSeriesGrid', series);
      this.renderGrid('pendingAnimeSeriesGrid', animeSeries);
    } else {
      document.getElementById('pendingGridArea')!.style.display = 'none';
      document.getElementById('pendingListArea')!.style.display = 'block';

      const listEl = document.getElementById('pendingList');
      if (listEl) {
        if (!list.length) {
          listEl.innerHTML = '<div class="empty"><div class="empty-icon">⏳</div><p>No hay pendientes</p></div>';
          return;
        }

        listEl.innerHTML = list.map((item, idx) => {
          const typeLabel = item.type === 'movie' ? 'Película' : (item.isAnime ? 'Anime' : 'Serie');
          return `
            <div class="rank-item" onclick="app.openDetail(${item.id})">
              <div class="rank-pos pn">${idx + 1}</div>
              <div class="rank-emoji">
                ${item.coverUrl 
                  ? `<img src="${escAttr(item.coverUrl)}" alt="${esc(item.title)}">` 
                  : '<svg xmlns="http://www.w3.org/2000/svg" width="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2"/></svg>'}
              </div>
              <div class="rank-info">
                <div class="rank-title">${esc(item.title)}</div>
                <div class="rank-meta">${esc(item.year || '—')} · ${typeLabel}</div>
              </div>
              <div class="rank-unrated-label">PENDIENTE</div>
            </div>
          `;
        }).join('');
      }
    }
  }

  // Temas methods
  renderTemas(): void {
    const grid = document.getElementById('temasGrid');
    if (!grid) return;

    const query = this.getSearchQuery();
    const items = store.getAll();
    let temaStats = THEMES.map(theme => {
      const themeItems = items.filter(i => i.moods?.includes(theme.id));
      const avg = themeItems.length > 0 
        ? themeItems.filter(i => i.rating > 0).reduce((s, i) => s + i.rating, 0) / themeItems.filter(i => i.rating > 0).length 
        : 0;
      return { ...theme, count: themeItems.length, avg };
    }).filter(t => t.count > 0);

    if (query) {
      temaStats = temaStats.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          items.some((i) => i.moods?.includes(t.id) && this.matches(i, query))
      );
    }

    temaStats.sort((a, b) => b.count - a.count);

    if (temaStats.length === 0) {
      grid.innerHTML = `<div class="empty"><div class="empty-icon">🔍</div><p>${query ? `Sin temas para «${esc(query)}»` : 'Sin temas todavía'}</p></div>`;
    } else {
      grid.innerHTML = temaStats.map(theme => `
      <div class="tema-card${this.activeTemaId === theme.id ? ' active' : ''}" onclick="app.selectTema('${theme.id}')" style="--tc:${theme.color}">
        <div class="tema-emoji">${theme.emoji}</div>
        <div class="tema-name">${esc(theme.name)}</div>
        <div class="tema-count">${theme.count} elementos</div>
        <div class="tema-bar-row">
          <div class="tema-mini-bar">
            <div class="tema-mini-fill" style="width:${(theme.count / items.length) * 100}%"></div>
          </div>
          <div class="tema-avg">${theme.avg > 0 ? theme.avg.toFixed(1) : '—'}</div>
        </div>
      </div>
    `).join('');
    }

    const detailEl = document.getElementById('temaDetail');
    if (!detailEl) return;

    if (!this.activeTemaId) {
      detailEl.style.display = 'none';
      detailEl.innerHTML = '';
      return;
    }

    const activeTheme = THEMES.find((t) => t.id === this.activeTemaId);
    let themeItems = items.filter((i) => i.moods?.includes(this.activeTemaId!));
    if (query) themeItems = themeItems.filter((i) => this.matches(i, query));

    const themeItemsHtml =
      themeItems.length === 0
        ? '<div class="empty"><div class="empty-icon">🔍</div><p>Sin títulos con este tema</p></div>'
        : themeItems
            .map(
              (item) =>
                `<div class="tema-detail-item" onclick="app.openDetail(${item.id})">
                  <div class="rank-title">${esc(item.title)}</div>
                  <div class="rank-meta">${esc(item.year || '—')} · ${item.rating > 0 ? item.rating + '/10' : 'Sin puntuar'}</div>
                </div>`
            )
            .join('');

    detailEl.style.display = 'block';
    detailEl.innerHTML = `
      <div class="tema-detail-header">
        <h2>${activeTheme?.emoji || ''} ${esc(activeTheme?.name || '')} <span class="badge">${themeItems.length}</span></h2>
        <button class="btn btn-ghost btn-sm" onclick="app.selectTema('${this.activeTemaId}')">Quitar filtro</button>
      </div>
      <div class="tema-detail-grid">${themeItemsHtml}</div>
    `;
  }

  selectTema(temaId: string): void {
    this.activeTemaId = this.activeTemaId === temaId ? null : temaId;
    if (this.activeTemaId && this.currentView !== 'list') {
      this.switchView('list');
      return;
    }
    this.render();
  }

  // Network / Tailscale
  async refreshServerNetworkInfo(): Promise<void> {
    this.serverNetworkInfo = await fetchNetworkInfo();
    if (this.serverNetworkInfo?.tailscaleIp && !this.networkSettings.tailscaleIp) {
      this.networkSettings.tailscaleIp = this.serverNetworkInfo.tailscaleIp;
    }
    this.pendingShareUrl = getShareUrl(this.serverNetworkInfo, this.networkSettings);
  }

  async openNetworkModal(): Promise<void> {
    await this.refreshServerNetworkInfo();
    this.syncNetworkForm();
    this.openModal('networkModal');
  }

  private syncNetworkForm(): void {
    document.querySelectorAll('.network-mode-card').forEach((card) => {
      card.classList.toggle(
        'active',
        card.getAttribute('data-mode') === this.networkSettings.mode
      );
    });

    (document.getElementById('tailscaleIpInput') as HTMLInputElement).value =
      this.networkSettings.tailscaleIp || this.serverNetworkInfo?.tailscaleIp || '';
    (document.getElementById('customHostInput') as HTMLInputElement).value =
      this.networkSettings.customHost || '';
    (document.getElementById('backendPortInput') as HTMLInputElement).value =
      String(this.networkSettings.backendPort || 5174);

    const tailscalePanel = document.getElementById('tailscalePanel');
    const customPanel = document.getElementById('customPanel');
    if (tailscalePanel) {
      tailscalePanel.style.display =
        this.networkSettings.mode === 'tailscale' || this.networkSettings.mode === 'auto'
          ? 'block'
          : 'none';
    }
    if (customPanel) {
      customPanel.style.display = this.networkSettings.mode === 'custom' ? 'block' : 'none';
    }

    this.renderTailscaleStatus();
    this.renderNetworkStatusDetail();
    this.updateShareUrlBox();
  }

  setNetworkMode(mode: NetworkMode): void {
    this.networkSettings.mode = mode;
    this.syncNetworkForm();
  }

  async detectTailscaleIp(): Promise<void> {
    await this.refreshServerNetworkInfo();
    const ip = this.serverNetworkInfo?.tailscaleIp;
    if (ip) {
      this.networkSettings.tailscaleIp = ip;
      (document.getElementById('tailscaleIpInput') as HTMLInputElement).value = ip;
      this.updateShareUrlBox();
      this.renderTailscaleStatus();
      this.showToast(`Tailscale detectado: ${ip}`);
    } else {
      this.showToast('Tailscale no disponible en este equipo', '⚠');
    }
  }

  private renderTailscaleStatus(): void {
    const el = document.getElementById('tailscaleStatus');
    if (!el) return;

    const info = this.serverNetworkInfo;
    if (!info) {
      el.innerHTML = '<span class="network-tag off">Servidor no responde</span>';
      return;
    }

    if (info.tailscaleAvailable && info.tailscaleOnline) {
      el.innerHTML = `
        <span class="network-tag">● Tailscale activo</span>
        <span class="network-tag">${esc(info.hostname)}</span>
      `;
    } else if (info.tailscaleAvailable) {
      el.innerHTML = `<span class="network-tag warn">Tailscale instalado pero offline</span>`;
    } else {
      el.innerHTML = `
        <span class="network-tag off">Tailscale no detectado</span>
        <p style="font-size:12px;color:var(--text-tertiary);margin-top:8px">
          Puedes seguir usando AniMDB en local sin instalar nada extra.
        </p>
      `;
    }
  }

  private renderNetworkStatusDetail(): void {
    const el = document.getElementById('networkStatusDetail');
    if (!el) return;

    const urls = resolveNetworkUrls(this.networkSettings);
    el.innerHTML = `
      <div class="network-devices">
        <div class="network-device">
          <span>Modo</span>
          <strong>${esc(urls.label)}</strong>
        </div>
        <div class="network-device">
          <span>API</span>
          <span class="network-device-ip">${esc(getApiUrl())}</span>
        </div>
        <div class="network-device">
          <span>WebSocket</span>
          <span class="network-device-ip">${esc(getWsUrl())}</span>
        </div>
        ${this.serverNetworkInfo?.localIps?.length
          ? `<div class="network-device"><span>Red local</span><span>${esc(this.serverNetworkInfo.localIps.join(', '))}</span></div>`
          : ''}
      </div>
    `;
  }

  private updateShareUrlBox(): void {
    const box = document.getElementById('shareUrlBox');
    if (!box) return;
    const ip =
      (document.getElementById('tailscaleIpInput') as HTMLInputElement)?.value.trim() ||
      this.networkSettings.tailscaleIp ||
      this.serverNetworkInfo?.tailscaleIp ||
      '';
    const port = this.networkSettings.frontendPort || 5173;
    this.pendingShareUrl = ip ? `http://${ip}:${port}` : null;
    box.textContent = this.pendingShareUrl || 'Configura tu IP de Tailscale para compartir';
  }

  async copyShareUrl(): Promise<void> {
    this.updateShareUrlBox();
    if (!this.pendingShareUrl) {
      this.showToast('No hay enlace para copiar', '⚠');
      return;
    }
    try {
      await navigator.clipboard.writeText(this.pendingShareUrl);
      this.showToast('Enlace copiado al portapapeles');
    } catch {
      this.showToast(this.pendingShareUrl, '📋');
    }
  }

  async testConnection(): Promise<void> {
    const latencyEl = document.getElementById('networkLatency');
    if (latencyEl) latencyEl.textContent = 'Probando…';
    const result = await testNetworkConnection();
    if (latencyEl) {
      latencyEl.textContent = result.ok
        ? `Conexión OK · ${result.latencyMs} ms`
        : `Error: ${result.error}`;
    }
    this.showToast(result.ok ? 'Conexión correcta' : 'Fallo de conexión', result.ok ? '✓' : '❌');
  }

  saveNetworkSettings(): void {
    const ipInput = document.getElementById('tailscaleIpInput') as HTMLInputElement;
    const hostInput = document.getElementById('customHostInput') as HTMLInputElement;
    const portInput = document.getElementById('backendPortInput') as HTMLInputElement;

    this.networkSettings = {
      ...this.networkSettings,
      tailscaleIp: ipInput?.value.trim() || '',
      customHost: hostInput?.value.trim() || '',
      backendPort: parseInt(portInput?.value || '5174', 10) || 5174,
    };

    saveNetworkSettings(this.networkSettings);
    store.reconnect();
    this.closeModal('networkModal');
    this.showToast('Conexión actualizada');
    this.render();
  }

  // Import/Export
  openImportModal(): void {
    this.openModal('importModal');
  }

  openExportModal(): void {
    this.openModal('exportModal');
  }

  setImportMode(mode: 'merge' | 'update'): void {
    this.importMode = mode;
  }

  async importData(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const content = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsText(file);
    });

    const result = await store.importContent(content, file.name, this.importMode);
    const total = result.added + result.updated;

    if (total > 0 || result.skipped > 0) {
      const parts = [
        result.added ? `${result.added} añadidos` : '',
        result.updated ? `${result.updated} actualizados` : '',
        result.skipped ? `${result.skipped} omitidos` : '',
      ].filter(Boolean);
      this.showToast(`Importación: ${parts.join(', ')}`);
      this.render();
    } else {
      this.showToast(
        result.errors[0] || 'No se importó ningún elemento',
        'error'
      );
    }

    input.value = '';
  }

  exportData(): void {
    this.exportAs('json');
  }

  exportAs(format: ExportFormat): void {
    const { content, mime, filename } = buildExportFile(
      format,
      store.getAll(),
      store.getNextId()
    );
    downloadText(content, mime, filename);
    this.showToast('Exportado');
  }

  exportToTxt(): void {
    this.exportAs('txt');
  }

  showToast(message: string, icon = '✓'): void {
    const toast = document.getElementById('toast');
    if (!toast) return;

    document.getElementById('toastMsg')!.textContent = message;
    document.getElementById('toastIcon')!.textContent = icon;
    toast.classList.add('show');

    clearTimeout((toast as any)._timer);
    (toast as any)._timer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  initFeatures!: () => Promise<void>;
  updateAuthUI!: () => void;
  openAuthModal!: () => void;
  submitAuth!: (mode: 'login' | 'register') => Promise<void>;
  submitLogout!: () => Promise<void>;
  setContentFilter!: (filter: ContentFilter) => void;
  updateContentFilterUI!: () => void;
  applyContentFilter!: (items: MediaItem[]) => MediaItem[];
  toggleBulkMode!: () => void;
  toggleSelectItem!: (id: number, event?: Event) => void;
  updateBulkBar!: () => void;
  applyBulkAction!: (action: string) => Promise<void>;
  saveCurrentFilter!: () => Promise<void>;
  applySavedFilter!: (id: number) => void;
  removeSavedFilter!: (id: number) => Promise<void>;
  renderSavedFilters!: () => void;
  openExternalImportModal!: () => void;
  importExternalList!: () => Promise<void>;
  importLetterboxdFile!: (event: Event) => Promise<void>;
  setKanbanGroup!: (group: KanbanGroup) => void;
  renderKanban!: () => void;
  handleKanbanDragStart!: (e: DragEvent, id: number) => void;
  handleKanbanDragOver!: (e: DragEvent) => void;
  handleKanbanDrop!: (e: DragEvent, status: MediaItem['status']) => Promise<void>;
  setRankTemaFilter!: (temaId: string | null, el?: HTMLElement) => void;
  setModalTags!: (raw: string) => void;
  batchFetchAllCovers!: () => Promise<void>;
}

declare global {
  interface Window {
    app: App;
  }
}

window.app = new App();
export {};