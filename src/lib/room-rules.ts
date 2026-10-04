import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { rooms } from "@/db/schema";
import { AppError } from "./session";
import { roomInput } from "./validation";

export async function updateRoomRules(
  roomId: string,
  masterId: string,
  input: unknown,
) {
  await db.transaction(async (tx) => {
    const [room] = await tx.select().from(rooms).where(eq(rooms.id, roomId));
    if (!room || room.masterId !== masterId)
      throw new AppError("Only the room master can update room rules.");
    const data = roomInput.parse(input);
    await tx.update(rooms).set(data).where(eq(rooms.id, roomId));
  });
}
