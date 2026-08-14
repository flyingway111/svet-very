import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';

mkdirSync(dirname(config.databasePath), { recursive: true });

export const db = new DatabaseSync(config.databasePath);
db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));

const userColumns = db.prepare('PRAGMA table_info(users)').all().map(({ name }) => name);
if (!userColumns.includes('calculation_method')) {
  db.exec("ALTER TABLE users ADD COLUMN calculation_method TEXT NOT NULL DEFAULT '3'");
}
