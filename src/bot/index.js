import { Telegraf } from 'telegraf';
import { config } from '../config.js';
import { localDate } from '../lib/dates.js';
import { getPrayerTimes, getUser, upsertUser, updateUserSettings } from '../lib/repo.js';
import { loadTimings } from '../server/routes/prayers.js';
import { openAppKeyboard } from './keyboards.js';

export function createBot() {
  if (!config.botToken) return null;
  const bot = new Telegraf(config.botToken);

  bot.start(async (ctx) => {
    const user = upsertUser(ctx.from);
    await ctx.reply('Ассаляму алейкум! Добро пожаловать в «Свет Веры». Здесь — время намазов, Коран, дуа и исламские знания.', openAppKeyboard());
    return user;
  });

  bot.command('time', async (ctx) => {
    const user = upsertUser(ctx.from);
    const date = localDate(user.timezone);
    try {
      const timings = await loadTimings(user, date);
      const entries = [['Фаджр', timings.fajr_time], ['Зухр', timings.zuhr_time], ['Аср', timings.asr_time], ['Магриб', timings.maghrib_time], ['Иша', timings.isha_time]];
      const current = new Date();
      const next = entries.find(([, time]) => time && time > current.toLocaleTimeString('en-GB', { timeZone: user.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })) || entries[0];
      return ctx.reply(`Следующий намаз: ${next[0]} в ${next[1]}.`, openAppKeyboard());
    } catch {
      return ctx.reply('Не удалось получить время намаза. Попробуйте ещё раз немного позже.');
    }
  });

  bot.command('help', (ctx) => ctx.reply('Команды:\n/start — открыть приложение\n/time — следующий намаз\n/settings — открыть настройки'));
  bot.command('settings', async (ctx) => {
    upsertUser(ctx.from);
    return ctx.reply('Настройки доступны в Mini App.', openAppKeyboard());
  });
  bot.action('dua_before_prayer', (ctx) => ctx.answerCbQuery('Да примет Аллах вашу молитву.').then(() => ctx.reply('Перед намазом важно совершить омовение, обратиться к Аллаху с искренним намерением и соблюдать время молитвы.')));

  return bot;
}

export async function startBot() {
  const bot = createBot();
  if (!bot) {
    console.warn('BOT_TOKEN не задан: Telegram-бот не запущен.');
    return null;
  }
  await bot.launch();
  console.log('Telegram-бот «Свет Веры» запущен.');
  return bot;
}

export function stopBot(bot) {
  if (bot) bot.stop('shutdown');
}
