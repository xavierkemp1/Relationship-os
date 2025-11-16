import { Link, useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { v4 as uuid } from "uuid";
import { getDb } from "../lib/db";
import { recordVoice } from "../lib/audio";

type PersonRow = { id: string; name: string; context?: string };
type InteractionRow = { id: string; occurred_at: string };
type PersonNoteRow = { id: string; body: string; created_at: string; updated_at: string | null };
type VoiceNoteRow = {
  id: string;
  interaction_id: string;
  filepath: string;
  duration_seconds: number | null;
};
type VoiceNote = VoiceNoteRow & { src: string };
type Interaction = InteractionRow & { voiceNotes: VoiceNote[] };

export default function Person() {
  const { id } = useParams();
  const [person, setPerson] = useState<PersonRow | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [notes, setNotes] = useState<PersonNoteRow[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const recRef = useRef<MediaRecorder | null>(null);
  const [status, setStatus] = useState<"idle" | "recording" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    try {
      setError(null);
      const db = await getDb();
      const [p] = await db.select<PersonRow[]>("SELECT * FROM people WHERE id = ?", [id]);
      const ints = await db.select<InteractionRow[]>(
        "SELECT * FROM interactions WHERE person_id=? ORDER BY occurred_at DESC",
        [id]
      );
      const voiceRows = await db.select<VoiceNoteRow[]>(
        `SELECT vn.id, vn.interaction_id, vn.filepath, vn.duration_seconds
         FROM voice_notes vn
         INNER JOIN interactions i ON vn.interaction_id = i.id
         WHERE i.person_id=?`,
        [id]
      );
      const dir = await appDataDir();
      const notesWithSrc = await Promise.all(
        voiceRows.map(async (note) => {
          const fullPath = await join(dir, note.filepath);
          const enriched: VoiceNote = { ...note, src: convertFileSrc(fullPath) };
          return enriched;
        })
      );
      const noteMap = new Map<string, VoiceNote[]>();
      notesWithSrc.forEach((note) => {
        noteMap.set(note.interaction_id, [...(noteMap.get(note.interaction_id) ?? []), note]);
      });
      const intsWithNotes = ints.map((interaction) => ({
        ...interaction,
        voiceNotes: noteMap.get(interaction.id) ?? [],
      }));
      const personNotes = await db.select<PersonNoteRow[]>(
        "SELECT * FROM person_notes WHERE person_id=? ORDER BY created_at DESC",
        [id]
      );
      setPerson(p ?? null);
      setInteractions(intsWithNotes);
      setNotes(personNotes);
    } catch (e: any) {
      console.error("Load person failed", e);
      setError(e?.message ?? "Failed to load person");
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    return () => {
      if (recRef.current) {
        try {
          recRef.current.stop();
        } catch {}
      }
    };
  }, []);

  const startRecording = async () => {
    if (!id || status !== "idle") return;
    try {
      setError(null);
      const recorder = await recordVoice(async (filePath, duration) => {
        try {
          const db = await getDb();
          const interactionId = uuid();
          await db.execute(
            "INSERT INTO interactions (id, person_id, occurred_at) VALUES (?,?,datetime('now'))",
            [interactionId, id]
          );
          await db.execute(
            "INSERT INTO voice_notes (id, interaction_id, filepath, duration_seconds) VALUES (?,?,?,?)",
            [uuid(), interactionId, filePath, duration]
          );
          await load();
        } catch (dbErr: any) {
          console.error("Save interaction failed", dbErr);
          setError(dbErr?.message ?? "Failed to save note");
        } finally {
          recRef.current = null;
          setStatus("idle");
        }
      });
      recRef.current = recorder;
      setStatus("recording");
    } catch (e: any) {
      console.error("Record failed", e);
      setStatus("idle");
      setError(e?.message ?? "Unable to start recording");
    }
  };

  const stopRecording = () => {
    if (!recRef.current) return;
    setStatus("saving");
    recRef.current.stop();
  };

  const addNote = async () => {
    if (!id) return;
    const body = noteDraft.trim();
    if (!body) return;
    try {
      setError(null);
      const db = await getDb();
      await db.execute("INSERT INTO person_notes (id, person_id, body) VALUES (?,?,?)", [uuid(), id, body]);
      setNoteDraft("");
      await load();
    } catch (e: any) {
      console.error("Add note failed", e);
      setError(e?.message ?? "Failed to add note");
    }
  };

  const beginEdit = (note: PersonNoteRow) => {
    setEditingId(note.id);
    setEditingText(note.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  const saveEdit = async () => {
    if (!editingId || !id) return;
    const body = editingText.trim();
    if (!body) return;
    try {
      setError(null);
      const db = await getDb();
      await db.execute("UPDATE person_notes SET body=?, updated_at=datetime('now') WHERE id=?", [body, editingId]);
      cancelEdit();
      await load();
    } catch (e: any) {
      console.error("Update note failed", e);
      setError(e?.message ?? "Failed to update note");
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      setError(null);
      const db = await getDb();
      await db.execute("DELETE FROM person_notes WHERE id=?", [noteId]);
      if (editingId === noteId) {
        cancelEdit();
      }
      await load();
    } catch (e: any) {
      console.error("Delete note failed", e);
      setError(e?.message ?? "Failed to delete note");
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link to="/people" className="text-blue-600">
        ← Back
      </Link>
      <h2 className="text-2xl font-semibold mt-2">{person?.name}</h2>

      <div className="mt-4 flex gap-3">
        {status === "idle" ? (
          <button onClick={startRecording} className="px-4 py-2 rounded bg-black text-white">Record quick note</button>
        ) : status === "recording" ? (
          <button onClick={stopRecording} className="px-4 py-2 rounded bg-red-600 text-white">Stop</button>
        ) : (
          <button disabled className="px-4 py-2 rounded bg-gray-300 text-gray-600 cursor-not-allowed">Saving…</button>
        )}
      </div>

      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

      <h3 className="text-xl font-semibold mt-8 mb-2">Interactions</h3>
      <ul className="space-y-3">
        {interactions.map((i) => (
          <li key={i.id} className="border rounded p-3">
            <div className="text-sm text-gray-500">{i.occurred_at}</div>
            {i.voiceNotes.length > 0 && (
              <div className="mt-2 space-y-2">
                {i.voiceNotes.map((note) => (
                  <div key={note.id} className="flex items-center gap-3">
                    <audio controls src={note.src} className="flex-1" />
                    {typeof note.duration_seconds === "number" && (
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {note.duration_seconds}s
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* later: summary, mood, next step */}
          </li>
        ))}
      </ul>

      <h3 className="text-xl font-semibold mt-8 mb-2">Notes</h3>
      <div className="space-y-3">
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          placeholder="Jot down a thought about this person…"
          className="w-full border rounded p-3"
        />
        <div className="flex justify-end">
          <button
            onClick={addNote}
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            disabled={!noteDraft.trim()}
          >
            Save note
          </button>
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {notes.map((note) => (
          <li key={note.id} className="border rounded p-3">
            {editingId === note.id ? (
              <div className="space-y-2">
                <textarea
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  className="w-full border rounded p-2"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveEdit}
                    className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50"
                    disabled={!editingText.trim()}
                  >
                    Save
                  </button>
                  <button onClick={cancelEdit} className="px-3 py-1 rounded bg-gray-200">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="whitespace-pre-wrap text-gray-800">{note.body}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                  <span>Added {note.created_at}</span>
                  {note.updated_at && <span>Updated {note.updated_at}</span>}
                </div>
                <div className="mt-3 flex gap-3">
                  <button onClick={() => beginEdit(note)} className="text-blue-600 text-sm">
                    Edit
                  </button>
                  <button onClick={() => deleteNote(note.id)} className="text-red-600 text-sm">
                    Delete
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
        {notes.length === 0 && (
          <li className="text-sm text-gray-500">No notes yet. Use the box above to add one.</li>
        )}
      </ul>
    </div>
  );
}
