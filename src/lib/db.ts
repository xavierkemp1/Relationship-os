// src/lib/db.ts
import Database from "@tauri-apps/plugin-sql";

/** Opens (or creates) a local SQLite DB and ensures tables exist. */
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS interactions (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      occurred_at DATETIME NOT NULL,
      mood INTEGER,
      energy INTEGER,
      topics TEXT,
      summary TEXT,
      next_step TEXT,
      due_date DATETIME,
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
  `);

  return db;
};
