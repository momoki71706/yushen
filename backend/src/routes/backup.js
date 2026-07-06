import { Router } from 'express';
import { db, dbPath } from '../db.js';

const router = Router();

// A raw download of the whole database — every table, not just the pieces
// 导出回忆 knows how to format as Markdown (favorites, ledger, habits,
// health data, presets, everything). This is the actual safety net: if the
// hosting platform's disk ever gets wiped again (redeploy without a
// persistent volume, etc.), this file is what lets everything come back
// instead of just the chat/diary/letter/favorite text.
router.get('/download', (req, res) => {
  // WAL mode means recent writes can still be sitting in the separate
  // -wal file rather than the main .sqlite file — checkpointing folds
  // them in first so the single downloaded file is actually complete,
  // not missing whatever was written in roughly the last few minutes.
  db.pragma('wal_checkpoint(TRUNCATE)');
  const date = new Date().toISOString().slice(0, 10);
  res.download(dbPath, `小晴与屿深-完整备份-${date}.sqlite`);
});

export default router;
