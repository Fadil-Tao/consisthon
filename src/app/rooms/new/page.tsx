import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RoomForm } from "@/components/forms";
import { getViewer } from "@/lib/session";

export const metadata = { title: "Create a room" };
export default async function NewRoomPage() {
  if (!(await getViewer())) redirect("/sign-in?next=/rooms/new");
  return (
    <main className="mx-auto max-w-[680px] px-6 py-10">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-xs text-muted-foreground"
      >
        <ArrowLeft className="size-3" />
        Back home
      </Link>
      <h1 className="text-2xl font-medium tracking-tight">Create a room</h1>
      <p className="mb-8 mt-3 text-xs leading-relaxed text-muted-foreground">
        Set the schedule, points, and room rules. You’ll be the room master.
      </p>
      <div className="panel p-4 sm:p-6">
        <RoomForm />
      </div>
    </main>
  );
}
