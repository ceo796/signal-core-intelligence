import { pool } from "@workspace/db";

let notesTableReady: Promise<void> | null = null;

/** Ensure the notes table exists (safe for production deploys without a manual db push). */
export async function ensureNotesTables(): Promise<void> {
  if (!notesTableReady) {
    notesTableReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS notes (
          id serial PRIMARY KEY,
          owner_user_id text NOT NULL,
          title text NOT NULL,
          content text NOT NULL DEFAULT '',
          tags text NOT NULL DEFAULT '[]',
          icon text NOT NULL DEFAULT 'FileText',
          is_pinned boolean NOT NULL DEFAULT false,
          archived_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);

      await pool.query(`CREATE INDEX IF NOT EXISTS idx_notes_owner_user_id ON notes(owner_user_id)`);
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_notes_owner_archived_updated ON notes(owner_user_id, archived_at, updated_at)`,
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_notes_owner_pinned_updated ON notes(owner_user_id, is_pinned, updated_at)`,
      );
    })();
  }

  await notesTableReady;
}