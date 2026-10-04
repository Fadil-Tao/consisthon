import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDays,
  daysBetween,
  memberStats,
  roomStatus,
  todayIn,
} from "../src/lib/domain";
import { checkinInput, roomInput } from "../src/lib/validation";

test("all members use the room's timezone and calendar dates cross month boundaries", () => {
  const instant = new Date("2026-10-04T18:00:00Z");
  assert.equal(todayIn("Asia/Makassar", instant), "2026-10-05");
  assert.equal(todayIn("America/New_York", instant), "2026-10-04");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(daysBetween("2026-09-30", "2026-10-04"), 4);
  assert.equal(
    roomStatus(
      { startDate: "2026-10-04", endDate: "2026-10-04" },
      "2026-10-04",
    ),
    "active",
  );
  assert.equal(
    roomStatus({ startDate: "2026-10-04", endDate: null }, "2027-10-04"),
    "active",
  );
});

test("streak stays alive until today's deadline; fines exclude today and pre-commitment days", () => {
  const entries = [
    { date: "2026-10-01", points: 10 },
    { date: "2026-10-03", points: 25 },
  ];
  const stats = memberStats(
    entries,
    { startDate: "2026-10-01", endDate: null },
    "2026-10-04",
    100,
  );
  assert.equal(stats.streak, 1);
  assert.equal(stats.missedDays, 1);
  assert.equal(stats.fines, 100);
  assert.equal(stats.points, 35);
  assert.equal(stats.consistency, 67);
  assert.equal(stats.checkedInToday, false);
  const lateJoiner = memberStats(
    [{ date: "2026-10-03", points: 10 }],
    { startDate: "2026-10-03", endDate: null },
    "2026-10-04",
    100,
  );
  assert.equal(lateJoiner.missedDays, 0);
});

test("fines stop when a finite goal ends and do not accrue before a future goal", () => {
  const ended = memberStats(
    [{ date: "2026-10-01", points: 10 }],
    { startDate: "2026-10-01", endDate: "2026-10-02" },
    "2026-10-10",
    100,
  );
  assert.equal(ended.missedDays, 1);
  const future = memberStats(
    [],
    { startDate: "2026-10-10", endDate: null },
    "2026-10-04",
    100,
  );
  assert.equal(future.fines, 0);
});

test("edited room dates bound existing goals and the current fine rate recalculates missed days without changing points", () => {
  const entries = [
    { date: "2026-10-01", points: 10 },
    { date: "2026-10-03", points: 25 },
  ];
  const goal = { startDate: "2026-10-01", endDate: "2026-10-05" };
  const room = { startDate: "2026-10-02", endDate: "2026-10-04" };
  const originalRate = memberStats(entries, goal, "2026-10-10", 100, room);
  assert.equal(originalRate.missedDays, 2);
  assert.equal(originalRate.fines, 200);
  const updatedRate = memberStats(entries, goal, "2026-10-10", 300, room);
  assert.equal(updatedRate.fines, 600);
  assert.equal(updatedRate.points, 35);
  const extended = memberStats(entries, goal, "2026-10-10", 100, {
    startDate: "2026-09-01",
    endDate: null,
  });
  assert.equal(extended.missedDays, 3);
  const upcoming = memberStats(entries, goal, "2026-10-10", 100, {
    startDate: "2026-10-11",
    endDate: null,
  });
  assert.equal(upcoming.fines, 0);
  assert.equal(upcoming.streak, 0);
});

test("best streak is independent of current streak and duplicate dates do not inflate it", () => {
  const entries = [
    "2026-10-01",
    "2026-10-02",
    "2026-10-03",
    "2026-10-03",
    "2026-10-05",
  ].map((date) => ({ date, points: 10 }));
  const stats = memberStats(entries, null, "2026-10-07", 0);
  assert.equal(stats.bestStreak, 3);
  assert.equal(stats.streak, 0);
  assert.equal(stats.checkins, 4);
});

test("proof is mandatory and active-content URLs cannot be submitted", () => {
  const input = {
    title: "Built a feature",
    body: "",
    proofUrl: "",
    attachmentId: "",
    level: 0,
  };
  assert.equal(checkinInput.safeParse(input).success, false);
  assert.equal(
    checkinInput.safeParse({ ...input, proofUrl: "javascript:alert(1)" })
      .success,
    false,
  );
  assert.equal(
    checkinInput.safeParse({
      ...input,
      proofUrl: "https://github.com/example/project",
    }).success,
    true,
  );
  assert.equal(
    checkinInput.safeParse({ ...input, attachmentId: "proof-file" }).success,
    true,
  );
});

test("room dates and scoring are validated; fines are stored in minor currency units", () => {
  const input = {
    title: "Daily progress",
    note: "",
    startDate: "2026-10-04",
    endDate: "",
    timezone: "Asia/Makassar",
    visibility: "private",
    currency: "IDR",
    missedDayFine: "10000",
    externalFine: "",
    pointLevels: [
      { name: "Show up", points: 10, requirement: "A photo of your work" },
    ],
  };
  assert.equal(roomInput.parse(input).missedDayFine, 1000000);
  assert.equal(roomInput.parse(input).endDate, null);
  assert.equal(
    roomInput.safeParse({ ...input, startDate: "2026-02-30" }).success,
    false,
  );
  assert.equal(
    roomInput.safeParse({ ...input, endDate: "2026-10-03" }).success,
    false,
  );
  assert.equal(
    roomInput.safeParse({ ...input, timezone: "Not/AZone" }).success,
    false,
  );
  assert.equal(
    roomInput.safeParse({
      ...input,
      pointLevels: [{ ...input.pointLevels[0], points: -1 }],
    }).success,
    false,
  );
});
