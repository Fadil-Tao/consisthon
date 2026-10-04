"use client";

import { ExternalLink, Link2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { LinkPreview } from "@/lib/link-preview";

export function ProofImagePreview({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative flex h-48 items-center justify-center overflow-hidden rounded-md border bg-muted/30 sm:h-60">
      {failed ? (
        <p className="text-xs text-muted-foreground">
          Image preview unavailable.
        </p>
      ) : (
        <Image
          src={src}
          alt="Proof image preview"
          fill
          unoptimized
          sizes="(max-width: 640px) 100vw, 540px"
          className="object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export function ProofLinkPreview({
  roomId,
  value,
}: {
  roomId: string;
  value: string;
}) {
  const [metadata, setMetadata] = useState<{
    url: string;
    preview: LinkPreview | null;
  } | null>(null);
  const [failedImage, setFailedImage] = useState("");
  let url: URL | null = null;
  try {
    const candidate = new URL(value);
    if (/^https?:$/.test(candidate.protocol)) url = candidate;
  } catch {
    /* Wait for a complete URL. */
  }
  const href = url?.href || "";
  useEffect(() => {
    if (!href) return;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ roomId, url: href });
        const response = await fetch(`/api/link-preview?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted)
          setMetadata({ url: href, preview: data.preview });
      } catch {
        /* Keep the clickable URL preview. */
      }
    }, 500);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [href, roomId]);
  if (!url) return null;
  const preview = metadata?.url === href ? metadata.preview : null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open proof link"
      className="block overflow-hidden rounded-md border bg-card transition-colors hover:bg-muted/40"
    >
      {preview?.image && failedImage !== preview.image ? (
        <div className="relative h-36 border-b bg-muted/30">
          <Image
            src={preview.image}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 640px) 100vw, 540px"
            className="object-cover"
            referrerPolicy="no-referrer"
            onError={() => setFailedImage(preview.image || "")}
          />
        </div>
      ) : null}
      <div className="flex items-start gap-2.5 p-3">
        <Link2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="break-words text-xs font-medium">
            {preview?.title || url.hostname}
          </p>
          {preview?.description ? (
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
              {preview.description}
            </p>
          ) : null}
          <p className="mt-1 truncate text-[10px] text-muted-foreground">
            {url.host}
            {url.pathname === "/" ? "" : url.pathname}
          </p>
        </div>
        <ExternalLink className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
      </div>
    </a>
  );
}
