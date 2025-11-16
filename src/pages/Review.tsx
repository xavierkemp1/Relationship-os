import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDb } from "../lib/db";

type Row = {
  id: string;
  name: string;
  importance: number;
  last: string | null;
  open_loops: number;
  recency: number | null;
  score: number;
};

export default function Review() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const people = await db.select<any[]>(
        `SELECT p.id, p.name, COALESCE(p.importance,3) as importance,
          (SELECT date FROM interactions i WHERE i.person_id=p.id ORDER BY date DESC LIMIT 1) as last,
          (SELECT COUNT(1) FROM commitments c WHERE c.person_id=p.id AND c.status='open' AND (c.due_date IS NULL OR c.due_date <= datetime('now','+7 day'))) as open_loops
        FROM people p`
      );

      const now = Date.now();
      const scored = people
        .map((p: any) => {
          const lastMs = typeof p.last === "string" ? Date.parse(p.last) : NaN;
          const hasValidLast = Number.isFinite(lastMs);
          const daysSince = hasValidLast ? Math.max(0, Math.round((now - lastMs) / 86_400_000)) : null;
          const recency = daysSince === null ? null : Math.min(60, daysSince);
          const recencyForScore = recency ?? 60;
          const score = p.importance * 10 + recencyForScore + p.open_loops * 15;
          return {
            id: p.id,
            name: p.name,
            importance: p.importance,
            last: hasValidLast ? p.last : null,
            open_loops: p.open_loops,
            recency,
            score,
          } as Row;
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      setRows(scored);
    })();
  }, []);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Weekly Review — Top 5</h2>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="border rounded p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{r.name}</div>
              <div className="text-sm text-gray-500">
                {r.last ? `Last: ${r.last}` : "No interactions yet"} • {r.open_loops} open loops •
                {" "}
                {r.recency !== null ? `${r.recency}d` : "—"}
              </div>
            </div>
            <Link className="text-blue-600" to={`/person/${r.id}`}>
              Open
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
