// src/pages/People.tsx
import { FormEvent, useEffect, useMemo, useState } from "react";
import { v4 as uuid } from "uuid";
import { getDb } from "../lib/db";
import { Link, useNavigate } from "react-router-dom";
import {
  calculateContactSchedule,
  formatDisplayDate,
  formatRelativeDays,
} from "../lib/contactDates";
import {
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Filter,
  UserPlus,
} from "lucide-react";
import PageLayout, {
  inputBaseClass,
  labelClass,
  sectionCardClass,
  sectionTitleClass,
} from "../components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  const add = async (event?: FormEvent) => {
    event?.preventDefault();
    try {
      setErr(null);
      const trimmed = name.trim();
      if (!trimmed) return;
      const db = await getDb();
      await db.execute("INSERT INTO people (id, name) VALUES (?, ?)", [
        uuid(),
        trimmed,
      ]);
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
          const aVal =
            a.metrics.nextContactDate?.getTime() ??
            Number.POSITIVE_INFINITY;
          const bVal =
            b.metrics.nextContactDate?.getTime() ??
            Number.POSITIVE_INFINITY;
          return aVal - bVal;
        }
        if (a.metrics.isOverdue !== b.metrics.isOverdue) {
          return a.metrics.isOverdue ? -1 : 1;
        }
        const aDelta =
          a.metrics.daysUntilNext ?? Number.POSITIVE_INFINITY;
        const bDelta =
          b.metrics.daysUntilNext ?? Number.POSITIVE_INFINITY;
        return aDelta - bDelta;
      });
  }, [people, showOverdueOnly, sortMode]);

  return (
    <PageLayout
      title="People"
      description="Keep everyone in one place, monitor contact cadence, and open a profile when it’s time to reconnect."
      actions={
        <Button asChild variant="outline" className="gap-2 text-sm">
          <Link to="/review">
            <span>Weekly review</span>
            <ArrowUpRight className="ml-1 h-4 w-4" aria-hidden />
          </Link>
        </Button>
      }
    >
      {/* Add person */}
      <form onSubmit={add} className={`${sectionCardClass} space-y-4`}>
        <div>
          <label className={labelClass}>Add someone</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="mt-2"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Add a name to start tracking interactions and reminders.
          </p>
          <Button type="submit" className="gap-2" size="sm">
            <UserPlus className="h-4 w-4" aria-hidden />
            Add person
          </Button>
        </div>
      </form>

      {/* Filters */}
      <div className={`${sectionCardClass} space-y-4`}>
        <h2 className={`${sectionTitleClass} flex items-center gap-2`}>
          <Filter className="h-5 w-5 text-primary" aria-hidden />
          Sort & filters
        </h2>
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex-1">
            <label className={labelClass}>Sort by</label>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className={`${inputBaseClass} mt-2`}
            >
              <option value="name">Name</option>
              <option value="last_contact">Last contacted</option>
              <option value="next_contact">Next contact</option>
              <option value="overdue">Overdue first</option>
            </select>
          </div>
          <label className="flex items-center gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
              checked={showOverdueOnly}
              onChange={(e) => setShowOverdueOnly(e.target.checked)}
            />
            Show only overdue
          </label>
        </div>
        {err && <div className="text-sm text-red-600">Error: {err}</div>}
        {loading && (
          <div className="text-sm text-muted-foreground">Loading…</div>
        )}
      </div>

      {/* People list */}
      <div className={`${sectionCardClass} space-y-4`}>
        <h2 className={sectionTitleClass}>People list</h2>
        <p className="text-sm text-muted-foreground">
          Profiles display last and next contact details so you can scan the
          state of your relationships at a glance.
        </p>
        <div className="mt-2 space-y-4">
          {decorated.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[18px] font-semibold text-foreground">
                      {p.name}
                    </div>
                    {p.context && (
                      <p className="text-sm text-muted-foreground">
                        {p.context}
                      </p>
                    )}
                  </div>
                </div>
                {p.metrics.isOverdue && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-600">
                    <AlertCircle className="h-4 w-4" aria-hidden />
                    Overdue
                  </span>
                )}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {/* Last contact */}
                <div className="rounded-xl border border-border bg-muted/50 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Clock3
                      className="h-4 w-4 text-primary"
                      aria-hidden
                    />
                    Last contact
                  </div>
                  <div className="mt-2 text-[16px] font-medium text-foreground">
                    {p.metrics.lastContactDate
                      ? formatDisplayDate(p.metrics.lastContactDate)
                      : "No interactions yet"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {p.metrics.lastContactDate
                      ? formatRelativeDays(p.metrics.daysSinceLast)
                      : "Log the first touchpoint"}
                  </div>
                </div>

                {/* Next contact */}
                <div className="rounded-xl border border-border bg-muted/50 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <CalendarDays
                      className="h-4 w-4 text-primary"
                      aria-hidden
                    />
                    Next contact
                  </div>
                  <div className="mt-2 text-[16px] font-medium text-foreground">
                    {p.metrics.nextContactDate
                      ? formatDisplayDate(p.metrics.nextContactDate)
                      : "Add a plan"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {p.metrics.daysUntilNext !== null
                      ? p.metrics.daysUntilNext < 0
                        ? `${Math.abs(
                            p.metrics.daysUntilNext
                          )} day${
                            Math.abs(p.metrics.daysUntilNext) === 1
                              ? ""
                              : "s"
                          } overdue`
                        : p.metrics.daysUntilNext === 0
                        ? "Due today"
                        : `in ${p.metrics.daysUntilNext} day${
                            p.metrics.daysUntilNext === 1 ? "" : "s"
                          }`
                      : ""}
                  </div>
                </div>

                {/* Actions */}
                <div className="rounded-xl border border-dashed border-border bg-background p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Actions
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Jump into the profile to log interactions, update context,
                    and capture commitments.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4 w-full justify-between"
                    onClick={() => navigate(`/person/${p.id}`)}
                  >
                    Open person
                    <ArrowUpRight className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {decorated.length === 0 && !loading && (
            <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
              No people match the current filters.
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
