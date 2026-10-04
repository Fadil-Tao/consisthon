import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { JoinForm } from "@/components/forms";
import { RoomBrowser } from "@/components/room-browser";
import { Button } from "@/components/ui/button";
import { findRooms } from "@/lib/queries";
import { getViewer } from "@/lib/session";

export const metadata = { title: "Find a room" };
export default async function RoomsPage() {
  const viewer = await getViewer();
  const rooms = await findRooms(viewer?.id);
  return (
    <main className="mx-auto max-w-[1120px] px-6 py-10">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-xs text-muted-foreground"
      >
        <ArrowLeft className="size-3" />
        Back home
      </Link>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Find a room</h1>
          <p className="mt-3 text-xs text-muted-foreground">
            Browse public rooms or join with an invite code.
          </p>
        </div>
        <Button asChild>
          <Link href="/rooms/new">
            <Plus />
            Create room
          </Link>
        </Button>
      </div>
      <div className="panel mb-6 flex flex-wrap items-center justify-between gap-4 p-4">
        <span className="text-xs text-muted-foreground">
          Have an invite code?
        </span>
        <div className="w-full sm:w-72">
          <JoinForm signedIn={Boolean(viewer)} compact />
        </div>
      </div>
      <RoomBrowser rooms={rooms} signedIn={Boolean(viewer)} />
    </main>
  );
}
