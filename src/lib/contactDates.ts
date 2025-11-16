const MS_PER_DAY = 86_400_000;

const startOfDay = (value: Date) => {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms);
};

export type ContactMetrics = {
  lastContactDate: Date | null;
  daysSinceLast: number | null;
  nextContactDate: Date | null;
  daysUntilNext: number | null;
  isOverdue: boolean;
};

const sanitizeFrequency = (frequencyDays?: number | null) => {
  if (typeof frequencyDays !== "number") return null;
  if (!Number.isFinite(frequencyDays)) return null;
  if (frequencyDays <= 0) return null;
  return Math.round(frequencyDays);
};

export const calculateContactSchedule = ({
  lastContact,
  frequencyDays,
  today = new Date(),
}: {
  lastContact: string | Date | null | undefined;
  frequencyDays?: number | null;
  today?: Date;
}): ContactMetrics => {
  const todayStart = startOfDay(today);
  const frequency = sanitizeFrequency(frequencyDays);
  const lastDate =
    typeof lastContact === "string"
      ? parseDate(lastContact)
      : lastContact instanceof Date
        ? lastContact
        : null;
  const lastDateStart = lastDate ? startOfDay(lastDate) : null;

  const daysSinceLast = lastDateStart
    ? Math.max(0, Math.round((todayStart.getTime() - lastDateStart.getTime()) / MS_PER_DAY))
    : null;

  const nextContactDate = lastDateStart && frequency ? new Date(lastDateStart.getTime() + frequency * MS_PER_DAY) : null;
  const nextContactStart = nextContactDate ? startOfDay(nextContactDate) : null;

  const daysUntilNext = nextContactStart
    ? Math.round((nextContactStart.getTime() - todayStart.getTime()) / MS_PER_DAY)
    : null;

  const isOverdue = nextContactStart ? todayStart.getTime() > nextContactStart.getTime() : false;

  return {
    lastContactDate: lastDateStart,
    daysSinceLast,
    nextContactDate: nextContactStart,
    daysUntilNext,
    isOverdue,
  };
};

export const calculateScheduleFromInteractions = ({
  interactions,
  frequencyDays,
  today,
}: {
  interactions: { date: string | null }[];
  frequencyDays?: number | null;
  today?: Date;
}) => {
  const mostRecent = interactions
    .map((i) => parseDate(i.date))
    .filter((d): d is Date => d instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  return calculateContactSchedule({ lastContact: mostRecent, frequencyDays, today });
};

export const formatDisplayDate = (date: Date | null) => {
  if (!date) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const formatRelativeDays = (days: number | null) => {
  if (days === null) return "";
  if (days === 0) return "today";
  const abs = Math.abs(days);
  return days > 0 ? `${abs} day${abs === 1 ? "" : "s"} ago` : `in ${abs} day${abs === 1 ? "" : "s"}`;
};
