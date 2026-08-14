PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  telegram_id INTEGER PRIMARY KEY,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT 'Moscow',
  country TEXT NOT NULL DEFAULT 'Russia',
  language TEXT NOT NULL DEFAULT 'ru',
  theme TEXT NOT NULL DEFAULT 'dark',
  timezone TEXT NOT NULL DEFAULT 'Europe/Moscow',
  notifications_enabled INTEGER NOT NULL DEFAULT 0 CHECK (notifications_enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS favourite_quran (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  sura_id INTEGER NOT NULL CHECK (sura_id BETWEEN 1 AND 114),
  ayat_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, sura_id, ayat_id)
);

CREATE TABLE IF NOT EXISTS user_dua (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  text_ar TEXT NOT NULL DEFAULT '',
  text_ru TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prayer_times (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  fajr_time TEXT NOT NULL,
  sunrise_time TEXT NOT NULL DEFAULT '',
  zuhr_time TEXT NOT NULL,
  asr_time TEXT NOT NULL,
  maghrib_time TEXT NOT NULL,
  isha_time TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS prayer_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  prayer_date TEXT NOT NULL,
  prayer_name TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, prayer_date, prayer_name)
);
