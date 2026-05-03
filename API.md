# API Reference

This document describes the external APIs used in AniMDB for fetching metadata and covers.

## Search by Name

### smartSearch(query, isAnime, year)
Performs an intelligent multi-source search prioritizing results based on:
- Exact title matches
- Year matching
- Source preference (Jikan for anime, TMDB for general)

**Parameters:**
- `query` (string): Search term
- `isAnime` (boolean): Whether to prioritize anime sources
- `year` (string, optional): Release year to prioritize

**Returns:** `Promise<SearchResult[]>`

## Search by ID

### fetchByIMDBId(imdbId)
Fetches movie/series data by IMDB ID using OMDb API.

**Parameters:**
- `imdbId` (string): IMDB ID (e.g., "tt0468569")

**Example:**
```
tt0468569 - The Dark Knight
tt4154796 - Avengers: Infinity War
```

**Returns:** `Promise<SearchResult | null>`

---

### fetchByKitsuId(kitsuId)
Fetches anime data by Kitsu ID.

**Parameters:**
- `kitsuId` (string): Kitsu anime ID

**Example:**
```
1 - Cowboy Bebop (Kitsu)
```

**Returns:** `Promise<SearchResult | null>`

---

### fetchByAnimeListId(animeListId)
Fetches anime data by MyAnimeList ID (via Jikan API) or Kitsu ID.

**Parameters:**
- `animeListId` (string): MAL ID or Kitsu ID

**Returns:** `Promise<SearchResult | null>`

**Note:** Tries Kitsu first, then falls back to MyAnimeList (Jikan).

## Data Structures

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

## External APIs Used

| API | Purpose | Rate Limit |
|-----|---------|------------|
| OMDb API | IMDB lookups | 1000/day (free key) |
| Kitsu API | Anime by ID | No auth required |
| Jikan API | MyAnimeList by ID | 3 req/sec |
| TMDB | General search | Requires API key |
| TVMaze | TV show search | No auth required |

## Local Storage

Data is persisted in localStorage under key `myanimedb_v4` with the following structure:

```json
{
  "items": [...],
  "nextId": 100
}
```