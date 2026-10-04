import { ArrowUpRight, CalendarDays, Users } from "lucide-react";
import Link from "next/link";
import { dateLabel } from "@/lib/domain";
import type { RoomListing } from "@/lib/queries";
import { JoinForm } from "./forms";

export function RoomCard({
  room,
  signedIn,
}: {
  room: RoomListing;
  signedIn: boolean;
}) {
  return (
    <article className="panel flex flex-col p-4 transition-colors hover:border-input">
      <div className="mb-3">
        <span className="text-xs text-muted-foreground">
          {room.visibility === "private" ? "Invite only" : "Open room"}
        </span>
      </div>
      <h3 className="mb-2 text-sm font-medium">
        {room.joined ? (
          <Link href={`/rooms/${room.id}`} className="hover:underline">
            {room.title}
          </Link>
        ) : (
          room.title
        )}
      </h3>
      {room.note ? (
        <p className="mb-4 line-clamp-2 flex-1 text-xs/relaxed text-muted-foreground">
          {room.note}
        </p>
      ) : (
        <div className="flex-1" />
      )}
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Users className="size-3" />
          {room.memberCount} {room.memberCount === 1 ? "member" : "members"}
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarDays className="size-3" />
          {dateLabel(room.startDate)} —{" "}
          {room.endDate ? dateLabel(room.endDate) : "∞"}
        </span>
      </div>
      <div className="border-t pt-3">
        {room.joined ? (
          <Link
            href={`/rooms/${room.id}`}
            className="flex items-center justify-between text-xs font-medium"
          >
            Enter room
            <ArrowUpRight className="size-3.5" />
          </Link>
        ) : (
          <JoinForm signedIn={signedIn} roomId={room.id} />
        )}
      </div>
    </article>
  );
}
