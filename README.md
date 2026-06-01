# AniMDB — Tu Gestor Personal de Anime y Cine

**AniMDB** es una aplicación web (y desktop con Electron) para organizar, puntuar y descubrir anime y películas. Stack: **Vite + TypeScript**, backend **Express + SQLite**, sync en tiempo real con **Socket.IO**.

![AniMDB Logo](icon.png)

## Características

| Área | Qué incluye |
|------|-------------|
| **Vistas** | Lista, Ranking, Pendientes, Kanban, Temas |
| **Puntuación** | 0–10 en medios puntos, popover rápido, ranking con drag-and-drop |
| **Filtros** | Todo / Anime / Cine, temas emocionales, filtros guardados |
| **Importación** | JSON, CSV, TXT, AniList, MAL, Trakt, Letterboxd |
| **Exportación** | JSON v2, CSV, TXT simple/completo, Markdown |
| **Usuarios** | Registro e inicio de sesión; colección y tags por usuario |
| **Bulk** | Selección múltiple: estado, nota, tema, tag, eliminar |
| **Kanban** | Columnas por estado o por temas (Triste, Acción, etc.) |
| **Red** | Local, Tailscale o servidor personalizado ([TAILSCALE.md](TAILSCALE.md)) |
| **PWA** | Instalable, cache offline de shell y lista ([PWA.md](PWA.md)) |

Documentación detallada:

- [FEATURES.md](FEATURES.md) — guía de uso de la interfaz
- [IMPORT.md](IMPORT.md) — formatos de import/export y listas externas
- [SCRIPTS.md](SCRIPTS.md) — arranque, deploy y SSH en segundo plano
- [API.md](API.md) — REST, WebSocket y metadatos
- [CHANGELOG.md](CHANGELOG.md) — historial de versiones

## Instalación

```bash
git clone https://github.com/ManuelAmell/animdb.git
cd animdb
npm install
```

Copia variables de entorno opcionales:

```bash
cp .env.example .env
```

## Arranque

**Desarrollo interactivo (foreground):**

```bash
npm run start
```

**Segundo plano (servidor / SSH / Tailscale):**

```bash
npm run start:bg          # dev
npm run start:prod        # build + preview
npm run status            # ver URLs y logs
npm run stop              # detener
```

- **Frontend**: http://localhost:5173  
- **Backend**: http://localhost:5174  

Detalle completo en [SCRIPTS.md](SCRIPTS.md).

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run start` | Dev en foreground (terminal activa) |
| `npm run start:bg` | Dev en segundo plano |
| `npm run start:prod` | Producción en segundo plano |
| `npm run stop` | Detener backend y frontend |
| `npm run status` | Estado, PIDs, URLs Tailscale |
| `npm run restart` | Reiniciar (dev) |
| `npm run deploy` | Prod: pull + install + build + start |
| `npm run deploy:ssh -- user@host [path]` | Despliegue remoto vía SSH |
| `npm run dev` | Solo Vite |
| `npm run dev:server` | Solo Express |
| `npm run build` | Compilar producción |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run electron:dev` | App de escritorio |

### Deploy remoto (ejemplo)

```bash
npm run deploy:ssh -- mamell@fedora ~/Documentos/animdb --prod
```

## Variables de entorno

| Variable | Dónde | Uso |
|----------|-------|-----|
| `VITE_API_URL` | Cliente | URL del backend (prioridad sobre UI) |
| `VITE_WS_URL` | Cliente | URL de WebSocket |
| `TMDB_API_KEY` | Servidor | Búsqueda TMDB (proxy) |
| `OMDB_API_KEY` | Servidor | Metadatos OMDb |
| `TRAKT_CLIENT_ID` | Servidor | Importación desde Trakt |

Ver [.env.example](.env.example).

## Base de datos

SQLite en `server/animdb.db`:

- Items por usuario (`user_id`)
- Sesiones de autenticación
- Filtros guardados
- Campos: `moods`, `tags`, `priority`, etc.

## Acceso remoto

Opcional vía Tailscale. Ver [TAILSCALE.md](TAILSCALE.md).

## Licencia

MIT — ver [LICENSE](LICENSE).

---

*Hecho con cariño para la comunidad otaku.*
