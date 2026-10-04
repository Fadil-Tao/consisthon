import "dotenv/config";
import { migrate } from "drizzle-orm/libsql/migrator";
import { client, db } from "../src/db";

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Consisthon database migrated.");
client.close();
