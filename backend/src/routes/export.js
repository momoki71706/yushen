import { Router } from 'express';
import { generateExport } from '../export.js';

const router = Router();

// POST because it has a side effect (advances the export watermarks) —
// calling it twice in a row gives you the new content once, then an empty
// export, not the same content twice.
router.post('/', (req, res) => {
  const { content, filename, hasContent } = generateExport();
  res.json({ content, filename, hasContent });
});

export default router;
