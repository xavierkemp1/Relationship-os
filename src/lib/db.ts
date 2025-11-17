// src/lib/db.ts
import Database from "@tauri-apps/plugin-sql";
/** Opens (or creates) a local SQLite DB and ensures tables exist. */
type ColumnInfo = { name: string };

const columnExists = async (db: Database, table: string, column: string) => {
  const rows = await db.select<ColumnInfo[]>(`PRAGMA table_info(${table})`);
  return rows.some((row) => row.name === column);
};

const ensurePeopleSchema = async (db: Database) => {
  const hasIdealFrequency = await columnExists(db, "people", "ideal_contact_frequency_days");
  if (!hasIdealFrequency) {
    await db.execute(
      "ALTER TABLE people ADD COLUMN ideal_contact_frequency_days INTEGER DEFAULT 14"
    );
  }
};

const ensureInteractionsSchema = async (db: Database) => {
  const columns = await db.select<ColumnInfo[]>("PRAGMA table_info(interactions)");
  const hasDate = columns.some((col) => col.name === "date");
  const hasOccurredAt = columns.some((col) => col.name === "occurred_at");
  if (!hasDate && hasOccurredAt) {
    await db.execute("ALTER TABLE interactions RENAME TO interactions_old");
    await db.execute(`
      CREATE TABLE interactions (
        id TEXT PRIMARY KEY,
        person_id TEXT NOT NULL,
        date DATETIME NOT NULL,
        type TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(person_id) REFERENCES people(id) ON DELETE CASCADE
      );
    `);
    await db.execute(`
      INSERT INTO interactions (id, person_id, date, type, notes, created_at)
      SELECT
        id,
        person_id,
        occurred_at,
        COALESCE(topics, 'legacy'),
        summary,
        created_at
      FROM interactions_old;
    `);
    await db.execute("DROP TABLE interactions_old");
  }
};

export const getDb = async () => {
  const db = await Database.load("sqlite:relationship_os.db");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      preferred_name TEXT,
      context TEXT,
      importance INTEGER DEFAULT 3,
      tags TEXT,
      ideal_contact_frequency_days INTEGER DEFAULT 14,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS interactions (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      date DATETIME NOT NULL,
      type TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(person_id) REFERENCES people(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS commitments (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      description TEXT NOT NULL,
      due_date DATETIME,
      status TEXT DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(person_id) REFERENCES people(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS voice_notes (
      id TEXT PRIMARY KEY,
      interaction_id TEXT NOT NULL,
      filepath TEXT NOT NULL,
      duration_seconds INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(interaction_id) REFERENCES interactions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS person_notes (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      FOREIGN KEY(person_id) REFERENCES people(id) ON DELETE CASCADE
    );
  `);

  await ensurePeopleSchema(db);
  await ensureInteractionsSchema(db);

  return db;
};
