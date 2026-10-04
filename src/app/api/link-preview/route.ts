import { NextResponse } from "next/server";
import { getLinkPreview } from "@/lib/link-preview";
import { requireMembership } from "@/lib/queries";
import { AppError, requireViewer } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer();
    const params = new URL(request.url).searchParams;
    const roomId = params.get("roomId") || "";
    const url = params.get("url") || "";
    if (!roomId || roomId.length > 100 || !url || url.length > 2000)
      return NextResponse.json({ preview: null }, { status: 400 });
    await requireMembership(roomId, viewer.id);
    return NextResponse.json(
      { preview: await getLinkPreview(url) },
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    if (error instanceof AppError)
      return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ preview: null }, { status: 500 });
  }
}
