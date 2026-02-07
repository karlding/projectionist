import { DatabaseSync } from 'node:sqlite';

export type Database = InstanceType<typeof DatabaseSync>;

/**
 * Open the SQLite database. Call this only from the main process with an
 * absolute path (e.g. path.join(app.getAppPath(), 'songs.sqlite3')).
 */
export function openDatabase(path: string): Database {
  return new DatabaseSync(path);
}