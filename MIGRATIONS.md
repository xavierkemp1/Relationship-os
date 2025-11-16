# Manual migration steps

If you already ran a previous build of Relationship OS you need to update the local SQLite file (`relationship_os.db`) before this version will load correctly.

1. Open the database (for example with `sqlite3 relationship_os.db`).
2. Add the new contact-frequency column to `people` (ignore the error if the column already exists):

```sql
ALTER TABLE people ADD COLUMN ideal_contact_frequency_days INTEGER DEFAULT 14;
```

3. Rebuild the `interactions` table so it matches the new schema:

```sql
ALTER TABLE interactions RENAME TO interactions_old;

CREATE TABLE interactions (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  date DATETIME NOT NULL,
  type TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(person_id) REFERENCES people(id) ON DELETE CASCADE
);

INSERT INTO interactions (id, person_id, date, type, notes, created_at)
SELECT
  id,
  person_id,
  occurred_at,
  COALESCE(topics, 'legacy'),
  summary,
  created_at
FROM interactions_old;

DROP TABLE interactions_old;
```

These steps preserve existing interaction IDs so any recorded voice notes remain linked to the right entries. After running them you can restart the app and the new interaction timeline plus scheduling features will use the updated data.
