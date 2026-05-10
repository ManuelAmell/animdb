# API Reference

Este documento describe las APIs externas usadas en AniMDB para buscar metadatos, y la API del backend local.

## API del Backend (Local)

El servidor Express corre en el puerto `5174` y provee:

### Endpoints REST

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/items` | Obtiene todos los items |
| POST | `/api/items` | Crea un nuevo item |
| PUT | `/api/items/:id` | Actualiza un item |
| DELETE | `/api/items/:id` | Elimina un item |

### WebSocket

El servidor usa Socket.io para sincronización en tiempo real.

- **Evento**: `items:updated` - Se emite cuando hay cambios en los items
- **Puerto**: `5174`

### Estructura de Item

```typescript
interface MediaItem {
  id: number;
  title: string;
  type: 'movie' | 'series';
  year?: string;
  genre?: string;
  status: 'pending' | 'watched' | 'watching';
  rating: number;
  notes?: string;
  moods: string[];
  isAnime: boolean;
  coverUrl?: string;
  priority: number;
}
```

---

## APIs Externas (Búsqueda de Metadatos)

### smartSearch(query, isAnime, year)

Búsqueda inteligente multi-fuente priorizando resultados por:
- Coincidencia exacta de título
- Año de lanzamiento
- Fuente preferida (Jikan para anime, TMDB para general)

**Parámetros:**
- `query` (string): Término de búsqueda
- `isAnime` (boolean): Si priorizar fuentes de anime
- `year` (string, opcional): Año de lanzamiento

**Retorna:** `Promise<SearchResult[]>`

---

### fetchByIMDBId(imdbId)

Obtiene datos de película/serie por ID de IMDB usando OMDb API.

**Parámetros:**
- `imdbId` (string): ID de IMDB (ej: "tt0468569")

**Retorna:** `Promise<SearchResult | null>`

---

### fetchByKitsuId(kitsuId)

Obtiene datos de anime por ID de Kitsu.

**Parámetros:**
- `kitsuId` (string): ID de Kitsu (ej: "1")

**Retorna:** `Promise<SearchResult | null>`

---

### fetchByAnimeListId(animeListId)

Obtiene datos de anime por ID de MyAnimeList (via Jikan) o Kitsu.

**Parámetros:**
- `animeListId` (string): ID de MAL o Kitsu

**Retorna:** `Promise<SearchResult | null>`

**Nota:** Intenta Kitsu primero, luego recurre a MyAnimeList (Jikan).

---

## Estructuras de Datos

### SearchResult
```typescript
interface SearchResult {
  title: string;
  img: string;
  year: string;
  type: 'movie' | 'series';
  genres: string;
  source: string;
  _score?: number;
}
```

---

## APIs Externas Usadas

| API | Propósito | Límite |
|-----|-----------|--------|
| OMDb API | Búsquedas IMDB | 1000/día (key gratuita) |
| Kitsu API | Anime por ID | Sin auth |
| Jikan API | MyAnimeList por ID | 3 req/seg |
| TMDB | Búsqueda general | Requiere API key |
| TVMaze | Búsqueda de series | Sin auth |

---

## Persistencia de Datos

Los datos se almacenan en `server/animdb.db` (SQLite). No se usa localStorage.