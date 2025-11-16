// src/pages/People.tsx
import { useEffect, useMemo, useState } from "react";
import { v4 as uuid } from "uuid";
import { getDb } from "../lib/db";
import { useNavigate } from "react-router-dom";
import {
  calculateContactSchedule,
  formatDisplayDate,
  formatRelativeDays,
} from "../lib/contactDates";

type Person = {
  id: string;
  name: string;
  context?: string;
  importance?: number;
  ideal_contact_frequency_days: number | null;
  last_contact_date: string | null;
};

type SortMode = "name" | "last_contact" | "next_contact" | "overdue";

export default function People() {
  const [name, setName] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    try {
      setLoading(true);
      setErr(null);
      const db = await getDb();
      const rows = await db.select<Person[]>(
        `SELECT
            p.id,
            p.name,
            p.context,
            p.importance,
            p.ideal_contact_frequency_days,
            (
              SELECT date
              FROM interactions i
              WHERE i.person_id = p.id
              ORDER BY date DESC
              LIMIT 1
            ) AS last_contact_date
          FROM people p
          ORDER BY p.created_at DESC`,
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

  useEffect(() => {
    load();
  }, []);

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

  const decorated = useMemo(() => {
    return people
      .map((person) => ({
        ...person,
        metrics: calculateContactSchedule({
          lastContact: person.last_contact_date,
          frequencyDays: person.ideal_contact_frequency_days,
        }),
      }))
      .filter((row) => (showOverdueOnly ? row.metrics.isOverdue : true))
      .sort((a, b) => {
        if (sortMode === "name") {
          return a.name.localeCompare(b.name);
        }
        if (sortMode === "last_contact") {
          const aTime = a.metrics.lastContactDate?.getTime() ?? 0;
          const bTime = b.metrics.lastContactDate?.getTime() ?? 0;
          return bTime - aTime;
        }
        if (sortMode === "next_contact") {
          const aVal = a.metrics.nextContactDate?.getTime() ?? Number.POSITIVE_INFINITY;
          const bVal = b.metrics.nextContactDate?.getTime() ?? Number.POSITIVE_INFINITY;
          return aVal - bVal;
        }
        if (a.metrics.isOverdue !== b.metrics.isOverdue) {
          return a.metrics.isOverdue ? -1 : 1;
        }
        const aDelta = a.metrics.daysUntilNext ?? Number.POSITIVE_INFINITY;
        const bDelta = b.metrics.daysUntilNext ?? Number.POSITIVE_INFINITY;
        return aDelta - bDelta;
      });
  }, [people, showOverdueOnly, sortMode]);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">People</h2>

      <div className="flex gap-2 flex-wrap items-center">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add someone…"
          className="border rounded px-3 py-2 flex-1"
        />
        <button onClick={add} className="px-3 py-2 rounded bg-black text-white">
          Add
        </button>
        <button onClick={() => navigate("/", { replace: true })} className="text-blue-600">
          ← Back
        </button>
      </div>

      {err && <div className="mt-3 text-sm text-red-600">Error: {err}</div>}
      {loading && <div className="mt-3 text-sm text-gray-500">Loading…</div>}

      <div className="mt-6 flex flex-wrap gap-4 items-center text-sm">
        <label className="flex items-center gap-2">
          Sort by
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="border rounded px-2 py-1"
          >
            <option value="name">Name</option>
            <option value="last_contact">Last contacted</option>
            <option value="next_contact">Next contact</option>
            <option value="overdue">Overdue first</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showOverdueOnly}
            onChange={(e) => setShowOverdueOnly(e.target.checked)}
          />
          Show only overdue
        </label>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 border-b">Person</th>
              <th className="p-3 border-b">Last contacted</th>
              <th className="p-3 border-b">Next contact</th>
              <th className="p-3 border-b w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {decorated.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="p-3 align-top">
                  <div className="font-medium flex items-center gap-2">
                    {p.name}
                    {p.metrics.isOverdue && (
                      <span className="text-xs rounded-full bg-red-100 text-red-700 px-2 py-0.5">
                        Overdue
                      </span>
                    )}
                  </div>
                  {p.context && <div className="text-gray-500 text-xs mt-1">{p.context}</div>}
                </td>
                <td className="p-3 align-top">
                  {p.metrics.lastContactDate ? (
                    <div>
                      <div>{formatDisplayDate(p.metrics.lastContactDate)}</div>
                      <div className="text-gray-500">{formatRelativeDays(p.metrics.daysSinceLast)}</div>
                    </div>
                  ) : (
                    <span className="text-gray-400">No interactions yet</span>
                  )}
                </td>
                <td className="p-3 align-top">
                  {p.metrics.nextContactDate ? (
                    <div>
                      <div>{formatDisplayDate(p.metrics.nextContactDate)}</div>
                      <div className="text-gray-500">
                        {p.metrics.daysUntilNext !== null
                          ? p.metrics.daysUntilNext < 0
                            ? `${Math.abs(p.metrics.daysUntilNext)} day${Math.abs(p.metrics.daysUntilNext) === 1 ? "" : "s"} overdue`
                            : p.metrics.daysUntilNext === 0
                              ? "Due today"
                              : `in ${p.metrics.daysUntilNext} day${p.metrics.daysUntilNext === 1 ? "" : "s"}`
                          : ""}
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-400">Log an interaction</span>
                  )}
                </td>
                <td className="p-3">
                  <button
                    className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200"
                    onClick={() => navigate(`/person/${p.id}`)}
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
            {decorated.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-gray-500">
                  No people match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
