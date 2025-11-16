// src/pages/People.tsx
import { useEffect, useState } from "react";
import { v4 as uuid } from "uuid";
import { getDb } from "../lib/db";
import { useNavigate } from "react-router-dom";

type Person = { id: string; name: string; context?: string; importance?: number };

export default function People() {
  const [name, setName] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = async () => {
    try {
      setLoading(true);
      setErr(null);
      const db = await getDb();
      const rows = await db.select<Person[]>(
        "SELECT id, name, context, importance FROM people ORDER BY created_at DESC",
        []
      );
      setPeople(rows);
    } catch (e: any) {
      console.error("Load people failed:", e);
      setErr(e?.message ?? "Failed to load people.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    try {
      setErr(null);
      const trimmed = name.trim();
      if (!trimmed) return;
      const db = await getDb();
      await db.execute("INSERT INTO people (id, name) VALUES (?, ?)", [uuid(), trimmed]);
      setName("");
      await load();
    } catch (e: any) {
      console.error("Add person failed:", e);
      setErr(e?.message ?? "Failed to add person.");
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">People</h2>

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add someone…"
          className="border rounded px-3 py-2 flex-1"
        />
        <button onClick={add} className="px-3 py-2 rounded bg-black text-white">
          Add
        </button>
        <button onClick={() => navigate(-1)} className="text-blue-600">← Back</button>
      </div>

      {err && <div className="mt-3 text-sm text-red-600">Error: {err}</div>}
      {loading && <div className="mt-3 text-sm text-gray-500">Loading…</div>}

      <ul className="mt-6 space-y-2">
        {people.map((p) => (
          <li key={p.id} className="border rounded p-3 flex justify-between items-center">
            <div>
              <div className="font-medium">{p.name}</div>
              {p.context && <div className="text-sm text-gray-500">{p.context}</div>}
            </div>
            <button
              className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200"
              onClick={() => navigate(`/person/${p.id}`)}
            >
              Open
            </button>
          </li>
        ))}
        {people.length === 0 && !loading && (
          <li className="text-sm text-gray-500">No people yet — add someone to start.</li>
        )}
      </ul>
    </div>
  );
}
