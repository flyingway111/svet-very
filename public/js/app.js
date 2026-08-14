import { api } from './api.js';
import { haptic, initTelegram } from './telegram.js';

const root = document.querySelector('#app');
const tabs = [
  ['home', 'Сегодня'], ['chat', 'Помощник'], ['quran', 'Коран'], ['dua', 'Дуа'], ['knowledge', 'Знания'], ['settings', 'Настройки'],
];
const state = { active: 'home', user: null, prayers: null, surahs: [], favourites: [] };
const escape = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const card = (content, extra = '') => `<section class="glass surface card ${extra}">${content}</section>`;
let revealObserver;

function reveal(scope = document) {
  const items = [...scope.querySelectorAll('.card:not(.reveal)')];
  if (!items.length) return;
  if (!('IntersectionObserver' in window)) { items.forEach((item) => item.classList.add('reveal', 'is-visible')); return; }
  revealObserver ||= new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); }
  }), { threshold: 0.08 });
  items.forEach((item) => { item.classList.add('reveal'); revealObserver.observe(item); });
}

function bindTabs() {
  document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => {
    state.active = button.dataset.tab; haptic(); render();
  }));
}

function shell(content) {
  root.innerHTML = `<header class="glass surface topbar"><div><h1 class="brand">Свет Веры</h1><div class="subtitle">Исламские знания рядом</div></div><span class="city-mark">${escape(state.user?.city || 'Москва')}</span></header><main id="view" class="view">${content}</main><nav class="glass surface nav" aria-label="Основная навигация">${tabs.map(([id, title]) => `<button class="glass nav-item ${state.active === id ? 'active' : ''}" data-tab="${id}" aria-label="${title}">${title}</button>`).join('')}</nav>`;
  bindTabs();
  reveal(root);
}

function timeEntries(timings) {
  return [['Фаджр', timings.fajr_time], ['Зухр', timings.zuhr_time], ['Аср', timings.asr_time], ['Магриб', timings.maghrib_time], ['Иша', timings.isha_time]];
}

async function home() {
  shell(card('<p class="muted">Загружаем актуальное расписание намазов…</p>', 'prayer-hero'));
  try {
    const data = await api('/prayers/today'); state.prayers = data;
    const entries = timeEntries(data.timings);
    const now = new Date().toLocaleTimeString('en-GB', { timeZone: data.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const next = entries.find(([, time]) => time > now) || entries[0];
    shell(`${card(`<div class="eyebrow">${escape(data.city)} · ${escape(data.date)}</div><div class="prayer-time">${next[1]}</div><div class="prayer-name">Следующий намаз: ${next[0]}</div><div class="divider"></div><div class="schedule">${entries.map(([name, time]) => `<div><span>${name}</span><b>${time}</b></div>`).join('')}</div><div class="source-line"><span>Источник: ${escape(data.source)}</span><span>Единый стандарт MWL</span></div>`, 'prayer-hero')}${card(`<h3>О расписании</h3><p class="muted">Расчёт использует единый стандарт MWL и стандартное время Асра. Меняются только город и часовой пояс.</p><button class="glass surface action" data-tab="settings">Изменить город и часовой пояс</button>`)}${card(`<button class="glass surface action gold" data-tab="chat">Задать вопрос помощнику</button>`)} `);
  } catch (error) {
    shell(card(`<h2>Не удалось получить время намаза</h2><p class="error">${escape(error.message)}</p><button class="glass surface action" id="retry-home">Повторить</button>`));
    document.querySelector('#retry-home').onclick = home;
  }
  bindTabs();
}

function chat() {
  shell(card(`<h2>AI-помощник</h2><p class="muted">Каждый вопрос — новая сессия. История не сохраняется.</p><div id="messages" class="chat">${bubble('Ассаляму алейкум! Задайте вопрос об исламе.', 'ai')}</div><form id="chat-form" class="stack"><textarea class="glass surface textarea" name="message" maxlength="3000" required placeholder="Напишите ваш вопрос…"></textarea><button class="glass surface action gold">Отправить</button></form>`));
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
  shell(card('<h2>Коран</h2><p class="muted">Поиск по названиям 114 сур</p><input id="sura-search" class="glass surface input" placeholder="Найти суру"><div id="sura-list" class="stack">Загружаем…</div>'));
  try { const data = await api('/quran/surahs'); state.surahs = data.surahs; state.favourites = (await api('/favourites')).favourites; drawSurahs(); }
  catch (error) { document.querySelector('#sura-list').textContent = error.message; }
  document.querySelector('#sura-search').addEventListener('input', drawSurahs);
}
function drawSurahs() {
  const term = document.querySelector('#sura-search').value.toLowerCase();
  document.querySelector('#sura-list').innerHTML = state.surahs.filter((sura) => sura.name_ru.toLowerCase().includes(term)).map((sura) => `<button class="glass surface list-item" data-sura="${sura.id}"><b>${sura.id}. ${escape(sura.name_ru)}</b><span class="tag">${state.favourites.some((favourite) => favourite.sura_id === sura.id) ? '★' : ''}</span></button>`).join('');
  document.querySelectorAll('[data-sura]').forEach((button) => button.addEventListener('click', () => showSura(Number(button.dataset.sura))));
}
async function showSura(id) {
  shell(card('<p class="muted">Загружаем аяты…</p>'));
  try {
    const data = await api(`/quran/${id}`);
    shell(`${card(`<button class="glass surface action" id="back-quran">← Все суры</button><h2>${escape(data.nameRu)}</h2><p class="arabic">${escape(data.name)}</p><button class="glass surface action gold" id="favourite-sura">Добавить в избранное</button>`)}${data.ayahs.map((ayah) => card(`<div class="row"><b>Аят ${ayah.number}</b><button class="glass surface action" data-ayat="${ayah.number}">Сохранить</button></div><p class="arabic">${escape(ayah.textAr)}</p><p>${escape(ayah.textRu)}</p>`)).join('')}`);
    document.querySelector('#back-quran').onclick = quran; document.querySelector('#favourite-sura').onclick = () => favourite(id);
    document.querySelectorAll('[data-ayat]').forEach((button) => { button.onclick = () => favourite(id, Number(button.dataset.ayat)); });
  } catch (error) { shell(card(`<p class="error">${escape(error.message)}</p><button class="glass surface action" id="back-quran">← Назад</button>`)); document.querySelector('#back-quran').onclick = quran; }
}
async function favourite(suraId, ayatId = null) { await api('/favourites', { method: 'POST', body: JSON.stringify({ suraId, ayatId }) }); haptic(); }

async function dua() {
  shell(`${card(`<h2>Дуа</h2><p class="muted">Ищите по названию, категории или слову: например, «любовь».</p><div class="dua-toolbar"><input id="dua-search" class="glass surface input" placeholder="Поиск: любовь, сон, тревога…"><span id="dua-count" class="glass surface filter-count">0</span></div><div id="dua-categories" class="choice-options"></div><div id="dua-list" class="stack"></div>`)}${card(`<h3>Моё дуа</h3><form id="dua-form" class="stack"><input class="glass surface input" name="title" required placeholder="Название"><textarea class="glass surface textarea" name="text_ar" placeholder="Арабский текст (необязательно)"></textarea><textarea class="glass surface textarea" name="text_ru" required placeholder="Русский текст"></textarea><button class="glass surface action gold">Добавить в мои дуа</button><p id="dua-status" class="muted" aria-live="polite"></p></form><div id="my-dua" class="stack"></div>`)} `);
  try {
    const [common, mine] = await Promise.all([api('/dua'), api('/my-dua')]);
    const categories = ['Все', ...new Set(common.items.map((item) => item.category))]; let selectedCategory = 'Все';
    const draw = () => {
      const query = document.querySelector('#dua-search').value.trim().toLowerCase();
      const filtered = common.items.filter((item) => {
        const text = `${item.title} ${item.category} ${(item.tags || []).join(' ')} ${item.text_ru}`.toLowerCase();
        return (selectedCategory === 'Все' || item.category === selectedCategory) && text.includes(query);
      });
      document.querySelector('#dua-count').textContent = filtered.length;
      document.querySelector('#dua-list').innerHTML = filtered.map((item) => card(`<article class="dua-card"><span class="tag">${escape(item.category)}</span><h3>${escape(item.title)}</h3><p class="arabic">${escape(item.text_ar)}</p><p>${escape(item.text_ru)}</p><span class="source">${escape(item.source || '')}</span></article>`)).join('') || '<p class="muted">Ничего не найдено. Попробуйте другое слово.</p>';
      document.querySelector('#dua-categories').innerHTML = categories.map((category) => `<button class="glass surface choice-option ${selectedCategory === category ? 'selected' : ''}" data-category="${escape(category)}">${escape(category)}</button>`).join('');
      document.querySelectorAll('[data-category]').forEach((button) => { button.onclick = () => { selectedCategory = button.dataset.category; draw(); }; });
    };
    draw(); drawMyDua(mine.items);
    document.querySelector('#dua-search').oninput = draw;
  } catch (error) { document.querySelector('#dua-list').textContent = error.message; }
  document.querySelector('#dua-form').onsubmit = async (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const status = document.querySelector('#dua-status');
    try { await api('/my-dua', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) }); event.currentTarget.reset(); drawMyDua((await api('/my-dua')).items); status.textContent = 'Дуа сохранено.'; }
    catch (error) { status.textContent = error.message; }
  };
}
function drawMyDua(items) { document.querySelector('#my-dua').innerHTML = items.map((item) => card(`<b>${escape(item.title)}</b><p class="arabic">${escape(item.text_ar)}</p><p>${escape(item.text_ru)}</p>`)).join('') || '<p class="muted">Пока нет сохранённых дуа.</p>'; }

async function knowledge() {
  shell(card('<h2>Исламские знания</h2><p class="muted">Краткие материалы для первого знакомства с темой.</p><div id="knowledge-list" class="knowledge-grid">Загружаем…</div>'));
  try {
    const data = await api('/knowledge');
    document.querySelector('#knowledge-list').innerHTML = data.items.map((item) => card(`<article class="knowledge-card"><span class="tag">${escape(item.category)}</span><h3>${escape(item.title)}</h3><p>${escape(item.text)}</p></article>`)).join('');
  } catch (error) { document.querySelector('#knowledge-list').textContent = error.message; }
}

function choiceMenu(name, label, options, selected) {
  const active = options.find(([value]) => value === selected) || options[0];
  return `<details class="glass surface choice-menu"><summary>${label}<span class="tag" data-current="${name}">${escape(active[1])}</span></summary><div class="choice-options">${options.map(([value, text]) => `<button type="button" class="glass surface choice-option ${value === selected ? 'selected' : ''}" data-choice="${name}" data-value="${value}" data-label="${escape(text)}">${escape(text)}</button>`).join('')}</div></details><input type="hidden" name="${name}" value="${escape(selected)}">`;
}

function settings() {
  const user = state.user || {}; const language = user.language || 'ru'; const theme = user.theme || 'dark'; const timezone = user.timezone || 'Europe/Moscow';
  const languages = [['ru', 'Русский'], ['en', 'English']]; const themes = [['dark', 'Тёмная'], ['light', 'Светлая']];
  const timezones = [['Europe/Moscow', 'Москва · UTC+3'], ['Europe/Kazan', 'Казань · UTC+3'], ['Asia/Yekaterinburg', 'Екатеринбург · UTC+5'], ['Asia/Novosibirsk', 'Новосибирск · UTC+7'], ['Asia/Tashkent', 'Ташкент · UTC+5'], ['Asia/Dubai', 'Дубай · UTC+4']];
  shell(card(`<h2>Настройки</h2><form id="settings-form" class="choice-grid"><label class="setting-label">Город<input class="glass surface input" name="city" value="${escape(user.city || 'Moscow')}" required></label><label class="setting-label">Страна<input class="glass surface input" name="country" value="${escape(user.country || 'Russia')}" required></label><p class="notice">Для всех пользователей применяется единый стандарт расчёта: Мусульманская всемирная лига (MWL) и стандартное время Асра.</p>${choiceMenu('language', 'Язык', languages, language)}${choiceMenu('theme', 'Тема', themes, theme)}${choiceMenu('timezone', 'Часовой пояс', timezones, timezone)}<label class="glass surface row switch-row">Напоминания о намазах<input class="switch" type="checkbox" name="notifications_enabled" ${user.notifications_enabled ? 'checked' : ''}></label><button class="glass surface action gold">Сохранить настройки</button><p id="settings-status" class="muted" aria-live="polite"></p></form>`));
  document.querySelectorAll('[data-choice]').forEach((button) => { button.onclick = () => { const { choice, value, label } = button.dataset; const input = document.querySelector(`input[name="${choice}"]`); input.value = value; document.querySelector(`[data-current="${choice}"]`).textContent = label; document.querySelectorAll(`[data-choice="${choice}"]`).forEach((item) => item.classList.toggle('selected', item === button)); button.closest('details').open = false; }; });
  document.querySelector('#settings-form').onsubmit = async (event) => { event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form)); values.notifications_enabled = form.notifications_enabled.checked ? 1 : 0; const status = document.querySelector('#settings-status'); try { state.user = (await api('/settings', { method: 'PATCH', body: JSON.stringify(values) })).user; status.textContent = 'Настройки сохранены. Новое расписание будет рассчитано при открытии главной.'; } catch (error) { status.textContent = error.message; } };
}

function render() { ({ home, chat, quran, dua, knowledge, settings }[state.active])(); }
async function init() { initTelegram(); try { state.user = (await api('/me')).user; } catch { state.user = { city: 'Москва' }; } render(); }
init();
