import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { checkins, rooms, uploads, user } from "../src/db/schema";
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
const proof = new File(["proof"], "proof.png", { type: "image/png" });

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
  assert.deepEqual(
    await readLocalProof(`local:${bob.id}`),
    Buffer.from("proof"),
  );
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
  assert.deepEqual(
    await readLocalProof(`local:${attached.id}`),
    Buffer.from("proof"),
  );
  assert.deepEqual(
    await readLocalProof(`local:${other.id}`),
    Buffer.from("proof"),
  );
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
