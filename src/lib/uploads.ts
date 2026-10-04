import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, lt, notExists, sql } from "drizzle-orm";
import { db } from "@/db";
import { checkins, uploads, user } from "@/db/schema";
import {
  MAX_PENDING_UPLOADS,
  MAX_UPLOADS_PER_DAY,
  MAX_USER_PROOF_BYTES,
  UNATTACHED_PROOF_TTL_MS,
} from "./proof";
import { deleteProof, saveProof, storageConfigured } from "./storage";

export class UploadLimitError extends Error {}

export async function storeProofUpload(
  userId: string,
  roomId: string,
  file: File,
) {
  const id = randomUUID();
  const key = storageConfigured
    ? `proof/${roomId}/${userId}/${id}`
    : `local:${id}`;
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const unattached = notExists(
    db
      .select({ id: checkins.id })
      .from(checkins)
      .where(eq(checkins.attachmentId, uploads.id)),
  );
  const expired = and(
    eq(uploads.userId, userId),
    lt(uploads.createdAt, new Date(now.getTime() - UNATTACHED_PROOF_TTL_MS)),
    unattached,
  );
  const stale = await db
    .select({ id: uploads.id })
    .from(uploads)
    .where(expired)
    .limit(1);
  if (stale.length) {
    // ponytail: Hold the write lock during rare cleanup so a check-in cannot attach a file being deleted.
    await db.transaction(async (tx) => {
      for (const upload of await tx.select().from(uploads).where(expired)) {
        await deleteProof(upload.key);
        await tx.delete(uploads).where(eq(uploads.id, upload.id));
      }
    });
  }
  const pendingCount = sql<number>`(select count(*) from ${uploads} where ${uploads.userId} = ${userId} and ${unattached})`;
  const todayCount = sql<number>`(select count(*) from ${uploads} where ${uploads.userId} = ${userId} and ${uploads.createdAt} >= ${dayStart.getTime()})`;
  const storedBytes = sql<number>`(select coalesce(sum(${uploads.size}), 0) from ${uploads} where ${uploads.userId} = ${userId})`;
  // Checking and reserving quota in one SQL statement prevents races across server instances.
  const inserted = await db
    .insert(uploads)
    .select(sql`
    select ${id}, ${roomId}, ${userId}, ${key}, ${file.name.slice(0, 200)},
      ${file.type}, ${file.size}, ${now.getTime()}
    where ${pendingCount} < ${MAX_PENDING_UPLOADS}
      and ${todayCount} < ${MAX_UPLOADS_PER_DAY}
      and ${storedBytes} + ${file.size} <= ${MAX_USER_PROOF_BYTES}
  `)
    .returning({ id: uploads.id });
  if (!inserted.length) {
    const [usage] = await db
      .select({ pending: pendingCount, today: todayCount, bytes: storedBytes })
      .from(user)
      .where(eq(user.id, userId));
    if (usage.pending >= MAX_PENDING_UPLOADS)
      throw new UploadLimitError(
        "Submit one of your uploaded files before uploading more. Unused files expire after 24 hours.",
      );
    if (usage.today >= MAX_UPLOADS_PER_DAY)
      throw new UploadLimitError(
        "You've reached the daily upload limit. Try again tomorrow (UTC).",
      );
    throw new UploadLimitError(
      "You've reached your 100 MB proof storage limit. Add a proof link instead.",
    );
  }
  try {
    await saveProof(key, Buffer.from(await file.arrayBuffer()), file.type);
  } catch (error) {
    try {
      await deleteProof(key);
      await db.delete(uploads).where(eq(uploads.id, id));
    } catch (cleanupError) {
      // Keep the reservation if cleanup fails so storage remains tracked and bounded.
      console.error(
        "Failed to clean up an unsuccessful proof upload",
        cleanupError,
      );
    }
    throw error;
  }
  return { id, name: file.name.slice(0, 200) };
}
