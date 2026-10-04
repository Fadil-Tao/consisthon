"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="mb-4 text-xl font-medium">A small bump in the road.</h1>
      <p className="mb-6 text-xs leading-6 text-muted-foreground">
        We couldn't load this page. Give it another try.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
