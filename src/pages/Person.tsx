import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { v4 as uuid } from "uuid";
import { getDb } from "../lib/db";
import { recordVoice } from "../lib/audio";

export default function Person() {
  const { id } = useParams();
  const [person, setPerson] = useState<any>(null);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [rec, setRec] = useState<MediaRecorder|null>(null);
  const [status, setStatus] = useState<"idle"|"recording">("idle");

  const load = async () => {
    const db = await getDb();
    const [p] = await db.select<any[]>("SELECT * FROM people WHERE id = ?", [id]);
    const ints = await db.select<any[]>("SELECT * FROM interactions WHERE person_id=? ORDER BY occurred_at DESC", [id]);
    setPerson(p); setInteractions(ints);
  };
  useEffect(()=>{ load(); }, [id]);

  const startRecording = async () => {
    const r = await recordVoice(async (filePath, duration) => {
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
      setStatus("idle");
      await load();
    });
    setRec(r);
    setStatus("recording");
  };

  const stopRecording = () => { rec?.stop(); };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <a href="/people" className="text-blue-600">← Back</a>
      <h2 className="text-2xl font-semibold mt-2">{person?.name}</h2>

      <div className="mt-4 flex gap-3">
        {status === "idle" ? (
          <button onClick={startRecording} className="px-4 py-2 rounded bg-black text-white">Record quick note</button>
        ) : (
          <button onClick={stopRecording} className="px-4 py-2 rounded bg-red-600 text-white">Stop</button>
        )}
      </div>

      <h3 className="text-xl font-semibold mt-8 mb-2">Interactions</h3>
      <ul className="space-y-3">
        {interactions.map((i)=>(
          <li key={i.id} className="border rounded p-3">
            <div className="text-sm text-gray-500">{i.occurred_at}</div>
            {/* later: summary, mood, next step */}
          </li>
        ))}
      </ul>
    </div>
  );
}
