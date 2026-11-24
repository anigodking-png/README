import Database from 'better-sqlite3';
import path from 'node:path';

const db = new Database(
  path.join(process.cwd(), 'backend', 'yabei.db')
);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS app_info (
    id INTEGER PRIMARY KEY,
    business_name TEXT NOT NULL,
    currency TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_data (
    id INTEGER PRIMARY KEY,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

db.prepare(`
  INSERT OR IGNORE INTO app_info (id, business_name, currency)
  VALUES (1, 'Yabei Hardware', 'KSh')
`).run();

export default db;
