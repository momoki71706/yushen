import fs from 'node:fs/promises';
import path from 'node:path';
import { UPLOAD_DIR } from './uploadDir.js';

// Kept well under any provider's per-image payload limit — phone photos can
// run to 10-20MB, and base64 inflates that by another third on top.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
// A whole text file dumped into the system/user turn still costs context —
// this caps it to something a reply can reasonably digest without either
// blowing the token budget or drowning the actual conversation.
const MAX_TEXT_CHARS = 6000;

// Only the image formats every provider's vision input actually accepts —
// anything else (notably iPhone's default HEIC) silently falls back to the
// bracketed placeholder rather than failing the whole reply.
const SUPPORTED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const TEXT_MIME_EXACT = new Set([
  'application/json',
  'application/javascript',
  'application/xml',
  'application/x-yaml',
  'application/x-sh',
]);
const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.json', '.js', '.jsx', '.ts', '.tsx', '.py', '.csv',
  '.log', '.yml', '.yaml', '.xml', '.html', '.css', '.c', '.cpp', '.h', '.java',
  '.go', '.rs', '.sh', '.rb', '.php', '.sql', '.ini', '.conf',
]);

function urlToPath(url) {
  const filename = path.basename(url || '');
  return filename ? path.join(UPLOAD_DIR, filename) : null;
}

export function isReadableImage(mime) {
  return SUPPORTED_IMAGE_MIME.has(mime);
}

export function isReadableText(mime, name) {
  if (mime && (mime.startsWith('text/') || TEXT_MIME_EXACT.has(mime))) return true;
  return TEXT_EXTENSIONS.has(path.extname(name || '').toLowerCase());
}

// Returns { mediaType, base64 } for a row whose attachment is a
// vision-supported image under the size cap, or null if it can't be read
// (missing file, unsupported format, too large) — callers fall back to the
// placeholder text in that case rather than failing the reply.
export async function readImageAttachment(row) {
  const filePath = urlToPath(row.attachment_url);
  if (!filePath || !isReadableImage(row.attachment_mime)) return null;
  try {
    const stat = await fs.stat(filePath);
    if (stat.size > MAX_IMAGE_BYTES) return null;
    const buf = await fs.readFile(filePath);
    return { mediaType: row.attachment_mime, base64: buf.toString('base64') };
  } catch {
    return null;
  }
}

// Returns { text, truncated } for a row whose attachment is a plain-text
// file, or null if it can't be read as text — same fallback contract as
// readImageAttachment.
export async function readTextAttachment(row) {
  const filePath = urlToPath(row.attachment_url);
  if (!filePath || !isReadableText(row.attachment_mime, row.attachment_name)) return null;
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return { text: content.slice(0, MAX_TEXT_CHARS), truncated: content.length > MAX_TEXT_CHARS };
  } catch {
    return null;
  }
}
