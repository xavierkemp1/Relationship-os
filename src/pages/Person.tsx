// src/pages/Person.tsx
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { v4 as uuid } from "uuid";
import { getDb } from "../lib/db";
import { PersonVoiceNotes } from "../components/PersonVoiceNotes";
import { createInteractionWithAI } from "../lib/interactions";
import { supabase } from "../lib/supabaseClient";

import {
  calculateScheduleFromInteractions,
  formatDisplayDate,
  formatRelativeDays,
} from "../lib/contactDates";
import { InteractionCard } from "../components/InteractionCard";
import PageLayout, {
  inputBaseClass,
  labelClass,
  sectionCardClass,
  sectionTitleClass,
} from "../components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
type InteractionRow = {
  id: string;
  date: string;
  type: string | null;
  notes: string | null;
};
type PersonNoteRow = {
  id: string;
  body: string;
  created_at: string;
  updated_at: string | null;
};
type Interaction = InteractionRow;
type AiInteraction = {
  id: string;
  happened_at: string;
  raw_text: string;
  summary: string | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  ai_next_steps: {
    follow_up_ideas?: string[];
    things_to_remember?: string[];
  } | null;
};

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
  const [interactionForm, setInteractionForm] =
    useState<InteractionFormState>({
      date: todayInputValue(),
      type: interactionTypeOptions[0]?.value ?? "call",
      notes: "",
    });
  const [interactionSaving, setInteractionSaving] = useState(false);
  const [notes, setNotes] = useState<PersonNoteRow[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState("");
  const [aiSaving, setAiSaving] = useState(false);
  const [aiInteractions, setAiInteractions] = useState<AiInteraction[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    try {
      setError(null);
      const db = await getDb();
      const [p, ints, personNotes] = await Promise.all([
        db
          .select<PersonRow[]>("SELECT * FROM people WHERE id = ?", [id])
          .then((rows) => rows[0]),
        db.select<InteractionRow[]>(
          "SELECT id, date, type, notes FROM interactions WHERE person_id=? ORDER BY date DESC",
          [id]
        ),
        db.select<PersonNoteRow[]>(
          "SELECT * FROM person_notes WHERE person_id=? ORDER BY created_at DESC",
          [id]
        ),
      ]);
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
      setInteractions(ints);
      setNotes(personNotes);
      setInteractionForm((prev) => ({
        ...prev,
        date: todayInputValue(),
      }));
    } catch (e: any) {
      console.error("Load person failed", e);
      setError(e?.message ?? "Failed to load person");
    }
  };

  const loadAiInteractions = async () => {
    if (!id) return;
    try {
      setAiLoading(true);
      setAiError(null);
      const { data, error: loadError } = await supabase
        .from("interactions")
        .select("*")
        .eq("person_id", id)
        .order("happened_at", { ascending: false });

      if (loadError) {
        throw loadError;
      }

      setAiInteractions((data as AiInteraction[]) ?? []);
    } catch (e: any) {
      console.error("Load AI interactions failed", e);
      setAiError(e?.message ?? "Failed to load AI interactions");
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadAiInteractions();
  }, [id]);

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
      await db.execute(
        "UPDATE people SET name=?, context=?, ideal_contact_frequency_days=? WHERE id=?",
        [trimmedName, personForm.context.trim() || null, freq, id]
      );
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
    const confirmDelete = window.confirm(
      "Delete this person and all their data?"
    );
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

  const addAiInteraction = async (event: FormEvent) => {
    event.preventDefault();
    if (!id) return;
    const trimmed = aiNote.trim();
    if (!trimmed || aiSaving) return;
    try {
      setAiSaving(true);
      setAiError(null);
      const newInteraction = await createInteractionWithAI(id, trimmed);
      setAiNote("");
      setAiInteractions((prev) => [newInteraction as AiInteraction, ...prev]);
    } catch (e: any) {
      console.error("Add AI interaction failed", e);
      setAiError(
        e?.message ?? "Failed to add interaction (are you signed in?)"
      );
    } finally {
      setAiSaving(false);
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
      const isoDate = new Date(
        `${interactionForm.date}T00:00:00`
      ).toISOString();
      await db.execute(
        "INSERT INTO interactions (id, person_id, date, type, notes) VALUES (?,?,?,?,?)",
        [
          interactionId,
          id,
          isoDate,
          interactionForm.type,
          interactionForm.notes.trim() || null,
        ]
      );
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

  const addNote = async () => {
    if (!id) return;
    const body = noteDraft.trim();
    if (!body) return;
    try {
      setError(null);
      const db = await getDb();
      await db.execute(
        "INSERT INTO person_notes (id, person_id, body) VALUES (?,?,?)",
        [uuid(), id, body]
      );
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
      await db.execute(
        "UPDATE person_notes SET body=?, updated_at=datetime('now') WHERE id=?",
        [body, editingId]
      );
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
      description={
        person?.context ||
        "Log interactions, track reminders, and keep richer history."
      }
    >
      {error && <div className="text-sm text-red-600">{error}</div>}

      {/* Metrics cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className={`${sectionCardClass} space-y-1`}>
          <p className="text-[14px] uppercase tracking-wide text-muted-foreground">
            Last contacted
          </p>
          <p className="text-[22px] font-semibold text-foreground">
            {metrics.lastContactDate
              ? formatDisplayDate(metrics.lastContactDate)
              : "—"}
          </p>
          <p className="text-sm text-muted-foreground">
            {metrics.lastContactDate
              ? formatRelativeDays(metrics.daysSinceLast)
              : "No interactions yet"}
          </p>
        </div>
        <div className={`${sectionCardClass} space-y-1`}>
          <p className="text-[14px] uppercase tracking-wide text-muted-foreground">
            Ideal frequency
          </p>
          <p className="text-[22px] font-semibold text-foreground">
            {person?.ideal_contact_frequency_days ?? "—"} days
          </p>
          <p className="text-sm text-muted-foreground">
            Update in the details form
          </p>
        </div>
        <div className={`${sectionCardClass} space-y-1`}>
          <p className="text-[14px] uppercase tracking-wide text-muted-foreground">
            Next contact
          </p>
          <p className="text-[22px] font-semibold text-foreground">
            {metrics.nextContactDate
              ? formatDisplayDate(metrics.nextContactDate)
              : "—"}
          </p>
          <p
            className={`text-sm ${
              metrics.isOverdue ? "text-red-600" : "text-muted-foreground"
            }`}
          >
            {metrics.nextContactDate
              ? metrics.daysUntilNext !== null &&
                metrics.daysUntilNext < 0
                ? `${Math.abs(metrics.daysUntilNext)} day${
                    Math.abs(metrics.daysUntilNext) === 1 ? "" : "s"
                  } overdue`
                : metrics.daysUntilNext === 0
                ? "Due today"
                : `in ${metrics.daysUntilNext} day${
                    metrics.daysUntilNext === 1 ? "" : "s"
                  }`
              : "Log an interaction"}
          </p>
        </div>
      </div>

      {/* AI-powered interactions */}
      <div className={`${sectionCardClass} space-y-6`}>
        <div className="space-y-1">
          <h2 className={sectionTitleClass}>AI-powered interactions</h2>
          <p className="text-sm text-muted-foreground">
            Save a quick note and automatically get summaries, sentiment, and
            suggested next steps.
          </p>
        </div>

        <form onSubmit={addAiInteraction} className="space-y-3">
          <div>
            <label className={labelClass}>New interaction note</label>
            <Textarea
              value={aiNote}
              onChange={(e) => setAiNote(e.target.value)}
              placeholder="Had coffee with them, they mentioned their new project and seemed stressed about deadlines…"
              className="mt-2 min-h-[120px]"
            />
          </div>
          {aiError && <p className="text-sm text-red-600">{aiError}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={!aiNote.trim() || aiSaving}>
              {aiSaving ? "Saving + getting insights…" : "Save interaction"}
            </Button>
          </div>
        </form>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">
              Recent interactions
            </h3>
            {aiLoading && (
              <span className="text-sm text-muted-foreground">Loading…</span>
            )}
          </div>
          {aiInteractions.length === 0 && !aiLoading ? (
            <p className="text-sm text-muted-foreground">
              No interactions yet. Add a note above to generate AI insights.
            </p>
          ) : (
            <div className="grid gap-3">
              {aiInteractions.map((interaction) => (
                <InteractionCard
                  key={interaction.id}
                  interaction={interaction}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Person details */}
      <form
        onSubmit={savePersonDetails}
        className={`${sectionCardClass} space-y-6`}
      >
        <h2 className={sectionTitleClass}>Person details</h2>
        <div>
          <label className={labelClass}>Name</label>
          <Input
            value={personForm.name}
            onChange={(e) =>
              setPersonForm((prev) => ({
                ...prev,
                name: e.target.value,
              }))
            }
            className="mt-2"
          />
        </div>
        <div>
          <label className={labelClass}>Context</label>
          <Textarea
            value={personForm.context}
            onChange={(e) =>
              setPersonForm((prev) => ({
                ...prev,
                context: e.target.value,
              }))
            }
            className="mt-2 min-h-[120px]"
          />
        </div>
        <div>
          <label className={labelClass}>
            Ideal contact frequency (days)
          </label>
          <Input
            type="number"
            min={1}
            value={personForm.ideal_contact_frequency_days ?? ""}
            onChange={(e) =>
              setPersonForm((prev) => ({
                ...prev,
                ideal_contact_frequency_days: e.target.value
                  ? Number(e.target.value)
                  : null,
              }))
            }
            className="mt-2"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={personSaving}>
            {personSaving ? "Saving…" : "Save details"}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={deletePerson}
          >
            Delete person
          </Button>
        </div>
      </form>

      {/* Log interaction */}
      <form
        onSubmit={addInteraction}
        className={`${sectionCardClass} space-y-6`}
      >
        <h2 className={sectionTitleClass}>Log an interaction</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className={labelClass}>Date</label>
            <Input
              type="date"
              value={interactionForm.date}
              onChange={(e) =>
                setInteractionForm((prev) => ({
                  ...prev,
                  date: e.target.value,
                }))
              }
              className="mt-2"
            />
          </div>
          <div>
            <label className={labelClass}>Type</label>
            <select
              value={interactionForm.type}
              onChange={(e) =>
                setInteractionForm((prev) => ({
                  ...prev,
                  type: e.target.value,
                }))
              }
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
          <Textarea
            value={interactionForm.notes}
            onChange={(e) =>
              setInteractionForm((prev) => ({
                ...prev,
                notes: e.target.value,
              }))
            }
            className="mt-2 min-h-[120px]"
            placeholder="What did you talk about?"
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={interactionSaving}>
            {interactionSaving ? "Saving…" : "Add interaction"}
          </Button>
        </div>
      </form>

      {/* Interaction timeline */}
      <div className={`${sectionCardClass} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={sectionTitleClass}>Interaction timeline</h2>
          <p className="text-sm text-muted-foreground">Newest first</p>
        </div>
        <ul className="space-y-4">
          {interactions.map((i) => {
            const parsedDate = parseDateOrNull(i.date);
            const typeLabel =
              interactionTypeOptions.find(
                (opt) => opt.value === i.type
              )?.label ?? i.type ?? "Interaction";
            const relative = relativeLabelForDate(i.date);
            return (
              <li
                key={i.id}
                className="rounded-lg border border-border bg-background p-4"
              >
                <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {formatDisplayDate(parsedDate)} • {typeLabel}
                  </span>
                  {relative && <span>{relative}</span>}
                </div>
                {i.notes && (
                  <p className="mt-2 whitespace-pre-wrap text-base text-foreground">
                    {i.notes}
                  </p>
                )}
              </li>
            );
          })}
          {interactions.length === 0 && (
            <li className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              No interactions yet. Add your first one above to start tracking
              your relationship.
            </li>
          )}
        </ul>
      </div>

      {/* Voice notes */}
      {id && <PersonVoiceNotes personId={id} />}

      {/* Notes */}
      <div className={`${sectionCardClass} space-y-6`}>
        <h2 className={sectionTitleClass}>Notes</h2>
        <div className="space-y-3">
          <Textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Jot down a thought about this person…"
            className="min-h-[120px]"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={addNote}
              disabled={!noteDraft.trim()}
            >
              Save note
            </Button>
          </div>
        </div>

        <ul className="space-y-4">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-lg border border-border bg-background p-4"
            >
              {editingId === note.id ? (
                <div className="space-y-3">
                  <Textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    className="min-h-[120px]"
                  />
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={saveEdit}
                      disabled={!editingText.trim()}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={cancelEdit}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="whitespace-pre-wrap text-base text-foreground">
                    {note.body}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>Added {note.created_at}</span>
                    {note.updated_at && (
                      <span>Updated {note.updated_at}</span>
                    )}
                  </div>
                  <div className="flex gap-4 text-sm font-medium">
                    <button
                      type="button"
                      onClick={() => beginEdit(note)}
                      className="text-primary"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteNote(note.id)}
                      className="text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {notes.length === 0 && (
            <li className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              No notes yet. Use the box above to capture something memorable.
            </li>
          )}
        </ul>
      </div>
    </PageLayout>
  );
}
