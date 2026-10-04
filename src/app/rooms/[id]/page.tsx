import { notFound, redirect } from "next/navigation";
import { RoomDashboard } from "@/components/room-dashboard";
import { getRoomData } from "@/lib/queries";
import { AppError, getViewer } from "@/lib/session";
import { storageAvailable } from "@/lib/storage";

export const metadata = { title: "Your room" };
export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/sign-in?next=${encodeURIComponent(`/rooms/${id}`)}`);
  const data = await getRoomData(id, viewer.id).catch((error) => {
    if (error instanceof AppError) return null;
    throw error;
  });
  if (!data) notFound();
  return <RoomDashboard data={data} storageAvailable={storageAvailable} />;
}
