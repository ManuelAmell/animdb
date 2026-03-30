# AniMDB — Tu Gestor Personal de Anime

**AniMDB** es una aplicación de escritorio ligera, rápida y minimalista diseñada para ayudarte a organizar tu colección de anime y películas. Construida con **Electron** y con una estética **Premium Glassmorphism**, ofrece una experiencia de usuario fluida y moderna diseñada para mi disfrutenla.

![AniMDB Logo](icon.png)


## 🚀 Características Principales

- **✨ Interfaz Glassmorphic**: Un diseño visualmente impactante con efectos de desenfosque dinámicos y animaciones suaves.
- **⭐ Puntuación con Mitades**: Sistema de calificación preciso de 0 a 10 con incrementos de 0.5.
- **⚡ Selector Rápido**: Puntúa tus animes directamente desde la tarjeta con un solo clic.
- **↕️ Reordenación Drag-and-Drop**: Organiza tu Ranking y tus Pendientes simplemente arrastrando los elementos.
- **📥 Importación Inteligente**: Soporte para archivos `.json` (backups) y `.txt` (formato `Nombre - Puntuación`).
- **🔍 Búsqueda de Metadatos**: Integración con Jikan (MyAnimeList), TMDB y TVMaze para obtener portadas automáticamente.
- **⏳ Sección de Pendientes**: Vista dedicada para lo que tienes por ver, con modo lista y cuadrícula.
- **🗂️ Organización Avanzada**: Filtra por categorías, estados (Visto, Viendo, Pendiente) y estados de ánimo (Moods).

## 🛠️ Instalación y Uso
- [Node.js](https://nodejs.org/) instalado en tu sistema.

### Pasos para ejecutar
1. Clona este repositorio:
   ```bash
   git clone https://github.com/ManuelAmell/animdb.git
   cd animdb
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Inicia la aplicación:
   ```bash
   npm start
   ```

## 📦 Empaquetado

Para crear una versión distribuible (AppImage para Linux):
```bash
npm run dist
```
El archivo resultante se encontrará en la carpeta `dist/`.

## 📜 Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.

---
*Hecho con ❤️ para la comunidad Otaku.*
