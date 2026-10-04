"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import type { RoomListing } from "@/lib/queries";
import { RoomCard } from "./room-card";
import { Input } from "./ui/input";

export function RoomBrowser({
  rooms,
  signedIn,
}: {
  rooms: RoomListing[];
  signedIn: boolean;
}) {
  const [search, setSearch] = useState("");
  const filtered = rooms.filter((r) =>
    `${r.title} ${r.note}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Find a room by name or what you're working on…"
          aria-label="Search rooms"
          className="pl-7"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {filtered.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <RoomCard key={r.id} room={r} signedIn={signedIn} />
          ))}
        </div>
      ) : (
        <div className="panel p-12 text-center">
          <p className="mb-2 font-medium">No rooms here yet.</p>
          <p className="text-xs text-muted-foreground">
            Try a different search, or create a room for your people.
          </p>
        </div>
      )}
    </>
  );
}
