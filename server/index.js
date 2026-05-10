import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'animdb.db');
const PORT = 5174;

let db;

async function initDB() {
  const SQL = await initSqlJs();
  if (existsSync(dbPath)) {
    db = new SQL.Database(readFileSync(dbPath));
  } else {
    db = new SQL.Database();
    db.run('CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, type TEXT NOT NULL DEFAULT movie, year TEXT, genre TEXT, status TEXT DEFAULT pending, rating REAL DEFAULT 0, notes TEXT, moods TEXT DEFAULT [], isAnime INTEGER DEFAULT 1, coverUrl TEXT, priority INTEGER DEFAULT 0)');
    saveDB();
  }
}

function saveDB() {
  writeFileSync(dbPath, Buffer.from(db.export()));
}

function getItems() {
  const stmt = db.prepare('SELECT * FROM items ORDER BY priority');
  const rows = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    rows.push({ ...r, moods: JSON.parse(r.moods || '[]'), isAnime: Boolean(r.isAnime) });
  }
  stmt.free();
  return rows;
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });

app.use(cors());
app.use(express.json());

app.get('/api/items', (_, res) => res.json(getItems()));

app.post('/api/items', (req, res) => {
  const { title, type, year, genre, status, rating, notes, moods, isAnime, coverUrl, priority } = req.body;
  db.run('INSERT INTO items (title, type, year, genre, status, rating, notes, moods, isAnime, coverUrl, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [title, type, year || null, genre || null, status || 'pending', rating || 0, notes || null, JSON.stringify(moods || []), isAnime ? 1 : 0, coverUrl || null, priority || 0]);
  const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
  saveDB();
  io.emit('items:updated', getItems());
  res.json({ id, ...req.body });
});

app.put('/api/items/:id', (req, res) => {
  const { title, type, year, genre, status, rating, notes, moods, isAnime, coverUrl, priority } = req.body;
  db.run('UPDATE items SET title=?, type=?, year=?, genre=?, status=?, rating=?, notes=?, moods=?, isAnime=?, coverUrl=?, priority=? WHERE id=?',
    [title, type, year || null, genre || null, status || 'pending', rating || 0, notes || null, JSON.stringify(moods || []), isAnime ? 1 : 0, coverUrl || null, priority || 0, req.params.id]);
  saveDB();
  io.emit('items:updated', getItems());
  res.json({ id: Number(req.params.id), ...req.body });
});

app.delete('/api/items/:id', (req, res) => {
  db.run('DELETE FROM items WHERE id = ?', [req.params.id]);
  saveDB();
  io.emit('items:updated', getItems());
  res.json({ success: true });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

initDB().then(() => {
  httpServer.listen(PORT, '0.0.0.0', () => console.log(`AniMDB API + WebSocket running on port ${PORT}`));
});