# PWA — uso offline

AniMDB puede instalarse como aplicación web progresiva.

## Instalación

1. `npm run build`
2. Sirve la carpeta `dist/` (o usa `npm run preview`)
3. En Chrome/Edge: menú → **Instalar AniMDB**

Archivos:

- `public/manifest.webmanifest` — nombre, icono, tema
- `public/sw.js` — service worker

## Qué se cachea

| Recurso | Comportamiento |
|---------|----------------|
| HTML, CSS, JS, icono | Cache-first |
| `GET /api/items` | Network-first; fallback a cache si falla la red |

Además, la app guarda una copia de la lista en **IndexedDB** (`animdb-offline`) cada vez que el servidor responde.

## Limitaciones

- Crear, editar o borrar **requiere** conexión al backend (puerto 5174)
- Sin servidor: puedes ver la última lista cacheada, pero no sincronizar cambios
- Las carátulas externas dependen de la red salvo que ya estén en cache del navegador

## Producción

Asegúrate de servir `sw.js` y `manifest.webmanifest` desde la raíz del sitio. Vite los copia a `dist/` desde `public/`.
