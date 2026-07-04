import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

function serialize(row) {
  return { id: row.id, toolName: row.tool_name, summary: row.summary, createdAt: row.created_at };
}

router.get('/recent', (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 100));
  const rows = db.prepare('SELECT * FROM memory_log ORDER BY id DESC LIMIT ?').all(limit);
  res.json(rows.map(serialize));
});

export default router;
