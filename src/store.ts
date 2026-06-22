import type { MediaItem } from './types';
import { io, type Socket } from 'socket.io-client';
import { getApiUrl, getWsUrl } from './config';
import { authHeaders, getAuthToken } from './auth';
import { sanitizeCoverUrl } from './utils';
import { cacheItems } from './offline-cache';
import {
  detectImportFormat,
  exportJsonBundle,
  parseCsvImport,
  parseJsonImport,
  parseTxtImport,
  type ImportResult,
  type ParsedImportItem,
} from './io';

export type LoadStatus = 'loading' | 'ready' | 'error';

class Store {
  private items: MediaItem[] = [];
  private nextId: number = 100;
  private listeners: Set<() => void> = new Set();
  private socket: Socket | null = null;
  private loadStatus: LoadStatus = 'loading';
  private loadError: string | null = null;
  private connected = false;

  constructor() {
    this.connectSocket();
    this.load();
  }

  refreshSocket(): void {
    this.connectSocket();
  }

  private connectSocket(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    this.socket = io(getWsUrl(), {
      transports: ['websocket', 'polling'],
      auth: { token: getAuthToken() || '' },
    });

    this.socket.on('items:updated', (items: MediaItem[]) => {
      this.items = this.normalizeItems(items);
      const maxId = this.items.reduce((max, i) => Math.max(max, i.id), 0);
      this.nextId = maxId + 1;
      this.loadStatus = 'ready';
      this.loadError = null;
      void cacheItems(this.items);
      this.notify();
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this.notify();
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      this.notify();
    });
  }

  private normalizeItems(items: MediaItem[]): MediaItem[] {
    return items.map((item) => ({
      ...item,
      moods: item.moods || [],
      tags: item.tags || [],
    }));
  }

  reconnect(): void {
    this.connectSocket();
    void this.load();
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async load(): Promise<void> {
    this.loadStatus = 'loading';
    this.loadError = null;
    this.notify();

    try {
      const res = await fetch(`${getApiUrl()}/items`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        this.items = this.normalizeItems(data || []);
        const maxId = this.items.reduce((max, i) => Math.max(max, i.id), 0);
        this.nextId = maxId + 1;
        this.loadStatus = 'ready';
        void cacheItems(this.items);
      } else {
        this.items = [];
        this.nextId = 100;
        this.loadStatus = 'error';
        this.loadError = `Error del servidor (${res.status})`;
      }
    } catch {
      this.items = [];
      this.nextId = 100;
      this.loadStatus = 'error';
      this.loadError = 'No se pudo conectar con el servidor';
    }

    this.items.forEach((item, idx) => {
      if (item.priority === undefined) item.priority = idx * 10;
    });

    this.notify();
  }

  private async apiRequest(method: string, path: string, body?: object) {
    const res = await fetch(`${getApiUrl()}/items${path}`, {
      method,
      headers: authHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getLoadStatus(): LoadStatus {
    return this.loadStatus;
  }

  getLoadError(): string | null {
    return this.loadError;
  }

  async retryLoad(): Promise<void> {
    await this.load();
  }

  getAll(): MediaItem[] {
    return [...this.items];
  }
  getById(id: number): MediaItem | undefined {
    return this.items.find((i) => i.id === id);
  }
  getMovies(): MediaItem[] {
    return this.items.filter((i) => i.type === 'movie');
  }
  getSeries(): MediaItem[] {
    return this.items.filter((i) => i.type === 'series');
  }
  getPending(): MediaItem[] {
    return this.items.filter((i) => i.status === 'pending');
  }
  getPendingMovies(): MediaItem[] {
    return this.items.filter((i) => i.status === 'pending' && i.type === 'movie');
  }
  getPendingSeries(): MediaItem[] {
    return this.items.filter(
      (i) => i.status === 'pending' && i.type === 'series' && !i.isAnime
    );
  }
  getPendingAnimeSeries(): MediaItem[] {
    return this.items.filter(
      (i) => i.status === 'pending' && i.type === 'series' && i.isAnime
    );
  }
  getRated(): MediaItem[] {
    return this.items.filter((i) => i.rating > 0);
  }

  getAverageRating(): number {
    const rated = this.items.filter((i) => i.rating > 0);
    if (rated.length === 0) return 0;
    return rated.reduce((sum, i) => sum + i.rating, 0) / rated.length;
  }

  async add(item: Omit<MediaItem, 'id' | 'priority'>): Promise<MediaItem> {
    const newItem: MediaItem = {
      ...item,
      coverUrl: sanitizeCoverUrl(item.coverUrl),
      moods: item.moods ?? [],
      tags: item.tags ?? [],
      id: this.nextId++,
      priority: this.items.length * 10,
    };
    await this.apiRequest('POST', '', newItem);
    return newItem;
  }

  async update(id: number, data: Partial<MediaItem>): Promise<MediaItem | undefined> {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx === -1) return undefined;
    const patch = { ...data };
    if ('coverUrl' in patch) patch.coverUrl = sanitizeCoverUrl(patch.coverUrl);
    const updated = { ...this.items[idx], ...patch };
    await this.apiRequest('PUT', `/${id}`, updated);
    return updated;
  }

  async delete(id: number): Promise<boolean> {
    await this.apiRequest('DELETE', `/${id}`);
    return true;
  }

  async setRating(id: number, rating: number): Promise<MediaItem | undefined> {
    return this.update(id, { rating });
  }

  async bulkUpdate(ids: number[], patch: Partial<MediaItem>): Promise<number> {
    const safePatch = { ...patch };
    if ('coverUrl' in safePatch) safePatch.coverUrl = sanitizeCoverUrl(safePatch.coverUrl);
    const res = await fetch(`${getApiUrl()}/items/bulk`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ ids, patch: safePatch }),
    });
    if (!res.ok) throw new Error('Bulk update failed');
    const data = await res.json();
    await this.load();
    return data.updated || 0;
  }

  async bulkDelete(ids: number[]): Promise<void> {
    for (const id of ids) await this.delete(id);
    await this.load();
  }

  async reorder(orderedIds: number[]): Promise<void> {
    const updates: MediaItem[] = [];
    orderedIds.forEach((id, index) => {
      const item = this.items.find((i) => i.id === id);
      if (item) {
        item.priority = index * 10;
        updates.push(item);
      }
    });
    for (const item of updates) {
      await this.apiRequest('PUT', `/${item.id}`, item);
    }
    this.notify();
  }

  getNextId(): number {
    return this.nextId;
  }

  exportJSON(): string {
    return exportJsonBundle(this.items, this.nextId);
  }

  private findByTitle(title: string): MediaItem | undefined {
    const key = title.trim().toLowerCase();
    return this.items.find((i) => i.title.trim().toLowerCase() === key);
  }

  private async importParsedItems(
    parsed: ParsedImportItem[],
    mode: 'merge' | 'update'
  ): Promise<Pick<ImportResult, 'added' | 'updated' | 'skipped'>> {
    const stats = { added: 0, updated: 0, skipped: 0 };

    for (const item of parsed) {
      const existing = this.findByTitle(item.title);
      if (existing) {
        if (mode === 'update') {
          await this.update(existing.id, {
            type: item.type,
            year: item.year,
            genre: item.genre,
            status: item.status,
            rating: item.rating,
            notes: item.notes,
            moods: item.moods,
            tags: item.tags || [],
            isAnime: item.isAnime,
            coverUrl: item.coverUrl,
          });
          stats.updated++;
        } else {
          stats.skipped++;
        }
        continue;
      }

      await this.add({
        title: item.title,
        type: item.type,
        year: item.year,
        genre: item.genre,
        status: item.status,
        rating: item.rating,
        notes: item.notes,
        moods: item.moods,
        tags: item.tags || [],
        isAnime: item.isAnime,
        coverUrl: item.coverUrl,
      });
      stats.added++;
    }

    return stats;
  }

  async importContent(
    content: string,
    filename: string,
    mode: 'merge' | 'update' = 'merge'
  ): Promise<ImportResult> {
    const result: ImportResult = { added: 0, updated: 0, skipped: 0, errors: [] };
    const format = detectImportFormat(filename, content);

    try {
      if (format === 'json') {
        const { items, errors } = parseJsonImport(content);
        result.errors.push(...errors);

        for (const item of items) {
          if (!item?.title?.trim()) {
            result.errors.push('Entrada JSON sin título');
            continue;
          }

          const byTitle = this.findByTitle(item.title);
          const byId = item.id ? this.items.find((i) => i.id === item.id) : undefined;

          if (byTitle || byId) {
            const target = byTitle || byId!;
            if (mode === 'update') {
              await this.update(target.id, {
                title: item.title,
                type: item.type,
                year: item.year,
                genre: item.genre,
                status: item.status,
                rating: item.rating,
                notes: item.notes,
                moods: item.moods || [],
                tags: item.tags || [],
                isAnime: item.isAnime,
                coverUrl: item.coverUrl,
                priority: item.priority ?? target.priority,
              });
              result.updated++;
            } else {
              result.skipped++;
            }
            continue;
          }

          await this.add({
            title: item.title,
            type: item.type || 'movie',
            year: item.year,
            genre: item.genre,
            status: item.status || (item.rating > 0 ? 'watched' : 'pending'),
            rating: item.rating || 0,
            notes: item.notes,
            moods: item.moods || [],
            tags: item.tags || [],
            isAnime: item.isAnime ?? true,
            coverUrl: item.coverUrl,
          });
          result.added++;
        }
      } else if (format === 'csv') {
        const { items, errors } = parseCsvImport(content);
        result.errors.push(...errors);
        const stats = await this.importParsedItems(items, mode);
        Object.assign(result, stats);
      } else {
        const { items, errors } = parseTxtImport(content);
        result.errors.push(...errors);
        const stats = await this.importParsedItems(items, mode);
        Object.assign(result, stats);
      }

      await this.load();
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : 'Error desconocido');
    }

    return result;
  }

  async importParsedList(parsed: ParsedImportItem[], mode: 'merge' | 'update'): Promise<ImportResult> {
    const result: ImportResult = { added: 0, updated: 0, skipped: 0, errors: [] };
    const stats = await this.importParsedItems(parsed, mode);
    Object.assign(result, stats);
    await this.load();
    return result;
  }
}

export const store = new Store();
