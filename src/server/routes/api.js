import { Router } from 'express';
import {
  addUserDua, getUser, listFavourites, listUserDua, toggleFavourite, updateUserSettings,
} from '../../lib/repo.js';

export const apiRouter = Router();

apiRouter.get('/me', (req, res) => res.json({ user: getUser(req.telegramUser.telegram_id) }));

apiRouter.patch('/settings', (req, res) => {
  const user = updateUserSettings(req.telegramUser.telegram_id, req.body || {});
  res.json({ user });
});

apiRouter.get('/favourites', (req, res) => {
  res.json({ favourites: listFavourites(req.telegramUser.telegram_id) });
});

apiRouter.post('/favourites', (req, res) => {
  const suraId = Number(req.body?.suraId);
  const ayatId = req.body?.ayatId == null ? null : Number(req.body.ayatId);
  if (!Number.isInteger(suraId) || suraId < 1 || suraId > 114 || (ayatId !== null && (!Number.isInteger(ayatId) || ayatId < 1))) {
    return res.status(400).json({ error: 'Укажите корректный номер суры и аята.' });
  }
  const saved = toggleFavourite(req.telegramUser.telegram_id, suraId, ayatId);
  return res.json({ saved });
});

apiRouter.get('/my-dua', (req, res) => res.json({ items: listUserDua(req.telegramUser.telegram_id) }));

apiRouter.post('/my-dua', (req, res) => {
  const { title, text_ar: textAr, text_ru: textRu } = req.body || {};
  if (!String(title || '').trim() || !String(textRu || '').trim()) {
    return res.status(400).json({ error: 'Введите название и русский текст дуа.' });
  }
  const item = addUserDua(req.telegramUser.telegram_id, {
    title: String(title).trim().slice(0, 120), text_ar: String(textAr || '').trim(), text_ru: String(textRu).trim().slice(0, 3000),
  });
  return res.status(201).json({ item });
});
