# Scripts de AniMDB

Gestión de arranque, parada y despliegue en segundo plano. Los PIDs y logs viven en `.animdb/` (ignorado por git).

## Comandos rápidos (npm)

| Comando | Descripción |
|---------|-------------|
| `npm run start` | Dev en **foreground** (concurrently, terminal activa) |
| `npm run start:bg` | Dev en **segundo plano** (Vite + backend) |
| `npm run start:prod` | Producción en segundo plano (`build` + `vite preview`) |
| `npm run stop` | Detiene backend y frontend |
| `npm run status` | Estado, PIDs, URLs, últimas líneas de log |
| `npm run restart` | Reinicia en modo dev |
| `npm run restart:prod` | Reinicia en modo prod |
| `npm run install:all` | `npm install` en root y `server/` |
| `npm run deploy` | Prod: pull + install + build + restart |
| `npm run deploy:dev` | Dev: pull + install + restart |
| `npm run deploy:ssh -- user@host [path] [--dev\|--prod]` | Despliegue remoto vía SSH |

## Scripts shell (equivalentes)

```bash
./scripts/start.sh --dev      # o --prod
./scripts/stop.sh
./scripts/status.sh
./scripts/restart.sh --prod
./scripts/install.sh
./scripts/deploy.sh --prod --pull
./scripts/deploy-ssh.sh mamell@fedora ~/Documentos/animdb --prod
```

Wrappers en la raíz (compatibilidad):

- `./start-server.sh` → `scripts/start.sh --dev`
- `./stop-server.sh` → `scripts/stop.sh`

## Modos

### Dev (`--dev`)

- Backend: `node server/index.js` → puerto **5174**
- Frontend: `vite --host 0.0.0.0` → puerto **5173**
- Hot reload activo

### Prod (`--prod`)

- `npm run build` si no existe `dist/`
- Backend igual en **5174**
- Frontend: `vite preview --host 0.0.0.0` → **5173**
- Proxy `/api` y `/socket.io` heredado de Vite

## Logs y PIDs

```
.animdb/
  pids/server.pid
  pids/client.pid
  logs/server.log
  logs/client.log
  mode              # dev o prod
```

Ver logs en vivo:

```bash
tail -f .animdb/logs/server.log
tail -f .animdb/logs/client.log
```

## Despliegue remoto vía SSH

Desde tu máquina local, con el repo ya clonado en el servidor:

```bash
./scripts/deploy-ssh.sh mamell@fedora ~/Documentos/animdb --prod
```

O con variables de entorno (`.env`):

```bash
export ANIMDB_SSH_HOST=mamell@fedora
export ANIMDB_SSH_PATH=~/Documentos/animdb
npm run deploy:ssh -- --prod
```

El script remoto ejecuta:

1. `git pull --ff-only` (salvo `--no-pull` en deploy-ssh)
2. `scripts/install.sh`
3. `npm run build` (solo prod)
4. `scripts/stop.sh` + `scripts/start.sh`

Con sesión SSH ya abierta en el servidor:

```bash
cd ~/Documentos/animdb
./scripts/deploy.sh --prod --pull
```

## Variables de entorno

Ver [.env.example](.env.example). Las más relevantes para scripts:

| Variable | Uso |
|----------|-----|
| `TMDB_API_KEY`, `OMDB_API_KEY` | Metadatos en servidor |
| `TRAKT_CLIENT_ID` | Import Trakt |
| `FRONTEND_PORT` | Puerto frontend (default 5173) |
| `ANIMDB_SSH_HOST`, `ANIMDB_SSH_PATH` | Atajos para `deploy-ssh` |

## Troubleshooting

**Puerto ocupado:** `./scripts/stop.sh` libera 5173/5174 por PID y por puerto.

**Proceso zombie:** borra `.animdb/pids/*.pid` y vuelve a `./scripts/start.sh`.

**Tailscale:** si está instalado, `start.sh` y `status.sh` muestran la URL `100.x.x.x:5173`.

**systemd (opcional):** para arranque al boot, crea una unidad que invoque `scripts/start.sh --prod` desde el path del repo.
