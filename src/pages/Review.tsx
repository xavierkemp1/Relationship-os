import { useEffect, useState } from "react";
import { getDb } from "../lib/db";

type Row = { id:string; name:string; importance:number; last: string|null; open_loops:number; recency:number; score:number; };

export default function Review() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const people = await db.select<any[]>(
        `SELECT p.id, p.name, COALESCE(p.importance,3) as importance,
          (SELECT occurred_at FROM interactions i WHERE i.person_id=p.id ORDER BY occurred_at DESC LIMIT 1) as last,
          (SELECT COUNT(1) FROM commitments c WHERE c.person_id=p.id AND c.status='open' AND (c.due_date IS NULL OR c.due_date <= datetime('now','+7 day'))) as open_loops
        FROM people p`
      );

      const now = Date.now();
      const scored = people.map((p:any) => {
        const lastMs = p.last ? Date.parse(p.last) : 0;
        const recency = Math.min(60, Math.round((now - (lastMs||0)) / (1000*60*60*24)) || 60);
        const score = (p.importance*10) + recency + (p.open_loops*15);
        return { id:p.id, name:p.name, importance:p.importance, last:p.last, open_loops:p.open_loops, recency, score };
      }).sort((a,b)=>b.score-a.score).slice(0,5);

      setRows(scored);
    })();
  }, []);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Weekly Review — Top 5</h2>
      <ul className="space-y-3">
        {rows.map(r=>(
          <li key={r.id} className="border rounded p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{r.name}</div>
              <div className="text-sm text-gray-500">
                {r.last ? `Last: ${r.last}` : "No interactions yet"} • {r.open_loops} open loops • {r.recency}d
              </div>
            </div>
            <a className="text-blue-600" href={`/person/${r.id}`}>Open</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
