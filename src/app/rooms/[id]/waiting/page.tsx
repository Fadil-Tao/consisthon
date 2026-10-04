import { ArrowLeft, ArrowRight, CalendarDays, Crown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GoalDialog, InviteDialog } from "@/components/forms";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { dateLabel, daysBetween, roomStatus } from "@/lib/domain";
import { getRoomData } from "@/lib/queries";
import { AppError, getViewer } from "@/lib/session";

export const metadata = { title: "The waiting room" };
export default async function WaitingRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer)
    redirect(`/sign-in?next=${encodeURIComponent(`/rooms/${id}/waiting`)}`);
  const data = await getRoomData(id, viewer.id).catch((error) => {
    if (error instanceof AppError) return null;
    throw error;
  });
  if (!data) notFound();
  const { room, rankings, today } = data;
  const me = rankings.find((p) => p.userId === viewer.id);
  if (!me) notFound();
  const status = roomStatus(room, today);
  return (
    <main className="relative min-h-[calc(100dvh-64px)]">
      <Image
        src="/waiting-room.png"
        alt="A traveler resting on a grassy hillside, looking toward distant mountains and a castle."
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/0 to-black/25" />
      <div className="relative mx-auto max-w-[1240px] px-6 pb-12 pt-7 lg:px-10">
        <div className="mb-16 flex items-center justify-between">
          <Button
            variant="outline"
            asChild
            className="bg-white/85 text-zinc-800"
          >
            <Link href="/">
              <ArrowLeft />
              All rooms
            </Link>
          </Button>
          {room.masterId === viewer.id ? (
            <InviteDialog code={room.inviteCode} />
          ) : null}
        </div>
        <div className="panel ml-auto w-full max-w-[430px] p-5 sm:p-6">
          <p className="eyebrow mb-3">Waiting room</p>
          <h1 className="text-2xl font-medium tracking-tight">{room.title}</h1>
          <p className="mb-6 mt-4 text-xs leading-6 text-muted-foreground">
            {status === "upcoming"
              ? "Set your goal before the challenge begins."
              : status === "ended"
                ? "Review the room's check-ins and results."
                : "Set your goal and submit proof of your daily progress."}
          </p>
          <div className="mb-6 flex items-center gap-3 border-y py-3">
            <CalendarDays className="size-4 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium">
                {status === "upcoming"
                  ? `Starts in ${daysBetween(today, room.startDate)} days`
                  : status === "ended"
                    ? "Challenge dates"
                    : "Schedule"}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {dateLabel(room.startDate, true)} —{" "}
                {room.endDate ? dateLabel(room.endDate, true) : "No end date"}
              </p>
            </div>
          </div>
          <div className="mb-6">
            <div className="mb-4 flex justify-between">
              <p className="eyebrow">Members</p>
              <span className="text-[10px] text-muted-foreground">
                {rankings.filter((p) => p.goal).length}/{rankings.length} goals
                set
              </span>
            </div>
            <div className="space-y-3">
              {rankings.map((p, i) => (
                <div className="flex items-center gap-3" key={p.userId}>
                  <Avatar name={p.name} index={i} className="size-8" />
                  <span className="flex-1 text-xs">
                    {p.name}
                    {p.userId === viewer.id ? " (you)" : ""}
                  </span>
                  {p.userId === room.masterId ? (
                    <Crown
                      className="size-3 text-[#b29257]"
                      aria-label="Room master"
                    />
                  ) : null}
                  <span className="max-w-28 truncate text-[10px] text-muted-foreground">
                    {p.goal?.project || "No goal yet"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {!me.goal && status !== "ended" ? (
            <div className="mb-3">
              <GoalDialog
                room={room}
                goal={null}
                today={today}
                trigger={
                  <Button variant="outline" className="w-full">
                    Set your personal goal
                    <ArrowRight />
                  </Button>
                }
              />
            </div>
          ) : null}
          <Button asChild className="w-full">
            <Link href={`/rooms/${room.id}`}>
              Enter room
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
