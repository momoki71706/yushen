import { Router } from 'express';
import { generateExport, getLastExport } from '../export.js';

const router = Router();

// POST because it has a side effect (advances the export watermarks) —
// calling it twice in a row gives you the new content once, then an empty
// export, not the same content twice.
router.post('/', (req, res) => {
  const { content, filename, hasContent } = generateExport();
  res.json({ content, filename, hasContent });
});

// No side effect — just re-serves whatever the last successful export
// above already produced, for recovering a lost/closed download.
router.get('/last', (req, res) => {
  const { content, filename, hasContent } = getLastExport();
  res.json({ content, filename, hasContent });
});

export default router;
