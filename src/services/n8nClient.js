const axios = require('axios');
const logger = require('../logger');

const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;

function createN8NClient({ webhookUrl, maxAttempts = DEFAULT_MAX_ATTEMPTS } = {}) {
  const resolvedWebhook = webhookUrl || process.env.N8N_WEBHOOK_URL;
  if (!resolvedWebhook) {
    throw new Error('N8N_WEBHOOK_URL não configurado');
  }

  async function sendEvent(payload) {
    if (!payload) {
      throw new Error('Payload inválido para envio ao n8n');
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await axios.post(resolvedWebhook, payload, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });
        logger.info({ attempt, payloadType: payload.type, chatId: payload.chatId, messageId: payload.messageId }, 'Evento enviado ao n8n');
        return true;
      } catch (err) {
        const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
        logger.error({ err: err.message, attempt, delay, chatId: payload.chatId, messageId: payload.messageId }, 'Falha ao enviar evento ao n8n');
        if (attempt === maxAttempts) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    return false;
  }

  return {
    sendEvent
  };
}

module.exports = createN8NClient;
