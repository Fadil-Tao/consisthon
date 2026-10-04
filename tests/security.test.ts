import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import {
  checkins,
  goals,
  members,
  roomBans,
  rooms,
  uploads,
  user,
} from "../src/db/schema";
import { addDays, DEFAULT_LEVELS } from "../src/lib/domain";
import { safeRedirectPath } from "../src/lib/redirect";

// Server helpers use an isolated database and private local storage, never cloud credentials.
Object.assign(process.env, {
  NODE_ENV: "development",
  TURSO_DATABASE_URL: "file::memory:",
  TURSO_AUTH_TOKEN: "",
  ENABLE_DEMO: "true",
  S3_BUCKET: "",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  BETTER_AUTH_URL: "http://localhost:3101",
  BETTER_AUTH_SECRET: "consisthon-isolated-security-test-secret",
});
const { client, db } = await import("../src/db");
const { deleteProof, readLocalProof } = await import("../src/lib/storage");
const { storeProofUpload, UploadLimitError } = await import(
  "../src/lib/uploads"
);
const { removeRoomMember, joinRoomMember } = await import(
  "../src/lib/room-members"
);
const { updateRoomRules } = await import("../src/lib/room-rules");
const { requireMembership } = await import("../src/lib/queries");
const proofBody = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9WkAAAAASUVORK5CYII=",
  "base64",
);
const proof = new File([proofBody], "proof.png", { type: "image/png" });

before(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
});
beforeEach(async () => {
  await db.insert(user).values([
    { id: "alice", name: "Alice", email: "alice@example.invalid" },
    { id: "bob", name: "Bob", email: "bob@example.invalid" },
  ]);
  await db.insert(rooms).values(
    ["room", "other-room"].map((id) => ({
      id,
      title: "The crew",
      masterId: "alice",
      inviteCode: id,
      startDate: "2026-10-04",
      pointLevels: DEFAULT_LEVELS,
    })),
  );
});
afterEach(async () => {
  await db.delete(checkins);
  await db.delete(goals);
  await db.delete(members);
  await db.delete(roomBans);
  for (const file of await db.select().from(uploads))
    await deleteProof(file.key);
  await db.delete(uploads);
  await db.delete(rooms);
  await db.delete(user);
});
after(() => client.close());

test("redirects reject browser normalization attacks and preserve local destinations", () => {
  for (const input of [
    "/\t/attacker.example",
    "/\r/attacker.example",
    "/\n/attacker.example",
    "//attacker.example",
    "/\\attacker.example",
    "/..//attacker.example",
    "/.%2e//attacker.example",
    "https://attacker.example",
    "/\u0000/attacker.example",
    ["/rooms"],
    null,
    "/".repeat(2001),
  ])
    assert.equal(safeRedirectPath(input), "/", JSON.stringify(input));
  assert.equal(
    safeRedirectPath("/rooms?search=hello%20world#goals"),
    "/rooms?search=hello%20world#goals",
  );
});

test("concurrent uploads cannot exceed the user's pending quota across rooms", async () => {
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, (_, i) =>
      storeProofUpload("alice", i % 2 ? "room" : "other-room", proof),
    ),
  );
  assert.equal(
    results.filter((r) => r.status === "fulfilled").length,
    3,
    JSON.stringify(
      results
        .filter((r) => r.status === "rejected")
        .map((r) => r.reason.message),
    ),
  );
  const failures = results.filter((r) => r.status === "rejected");
  assert.equal(failures.length, 5);
  for (const failure of failures)
    assert.ok(failure.reason instanceof UploadLimitError);
  const bob = await storeProofUpload("bob", "room", proof);
  assert.deepEqual(await readLocalProof(`local:${bob.id}`), proofBody);
});

async function seedAttachedProofs(sizes: number[]) {
  const files = sizes.map((size) => {
    const id = randomUUID();
    return {
      id,
      roomId: "room",
      userId: "alice",
      key: `local:${id}`,
      name: "proof.png",
      contentType: "image/png",
      size,
    };
  });
  await db.insert(uploads).values(files);
  await db.insert(checkins).values(
    files.map((file, i) => ({
      id: randomUUID(),
      roomId: "room",
      userId: "alice",
      attachmentId: file.id,
      date: addDays("2025-01-01", i),
      title: "Daily proof",
      level: 0,
      points: 10,
    })),
  );
}

test("daily upload limits count attached proofs across rooms", async () => {
  await seedAttachedProofs(Array.from({ length: 20 }, () => 5));
  await assert.rejects(
    storeProofUpload("alice", "other-room", proof),
    /daily upload limit/,
  );
  await db
    .update(uploads)
    .set({ createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) });
  await storeProofUpload("alice", "other-room", proof);
});

test("stored proofs cannot exceed 100 MB even when all existing files are attached", async () => {
  await seedAttachedProofs([
    ...Array.from({ length: 204 }, () => 512000),
    409600,
  ]);
  await db
    .update(uploads)
    .set({ createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) });
  await assert.rejects(
    storeProofUpload("alice", "other-room", proof),
    /100 MB proof storage limit/,
  );
});

test("expired abandoned files are removed while attached proofs and other users' files remain", async () => {
  const abandoned = await storeProofUpload("alice", "room", proof);
  const attached = await storeProofUpload("alice", "room", proof);
  const other = await storeProofUpload("bob", "room", proof);
  await db.insert(checkins).values({
    id: randomUUID(),
    roomId: "room",
    userId: "alice",
    attachmentId: attached.id,
    date: "2026-10-04",
    title: "Daily proof",
    level: 0,
    points: 10,
  });
  await db
    .update(uploads)
    .set({ createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) });
  await storeProofUpload("alice", "other-room", proof);
  assert.equal(await readLocalProof(`local:${abandoned.id}`), null);
  assert.deepEqual(await readLocalProof(`local:${attached.id}`), proofBody);
  assert.deepEqual(await readLocalProof(`local:${other.id}`), proofBody);
  assert.equal(
    (await db.select().from(uploads).where(eq(uploads.id, abandoned.id)))
      .length,
    0,
  );
});

test("failed uploads release their reserved quota", async () => {
  class UnreadableFile extends File {
    override async arrayBuffer(): Promise<ArrayBuffer> {
      throw new Error("Cannot read upload");
    }
  }
  await assert.rejects(
    storeProofUpload(
      "alice",
      "room",
      new UnreadableFile(["proof"], "proof.png", { type: "image/png" }),
    ),
    /Cannot read upload/,
  );
  assert.equal((await db.select().from(uploads)).length, 0);
  for (let i = 0; i < 3; i++) await storeProofUpload("alice", "room", proof);
});

test("non-images and misleading image MIME types never reserve upload quota", async () => {
  for (const type of [
    "application/pdf",
    "video/mp4",
    "image/svg+xml",
    "image/gif",
    "image/png",
  ]) {
    await assert.rejects(
      storeProofUpload(
        "alice",
        "room",
        new File(["not an image"], "proof.png", { type }),
      ),
      /JPG, PNG, or WebP image/,
    );
  }
  assert.equal((await db.select().from(uploads)).length, 0);
  await storeProofUpload("alice", "room", proof);
});

test("room masters can ban members, preserving saved work and blocking rejoining only that room", async () => {
  for (const roomId of ["room", "other-room"])
    await joinRoomMember(roomId, "bob", "2026-10-04");
  await db.insert(checkins).values({
    id: "bobs-work",
    roomId: "room",
    userId: "bob",
    date: "2026-10-04",
    title: "Showed up",
    proofUrl: "https://example.com/proof",
    level: 0,
    points: 10,
  });
  await removeRoomMember("room", "alice", "bob", "ban");
  await assert.rejects(requireMembership("room", "bob"), /join this room/);
  await assert.rejects(joinRoomMember("room", "bob", "2026-10-04"), /banned/);
  await requireMembership("other-room", "bob");
  await joinRoomMember("other-room", "bob", "2026-10-04");
  assert.equal((await db.select().from(checkins)).length, 1);
  assert.equal((await db.select().from(roomBans)).length, 1);
});

test("kicks and bans require the room master and cannot target the master or non-members", async () => {
  await joinRoomMember("room", "alice", "2026-10-04");
  await joinRoomMember("room", "bob", "2026-10-04");
  for (const kind of ["kick", "ban"] as const) {
    await assert.rejects(
      removeRoomMember("room", "bob", "alice", kind),
      /Only the room master/,
    );
    await assert.rejects(
      removeRoomMember("room", "alice", "alice", kind),
      /master cannot be/,
    );
    await assert.rejects(
      removeRoomMember("other-room", "alice", "bob", kind),
      /not a room member/,
    );
  }
  assert.equal((await db.select().from(roomBans)).length, 0);
  await requireMembership("room", "alice");
  await requireMembership("room", "bob");
});

test("kicked members lose access but can rejoin with their saved work intact", async () => {
  for (const roomId of ["room", "other-room"])
    await joinRoomMember(roomId, "bob", "2026-10-04");
  await db.insert(checkins).values({
    id: "bobs-work",
    roomId: "room",
    userId: "bob",
    date: "2026-10-04",
    title: "Showed up",
    proofUrl: "https://example.com/proof",
    level: 0,
    points: 10,
  });
  await removeRoomMember("room", "alice", "bob", "kick");
  await assert.rejects(requireMembership("room", "bob"), /join this room/);
  await requireMembership("other-room", "bob");
  assert.equal((await db.select().from(roomBans)).length, 0);
  await joinRoomMember("room", "bob", "2026-10-05");
  await requireMembership("room", "bob");
  assert.equal((await db.select().from(checkins)).length, 1);
});

test("the room master can edit every room rule after goals and proofs exist without changing earned points", async () => {
  await db.insert(goals).values({
    id: "goal",
    roomId: "room",
    userId: "alice",
    topic: "Building",
    project: "Consisthon",
    dailyGoal: "Ship something useful",
    startDate: "2026-10-04",
  });
  await db.insert(checkins).values({
    id: "proof",
    roomId: "room",
    userId: "alice",
    date: "2026-10-04",
    title: "Showed up",
    proofUrl: "https://example.com/proof",
    level: 0,
    points: 10,
  });
  const [original] = await db.select().from(rooms).where(eq(rooms.id, "room"));
  const input = {
    ...original,
    title: "Updated crew",
    note: "New room rules",
    visibility: "public",
    startDate: "2026-10-05",
    endDate: "2026-10-25",
    timezone: "UTC",
    missedDayFine: 12.5,
    currency: "USD",
    externalFine: "Buy the crew a coffee.",
    pointLevels: DEFAULT_LEVELS.map((level, i) =>
      i
        ? level
        : {
            name: "Daily progress",
            points: 70,
            requirement: "A photo of the finished task.",
          },
    ),
  };
  await assert.rejects(
    updateRoomRules("room", "bob", { ...input, masterId: "bob" }),
    /Only the room master/,
  );
  assert.deepEqual(
    (await db.select().from(rooms).where(eq(rooms.id, "room")))[0],
    original,
  );
  await updateRoomRules("room", "alice", input);
  const [updated] = await db.select().from(rooms).where(eq(rooms.id, "room"));
  assert.deepEqual(updated, {
    ...input,
    masterId: "alice",
    missedDayFine: 1250,
  });
  assert.equal((await db.select().from(checkins))[0].points, 10);
  assert.equal((await db.select().from(goals))[0].startDate, "2026-10-04");
  await assert.rejects(
    updateRoomRules("room", "alice", { ...input, endDate: "2026-10-01" }),
  );
  assert.deepEqual(
    (await db.select().from(rooms).where(eq(rooms.id, "room")))[0],
    updated,
  );
});
