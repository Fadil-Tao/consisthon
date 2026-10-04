import { ArrowRight, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { JoinForm } from "@/components/forms";
import { RoomCard } from "@/components/room-card";
import { Button } from "@/components/ui/button";
import { findRooms } from "@/lib/queries";
import { getViewer } from "@/lib/session";

export default async function HomePage() {
  const viewer = await getViewer();
  const mine = viewer
    ? (await findRooms(viewer.id)).filter((r) => r.joined)
    : [];
  return (
    <main className="relative isolate min-h-[calc(100dvh-64px)]">
      <Image
        src="/waiting-room.png"
        alt="A traveler resting on a grassy hillside, looking toward distant mountains and a castle."
        fill
        preload
        sizes="100vw"
        className="-z-20 object-cover object-center"
      />
      <div className="absolute inset-0 -z-10 bg-black/60 dark:bg-black/65" />
      <div className="mx-auto max-w-[880px] px-6 py-12 sm:py-16">
        <h1 className="text-2xl font-medium tracking-tight text-white">
          Find or create a room
        </h1>
        <p className="mb-6 mt-2 text-xs/relaxed text-white/90">
          Join a consistency challenge or start one with your friends.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="panel p-4">
            <h2 className="mb-2 text-sm font-medium">Join a room</h2>
            <p className="mb-4 text-xs/relaxed text-muted-foreground">
              Enter an invite code to join a room.
            </p>
            <JoinForm signedIn={Boolean(viewer)} compact />
            <Link
              href="/rooms"
              className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Or explore open rooms
              <ArrowUpRight className="size-3" />
            </Link>
          </section>
          <section className="panel flex flex-col p-4">
            <h2 className="mb-2 text-sm font-medium">Create a room</h2>
            <p className="mb-4 flex-1 text-xs/relaxed text-muted-foreground">
              Choose a schedule and point system, then invite your friends.
            </p>
            <Button asChild className="w-full justify-between">
              <Link href="/rooms/new">
                Create a room
                <ArrowRight />
              </Link>
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              Each member sets their own goal.
            </p>
          </section>
        </div>
        {mine.length ? (
          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-medium text-white">
                Your rooms{" "}
                <span className="ml-2 text-white/90">{mine.length}</span>
              </h2>
              <Link
                href="/rooms"
                className="text-xs text-white/90 hover:text-white"
              >
                All rooms ↗
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {mine.map((room) => (
                <RoomCard key={room.id} room={room} signedIn />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
