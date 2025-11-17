import { useEffect, useState } from "react";
import { VoiceNoteRecorder } from "./VoiceNoteRecorder";
import { sectionCardClass, sectionTitleClass } from "./PageLayout";
import {
  uploadVoiceNote,
  listVoiceNotes,
  deleteVoiceNote,
  type VoiceNote,
} from "../lib/supabaseVoiceNotes";

type Props = {
  personId: string;
};

export function PersonVoiceNotes({ personId }: Props) {
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotes = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listVoiceNotes(personId);
      setNotes(result);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to load voice notes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [personId]);

  const handleSave = async (blob: Blob) => {
    setSaving(true);
    setError(null);
    try {
      const note = await uploadVoiceNote(personId, blob);
      setNotes((prev) => [note, ...prev]);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to save voice note (are you logged in?)");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (note: VoiceNote) => {
    setError(null);
    try {
      await deleteVoiceNote(note);
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to delete voice note");
    }
  };

  return (
    <div className={`${sectionCardClass} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={sectionTitleClass}>Cloud voice notes</h2>
        <p className="text-sm text-[#6B7280]">
          Saved privately in Supabase for this person.
        </p>
      </div>

      <VoiceNoteRecorder onSave={handleSave} />

      {saving && (
        <p className="text-sm text-[#6B7280]">Saving…</p>
      )}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-[#374151]">Previous notes</h3>
        {loading ? (
          <p className="text-sm text-[#6B7280]">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-[#6B7280]">No voice notes yet.</p>
        ) : (
          <ul className="space-y-3">
            {notes.map((note) => (
              <li
                key={note.id}
                className="flex flex-col gap-2 rounded-md border border-[#E5E7EB] p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <audio controls src={note.playbackUrl} className="w-full sm:w-64" />
                  <span className="text-xs text-[#6B7280]">
                    {new Date(note.created_at).toLocaleString()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(note)}
                  className="self-start text-xs font-medium text-red-600 hover:text-red-700"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
