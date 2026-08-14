import { initData } from './telegram.js';

export async function api(path, options = {}) {
  const headers = { 'content-type': 'application/json', 'x-telegram-init-data': initData(), ...(options.headers || {}) };
  const response = await fetch(`/api${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Не удалось выполнить запрос.');
  return body;
}
