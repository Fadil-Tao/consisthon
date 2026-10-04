import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { uploads } from "@/db/schema";
import { PROOF_TYPES } from "@/lib/proof";
import { requireMembership } from "@/lib/queries";
import { AppError, requireViewer } from "@/lib/session";
import { proofDownloadUrl, readLocalProof } from "@/lib/storage";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const viewer = await requireViewer();
    const { id } = await params;
    const [file] = await db.select().from(uploads).where(eq(uploads.id, id));
    if (!file)
      return NextResponse.json({ error: "Proof not found." }, { status: 404 });
    await requireMembership(file.roomId, viewer.id);
    const inline = new URL(request.url).searchParams.get("preview") === "1";
    if (inline && !PROOF_TYPES.includes(file.contentType))
      return NextResponse.json(
        { error: "Only images can be previewed." },
        { status: 415 },
      );
    if (file.key.startsWith("local:")) {
      const body = await readLocalProof(file.key);
      if (!body)
        return NextResponse.json(
          { error: "Proof not found." },
          { status: 404 },
        );
      return new NextResponse(new Uint8Array(body), {
        headers: {
          "Content-Type": file.contentType,
          "Content-Length": String(body.length),
          "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const response = NextResponse.redirect(
      await proofDownloadUrl(file.key, file.name, inline),
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    if (error instanceof AppError)
      return NextResponse.json({ error: error.message }, { status: 403 });
    console.error("Proof download failed", error);
    return NextResponse.json(
      { error: "Couldn't open this proof." },
      { status: 500 },
    );
  }
}
