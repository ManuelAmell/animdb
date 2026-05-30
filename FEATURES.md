# Guía de funciones — AniMDB

## Vistas

### Lista
- Películas y series en cuadrícula
- Filtros por sección: Todas / Top (≥8) / Pendientes
- Orden: predeterminado, puntuación, título, año
- **Guardar filtro**: escribe un nombre y pulsa «Guardar filtro»; aparece un chip reutilizable

### Ranking
- Orden por puntuación; drag-and-drop para prioridad manual
- Filtros: tipo, sin puntuar, **temas** (Triste, Acción, Romance)
- Respeta el filtro global Anime / Cine

### Pendientes
- Modos cuadrícula y lista
- Enlace directo a vista **Kanban**

### Kanban
- **Por estado**: Por ver · Viendo · Terminado · Drop  
- **Por temas**: columnas según moods (Triste, Acción, etc.)
- Arrastra entre columnas de estado para cambiar `status`

### Temas
- Exploración por moods predefinidos
- Al seleccionar un tema, filtra el resto de vistas

## Barra superior

| Control | Función |
|---------|---------|
| **Todo / Anime / Cine** | Filtro global persistente |
| **Checkbox** | Modo selección múltiple (bulk) |
| **Usuario** | Login, registro, logout |
| **Conexión** | Centro de red (local / Tailscale) |
| **Buscar** | Lista local + descubrir + puntuar |
| **Carátulas** | Busca covers faltantes en **toda** la lista |
| **Listas** | Import AniList, MAL, Trakt, Letterboxd |
| **Importar / Exportar** | Archivos JSON, CSV, TXT, MD |

## Bulk actions

1. Activa el icono de selección en la nav
2. Marca tarjetas en la lista
3. Usa la barra inferior: estado, nota, tema, tag o eliminar

## Tags personalizados

En el modal de añadir/editar, campo **Tags personalizados**:

```
#rewatch #con-amigos #2024
```

Los tags son libres (con `#`) y se pueden buscar en el buscador global. Cada usuario tiene su propia colección al iniciar sesión.

## Cuentas de usuario

- Usuario **local** (id 1): modo sin login; datos compartidos en ese servidor
- **Registrar**: crea cuenta; migra items del usuario local a la nueva cuenta
- **Entrar**: carga solo los items de ese usuario
- **Salir**: vuelve al modo local

## Atajos de teclado

| Tecla | Acción |
|-------|--------|
| `N` | Nueva entrada |
| `?` | Atajos |
| `/` | Focus buscador |
| `Esc` | Cerrar modales / búsqueda |

## Tema claro / oscuro

Botón de sol/luna en la nav. Preferencia en `localStorage` (`animdb-theme`).
