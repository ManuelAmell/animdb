# AniMDB — Tu Gestor Personal de Anime

**AniMDB** es una aplicación web diseñada para ayudarte a organizar tu colección de anime y películas. Construida con **Vite + TypeScript** + **Express backend** con **SQLite**, ofrece una experiencia moderna y accesible desde cualquier dispositivo.

![AniMDB Logo](icon.png)

## 🚀 Características Principales

- **✨ Interfaz Glassmorphic**: Diseño visualmente impactante con efectos de desenfoque y animaciones suaves
- **⭐ Puntuación con Mitades**: Sistema de calificación preciso de 0 a 10 con incrementos de 0.5
- **⚡ Selector Rápido**: Puntúa tus animes directamente desde la tarjeta con un solo clic
- **↕️ Reordenación Drag-and-Drop**: Organiza tu Ranking arrastrando elementos
- **📥 Importación Inteligente**: Soporte para archivos `.json` (backups) y `.txt` (formato `Nombre - Puntuación`)
- **🔍 Búsqueda de Metadatos**:
  - Búsqueda por nombre: Jikan (MyAnimeList), TMDB y TVMaze
  - Búsqueda por ID: IMDB ID (OMDb), Kitsu ID, MyAnimeList ID
- **⏳ Sección de Pendientes**: Vista dedicada con secciones para Películas, Series y Series Anime
- **🗂️ Organización Avanzada**: Filtra por categorías, estados y estados de ánimo (Moods)
- **🌐 Acceso Remoto**: Funciona via Tailscale desde cualquier dispositivo

## 📸 Capturas de Pantalla

| Vista Principal | Ranking de Anime |
| :---: | :---: |
| ![Main Page](evidence/mainpage.png) | ![Ranking](evidence/ranking.png) |

| Importación de Datos | Exportación y Backup |
| :---: | :---: |
| ![Import](evidence/importar.png) | ![Export](evidence/exportar.png) |

## 🛠️ Instalación

1. Clona el repositorio:
   ```bash
   git clone https://github.com/ManuelAmell/animdb.git
   cd animdb
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Instala las dependencias del servidor:
   ```bash
   cd server && npm install
   ```

## 🚦 Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run start` | Inicia el servidor y frontend en segundo plano |
| `npm run dev` | Inicia solo el frontend (Vite) |
| `npm run dev:server` | Inicia solo el servidor (Express + SQLite) |
| `npm run dev:client` | Inicia el frontend (Vite) |
| `npm run stop` | Detiene todos los servicios |
| `npm run build` | Compila TypeScript y construye la app |
| `npm run preview` | Pre-visualiza la build de producción |

### Desarrollo
```bash
# Iniciar todo (servidor + frontend)
npm run start

# O en terminales separadas:
# Terminal 1: servidor
npm run dev:server
# Terminal 2: frontend
npm run dev
```

### Producción
```bash
# Construir app
npm run build

# Pre-visualizar
npm run preview
```

## 🔧 Acceso Remoto (Tailscale)

La app está configurada para funcionar via Tailscale. Ver [TAILSCALE.md](TAILSCALE.md) para detalles.

Puertos:
- **Frontend**: `http://<tailscale-ip>:5173`
- **Backend API**: `http://<tailscale-ip>:5174`

## 💾 Base de Datos

Los datos se almacenan en `server/animdb.db` (SQLite). El servidor:
- Expone API REST en `/api/items`
- Sincroniza cambios via WebSocket a todos los clientes conectados

## 📜 Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.

---

*Hecho con ❤️ para la comunidad Otaku.*