import { Router } from 'express';
import { config } from '../../config.js';
import { dua, hajj, knowledge, surahs } from '../../data/content.js';

export const contentRouter = Router();

contentRouter.get('/quran/surahs', (_req, res) => res.json({ surahs }));
contentRouter.get('/quran/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1 || id > 114) return res.status(400).json({ error: 'Некорректный номер суры.' });
  try {
    const response = await fetch(`https://api.alquran.cloud/v1/surah/${id}/editions/quran-uthmani,ru.kuliev`);
    if (!response.ok) throw new Error('Источник Корана временно недоступен.');
    const payload = await response.json();
    const [arabic, russian] = payload.data || [];
    if (!arabic?.ayahs || !russian?.ayahs) throw new Error('Некорректный ответ источника Корана.');
    return res.json({ name: arabic.name, nameRu: surahs[id - 1].name_ru, ayahs: arabic.ayahs.map((ayah, index) => ({ number: ayah.numberInSurah, textAr: ayah.text, textRu: russian.ayahs[index]?.text || '' })) });
  } catch (error) { return next(error); }
});
contentRouter.get('/dua', (_req, res) => res.json({ items: dua }));
contentRouter.get('/knowledge', (_req, res) => res.json({ items: knowledge }));
contentRouter.get('/hajj', (_req, res) => res.json({ items: hajj }));

contentRouter.post('/chat', async (req, res, next) => {
  const message = String(req.body?.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Введите вопрос.' });
  if (!config.polzaApiKey) return res.status(503).json({ error: 'AI-помощник будет доступен после добавления POLZA_API_KEY.' });
  try {
    const response = await fetch('https://polza.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.polzaApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.POLZA_MODEL || 'google/gemini-2.5-flash-lite', temperature: 0.4, max_tokens: 700, messages: [
        { role: 'system', content: 'Ты — исламский помощник. Отвечай на вопросы про ислам на русском языке.' },
        { role: 'user', content: message },
      ] }),
    });
    if (!response.ok) throw new Error(`Polza AI returned ${response.status}`);
    const payload = await response.json();
    return res.json({ answer: payload.choices?.[0]?.message?.content || 'Не удалось получить ответ.' });
  } catch (error) { return next(error); }
});
