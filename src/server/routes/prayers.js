import { Router } from 'express';
import { getPrayerTimes, getUser, savePrayerTimes } from '../../lib/repo.js';
import { localDate, normalizePrayerTime } from '../../lib/dates.js';

export const prayersRouter = Router();

const STANDARD_METHOD = '3';

async function loadTimings(user, date) {
  const cached = getPrayerTimes(user.telegram_id, date);
  if (cached) return cached;

  const params = new URLSearchParams({
    city: user.city,
    country: user.country,
    method: STANDARD_METHOD,
  });
  const response = await fetch(`https://api.aladhan.com/v1/timingsByCity/${date}?${params}`);
  if (!response.ok) throw new Error(`Aladhan returned ${response.status}`);
  const payload = await response.json();
  if (payload.code !== 200 || !payload.data?.timings) throw new Error('Aladhan returned an invalid payload');
  const timings = Object.fromEntries(Object.entries(payload.data.timings).map(([key, value]) => [key, normalizePrayerTime(value)]));
  return savePrayerTimes(user.telegram_id, date, timings);
}

prayersRouter.get('/today', async (req, res, next) => {
  const user = getUser(req.telegramUser.telegram_id);
  const date = req.query.date || localDate(user.timezone);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Некорректная дата.' });
  try {
    const timings = await loadTimings(user, date);
    return res.json({ date, city: user.city, timezone: user.timezone, calculationMethod: STANDARD_METHOD, source: 'AlAdhan', timings });
  } catch (error) {
    const cached = getPrayerTimes(user.telegram_id, date);
    if (cached) return res.json({ date, city: user.city, timezone: user.timezone, calculationMethod: STANDARD_METHOD, source: 'AlAdhan', timings: cached, cached: true });
    return next(error);
  }
});

export { loadTimings };
