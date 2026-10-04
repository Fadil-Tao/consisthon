import { NextResponse } from "next/server";
import { MAX_PROOF_SIZE, PROOF_TYPES } from "@/lib/proof";
import { requireMembership } from "@/lib/queries";
import { AppError, requireViewer } from "@/lib/session";
import { storageAvailable } from "@/lib/storage";
import { storeProofUpload, UploadLimitError } from "@/lib/uploads";

export async function POST(request: Request) {
  try {
    // Next.js may use its internal listening address in request.url.
    // Cookie-authenticated uploads must come from the configured app origin.
    const appOrigin = new URL(
      process.env.BETTER_AUTH_URL || "http://localhost:3000",
    ).origin;
    if (request.headers.get("origin") !== appOrigin)
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    const viewer = await requireViewer();
    if (!storageAvailable)
      return NextResponse.json(
        { error: "File uploads are unavailable. Add a proof link instead." },
        { status: 503 },
      );
    const contentLength = Number(request.headers.get("content-length"));
    if (
      !Number.isFinite(contentLength) ||
      contentLength <= 0 ||
      contentLength > MAX_PROOF_SIZE + 65536
    )
      return NextResponse.json(
        { error: "Proof files must be 500 KB or smaller." },
        { status: 413 },
      );
    const form = await request.formData();
    const roomId = form.get("roomId");
    if (typeof roomId !== "string" || roomId.length > 100)
      return NextResponse.json({ error: "Choose a room." }, { status: 400 });
    await requireMembership(roomId, viewer.id);
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      !file.size ||
      !PROOF_TYPES.includes(file.type)
    )
      return NextResponse.json(
        { error: "Use a JPG, PNG, WebP, PDF, or MP4 file." },
        { status: 400 },
      );
    if (file.size > MAX_PROOF_SIZE)
      return NextResponse.json(
        { error: "Proof files must be 500 KB or smaller." },
        { status: 413 },
      );
    return NextResponse.json(await storeProofUpload(viewer.id, roomId, file));
  } catch (error) {
    if (error instanceof UploadLimitError)
      return NextResponse.json({ error: error.message }, { status: 429 });
    if (error instanceof AppError)
      return NextResponse.json({ error: error.message }, { status: 403 });
    console.error("Proof upload failed", error);
    return NextResponse.json(
      { error: "Couldn't upload your proof. Try again." },
      { status: 500 },
    );
  }
}
