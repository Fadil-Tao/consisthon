"use client";

import type { Checkin } from "@/db/schema";
import { addDays, dateLabel } from "@/lib/domain";

export function Heatmap({
  entries,
  today,
  weeks = 32,
  onSelect,
}: {
  entries: Checkin[];
  today: string;
  weeks?: number;
  onSelect: (entry: Checkin) => void;
}) {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const end = addDays(today, 6 - weekday);
  const start = addDays(end, -(weeks * 7 - 1));
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
  const byDate = new Map(entries.map((c) => [c.date, c]));
  const months = days
    .filter((_, i) => i % 7 === 0)
    .map((date, i, all) =>
      i === 0 || date.slice(0, 7) !== all[i - 1].slice(0, 7)
        ? new Date(`${date}T12:00:00Z`).toLocaleDateString("en", {
            month: "short",
            timeZone: "UTC",
          })
        : "",
    );
  return (
    <div>
      <div className="overflow-x-auto pb-2" dir="rtl">
        <div className="inline-flex gap-3" dir="ltr">
          <div className="grid grid-rows-7 gap-1 pt-6 text-[8px] text-muted-foreground">
            <span />
            <span>Mon</span>
            <span />
            <span>Wed</span>
            <span />
            <span>Fri</span>
            <span />
          </div>
          <div>
            <div
              className="mb-2 grid gap-1 text-[8px] text-muted-foreground"
              style={{ gridTemplateColumns: `repeat(${weeks}, 13px)` }}
            >
              {months.map((month, i) => (
                <span key={addDays(start, i * 7)} className="overflow-visible">
                  {month}
                </span>
              ))}
            </div>
            <div className="heatmap">
              {days.map((day) => {
                const entry = byDate.get(day);
                return (
                  <button
                    type="button"
                    className="heat-cell transition-transform enabled:hover:scale-125"
                    key={day}
                    data-level={entry ? Math.min(entry.level + 2, 4) : 0}
                    data-future={day > today}
                    disabled={!entry}
                    aria-label={`${dateLabel(day, true)}: ${entry ? `${entry.points} points. Open proof.` : day > today ? "Upcoming day" : "No check-in"}`}
                    title={`${dateLabel(day, true)} · ${entry ? `${entry.points} points — ${entry.title}` : "No check-in"}`}
                    onClick={() => {
                      if (entry) onSelect(entry);
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-[9px] text-muted-foreground">
        <span>Select a filled square to view proof.</span>
        <span className="flex items-center gap-1.5">
          Less
          {[0, 1, 2, 3, 4].map((level) => (
            <span
              className="heat-cell !size-2.5"
              data-level={level}
              key={level}
            />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
