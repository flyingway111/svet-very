import { db } from '../db/index.js';

const defaultUser = {
  city: 'Moscow', country: 'Russia', language: 'ru', theme: 'dark',
  timezone: 'Europe/Moscow', notifications_enabled: 0,
};

export function upsertUser(telegramUser) {
  const user = { ...defaultUser, ...telegramUser };
  db.prepare(`
    INSERT INTO users (telegram_id, first_name, last_name, username)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      first_name = excluded.first_name, last_name = excluded.last_name,
      username = excluded.username, updated_at = CURRENT_TIMESTAMP
  `).run(user.id ?? user.telegram_id, user.first_name || '', user.last_name || '', user.username || '');
  return getUser(user.id ?? user.telegram_id);
}

export function ensureUser(telegramId) {
  const existing = getUser(telegramId);
  return existing || (upsertUser({ id: telegramId }));
}

export function getUser(telegramId) {
  return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
}

export function updateUserSettings(telegramId, settings) {
  const allowed = ['city', 'country', 'language', 'theme', 'timezone', 'notifications_enabled'];
  const entries = Object.entries(settings).filter(([key]) => allowed.includes(key));
  if (!entries.length) return getUser(telegramId);
  const setClause = entries.map(([key]) => `${key} = ?`).join(', ');
  db.prepare(`UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?`)
    .run(...entries.map(([, value]) => value), telegramId);
  if (entries.some(([key]) => ['city', 'country', 'timezone'].includes(key))) {
    db.prepare('DELETE FROM prayer_times WHERE user_id = ?').run(telegramId);
  }
  return getUser(telegramId);
}

export function getPrayerTimes(telegramId, date) {
  return db.prepare('SELECT * FROM prayer_times WHERE user_id = ? AND date = ?').get(telegramId, date);
}

export function savePrayerTimes(telegramId, date, timings) {
  db.prepare(`
    INSERT INTO prayer_times (user_id, date, fajr_time, sunrise_time, zuhr_time, asr_time, maghrib_time, isha_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET
      fajr_time = excluded.fajr_time, sunrise_time = excluded.sunrise_time, zuhr_time = excluded.zuhr_time,
      asr_time = excluded.asr_time, maghrib_time = excluded.maghrib_time, isha_time = excluded.isha_time,
      fetched_at = CURRENT_TIMESTAMP
  `).run(telegramId, date, timings.Fajr, timings.Sunrise || '', timings.Dhuhr, timings.Asr, timings.Maghrib, timings.Isha);
  return getPrayerTimes(telegramId, date);
}

export function listUsersWithNotifications() {
  return db.prepare('SELECT * FROM users WHERE notifications_enabled = 1').all();
}

export function wasPrayerNotificationSent(telegramId, date, prayer) {
  return db.prepare('SELECT 1 FROM prayer_notifications WHERE user_id = ? AND prayer_date = ? AND prayer_name = ?')
    .get(telegramId, date, prayer);
}

export function recordPrayerNotification(telegramId, date, prayer) {
  db.prepare('INSERT OR IGNORE INTO prayer_notifications (user_id, prayer_date, prayer_name) VALUES (?, ?, ?)')
    .run(telegramId, date, prayer);
}

export function listFavourites(telegramId) {
  return db.prepare('SELECT sura_id, ayat_id, created_at FROM favourite_quran WHERE user_id = ? ORDER BY created_at DESC').all(telegramId);
}

export function toggleFavourite(telegramId, suraId, ayatId = null) {
  const found = db.prepare('SELECT id FROM favourite_quran WHERE user_id = ? AND sura_id = ? AND ayat_id IS ?')
    .get(telegramId, suraId, ayatId);
  if (found) {
    db.prepare('DELETE FROM favourite_quran WHERE id = ?').run(found.id);
    return false;
  }
  db.prepare('INSERT INTO favourite_quran (user_id, sura_id, ayat_id) VALUES (?, ?, ?)').run(telegramId, suraId, ayatId);
  return true;
}

export function listUserDua(telegramId) {
  return db.prepare('SELECT * FROM user_dua WHERE user_id = ? ORDER BY created_at DESC').all(telegramId);
}

export function addUserDua(telegramId, { title, text_ar = '', text_ru }) {
  const result = db.prepare('INSERT INTO user_dua (user_id, title, text_ar, text_ru) VALUES (?, ?, ?, ?)')
    .run(telegramId, title, text_ar, text_ru);
  return db.prepare('SELECT * FROM user_dua WHERE id = ?').get(result.lastInsertRowid);
}
