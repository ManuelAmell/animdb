# Acceso Remoto via Tailscale

## Requisitos

- [Tailscale](https://tailscale.com/) instalado y conectado en este PC y en los dispositivos de acceso
- Estar en la misma red Tailscale (tailnet)

## Obtener tu IP de Tailscale

```bash
tailscale ip -4
```

O desde `tailscale status` - tu IP aparece junto a tu nombre de usuario (formato `100.x.x.x`).

## Iniciar los servidores

### Opción 1: Un comando (recomendado)
```bash
npm run start
```

Esto inicia:
- **Frontend** (Vite) en puerto `5173`
- **Backend** (Express + SQLite) en puerto `5174`

### Opción 2: Terminales separadas

```bash
# Terminal 1: Backend
npm run dev:server

# Terminal 2: Frontend
npm run dev
```

### Opción 3: Segundo plano con scripts

```bash
# Iniciar todo en segundo plano
npm run start

# Detener todo
npm run stop
```

## Acceder desde otros dispositivos

Desde otro dispositivo conectado a Tailscale, abre en el navegador:

```
http://100.101.28.97:5173
```

**Reemplaza** `100.101.28.97` con tu IP de Tailscale.

## Puertos

| Servicio | Puerto |
|----------|--------|
| Frontend (Vite) | 5173 |
| Backend API (Express) | 5174 |

## Notas

- El backend escucha en `0.0.0.0:5174`, acepta conexiones externas
- El frontend también escucha en `0.0.0.0:5173`
- Los cambios se sincronizan en tiempo real via WebSocket
- No recomendado para producción (solo desarrollo)