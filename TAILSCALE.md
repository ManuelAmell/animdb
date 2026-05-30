# Acceso Remoto via Tailscale

AniMDB funciona **sin Tailscale** en tu PC (`http://localhost:5173`). Tailscale es opcional para acceder desde otros dispositivos.

## Configuración desde la interfaz (recomendado)

1. Inicia la app: `npm run start`
2. Haz clic en el indicador de conexión en la barra superior (ej. **Solo este PC** / **Conectando…**)
3. En el **Centro de Conexión**:
   - **Automático** — detecta local o remoto según dónde abras la app
   - **Solo este PC** — sin Tailscale
   - **Tailscale** — pulsa **Detectar** para obtener tu IP (`100.x.x.x`) y **Copiar** el enlace para móvil/tablet
   - **Personalizado** — IP o hostname manual

La configuración se guarda en el navegador (`localStorage`).

## Tu IP de Tailscale (Fedora u otro equipo)

Desde terminal:

```bash
tailscale ip -4
```

Ejemplo en tu red: `100.103.50.37` (equipo **fedora**).

## Iniciar los servidores

```bash
npm run start
```

- **Frontend** (Vite): puerto `5173`
- **Backend** (Express + SQLite): puerto `5174`

## Acceder desde otros dispositivos

Con Tailscale activo en ambos dispositivos:

```
http://100.103.50.37:5173
```

(Sustituye por tu IP real del Centro de Conexión o `tailscale ip -4`.)

## Variables de entorno (opcional)

Ver `.env.example` — `VITE_API_URL` / `VITE_WS_URL` tienen prioridad sobre la UI.

## Notas

- El backend escucha en `0.0.0.0:5174`
- Sincronización en tiempo real via WebSocket (por usuario si hay sesión)
- Si Tailscale no está instalado, la app sigue funcionando en local
- Con login, cada usuario ve solo su colección en ese servidor

## Documentación relacionada

- [README.md](README.md) — instalación y scripts
- [FEATURES.md](FEATURES.md) — uso de la interfaz
- [API.md](API.md) — endpoints REST y WebSocket
