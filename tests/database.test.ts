import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { checkins, members, rooms, user } from "../src/db/schema";
import { DEFAULT_LEVELS } from "../src/lib/domain";

test("database prevents duplicate membership and daily scoring, while allowing other days and members", async () => {
  const client = createClient({ url: "file::memory:" });
  const db = drizzle(client);
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(user).values([
      { id: "alice", name: "Alice", email: "alice@example.invalid" },
      { id: "bob", name: "Bob", email: "bob@example.invalid" },
    ]);
    await db.insert(rooms).values({
      id: "room",
      title: "The crew",
      masterId: "alice",
      inviteCode: "CREW",
      startDate: "2026-10-04",
      pointLevels: DEFAULT_LEVELS,
    });
    const member = {
      id: "member",
      roomId: "room",
      userId: "alice",
      joinedDate: "2026-10-04",
    };
    await db.insert(members).values(member);
    await assert.rejects(
      db.insert(members).values({ ...member, id: "duplicate" }),
    );
    const entry = {
      id: "entry",
      roomId: "room",
      userId: "alice",
      date: "2026-10-04",
      title: "Showed my work",
      proofUrl: "https://example.com/proof",
      level: 0,
      points: 10,
    };
    await db.insert(checkins).values(entry);
    await assert.rejects(
      db.insert(checkins).values({ ...entry, id: "double-score", points: 100 }),
    );
    await db
      .insert(checkins)
      .values({ ...entry, id: "tomorrow", date: "2026-10-05" });
    await db
      .insert(checkins)
      .values({ ...entry, id: "bob-today", userId: "bob" });
    assert.equal((await db.select().from(checkins)).length, 3);
  } finally {
    client.close();
  }
});
