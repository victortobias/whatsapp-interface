const express = require('express');
const axios = require('axios');
const { MessageMedia, Buttons, List } = require('whatsapp-web.js');
const logger = require('../logger');

const MAX_MEDIA_SIZE = 20 * 1024 * 1024; // 20MB

function createInboundRouter({ client, replyApiKey }) {
  if (!client) {
    throw new Error('WhatsApp client não definido');
  }

  const router = express.Router();

  router.use((req, res, next) => {
    if (!replyApiKey) {
      logger.warn('REPLY_API_KEY não configurado - negando acesso');
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const headerKey = req.headers['x-api-key'];
    if (!headerKey || headerKey !== replyApiKey) {
      logger.warn({ headerKey }, 'Tentativa de acesso não autorizada ao endpoint /api/reply');
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    return next();
  });

  router.post('/reply', async (req, res) => {
    const { chatId, text, buttons, list, media } = req.body || {};

    if (!chatId) {
      return res.status(400).json({ ok: false, error: 'chatId é obrigatório' });
    }

    try {
      logger.info({ chatId, text: text ? text.slice(0, 60) : undefined }, 'Recebida solicitação de resposta do n8n');

      if (media && media.url) {
        await sendMediaMessage({ client, chatId, media });
      } else if (Array.isArray(buttons) && buttons.length > 0) {
        await sendButtonsMessage({ client, chatId, text, buttons });
      } else if (list && Array.isArray(list.sections)) {
        await sendListMessage({ client, chatId, list, text });
      } else if (text) {
        await client.sendMessage(chatId, text);
      } else {
        return res.status(400).json({ ok: false, error: 'Nenhum conteúdo para enviar' });
      }

      return res.json({ ok: true });
    } catch (err) {
      logger.error({ err: err.message, chatId }, 'Erro ao enviar mensagem ao WhatsApp');
      return res.status(500).json({ ok: false, error: 'Falha ao enviar mensagem' });
    }
  });

  return router;
}

async function sendMediaMessage({ client, chatId, media }) {
  const response = await axios.get(media.url, {
    responseType: 'arraybuffer',
    maxContentLength: MAX_MEDIA_SIZE,
    maxBodyLength: MAX_MEDIA_SIZE,
    timeout: 20000
  });

  const mimeType = response.headers['content-type'] || 'application/octet-stream';
  const buffer = Buffer.from(response.data);
  const base64 = buffer.toString('base64');
  const filename = media.filename || `media-${Date.now()}`;
  const messageMedia = new MessageMedia(mimeType, base64, filename);

  await client.sendMessage(chatId, messageMedia, {
    caption: media.caption
  });
  logger.info({ chatId, mimeType, url: media.url }, 'Mídia enviada para o usuário via WhatsApp');
}

async function sendButtonsMessage({ client, chatId, text, buttons }) {
  const formattedButtons = buttons.map((button) => ({ id: button.id, body: button.text }));
  const message = new Buttons(text || 'Selecione uma opção:', formattedButtons, '', '');
  await client.sendMessage(chatId, message);
  logger.info({ chatId, buttons: formattedButtons }, 'Mensagem com botões enviada');
}

async function sendListMessage({ client, chatId, list, text }) {
  const message = new List(
    text || list.body || 'Selecione uma opção',
    list.buttonText || 'Abrir menu',
    list.sections,
    list.title || '',
    list.footer || ''
  );
  await client.sendMessage(chatId, message);
  logger.info({ chatId }, 'Mensagem em lista enviada');
}

module.exports = createInboundRouter;
