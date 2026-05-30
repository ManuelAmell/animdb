import { getApiUrl } from './config';
import { authHeaders } from './auth';
import type { SavedFilter } from './types';

export async function loadSavedFilters(): Promise<SavedFilter[]> {
  const res = await fetch(`${getApiUrl()}/filters`, { headers: authHeaders() });
  if (!res.ok) return [];
  return res.json();
}

export async function saveFilter(filter: SavedFilter): Promise<SavedFilter> {
  const res = await fetch(`${getApiUrl()}/filters`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(filter),
  });
  if (!res.ok) throw new Error('No se pudo guardar el filtro');
  return res.json();
}

export async function deleteFilter(id: number): Promise<void> {
  await fetch(`${getApiUrl()}/filters/${id}`, { method: 'DELETE', headers: authHeaders() });
}
