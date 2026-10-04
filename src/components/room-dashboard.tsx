"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Crown,
  Flame,
  Home,
  Link2,
  MessageCircle,
  Plus,
  Sparkles,
  Target,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import type { Checkin } from "@/db/schema";
import { dateLabel, daysBetween, money, roomStatus } from "@/lib/domain";
import type { RoomData } from "@/lib/queries";
import { cn } from "@/lib/utils";
import {
  CheckinDialog,
  CommentForm,
  GoalDialog,
  InviteDialog,
  RemoveMemberDialog,
  RoomForm,
} from "./forms";
import { Heatmap } from "./heatmap";
import { ProofImagePreview, ProofLinkPreview } from "./proof-preview";
import { Avatar } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";

type Tab = "overview" | "streaks" | "leaderboard" | "goals" | "rules";
const tabs: { id: Tab; title: string; icon: typeof Target }[] = [
  { id: "overview", title: "Overview", icon: Target },
  { id: "streaks", title: "Streaks", icon: CalendarDays },
  { id: "leaderboard", title: "Leaderboard", icon: Trophy },
  { id: "goals", title: "People & goals", icon: Users },
  { id: "rules", title: "Room rules", icon: Wallet },
];

export function RoomDashboard({
  data,
  storageAvailable,
}: {
  data: RoomData;
  storageAvailable: boolean;
}) {
  const { room, rankings, entries, comments, today, userId } = data;
  const [tab, setTab] = useState<Tab>("overview");
  const [selected, setSelected] = useState<Checkin | null>(null);
  const [feedFilter, setFeedFilter] = useState("all");
  const [feedLimit, setFeedLimit] = useState(8);
  const [compareA, setCompareA] = useState(userId);
  const [compareB, setCompareB] = useState(
    rankings.find((p) => p.userId !== userId)?.userId || userId,
  );
  const me = rankings.find((p) => p.userId === userId);
  if (!me) return null;
  const status = roomStatus(room, today);
  const mine = entries.filter((c) => c.userId === userId);
  const checkedToday = rankings.filter((p) => p.checkedInToday).length;
  const day =
    status === "upcoming"
      ? 0
      : daysBetween(
          room.startDate,
          room.endDate && today > room.endDate ? room.endDate : today,
        ) + 1;
  const canCheckin =
    status === "active" &&
    me.goal &&
    today >= me.goal.startDate &&
    (!me.goal.endDate || today <= me.goal.endDate);
  const memberIds = new Set(rankings.map((person) => person.userId));
  const currentFilter = memberIds.has(feedFilter) ? feedFilter : "all";
  const firstComparison = memberIds.has(compareA) ? compareA : userId;
  const secondComparison = memberIds.has(compareB)
    ? compareB
    : rankings.find((person) => person.userId !== firstComparison)?.userId ||
      userId;
  const activeEntries = entries.filter(
    (entry) =>
      memberIds.has(entry.userId) &&
      (currentFilter === "all" || entry.userId === currentFilter),
  );
  const selectedPerson = selected
    ? rankings.find((p) => p.userId === selected.userId)
    : null;

  return (
    <main className="mx-auto max-w-[1240px] px-6 pb-16 pt-6 lg:px-10">
      <div className="mb-8 flex items-center gap-2 text-[10px] text-muted-foreground">
        <Link href="/" aria-label="Home">
          <Home className="size-3" />
        </Link>
        <ChevronRight className="size-3 opacity-50" />
        <Link href="/rooms">Rooms</Link>
        <ChevronRight className="size-3 opacity-50" />
        <span className="text-foreground">{room.title}</span>
        <Link
          href={`/rooms/${room.id}/waiting`}
          className="ml-auto inline-flex items-center gap-1.5 hover:text-foreground"
        >
          Waiting room
          <ArrowUpRight className="size-3" />
        </Link>
      </div>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">{room.title}</h1>
          <p className="mt-3 max-w-lg text-xs leading-6 text-muted-foreground">
            {room.note}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3" />
              {dateLabel(room.startDate, true)} —{" "}
              {room.endDate ? dateLabel(room.endDate, true) : "No end date"}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="size-3" />
              {rankings.length} members
            </span>
            <span className="hidden sm:inline">{room.timezone}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          {room.masterId === userId ? (
            <InviteDialog code={room.inviteCode} />
          ) : null}
          {canCheckin && !me.checkedInToday ? (
            <CheckinDialog room={room} storageAvailable={storageAvailable} />
          ) : !me.goal && status !== "ended" ? (
            <GoalDialog room={room} goal={null} today={today} />
          ) : null}
        </div>
      </div>
      <nav
        aria-label="Room sections"
        className="mb-6 flex gap-1 overflow-x-auto border-b"
      >
        {tabs.map(({ id, title, icon: Icon }) => (
          <button
            type="button"
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
            className={cn(
              "relative flex h-8 shrink-0 items-center gap-1.5 rounded-t-md px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30",
              tab === id
                ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {title}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0 space-y-6">
            <section className="panel grid grid-cols-2 divide-x sm:grid-cols-4">
              <Stat
                label="Your points"
                value={me.points.toLocaleString()}
                icon={<Sparkles className="size-3" />}
                note={`#${rankings.indexOf(me) + 1} in the room`}
              />
              <Stat
                label="Current streak"
                value={
                  <>
                    {me.streak}
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      days
                    </span>
                  </>
                }
                icon={<Flame className="size-3" />}
                note={`Personal best: ${me.bestStreak} days`}
              />
              <Stat
                label="Today's check-ins"
                value={
                  <>
                    {checkedToday}
                    <span className="text-muted-foreground">
                      /{rankings.length}
                    </span>
                  </>
                }
                icon={<CheckCheck className="size-3" />}
                note={
                  checkedToday === rankings.length
                    ? "All members checked in"
                    : `${rankings.length - checkedToday} remaining today`
                }
              />
              <Stat
                label="Challenge day"
                value={day.toString().padStart(2, "0")}
                icon={<CalendarDays className="size-3" />}
                note={
                  room.endDate
                    ? `of ${daysBetween(room.startDate, room.endDate) + 1} days`
                    : "No end date"
                }
              />
            </section>
            <section className="panel flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="shrink-0 text-muted-foreground">
                {me.checkedInToday ? (
                  <Check className="size-4" />
                ) : (
                  <Target className="size-4" />
                )}
              </span>
              <div className="flex-1">
                <h2 className="text-xs font-medium">Daily check-in</h2>
                <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                  {me.checkedInToday
                    ? "Checked in today."
                    : !me.goal
                      ? "Set your daily goal before checking in."
                      : canCheckin
                        ? "Attach proof of today's progress to earn points."
                        : status === "upcoming" || today < me.goal.startDate
                          ? `Check-ins open on ${dateLabel(me.goal.startDate, true)}.`
                          : "Your check-in period has ended."}
                </p>
              </div>
              {canCheckin && !me.checkedInToday ? (
                <CheckinDialog
                  room={room}
                  storageAvailable={storageAvailable}
                  trigger={
                    <Button variant="outline" size="sm">
                      Check in
                      <ArrowRight />
                    </Button>
                  }
                />
              ) : !me.goal && status !== "ended" ? (
                <GoalDialog room={room} goal={null} today={today} />
              ) : null}
            </section>
            <section className="panel p-5">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xs font-medium">Your activity</h2>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    {me.checkins} daily check-ins.
                  </p>
                </div>
                <span className="flex items-center gap-1 text-[10px] text-success">
                  <Flame className="size-3" />
                  {me.streak} day streak
                </span>
              </div>
              <Heatmap
                entries={mine}
                today={today}
                weeks={34}
                onSelect={setSelected}
              />
            </section>
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="eyebrow">The daily feed</h2>
                <select
                  className="select-input w-auto text-muted-foreground"
                  aria-label="Filter activity by member"
                  value={currentFilter}
                  onChange={(e) => {
                    setFeedFilter(e.target.value);
                    setFeedLimit(8);
                  }}
                >
                  <option value="all">Everyone</option>
                  {rankings.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.userId === userId ? "Your progress" : p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-3">
                {activeEntries.length ? (
                  activeEntries.slice(0, feedLimit).map((entry) => {
                    const person = rankings.find(
                      (p) => p.userId === entry.userId,
                    );
                    if (!person) return null;
                    const commentCount = comments.filter(
                      (c) => c.checkinId === entry.id,
                    ).length;
                    return (
                      <article key={entry.id} className="panel p-5">
                        <div className="mb-3 flex items-center gap-3">
                          <Avatar
                            name={person.name}
                            index={rankings.indexOf(person)}
                            className="size-8"
                          />
                          <div className="flex-1">
                            <p className="text-[11px] font-medium">
                              {person.name}
                              {person.userId === userId ? (
                                <span className="ml-1.5 font-normal text-muted-foreground">
                                  (you)
                                </span>
                              ) : null}
                            </p>
                            <p className="mt-1 text-[9px] text-muted-foreground">
                              {person.goal?.topic || "Progress"}{" "}
                              <span className="mx-1">·</span>
                              {entry.date === today
                                ? "Today"
                                : dateLabel(entry.date)}
                            </p>
                          </div>
                          <span className="font-mono text-xs text-muted-foreground">
                            +{entry.points} pts
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelected(entry)}
                          className="mb-1.5 text-left text-xs font-medium hover:underline"
                        >
                          {entry.title}
                        </button>
                        <p className="line-clamp-2 text-[11px] leading-6 text-muted-foreground">
                          {entry.body}
                        </p>
                        <div className="mt-4 flex items-center justify-between border-t pt-3">
                          <button
                            type="button"
                            onClick={() => setSelected(entry)}
                            className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            <Link2 className="size-3" />
                            View proof
                            <ArrowUpRight className="size-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelected(entry)}
                            className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            <MessageCircle className="size-3" />
                            {commentCount || "Encourage"}
                          </button>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="panel px-6 py-12 text-center">
                    <p className="mb-2 text-xs font-medium">
                      The first small step is yours.
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Daily check-ins will appear here as your people show up.
                    </p>
                  </div>
                )}
              </div>
              {activeEntries.length > feedLimit ? (
                <Button
                  variant="ghost"
                  className="mt-4 w-full"
                  onClick={() => setFeedLimit((n) => n + 8)}
                >
                  Load more progress
                </Button>
              ) : null}
            </section>
          </div>
          <aside className="space-y-5">
            <section className="panel p-5">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="eyebrow">Your commitment</h2>
                <Target className="size-3.5 text-muted-foreground" />
              </div>
              {me.goal ? (
                <>
                  <span className="text-xs text-muted-foreground">
                    {me.goal.topic}
                  </span>
                  <h3 className="mb-4 mt-3 text-sm font-medium tracking-tight">
                    {me.goal.project}
                  </h3>
                  <p className="mb-2 text-[9px] font-medium text-muted-foreground">
                    EVERY DAY
                  </p>
                  <p className="text-[11px] leading-6">{me.goal.dailyGoal}</p>
                  {me.goal.weeklyGoal ? (
                    <div className="mt-4 border-t pt-4">
                      <p className="mb-2 text-[9px] font-medium text-muted-foreground">
                        THIS WEEK
                      </p>
                      <p className="text-[11px] leading-6 text-muted-foreground">
                        {me.goal.weeklyGoal}
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-5">
                    <GoalDialog room={room} goal={me.goal} today={today} />
                  </div>
                </>
              ) : (
                <>
                  <p className="mb-5 text-xs leading-6 text-muted-foreground">
                    What will you make time for? Choose a daily action that
                    moves you forward.
                  </p>
                  <GoalDialog room={room} goal={null} today={today} />
                </>
              )}
            </section>
            <section className="panel p-5">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="eyebrow">Leading the way</h2>
                <Trophy className="size-3.5 text-muted-foreground" />
              </div>
              <div className="space-y-4">
                {rankings.slice(0, 4).map((person, i) => (
                  <div
                    key={person.userId}
                    className="flex items-center gap-2.5"
                  >
                    <span
                      className={cn(
                        "w-3 font-mono text-[10px]",
                        i === 0 ? "text-[#aa8a53]" : "text-muted-foreground",
                      )}
                    >
                      {i + 1}
                    </span>
                    <Avatar name={person.name} index={i} className="size-7" />
                    <span className="flex-1 text-[10px]">
                      {person.name.split(" ")[0]}
                      {person.userId === userId ? " (you)" : ""}
                    </span>
                    <span className="font-mono text-[10px]">
                      {person.points.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setTab("leaderboard")}
                className="mt-5 flex w-full items-center justify-between border-t pt-4 text-[10px] text-muted-foreground"
              >
                View leaderboard
                <ArrowRight className="size-3" />
              </button>
            </section>
            <section className="p-1">
              <h2 className="eyebrow mb-3">Room agreement</h2>
              <p className="text-[11px] leading-6 text-muted-foreground">
                {room.externalFine || "No external fine set."}
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-[9px] text-muted-foreground">
                <Crown className="size-3" />
                Room master:{" "}
                {
                  rankings
                    .find((p) => p.userId === room.masterId)
                    ?.name.split(" ")[0]
                }
              </div>
            </section>
          </aside>
        </div>
      ) : null}

      {tab === "streaks" ? (
        <section className="space-y-5">
          <SectionHeading
            title="Streaks"
            description="Daily check-ins for every member. Select a filled square to open the proof."
          />
          {rankings.map((person, i) => (
            <article className="panel p-6" key={person.userId}>
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <Avatar name={person.name} index={i} />
                <div className="flex-1">
                  <h3 className="text-xs font-medium">
                    {person.name}
                    {person.userId === userId ? " (you)" : ""}
                  </h3>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {person.goal?.project || "No goal yet"}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 text-xs text-success">
                  <Flame className="size-3.5" />
                  {person.streak} day streak
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Best: {person.bestStreak} · {person.checkins} check-ins
                </span>
              </div>
              <Heatmap
                entries={entries.filter((c) => c.userId === person.userId)}
                today={today}
                weeks={48}
                onSelect={setSelected}
              />
            </article>
          ))}
        </section>
      ) : null}

      {tab === "leaderboard" ? (
        <section className="space-y-7">
          <SectionHeading
            title="Leaderboard"
            description="Ranked by earned points, then current streak. Every member gets one proof check-in each day."
          />
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead className="border-b bg-muted/40 text-[9px] text-muted-foreground">
                <tr>
                  <th className="px-5 py-4 font-normal">RANK</th>
                  <th className="px-4 py-4 font-normal">MEMBER</th>
                  <th className="px-4 py-4 font-normal">POINTS</th>
                  <th className="px-4 py-4 font-normal">STREAK</th>
                  <th className="px-4 py-4 font-normal">CONSISTENCY</th>
                  <th className="px-4 py-4 font-normal">FINES</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((person, i) => (
                  <tr
                    key={person.userId}
                    className={cn(
                      "border-b last:border-0",
                      person.userId === userId ? "bg-muted/50" : "",
                    )}
                  >
                    <td className="px-5 py-5 font-mono text-muted-foreground">
                      {i === 0 ? (
                        <Trophy className="size-4 text-[#b29257]" />
                      ) : (
                        (i + 1).toString().padStart(2, "0")
                      )}
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={person.name}
                          index={i}
                          className="size-8"
                        />
                        <span>
                          <span className="block text-[11px] font-medium">
                            {person.name}
                            {person.userId === userId ? " (you)" : ""}
                          </span>
                          <span className="mt-1 block text-[9px] text-muted-foreground">
                            {person.goal?.topic || "No goal yet"}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-5 font-mono">
                      {person.points.toLocaleString()}
                    </td>
                    <td className="px-4 py-5">
                      <span className="flex items-center gap-1.5 text-success">
                        <Flame className="size-3" />
                        {person.streak} days
                      </span>
                    </td>
                    <td className="px-4 py-5 font-mono">
                      {person.consistency}%
                    </td>
                    <td className="px-4 py-5 font-mono text-muted-foreground">
                      {money(person.fines, room.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-medium">Side by side</h2>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  Different goals, shared momentum.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  aria-label="First comparison member"
                  className="select-input !w-auto"
                  value={firstComparison}
                  onChange={(e) => setCompareA(e.target.value)}
                >
                  {rankings.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <span className="font-mono text-[10px] text-muted-foreground">
                  vs
                </span>
                <select
                  aria-label="Second comparison member"
                  className="select-input !w-auto"
                  value={secondComparison}
                  onChange={(e) => setCompareB(e.target.value)}
                >
                  {rankings.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { key: "left", userId: firstComparison },
                { key: "right", userId: secondComparison },
              ].map((column) => {
                const id = column.userId;
                const p = rankings.find((person) => person.userId === id);
                if (!p) return null;
                return (
                  <div
                    className="rounded-lg border bg-background p-5"
                    key={column.key}
                  >
                    <div className="mb-5 flex items-center gap-3">
                      <Avatar name={p.name} index={rankings.indexOf(p)} />
                      <div>
                        <h3 className="text-xs font-medium">{p.name}</h3>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {p.goal?.project || "No goal set"}
                        </p>
                      </div>
                    </div>
                    <div className="mb-5 grid grid-cols-3 gap-3">
                      <div>
                        <p className="font-mono text-lg">{p.points}</p>
                        <p className="mt-1 text-[9px] text-muted-foreground">
                          points
                        </p>
                      </div>
                      <div>
                        <p className="font-mono text-lg">{p.streak}</p>
                        <p className="mt-1 text-[9px] text-muted-foreground">
                          day streak
                        </p>
                      </div>
                      <div>
                        <p className="font-mono text-lg">{p.consistency}%</p>
                        <p className="mt-1 text-[9px] text-muted-foreground">
                          consistency
                        </p>
                      </div>
                    </div>
                    <Heatmap
                      entries={entries.filter((c) => c.userId === id)}
                      today={today}
                      weeks={18}
                      onSelect={setSelected}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {tab === "goals" ? (
        <section>
          <div className="mb-6 flex items-start justify-between gap-4">
            <SectionHeading
              title="People & goals"
              description="Member projects, daily goals, and weekly or monthly milestones."
            />
            <GoalDialog room={room} goal={me.goal} today={today} />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {rankings.map((person, i) => (
              <article className="panel p-6" key={person.userId}>
                <div className="mb-6 flex items-center gap-3">
                  <Avatar name={person.name} index={i} />
                  <div className="flex-1">
                    <h2 className="text-xs font-medium">
                      {person.name}
                      {person.userId === userId ? " (you)" : ""}
                    </h2>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {person.goal?.topic || "Choosing a goal"}
                    </p>
                  </div>
                  {person.userId === room.masterId ? (
                    <Crown
                      className="size-3.5 text-[#b29257]"
                      aria-label="Room master"
                    />
                  ) : null}
                </div>
                {person.goal ? (
                  <>
                    <h3 className="mb-5 text-base font-medium tracking-tight">
                      {person.goal.project}
                    </h3>
                    {[
                      { label: "Every day", value: person.goal.dailyGoal },
                      { label: "Every week", value: person.goal.weeklyGoal },
                      { label: "Every month", value: person.goal.monthlyGoal },
                    ]
                      .filter((g) => g.value)
                      .map((g) => (
                        <div className="mb-4 flex gap-3" key={g.label}>
                          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-success/60" />
                          <div>
                            <p className="mb-1.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                              {g.label}
                            </p>
                            <p className="text-[11px] leading-6">{g.value}</p>
                          </div>
                        </div>
                      ))}
                    <p className="mt-5 border-t pt-4 text-[9px] text-muted-foreground">
                      {dateLabel(person.goal.startDate)} —{" "}
                      {person.goal.endDate
                        ? dateLabel(person.goal.endDate)
                        : "No end date"}{" "}
                      <span className="mx-2">·</span>
                      {person.streak} day streak
                    </p>
                  </>
                ) : (
                  <p className="text-xs leading-6 text-muted-foreground">
                    A new beginning is on the way. Their commitment will appear
                    here when they're ready.
                  </p>
                )}
                {room.masterId === userId && person.userId !== userId ? (
                  <div className="mt-5 flex justify-end gap-1 border-t pt-3">
                    <RemoveMemberDialog
                      roomId={room.id}
                      userId={person.userId}
                      name={person.name}
                      kind="kick"
                    />
                    <RemoveMemberDialog
                      roomId={room.id}
                      userId={person.userId}
                      name={person.name}
                      kind="ban"
                    />
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "rules" ? (
        <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <SectionHeading
              title="Room rules"
              description="Proof is required for every check-in. Points are awarded immediately when submitted."
            />
            <div className="panel p-6">
              <h2 className="mb-5 text-xs font-medium">
                What progress is worth
              </h2>
              <div className="space-y-4">
                {room.pointLevels.map((level, i) => (
                  <div
                    className="flex gap-4 border-b pb-4 last:border-0 last:pb-0"
                    key={level.name}
                  >
                    <span className="mt-1 font-mono text-[10px] text-muted-foreground">
                      0{i + 1}
                    </span>
                    <div className="flex-1">
                      <h3 className="mb-2 text-xs font-medium">{level.name}</h3>
                      <p className="text-[11px] leading-6 text-muted-foreground">
                        {level.requirement}
                      </p>
                    </div>
                    <span className="font-mono text-xs text-success">
                      +{level.points} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {room.masterId === userId ? (
              <details className="panel p-6">
                <summary className="flex items-center justify-between text-xs font-medium">
                  Room master settings
                  <Plus className="size-3.5" />
                </summary>
                <div className="mt-6">
                  <RoomForm room={room} />
                </div>
              </details>
            ) : null}
          </div>
          <aside className="space-y-5">
            <div className="panel p-5">
              <h2 className="eyebrow mb-5">Missed-day fines</h2>
              <p className="font-mono text-xl">
                {money(room.missedDayFine, room.currency)}
              </p>
              <p className="mb-5 mt-2 text-[10px] leading-6 text-muted-foreground">
                Per missed day after your personal goal starts. Today is still
                open. Fines are tracked here and settled by your group.
              </p>
              <div className="flex justify-between border-t pt-4 text-xs">
                <span className="text-muted-foreground">Your missed days</span>
                <span className="font-mono">{me.missedDays}</span>
              </div>
              <div className="mt-3 flex justify-between text-xs">
                <span className="text-muted-foreground">Your fine total</span>
                <span className="font-mono">
                  {money(me.fines, room.currency)}
                </span>
              </div>
            </div>
            <div className="panel p-5">
              <h2 className="eyebrow mb-4">Outside the app</h2>
              <p className="text-[11px] leading-6 text-muted-foreground">
                {room.externalFine ||
                  "No external consequence. Keep each other accountable with a little encouragement."}
              </p>
            </div>
            <div className="px-1 text-[10px] leading-6 text-muted-foreground">
              <p>One check-in per person, per day.</p>
              <p>Day ends at midnight · {room.timezone}.</p>
              <p>The room master can update the schedule, points, and fines.</p>
            </div>
          </aside>
        </section>
      ) : null}

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-w-xl">
          {selected && selectedPerson ? (
            <>
              <div className="mb-5 flex items-center gap-3">
                <Avatar
                  name={selectedPerson.name}
                  index={rankings.indexOf(selectedPerson)}
                />
                <div>
                  <p className="text-xs font-medium">{selectedPerson.name}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {dateLabel(selected.date, true)}{" "}
                    <span className="mx-1">·</span>
                    {selectedPerson.goal?.project}
                  </p>
                </div>
              </div>
              <DialogTitle className="pr-6 text-sm font-medium">
                {selected.title}
              </DialogTitle>
              <DialogDescription className="mt-2 text-[11px] text-muted-foreground">
                {room.pointLevels[selected.level]?.name}{" "}
                <span className="mx-1">·</span>+{selected.points} points earned
              </DialogDescription>
              <p className="my-5 whitespace-pre-line text-xs leading-7">
                {selected.body}
              </p>
              <div className="mb-6 space-y-3">
                {selected.proofUrl ? (
                  <ProofLinkPreview
                    roomId={room.id}
                    value={selected.proofUrl}
                  />
                ) : null}
                {selected.attachmentId ? (
                  <div className="space-y-2">
                    <ProofImagePreview
                      key={selected.attachmentId}
                      src={`/api/proof/${selected.attachmentId}?preview=1`}
                    />
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={`/api/proof/${selected.attachmentId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Link2 />
                        Download proof
                      </a>
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="border-t pt-5">
                <h3 className="eyebrow mb-4">A little encouragement</h3>
                <div className="mb-5 space-y-4">
                  {comments
                    .filter((c) => c.checkinId === selected.id)
                    .map((comment) => (
                      <div className="flex gap-3" key={comment.id}>
                        <Avatar name={comment.name} className="size-6" />
                        <div>
                          <p className="mb-1 text-[10px] font-medium">
                            {comment.name}
                          </p>
                          <p className="whitespace-pre-line text-[11px] leading-6 text-muted-foreground">
                            {comment.body}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
                <CommentForm checkinId={selected.id} />
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <footer className="mt-12 flex items-center justify-between border-t pt-5 text-[9px] text-muted-foreground">
        <Link href="/" className="inline-flex items-center gap-1.5">
          <ArrowLeft className="size-2.5" />
          All your rooms
        </Link>
      </footer>
    </main>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="mt-2 max-w-xl text-xs/relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
function Stat({
  label,
  value,
  icon,
  note,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  note: ReactNode;
}) {
  return (
    <div className="px-5 py-5">
      <div className="mb-3 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <p className="font-mono text-2xl tracking-[-1px]">{value}</p>
      <p className="mt-2 text-[9px] text-muted-foreground">{note}</p>
    </div>
  );
}
