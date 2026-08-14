import crypto from 'node:crypto';
import { config } from '../config.js';

export function validateInitData(initData) {
  if (!initData || !config.botToken) return null;

  const values = new URLSearchParams(initData);
  const receivedHash = values.get('hash');
  if (!receivedHash) return null;
  values.delete('hash');

  const dataCheckString = [...values.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(config.botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  if (receivedHash.length !== calculatedHash.length || !crypto.timingSafeEqual(Buffer.from(receivedHash), Buffer.from(calculatedHash))) {
    return null;
  }

  const authDate = Number(values.get('auth_date') || 0);
  if (!authDate || Date.now() / 1000 - authDate > 86_400) return null;

  try {
    return JSON.parse(values.get('user') || '');
  } catch {
    return null;
  }
}
