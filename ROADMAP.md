# Roadmap — AniMDB post-v1.3

Hoja de ruta propuesta (Lote D). Prioridad y alcance sujetos a decisión del equipo.

## Prioridad alta

### Cola de sincronización offline (PWA)

Hoy la PWA solo permite lectura sin servidor. Objetivo: encolar cambios (add/update/delete) en IndexedDB y sincronizar al reconectar.

- Archivos afectados: `src/offline-cache.ts`, `src/store.ts`, `public/sw.js`
- Riesgo: conflictos de merge entre dispositivos

### CI y tests automatizados

- GitHub Actions: `npm run lint`, `npm run build` en cada push/PR
- Tests E2E con Playwright: login, añadir item, import/export básico
- Tests unitarios para `utils.ts` (`esc`, `sanitizeCoverUrl`) e `io.ts` (parsers)

## Prioridad media

### Vista calendario / timeline

Visualizar items por fecha de visionado o año de estreno en una línea temporal o calendario mensual.

- Nueva vista o panel en insights
- Campo opcional `watchedAt` en schema (migración SQLite)

### Recomendaciones

Sugerir pendientes según moods frecuentes, géneros y puntuaciones altas del usuario.

- Lógica en cliente o endpoint `/api/recommendations`
- UI: sección en búsqueda global o panel insights

### Regla ESLint para `innerHTML`

Detectar template strings en asignaciones a `innerHTML` que interpolen variables sin `esc()` / `escAttr()` / `escCoverSrc()`.

## Prioridad baja / exploratorio

- Notificaciones push para estrenos de series en pendientes (requiere fuente de datos externa)
- Compartir lista pública de solo lectura (enlace con token)
- Modo “cine con amigos”: sesiones compartidas en tiempo real
- Internacionalización (i18n) — hoy solo español

## Criterios para incluir en una release

1. `npm run build` y `npm run lint` en verde
2. Documentación actualizada (`CHANGELOG.md`, `FEATURES.md` si aplica)
3. Review de escapado HTML y URLs si hay nuevos renders o campos de usuario

## Referencias

- Backlog histórico: `.cursor/rules/animdb-backlog.mdc`
- Features actuales: `FEATURES.md`
- Limitaciones PWA: `PWA.md`
