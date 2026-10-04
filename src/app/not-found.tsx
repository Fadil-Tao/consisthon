import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <p className="eyebrow mb-4">A little detour</p>
      <h1 className="mb-4 text-2xl font-medium tracking-tight">
        This room isn't here.
      </h1>
      <p className="mb-8 text-xs leading-6 text-muted-foreground">
        Check your invite link or room code. Private rooms need an invitation
        before you can open them.
      </p>
      <Button asChild>
        <Link href="/">Back to your rooms</Link>
      </Button>
    </main>
  );
}
