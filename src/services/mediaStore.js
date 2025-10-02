const fs = require('fs');
const path = require('path');
const { generateMediaFilename, resolvePublicUrl } = require('../utils/mime');
const logger = require('../logger');

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

let mediaDir;
let publicBaseUrl;
let cleanupInterval;

function initialize(options = {}) {
  mediaDir = options.mediaDir || path.resolve(process.cwd(), process.env.MEDIA_DIR || './media');
  publicBaseUrl = options.publicBaseUrl || process.env.PUBLIC_BASE_URL;

  if (!mediaDir) {
    throw new Error('MEDIA_DIR is not configured');
  }

  if (!publicBaseUrl) {
    throw new Error('PUBLIC_BASE_URL is not configured');
  }

  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
  }
}

async function saveMedia(media) {
  if (!media || !media.data || !media.mimetype) {
    throw new Error('Media payload inválido');
  }

  const buffer = Buffer.from(media.data, 'base64');
  const filename = generateMediaFilename(media.mimetype);
  const filePath = path.join(mediaDir, filename);

  await fs.promises.writeFile(filePath, buffer);
  logger.info({ filename, filePath }, 'Mídia salva no disco');

  const publicUrl = resolvePublicUrl(publicBaseUrl, `/media/${filename}`);

  return {
    filename,
    filePath,
    publicUrl,
    mimeType: media.mimetype
  };
}

function getMediaDir() {
  if (!mediaDir) {
    throw new Error('MediaStore não inicializado');
  }
  return mediaDir;
}

function scheduleCleanup() {
  if (!mediaDir) {
    throw new Error('MediaStore não inicializado');
  }

  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }

  cleanupInterval = setInterval(async () => {
    try {
      const files = await fs.promises.readdir(mediaDir);
      const now = Date.now();
      await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(mediaDir, file);
          const stat = await fs.promises.stat(filePath);
          if (now - stat.mtimeMs > TWENTY_FOUR_HOURS_MS) {
            await fs.promises.unlink(filePath);
            logger.info({ filePath }, 'Mídia expirada removida');
          }
        })
      );
    } catch (err) {
      logger.error({ err }, 'Erro durante limpeza de mídias');
    }
  }, 60 * 60 * 1000);
}

module.exports = {
  initialize,
  saveMedia,
  getMediaDir,
  scheduleCleanup
};
