import { api } from './api.js';
import { haptic, initTelegram } from './telegram.js';
import { directionName, qiblaBearing } from './qibla.js';

const root = document.querySelector('#app');
const tabs = [
  ['home', '⌂', 'Главная'], ['chat', '✦', 'AI'], ['quran', '☪', 'Коран'], ['dua', '🤲', 'Дуа'], ['calendar', '◫', 'Календарь'], ['hajj', '◌', 'Хадж'], ['qibla', '⌁', 'Кыбла'], ['knowledge', '✧', 'Знания'], ['settings', '⚙', 'Настройки'],
];
const state = { active: 'home', user: null, prayers: null, surahs: [], favourites: [] };
const escape = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const card = (content, extra = '') => `<section class="glass surface card ${extra}">${content}</section>`;

function shell(content) {
  root.innerHTML = `<header class="glass surface topbar"><div><h1 class="brand">Свет Веры</h1><div class="subtitle">Исламские знания рядом</div></div><span class="tag">${escape(state.user?.city || 'Москва')}</span></header><main id="view" class="view">${content}</main><nav class="nav">${tabs.map(([id, icon, title]) => `<button class="glass surface nav-item ${state.active === id ? 'active' : ''}" data-tab="${id}" aria-label="${title}"><b>${icon}</b><br>${title}</button>`).join('')}</nav>`;
  document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => { state.active = button.dataset.tab; haptic(); render(); }));
}

function timeEntries(timings) {
  return [['Фаджр', timings.fajr_time], ['Зухр', timings.zuhr_time], ['Аср', timings.asr_time], ['Магриб', timings.maghrib_time], ['Иша', timings.isha_time]];
}

async function home() {
  shell(card('<p class="muted">Загружаем время намазов…</p>'));
  try {
    const data = await api('/prayers/today'); state.prayers = data;
    const entries = timeEntries(data.timings); const now = new Date().toLocaleTimeString('en-GB', { timeZone: data.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const next = entries.find(([, time]) => time > now) || entries[0];
    shell(`${card(`<div class="muted">${escape(data.city)} · ${escape(data.date)}</div><div class="prayer-time">${next[1]}</div><div class="prayer-name">Следующий намаз: ${next[0]}</div><div class="divider"></div><div class="schedule">${entries.map(([name, time]) => `<div><span>${name}</span><b>${time}</b></div>`).join('')}</div>`)}${card(`<div class="row"><b>Исламский календарь</b><span class="tag">${islamicDate()}</span></div>`)}${card(`<div class="stack"><button class="glass surface action" data-tab="chat">✦ Мой вопрос AI</button><button class="glass surface action gold" data-tab="qibla">⌁ Мой компас на кыблу</button></div>`)} `);
  } catch (error) { shell(card(`<h2>Главная</h2><p class="error">${escape(error.message)}</p>`)); }
  document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => { state.active = button.dataset.tab; render(); }));
}

function chat() {
  shell(`${card(`<h2>AI-помощник</h2><p class="muted">Каждый вопрос — новая сессия. История не сохраняется.</p><div id="messages" class="chat">${bubble('Ассаляму алейкум! Задайте вопрос об исламе.', 'ai')}</div><form id="chat-form" class="stack"><textarea class="glass surface textarea" name="message" maxlength="3000" required placeholder="Напишите ваш вопрос…"></textarea><button class="glass surface action gold">Отправить</button></form>`)} `);
  document.querySelector('#chat-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const input = event.currentTarget.message; const message = input.value.trim(); if (!message) return;
    addBubble(message, 'user'); input.value = ''; addBubble('Думаю…', 'ai', 'pending');
    try { const data = await api('/chat', { method: 'POST', body: JSON.stringify({ message }) }); document.querySelector('#pending')?.remove(); addBubble(data.answer, 'ai'); }
    catch (error) { document.querySelector('#pending')?.remove(); addBubble(error.message, 'ai'); }
  });
}
function bubble(text, role, id = '') { return `<div ${id ? `id="${id}"` : ''} class="glass surface bubble ${role}">${escape(text)}</div>`; }
function addBubble(text, role, id) { const messages = document.querySelector('#messages'); messages.insertAdjacentHTML('beforeend', bubble(text, role, id)); messages.scrollTop = messages.scrollHeight; }

async function quran() {
  shell(card('<h2>Коран</h2><input id="sura-search" class="glass surface input" placeholder="Найти суру"><div id="sura-list" class="stack" style="margin-top:12px">Загружаем…</div>'));
  try { const data = await api('/quran/surahs'); state.surahs = data.surahs; state.favourites = (await api('/favourites')).favourites; drawSurahs(); }
  catch (error) { document.querySelector('#sura-list').textContent = error.message; }
  document.querySelector('#sura-search').addEventListener('input', drawSurahs);
}
function drawSurahs() {
  const term = document.querySelector('#sura-search').value.toLowerCase();
  document.querySelector('#sura-list').innerHTML = state.surahs.filter((sura) => sura.name_ru.toLowerCase().includes(term)).map((sura) => `<button class="glass surface list-item" data-sura="${sura.id}"><b>${sura.id}. ${escape(sura.name_ru)}</b><span class="tag">${state.favourites.some((favourite) => favourite.sura_id === sura.id) ? ' ★' : ''}</span></button>`).join('');
  document.querySelectorAll('[data-sura]').forEach((button) => button.addEventListener('click', () => showSura(Number(button.dataset.sura))));
}
async function showSura(id) {
  shell(card('<p>Загружаем аяты…</p>'));
  try { const data = await api(`/quran/${id}`); shell(`${card(`<button class="glass surface action" id="back-quran">← Все суры</button><h2>${escape(data.nameRu)} <span class="arabic">${escape(data.name)}</span></h2><button class="glass surface action gold" id="favourite-sura">☆ Добавить в избранное</button>`)}${data.ayahs.map((ayah) => card(`<div class="row"><b>Аят ${ayah.number}</b><button class="glass surface action" data-ayat="${ayah.number}">☆</button></div><p class="arabic">${escape(ayah.textAr)}</p><p>${escape(ayah.textRu)}</p>`)).join('')}`); document.querySelector('#back-quran').onclick = quran; document.querySelector('#favourite-sura').onclick = () => favourite(id); document.querySelectorAll('[data-ayat]').forEach((button) => button.onclick = () => favourite(id, Number(button.dataset.ayat))); }
  catch (error) { shell(card(`<p class="error">${escape(error.message)}</p><button class="glass surface action" id="back-quran">← Назад</button>`)); document.querySelector('#back-quran').onclick = quran; }
}
async function favourite(suraId, ayatId = null) { await api('/favourites', { method: 'POST', body: JSON.stringify({ suraId, ayatId }) }); alert('Избранное обновлено.'); }

async function dua() {
  shell(card('<h2>Дуа</h2><div id="dua-list" class="stack">Загружаем…</div>') + card(`<h3>Моё дуа</h3><form id="dua-form" class="stack"><input class="glass surface input" name="title" required placeholder="Название"><textarea class="glass surface textarea" name="text_ar" placeholder="Арабский текст (необязательно)"></textarea><textarea class="glass surface textarea" name="text_ru" required placeholder="Русский текст"></textarea><button class="glass surface action gold">Добавить в мои дуа</button></form><div id="my-dua" class="stack"></div>`));
  try { const [common, mine] = await Promise.all([api('/dua'), api('/my-dua')]); document.querySelector('#dua-list').innerHTML = common.items.map((item) => card(`<span class="tag">${escape(item.category)}</span><h3>${escape(item.title)}</h3><p class="arabic">${escape(item.text_ar)}</p><p>${escape(item.text_ru)}</p>`)).join(''); drawMyDua(mine.items); } catch (error) { document.querySelector('#dua-list').textContent = error.message; }
  document.querySelector('#dua-form').onsubmit = async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await api('/my-dua', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) }); event.currentTarget.reset(); drawMyDua((await api('/my-dua')).items); } catch (error) { alert(error.message); } };
}
function drawMyDua(items) { document.querySelector('#my-dua').innerHTML = items.map((item) => card(`<b>${escape(item.title)}</b><p class="arabic">${escape(item.text_ar)}</p><p>${escape(item.text_ru)}</p>`)).join('') || '<p class="muted">Пока нет сохранённых дуа.</p>'; }

function islamicParts(date = new Date()) { return new Intl.DateTimeFormat('en-u-ca-islamic', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(date).reduce((acc, item) => ({ ...acc, [item.type]: item.value }), {}); }
function islamicDate() { return new Intl.DateTimeFormat('ru-RU-u-ca-islamic', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()); }
function daysUntil(month, day) { const cursor = new Date(); for (let index = 0; index < 390; index += 1) { const parts = islamicParts(cursor); if (Number(parts.month) === month && Number(parts.day) === day) return index; cursor.setDate(cursor.getDate() + 1); } return null; }
function calendar() { const parts = islamicParts(); const ramadan = Number(parts.month) === 9 ? `Рамадан: ${parts.day}-й день` : `До Рамадана: ${daysUntil(9, 1)} дн.`; shell(`${card(`<h2>Исламский календарь</h2><p>${new Date().toLocaleDateString('ru-RU', { dateStyle: 'full' })}</p><div class="prayer-name">${islamicDate()}</div>`)}${card(`<div class="stack"><div class="row"><span>${ramadan}</span></div><div class="row"><span>До хаджа: ${daysUntil(12, 8)} дн.</span></div><p class="muted">Важные даты: Ид аль-Фитр, Ид аль-Адха и Мавлид зависят от лунного календаря.</p></div>`)} `); }

async function hajj() { shell(card('<h2>Хадж</h2><div id="hajj-list" class="stack">Загружаем…</div>')); try { const data = await api('/hajj'); document.querySelector('#hajj-list').innerHTML = data.items.map((item, index) => card(`<span class="tag">Этап ${index + 1}</span><h3>${escape(item.title)}</h3><p>${escape(item.text)}</p>`)).join('') + card('<h3>Важные места</h3><p>Кааба, гора Арафат, Муздалифа, Мина, Сафа и Марва.</p>') + card('<h3>Паломнику</h3><p>Изучите порядок обрядов заранее и уточняйте вопросы у надёжного знающего человека или официального организатора хаджа.</p>'); } catch (error) { document.querySelector('#hajj-list').textContent = error.message; } }

function qibla() { shell(card(`<h2>Компас на кыблу</h2><p class="muted">Разрешите доступ к геолокации. Расчёт выполняется на устройстве.</p><div class="glass surface compass"><div id="needle" class="needle">↑</div></div><p id="qibla-result" class="row"><span>Определяем локацию…</span></p><button id="refresh-qibla" class="glass surface action gold">Обновить локацию</button>`)); document.querySelector('#refresh-qibla').onclick = locateQibla; locateQibla(); }
function locateQibla() { const result = document.querySelector('#qibla-result'); if (!navigator.geolocation) { result.textContent = 'Геолокация не поддерживается браузером.'; return; } navigator.geolocation.getCurrentPosition((position) => { const bearing = qiblaBearing(position.coords.latitude, position.coords.longitude); document.querySelector('#needle').style.transform = `rotate(${bearing}deg)`; result.innerHTML = `<span>Направление: ${directionName(bearing)}</span><b>${Math.round(bearing)}°</b>`; }, () => { result.textContent = 'Не удалось получить локацию. Проверьте разрешение браузера.'; }, { enableHighAccuracy: true, timeout: 10_000 }); }

async function knowledge() { shell(card('<h2>Исламские знания</h2><div id="knowledge-list" class="stack">Загружаем…</div>')); try { const data = await api('/knowledge'); document.querySelector('#knowledge-list').innerHTML = data.items.map((item) => card(`<span class="tag">${escape(item.category)}</span><h3>${escape(item.title)}</h3><p>${escape(item.text)}</p>`)).join(''); } catch (error) { document.querySelector('#knowledge-list').textContent = error.message; } }

function settings() { const user = state.user || {}; shell(card(`<h2>Настройки</h2><form id="settings-form" class="stack"><label>Город<input class="glass surface input" name="city" value="${escape(user.city || '')}" required></label><label>Страна<input class="glass surface input" name="country" value="${escape(user.country || '')}" required></label><label>Школа<select class="glass surface select" name="school">${[['hanafi','Ханафи'],['maliki','Малики'],['shafii','Шафии'],['hanbali','Ханбали']].map(([value,label]) => `<option value="${value}" ${user.school === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>Язык<select class="glass surface select" name="language"><option value="ru">Русский</option><option value="en">English</option></select></label><label>Тема<select class="glass surface select" name="theme"><option value="dark">Тёмная</option><option value="light">Светлая</option></select></label><label>Часовой пояс<input class="glass surface input" name="timezone" value="${escape(user.timezone || 'Europe/Moscow')}" required></label><label class="row">Напоминания о намазах<input class="glass surface" type="checkbox" name="notifications_enabled" ${user.notifications_enabled ? 'checked' : ''}></label><button class="glass surface action gold">Сохранить</button></form>`)); document.querySelector('#settings-form').onsubmit = async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); values.notifications_enabled = event.currentTarget.notifications_enabled.checked ? 1 : 0; try { state.user = (await api('/settings', { method: 'PATCH', body: JSON.stringify(values) })).user; alert('Настройки сохранены.'); } catch (error) { alert(error.message); } }; }

function render() { ({ home, chat, quran, dua, calendar, hajj, qibla, knowledge, settings }[state.active])(); }
async function init() { initTelegram(); try { state.user = (await api('/me')).user; } catch { state.user = { city: 'Москва' }; } render(); }
init();
