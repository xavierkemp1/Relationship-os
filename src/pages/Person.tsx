import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { v4 as uuid } from "uuid";
import { getDb } from "../lib/db";
import { recordVoice } from "../lib/audio";
import { PersonVoiceNotes } from "../components/PersonVoiceNotes";

import { supabase } from "../lib/supabaseClient";

import {
  calculateScheduleFromInteractions,
  formatDisplayDate,
  formatRelativeDays,
} from "../lib/contactDates";
import PageLayout, {
  inputBaseClass,
  labelClass,
  sectionCardClass,
  sectionTitleClass,
} from "../components/PageLayout";

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

const primaryButtonClass =
  "inline-flex items-center justify-center rounded-md bg-[#3A6FF8] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#315cce] disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-md border border-[#E5E7EB] px-4 py-2.5 text-sm font-semibold text-[#1A1A1A] transition hover:border-[#3A6FF8] hover:text-[#3A6FF8]";
const dangerButtonClass =
  "inline-flex items-center justify-center rounded-md border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:border-red-400 hover:text-red-700";

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

  const isTauri = useMemo(
    () => typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__),
    []
  );

  const resolveVoiceNoteSrc = async (filepath: string) => {
    if (!filepath) return "";
    try {
      if (!isTauri) {
        return filepath;
      }
      const dir = await appDataDir();
      const fullPath = await join(dir, filepath);
      return convertFileSrc(fullPath);
    } catch (err) {
      console.warn("Failed to resolve voice note source", err);
      return filepath;
    }
  };

  const load = async () => {
    if (!id) return;
    try {
      setError(null);
      const db = await getDb();
      const [p, ints, voiceRows, personNotes] = await Promise.all([
        db.select<PersonRow[]>("SELECT * FROM people WHERE id = ?", [id]).then((rows) => rows[0]),
        db.select<InteractionRow[]>(
          "SELECT id, date, type, notes FROM interactions WHERE person_id=? ORDER BY date DESC",
          [id]
        ),
        db.select<VoiceNoteRow[]>(
          `SELECT vn.id, vn.interaction_id, vn.filepath, vn.duration_seconds
           FROM voice_notes vn
           INNER JOIN interactions i ON vn.interaction_id = i.id
           WHERE i.person_id=?`,
          [id]
        ),
        db.select<PersonNoteRow[]>(
          "SELECT * FROM person_notes WHERE person_id=? ORDER BY created_at DESC",
          [id]
        ),
      ]);
      const notesWithSrc = await Promise.all(
        voiceRows.map(async (note) => ({
          ...note,
          src: await resolveVoiceNoteSrc(note.filepath),
        }))
      );
      const noteMap = new Map<string, VoiceNote[]>();
      notesWithSrc.forEach((note) => {
        noteMap.set(note.interaction_id, [...(noteMap.get(note.interaction_id) ?? []), note]);
      });
      const intsWithNotes = ints.map((interaction) => ({
        ...interaction,
        voiceNotes: noteMap.get(interaction.id) ?? [],
      }));
      setPerson(p ?? null);
      setPersonForm({
        name: p?.name ?? "",
        context: p?.context ?? "",
        ideal_contact_frequency_days:
          typeof p?.ideal_contact_frequency_days === "number"
            ? p.ideal_contact_frequency_days
            : typeof p?.ideal_contact_frequency_days === "string"
              ? Number(p.ideal_contact_frequency_days) || 14
              : 14,
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
      console.log("[recording] startRecording called");
      if (!id || status !== "idle") return;
      try {
        setError(null);
          const recorder = await recordVoice(async (filePath, duration) => {
          console.log("[recording] calling saveRecording", { filePath, duration });
          setStatus("saving");
          try {
            // If filePath is empty, the FS write failed – bail gracefully
            if (!filePath) {
              setError("Failed to save audio file.");
              return;
            }
        
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
            console.log("[recording] saveRecording success", { interactionId, filePath });
          } catch (dbErr: any) {
            console.error("[recording] saveRecording error", dbErr);
            setError(dbErr?.message ?? "Failed to save note");
          } finally {
            recRef.current = null;
            setStatus("idle");
          }
        });

      recRef.current = recorder;
      setStatus("recording");
    } catch (e: any) {
      console.error("[recording] startRecording failed", e);
      setStatus("idle");
      setError(e?.message ?? "Unable to start recording");
    }
  };

  const stopRecording = () => {
    console.log("[recording] stopRecording called");
    if (!recRef.current) {
      console.warn("[recording] stopRecording called without active recorder");
      return;
    }
    setStatus("saving");
    try {
      recRef.current.stop();
    } catch (err) {
      console.error("[recording] failed to stop recorder", err);
      setStatus("idle");
    }
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
    <PageLayout
      title={person?.name ?? "Person"}
      backLink={{ to: "/people", label: "People" }}
      description={person?.context || "Log interactions, track reminders, and keep richer history."}
    >
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid gap-6 md:grid-cols-3">
        <div className={`${sectionCardClass} space-y-1`}>
          <p className="text-[14px] uppercase tracking-wide text-[#6B7280]">Last contacted</p>
          <p className="text-[22px] font-semibold">
            {metrics.lastContactDate ? formatDisplayDate(metrics.lastContactDate) : "—"}
          </p>
          <p className="text-sm text-[#6B7280]">
            {metrics.lastContactDate ? formatRelativeDays(metrics.daysSinceLast) : "No interactions yet"}
          </p>
        </div>
        <div className={`${sectionCardClass} space-y-1`}>
          <p className="text-[14px] uppercase tracking-wide text-[#6B7280]">Ideal frequency</p>
          <p className="text-[22px] font-semibold">
            {person?.ideal_contact_frequency_days ?? "—"} days
          </p>
          <p className="text-sm text-[#6B7280]">Update in the details form</p>
        </div>
        <div className={`${sectionCardClass} space-y-1`}>
          <p className="text-[14px] uppercase tracking-wide text-[#6B7280]">Next contact</p>
          <p className="text-[22px] font-semibold">
            {metrics.nextContactDate ? formatDisplayDate(metrics.nextContactDate) : "—"}
          </p>
          <p className={`text-sm ${metrics.isOverdue ? "text-red-600" : "text-[#6B7280]"}`}>
            {metrics.nextContactDate
              ? metrics.daysUntilNext !== null && metrics.daysUntilNext < 0
                ? `${Math.abs(metrics.daysUntilNext)} day${Math.abs(metrics.daysUntilNext) === 1 ? "" : "s"} overdue`
                : metrics.daysUntilNext === 0
                  ? "Due today"
                  : `in ${metrics.daysUntilNext} day${metrics.daysUntilNext === 1 ? "" : "s"}`
              : "Log an interaction"}
          </p>
        </div>
      </div>

      <form onSubmit={savePersonDetails} className={`${sectionCardClass} space-y-6`}>
        <h2 className={sectionTitleClass}>Person details</h2>
        <div>
          <label className={labelClass}>Name</label>
          <input
            value={personForm.name}
            onChange={(e) => setPersonForm((prev) => ({ ...prev, name: e.target.value }))}
            className={`${inputBaseClass} mt-2`}
          />
        </div>
        <div>
          <label className={labelClass}>Context</label>
          <textarea
            value={personForm.context}
            onChange={(e) => setPersonForm((prev) => ({ ...prev, context: e.target.value }))}
            className={`${inputBaseClass} mt-2 min-h-[120px]`}
          />
        </div>
        <div>
          <label className={labelClass}>Ideal contact frequency (days)</label>
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
            className={`${inputBaseClass} mt-2`}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={primaryButtonClass} disabled={personSaving}>
            {personSaving ? "Saving…" : "Save details"}
          </button>
          <button type="button" onClick={deletePerson} className={dangerButtonClass}>
            Delete person
          </button>
        </div>
      </form>

      <div className={`${sectionCardClass} flex flex-col gap-4 md:flex-row md:items-center md:justify-between`}>
        <div>
          <h2 className={sectionTitleClass}>Quick voice note</h2>
          <p className="text-sm text-[#6B7280]">Capture a thought right after the conversation.</p>
        </div>
        {status === "idle" ? (
          <button type="button" onClick={startRecording} className={primaryButtonClass}>
            Record note
          </button>
        ) : status === "recording" ? (
          <button type="button" onClick={stopRecording} className={`${primaryButtonClass} bg-red-600 hover:bg-red-700`}>
            Stop recording
          </button>
        ) : (
          <button type="button" disabled className={`${secondaryButtonClass} text-[#6B7280]`}>
            Saving…
          </button>
        )}
      </div>

      <form onSubmit={addInteraction} className={`${sectionCardClass} space-y-6`}>
        <h2 className={sectionTitleClass}>Log an interaction</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className={labelClass}>Date</label>
            <input
              type="date"
              value={interactionForm.date}
              onChange={(e) => setInteractionForm((prev) => ({ ...prev, date: e.target.value }))}
              className={`${inputBaseClass} mt-2`}
            />
          </div>
          <div>
            <label className={labelClass}>Type</label>
            <select
              value={interactionForm.type}
              onChange={(e) => setInteractionForm((prev) => ({ ...prev, type: e.target.value }))}
              className={`${inputBaseClass} mt-2`}
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
          <label className={labelClass}>Notes</label>
          <textarea
            value={interactionForm.notes}
            onChange={(e) => setInteractionForm((prev) => ({ ...prev, notes: e.target.value }))}
            className={`${inputBaseClass} mt-2 min-h-[120px]`}
            placeholder="What did you talk about?"
          />
        </div>
        <div className="flex justify-end">
          <button type="submit" className={primaryButtonClass} disabled={interactionSaving}>
            {interactionSaving ? "Saving…" : "Add interaction"}
          </button>
        </div>
      </form>

      <div className={`${sectionCardClass} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={sectionTitleClass}>Interaction timeline</h2>
          <p className="text-sm text-[#6B7280]">Newest first</p>
        </div>
        <ul className="space-y-4">
          {interactions.map((i) => {
            const parsedDate = parseDateOrNull(i.date);
            const typeLabel = interactionTypeOptions.find((opt) => opt.value === i.type)?.label ?? i.type ?? "Interaction";
            const relative = relativeLabelForDate(i.date);
            return (
              <li key={i.id} className="rounded-lg border border-[#E5E7EB] p-4">
                <div className="flex flex-wrap justify-between gap-2 text-sm text-[#6B7280]">
                  <span className="font-medium text-[#1A1A1A]">
                    {formatDisplayDate(parsedDate)} • {typeLabel}
                  </span>
                  {relative && <span>{relative}</span>}
                </div>
                {i.notes && <p className="mt-2 whitespace-pre-wrap text-base text-[#1A1A1A]">{i.notes}</p>}
                {i.voiceNotes.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {i.voiceNotes.map((note) => (
                      <div key={note.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <audio controls src={note.src} className="w-full" />
                        {typeof note.duration_seconds === "number" && (
                          <span className="text-xs text-[#6B7280]">{note.duration_seconds}s</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
          {interactions.length === 0 && (
            <li className="rounded-lg border border-dashed border-[#E5E7EB] p-4 text-sm text-[#6B7280]">
              No interactions yet. Add your first one above to start tracking your relationship.
            </li>
          )}
        </ul>
      </div>
      
      {id && <PersonVoiceNotes personId={id} />}


      <div className={`${sectionCardClass} space-y-6`}>
        <h2 className={sectionTitleClass}>Notes</h2>
        <div className="space-y-3">
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Jot down a thought about this person…"
            className={`${inputBaseClass} min-h-[120px]`}
          />
          <div className="flex justify-end">
            <button type="button" onClick={addNote} className={primaryButtonClass} disabled={!noteDraft.trim()}>
              Save note
            </button>
          </div>
        </div>

        <ul className="space-y-4">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border border-[#E5E7EB] p-4">
              {editingId === note.id ? (
                <div className="space-y-3">
                  <textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    className={`${inputBaseClass} min-h-[120px]`}
                  />
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={saveEdit} className={primaryButtonClass} disabled={!editingText.trim()}>
                      Save
                    </button>
                    <button type="button" onClick={cancelEdit} className={secondaryButtonClass}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="whitespace-pre-wrap text-base text-[#1A1A1A]">{note.body}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B7280]">
                    <span>Added {note.created_at}</span>
                    {note.updated_at && <span>Updated {note.updated_at}</span>}
                  </div>
                  <div className="flex gap-4 text-sm font-medium">
                    <button type="button" onClick={() => beginEdit(note)} className="text-[#3A6FF8]">
                      Edit
                    </button>
                    <button type="button" onClick={() => deleteNote(note.id)} className="text-red-600">
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {notes.length === 0 && (
            <li className="rounded-lg border border-dashed border-[#E5E7EB] p-4 text-sm text-[#6B7280]">
              No notes yet. Use the box above to capture something memorable.
            </li>
          )}
        </ul>
      </div>
    </PageLayout>
  );
}
