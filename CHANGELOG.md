# Changelog

All notable changes to this project will be documented in this file.

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