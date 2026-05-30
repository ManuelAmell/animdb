# API Reference

Backend local en puerto **5174**. Metadatos externos vía proxy o cliente.

## Autenticación

Header opcional en rutas protegidas:

```
Authorization: Bearer <token>
```

Sin token → usuario `local` (id `1`).

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/register` | `{ username, password }` → token + user |
| POST | `/api/auth/login` | `{ username, password }` → token + user |
| POST | `/api/auth/logout` | Invalida token actual |
| GET | `/api/auth/me` | Usuario de la sesión |

WebSocket: enviar token en `auth.token` al conectar (`socket.io`).

---

## Items

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/items` | Lista del usuario actual |
| POST | `/api/items` | Crear item |
| PUT | `/api/items/:id` | Actualizar item |
| DELETE | `/api/items/:id` | Eliminar item |
| POST | `/api/items/bulk` | `{ ids: number[], patch: Partial<MediaItem> }` |

### MediaItem

```typescript
interface MediaItem {
  id: number;
  userId?: number;
  title: string;
  type: 'movie' | 'series';
  year?: string;
  genre?: string;
  status: 'watched' | 'watching' | 'pending' | 'dropped';
  rating: number;
  notes?: string;
  moods: string[];      // IDs de THEMES
  tags: string[];       // libres, ej. "#rewatch"
  isAnime: boolean;
  coverUrl?: string;
  priority: number;
}
```

---

## Filtros guardados

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/filters` | Filtros del usuario |
| POST | `/api/filters` | Crear filtro `{ name, contentFilter, temaId, ... }` |
| DELETE | `/api/filters/:id` | Eliminar filtro |

---

## Importación (servidor → cliente)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/import/anilist/:username` | Lista anime AniList |
| GET | `/api/import/mal/:username` | Lista anime MAL (Jikan) |
| GET | `/api/import/trakt/:username` | Ratings públicos Trakt |

Trakt requiere `TRAKT_CLIENT_ID` en el servidor.

---

## Red

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/network/info` | IPs, Tailscale, puertos, shareUrl |
| GET | `/api/network/ping` | `{ ok, ts }` |

---

## Metadatos (proxy)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/metadata/tmdb/search?q=` | Búsqueda TMDB |
| GET | `/api/metadata/omdb?i=` | Detalle por IMDB id |

Variables: `TMDB_API_KEY`, `OMDB_API_KEY`.

---

## WebSocket

- **Evento emitido**: `items:updated` — array completo de items del usuario
- **Salas**: `user:{userId}` — cada cliente recibe solo su colección

---

## Cliente — búsqueda de metadatos (`src/api.ts`)

| Función | Fuente |
|---------|--------|
| `smartSearch` | TMDB, Jikan, TVMaze, iTunes (scoring) |
| `fetchByIMDBId` | OMDb (proxy) |
| `fetchByKitsuId` | Kitsu |
| `fetchByAnimeListId` | Kitsu → MAL |

---

## APIs externas

| API | Uso | Límite |
|-----|-----|--------|
| AniList GraphQL | Import listas | Público |
| Jikan | MAL search + listas | ~3 req/s |
| Trakt | Import ratings | Client ID |
| TMDB | Metadatos | API key |
| OMDb | IMDB id | API key |
| Kitsu / TVMaze / iTunes | Búsqueda | Sin auth |

---

## Persistencia

SQLite: `server/animdb.db`

Tablas: `items`, `users`, `sessions`, `saved_filters`.

Ver [IMPORT.md](IMPORT.md) para formatos de archivo.
