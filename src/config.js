import 'dotenv/config';

const requiredInProduction = ['BOT_TOKEN', 'WEBAPP_URL'];

export const config = {
  botToken: process.env.BOT_TOKEN || '',
  polzaApiKey: process.env.POLZA_API_KEY || '',
  webAppUrl: process.env.WEBAPP_URL || '',
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  databasePath: process.env.DATABASE_PATH || 'data/islam.db',
};

export function validateConfig() {
  if (config.nodeEnv !== 'production') return;

  const missing = requiredInProduction.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
