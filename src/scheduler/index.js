import cron from 'node-cron';
import { localDate, localTime } from '../lib/dates.js';
import { listUsersWithNotifications, recordPrayerNotification, wasPrayerNotificationSent } from '../lib/repo.js';
import { loadTimings } from '../server/routes/prayers.js';
import { prayerKeyboard } from '../bot/keyboards.js';

const prayers = [
  ['Фаджр', 'fajr_time'], ['Зухр', 'zuhr_time'], ['Аср', 'asr_time'], ['Магриб', 'maghrib_time'], ['Иша', 'isha_time'],
];

export function startScheduler(bot) {
  if (!bot) return null;
  return cron.schedule('* * * * *', async () => {
    for (const user of listUsersWithNotifications()) {
      try {
        const date = localDate(user.timezone);
        const timings = await loadTimings(user, date);
        const now = localTime(user.timezone);
        for (const [name, field] of prayers) {
          if (timings[field] !== now || wasPrayerNotificationSent(user.telegram_id, date, name)) continue;
          await bot.telegram.sendMessage(
            user.telegram_id,
            `🕌 Наступило время намаза ${name}\n\nВремя: ${now}\nДуа перед молитвой готово ➜`,
            prayerKeyboard(),
          );
          recordPrayerNotification(user.telegram_id, date, name);
        }
      } catch (error) {
        console.error(`Не удалось проверить напоминания для ${user.telegram_id}:`, error.message);
      }
    }
  });
}
