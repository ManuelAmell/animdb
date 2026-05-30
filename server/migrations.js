export function getTableColumns(db, table) {
  const result = db.exec(`PRAGMA table_info(${table})`);
  if (!result.length) return [];
  return result[0].values.map((row) => row[1]);
}

export function runMigrations(db) {
  const itemCols = getTableColumns(db, 'items');

  if (!itemCols.length) {
    db.run(`CREATE TABLE items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'movie',
      year TEXT,
      genre TEXT,
      status TEXT DEFAULT 'pending',
      rating REAL DEFAULT 0,
      notes TEXT,
      moods TEXT DEFAULT '[]',
      tags TEXT DEFAULT '[]',
      isAnime INTEGER DEFAULT 1,
      coverUrl TEXT,
      priority INTEGER DEFAULT 0
    )`);
  } else {
    if (!itemCols.includes('user_id')) {
      db.run('ALTER TABLE items ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1');
    }
    if (!itemCols.includes('tags')) {
      db.run("ALTER TABLE items ADD COLUMN tags TEXT DEFAULT '[]'");
    }
  }

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS saved_filters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    config TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  const users = db.exec('SELECT COUNT(*) FROM users');
  const userCount = users[0]?.values[0]?.[0] || 0;
  if (userCount === 0) {
    db.run(
      "INSERT INTO users (id, username, password_hash) VALUES (1, 'local', '')"
    );
  }
}
