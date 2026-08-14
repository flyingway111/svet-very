import express from 'express';
import { config } from '../config.js';
import { telegramAuth } from './auth.js';
import { apiRouter } from './routes/api.js';
import { prayersRouter } from './routes/prayers.js';
import { contentRouter } from './routes/content.js';

export function createServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
  app.use(express.static('public', { extensions: ['html'] }));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api', telegramAuth, apiRouter);
  app.use('/api/prayers', telegramAuth, prayersRouter);
  app.use('/api', telegramAuth, contentRouter);
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера.' });
  });
  return app;
}

export function startServer() {
  const app = createServer();
  return app.listen(config.port, () => console.log(`Сервер «Свет Веры» запущен на порту ${config.port}`));
}
