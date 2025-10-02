const crypto = require('crypto');

const MIME_EXTENSION_MAP = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'audio/mpeg': '.mp3',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'video/mp4': '.mp4',
  'video/3gpp': '.3gp',
  'application/pdf': '.pdf',
  'application/zip': '.zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
};

function getExtensionFromMime(mimeType = '') {
  if (!mimeType) return '';
  if (MIME_EXTENSION_MAP[mimeType]) {
    return MIME_EXTENSION_MAP[mimeType];
  }

  const parts = mimeType.split('/');
  if (parts.length !== 2) {
    return '';
  }

  const subtype = parts[1].split(';')[0];
  if (!subtype) {
    return '';
  }

  return `.${subtype}`;
}

function sanitizeFilename(filename = '') {
  return filename.replace(/[^a-zA-Z0-9-_\.]/g, '_');
}

function generateMediaFilename(mimeType) {
  const extension = getExtensionFromMime(mimeType);
  return `${crypto.randomUUID()}${extension}`;
}

function resolvePublicUrl(baseUrl, relativePath) {
  if (!baseUrl) {
    throw new Error('PUBLIC_BASE_URL is not configured.');
  }
  const normalized = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  return new URL(normalized, baseUrl).toString();
}

module.exports = {
  getExtensionFromMime,
  sanitizeFilename,
  generateMediaFilename,
  resolvePublicUrl
};
