import { validateConfig } from './config.js';
import './db/index.js';
import { startBot, stopBot } from './bot/index.js';
import { startScheduler } from './scheduler/index.js';
import { startServer } from './server/index.js';

validateConfig();
const server = startServer();
const bot = await startBot();
const scheduler = startScheduler(bot);

function shutdown() {
  if (scheduler) scheduler.stop();
  stopBot(bot);
  server.close(() => process.exit(0));
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
