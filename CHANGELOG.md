# Changelog

## [1.3.0] - 2026-05-30

### Added
- **Importación externa**: AniList, MAL (Jikan), Trakt, Letterboxd CSV
- **Exportación ampliada**: JSON v2, CSV, TXT completo, Markdown
- **Usuarios**: registro, login, sesiones; items por `user_id`
- **Tags personalizados** (`#rewatch`, etc.) además de moods
- **Filtro global**: Todo / Anime / Cine (persistente en nav)
- **Filtros guardados**: presets con nombre en SQLite
- **Bulk actions**: selección múltiple con barra flotante
- **Vista Kanban**: por estado o por temas; drag entre columnas
- **Ranking por temas** y animaciones al reordenar
- **Carátulas en lote** con barra de progreso (lista completa)
- **PWA**: manifest, service worker, cache offline e IndexedDB
- **Centro de Conexión**: modos auto, local, Tailscale, custom
- **Búsqueda global**: local + descubrir + puntuar rápido
- **Tema claro/oscuro**, dashboard insights, atajos de teclado
- **Proxy de metadatos** TMDB/OMDb en servidor (sin keys en cliente)
- Documentación: `FEATURES.md`, `IMPORT.md`, `PWA.md`

### Changed
- Import TXT/CSV con más formatos y modo merge/update
- WebSocket por sala de usuario (`user:{id}`)
- Schema SQLite: `tags`, `user_id`, tablas `users`, `sessions`, `saved_filters`

### Fixed
- URLs de API/WS dinámicas (sin IP hardcodeada)
- Escapado HTML (XSS) en renders
- Estados de carga/error con reintento

---

## [1.2.0] - 2026-05-10

### Added
- Backend Express + SQLite (sql.js)
- WebSocket sync via Socket.io
- Acceso remoto Tailscale
- Scripts `npm run start` / `npm run stop`

### Changed
- Persistencia de localStorage a SQLite

---

## [1.1.0] - 2026-05-03

### Added
- App Electron y instalador Windows
- Nav responsive

---

## [1.0.0] - 2026-05-02

Versión inicial: UI glassmorphic, ranking, import/export básico, moods, pendientes.
