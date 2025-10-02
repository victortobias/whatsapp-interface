const path = require('path');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const logger = require('./logger');

const MEDIA_KIND_MAP = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  ptt: 'audio',
  document: 'document',
  sticker: 'sticker',
  voice: 'audio'
};

function createWhatsappClient({ mediaStore, n8nClient, sessionDir }) {
  if (!mediaStore) {
    throw new Error('mediaStore é obrigatório');
  }
  if (!n8nClient) {
    throw new Error('n8nClient é obrigatório');
  }

  const resolvedSessionDir = sessionDir || process.env.WHATSAPP_SESSION_DIR || './session';

  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.resolve(process.cwd(), resolvedSessionDir)
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  client.on('qr', (qr) => {
    logger.info('QR Code recebido. Escaneie para autenticar.');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    logger.info('Cliente WhatsApp está pronto.');
  });

  client.on('authenticated', () => {
    logger.info('Autenticado no WhatsApp com sucesso.');
  });

  client.on('auth_failure', (msg) => {
    logger.error({ msg }, 'Falha de autenticação no WhatsApp');
  });

  client.on('disconnected', (reason) => {
    logger.warn({ reason }, 'Cliente WhatsApp desconectado');
  });

  client.on('message', async (message) => {
    if (message.fromMe) {
      return;
    }

    const chatId = message.from;
    const messageId = message.id && message.id._serialized ? message.id._serialized : message.id;
    const timestamp = message.timestamp;

    logger.info({ chatId, messageId, type: message.type }, 'Mensagem recebida do WhatsApp');

    try {
      if (message.hasMedia) {
        await handleMediaMessage({ message, chatId, messageId, timestamp, mediaStore, n8nClient });
      } else if (message.type === 'chat') {
        await handleTextMessage({ message, chatId, messageId, timestamp, n8nClient });
      } else {
        logger.info({ chatId, messageId, type: message.type }, 'Tipo de mensagem não suportado para media/texto. Enviando metadados ao n8n.');
        await n8nClient.sendEvent({
          type: 'unknown',
          messageType: message.type,
          from: message.from,
          chatId,
          messageId,
          timestamp
        });
      }
    } catch (err) {
      logger.error({ err: err.message, chatId, messageId }, 'Erro ao processar mensagem recebida do WhatsApp');
    }
  });

  return client;
}

async function handleTextMessage({ message, chatId, messageId, timestamp, n8nClient }) {
  const text = message.body || '';
  const payload = {
    type: 'text',
    from: message.from,
    chatId,
    messageId,
    text,
    timestamp
  };
  await n8nClient.sendEvent(payload);
}

async function handleMediaMessage({ message, chatId, messageId, timestamp, mediaStore, n8nClient }) {
  const media = await message.downloadMedia();
  if (!media) {
    throw new Error('Não foi possível baixar a mídia');
  }

  const saved = await mediaStore.saveMedia(media);
  const mediaKind = MEDIA_KIND_MAP[message.type] || inferMediaKind(media.mimetype);

  const payload = {
    type: 'media',
    mediaKind,
    from: message.from,
    chatId,
    messageId,
    mimeType: saved.mimeType,
    mediaUrl: saved.publicUrl,
    caption: message.caption || message.body,
    timestamp
  };

  await n8nClient.sendEvent(payload);
}

function inferMediaKind(mimeType = '') {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf') return 'document';
  return 'document';
}

module.exports = createWhatsappClient;
