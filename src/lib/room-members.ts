import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { members, roomBans, rooms } from "@/db/schema";
import { AppError } from "./session";

export async function joinRoomMember(
  roomId: string,
  userId: string,
  joinedDate: string,
) {
  await db.transaction(async (tx) => {
    const [ban] = await tx
      .select({ id: roomBans.id })
      .from(roomBans)
      .where(and(eq(roomBans.roomId, roomId), eq(roomBans.userId, userId)));
    if (ban) throw new AppError("You have been banned from this room.");
    await tx
      .insert(members)
      .values({ id: randomUUID(), roomId, userId, joinedDate })
      .onConflictDoNothing();
  });
}

export async function removeRoomMember(
  roomId: string,
  masterId: string,
  userId: string,
  kind: "kick" | "ban",
) {
  await db.transaction(async (tx) => {
    const [room] = await tx.select().from(rooms).where(eq(rooms.id, roomId));
    if (!room || room.masterId !== masterId)
      throw new AppError(`Only the room master can ${kind} members.`);
    if (userId === room.masterId)
      throw new AppError(
        `The room master cannot be ${kind === "ban" ? "banned" : "kicked"}.`,
      );
    const member = and(eq(members.roomId, roomId), eq(members.userId, userId));
    const [existing] = await tx.select().from(members).where(member);
    if (!existing) throw new AppError("This person is not a room member.");
    if (kind === "ban")
      await tx
        .insert(roomBans)
        .values({ id: randomUUID(), roomId, userId })
        .onConflictDoNothing();
    await tx.delete(members).where(member);
  });
}
