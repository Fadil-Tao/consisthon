import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

if (process.env.NODE_ENV === "production" && !process.env.BETTER_AUTH_SECRET) {
  throw new Error(
    "Set BETTER_AUTH_SECRET before running Consisthon in production.",
  );
}

export const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);
export const demoEnabled =
  process.env.NODE_ENV !== "production" &&
  process.env.ENABLE_DEMO === "true" &&
  (!process.env.TURSO_DATABASE_URL ||
    process.env.TURSO_DATABASE_URL.startsWith("file:"));

export const auth = betterAuth({
  appName: "Consisthon",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret:
    process.env.BETTER_AUTH_SECRET ||
    "consisthon-local-development-secret-only-change-me",
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  socialProviders: googleConfigured
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          prompt: "select_account",
        },
      }
    : {},
  session: { cookieCache: { enabled: true, maxAge: 300 } },
  rateLimit: { enabled: true },
  plugins: [nextCookies()],
});
