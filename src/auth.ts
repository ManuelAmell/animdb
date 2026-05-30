import { getApiUrl } from './config';
import type { AuthUser } from './types';

const TOKEN_KEY = 'animdb-auth-token';
const USER_KEY = 'animdb-auth-user';

let authToken: string | null = localStorage.getItem(TOKEN_KEY);
let authUser: AuthUser | null = null;

try {
  const saved = localStorage.getItem(USER_KEY);
  if (saved) authUser = JSON.parse(saved);
} catch {
  authUser = null;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function getAuthUser(): AuthUser | null {
  return authUser;
}

function setSession(token: string | null, user: AuthUser | null): void {
  authToken = token;
  authUser = user;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  return headers;
}

export async function fetchMe(): Promise<AuthUser> {
  const res = await fetch(`${getApiUrl()}/auth/me`, { headers: authHeaders() });
  if (!res.ok) throw new Error('No autenticado');
  const data = await res.json();
  authUser = data.user;
  if (authUser) localStorage.setItem(USER_KEY, JSON.stringify(authUser));
  return authUser || { id: 1, username: 'local' };
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${getApiUrl()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');
  setSession(data.token, data.user);
  return data.user;
}

export async function register(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${getApiUrl()}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al registrarse');
  setSession(data.token, data.user);
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${getApiUrl()}/auth/logout`, { method: 'POST', headers: authHeaders() });
  } catch {
    /* ignore */
  }
  setSession(null, null);
}

export async function initAuth(): Promise<AuthUser> {
  if (authToken) {
    try {
      return await fetchMe();
    } catch {
      setSession(null, null);
    }
  }
  return { id: 1, username: 'local' };
}
