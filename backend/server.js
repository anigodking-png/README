
import express from 'express';
import cors from 'cors';
import db from './database.js';

const app = express();
const PORT = 3001;

app.use(cors({
  origin: 'http://localhost:5173'
}));

app.use(express.json({ limit: '5mb' }));

app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: 'Yabei Hardware server is running',
    business: 'Yabei Hardware',
    currency: 'KSh'
  });
});

// Load saved business data
app.get('/api/data', (req, res) => {
  try {
    const row = db.prepare(
      'SELECT data_json FROM app_data WHERE id = 1'
    ).get();

    res.json(row ? JSON.parse(row.data_json) : null);
  } catch {
    res.status(500).json({ error: 'Could not load business data.' });
  }
});

// Save business data
app.post('/api/data', (req, res) => {
  try {
    const data = req.body;

    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      !Array.isArray(data.products) ||
      !Array.isArray(data.customers) ||
      !Array.isArray(data.sales) ||
      !Array.isArray(data.expenses) ||
      !Array.isArray(data.employees)
    ) {
      return res.status(400).json({ error: 'Invalid business data.' });
    }

    db.prepare(`
      INSERT INTO app_data (id, data_json, updated_at)
      VALUES (1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        data_json = excluded.data_json,
        updated_at = CURRENT_TIMESTAMP
    `).run(JSON.stringify(data));

    res.json({ success: true, message: 'Data saved.' });
  } catch {
    res.status(500).json({ error: 'Could not save business data.' });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log('YABEI HARDWARE SERVER RUNNING');
  console.log(`Address: http://127.0.0.1:${PORT}`);
});
