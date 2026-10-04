import "dotenv/config";
import { client } from "../src/db";
import { seedDemo } from "../src/db/seed";

if (
  process.env.NODE_ENV === "production" ||
  (process.env.TURSO_DATABASE_URL &&
    !process.env.TURSO_DATABASE_URL.startsWith("file:"))
)
  throw new Error("Demo seed requires a local development database.");
await seedDemo();
console.log("Demo rooms seeded. Sign in with Explore demo in development.");
client.close();
