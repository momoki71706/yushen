import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Same pattern as DB_PATH in db.js — without this, uploads live on the
// container's ephemeral disk and vanish on every redeploy even when the
// sqlite file itself survives on a mounted volume, leaving diary/letter
// photos broken after the next deploy. Point this at the same volume.
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
