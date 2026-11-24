
import express from 'express';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Keep the database inside the backend folder.
const db = new Database(path.join(__dirname, 'yabei.db'));

app.use(express.json());

// Create a basic database information table.
db.exec(`
  CREATE TABLE IF NOT EXISTS app_info (
    id INTEGER PRIMARY KEY,
    business_name TEXT NOT NULL,
    currency TEXT NOT NULL
  );
`);

db.prepare(`
  INSERT OR IGNORE INTO app_info
  (id, business_name, currency)
  VALUES (1, 'Yabei Hardware', 'KSh')
`).run();

// Test the server.
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: 'Yabei Hardware server is running',
    business: 'Yabei Hardware',
    currency: 'KSh'
  });
});

// Local computer access only for now.
app.listen(PORT, '127.0.0.1', () => {
  console.log('YABEI HARDWARE SERVER RUNNING');
  console.log(`Address: http://127.0.0.1:${PORT}`);
});
