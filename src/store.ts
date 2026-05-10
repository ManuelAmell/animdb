import type { MediaItem } from './types';
import { io } from 'socket.io-client';

const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const WS_URL = isLocalhost ? 'http://localhost:5174' : 'http://100.101.28.97:5174';

class Store {
  private items: MediaItem[] = [];
  private nextId: number = 100;
  private listeners: Set<() => void> = new Set();
  private socket: ReturnType<typeof io> | null = null;

  constructor() {
    this.connectSocket();
    this.load();
  }

  private connectSocket(): void {
    this.socket = io(WS_URL, {
      transports: ['websocket', 'polling']
    });

    this.socket.on('items:updated', (items: MediaItem[]) => {
      this.items = items;
      const maxId = items.reduce((max, i) => Math.max(max, i.id), 0);
      this.nextId = maxId + 1;
      this.notify();
    });

    this.socket.on('connect', () => console.log('WebSocket connected'));
    this.socket.on('disconnect', () => console.log('WebSocket disconnected'));
  }

  private async load(): Promise<void> {
    try {
      const res = await fetch('/api/items');
      if (res.ok) {
        const data = await res.json();
        this.items = data || [];
        const maxId = this.items.reduce((max, i) => Math.max(max, i.id), 0);
        this.nextId = maxId + 1;
      } else {
        this.items = [];
        this.nextId = 100;
      }
    } catch {
      this.items = [];
      this.nextId = 100;
    }

    this.items.forEach((item, idx) => {
      if (item.priority === undefined) item.priority = idx * 10;
    });

    this.notify();
  }

  private async apiRequest(method: string, path: string, body?: object) {
    const res = await fetch(`${WS_URL}/api/items${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  private notify(): void {
    this.listeners.forEach(fn => fn());
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getAll(): MediaItem[] { return [...this.items]; }
  getById(id: number): MediaItem | undefined { return this.items.find(i => i.id === id); }
  getMovies(): MediaItem[] { return this.items.filter(i => i.type === 'movie'); }
  getSeries(): MediaItem[] { return this.items.filter(i => i.type === 'series'); }
  getPending(): MediaItem[] { return this.items.filter(i => i.status === 'pending'); }
  getPendingMovies(): MediaItem[] { return this.items.filter(i => i.status === 'pending' && i.type === 'movie'); }
  getPendingSeries(): MediaItem[] { return this.items.filter(i => i.status === 'pending' && i.type === 'series' && !i.isAnime); }
  getPendingAnimeSeries(): MediaItem[] { return this.items.filter(i => i.status === 'pending' && i.type === 'series' && i.isAnime); }
  getRated(): MediaItem[] { return this.items.filter(i => i.rating > 0); }

  getAverageRating(): number {
    const rated = this.items.filter(i => i.rating > 0);
    if (rated.length === 0) return 0;
    return rated.reduce((sum, i) => sum + i.rating, 0) / rated.length;
  }

  async add(item: Omit<MediaItem, 'id' | 'priority'>): Promise<MediaItem> {
    const newItem: MediaItem = { ...item, id: this.nextId++, priority: this.items.length * 10 };
    await this.apiRequest('POST', '', newItem);
    return newItem;
  }

  async update(id: number, data: Partial<MediaItem>): Promise<MediaItem | undefined> {
    const idx = this.items.findIndex(i => i.id === id);
    if (idx === -1) return undefined;
    const updated = { ...this.items[idx], ...data };
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

  async reorder(items: MediaItem[]): Promise<void> {
    for (const item of items) {
      const original = this.items.find(i => i.id === item.id);
      if (original) {
        const idx = this.items.findIndex(i => i.id === item.id);
        this.items[idx].priority = items.indexOf(item) * 10;
        await this.apiRequest('PUT', `/${item.id}`, this.items[idx]);
      }
    }
    this.notify();
  }

  exportJSON(): string {
    return JSON.stringify({ items: this.items, nextId: this.nextId }, null, 2);
  }

  async importJSON(json: string): Promise<boolean> {
    try {
      const data = JSON.parse(json);
      if (data.items) {
        for (const item of data.items) {
          if (!this.items.find(i => i.id === item.id)) {
            await this.apiRequest('POST', '', item);
          }
        }
        await this.load();
        return true;
      }
      return false;
    } catch { return false; }
  }

  importTxt(text: string): number {
    let count = 0;
    const lines = text.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const match = line.match(/^(.+?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
      if (match) {
        const [, title, ratingStr] = match;
        const rating = parseFloat(ratingStr);
        if (!this.items.find(i => i.title.toLowerCase() === title.trim().toLowerCase())) {
          this.add({
            title: title.trim(), type: 'movie', rating,
            status: rating > 0 ? 'watched' : 'pending', moods: [], isAnime: true
          });
          count++;
        }
      }
    }
    return count;
  }
}

export const store = new Store();