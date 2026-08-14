import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';

mkdirSync(dirname(config.databasePath), { recursive: true });

export const db = new DatabaseSync(config.databasePath);
db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));

if (db.prepare('PRAGMA user_version').get().user_version < 3) {
  db.exec('DELETE FROM prayer_times; PRAGMA user_version = 3');
}
