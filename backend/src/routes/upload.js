import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { UPLOAD_DIR } from '../uploadDir.js';

export { UPLOAD_DIR };

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB — generous for phone photos, not so large a single upload can stall the connection

// iPhone's default camera format — browsers (and most non-Apple contexts)
// don't render it in an <img> tag at all, so a photo uploaded straight off
// an iPhone would silently show as a broken image everywhere in the app.
// Converting it server-side means it doesn't matter what format the photo
// came in as.
const HEIC_MIME = new Set(['image/heic', 'image/heif']);
const HEIC_EXT = new Set(['.heic', '.heif']);

function isHeic(file) {
  return HEIC_MIME.has((file.mimetype || '').toLowerCase()) || HEIC_EXT.has(path.extname(file.originalname || '').toLowerCase());
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: MAX_FILE_SIZE } }).single('file');

// Converts an on-disk HEIC/HEIF file to a JPEG sitting next to it and
// removes the original — returns the new { filename, mime, size }, or null
// if the conversion itself fails, in which case the caller just serves the
// original file rather than failing the whole upload over this.
async function convertHeicToJpeg(file) {
  const jpegFilename = `${path.basename(file.filename, path.extname(file.filename))}.jpg`;
  const jpegPath = path.join(UPLOAD_DIR, jpegFilename);
  try {
    await sharp(file.path).jpeg({ quality: 88 }).toFile(jpegPath);
    await fs.unlink(file.path).catch(() => {});
    const stat = await fs.stat(jpegPath);
    return { filename: jpegFilename, mime: 'image/jpeg', size: stat.size };
  } catch (err) {
    console.error('[upload] HEIC conversion failed, serving original file:', err.message);
    await fs.unlink(jpegPath).catch(() => {});
    return null;
  }
}

const router = Router();

router.post('/', (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: `文件太大了，最大支持 ${MAX_FILE_SIZE / 1024 / 1024}MB` });
      }
      return res.status(400).json({ error: err.message || '上传失败' });
    }
    if (!req.file) return res.status(400).json({ error: 'file is required' });

    let { filename, mimetype: mime, size } = req.file;
    if (isHeic(req.file)) {
      const converted = await convertHeicToJpeg(req.file);
      if (converted) ({ filename, mime, size } = converted);
    }

    res.json({
      url: `/uploads/${filename}`,
      name: req.file.originalname,
      mime,
      size,
    });
  });
});

export default router;
