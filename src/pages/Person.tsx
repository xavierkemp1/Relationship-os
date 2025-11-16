import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { v4 as uuid } from "uuid";
import { getDb } from "../lib/db";
import { recordVoice } from "../lib/audio";
import {
  calculateScheduleFromInteractions,
  formatDisplayDate,
  formatRelativeDays,
} from "../lib/contactDates";

const interactionTypeOptions = [
  { value: "call", label: "Call" },
  { value: "message", label: "Message" },
  { value: "meeting", label: "In-person" },
  { value: "video", label: "Video chat" },
  { value: "voice_note", label: "Voice note" },
  { value: "other", label: "Other" },
];

const todayInputValue = () => new Date().toISOString().split("T")[0];
const MS_PER_DAY = 86_400_000;

const parseDateOrNull = (value: string): Date | null => {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms);
};

const relativeLabelForDate = (value: string) => {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "";
  const diff = Math.max(0, Math.round((Date.now() - ms) / MS_PER_DAY));
  return formatRelativeDays(diff);
};

type PersonRow = {
  id: string;
  name: string;
  context?: string;
  ideal_contact_frequency_days: number | null;
};
type InteractionRow = { id: string; date: string; type: string | null; notes: string | null };
type PersonNoteRow = { id: string; body: string; created_at: string; updated_at: string | null };
type VoiceNoteRow = {
  id: string;
  interaction_id: string;
  filepath: string;
  duration_seconds: number | null;
};
type VoiceNote = VoiceNoteRow & { src: string };
type Interaction = InteractionRow & { voiceNotes: VoiceNote[] };

type PersonFormState = {
  name: string;
  context: string;
  ideal_contact_frequency_days: number | null;
};

type InteractionFormState = {
  date: string;
  type: string;
  notes: string;
};

export default function Person() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [person, setPerson] = useState<PersonRow | null>(null);
  const [personForm, setPersonForm] = useState<PersonFormState>({
    name: "",
    context: "",
    ideal_contact_frequency_days: 14,
  });
  const [personSaving, setPersonSaving] = useState(false);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [interactionForm, setInteractionForm] = useState<InteractionFormState>({
    date: todayInputValue(),
    type: interactionTypeOptions[0]?.value ?? "call",
    notes: "",
  });
  const [interactionSaving, setInteractionSaving] = useState(false);
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
        "SELECT id, date, type, notes FROM interactions WHERE person_id=? ORDER BY date DESC",
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
      setPersonForm({
        name: p?.name ?? "",
        context: p?.context ?? "",
        ideal_contact_frequency_days: p?.ideal_contact_frequency_days ?? 14,
      });
      setInteractions(intsWithNotes);
      setNotes(personNotes);
      setInteractionForm((prev) => ({ ...prev, date: todayInputValue() }));
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

  const metrics = useMemo(
    () =>
      calculateScheduleFromInteractions({
        interactions,
        frequencyDays: person?.ideal_contact_frequency_days ?? null,
      }),
    [interactions, person?.ideal_contact_frequency_days]
  );

  const savePersonDetails = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!id) return;
    const trimmedName = personForm.name.trim();
    if (!trimmedName) {
      setError("Name is required");
      return;
    }
    try {
      setPersonSaving(true);
      setError(null);
      const db = await getDb();
      const freq =
        typeof personForm.ideal_contact_frequency_days === "number" &&
        Number.isFinite(personForm.ideal_contact_frequency_days) &&
        personForm.ideal_contact_frequency_days > 0
          ? Math.round(personForm.ideal_contact_frequency_days)
          : null;
      await db.execute("UPDATE people SET name=?, context=?, ideal_contact_frequency_days=? WHERE id=?", [
        trimmedName,
        personForm.context.trim() || null,
        freq,
        id,
      ]);
      await load();
    } catch (e: any) {
      console.error("Update person failed", e);
      setError(e?.message ?? "Failed to update person");
    } finally {
      setPersonSaving(false);
    }
  };

  const deletePerson = async () => {
    if (!id) return;
    const confirmDelete = window.confirm("Delete this person and all their data?");
    if (!confirmDelete) return;
    try {
      setError(null);
      const db = await getDb();
      await db.execute("DELETE FROM people WHERE id=?", [id]);
      navigate("/people");
    } catch (e: any) {
      console.error("Delete person failed", e);
      setError(e?.message ?? "Failed to delete person");
    }
  };

  const addInteraction = async (event: FormEvent) => {
    event.preventDefault();
    if (!id) return;
    if (!interactionForm.date) return;
    try {
      setInteractionSaving(true);
      setError(null);
      const db = await getDb();
      const interactionId = uuid();
      const isoDate = new Date(`${interactionForm.date}T00:00:00`).toISOString();
      await db.execute("INSERT INTO interactions (id, person_id, date, type, notes) VALUES (?,?,?,?,?)", [
        interactionId,
        id,
        isoDate,
        interactionForm.type,
        interactionForm.notes.trim() || null,
      ]);
      setInteractionForm({
        date: todayInputValue(),
        type: interactionForm.type,
        notes: "",
      });
      await load();
    } catch (e: any) {
      console.error("Add interaction failed", e);
      setError(e?.message ?? "Failed to add interaction");
    } finally {
      setInteractionSaving(false);
    }
  };

  const startRecording = async () => {
    if (!id || status !== "idle") return;
    try {
      setError(null);
      const recorder = await recordVoice(async (filePath, duration) => {
        try {
          const db = await getDb();
          const interactionId = uuid();
          await db.execute("INSERT INTO interactions (id, person_id, date, type, notes) VALUES (?,?,?,?,?)", [
            interactionId,
            id,
            new Date().toISOString(),
            "voice_note",
            "Voice memo",
          ]);
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
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <Link to="/people" className="text-blue-600">
        ← Back
      </Link>
      <div>
        <h2 className="text-2xl font-semibold mt-2">{person?.name ?? "Person"}</h2>
        {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="border rounded p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Last contacted</div>
          <div className="text-lg font-semibold mt-1">
            {metrics.lastContactDate ? formatDisplayDate(metrics.lastContactDate) : "—"}
          </div>
          <div className="text-sm text-gray-500">
            {metrics.lastContactDate ? `(${formatRelativeDays(metrics.daysSinceLast)})` : "No interactions yet"}
          </div>
        </div>
        <div className="border rounded p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Ideal frequency</div>
          <div className="text-lg font-semibold mt-1">
            {person?.ideal_contact_frequency_days ?? "—"} days
          </div>
          <div className="text-sm text-gray-500">Adjust below</div>
        </div>
        <div className="border rounded p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Next contact</div>
          <div className="text-lg font-semibold mt-1">
            {metrics.nextContactDate ? formatDisplayDate(metrics.nextContactDate) : "—"}
          </div>
          <div className={`text-sm ${metrics.isOverdue ? "text-red-600" : "text-gray-500"}`}>
            {metrics.nextContactDate
              ? metrics.daysUntilNext !== null && metrics.daysUntilNext < 0
                ? `${Math.abs(metrics.daysUntilNext)} day${Math.abs(metrics.daysUntilNext) === 1 ? "" : "s"} overdue`
                : metrics.daysUntilNext === 0
                  ? "Due today"
                  : `in ${metrics.daysUntilNext} day${metrics.daysUntilNext === 1 ? "" : "s"}`
              : "Log an interaction"}
          </div>
        </div>
      </div>

      <form onSubmit={savePersonDetails} className="border rounded p-4 space-y-3">
        <h3 className="text-xl font-semibold">Person details</h3>
        <div>
          <label className="text-sm text-gray-600">Name</label>
          <input
            value={personForm.name}
            onChange={(e) => setPersonForm((prev) => ({ ...prev, name: e.target.value }))}
            className="mt-1 w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="text-sm text-gray-600">Context</label>
          <textarea
            value={personForm.context}
            onChange={(e) => setPersonForm((prev) => ({ ...prev, context: e.target.value }))}
            className="mt-1 w-full border rounded px-3 py-2"
            rows={3}
          />
        </div>
        <div>
          <label className="text-sm text-gray-600">Ideal contact frequency (days)</label>
          <input
            type="number"
            min={1}
            value={personForm.ideal_contact_frequency_days ?? ""}
            onChange={(e) =>
              setPersonForm((prev) => ({
                ...prev,
                ideal_contact_frequency_days: e.target.value ? Number(e.target.value) : null,
              }))
            }
            className="mt-1 w-full border rounded px-3 py-2"
          />
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            type="submit"
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            disabled={personSaving}
          >
            {personSaving ? "Saving…" : "Save details"}
          </button>
          <button type="button" onClick={deletePerson} className="px-4 py-2 rounded border text-red-600">
            Delete person
          </button>
        </div>
      </form>

      <div className="flex gap-3 flex-wrap items-center">
        {status === "idle" ? (
          <button onClick={startRecording} className="px-4 py-2 rounded bg-black text-white">
            Record quick note
          </button>
        ) : status === "recording" ? (
          <button onClick={stopRecording} className="px-4 py-2 rounded bg-red-600 text-white">
            Stop
          </button>
        ) : (
          <button disabled className="px-4 py-2 rounded bg-gray-300 text-gray-600 cursor-not-allowed">
            Saving…
          </button>
        )}
      </div>

      <form onSubmit={addInteraction} className="border rounded p-4 space-y-3">
        <h3 className="text-xl font-semibold">Log an interaction</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-sm text-gray-600">Date</label>
            <input
              type="date"
              value={interactionForm.date}
              onChange={(e) => setInteractionForm((prev) => ({ ...prev, date: e.target.value }))}
              className="mt-1 w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Type</label>
            <select
              value={interactionForm.type}
              onChange={(e) => setInteractionForm((prev) => ({ ...prev, type: e.target.value }))}
              className="mt-1 w-full border rounded px-3 py-2"
            >
              {interactionTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-sm text-gray-600">Notes</label>
          <textarea
            value={interactionForm.notes}
            onChange={(e) => setInteractionForm((prev) => ({ ...prev, notes: e.target.value }))}
            className="mt-1 w-full border rounded px-3 py-2"
            rows={3}
            placeholder="What did you talk about?"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-50"
            disabled={interactionSaving}
          >
            {interactionSaving ? "Saving…" : "Add interaction"}
          </button>
        </div>
      </form>

      <div>
        <h3 className="text-xl font-semibold mb-2">Interaction timeline</h3>
        <ul className="space-y-3">
          {interactions.map((i) => {
            const parsedDate = parseDateOrNull(i.date);
            const typeLabel = interactionTypeOptions.find((opt) => opt.value === i.type)?.label ?? i.type ?? "Interaction";
            const relative = relativeLabelForDate(i.date);
            return (
              <li key={i.id} className="border rounded p-3 space-y-2">
                <div className="flex flex-wrap justify-between gap-2 text-sm text-gray-600">
                  <span className="font-medium text-gray-800">
                    {formatDisplayDate(parsedDate)} • {typeLabel}
                  </span>
                  {relative && <span>{relative}</span>}
                </div>
                {i.notes && <p className="whitespace-pre-wrap text-gray-800">{i.notes}</p>}
                {i.voiceNotes.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {i.voiceNotes.map((note) => (
                      <div key={note.id} className="flex items-center gap-3">
                        <audio controls src={note.src} className="flex-1" />
                        {typeof note.duration_seconds === "number" && (
                          <span className="text-xs text-gray-500 whitespace-nowrap">{note.duration_seconds}s</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
          {interactions.length === 0 && (
            <li className="text-sm text-gray-500">No interactions yet. Use the form above to log one.</li>
          )}
        </ul>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-2">Notes</h3>
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
    </div>
  );
}
