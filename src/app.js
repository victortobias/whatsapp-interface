require('dotenv').config();

const express = require('express');
const path = require('path');
const logger = require('./logger');
const mediaStore = require('./services/mediaStore');
const createN8NClient = require('./services/n8nClient');
const createWhatsappClient = require('./whatsapp');
const healthRouter = require('./routes/health');
const createInboundRouter = require('./routes/inbound');

const app = express();

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

const port = process.env.PORT || 3000;
const mediaDir = path.resolve(process.cwd(), process.env.MEDIA_DIR || './media');

mediaStore.initialize({ mediaDir, publicBaseUrl: process.env.PUBLIC_BASE_URL });
mediaStore.scheduleCleanup();

const n8nClient = createN8NClient({ webhookUrl: process.env.N8N_WEBHOOK_URL });
const whatsappClient = createWhatsappClient({
  mediaStore,
  n8nClient,
  sessionDir: process.env.WHATSAPP_SESSION_DIR
});

app.use(
  '/media',
  express.static(mediaDir, {
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString());
    }
  })
);

app.use('/health', healthRouter);
app.use('/api', createInboundRouter({ client: whatsappClient, replyApiKey: process.env.REPLY_API_KEY }));

app.use((err, req, res, next) => {
  logger.error({ err: err.message, stack: err.stack }, 'Erro não tratado na aplicação Express');
  res.status(500).json({ ok: false, error: 'Erro interno' });
});

app.listen(port, () => {
  logger.info({ port }, 'Servidor Express iniciado');
  whatsappClient.initialize();
});

module.exports = app;
