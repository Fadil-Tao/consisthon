"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import {
  checkins,
  comments,
  goals,
  members,
  rooms,
  uploads,
} from "@/db/schema";
import { demoEnabled } from "@/lib/auth";
import { todayIn } from "@/lib/domain";
import { requireMembership } from "@/lib/queries";
import { safeRedirectPath } from "@/lib/redirect";
import { joinRoomMember, removeRoomMember } from "@/lib/room-members";
import { updateRoomRules } from "@/lib/room-rules";
import { AppError, requireViewer } from "@/lib/session";
import { checkinInput, goalInput, roomInput } from "@/lib/validation";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
async function action<T>(work: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    if (error instanceof z.ZodError)
      return { ok: false, error: error.issues[0].message };
    if (error instanceof AppError) return { ok: false, error: error.message };
    console.error("Consisthon action failed", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function createRoom(input: unknown) {
  return action(async () => {
    const viewer = await requireViewer();
    const data = roomInput.parse(input);
    if (data.startDate < todayIn(data.timezone))
      throw new AppError("Start your new room today or on a future date.");
    const id = randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(rooms).values({
        ...data,
        id,
        masterId: viewer.id,
        inviteCode: randomBytes(5).toString("hex").toUpperCase(),
      });
      await tx.insert(members).values({
        id: randomUUID(),
        roomId: id,
        userId: viewer.id,
        joinedDate: todayIn(data.timezone),
      });
    });
    revalidatePath("/");
    return { id };
  });
}

export async function joinRoom(input: { code?: string; roomId?: string }) {
  return action(async () => {
    const viewer = await requireViewer();
    const code = z
      .string()
      .trim()
      .max(100)
      .parse(input.code || "")
      .toUpperCase();
    const roomId = z
      .string()
      .max(100)
      .parse(input.roomId || "");
    const [room] = code
      ? await db.select().from(rooms).where(eq(rooms.inviteCode, code))
      : await db
          .select()
          .from(rooms)
          .where(and(eq(rooms.id, roomId), eq(rooms.visibility, "public")));
    if (!room)
      throw new AppError(
        "Room not found. Check your invite code and try again.",
      );
    if (room.endDate && room.endDate < todayIn(room.timezone))
      throw new AppError("This challenge has ended.");
    await joinRoomMember(room.id, viewer.id, todayIn(room.timezone));
    revalidatePath("/");
    revalidatePath(`/rooms/${room.id}`);
    return { id: room.id };
  });
}

export async function removeMember(
  roomId: string,
  userId: string,
  kind: "kick" | "ban",
) {
  return action(async () => {
    const viewer = await requireViewer();
    await removeRoomMember(
      z.string().max(100).parse(roomId),
      viewer.id,
      z.string().max(100).parse(userId),
      z.enum(["kick", "ban"]).parse(kind),
    );
    revalidatePath("/");
    revalidatePath("/rooms");
    revalidatePath(`/rooms/${roomId}`);
    revalidatePath(`/rooms/${roomId}/waiting`);
    return null;
  });
}

export async function saveGoal(roomId: string, input: unknown) {
  return action(async () => {
    const viewer = await requireViewer();
    const member = await requireMembership(roomId, viewer.id);
    const data = goalInput.parse(input);
    await db.transaction(async (tx) => {
      const [room] = await tx.select().from(rooms).where(eq(rooms.id, roomId));
      if (!room) throw new AppError("Room not found.");
      const [existing] = await tx
        .select()
        .from(goals)
        .where(and(eq(goals.roomId, roomId), eq(goals.userId, viewer.id)));
      const today = todayIn(room.timezone);
      if (room.endDate && room.endDate < today)
        throw new AppError("This room has ended.");
      if (
        !existing &&
        (data.startDate < room.startDate ||
          (room.endDate && data.startDate > room.endDate))
      )
        throw new AppError("Choose a goal start within the room's date range.");
      if (
        !existing &&
        (data.startDate < today || data.startDate < member.joinedDate)
      )
        throw new AppError("Start your goal today or on a future date.");
      if (
        !existing &&
        room.endDate &&
        (!data.endDate || data.endDate > room.endDate)
      )
        throw new AppError("Your goal must end within this room's date range.");
      if (
        existing &&
        (data.startDate !== existing.startDate ||
          data.endDate !== existing.endDate)
      )
        throw new AppError(
          "Your commitment dates are fixed once you save your goal.",
        );
      await tx
        .insert(goals)
        .values({ ...data, id: randomUUID(), roomId, userId: viewer.id })
        .onConflictDoUpdate({
          target: [goals.roomId, goals.userId],
          set: {
            topic: data.topic,
            project: data.project,
            dailyGoal: data.dailyGoal,
            weeklyGoal: data.weeklyGoal,
            monthlyGoal: data.monthlyGoal,
          },
        });
    });
    revalidatePath(`/rooms/${roomId}`);
    revalidatePath(`/rooms/${roomId}/waiting`);
    return null;
  });
}

export async function submitCheckin(roomId: string, input: unknown) {
  return action(async () => {
    const viewer = await requireViewer();
    await requireMembership(roomId, viewer.id);
    const data = checkinInput.parse(input);
    const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId));
    const [goal] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.roomId, roomId), eq(goals.userId, viewer.id)));
    if (!room || !goal)
      throw new AppError("Set your personal goal before checking in.");
    const today = todayIn(room.timezone);
    if (
      today < goal.startDate ||
      (goal.endDate && today > goal.endDate) ||
      today < room.startDate ||
      (room.endDate && today > room.endDate)
    )
      throw new AppError(
        "Check-ins are open only during your goal's active dates.",
      );
    const level = room.pointLevels[data.level];
    if (!level) throw new AppError("Choose one of this room's proof levels.");
    if (data.attachmentId) {
      const [attachment] = await db
        .select()
        .from(uploads)
        .where(
          and(
            eq(uploads.id, data.attachmentId),
            eq(uploads.roomId, roomId),
            eq(uploads.userId, viewer.id),
          ),
        );
      if (!attachment) throw new AppError("Upload your proof file again.");
    }
    const id = randomUUID();
    const inserted = await db
      .insert(checkins)
      .values({
        id,
        roomId,
        userId: viewer.id,
        date: today,
        title: data.title,
        body: data.body,
        proofUrl: data.proofUrl || null,
        attachmentId: data.attachmentId || null,
        level: data.level,
        points: level.points,
      })
      .onConflictDoNothing()
      .returning({ id: checkins.id });
    if (!inserted.length)
      throw new AppError(
        "You've already checked in today. Come back tomorrow to keep your streak going.",
      );
    revalidatePath(`/rooms/${roomId}`);
    return { id, points: level.points };
  });
}

export async function addComment(checkinId: string, body: string) {
  return action(async () => {
    const viewer = await requireViewer();
    const text = z.string().trim().min(1).max(1000).parse(body);
    const [entry] = await db
      .select()
      .from(checkins)
      .where(eq(checkins.id, checkinId));
    if (!entry) throw new AppError("Check-in not found.");
    await requireMembership(entry.roomId, viewer.id);
    await db
      .insert(comments)
      .values({ id: randomUUID(), checkinId, userId: viewer.id, body: text });
    revalidatePath(`/rooms/${entry.roomId}`);
    return null;
  });
}

export async function updateRoom(roomId: string, input: unknown) {
  return action(async () => {
    const viewer = await requireViewer();
    await updateRoomRules(roomId, viewer.id, input);
    revalidatePath(`/rooms/${roomId}`);
    revalidatePath(`/rooms/${roomId}/waiting`);
    revalidatePath("/rooms");
    revalidatePath("/");
    return null;
  });
}

export async function startDemo(next: string = "/") {
  const result = await action(async () => {
    if (!demoEnabled)
      throw new AppError(
        "Sign-in is currently unavailable. Please try again later.",
      );
    const destination = safeRedirectPath(next);
    const { seedDemo } = await import("@/db/seed");
    await seedDemo();
    (await cookies()).set("consisthon-demo", "local-preview", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    revalidatePath("/", "layout");
    return destination;
  });
  if (result.ok) redirect(result.data);
  return result;
}

export async function endDemo() {
  (await cookies()).delete("consisthon-demo");
  revalidatePath("/", "layout");
  redirect("/");
}
