import { Markup } from 'telegraf';
import { config } from '../config.js';

export function openAppKeyboard() {
  if (!config.webAppUrl) return undefined;
  return Markup.inlineKeyboard([
    Markup.button.webApp('Открыть «Свет Веры»', config.webAppUrl),
  ]);
}

export function prayerKeyboard() {
  if (!config.webAppUrl) return undefined;
  return Markup.inlineKeyboard([
    Markup.button.callback('Дуа перед молитвой', 'dua_before_prayer'),
    Markup.button.webApp('Открыть приложение', config.webAppUrl),
  ]);
}
