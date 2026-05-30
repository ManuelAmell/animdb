# Importación y exportación

## Exportar (modal Exportar)

| Formato | Uso |
|---------|-----|
| **JSON v2** | Backup completo con metadatos y fecha |
| **CSV** | Editar en Excel / Google Sheets |
| **TXT simple** | `Título - 9.5` (solo puntuados) |
| **TXT completo** | Todos los campos separados por `\|`, reimportable |
| **Markdown** | Compartir en Reddit, Discord, etc. |

## Importar archivos (modal Importar)

Formatos: `.json`, `.csv`, `.txt`

**Modo duplicados:**
- *Omitir* — solo añade títulos nuevos
- *Actualizar* — sobrescribe si el título ya existe

### JSON v2

```json
{
  "version": 2,
  "app": "AniMDB",
  "exportedAt": "2026-05-30T12:00:00.000Z",
  "itemCount": 42,
  "items": [ ... ],
  "nextId": 150
}
```

Compatible con backups antiguos (`{ "items": [...] }`).

### CSV

Cabecera:

```csv
title,type,year,genre,status,rating,notes,moods,tags,isAnime,coverUrl,priority
```

- `moods` y `tags`: valores separados por `;`
- `status`: `watched`, `watching`, `pending`, `dropped`

### TXT

Líneas con `#` al inicio se ignoran.

```
Evangelion - 9.5
[series] Frieren (2023)
Steins;Gate | 10 | series | 2011 | Sci-Fi | watched
```

## Listas externas (nav → Listas)

### AniList

- Usuario: `anilist:MiUsuario`
- URL: `https://anilist.co/user/MiUsuario`

Importa anime con puntuación, estado, carátula y año vía GraphQL.

### MyAnimeList (MAL)

- Usuario: `mal:MiUsuario`
- URL: `https://myanimelist.net/profile/MiUsuario`

Usa la API pública de Jikan (listas de usuario).

### Trakt

- Usuario: `trakt:MiUsuario`

Requiere en el servidor:

```bash
export TRAKT_CLIENT_ID=tu_client_id
```

Registra una app en [trakt.tv/oauth/applications](https://trakt.tv/oauth/applications) (solo Client ID para listas públicas).

### Letterboxd

1. Letterboxd → Settings → Account → Export your data → CSV  
2. En AniMDB: fuente **Letterboxd** y sube el CSV, o pega contenido

Mapeo: estrellas Letterboxd × 2 → escala 0–10.

## Detección automática

Si eliges «Detectar automáticamente», el prefijo o la URL definen la fuente:

| Entrada | Fuente |
|---------|--------|
| `anilist:…` o URL anilist.co | AniList |
| `mal:…` o URL myanimelist.net | MAL |
| `trakt:…` o URL trakt.tv | Trakt |
