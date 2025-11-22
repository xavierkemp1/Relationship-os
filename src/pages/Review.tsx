// src/pages/Review.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDb } from "../lib/db";
import PageLayout, {
  sectionCardClass,
  sectionTitleClass,
} from "../components/PageLayout";
import { Button } from "@/components/ui/button";
import { formatDisplayDate } from "../lib/contactDates";

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
          const lastMs =
            typeof p.last === "string" ? Date.parse(p.last) : NaN;
          const hasValidLast = Number.isFinite(lastMs);
          const daysSince = hasValidLast
            ? Math.max(0, Math.round((now - lastMs) / 86_400_000))
            : null;
          const recency = daysSince === null ? null : Math.min(60, daysSince);
          const recencyForScore = recency ?? 60;
          const score =
            p.importance * 10 + recencyForScore + p.open_loops * 15;
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

  const formatLast = (last: string | null) => {
    if (!last) return "No interactions yet";
    const d = new Date(last);
    if (Number.isNaN(d.getTime())) return "Last: —";
    return `Last: ${formatDisplayDate(d)}`;
  };

  const formatOpenLoops = (count: number) => {
    if (count === 0) return "No open loops";
    if (count === 1) return "1 open loop";
    return `${count} open loops`;
  };

  const formatRecency = (recency: number | null) => {
    if (recency === null) return "Recency: —";
    return `Recency: ${recency}d`;
  };

  return (
    <PageLayout
      title="Weekly review"
      description="A quick look at the five relationships that deserve focus this week."
      backLink={{ to: "/people", label: "People" }}
    >
      <div className={sectionCardClass}>
        <h2 className={sectionTitleClass}>Top priorities</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Based on importance, recency, and open loops.
        </p>
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/80 p-4"
            >
              <div>
                <p className="text-[16px] font-semibold text-foreground">
                  {r.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatLast(r.last)} • {formatOpenLoops(r.open_loops)} •{" "}
                  {formatRecency(r.recency)}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to={`/person/${r.id}`}>Open</Link>
              </Button>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              Loading review data…
            </li>
          )}
        </ul>
      </div>
    </PageLayout>
  );
}
