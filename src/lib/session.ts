import "server-only";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth, demoEnabled } from "./auth";

export const getViewer = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session)
    return {
      id: session.user.id,
      name: session.user.name,
      image: session.user.image ?? null,
      demo: false,
    };
  if (
    demoEnabled &&
    (await cookies()).get("consisthon-demo")?.value === "local-preview"
  ) {
    const [viewer] = await db
      .select()
      .from(user)
      .where(eq(user.id, "demo-you"));
    if (viewer)
      return {
        id: viewer.id,
        name: viewer.name,
        image: viewer.image,
        demo: true,
      };
  }
  return null;
});

export class AppError extends Error {}
export async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) throw new AppError("Sign in to continue.");
  return viewer;
}
