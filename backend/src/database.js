import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

export const defaultDatabasePath = fileURLToPath(
  new URL('../data/tareas.db', import.meta.url),
);

export function createDatabase({ filename } = {}) {
  const databasePath =
    filename === ':memory:'
      ? filename
      : filename
        ? resolve(filename)
        : defaultDatabasePath;

  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const database = new Database(databasePath);
  database.pragma('foreign_keys = ON');
  database.exec(`
    CREATE TABLE IF NOT EXISTS tareas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL CHECK (length(titulo) BETWEEN 1 AND 120),
      descripcion TEXT NOT NULL DEFAULT '' CHECK (length(descripcion) <= 1000),
      prioridad TEXT NOT NULL DEFAULT 'media'
        CHECK (prioridad IN ('baja', 'media', 'alta')),
      fecha_entrega TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'completada'))
    )
  `);

  return database;
}
