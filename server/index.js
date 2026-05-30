import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { hashPassword, verifyPassword, createToken } from './auth.js';
import { runMigrations } from './migrations.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'animdb.db');
const PORT = 5174;
const FRONTEND_PORT = 5173;
const TMDB_API_KEY = process.env.TMDB_API_KEY || '15d123b384668b5e32607593c78097b6';
const OMDB_API_KEY = process.env.OMDB_API_KEY || 'trilogy';
const TRAKT_CLIENT_ID = process.env.TRAKT_CLIENT_ID || '';

function getTailscaleIp() {
  try {
    return execSync('tailscale ip -4', { encoding: 'utf8', timeout: 3000 }).trim();
  } catch {
    return null;
  }
}

function isTailscaleOnline() {
  try {
    const out = execSync('tailscale status --json', { encoding: 'utf8', timeout: 3000 });
    const data = JSON.parse(out);
    return data?.BackendState === 'Running';
  } catch {
    return false;
  }
}

function getLocalIps() {
  const ips = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) ips.push(addr.address);
    }
  }
  return ips;
}

function getNetworkInfo() {
  const tailscaleIp = getTailscaleIp();
  const frontendPort = Number(process.env.FRONTEND_PORT) || 5173;
  return {
    hostname: os.hostname(),
    tailscaleIp,
    tailscaleAvailable: Boolean(tailscaleIp),
    tailscaleOnline: isTailscaleOnline(),
    ports: { frontend: frontendPort, backend: PORT },
    localIps: getLocalIps(),
    shareUrl: tailscaleIp ? `http://${tailscaleIp}:${frontendPort}` : null,
  };
}

let db;

async function initDB() {
  const SQL = await initSqlJs();
  if (existsSync(dbPath)) {
    db = new SQL.Database(readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }
  runMigrations(db);
  saveDB();
}

function saveDB() {
  writeFileSync(dbPath, Buffer.from(db.export()));
}

function parseItemRow(r) {
  return {
    ...r,
    moods: JSON.parse(r.moods || '[]'),
    tags: JSON.parse(r.tags || '[]'),
    isAnime: Boolean(r.isAnime),
    userId: r.user_id,
  };
}

function getItems(userId = 1) {
  const stmt = db.prepare('SELECT * FROM items WHERE user_id = ? ORDER BY priority');
  stmt.bind([userId]);
  const rows = [];
  while (stmt.step()) {
    rows.push(parseItemRow(stmt.getAsObject()));
  }
  stmt.free();
  return rows;
}

function emitItemsUpdated(userId) {
  io.to(`user:${userId}`).emit('items:updated', getItems(userId));
}

function resolveUserId(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return 1;
  const stmt = db.prepare(
    "SELECT user_id FROM sessions WHERE token = ? AND datetime(expires_at) > datetime('now')"
  );
  stmt.bind([token]);
  let userId = 1;
  if (stmt.step()) userId = stmt.getAsObject().user_id;
  stmt.free();
  return userId;
}

function getUserFromToken(token) {
  if (!token) return null;
  const stmt = db.prepare(
    `SELECT u.id, u.username FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')`
  );
  stmt.bind([token]);
  let user = null;
  if (stmt.step()) {
    const row = stmt.getAsObject();
    user = { id: row.id, username: row.username };
  }
  stmt.free();
  return user;
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] } });

app.use(cors());
app.use(express.json());

app.get('/api/network/info', (_, res) => res.json(getNetworkInfo()));
app.get('/api/network/ping', (_, res) => res.json({ ok: true, ts: Date.now() }));

app.post('/api/auth/register', (req, res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (username.length < 3) return res.status(400).json({ error: 'Usuario mínimo 3 caracteres' });
    if (password.length < 6) return res.status(400).json({ error: 'Contraseña mínimo 6 caracteres' });
    if (username === 'local') return res.status(400).json({ error: 'Nombre reservado' });

    const exists = db.prepare('SELECT id FROM users WHERE username = ?');
    exists.bind([username]);
    if (exists.step()) {
      exists.free();
      return res.status(409).json({ error: 'Usuario ya existe' });
    }
    exists.free();

    db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [
      username,
      hashPassword(password),
    ]);
    const userId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

    db.run('UPDATE items SET user_id = ? WHERE user_id = 1', [userId]);

    const token = createToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', [
      token,
      userId,
      expires,
    ]);
    saveDB();
    emitItemsUpdated(userId);
    res.json({ token, user: { id: userId, username }, expiresAt: expires });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    const stmt = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?');
    stmt.bind([username]);
    if (!stmt.step()) {
      stmt.free();
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const row = stmt.getAsObject();
    stmt.free();

    if (row.username !== 'local' && !verifyPassword(password, row.password_hash)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = createToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', [
      token,
      row.id,
      expires,
    ]);
    saveDB();
    res.json({ token, user: { id: row.id, username: row.username }, expiresAt: expires });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (token) {
    db.run('DELETE FROM sessions WHERE token = ?', [token]);
    saveDB();
  }
  res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const user = getUserFromToken(token);
  if (!user) return res.json({ user: { id: 1, username: 'local' } });
  res.json({ user });
});

app.get('/api/items', (req, res) => {
  res.json(getItems(resolveUserId(req)));
});

app.post('/api/items', (req, res) => {
  try {
    const userId = resolveUserId(req);
    const { title, type, year, genre, status, rating, notes, moods, tags, isAnime, coverUrl, priority } =
      req.body;
    db.run(
      'INSERT INTO items (user_id, title, type, year, genre, status, rating, notes, moods, tags, isAnime, coverUrl, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        userId,
        title,
        type,
        year || null,
        genre || null,
        status || 'pending',
        rating || 0,
        notes || null,
        JSON.stringify(moods || []),
        JSON.stringify(tags || []),
        isAnime ? 1 : 0,
        coverUrl || null,
        priority || 0,
      ]
    );
    const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    saveDB();
    emitItemsUpdated(userId);
    res.json({ id, userId, ...req.body });
  } catch (err) {
    console.error('Error adding item:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/items/:id', (req, res) => {
  const userId = resolveUserId(req);
  const { title, type, year, genre, status, rating, notes, moods, tags, isAnime, coverUrl, priority } =
    req.body;
  db.run(
    'UPDATE items SET title=?, type=?, year=?, genre=?, status=?, rating=?, notes=?, moods=?, tags=?, isAnime=?, coverUrl=?, priority=? WHERE id=? AND user_id=?',
    [
      title,
      type,
      year || null,
      genre || null,
      status || 'pending',
      rating || 0,
      notes || null,
      JSON.stringify(moods || []),
      JSON.stringify(tags || []),
      isAnime ? 1 : 0,
      coverUrl || null,
      priority || 0,
      req.params.id,
      userId,
    ]
  );
  saveDB();
  emitItemsUpdated(userId);
  res.json({ id: Number(req.params.id), ...req.body });
});

app.delete('/api/items/:id', (req, res) => {
  const userId = resolveUserId(req);
  db.run('DELETE FROM items WHERE id = ? AND user_id = ?', [req.params.id, userId]);
  saveDB();
  emitItemsUpdated(userId);
  res.json({ success: true });
});

app.post('/api/items/bulk', (req, res) => {
  try {
    const userId = resolveUserId(req);
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number) : [];
    const patch = req.body.patch || {};
    if (!ids.length) return res.status(400).json({ error: 'Sin IDs' });

    const allowed = ['status', 'rating', 'moods', 'tags', 'isAnime', 'type'];
    let updated = 0;

    for (const id of ids) {
      const item = getItems(userId).find((i) => i.id === id);
      if (!item) continue;
      const next = { ...item, ...patch };
      db.run(
        'UPDATE items SET title=?, type=?, year=?, genre=?, status=?, rating=?, notes=?, moods=?, tags=?, isAnime=?, coverUrl=?, priority=? WHERE id=? AND user_id=?',
        [
          next.title,
          next.type,
          next.year || null,
          next.genre || null,
          next.status || 'pending',
          next.rating || 0,
          next.notes || null,
          JSON.stringify(next.moods || []),
          JSON.stringify(next.tags || []),
          next.isAnime ? 1 : 0,
          next.coverUrl || null,
          next.priority || 0,
          id,
          userId,
        ]
      );
      updated++;
    }

    saveDB();
    emitItemsUpdated(userId);
    res.json({ updated, allowed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/filters', (req, res) => {
  const userId = resolveUserId(req);
  const stmt = db.prepare('SELECT id, name, config FROM saved_filters WHERE user_id = ? ORDER BY id');
  stmt.bind([userId]);
  const rows = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    rows.push({ id: r.id, name: r.name, ...JSON.parse(r.config || '{}') });
  }
  stmt.free();
  res.json(rows);
});

app.post('/api/filters', (req, res) => {
  const userId = resolveUserId(req);
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  const config = JSON.stringify({
    contentFilter: req.body.contentFilter || 'all',
    temaId: req.body.temaId || null,
    status: req.body.status || null,
    minRating: req.body.minRating || 0,
    listFilter: req.body.listFilter || 'all',
    tag: req.body.tag || null,
  });
  db.run('INSERT INTO saved_filters (user_id, name, config) VALUES (?, ?, ?)', [
    userId,
    name,
    config,
  ]);
  const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
  saveDB();
  res.json({ id, name, ...JSON.parse(config) });
});

app.delete('/api/filters/:id', (req, res) => {
  const userId = resolveUserId(req);
  db.run('DELETE FROM saved_filters WHERE id = ? AND user_id = ?', [req.params.id, userId]);
  saveDB();
  res.json({ success: true });
});

app.get('/api/import/anilist/:username', async (req, res) => {
  const username = String(req.params.username || '').trim();
  if (!username) return res.status(400).json({ error: 'Usuario requerido' });
  try {
    const query = `
      query ($name: String) {
        Page(page: 1, perPage: 500) {
          mediaListOptions { userName }
          mediaList(userName: $name, type: ANIME) {
            status
            score(format: POINT_10_DECIMAL)
            media {
              id
              title { romaji english native }
              format
              seasonYear
              coverImage { large }
              genres
            }
          }
        }
      }`;
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { name: username } }),
    });
    const data = await response.json();
    if (data.errors?.length) return res.status(404).json({ error: data.errors[0].message });

    const entries = data.data?.Page?.mediaList || [];
    const items = entries.map((entry) => {
      const m = entry.media;
      const title = m.title.english || m.title.romaji || m.title.native;
      const statusMap = {
        COMPLETED: 'watched',
        CURRENT: 'watching',
        PLANNING: 'pending',
        DROPPED: 'dropped',
        PAUSED: 'watching',
        REPEATING: 'watching',
      };
      return {
        title,
        type: m.format === 'MOVIE' ? 'movie' : 'series',
        year: m.seasonYear ? String(m.seasonYear) : undefined,
        genre: (m.genres || []).join(', '),
        status: statusMap[entry.status] || 'pending',
        rating: entry.score ? Math.min(10, entry.score) : 0,
        coverUrl: m.coverImage?.large,
        isAnime: true,
        moods: [],
        tags: [],
        externalId: { anilist: m.id },
      };
    });
    res.json({ source: 'anilist', username, count: items.length, items });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/import/mal/:username', async (req, res) => {
  const username = String(req.params.username || '').trim();
  if (!username) return res.status(400).json({ error: 'Usuario requerido' });
  try {
    const response = await fetch(
      `https://api.jikan.moe/v4/users/${encodeURIComponent(username)}/animelist`
    );
    if (!response.ok) return res.status(404).json({ error: 'Usuario MAL no encontrado' });
    const data = await response.json();
    const entries = data.data || [];
    const statusMap = {
      completed: 'watched',
      watching: 'watching',
      plan_to_watch: 'pending',
      dropped: 'dropped',
      on_hold: 'watching',
    };
    const items = entries.map((entry) => {
      const a = entry.anime;
      return {
        title: a.title_english || a.title,
        type: a.type?.toLowerCase().includes('movie') ? 'movie' : 'series',
        year: a.year ? String(a.year) : undefined,
        status: statusMap[entry.status] || 'pending',
        rating: entry.score ? Math.min(10, entry.score) : 0,
        coverUrl: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url,
        isAnime: true,
        moods: [],
        tags: [],
        externalId: { mal: a.mal_id },
      };
    });
    res.json({ source: 'mal', username, count: items.length, items });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/import/trakt/:username', async (req, res) => {
  const username = String(req.params.username || '').trim();
  if (!username) return res.status(400).json({ error: 'Usuario requerido' });
  if (!TRAKT_CLIENT_ID) {
    return res.status(503).json({
      error: 'Configura TRAKT_CLIENT_ID en el servidor para importar desde Trakt',
    });
  }
  try {
    const headers = {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': TRAKT_CLIENT_ID,
    };
    const [moviesRes, showsRes] = await Promise.all([
      fetch(`https://api.trakt.tv/users/${encodeURIComponent(username)}/ratings/movies`, { headers }),
      fetch(`https://api.trakt.tv/users/${encodeURIComponent(username)}/ratings/shows`, { headers }),
    ]);
    if (!moviesRes.ok && !showsRes.ok) {
      return res.status(404).json({ error: 'Usuario Trakt no encontrado o perfil privado' });
    }
    const movies = moviesRes.ok ? await moviesRes.json() : [];
    const shows = showsRes.ok ? await showsRes.json() : [];
    const items = [
      ...movies.map((r) => ({
        title: r.movie?.title,
        type: 'movie',
        year: r.movie?.year ? String(r.movie.year) : undefined,
        rating: r.rating ? Math.min(10, r.rating) : 0,
        status: r.rating > 0 ? 'watched' : 'pending',
        isAnime: false,
        moods: [],
        tags: [],
        coverUrl: undefined,
      })),
      ...shows.map((r) => ({
        title: r.show?.title,
        type: 'series',
        year: r.show?.year ? String(r.show.year) : undefined,
        rating: r.rating ? Math.min(10, r.rating) : 0,
        status: r.rating > 0 ? 'watched' : 'pending',
        isAnime: false,
        moods: [],
        tags: [],
        coverUrl: undefined,
      })),
    ].filter((i) => i.title);
    res.json({ source: 'trakt', username, count: items.length, items });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/metadata/tmdb/search', async (req, res) => {
  const query = String(req.query.q || '');
  if (!query) return res.json({ results: [] });
  try {
    const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=es-ES&include_adult=false`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/metadata/omdb', async (req, res) => {
  const imdbId = String(req.query.i || '');
  if (!imdbId) return res.status(400).json({ error: 'Missing i parameter' });
  try {
    const url = `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${OMDB_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

io.on('connection', (socket) => {
  const token = socket.handshake.auth?.token;
  const user = getUserFromToken(token);
  const userId = user?.id || 1;
  socket.join(`user:${userId}`);
  socket.emit('items:updated', getItems(userId));
  console.log('Client connected:', socket.id, 'user:', userId);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

initDB().then(() => {
  httpServer.listen(PORT, '0.0.0.0', () =>
    console.log(`AniMDB API + WebSocket running on port ${PORT}`)
  );
});
