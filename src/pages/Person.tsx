import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { v4 as uuid } from "uuid";
import { getDb } from "../lib/db";
import { recordVoice } from "../lib/audio";

type PersonRow = { id: string; name: string; context?: string };
type InteractionRow = { id: string; occurred_at: string };

export default function Person() {
  const { id } = useParams();
  const [person, setPerson] = useState<PersonRow | null>(null);
  const [interactions, setInteractions] = useState<InteractionRow[]>([]);
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [status, setStatus] = useState<"idle" | "recording">("idle");
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
      setPerson(p ?? null);
      setInteractions(ints);
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
      rec?.stop();
    };
  }, [rec]);

  const startRecording = async () => {
    if (!id) return;
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
          setRec(null);
          setStatus("idle");
        }
      });
      setRec(recorder);
      setStatus("recording");
    } catch (e: any) {
      console.error("Record failed", e);
      setStatus("idle");
      setError(e?.message ?? "Unable to start recording");
    }
  };

  const stopRecording = () => {
    rec?.stop();
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
        ) : (
          <button onClick={stopRecording} className="px-4 py-2 rounded bg-red-600 text-white">Stop</button>
        )}
      </div>

      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

      <h3 className="text-xl font-semibold mt-8 mb-2">Interactions</h3>
      <ul className="space-y-3">
        {interactions.map((i) => (
          <li key={i.id} className="border rounded p-3">
            <div className="text-sm text-gray-500">{i.occurred_at}</div>
            {/* later: summary, mood, next step */}
          </li>
        ))}
      </ul>
    </div>
  );
}
