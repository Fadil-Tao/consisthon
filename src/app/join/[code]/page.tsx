import { eq } from "drizzle-orm";
import { CalendarDays, Users } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { JoinForm } from "@/components/forms";
import { db } from "@/db";
import { members, rooms } from "@/db/schema";
import { dateLabel } from "@/lib/domain";
import { getViewer } from "@/lib/session";

export const metadata = { title: "You're invited" };
export default async function InvitationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const viewer = await getViewer();
  const [room] = await db
    .select()
    .from(rooms)
    .where(eq(rooms.inviteCode, code.toUpperCase()));
  if (!room) notFound();
  const people = await db
    .select()
    .from(members)
    .where(eq(members.roomId, room.id));
  if (viewer && people.some((p) => p.userId === viewer.id))
    redirect(`/rooms/${room.id}`);
  return (
    <main className="flex min-h-[calc(100dvh-64px)] items-center justify-center p-6">
      <div className="panel w-full max-w-sm p-6">
        <p className="eyebrow mb-3">Room invitation</p>
        <h1 className="mb-3 text-lg font-medium">{room.title}</h1>
        <p className="mb-6 whitespace-pre-line text-xs leading-6 text-muted-foreground">
          {room.note || "Join this consistency challenge."}
        </p>
        <div className="mb-6 flex flex-wrap gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="size-3" />
            {people.length} members
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3" />
            {dateLabel(room.startDate)} —{" "}
            {room.endDate ? dateLabel(room.endDate) : "∞"}
          </span>
        </div>
        <JoinForm signedIn={Boolean(viewer)} code={code} />
      </div>
    </main>
  );
}
