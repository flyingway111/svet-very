import { api } from './api.js';
import { haptic, initTelegram } from './telegram.js';

const root = document.querySelector('#app');
const tabs = [
  ['home', 'Сегодня'],
  ['chat', 'Помощник'],
  ['quran', 'Коран'],
  ['dua', 'Дуа'],
  ['knowledge', 'Знания'],
];
const routeTab = { home: 'home', chat: 'chat', quran: 'quran', sura: 'quran', dua: 'dua', knowledge: 'knowledge' };
const cityNames = { Moscow: 'Москва', Kazan: 'Казань', Tashkent: 'Ташкент', Dubai: 'Дубай' };
const state = {
  route: 'home',
  version: 0,
  painted: false,
  user: null,
  prayers: null,
  surahs: [],
  favourites: [],
  duaItems: [],
  myDua: [],
  duaQuery: '',
  duaCategory: 'Все',
  scroll: {},
};
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let revealObserver;
let scrollFrame = 0;

const escape = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[char]));

function cityName(city) {
  return cityNames[city] || city || 'Москва';
}

function dateLabel(date) {
  const target = date ? new Date(`${date}T12:00:00`) : new Date();
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(target);
}

function pageIntro(kicker, title, copy = '') {
  return `<header class="page-intro" data-reveal>
    <p class="kicker">${escape(kicker)}</p>
    <h1>${escape(title)}</h1>
    ${copy ? `<p>${escape(copy)}</p>` : ''}
  </header>`;
}

function panel(content, className = '') {
  return `<section class="panel ${className}">${content}</section>`;
}

function buildFrame() {
  root.innerHTML = `<a class="skip-link" href="#view">К содержанию</a>
    <div class="ambient" aria-hidden="true"><span></span><span></span><span></span></div>
    <div class="app-frame">
      <header class="site-header">
        <button class="wordmark" type="button" data-route="home" aria-label="На главную">
          <span>Свет Веры</span>
          <small>исламские знания рядом</small>
        </button>
        <button class="header-control" type="button" data-route="settings" aria-label="Открыть настройки">Настроить</button>
      </header>
      <div class="context-line"><span id="header-city">Москва</span><span class="context-dot"></span><span id="header-date">сегодня</span></div>
      <main id="view" class="page-view" tabindex="-1"></main>
      <nav id="bottom-nav" class="bottom-nav" aria-label="Основные разделы">
        <span class="nav-indicator" aria-hidden="true"></span>
        ${tabs.map(([id, label]) => `<button type="button" class="nav-link" data-route="${id}" aria-label="${label}"><span>${label}</span></button>`).join('')}
      </nav>
      <p id="toast" class="toast" role="status" aria-live="polite"></p>
    </div>`;

  root.addEventListener('click', onRootClick);
  root.addEventListener('pointerdown', onPressStart, { passive: true });
  root.addEventListener('pointerup', onPressEnd, { passive: true });
  root.addEventListener('pointercancel', onPressEnd, { passive: true });
  window.addEventListener('resize', requestNavPosition, { passive: true });
  document.addEventListener('scroll', trackScroll, { passive: true });
}

function onPressStart(event) {
  const target = event.target.closest('button, .sura-item');
  if (target && !target.disabled) target.classList.add('is-pressed');
}

function onPressEnd(event) {
  event.target.closest('button, .sura-item')?.classList.remove('is-pressed');
}

function trackScroll() {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    state.scroll[state.route] = window.scrollY;
    root.classList.toggle('is-scrolled', window.scrollY > 12);
    scrollFrame = 0;
  });
}

function syncChrome() {
  document.body.dataset.theme = state.user?.theme === 'light' ? 'light' : 'dark';
  const city = cityName(state.user?.city);
  root.querySelector('#header-city').textContent = city;
  root.querySelector('#header-date').textContent = dateLabel();
  const activeTab = routeTab[state.route];
  root.querySelectorAll('.nav-link').forEach((button) => {
    const active = button.dataset.route === activeTab;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  root.querySelector('#bottom-nav').classList.toggle('has-no-active', !activeTab);
  requestNavPosition();
}

function requestNavPosition() {
  requestAnimationFrame(positionNavIndicator);
}

function positionNavIndicator() {
  const nav = root.querySelector('#bottom-nav');
  const active = nav?.querySelector('.nav-link.is-active');
  if (!nav || !active) return;
  const navRect = nav.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  nav.style.setProperty('--nav-x', `${Math.round(activeRect.left - navRect.left)}px`);
  nav.style.setProperty('--nav-width', `${Math.round(activeRect.width)}px`);
}

function reveal(scope = root) {
  const items = [...scope.querySelectorAll('[data-reveal]:not(.reveal-ready)')];
  if (!items.length) return;
  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    items.forEach((item) => item.classList.add('reveal-ready', 'is-revealed'));
    return;
  }
  revealObserver ||= new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-revealed');
    revealObserver.unobserve(entry.target);
  }), { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
  items.forEach((item, index) => {
    item.classList.add('reveal-ready');
    item.style.setProperty('--reveal-delay', `${Math.min(index, 7) * 38}ms`);
    revealObserver.observe(item);
  });
}

function timeEntries(timings) {
  return [
    ['Фаджр', timings.fajr_time],
    ['Зухр', timings.zuhr_time],
    ['Аср', timings.asr_time],
    ['Магриб', timings.maghrib_time],
    ['Иша', timings.isha_time],
  ];
}

function homePage() {
  return `<section id="prayer-stage" class="prayer-stage" aria-busy="true">
      <div class="stage-aurora" aria-hidden="true"></div>
      <div class="prayer-stage-copy">
        <h1 class="sr-only">Свет Веры</h1>
        <p class="kicker">Ритм сегодняшнего дня</p>
        <div class="skeleton skeleton-short"></div>
        <div class="skeleton skeleton-time"></div>
        <div class="skeleton skeleton-wide"></div>
      </div>
    </section>
    <section class="home-note" data-reveal>
      <p>Расписание появится здесь через мгновение.</p>
    </section>`;
}

function prayerStage(data) {
  const entries = timeEntries(data.timings);
  const now = new Date().toLocaleTimeString('en-GB', {
    timeZone: data.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const next = entries.find(([, time]) => time > now) || entries[0];
  return `<div class="stage-aurora" aria-hidden="true"></div>
    <div class="prayer-stage-top">
      <div><p class="kicker">${escape(cityName(data.city))} · ${escape(dateLabel(data.date))}</p><p class="stage-caption">следующая молитва</p></div>
      <button class="quiet-button" type="button" data-action="refresh-prayers">Обновить</button>
    </div>
    <div class="prayer-stage-copy">
      <h1 class="prayer-name">${escape(next[0])}</h1>
      <time class="prayer-time" datetime="${escape(next[1])}">${escape(next[1])}</time>
      <p class="stage-subtitle">Сохраняйте спокойный ритм дня.</p>
    </div>
    <div class="prayer-rail" aria-label="Время ежедневных молитв">
      ${entries.map(([name, time]) => `<div class="prayer-stop ${name === next[0] ? 'is-next' : ''}">
          <span>${escape(name)}</span><time datetime="${escape(time)}">${escape(time)}</time>
        </div>`).join('')}
    </div>
    <footer class="prayer-source"><span>AlAdhan · MWL</span><span>${escape(data.timezone)}</span></footer>`;
}

function homeAfterStage() {
  return `<section class="home-brief" data-reveal>
      <div><p class="kicker">О расписании</p><h2>Точное время начинается с места.</h2></div>
      <p>Мы считаем время по вашему городу и часовому поясу. Для особых случаев сверяйтесь с расписанием местной мечети.</p>
      <button class="text-action" type="button" data-route="settings">Изменить город и пояс</button>
    </section>
    ${panel(`<div class="assistant-invite"><p class="kicker">Есть вопрос?</p><h2>Помощник ответит без сохранения переписки.</h2><button class="button button-primary" type="button" data-route="chat">Открыть помощника</button></div>`, 'assistant-panel')}`;
}

async function mountHome(token) {
  const stage = root.querySelector('#prayer-stage');
  try {
    const data = await api('/prayers/today');
    if (!isCurrent(token, 'home')) return;
    state.prayers = data;
    root.querySelector('.home-brief')?.remove();
    root.querySelector('.assistant-panel')?.remove();
    stage.innerHTML = prayerStage(data);
    stage.removeAttribute('aria-busy');
    stage.insertAdjacentHTML('afterend', homeAfterStage());
    reveal(root.querySelector('#view'));
  } catch (error) {
    if (!isCurrent(token, 'home')) return;
    stage.removeAttribute('aria-busy');
    stage.classList.add('stage-error');
    stage.innerHTML = `<div class="prayer-stage-copy"><p class="kicker">Расписание недоступно</p><h1>Не получилось загрузить время молитв.</h1><p>${escape(error.message)}</p><button class="button button-secondary" type="button" data-action="refresh-prayers">Попробовать ещё раз</button></div>`;
  }
}

function chatPage() {
  return `${pageIntro('Личный помощник', 'О чём вы хотите спросить?', 'Каждый запрос создаёт новую сессию. Предыдущие сообщения не отправляются в AI.')}
    <section class="chat-stage" data-reveal>
      <div id="messages" class="message-stream" aria-live="polite">
        ${messageBubble('Ассаляму алейкум. Я помогу с вопросом об исламе и постараюсь ответить бережно и понятно.', 'assistant')}
      </div>
      <div class="prompt-row" aria-label="Примеры вопросов">
        <button type="button" class="prompt-chip" data-action="suggest-question" data-question="Как подготовиться к намазу?">О намазе</button>
        <button type="button" class="prompt-chip" data-action="suggest-question" data-question="Что означает сабр?">О сабре</button>
        <button type="button" class="prompt-chip" data-action="suggest-question" data-question="Какой этикет у дуа?">О дуа</button>
      </div>
      <form id="chat-form" class="composer">
        <label class="sr-only" for="chat-message">Ваш вопрос</label>
        <textarea id="chat-message" name="message" maxlength="3000" required placeholder="Напишите вопрос…"></textarea>
        <button class="button button-primary" type="submit">Отправить</button>
      </form>
    </section>`;
}

function messageBubble(text, role = 'assistant', pending = false) {
  return `<article class="message ${role} ${pending ? 'is-pending' : ''}"><p>${escape(text)}</p></article>`;
}

function appendMessage(text, role, pending = false) {
  const stream = root.querySelector('#messages');
  if (!stream) return;
  stream.insertAdjacentHTML('beforeend', messageBubble(text, role, pending));
  const message = stream.lastElementChild;
  message?.animate?.([
    { opacity: 0, transform: 'translateY(8px)' },
    { opacity: 1, transform: 'translateY(0)' },
  ], { duration: reducedMotion.matches ? 1 : 240, easing: 'cubic-bezier(.22,1,.36,1)' });
  stream.scrollTo({ top: stream.scrollHeight, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
}

function mountChat(token) {
  const form = root.querySelector('#chat-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = form.elements.message;
    const message = input.value.trim();
    if (!message || !isCurrent(token, 'chat')) return;
    const button = form.querySelector('button');
    input.value = '';
    button.disabled = true;
    button.classList.add('is-loading');
    appendMessage(message, 'user');
    appendMessage('Формулирую ответ…', 'assistant', true);
    try {
      const data = await api('/chat', { method: 'POST', body: JSON.stringify({ message }) });
      if (!isCurrent(token, 'chat')) return;
      root.querySelector('.message.is-pending')?.remove();
      appendMessage(data.answer, 'assistant');
    } catch (error) {
      if (!isCurrent(token, 'chat')) return;
      root.querySelector('.message.is-pending')?.remove();
      appendMessage(error.message, 'assistant');
    } finally {
      if (isCurrent(token, 'chat')) {
        button.disabled = false;
        button.classList.remove('is-loading');
      }
    }
  });
}

function quranPage() {
  return `${pageIntro('Чтение и смысл', 'Коран', '114 сур с арабским текстом и переводом Кулиева.')}
    <section class="library-toolbar" data-reveal>
      <label class="search-field"><span class="sr-only">Найти суру</span><input id="sura-search" type="search" placeholder="Найти суру по названию"></label>
      <span id="sura-count" class="result-count">114 сур</span>
    </section>
    <section id="sura-list" class="sura-list" aria-live="polite" aria-busy="true">
      ${Array.from({ length: 7 }, () => '<div class="sura-skeleton"></div>').join('')}
    </section>`;
}

async function mountQuran(token) {
  try {
    const [quran, favourites] = await Promise.all([api('/quran/surahs'), api('/favourites')]);
    if (!isCurrent(token, 'quran')) return;
    state.surahs = quran.surahs;
    state.favourites = favourites.favourites;
    drawSurahs();
    root.querySelector('#sura-search')?.addEventListener('input', drawSurahs);
  } catch (error) {
    if (!isCurrent(token, 'quran')) return;
    root.querySelector('#sura-list').innerHTML = `<p class="error-copy">${escape(error.message)}</p>`;
  }
}

function drawSurahs() {
  const input = root.querySelector('#sura-search');
  const list = root.querySelector('#sura-list');
  if (!input || !list) return;
  const term = input.value.trim().toLowerCase();
  const matches = state.surahs.filter((sura) => sura.name_ru.toLowerCase().includes(term));
  root.querySelector('#sura-count').textContent = `${matches.length} ${matches.length === 1 ? 'сура' : matches.length < 5 ? 'суры' : 'сур'}`;
  list.removeAttribute('aria-busy');
  list.innerHTML = matches.map((sura, index) => {
    const saved = state.favourites.some((item) => item.sura_id === sura.id && item.ayat_id == null);
    return `<button type="button" class="sura-item" data-action="open-sura" data-sura="${sura.id}" data-reveal>
      <span class="sura-number">${String(sura.id).padStart(2, '0')}</span>
      <span class="sura-title">${escape(sura.name_ru)}</span>
      <span class="sura-meta">${saved ? 'сохранено' : `сура ${index + 1}`}</span>
    </button>`;
  }).join('') || '<p class="empty-copy">По этому запросу сур не найдено.</p>';
  reveal(list);
}

function suraPage(id) {
  const known = state.surahs.find((sura) => sura.id === id);
  return `<section class="reading-header">
      <button class="back-link" type="button" data-route="quran">К списку сур</button>
      <p class="kicker">Сура ${String(id).padStart(2, '0')}</p>
      <h1>${escape(known?.name_ru || 'Коран')}</h1>
      <div id="sura-content" class="reading-loader"><span></span><span></span><span></span></div>
    </section>`;
}

async function mountSura(token, options) {
  const id = Number(options.suraId);
  try {
    const data = await api(`/quran/${id}`);
    if (!isCurrent(token, 'sura')) return;
    const fullSuraSaved = state.favourites.some((item) => item.sura_id === id && item.ayat_id == null);
    const target = root.querySelector('#sura-content');
    target.className = 'ayah-list';
    target.innerHTML = `<div class="sura-title-row"><p class="arabic-title">${escape(data.name)}</p><button class="text-action" type="button" data-action="toggle-favourite" data-sura="${id}" data-ayat="">${fullSuraSaved ? 'Сохранено' : 'В избранное'}</button></div>
      ${data.ayahs.map((ayah) => {
        const saved = state.favourites.some((item) => item.sura_id === id && item.ayat_id === ayah.number);
        return `<article class="ayah" ${ayah.number < 10 ? 'data-reveal' : ''}>
          <div class="ayah-top"><span>${ayah.number}</span><button class="ayah-save" type="button" data-action="toggle-favourite" data-sura="${id}" data-ayat="${ayah.number}">${saved ? 'Сохранено' : 'Сохранить'}</button></div>
          <p class="arabic-copy" lang="ar" dir="rtl">${escape(ayah.textAr)}</p>
          <p class="translation">${escape(ayah.textRu)}</p>
        </article>`;
      }).join('')}`;
    reveal(target);
  } catch (error) {
    if (!isCurrent(token, 'sura')) return;
    root.querySelector('#sura-content').outerHTML = `<p class="error-copy">${escape(error.message)}</p>`;
  }
}

function duaPage() {
  return `${pageIntro('Личное обращение', 'Дуа', 'Ищите по категории, теме или слову — например, «любовь», «сон» или «тревога».')}
    <section class="dua-search-zone" data-reveal>
      <label class="search-field"><span class="sr-only">Поиск дуа</span><input id="dua-search" type="search" placeholder="Найти дуа"></label>
      <div id="dua-categories" class="filter-strip" aria-label="Категории дуа"></div>
      <p id="dua-result" class="result-copy" aria-live="polite"></p>
    </section>
    <section id="dua-list" class="dua-list" aria-live="polite" aria-busy="true"><div class="sura-skeleton"></div><div class="sura-skeleton"></div></section>
    <section class="personal-dua" data-reveal>
      <div><p class="kicker">Своё дуа</p><h2>Сохраните важные для себя слова.</h2></div>
      <form id="dua-form" class="compact-form">
        <label><span>Название</span><input name="title" maxlength="120" required placeholder="Например, о семье"></label>
        <label><span>Арабский текст <em>необязательно</em></span><textarea name="text_ar" placeholder="Арабский текст"></textarea></label>
        <label><span>Русский текст</span><textarea name="text_ru" required placeholder="Текст дуа"></textarea></label>
        <button class="button button-primary" type="submit">Добавить в моё</button>
        <p id="dua-status" class="form-status" aria-live="polite"></p>
      </form>
      <div id="my-dua-list" class="my-dua-list"></div>
    </section>`;
}

async function mountDua(token) {
  try {
    const [common, mine] = await Promise.all([api('/dua'), api('/my-dua')]);
    if (!isCurrent(token, 'dua')) return;
    state.duaItems = common.items;
    state.myDua = mine.items;
    state.duaCategory = 'Все';
    state.duaQuery = '';
    drawDua();
    drawMyDua();
    root.querySelector('#dua-search')?.addEventListener('input', (event) => {
      state.duaQuery = event.target.value;
      drawDua();
    });
    root.querySelector('#dua-form')?.addEventListener('submit', (event) => submitDua(event, token));
  } catch (error) {
    if (!isCurrent(token, 'dua')) return;
    root.querySelector('#dua-list').innerHTML = `<p class="error-copy">${escape(error.message)}</p>`;
  }
}

function drawDua() {
  const list = root.querySelector('#dua-list');
  if (!list || !state.duaItems.length) return;
  const query = state.duaQuery.trim().toLowerCase();
  const categories = ['Все', ...new Set(state.duaItems.map((item) => item.category))];
  const items = state.duaItems.filter((item) => {
    const source = `${item.title} ${item.category} ${(item.tags || []).join(' ')} ${item.text_ru}`.toLowerCase();
    return (state.duaCategory === 'Все' || item.category === state.duaCategory) && source.includes(query);
  });
  root.querySelector('#dua-categories').innerHTML = categories.map((category) => `<button type="button" class="filter-chip ${state.duaCategory === category ? 'is-active' : ''}" data-action="filter-dua" data-category="${escape(category)}" aria-pressed="${state.duaCategory === category}">${escape(category)}</button>`).join('');
  root.querySelector('#dua-result').textContent = items.length ? `Найдено: ${items.length}` : 'Ничего не найдено';
  list.removeAttribute('aria-busy');
  list.innerHTML = items.map((item) => `<article class="dua-entry" data-reveal>
      <div class="dua-entry-meta"><span>${escape(item.category)}</span><span>${escape(item.source || '')}</span></div>
      <h2>${escape(item.title)}</h2>
      <p class="arabic-copy" lang="ar" dir="rtl">${escape(item.text_ar)}</p>
      <p>${escape(item.text_ru)}</p>
    </article>`).join('') || '<p class="empty-copy">Попробуйте изменить запрос или категорию.</p>';
  reveal(list);
}

function drawMyDua() {
  const target = root.querySelector('#my-dua-list');
  if (!target) return;
  target.innerHTML = state.myDua.map((item) => `<article class="my-dua-entry">
      <h3>${escape(item.title)}</h3>${item.text_ar ? `<p class="arabic-copy" lang="ar" dir="rtl">${escape(item.text_ar)}</p>` : ''}<p>${escape(item.text_ru)}</p>
    </article>`).join('') || '<p class="empty-copy">Пока здесь пусто.</p>';
}

async function submitDua(event, token) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = root.querySelector('#dua-status');
  const button = form.querySelector('button[type="submit"]');
  const values = Object.fromEntries(new FormData(form));
  button.disabled = true;
  button.classList.add('is-loading');
  try {
    const response = await api('/my-dua', { method: 'POST', body: JSON.stringify(values) });
    if (!isCurrent(token, 'dua')) return;
    state.myDua.unshift(response.item);
    form.reset();
    drawMyDua();
    status.textContent = 'Дуа сохранено.';
    showToast('Дуа добавлено');
    haptic();
  } catch (error) {
    if (isCurrent(token, 'dua')) status.textContent = error.message;
  } finally {
    if (isCurrent(token, 'dua')) {
      button.disabled = false;
      button.classList.remove('is-loading');
    }
  }
}

function knowledgePage() {
  return `${pageIntro('Спокойное изучение', 'Знания', 'Короткие тексты, которые удобно читать в своём темпе.')}
    <section class="knowledge-lead" data-reveal><p>Материалы созданы для первого знакомства с темой. По сложным вопросам лучше обращаться к надёжным учёным и преподавателям.</p></section>
    <section id="knowledge-list" class="knowledge-list" aria-busy="true"><div class="sura-skeleton"></div><div class="sura-skeleton"></div></section>`;
}

async function mountKnowledge(token) {
  try {
    const data = await api('/knowledge');
    if (!isCurrent(token, 'knowledge')) return;
    const target = root.querySelector('#knowledge-list');
    target.removeAttribute('aria-busy');
    target.innerHTML = data.items.map((item, index) => `<article class="knowledge-entry" data-reveal>
        <span class="knowledge-index">${String(index + 1).padStart(2, '0')}</span>
        <div><p class="kicker">${escape(item.category)}</p><h2>${escape(item.title)}</h2><p>${escape(item.text)}</p></div>
      </article>`).join('');
    reveal(target);
  } catch (error) {
    if (!isCurrent(token, 'knowledge')) return;
    root.querySelector('#knowledge-list').innerHTML = `<p class="error-copy">${escape(error.message)}</p>`;
  }
}

function choiceMenu(name, label, options, selected, helper = '') {
  const active = options.find(([value]) => value === selected) || options[0];
  return `<details class="setting-menu" data-setting-menu="${name}">
    <summary><span><b>${escape(label)}</b>${helper ? `<small>${escape(helper)}</small>` : ''}</span><strong data-current="${name}">${escape(active[1])}</strong></summary>
    <div class="setting-menu-content"><div>
      ${options.map(([value, text]) => `<button type="button" class="setting-option ${value === selected ? 'is-selected' : ''}" data-action="choose-setting" data-setting="${name}" data-value="${escape(value)}" data-label="${escape(text)}">${escape(text)}</button>`).join('')}
    </div></div>
    <input type="hidden" name="${name}" value="${escape(selected)}">
  </details>`;
}

function settingsPage() {
  const user = state.user || {};
  const languages = [['ru', 'Русский'], ['en', 'English']];
  const themes = [['dark', 'Ночной'], ['light', 'Светлый']];
  const timezones = [
    ['Europe/Moscow', 'Москва · UTC+3'], ['Europe/Kazan', 'Казань · UTC+3'],
    ['Asia/Yekaterinburg', 'Екатеринбург · UTC+5'], ['Asia/Novosibirsk', 'Новосибирск · UTC+7'],
    ['Asia/Tashkent', 'Ташкент · UTC+5'], ['Asia/Dubai', 'Дубай · UTC+4'],
  ];
  return `${pageIntro('Личные параметры', 'Настройки', 'Выберите место и комфортный вид приложения. Общий расчёт времени — MWL.')}
    <form id="settings-form" class="settings-form" data-reveal>
      <fieldset><legend>Местоположение</legend>
        <label><span>Город</span><input name="city" value="${escape(user.city || 'Moscow')}" required></label>
        <label><span>Страна</span><input name="country" value="${escape(user.country || 'Russia')}" required></label>
        ${choiceMenu('timezone', 'Часовой пояс', timezones, user.timezone || 'Europe/Moscow', 'Используется для расписания')}
      </fieldset>
      <fieldset><legend>Вид приложения</legend>
        ${choiceMenu('theme', 'Оформление', themes, user.theme || 'dark')}
        ${choiceMenu('language', 'Язык', languages, user.language || 'ru')}
      </fieldset>
      <label class="notification-row"><span><b>Напоминания о намазах</b><small>Отправим сообщение от бота в нужное время</small></span><input type="checkbox" name="notifications_enabled" ${user.notifications_enabled ? 'checked' : ''}></label>
      <button class="button button-primary" type="submit">Сохранить изменения</button>
      <p id="settings-status" class="form-status" aria-live="polite"></p>
    </form>`;
}

function mountSettings(token) {
  root.querySelector('#settings-form')?.addEventListener('submit', (event) => submitSettings(event, token));
}

async function submitSettings(event, token) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const status = root.querySelector('#settings-status');
  const values = Object.fromEntries(new FormData(form));
  values.notifications_enabled = form.notifications_enabled.checked ? 1 : 0;
  button.disabled = true;
  button.classList.add('is-loading');
  try {
    const response = await api('/settings', { method: 'PATCH', body: JSON.stringify(values) });
    state.user = response.user;
    syncChrome();
    if (isCurrent(token, 'settings')) status.textContent = 'Изменения сохранены.';
    showToast('Настройки обновлены');
    haptic();
  } catch (error) {
    if (isCurrent(token, 'settings')) status.textContent = error.message;
  } finally {
    if (isCurrent(token, 'settings')) {
      button.disabled = false;
      button.classList.remove('is-loading');
    }
  }
}

const pages = {
  home: homePage,
  chat: chatPage,
  quran: quranPage,
  sura: (options) => suraPage(options.suraId),
  dua: duaPage,
  knowledge: knowledgePage,
  settings: settingsPage,
};

async function paint(markup, token, initial = false) {
  const view = root.querySelector('#view');
  const write = () => {
    if (token !== state.version) return;
    view.innerHTML = markup;
    reveal(view);
    view.animate?.([
      { opacity: 0, transform: 'translateY(10px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: reducedMotion.matches ? 1 : 320, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' });
  };
  if (initial || !state.painted || reducedMotion.matches || !view.children.length) {
    write();
    state.painted = true;
    return;
  }
  if (!view.animate) {
    write();
    return;
  }
  view.getAnimations?.().forEach((animation) => animation.cancel());
  try {
    await view.animate([
      { opacity: 1, transform: 'translateY(0)' },
      { opacity: 0, transform: 'translateY(-6px)' },
    ], { duration: 140, easing: 'cubic-bezier(.4,0,1,1)', fill: 'both' }).finished;
  } catch { /* A newer navigation interrupted this transition. */ }
  write();
}

function isCurrent(token, route) {
  return state.version === token && state.route === route;
}

async function go(route, options = {}) {
  if (!pages[route]) return;
  const previous = state.route;
  state.scroll[previous] = window.scrollY;
  state.route = route;
  const token = ++state.version;
  syncChrome();
  if (!options.initial) haptic();
  await paint(pages[route](options), token, options.initial);
  if (!isCurrent(token, route)) return;
  const position = options.restore ? state.scroll[route] || 0 : 0;
  window.scrollTo({ top: position, behavior: 'auto' });
  root.querySelector('#view')?.focus({ preventScroll: true });
  ({ home: mountHome, chat: mountChat, quran: mountQuran, sura: mountSura, dua: mountDua, knowledge: mountKnowledge, settings: mountSettings }[route])?.(token, options);
}

async function toggleFavourite(button) {
  const suraId = Number(button.dataset.sura);
  const ayatId = button.dataset.ayat ? Number(button.dataset.ayat) : null;
  if (!suraId) return;
  button.disabled = true;
  try {
    const result = await api('/favourites', { method: 'POST', body: JSON.stringify({ suraId, ayatId }) });
    const index = state.favourites.findIndex((item) => item.sura_id === suraId && item.ayat_id === ayatId);
    if (result.saved && index === -1) state.favourites.push({ sura_id: suraId, ayat_id: ayatId });
    if (!result.saved && index >= 0) state.favourites.splice(index, 1);
    button.textContent = result.saved ? 'Сохранено' : ayatId ? 'Сохранить' : 'В избранное';
    showToast(result.saved ? 'Добавлено в избранное' : 'Убрано из избранного');
    haptic();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    button.disabled = false;
  }
}

function chooseSetting(button) {
  const { setting, value, label } = button.dataset;
  const input = root.querySelector(`input[name="${setting}"]`);
  if (!input) return;
  input.value = value;
  root.querySelector(`[data-current="${setting}"]`).textContent = label;
  root.querySelectorAll(`[data-setting="${setting}"]`).forEach((option) => option.classList.toggle('is-selected', option === button));
  button.closest('details').open = false;
}

function onRootClick(event) {
  const route = event.target.closest('[data-route]');
  if (route) {
    event.preventDefault();
    const target = route.dataset.route;
    if (target === state.route && target !== 'settings') window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    else go(target, { restore: route.closest('.bottom-nav') !== null });
    return;
  }
  const action = event.target.closest('[data-action]');
  if (!action) return;
  if (action.dataset.action === 'refresh-prayers') mountHome(state.version);
  if (action.dataset.action === 'open-sura') go('sura', { suraId: Number(action.dataset.sura) });
  if (action.dataset.action === 'toggle-favourite') toggleFavourite(action);
  if (action.dataset.action === 'filter-dua') { state.duaCategory = action.dataset.category; drawDua(); }
  if (action.dataset.action === 'choose-setting') chooseSetting(action);
  if (action.dataset.action === 'suggest-question') {
    const input = root.querySelector('#chat-message');
    if (input) { input.value = action.dataset.question; input.focus(); }
  }
}

function showToast(message, danger = false) {
  const toast = root.querySelector('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.toggle('is-danger', danger);
  toast.classList.add('is-visible');
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove('is-visible'), 3600);
}

async function init() {
  initTelegram();
  buildFrame();
  try {
    state.user = (await api('/me')).user;
  } catch {
    state.user = { city: 'Moscow', theme: 'dark', timezone: 'Europe/Moscow', notifications_enabled: 0 };
  }
  syncChrome();
  go('home', { initial: true });
}

init();
