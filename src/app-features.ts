import { store } from './store';
import { login, register, logout, initAuth, getAuthUser } from './auth';
import { loadSavedFilters, saveFilter, deleteFilter } from './filters-api';
import {
  fetchExternalList,
  parseExternalUsername,
  parseLetterboxdCsv,
  type ImportSource,
} from './importers';
import { smartSearch } from './api';
import { registerServiceWorker } from './offline-cache';
import { esc, escCoverSrc } from './utils';
import type { App } from './main-types';
import type { ContentFilter, KanbanGroup, MediaItem, SavedFilter } from './types';
import { THEMES } from './types';

function renderKanbanCard(item: MediaItem): string {
  return `
    <div class="kanban-card" draggable="true" data-id="${item.id}"
      ondragstart="app.handleKanbanDragStart(event,${item.id})"
      onclick="app.openDetail(${item.id})">
      ${escCoverSrc(item.coverUrl) ? `<img src="${escCoverSrc(item.coverUrl)}" alt="${esc(item.title)}">` : '<div class="kanban-no-cover">🎬</div>'}
      <div class="kanban-card-title">${esc(item.title)}</div>
      ${item.rating > 0 ? `<div class="kanban-card-rating">★ ${item.rating}</div>` : ''}
    </div>`;
}

export function bindFeatureMethods(app: object): void {
  Object.assign(app, featureMethods);
}

const featureMethods = {
  async initFeatures(this: App): Promise<void> {
    this.contentFilter = (localStorage.getItem('animdb-content-filter') as ContentFilter) || 'all';
    this.kanbanGroup = (localStorage.getItem('animdb-kanban-group') as KanbanGroup) || 'status';
    await initAuth();
    this.authUser = getAuthUser() || { id: 1, username: 'local' };
    store.refreshSocket();
    await store.retryLoad();
    this.savedFilters = await loadSavedFilters();
    void registerServiceWorker();
    this.updateAuthUI();
    this.updateContentFilterUI();
  },

  updateAuthUI(this: App): void {
    const label = document.getElementById('authUserLabel');
    if (label) label.textContent = this.authUser?.username || 'local';
  },

  openAuthModal(this: App): void {
    this.openModal('authModal');
  },

  async submitAuth(this: App, mode: 'login' | 'register'): Promise<void> {
    const username = (document.getElementById('authUsername') as HTMLInputElement).value.trim();
    const password = (document.getElementById('authPassword') as HTMLInputElement).value;
    try {
      this.authUser = mode === 'register' ? await register(username, password) : await login(username, password);
      store.refreshSocket();
      await store.retryLoad();
      this.savedFilters = await loadSavedFilters();
      this.closeModal('authModal');
      this.updateAuthUI();
      this.showToast(mode === 'register' ? 'Cuenta creada' : 'Sesión iniciada');
      this.render();
    } catch (err) {
      this.showToast(err instanceof Error ? err.message : 'Error de auth', 'error');
    }
  },

  async submitLogout(this: App): Promise<void> {
    await logout();
    this.authUser = { id: 1, username: 'local' };
    store.refreshSocket();
    await store.retryLoad();
    this.updateAuthUI();
    this.showToast('Sesión cerrada');
    this.render();
  },

  setContentFilter(this: App, filter: ContentFilter): void {
    this.contentFilter = filter;
    localStorage.setItem('animdb-content-filter', filter);
    this.updateContentFilterUI();
    this.render();
  },

  updateContentFilterUI(this: App): void {
    document.querySelectorAll('[data-content-filter]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-content-filter') === this.contentFilter);
    });
  },

  applyContentFilter(this: App, items: MediaItem[]): MediaItem[] {
    if (this.contentFilter === 'anime') return items.filter((i) => i.isAnime);
    if (this.contentFilter === 'cinema') return items.filter((i) => !i.isAnime);
    return items;
  },

  toggleBulkMode(this: App): void {
    this.bulkMode = !this.bulkMode;
    if (!this.bulkMode) this.selectedIds.clear();
    this.updateBulkBar();
    this.render();
  },

  toggleSelectItem(this: App, id: number, event?: Event): void {
    event?.stopPropagation();
    if (!this.bulkMode) return;
    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
    else this.selectedIds.add(id);
    this.updateBulkBar();
    document.querySelectorAll(`[data-select-id="${id}"]`).forEach((el) => {
      el.classList.toggle('selected', this.selectedIds.has(id));
    });
  },

  updateBulkBar(this: App): void {
    const bar = document.getElementById('bulkBar');
    const count = document.getElementById('bulkCount');
    if (!bar || !count) return;
    bar.classList.toggle('visible', this.bulkMode && this.selectedIds.size > 0);
    count.textContent = String(this.selectedIds.size);
    document.getElementById('bulkModeBtn')?.classList.toggle('active', this.bulkMode);
  },

  async applyBulkAction(this: App, action: string): Promise<void> {
    const ids = [...this.selectedIds];
    if (!ids.length) return;

    if (action === 'delete') {
      await store.bulkDelete(ids);
      this.showToast(`${ids.length} eliminados`);
    } else if (action.startsWith('status:')) {
      const status = action.split(':')[1] as MediaItem['status'];
      await store.bulkUpdate(ids, { status });
      this.showToast(`Estado actualizado en ${ids.length}`);
    } else if (action.startsWith('rating:')) {
      const rating = parseFloat(action.split(':')[1]);
      await store.bulkUpdate(ids, { rating, status: rating > 0 ? 'watched' : 'pending' });
      this.showToast(`Puntuación aplicada a ${ids.length}`);
    } else if (action.startsWith('mood:')) {
      const mood = action.split(':')[1];
      for (const id of ids) {
        const item = store.getById(id);
        if (!item) continue;
        const moods = item.moods.includes(mood) ? item.moods : [...item.moods, mood];
        await store.update(id, { moods });
      }
      this.showToast(`Tema añadido a ${ids.length}`);
    } else if (action === 'tag') {
      const input = document.getElementById('bulkTagInput') as HTMLInputElement;
      const tag = input?.value.trim();
      if (!tag) return;
      const normalized = tag.startsWith('#') ? tag.toLowerCase() : `#${tag.toLowerCase()}`;
      for (const id of ids) {
        const item = store.getById(id);
        if (!item) continue;
        const tags = item.tags?.includes(normalized) ? item.tags : [...(item.tags || []), normalized];
        await store.update(id, { tags });
      }
      this.showToast(`Tag ${normalized} añadido`);
      input.value = '';
    }

    this.selectedIds.clear();
    this.updateBulkBar();
    this.render();
  },

  async saveCurrentFilter(this: App): Promise<void> {
    const name = (document.getElementById('filterPresetName') as HTMLInputElement)?.value.trim();
    if (!name) {
      this.showToast('Escribe un nombre para el filtro', 'error');
      return;
    }
    const filter: SavedFilter = {
      name,
      contentFilter: this.contentFilter,
      temaId: this.activeTemaId,
      listFilter: this.movieFilter,
      minRating: this.movieFilter === 'top' ? 8 : 0,
    };
    const saved = await saveFilter(filter);
    this.savedFilters = [...this.savedFilters, saved];
    this.renderSavedFilters();
    this.showToast(`Filtro «${name}» guardado`);
  },

  applySavedFilter(this: App, id: number): void {
    const f = this.savedFilters.find((x) => x.id === id);
    if (!f) return;
    this.contentFilter = f.contentFilter || 'all';
    this.activeTemaId = f.temaId || null;
    if (f.listFilter) {
      this.movieFilter = f.listFilter;
      this.seriesFilter = f.listFilter;
    }
    localStorage.setItem('animdb-content-filter', this.contentFilter);
    this.updateContentFilterUI();
    this.render();
    this.showToast(`Filtro «${f.name}» aplicado`);
  },

  async removeSavedFilter(this: App, id: number): Promise<void> {
    await deleteFilter(id);
    this.savedFilters = this.savedFilters.filter((f) => f.id !== id);
    this.renderSavedFilters();
    this.showToast('Filtro eliminado');
  },

  renderSavedFilters(this: App): void {
    const el = document.getElementById('savedFiltersList');
    if (!el) return;
    if (!this.savedFilters.length) {
      el.innerHTML = '<span class="saved-filter-empty">Sin filtros guardados</span>';
      return;
    }
    el.innerHTML = this.savedFilters
      .map(
        (f) =>
          `<button type="button" class="saved-filter-chip" onclick="app.applySavedFilter(${f.id})">${f.name}<span class="sf-del" onclick="event.stopPropagation(); app.removeSavedFilter(${f.id})">×</span></button>`
      )
      .join('');
  },

  openExternalImportModal(this: App): void {
    this.openModal('externalImportModal');
  },

  async importExternalList(this: App): Promise<void> {
    const input = (document.getElementById('externalImportInput') as HTMLInputElement).value.trim();
    const sourceSelect = (document.getElementById('externalImportSource') as HTMLSelectElement).value as
      | ImportSource
      | 'auto'
      | 'letterboxd';
    const mode = this.importMode;

    try {
      if (sourceSelect === 'letterboxd') {
        const result = await store.importParsedList(parseLetterboxdCsv(input), mode);
        this.closeModal('externalImportModal');
        this.showToast(`Letterboxd: ${result.added} añadidos, ${result.skipped} omitidos`);
        this.render();
        return;
      }

      const parsed = parseExternalUsername(input);
      const source = sourceSelect === 'auto' ? parsed.source : sourceSelect;
      if (!source || !parsed.username) {
        this.showToast('Indica usuario o URL válida', 'error');
        return;
      }

      this.showToast(`Importando desde ${source}…`, '⏳');
      const data = await fetchExternalList(source, parsed.username);
      const result = await store.importParsedList(data.items, mode);
      this.closeModal('externalImportModal');
      this.showToast(`${data.count} entradas · ${result.added} añadidas, ${result.updated} actualizadas`);
      this.render();
    } catch (err) {
      this.showToast(err instanceof Error ? err.message : 'Error al importar', 'error');
    }
  },

  async importLetterboxdFile(this: App, event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const content = await file.text();
    const result = await store.importParsedList(parseLetterboxdCsv(content), this.importMode);
    this.showToast(`Letterboxd: ${result.added} añadidos`);
    this.render();
    (event.target as HTMLInputElement).value = '';
  },

  setKanbanGroup(this: App, group: KanbanGroup): void {
    this.kanbanGroup = group;
    localStorage.setItem('animdb-kanban-group', group);
    this.renderKanban();
  },

  renderKanban(this: App): void {
    const board = document.getElementById('kanbanBoard');
    if (!board) return;

    let items = this.applyContentFilter(store.getAll());
    items = this.filterByTema(items);
    const query = this.getSearchQuery();
    if (query) items = items.filter((i) => this.matches(i, query));

    if (this.kanbanGroup === 'status') {
      const cols: { id: MediaItem['status']; label: string; emoji: string }[] = [
        { id: 'pending', label: 'Por ver', emoji: '⏳' },
        { id: 'watching', label: 'Viendo', emoji: '▶️' },
        { id: 'watched', label: 'Terminado', emoji: '✅' },
        { id: 'dropped', label: 'Drop', emoji: '❌' },
      ];
      board.innerHTML = cols
        .map((col) => {
          const colItems = items.filter((i) => i.status === col.id);
          return `
            <div class="kanban-col" data-status="${col.id}" ondragover="app.handleKanbanDragOver(event)" ondrop="app.handleKanbanDrop(event,'${col.id}')">
              <div class="kanban-col-head">${col.emoji} ${col.label} <span class="badge">${colItems.length}</span></div>
              <div class="kanban-cards">${colItems.map((i) => renderKanbanCard(i)).join('')}</div>
            </div>`;
        })
        .join('');
    } else {
      board.innerHTML = THEMES.map((theme) => {
        const colItems = items.filter((i) => i.moods?.includes(theme.id));
        return `
          <div class="kanban-col kanban-col-tema" style="--kc:${theme.color}">
            <div class="kanban-col-head">${theme.emoji} ${theme.name} <span class="badge">${colItems.length}</span></div>
            <div class="kanban-cards">${colItems.map((i) => renderKanbanCard(i)).join('')}</div>
          </div>`;
      }).join('');
    }
  },

  renderKanbanCard(item: MediaItem): string {
    return renderKanbanCard(item);
  },

  handleKanbanDragStart(this: App, e: DragEvent, id: number): void {
    this.kanbanDragId = id;
    if (e.dataTransfer) e.dataTransfer.setData('text/plain', String(id));
  },

  handleKanbanDragOver(this: App, e: DragEvent): void {
    e.preventDefault();
  },

  async handleKanbanDrop(this: App, e: DragEvent, status: MediaItem['status']): Promise<void> {
    e.preventDefault();
    if (this.kanbanDragId === null || this.kanbanGroup !== 'status') return;
    await store.update(this.kanbanDragId, { status });
    this.kanbanDragId = null;
    this.renderKanban();
    this.showToast('Estado actualizado');
  },

  setRankTemaFilter(this: App, temaId: string | null, el?: HTMLElement): void {
    this.rankFilter = temaId ? 'tema' : 'all';
    this.rankTemaId = temaId;
    document.querySelectorAll('.rank-filter-row .filter-tab').forEach((t) => t.classList.remove('active'));
    el?.classList.add('active');
    if (!el && !temaId) {
      document.querySelector('.rank-filter-row .filter-tab')?.classList.add('active');
    }
    this.render();
  },

  setModalTags(this: App, raw: string): void {
    this.modalTags = raw
      .split(/[,;\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => (t.startsWith('#') ? t.toLowerCase() : `#${t.toLowerCase()}`));
  },

  async batchFetchAllCovers(this: App): Promise<void> {
    const items = store.getAll().filter((i) => !i.coverUrl);
    if (!items.length) {
      this.showToast('Todas tienen carátula', '✓');
      return;
    }

    const progress = document.getElementById('coverProgressModal');
    const bar = document.getElementById('coverProgressBar');
    const label = document.getElementById('coverProgressLabel');
    progress?.classList.add('open');

    let updated = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (label) label.textContent = `${i + 1}/${items.length}: ${item.title}`;
      if (bar) bar.style.width = `${((i + 1) / items.length) * 100}%`;

      const results = await smartSearch(item.title, item.isAnime, item.year);
      const best = results.find((r) => r.img);
      if (best) {
        await store.update(item.id, { coverUrl: best.img });
        updated++;
      }
      await new Promise((r) => setTimeout(r, 350));
    }

    progress?.classList.remove('open');
    this.showToast(`${updated}/${items.length} carátulas encontradas`);
    this.render();
  },
};

export type FeatureMethods = typeof featureMethods;
