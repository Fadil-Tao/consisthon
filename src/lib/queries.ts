import "server-only";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { checkins, comments, goals, members, rooms, user } from "@/db/schema";
import { memberStats, todayIn } from "./domain";
import { AppError } from "./session";

export async function requireMembership(roomId: string, userId: string) {
  const [membership] = await db
    .select()
    .from(members)
    .where(and(eq(members.roomId, roomId), eq(members.userId, userId)));
  if (!membership) throw new AppError("You must join this room first.");
  return membership;
}

export async function findRooms(userId?: string) {
  const mine = userId
    ? await db
        .select({ roomId: members.roomId })
        .from(members)
        .where(eq(members.userId, userId))
    : [];
  const ids = mine.map((r) => r.roomId);
  const result = await db
    .select()
    .from(rooms)
    .where(
      ids.length
        ? or(eq(rooms.visibility, "public"), inArray(rooms.id, ids))
        : eq(rooms.visibility, "public"),
    )
    .orderBy(desc(rooms.createdAt));
  const memberships = result.length
    ? await db
        .select()
        .from(members)
        .where(
          inArray(
            members.roomId,
            result.map((r) => r.id),
          ),
        )
    : [];
  return result.map((r) => ({
    ...r,
    inviteCode: r.masterId === userId ? r.inviteCode : "",
    joined: ids.includes(r.id),
    memberCount: memberships.filter((m) => m.roomId === r.id).length,
  }));
}

export async function getRoomData(roomId: string, userId: string) {
  await requireMembership(roomId, userId);
  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId));
  if (!room) return null;
  const [people, roomGoals, entries] = await Promise.all([
    db
      .select({
        id: members.id,
        userId: members.userId,
        name: user.name,
        image: user.image,
        joinedDate: members.joinedDate,
      })
      .from(members)
      .innerJoin(user, eq(user.id, members.userId))
      .where(eq(members.roomId, roomId)),
    db.select().from(goals).where(eq(goals.roomId, roomId)),
    db
      .select()
      .from(checkins)
      .where(eq(checkins.roomId, roomId))
      .orderBy(desc(checkins.createdAt)),
  ]);
  // ponytail: Load history together for small friend groups; paginate and aggregate for large rooms.
  const discussion = await db
    .select({
      id: comments.id,
      checkinId: comments.checkinId,
      body: comments.body,
      createdAt: comments.createdAt,
      userId: comments.userId,
      name: user.name,
    })
    .from(comments)
    .innerJoin(user, eq(user.id, comments.userId))
    .innerJoin(checkins, eq(checkins.id, comments.checkinId))
    .where(eq(checkins.roomId, roomId))
    .orderBy(comments.createdAt);
  const today = todayIn(room.timezone);
  const rankings = people
    .map((person) => {
      const goal = roomGoals.find((g) => g.userId === person.userId) ?? null;
      return {
        ...person,
        goal,
        ...memberStats(
          entries.filter((c) => c.userId === person.userId),
          goal,
          today,
          room.missedDayFine,
          room,
        ),
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.streak - a.streak ||
        a.name.localeCompare(b.name),
    );
  return {
    room: {
      ...room,
      inviteCode: room.masterId === userId ? room.inviteCode : "",
    },
    rankings,
    entries,
    comments: discussion,
    today,
    userId,
  };
}

export type RoomData = NonNullable<Awaited<ReturnType<typeof getRoomData>>>;
export type RoomListing = Awaited<ReturnType<typeof findRooms>>[number];
