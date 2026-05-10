# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-05-10

### Added
- **Backend Server**: Express + SQLite (sql.js) servidor propio
- **WebSocket Sync**: Sincronización en tiempo real via Socket.io
- **Remote Access**: Acceso via Tailscale desde cualquier dispositivo
- **NPM Scripts**: `npm run start` y `npm run stop` para gestionar servicios

### Changed
- **Data Storage**: De localStorage a SQLite (server/animdb.db)
- **API**: Nuevo backend REST en puerto 5174

### Fixed
- Problemas de CORS y acceso remoto
- Import de socket.io-client

## [1.1.0] - 2026-05-03

### Added
- **Desktop App**: Full Electron desktop application with native window controls
- **Windows Installer**: NSIS installer with desktop and start menu shortcuts
- **App Icon**: Custom icon visible in taskbar and window title
- **Responsive Nav**: Improved navigation bar for smaller window sizes
- **Production Build**: Optimized build with relative asset paths for Electron

### Fixed
- Asset loading issues in production (CSS/JS not loading)
- Path resolution for production builds in Electron

### Technical
- Vite base path configuration for relative paths
- Electron main process updated for proper production path resolution

## [1.0.0] - 2026-05-02

### Added
- **Glassmorphism UI**: Premium dark theme with blur effects
- **Rating System**: 0-10 with 0.5 increments and IMDB-style picker
- **Quick Rating**: Rate directly from card with one click
- **Drag & Drop Ranking**: Reorder items in ranking by dragging (even with same score)
- **Import/Export**: 
  - JSON backup format
  - TXT format (Title - Score)
- **Metadata Search**: 
  - By name: Jikan (MyAnimeList), TMDB, TVMaze
  - By ID: IMDB, Kitsu, MyAnimeList
- **Pending Section**: Dedicated view with grid/list modes
- **Series Anime Section**: Separate category for anime series in pending
- **Mood Chips**: Themed organization with glass styling
- **Multiple Views**: List, Ranking, Pending, Themes
- **Filter Tabs**: All, Top, Pending filters
- **Detail Modal**: Full item information with editing
- **Electron Support**: Desktop app with native features

### Fixed
- TypeScript compilation errors
- Duplicate cover issue when searching for covers
- API key issues - switched to working alternatives
- Mood chip styling for consistent UI
- Layout issues with ID search inputs

### Technical
- Built with Vite + TypeScript
- Electron for desktop packaging
- Local storage for data persistence
- Responsive design with mobile support