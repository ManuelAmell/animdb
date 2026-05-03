import type { MediaItem } from './types';

const STORAGE_KEY = 'myanimedb_v4';

const DEFAULT_DATA: MediaItem[] = [];

class Store {
  private items: MediaItem[] = [];
  private nextId: number = 100;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.items = parsed.items || [...DEFAULT_DATA];
        this.nextId = parsed.nextId || 100;
      } else {
        this.items = [...DEFAULT_DATA];
        this.nextId = 100;
      }
    } catch {
      this.items = [...DEFAULT_DATA];
      this.nextId = 100;
    }

    this.items.forEach((item, idx) => {
      if (item.priority === undefined) item.priority = idx * 10;
    });
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: this.items, nextId: this.nextId }));
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach(fn => fn());
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getAll(): MediaItem[] {
    return [...this.items];
  }

  getById(id: number): MediaItem | undefined {
    return this.items.find(i => i.id === id);
  }

  getMovies(): MediaItem[] {
    return this.items.filter(i => i.type === 'movie');
  }

  getSeries(): MediaItem[] {
    return this.items.filter(i => i.type === 'series');
  }

  getPending(): MediaItem[] {
    return this.items.filter(i => i.status === 'pending' || i.rating === 0);
  }

  getRated(): MediaItem[] {
    return this.items.filter(i => i.rating > 0);
  }

  getAverageRating(): number {
    const rated = this.items.filter(i => i.rating > 0);
    if (rated.length === 0) return 0;
    return rated.reduce((sum, i) => sum + i.rating, 0) / rated.length;
  }

  add(item: Omit<MediaItem, 'id' | 'priority'>): MediaItem {
    const newItem: MediaItem = {
      ...item,
      id: this.nextId++,
      priority: this.items.length * 10
    };
    this.items.push(newItem);
    this.persist();
    return newItem;
  }

  update(id: number, data: Partial<MediaItem>): MediaItem | undefined {
    const idx = this.items.findIndex(i => i.id === id);
    if (idx === -1) return undefined;
    
    this.items[idx] = { ...this.items[idx], ...data };
    this.persist();
    return this.items[idx];
  }

  delete(id: number): boolean {
    const idx = this.items.findIndex(i => i.id === id);
    if (idx === -1) return false;
    
    this.items.splice(idx, 1);
    this.persist();
    return true;
  }

  setRating(id: number, rating: number): MediaItem | undefined {
    return this.update(id, { rating });
  }

  reorder(items: MediaItem[]): void {
    items.forEach((item, idx) => {
      const original = this.items.find(i => i.id === item.id);
      if (original) original.priority = idx * 10;
    });
    this.persist();
  }

  exportJSON(): string {
    return JSON.stringify({ items: this.items, nextId: this.nextId }, null, 2);
  }

  importJSON(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (data.items) {
        this.items = data.items;
        this.nextId = data.nextId || this.items.length + 100;
        this.persist();
        return true;
      }
      return false;
    } catch {
      return false;
    }
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
            title: title.trim(),
            type: 'movie',
            rating,
            status: rating > 0 ? 'watched' : 'pending',
            moods: [],
            isAnime: true
          });
          count++;
        }
      }
    }
    return count;
  }
}

export const store = new Store();