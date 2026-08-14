import { config } from '../config.js';
import { upsertUser } from '../lib/repo.js';
import { validateInitData } from '../lib/telegram.js';

export function telegramAuth(req, res, next) {
  const initData = req.get('x-telegram-init-data') || req.body?.initData || '';
  let telegramUser = validateInitData(initData);

  if (!telegramUser && config.nodeEnv !== 'production') {
    telegramUser = { id: Number(process.env.DEV_TELEGRAM_ID || 100000001), first_name: 'Тестовый пользователь' };
  }
  if (!telegramUser) {
    return res.status(401).json({ error: 'Не удалось подтвердить данные Telegram.' });
  }

  req.telegramUser = upsertUser(telegramUser);
  return next();
}
