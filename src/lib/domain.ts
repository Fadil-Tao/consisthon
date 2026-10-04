import type { Checkin, Goal, PointLevel, Room } from "@/db/schema";

export const DEFAULT_LEVELS: PointLevel[] = [
  {
    name: "Showed up",
    points: 10,
    requirement: "A screenshot, photo, or link showing your daily action.",
  },
  {
    name: "Made progress",
    points: 25,
    requirement:
      "Proof of a finished task or meaningful progress on your project.",
  },
  {
    name: "Went beyond",
    points: 50,
    requirement:
      "A shipped milestone, completed session, or result that goes beyond your daily goal.",
  },
];

export function todayIn(timezone = "Asia/Makassar", now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string) {
  return Math.max(
    0,
    Math.round(
      (Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) /
        86_400_000,
    ),
  );
}

export function dateLabel(date: string, year = false) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    ...(year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function roomStatus(
  room: Pick<Room, "startDate" | "endDate">,
  today: string,
) {
  return today < room.startDate
    ? "upcoming"
    : room.endDate && today > room.endDate
      ? "ended"
      : "active";
}

export function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  }).format(amount / 100);
}

// Daily proof drives streaks; weekly/monthly goals are milestones, never extra scoring opportunities.
export function memberStats(
  entries: Pick<Checkin, "date" | "points">[],
  goal: Pick<Goal, "startDate" | "endDate"> | null,
  today: string,
  fine: number,
) {
  const dates = new Set(entries.map((c) => c.date));
  const sorted = [...dates].sort();
  let bestStreak = 0;
  let run = 0;
  let previous = "";
  for (const date of sorted) {
    run = previous && addDays(previous, 1) === date ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    previous = date;
  }
  const lastDay = goal?.endDate && goal.endDate < today ? goal.endDate : today;
  let cursor = dates.has(lastDay) ? lastDay : addDays(lastDay, -1);
  let streak = 0;
  while (dates.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  const yesterday = addDays(today, -1);
  const closedEnd =
    goal?.endDate && goal.endDate < yesterday ? goal.endDate : yesterday;
  const expected =
    goal && closedEnd >= goal.startDate
      ? daysBetween(goal.startDate, closedEnd) + 1
      : 0;
  const completed = goal
    ? sorted.filter((d) => d >= goal.startDate && d <= closedEnd).length
    : 0;
  const missedDays = Math.max(0, expected - completed);
  return {
    points: entries.reduce((sum, c) => sum + c.points, 0),
    streak,
    bestStreak,
    checkins: dates.size,
    missedDays,
    fines: missedDays * fine,
    consistency: expected
      ? Math.round((completed / expected) * 100)
      : dates.size
        ? 100
        : 0,
    checkedInToday: dates.has(today),
  };
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}
