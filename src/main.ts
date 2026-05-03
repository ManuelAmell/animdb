import { store } from './store';
import type { MediaItem, ViewType, FilterType, PendingDisplayStyle } from './types';
import { THEMES, getRatingColor, getRatingLabel, STATUS_LABELS } from './types';
import { smartSearch, fetchByIMDBId, fetchByAnimeListId } from './api';
import './styles/main.css';
import './styles/moods.css';

class App {
  private currentView: ViewType = 'list';
  private movieFilter: FilterType = 'all';
  private seriesFilter: FilterType = 'all';
  private rankFilter: 'all' | 'movie' | 'series' | 'unrated' = 'all';
  private pendingStyle: PendingDisplayStyle = 'grid';
  private activeTemaId: string | null = null;
  private modalRating = 0;
  private modalMoods: string[] = [];
  private editingId: number | null = null;
  private detailItemId: number | null = null;
  private unsubscribe: (() => void) | null = null;
  private draggedItemId: number | null = null;

  constructor() {
    this.init();
    window.addEventListener('beforeunload', () => {
      if (this.unsubscribe) this.unsubscribe();
    });
  }

  private init(): void {
    this.unsubscribe = store.subscribe(() => this.render());
    this.bindEvents();
    this.initMoodChips();
    this.render();
  }

  private bindEvents(): void {
    document.addEventListener('keydown', (e) => this.handleKeydown(e));

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
      this.closeAllModals();
    }
    if (e.key === 'n' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
      this.openAddModal();
    }
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
    this.renderList();
    this.renderRanking();
    this.renderPendientes();
    this.renderTemas();
  }

  private getFilteredItems(items: MediaItem[], filter: FilterType): MediaItem[] {
    if (filter === 'top') return items.filter(i => i.rating >= 8);
    if (filter === 'pending') return items.filter(i => i.status === 'pending' || i.rating === 0);
    return items;
  }

  private matches(item: MediaItem, query: string): boolean {
    if (!query) return true;
    const q = query.toLowerCase();
    return item.title.toLowerCase().includes(q) || (item.genre || '').toLowerCase().includes(q);
  }

  renderList(): void {
    const query = (document.getElementById('searchInput') as HTMLInputElement).value.toLowerCase();
    const movies = store.getMovies().filter(i => this.matches(i, query));
    const series = store.getSeries().filter(i => this.matches(i, query));

    const filteredMovies = this.getFilteredItems(movies, this.movieFilter);
    const filteredSeries = this.getFilteredItems(series, this.seriesFilter);

    this.renderGrid('moviesGrid', filteredMovies);
    this.renderGrid('seriesGrid', filteredSeries);

    this.updateStats();
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
      grid.innerHTML = `
        <div class="empty">
          <div class="empty-icon">🔍</div>
          <p>Sin resultados</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = items.map((item, idx) => {
      const color = getRatingColor(item.rating);
      const typeIcon = item.type === 'movie' 
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>';

      return `
        <div class="card" style="animation-delay:${idx * 0.04}s" onclick="app.openDetail(${item.id})" role="listitem">
          <div style="position:relative; aspect-ratio:2/3; overflow:hidden">
            ${item.coverUrl 
              ? `<img src="${item.coverUrl}" class="card-poster" alt="${item.title}" loading="lazy">` 
              : `<div class="card-poster-placeholder">${typeIcon}</div>
                 <button class="card-search-btn" onclick="event.stopPropagation(); app.quickSearchCover(${item.id}, '${item.title.replace(/'/g, "\\'")}')">
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
            <div class="card-name">${item.title}</div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <div class="card-year">${item.year || ''}</div>
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
    const views = ['listView', 'rankingView', 'temasView', 'pendientesView'];

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

    document.getElementById('addModalTitle')!.textContent = 'Nueva entrada';
    (document.getElementById('fTitle') as HTMLInputElement).value = '';
    (document.getElementById('fCoverUrl') as HTMLInputElement).value = '';
    (document.getElementById('fType') as HTMLSelectElement).value = 'movie';
    (document.getElementById('fYear') as HTMLInputElement).value = new Date().getFullYear().toString();
    (document.getElementById('fGenre') as HTMLInputElement).value = '';
    (document.getElementById('fStatus') as HTMLSelectElement).value = 'watched';
    (document.getElementById('fNotes') as HTMLTextAreaElement).value = '';
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
          data-title="${r.title}" data-img="${r.img}" data-year="${r.year}" data-type="${r.type}" data-genres="${r.genres}" data-anime="${r.source === 'Jikan'}">
          <img src="${r.img}" class="api-result-img" alt="${r.title}" 
            onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 52 74%22><rect width=%2252%22 height=%2274%22 fill=%22%23333%22/></svg>'">
          <div class="api-result-info">
            <div class="api-result-title">${r.title}</div>
            <div class="api-result-year">${r.year || ''}</div>
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

    const existingByTitle = store.getAll().find(i => 
      i.title.toLowerCase() === title.toLowerCase() && 
      i.id !== this.editingId
    );
    
    if (existingByTitle && this.editingId === null) {
      this.editingId = existingByTitle.id;
    }

    if (this.editingId !== null && !existingByTitle) {
      store.update(this.editingId, {
        title,
        coverUrl,
        type: (document.getElementById('fType') as HTMLSelectElement).value as 'movie' | 'series',
        year: (document.getElementById('fYear') as HTMLInputElement).value,
        genre: (document.getElementById('fGenre') as HTMLInputElement).value,
        status: (document.getElementById('fStatus') as HTMLSelectElement).value as MediaItem['status'],
        rating: this.modalRating,
        notes: (document.getElementById('fNotes') as HTMLTextAreaElement).value.trim(),
        moods: [...this.modalMoods],
        isAnime: (document.getElementById('fIsAnime') as HTMLInputElement).checked,
      });
      this.showToast('Cambios guardados');
    } else if (this.editingId !== null && existingByTitle) {
      store.update(this.editingId, {
        title,
        coverUrl,
        type: (document.getElementById('fType') as HTMLSelectElement).value as 'movie' | 'series',
        year: (document.getElementById('fYear') as HTMLInputElement).value,
        genre: (document.getElementById('fGenre') as HTMLInputElement).value,
        status: (document.getElementById('fStatus') as HTMLSelectElement).value as MediaItem['status'],
        rating: this.modalRating,
        notes: (document.getElementById('fNotes') as HTMLTextAreaElement).value.trim(),
        moods: [...this.modalMoods],
        isAnime: (document.getElementById('fIsAnime') as HTMLInputElement).checked,
      });
      this.showToast('Cambios guardados');
    } else {
      store.add({
        title,
        coverUrl,
        type: (document.getElementById('fType') as HTMLSelectElement).value as 'movie' | 'series',
        year: (document.getElementById('fYear') as HTMLInputElement).value,
        genre: (document.getElementById('fGenre') as HTMLInputElement).value,
        status: (document.getElementById('fStatus') as HTMLSelectElement).value as MediaItem['status'],
        rating: this.modalRating,
        notes: (document.getElementById('fNotes') as HTMLTextAreaElement).value.trim(),
        moods: [...this.modalMoods],
        isAnime: (document.getElementById('fIsAnime') as HTMLInputElement).checked,
      });
      this.showToast('Añadido a tu lista');
    }

    this.editingId = null;
    this.closeModal('addModal');
    this.render();
  }

  deleteCurrentItem(): void {
    if (this.editingId === null) return;
    const item = store.getById(this.editingId);
    if (!item) return;
    if (!confirm(`¿Eliminar "${item.title}"?`)) return;

    store.delete(this.editingId);
    this.editingId = null;
    this.closeModal('addModal');
    this.showToast('Eliminado');
    this.render();
  }

quickSearchCover(id: number, title: string): void {
    this.editingId = id;
    const item = store.getById(id);
    (document.getElementById('fTitle') as HTMLInputElement).value = title;
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
        ? `<img src="${item.coverUrl}" alt="${item.title}">`
        : (item.type === 'movie'
          ? '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/></svg>'
          : '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="15" rx="2"/></svg>');
    }

    const meta = document.getElementById('detailMeta');
    if (meta) {
      meta.innerHTML = `
        <span class="tag type-${item.type}">${item.type === 'movie' ? 'Película' : 'Serie'}</span>
        ${item.year ? `<span class="tag">${item.year}</span>` : ''}
        ${item.genre ? `<span class="tag">${item.genre}</span>` : ''}
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

  setDetailRating(val: number): void {
    if (this.detailItemId === null) return;
    store.setRating(this.detailItemId, val);
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
    
    document.querySelectorAll('.mood-chip').forEach(chip => {
      const mood = chip.getAttribute('data-mood');
      chip.classList.toggle('selected', this.modalMoods.includes(mood!));
    });

    this.openModal('addModal');
  }

  quickRate(e: MouseEvent, id: number): void {
    e.stopPropagation();
    // Could implement a popover here
    this.openDetail(id);
  }

  autoFetchCovers(): void {
    this.showToast('Funcionalidad en desarrollo');
  }

  // Ranking methods
  setRankFilter(filter: string, el: HTMLElement): void {
    this.rankFilter = filter as typeof this.rankFilter;
    document.querySelectorAll('#rankFilters .filter-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    this.renderRanking();
  }

  renderRanking(): void {
    let list = store.getAll();
    if (this.rankFilter === 'movie') list = list.filter(i => i.type === 'movie');
    else if (this.rankFilter === 'series') list = list.filter(i => i.type === 'series');
    else if (this.rankFilter === 'unrated') list = list.filter(i => i.rating === 0);

    const rated = list.filter(i => i.rating > 0).sort((a, b) => b.rating - a.rating || (a.priority || 0) - (b.priority || 0));
    const unrated = list.filter(i => i.rating === 0).sort((a, b) => (a.priority || 0) - (b.priority || 0));

    const all = store.getAll();
    document.getElementById('rankStatTotal')!.textContent = all.length.toString();
    document.getElementById('rankStatPerfect')!.textContent = all.filter(i => i.rating === 10).length.toString();
    document.getElementById('rankStatUnrated')!.textContent = all.filter(i => i.rating === 0).length.toString();

    const rankEl = document.getElementById('rankList');
    if (!rankEl) return;

    if (list.length === 0) {
      rankEl.innerHTML = '<div class="empty"><div class="empty-icon">🔍</div><p>Sin resultados</p></div>';
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
        <div class="rank-item" data-id="${item.id}" data-pos="${pos}" draggable="true" ondragstart="app.handleDragStart(event, ${item.id})" ondragover="app.handleDragOver(event)" ondrop="app.handleDrop(event, ${item.id})" onclick="app.openDetail(${item.id})">
          <div class="rank-pos ${posClass}">${pos <= 3 ? ['🥇', '🥈', '🥉'][pos - 1] : '#' + pos}</div>
          <div class="rank-emoji">
            ${item.coverUrl 
              ? `<img src="${item.coverUrl}" alt="${item.title}">` 
              : '<svg xmlns="http://www.w3.org/2000/svg" width="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2"/></svg>'}
          </div>
          <div class="rank-info">
            <div class="rank-title">${item.title}</div>
            <div class="rank-sub">
              <span>${item.type === 'movie' ? 'Película' : 'Serie'}</span>
              ${item.year ? `<span class="dot"></span><span>${item.year}</span>` : ''}
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

  handleDrop(e: DragEvent, targetId: number): void {
    e.preventDefault();
    if (this.draggedItemId === null || this.draggedItemId === targetId) return;

    const allItems = store.getAll();
    const draggedItem = allItems.find(i => i.id === this.draggedItemId);
    const targetItem = allItems.find(i => i.id === targetId);

    if (!draggedItem || !targetItem) return;

    const draggedPriority = draggedItem.priority || 0;
    const targetPriority = targetItem.priority || 0;

    store.update(this.draggedItemId, { priority: targetPriority });
    store.update(targetId, { priority: draggedPriority });

    this.draggedItemId = null;
    this.renderRanking();
    this.showToast('Orden actualizado');
  }
  setPendingStyle(style: PendingDisplayStyle): void {
    this.pendingStyle = style;
    this.renderPendientes();
  }

  renderPendientes(): void {
    const query = (document.getElementById('searchInput') as HTMLInputElement).value.toLowerCase();
    
    const movies = store.getPendingMovies().filter(i => this.matches(i, query));
    const series = store.getPendingSeries().filter(i => this.matches(i, query));
    const animeSeries = store.getPendingAnimeSeries().filter(i => this.matches(i, query));

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
                  ? `<img src="${item.coverUrl}" alt="${item.title}">` 
                  : '<svg xmlns="http://www.w3.org/2000/svg" width="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2"/></svg>'}
              </div>
              <div class="rank-info">
                <div class="rank-title">${item.title}</div>
                <div class="rank-meta">${item.year || '—'} · ${typeLabel}</div>
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

    const items = store.getAll();
    const temaStats = THEMES.map(theme => {
      const themeItems = items.filter(i => i.moods?.includes(theme.id));
      const avg = themeItems.length > 0 
        ? themeItems.filter(i => i.rating > 0).reduce((s, i) => s + i.rating, 0) / themeItems.filter(i => i.rating > 0).length 
        : 0;
      return { ...theme, count: themeItems.length, avg };
    }).filter(t => t.count > 0).sort((a, b) => b.count - a.count);

    grid.innerHTML = temaStats.map(theme => `
      <div class="tema-card" onclick="app.selectTema('${theme.id}')" style="--tc:${theme.color}">
        <div class="tema-emoji">${theme.emoji}</div>
        <div class="tema-name">${theme.name}</div>
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

  selectTema(temaId: string): void {
    this.activeTemaId = this.activeTemaId === temaId ? null : temaId;
    this.render();
  }

  // Import/Export
  openImportModal(): void {
    this.openModal('importModal');
  }

  openExportModal(): void {
    this.openModal('exportModal');
  }

  importData(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (file.name.endsWith('.json')) {
        const success = store.importJSON(content);
        if (success) {
          this.showToast('Importado correctamente');
          this.render();
        } else {
          this.showToast('Error al importar', 'error');
        }
      } else {
        const count = store.importTxt(content);
        if (count > 0) {
          this.showToast(`${count} elementos importados`);
          this.render();
        } else {
          this.showToast('No se pudieron importar elementos', 'error');
        }
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  exportData(): void {
    const data = store.exportJSON();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `animdb-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Exportado');
  }

  exportToTxt(): void {
    const items = store.getAll();
    const txt = items
      .filter(i => i.rating > 0)
      .sort((a, b) => b.rating - a.rating)
      .map(i => `${i.title} - ${i.rating}`)
      .join('\n');

    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `animdb-list-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Exportado');
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
}

declare global {
  interface Window {
    app: App;
  }
}

window.app = new App();
export {};